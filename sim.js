'use strict';
// Server-side 3D physics + rules. Verlet ragdolls (7 points per blob) with a "muscle" layer:
// they stand, walk in any direction, jump, punch, grab players/ledges, hang, throw and get knocked out.
// Units: meters, Y up.
const Maps = require('./public/maps.js');

const DT = 1 / 60;
const GRAV = 38, MOVE = 5.4, JUMPV = 14.5, MAXV = 28;
const HEAD = 0, CHEST = 1, HIP = 2, HL = 3, HR = 4, FL = 5, FR = 6;
const RAD = [0.36, 0.31, 0.31, 0.16, 0.16, 0.19, 0.19];
const IMASS = [1, 1, 1, 1.5, 1.5, 1, 1];
const LEGH = 0.55, LEG = 0.63, TORSO = 0.5, NECK = 0.4, ARM = 0.95;
const ITER = 5, PUNCH_T = 0.30, KO_TIME = 3.0;
const STEER = { normal: 0.28, ice: 0.02, bounce: 0.28, conv: 0.28 };

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrapPi = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
function setVel(p, vx, vy, vz) { p.px = p.x - vx * DT; p.py = p.y - vy * DT; p.pz = p.z - vz * DT; }
function addVel(p, vx, vy, vz) { p.px -= vx * DT; p.py -= vy * DT; p.pz -= vz * DT; }
function pull(p, tx, ty, tz, k) { const dx = (tx - p.x) * k, dy = (ty - p.y) * k, dz = (tz - p.z) * k; p.x += dx; p.y += dy; p.z += dz; p.px += dx; p.py += dy; p.pz += dz; }
function dist(a, b, rest, k, mode) { // mode 0 = equal, 1 = max length, 2 = min length
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z; const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (d < 1e-5) return;
  if (mode === 1 && d <= rest) return;
  if (mode === 2 && d >= rest) return;
  const wa = a.pin ? 0 : a.w, wb = b.pin ? 0 : b.w, ws = wa + wb;
  if (!ws) return;
  const f = (d - rest) / d * k / ws;
  a.x += dx * f * wa; a.y += dy * f * wa; a.z += dz * f * wa; b.x -= dx * f * wb; b.y -= dy * f * wb; b.z -= dz * f * wb;
}

function makePlayer(m, sp) {
  const x = sp[0], z = sp[1], y = (sp[2] || 0) + 0.3;
  const mk = (px, py, pz, i) => ({ x: px, y: py, z: pz, px, py, pz, w: IMASS[i], pin: false });
  const pts = [
    mk(x, y + LEG + TORSO + NECK, z, 0), mk(x, y + LEG + TORSO, z, 1), mk(x, y + LEG, z, 2),
    mk(x - 0.4, y + LEG + 0.2, z, 3), mk(x + 0.4, y + LEG + 0.2, z, 4), mk(x - 0.16, y, z, 5), mk(x + 0.16, y, z, 6)
  ];
  return {
    id: m.id, name: m.name, look: m.look, team: m.team, bot: !!m.bot, skill: m.skill || 0.7,
    in: { mx: 0, mz: 0, j: 0, p: 0, g: 0 }, jumpEdge: false, punchEdge: false,
    pts, yaw: Math.atan2(-x, -z), alive: true, ko: 0, stun: 0, stunDelay: 0, getup: 0,
    jumpCd: 0, punchT: 0, punchHand: 0, hitSet: new Set(), noGrab: 0, bounceCd: 0, hazCd: 0,
    gr: [null, null], hanging: false, fT: [-999, -999], fY: [0, 0], surf: 'normal', onG: false,
    phase: 0, moving: false, grabbing: false, lastHit: null, thinkT: 0, gs: [1, 1, 1, 1, 1, 1, 1], landCd: 0
  };
}

class Game {
  constructor(mapId, members) {
    this.map = Maps.byId(mapId);
    this.tick = 0; this.time = 0; this.frozen = true; this.ev = [];
    const spawns = this.map.spawns.slice();
    for (let i = spawns.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [spawns[i], spawns[j]] = [spawns[j], spawns[i]]; }
    this.players = members.map((m, i) => {
      const s = spawns[i % spawns.length];
      return makePlayer(m, [s[0], s[1], this.topAt(s[0], s[1])]);
    });
    this.byId = new Map(this.players.map(p => [p.id, p]));
    this.dyn = Maps.dyn(this.map, 0); this.dynPrev = this.dyn; this.mvDelta = this.dyn.movers.map(() => ({ dx: 0, dy: 0, dz: 0 }));
  }
  topAt(x, z) { let best = 0; for (const b of this.map.solids) if (Math.abs(x - b.x) <= b.w / 2 && Math.abs(z - b.z) <= b.d / 2 && b.y > best) best = b.y; return best; }
  alive() { return this.players.filter(p => p.alive); }
  push(e) { this.ev.push(e); }

  setInput(id, inp) {
    const pl = this.byId.get(id); if (!pl) return;
    const nj = inp.j ? 1 : 0, np = inp.p ? 1 : 0;
    if (nj && !pl.in.j) pl.jumpEdge = true;
    if (np && !pl.in.p) pl.punchEdge = true;
    pl.in.mx = clamp(+inp.mx || 0, -1, 1); pl.in.mz = clamp(+inp.mz || 0, -1, 1);
    pl.in.j = nj; pl.in.p = np; pl.in.g = inp.g ? 1 : 0;
  }
  emote(id, n) { const pl = this.byId.get(id); if (pl && pl.alive) this.push({ e: 'emote', i: id, n }); }

  step() {
    this.tick++; this.time += DT;
    this.dynPrev = this.dyn; this.dyn = Maps.dyn(this.map, this.time);
    this.mvDelta = this.dyn.movers.map((m, i) => ({ dx: m.x - this.dynPrev.movers[i].x, dy: m.y - this.dynPrev.movers[i].y, dz: m.z - this.dynPrev.movers[i].z }));
    const live = this.players.filter(p => p.alive);
    for (const pl of live) { if (pl.bot && !this.frozen) this.botThink(pl); this.control(pl); }
    this.applyWind(live);
    for (const pl of live) this.integrate(pl);
    for (let it = 0; it < ITER; it++) {
      for (const pl of live) { this.pinHands(pl); this.constrain(pl); }
      this.playerCollisions(live);
      for (const pl of live) this.worldCollide(pl);
    }
    for (const pl of live) this.post(pl);
    for (const pl of live) { pl.jumpEdge = false; pl.punchEdge = false; }
  }

  // ------------------------------------------------------------------ muscles
  control(pl) {
    const P = pl.pts, inp = pl.in, frozen = this.frozen, tick = this.tick;
    let mx = frozen ? 0 : inp.mx, mz = frozen ? 0 : inp.mz;
    let mag = Math.hypot(mx, mz); if (mag < 0.15) { mx = mz = mag = 0; } else if (mag > 1) { mx /= mag; mz /= mag; mag = 1; }
    pl.landCd -= DT; pl.jumpCd -= DT; pl.punchT -= DT; pl.noGrab -= DT; pl.bounceCd -= DT; pl.hazCd -= DT; pl.stunDelay -= DT; pl.getup -= DT;
    if (pl.stunDelay <= 0 && pl.stun > 0) pl.stun = Math.max(0, pl.stun - 9 * DT);
    if (pl.ko > 0) {
      pl.ko -= DT;
      if (!frozen && (pl.jumpEdge || pl.punchEdge)) pl.ko -= 0.2; // button mashing wakes you up faster
      if (pl.ko <= 0) { pl.ko = 0; pl.getup = 0.7; this.push({ e: 'up', i: pl.id }); }
    } else if (pl.stun >= 100) this.knockOut(pl);
    const ko = pl.ko > 0;
    pl.moving = !ko && mag > 0;
    pl.onG = tick - pl.fT[0] <= 4 || tick - pl.fT[1] <= 4;
    let onG = pl.onG;
    if (ko) { this.release(pl, 0); this.release(pl, 1); }
    if (pl.moving) pl.yaw += wrapPi(Math.atan2(mx, mz) - pl.yaw) * 0.25;
    const fx = Math.sin(pl.yaw), fz = Math.cos(pl.yaw), rx = Math.cos(pl.yaw), rz = -Math.sin(pl.yaw);

    // ---- grabbing
    const wantGrab = !frozen && !ko && inp.g && pl.noGrab <= 0;
    pl.grabbing = wantGrab;
    for (let h = 0; h < 2; h++) {
      const hand = P[h ? HR : HL]; let g = pl.gr[h];
      if (!wantGrab) { if (g) this.release(pl, h); continue; }
      if (!g) g = this.findGrab(pl, h, hand, onG);
      if (g && g.k === 'p') {
        const o = g.o, q = o.pts[g.i];
        if (!o.alive || Math.hypot(q.x - hand.x, q.y - hand.y, q.z - hand.z) > 1.5) { this.release(pl, h); continue; }
        g.t += DT;
        if (g.t > 0.7) o.stun += (g.i === HEAD ? 24 : 8) * DT * (o.team === pl.team ? 0.3 : 1); // choke!
        o.stunDelay = Math.max(o.stunDelay, 0.8);
      }
    }
    pl.hanging = !!((pl.gr[0] && pl.gr[0].k === 'w') || (pl.gr[1] && pl.gr[1].k === 'w'));
    const hanging = pl.hanging;

    // ---- steering
    if (!ko && !hanging && (onG || mag > 0)) {
      let fac = onG ? (STEER[pl.surf] || 0.28) : 0.06;
      if (mag === 0) fac = onG ? fac * 0.3 : 0;
      if (fac > 0) {
        const tx = mx * MOVE * DT, tz = mz * MOVE * DT;
        for (const i of [HEAD, CHEST, HIP, FL, FR]) {
          const p = P[i], vx = p.x - p.px, vz = p.z - p.pz;
          p.px = p.x - (vx + (tx - vx) * fac); p.pz = p.z - (vz + (tz - vz) * fac);
        }
      }
    }
    if (pl.moving && onG) { const p0 = Math.floor(pl.phase / Math.PI); pl.phase += mag * DT * 12; if (Math.floor(pl.phase / Math.PI) !== p0) this.push({ e: 'step', x: P[HIP].x, y: P[FL].y, z: P[HIP].z }); }

    // ---- jump
    if (!frozen && !ko && pl.jumpEdge) {
      if (hanging) {
        this.release(pl, 0); this.release(pl, 1); pl.noGrab = 0.45;
        for (const p of P) setVel(p, (p.x - p.px) / DT * 0.5 + fx * 1.5, 11, (p.z - p.pz) / DT * 0.5 + fz * 1.5);
        this.push({ e: 'jump', x: P[HIP].x, y: P[HIP].y, z: P[HIP].z });
      } else if (onG && pl.jumpCd <= 0) {
        for (const p of P) setVel(p, (p.x - p.px) / DT, JUMPV, (p.z - p.pz) / DT);
        pl.jumpCd = 0.28; pl.fT[0] = pl.fT[1] = -999; pl.onG = onG = false;
        this.push({ e: 'jump', x: P[HIP].x, y: P[FL].y, z: P[HIP].z });
      }
    }

    // ---- punch / throw
    if (!frozen && !ko && pl.punchEdge && pl.punchT <= 0) {
      const g = (pl.gr[0] && pl.gr[0].k === 'p' && pl.gr[0]) || (pl.gr[1] && pl.gr[1].k === 'p' && pl.gr[1]);
      if (g) this.throwHeld(pl, g, fx, fz);
      else { pl.punchT = PUNCH_T; pl.punchHand ^= 1; pl.hitSet.clear(); this.push({ e: 'punch', i: pl.id }); }
    }
    if (pl.punchT > 0 && !ko) {
      const age = PUNCH_T - pl.punchT, hand = P[pl.punchHand ? HR : HL], ch = P[CHEST], side = pl.punchHand ? 1 : -1;
      if (age < 0.17) pull(hand, ch.x + fx * 1.15 + rx * side * 0.2, ch.y + 0.1, ch.z + fz * 1.15 + rz * side * 0.2, 0.6);
      if (age > 0.04 && age < 0.2) this.punchHits(pl, hand, fx, fz);
    } else if (ko) pl.punchT = 0;

    // ---- gravity scale
    const sup = !ko && !hanging && onG ? 0.12 : 1;
    const hg = !ko && !hanging ? 0.1 : 1;
    pl.gs = [sup, sup, sup, hg, hg, 1, 1];

    // ---- upright muscles
    if (!ko) {
      const hip = P[HIP], ch = P[CHEST], hd = P[HEAD];
      let upr = onG ? 1 : (hanging ? 0.18 : 0.06);
      if (pl.getup > 0) upr *= 1 - pl.getup / 0.7 * 0.7;
      const wob = Math.sin(this.time * 9 + pl.id) * (pl.stun / 100) * 0.3;
      const lx = mx * 0.18 + rx * wob, lz = mz * 0.18 + rz * wob;
      if (onG && !hanging) {
        let gy = 0, n = 0;
        for (let f = 0; f < 2; f++) if (tick - pl.fT[f] <= 4) { gy += pl.fY[f]; n++; }
        if (n) pull(hip, hip.x, gy / n + LEGH, hip.z, 0.3 * upr);
      }
      pull(hd, hip.x + lx, hip.y + NECK + TORSO, hip.z + lz, 0.3 * upr);
      pull(ch, hip.x + lx * 0.5, hip.y + TORSO, hip.z + lz * 0.5, 0.3 * upr);
      if (onG && !hanging) for (const p of [hd, ch, hip, P[HL], P[HR]]) p.py = p.y - (p.y - p.py) * 0.6; // soak vertical velocity so the body stays propped up
      const mv = onG ? mag : 0;
      for (let s = 0; s < 2; s++) {
        const f = P[s ? FR : FL], side = s ? 1 : -1, ph = pl.phase + s * Math.PI, sw = Math.sin(ph) * 0.3 * mv;
        if (onG) pull(f, hip.x + rx * side * 0.15 + fx * sw, hip.y - LEGH + Math.max(0, Math.cos(ph)) * 0.2 * mv, hip.z + rz * side * 0.15 + fz * sw, 0.3);
        else pull(f, hip.x + rx * side * 0.2, hip.y - LEG * 0.82, hip.z + rz * side * 0.2, 0.08);
      }
      for (let s = 0; s < 2; s++) {
        const h = P[s ? HR : HL], side = s ? 1 : -1;
        if (pl.punchT > 0 && pl.punchHand === s && PUNCH_T - pl.punchT < 0.2) continue;
        if (pl.gr[s]) continue;
        if (pl.grabbing) pull(h, ch.x + fx * 0.6 + rx * side * 0.3, ch.y + 0.35, ch.z + fz * 0.6 + rz * side * 0.3, 0.3);
        else if (!onG) pull(h, ch.x + rx * side * 0.55, ch.y + 0.55 + Math.sin(this.time * 14 + side * 2) * 0.3, ch.z + rz * side * 0.55, 0.12);
        else pull(h, ch.x + rx * side * 0.42 + fx * (0.1 + 0.25 * Math.sin(pl.phase + s * 3) * mv), ch.y - 0.5, ch.z + rz * side * 0.42 + fz * (0.1 + 0.25 * Math.sin(pl.phase + s * 3) * mv), 0.25);
      }
    }
  }

  knockOut(pl) {
    pl.ko = KO_TIME; pl.stun = 35; pl.punchT = 0;
    this.release(pl, 0); this.release(pl, 1);
    const h = pl.pts[HEAD];
    this.push({ e: 'ko', i: pl.id, x: h.x, y: h.y, z: h.z });
  }
  release(pl, h) { if (pl.gr[h]) { pl.gr[h] = null; pl.pts[h ? HR : HL].pin = false; } }

  findGrab(pl, h, hand, onG) {
    let best = null, bd = 1e9;
    for (const o of this.players) {
      if (o === pl || !o.alive) continue;
      for (const i of [HEAD, CHEST, HIP, FL, FR]) {
        const q = o.pts[i], d = Math.hypot(q.x - hand.x, q.y - hand.y, q.z - hand.z) - RAD[i];
        if (d < 0.5 && d < bd) { bd = d; best = { k: 'p', o, i, t: 0 }; }
      }
    }
    if (best) { pl.gr[h] = best; return best; }
    if (!onG && hand.y > pl.pts[HIP].y - 0.2) {
      const check = (b, mi) => {
        const hx = b.w / 2, hz = b.d / 2;
        const cx = clamp(hand.x, b.x - hx, b.x + hx), cy = clamp(hand.y, b.y - b.h, b.y), cz = clamp(hand.z, b.z - hz, b.z + hz);
        if (Math.hypot(hand.x - cx, hand.y - cy, hand.z - cz) < 0.28) {
          const g = { k: 'w', x: cx, y: cy, z: cz, mi, ox: 0, oy: 0, oz: 0, t: 0 };
          if (mi >= 0) { const m = this.dyn.movers[mi]; g.ox = cx - m.x; g.oy = cy - m.y; g.oz = cz - m.z; }
          return g;
        }
        return null;
      };
      let g = null;
      for (const b of this.map.solids) { g = check(b, -1); if (g) break; }
      for (let i = 0; i < this.dyn.movers.length && !g; i++) g = check(this.boxOf(this.dyn.movers[i]), i);
      if (g) { pl.gr[h] = g; hand.pin = true; this.push({ e: 'grab', x: hand.x, y: hand.y, z: hand.z }); return g; }
    }
    return null;
  }
  boxOf(m) { return { x: m.x, z: m.z, y: m.y, w: m.w, d: m.d, h: m.h }; }

  throwHeld(pl, g, fx, fz) {
    const o = g.o;
    for (const q of o.pts) setVel(q, fx * 15, 8, fz * 15);
    o.stun += 15; o.stunDelay = 1.5; o.lastHit = pl.id;
    this.release(pl, 0); this.release(pl, 1); pl.noGrab = 0.5;
    const ch = pl.pts[CHEST]; this.push({ e: 'throw', x: ch.x, y: ch.y, z: ch.z });
  }

  punchHits(pl, hand, fx, fz) {
    for (const o of this.players) {
      if (o === pl || !o.alive || pl.hitSet.has(o.id)) continue;
      for (let q = 0; q < 7; q++) {
        if (q === HL || q === HR) continue;
        const p = o.pts[q], r = RAD[q] + 0.2;
        const dx = p.x - hand.x, dy = p.y - hand.y, dz = p.z - hand.z;
        if (dx * dx + dy * dy + dz * dz < r * r) {
          pl.hitSet.add(o.id);
          const k = o.team === pl.team ? 0.5 : 1;
          for (let j = 0; j < 7; j++) { const s = (j === q ? 1 : 0.65) * k; addVel(o.pts[j], fx * 10 * s, 3.8 * s, fz * 10 * s); }
          o.stun += (q === HEAD ? 25 : 14) * k; o.stunDelay = 1.6; o.lastHit = pl.id;
          addVel(pl.pts[CHEST], -fx * 1.5, 0, -fz * 1.5);
          this.push({ e: 'hit', x: p.x, y: p.y, z: p.z, p: q === HEAD ? 2 : 1 });
          break;
        }
      }
    }
  }

  // ------------------------------------------------------------------ physics
  integrate(pl) {
    const gs = pl.gs, mv = MAXV * DT;
    for (let i = 0; i < 7; i++) {
      const p = pl.pts[i];
      if (p.pin) { p.px = p.x; p.py = p.y; p.pz = p.z; continue; }
      let vx = (p.x - p.px) * 0.996, vy = (p.y - p.py) * 0.996, vz = (p.z - p.pz) * 0.996;
      const sp = Math.hypot(vx, vy, vz); if (sp > mv) { const k = mv / sp; vx *= k; vy *= k; vz *= k; }
      p.px = p.x; p.py = p.y; p.pz = p.z;
      p.x += vx; p.y += vy - GRAV * DT * DT * gs[i]; p.z += vz;
    }
  }

  pinHands(pl) {
    for (let h = 0; h < 2; h++) {
      const g = pl.gr[h]; if (!g) continue;
      const hand = pl.pts[h ? HR : HL];
      if (g.k === 'w') {
        let ax = g.x, ay = g.y, az = g.z;
        if (g.mi >= 0) { const m = this.dyn.movers[g.mi]; ax = m.x + g.ox; ay = m.y + g.oy; az = m.z + g.oz; }
        hand.x = hand.px = ax; hand.y = hand.py = ay; hand.z = hand.pz = az; hand.pin = true;
      } else dist(hand, g.o.pts[g.i], 0.15, 0.5, 0);
    }
  }

  constrain(pl) {
    const P = pl.pts, ko = pl.ko > 0;
    dist(P[HEAD], P[CHEST], NECK, 1, 0);
    dist(P[CHEST], P[HIP], TORSO, 1, 0);
    dist(P[HEAD], P[HIP], NECK + TORSO, ko ? 0 : (pl.hanging ? 0.3 : 0.7), 0);
        dist(P[HIP], P[FL], LEG, 1, 1); dist(P[HIP], P[FR], LEG, 1, 1);
    dist(P[HIP], P[FL], LEG * 0.5, ko ? 0.3 : 0.6, 2); dist(P[HIP], P[FR], LEG * 0.5, ko ? 0.3 : 0.6, 2);
    dist(P[FL], P[FR], 0.28, 0.5, 2); dist(P[FL], P[FR], 0.6, 0.4, 1);
    dist(P[CHEST], P[HL], ARM, 1, 1); dist(P[CHEST], P[HR], ARM, 1, 1);
    dist(P[CHEST], P[HL], 0.15, 0.5, 2); dist(P[CHEST], P[HR], 0.15, 0.5, 2);
  }

  playerCollisions(live) {
    const idx = [HEAD, CHEST, HIP, FL, FR];
    for (let a = 0; a < live.length; a++) for (let b = a + 1; b < live.length; b++) {
      const A = live[a], B = live[b];
      for (const i of idx) {
        const p = A.pts[i];
        for (const j of idx) {
          const q = B.pts[j], r = RAD[i] + RAD[j] - 0.02;
          const dx = q.x - p.x, dy = q.y - p.y, dz = q.z - p.z;
          if (dx > r || dx < -r || dy > r || dy < -r || dz > r || dz < -r) continue;
          const d2 = dx * dx + dy * dy + dz * dz; if (d2 >= r * r || d2 < 1e-8) continue;
          const d = Math.sqrt(d2), pen = (r - d) / d * 0.5;
          p.x -= dx * pen; p.y -= dy * pen; p.z -= dz * pen; q.x += dx * pen; q.y += dy * pen; q.z += dz * pen;
        }
      }
    }
  }

  worldCollide(pl) {
    const map = this.map, dyn = this.dyn;
    for (let i = 0; i < 7; i++) {
      const p = pl.pts[i]; if (p.pin) continue;
      const r = RAD[i];
      for (const b of map.solids) this.boxHit(pl, i, p, r, b, 0, 0, 0, b.type || 'normal', b);
      for (let k = 0; k < dyn.movers.length; k++) { const m = dyn.movers[k], d = this.mvDelta[k]; if (m.kill) continue; this.boxHit(pl, i, p, r, m, d.dx, d.dy, d.dz, 'normal', null); }
      for (const bl of dyn.balls) this.ballHit(pl, i, p, r, bl);
      for (const br of dyn.bars) this.barHit(pl, i, p, r, br);
    }
  }

  boxHit(pl, i, p, r, b, vsx, vsy, vsz, type, def) {
    const hx = b.w / 2, hz = b.d / 2, y0 = b.y - b.h, y1 = b.y;
    const cx = clamp(p.x, b.x - hx, b.x + hx), cy = clamp(p.y, y0, y1), cz = clamp(p.z, b.z - hz, b.z + hz);
    const dx = p.x - cx, dy = p.y - cy, dz = p.z - cz, d2 = dx * dx + dy * dy + dz * dz;
    if (d2 >= r * r) return;
    let nx, ny, nz, pen;
    if (d2 > 1e-8) { const d = Math.sqrt(d2); nx = dx / d; ny = dy / d; nz = dz / d; pen = r - d; }
    else {
      const c = [[p.x - (b.x - hx), -1, 0, 0], [b.x + hx - p.x, 1, 0, 0], [y1 - p.y, 0, 1, 0], [p.y - y0, 0, -1, 0], [p.z - (b.z - hz), 0, 0, -1], [b.z + hz - p.z, 0, 0, 1]];
      let m = c[0]; for (const e of c) if (e[0] < m[0]) m = e;
      nx = m[1]; ny = m[2]; nz = m[3]; pen = m[0] + r;
    }
    if (ny > 0.5 && (vsx !== 0 || vsz !== 0)) { p.x += vsx; p.px += vsx; p.z += vsz; p.pz += vsz; } // ride moving platforms
    if (def && type === 'conv' && ny > 0.5) vsx += (def.dir || 1) * (def.speed || 3) * DT;
    this.resolve(pl, i, p, nx, ny, nz, pen, type, vsx, vsy, vsz);
  }

  resolve(pl, i, p, nx, ny, nz, pen, type, vsx, vsy, vsz) {
    const vx = p.x - p.px, vy = p.y - p.py, vz = p.z - p.pz;
    p.x += nx * pen; p.y += ny * pen; p.z += nz * pen;
    const rx = vx - vsx, ry = vy - vsy, rz = vz - vsz;
    let vn = rx * nx + ry * ny + rz * nz;
    let tx = rx - vn * nx, ty = ry - vn * ny, tz = rz - vn * nz;
    const inV = -vn / DT, foot = i === FL || i === FR;
    let fric = type === 'ice' ? 0.004 : (type === 'conv' ? 0.3 : (foot ? 0.28 : 0.1));
    if (pl.moving && type !== 'ice') fric *= 0.12;
    if (vn < 0) vn = 0;
    const k = 1 - fric; tx *= k; ty *= k; tz *= k;
    p.px = p.x - (vsx + tx + vn * nx); p.py = p.y - (vsy + ty + vn * ny); p.pz = p.z - (vsz + tz + vn * nz);
    if (ny > 0.5) {
      if (foot) { if (inV > 5 && pl.landCd <= 0 && this.tick - pl.fT[i - FL] > 6) { pl.landCd = 0.25; this.push({ e: 'land', x: p.x, y: p.y - .15, z: p.z, p: inV }); } pl.fT[i - FL] = this.tick; pl.fY[i - FL] = p.y; pl.surf = type; }
      if (type === 'bounce' && (foot || i === HIP) && pl.bounceCd <= 0) {
        const out = Math.min(21, 9.5 + 0.55 * Math.max(0, inV));
        for (const q of pl.pts) setVel(q, (q.x - q.px) / DT, out, (q.z - q.pz) / DT);
        pl.bounceCd = 0.18; pl.fT[0] = pl.fT[1] = -999;
        this.push({ e: 'bounce', x: p.x, y: p.y, z: p.z });
      }
      if (inV > 18 && i === HEAD && pl.hazCd <= 0) { pl.stun += 10; pl.hazCd = 0.4; this.push({ e: 'bonk', x: p.x, y: p.y, z: p.z }); }
    }
  }

  ballHit(pl, i, p, r, bl) {
    const dx = p.x - bl.x, dy = p.y - bl.y, dz = p.z - bl.z, R = r + bl.r, d2 = dx * dx + dy * dy + dz * dz;
    if (d2 >= R * R) return;
    const d = Math.sqrt(d2) || 0.001, nx = dx / d, ny = dy / d, nz = dz / d;
    p.x += nx * (R - d); p.y += ny * (R - d); p.z += nz * (R - d);
    setVel(p, bl.vx * 1.15 + nx * 2, bl.vy * 1.15 + ny * 2 + 2, bl.vz + nz * 2);
    if (pl.hazCd <= 0) {
      pl.hazCd = 0.7; pl.stun += 38; pl.stunDelay = 1.5;
      for (const q of pl.pts) setVel(q, bl.vx * 0.8, bl.vy * 0.8 + 3, bl.vz * 0.8);
      this.push({ e: 'hit', x: p.x, y: p.y, z: p.z, p: 3 });
    }
  }

  barHit(pl, i, p, r, br) {
    const ca = Math.cos(br.ang), sa = Math.sin(br.ang);
    const ax = br.cx - ca * br.len, az = br.cz - sa * br.len, abx = 2 * ca * br.len, abz = 2 * sa * br.len;
    const t = clamp(((p.x - ax) * abx + (p.z - az) * abz) / (abx * abx + abz * abz), 0, 1);
    const cx = ax + abx * t, cz = az + abz * t, cy = br.cy;
    const dx = p.x - cx, dy = p.y - cy, dz = p.z - cz, R = r + br.r, d2 = dx * dx + dy * dy + dz * dz;
    if (d2 >= R * R) return;
    const d = Math.sqrt(d2) || 0.001;
    const vsx = -br.om * (cz - br.cz) * DT * 1.25, vsz = br.om * (cx - br.cx) * DT * 1.25; // surface velocity at contact
    this.resolve(pl, i, p, dx / d, dy / d, dz / d, R - d, 'bar', vsx, 0, vsz);
    if (pl.hazCd <= 0 && Math.hypot(vsx, vsz) / DT > 2.5) { pl.hazCd = 0.5; pl.stun += 12; pl.stunDelay = 1.2; this.push({ e: 'hit', x: p.x, y: p.y, z: p.z, p: 1 }); }
  }

  // ------------------------------------------------------------------ rules
  post(pl) {
    const hip = pl.pts[HIP], map = this.map;
    if (hip.y < map.killY || Math.abs(hip.x) > 80 || Math.abs(hip.z) > 80 || hip.y > 60) return this.die(pl, 'fall');
    for (const m of this.dyn.movers) {
      if (!m.kill) continue;
      for (const i of [HEAD, CHEST, HIP, FL, FR]) {
        const p = pl.pts[i];
        if (Math.abs(p.x - m.x) < m.w / 2 + .1 && Math.abs(p.z - m.z) < m.d / 2 + .1 && p.y < m.y + .1 && p.y > m.y - m.h - .1) return this.die(pl, 'crush');
      }
    }
    for (const hz of map.hazards || []) {
      for (const i of [HIP, FL, FR, CHEST]) {
        const p = pl.pts[i];
        if (Math.abs(p.x - hz.x) < hz.w / 2 && Math.abs(p.z - hz.z) < hz.d / 2 && p.y < hz.y && p.y > hz.y - hz.h) return this.die(pl, 'lava');
      }
    }
  }
  applyWind(live) {
    for (const w of this.dyn.wind || []) {
      if (!w.on) continue;
      for (const pl of live) for (const p of pl.pts) {
        if (Math.abs(p.x - w.x) < w.w / 2 && Math.abs(p.z - w.z) < w.d / 2 && p.y > w.y0 && p.y < w.y1) addVel(p, -w.ax * DT * (pl.onG ? 0.8 : 1.2), 0, -w.az * DT);
      }
    }
  }
  die(pl, cause) {
    pl.alive = false; this.release(pl, 0); this.release(pl, 1);
    const h = pl.pts[HIP];
    this.push({ e: 'die', i: pl.id, c: cause, x: h.x, y: Math.max(h.y, this.map.killY + 4), z: h.z, by: pl.lastHit });
  }

  // ------------------------------------------------------------------ bots
  groundAt(x, z, y) {
    let best = null;
    const test = b => { if (b.wall) return; if (Math.abs(x - b.x) <= b.w / 2 + 0.3 && Math.abs(z - b.z) <= b.d / 2 + 0.3 && b.y <= y + 1.2 && (best === null || b.y > best)) best = b.y; };
    this.map.solids.forEach(test); this.dyn.movers.forEach(m => test(m));
    return best;
  }
  botThink(pl) {
    pl.thinkT -= DT; if (pl.thinkT > 0) return;
    pl.thinkT = 0.07 + Math.random() * 0.08;
    const inp = pl.in, pj = inp.j, pp = inp.p;
    this.botDecide(pl);
    if (inp.j && !pj) pl.jumpEdge = true;
    if (inp.p && !pp) pl.punchEdge = true;
  }
  botDecide(pl) {
    const inp = pl.in, hip = pl.pts[HIP], sk = pl.skill;
    inp.g = 0; inp.p = 0; inp.j = 0;
    if (pl.ko > 0) { inp.mx = inp.mz = 0; inp.j = Math.random() < 0.5 ? 1 : 0; inp.p = Math.random() < 0.5 ? 1 : 0; return; }
    const toward = (x, z, s) => { const dx = x - hip.x, dz = z - hip.z, d = Math.hypot(dx, dz) || 1; inp.mx = dx / d * (s || 1); inp.mz = dz / d * (s || 1); };
    let tgt = null, bd = 1e9;
    for (const o of this.players) {
      if (o === pl || !o.alive || o.team === pl.team) continue;
      const d = Math.hypot(o.pts[HIP].x - hip.x, o.pts[HIP].z - hip.z, (o.pts[HIP].y - hip.y) * 2);
      if (d < bd) { bd = d; tgt = o; }
    }
    const gy = this.groundAt(hip.x, hip.z, hip.y);
    if (gy === null) { toward(0, 0); inp.g = 1; inp.j = (pl.hanging || Math.random() < 0.15) ? 1 : 0; return; }
    const holding = (pl.gr[0] && pl.gr[0].k === 'p') ? pl.gr[0] : (pl.gr[1] && pl.gr[1].k === 'p' ? pl.gr[1] : null);
    const len = Math.hypot(hip.x, hip.z) || 1, ox = hip.x / len, oz = hip.z / len; // outward direction
    if (holding) {
      inp.g = 1; inp.mx = ox; inp.mz = oz;
      if (this.groundAt(hip.x + ox * 2.2, hip.z + oz * 2.2, hip.y) === null || (holding.t > 1.6 && Math.random() < 0.3)) inp.p = 1;
      return;
    }
    // don't walk off by accident (ice maps are slippery, so be extra careful)
    const ahead = this.groundAt(hip.x + ox * 1.6, hip.z + oz * 1.6, hip.y);
    if (ahead === null && len > 3 && Math.random() < 0.75) { toward(0, 0, 0.8); return; }
    if (!tgt) { inp.mx = inp.mz = 0; return; }
    const tp = tgt.pts[HIP], dx = tp.x - hip.x, dz = tp.z - hip.z, dy = tp.y - hip.y, d = Math.hypot(dx, dz);
    if (d < 1.5 && Math.abs(dy) < 1.8) {
      toward(tp.x, tp.z, d < 0.7 ? 0 : 0.6);
      const r = Math.random();
      if (r < 0.45 * sk) inp.p = 1; else if (r < 0.62 * sk) inp.g = 1;
      if (Math.random() < 0.05) inp.j = 1;
    } else {
      toward(tp.x, tp.z, 1);
      if (dy > 2 && d < 5 && Math.random() < 0.3) inp.j = 1;
      if (Math.random() < 0.02) inp.j = 1;
      if (d < 5 && Math.random() < 0.05) inp.g = 1;
    }
    if (Math.random() < 0.004) this.emote(pl.id, (Math.random() * 8) | 0);
  }

  // ------------------------------------------------------------------ snapshot
  snapshot() {
    const pl = this.players.map(p => {
      const f = (p.alive ? 1 : 0) | (p.ko > 0 ? 2 : 0) | (p.punchT > 0 ? 8 : 0) | (p.grabbing ? 16 : 0) | (p.hanging ? 32 : 0) | (p.punchHand ? 64 : 0);
      const a = [p.id, f, Math.round(p.stun), Math.round(p.yaw * 100)];
      if (p.alive) for (const q of p.pts) a.push(Math.round(q.x * 100), Math.round(q.y * 100), Math.round(q.z * 100));
      return a;
    });
    const ev = this.ev; this.ev = [];
    return { gt: Math.round(this.time * 1000) / 1000, pl, ev };
  }
}

module.exports = { Game, DT };
