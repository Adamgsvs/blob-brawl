// Physics and rules. Runs on the server (the authority) and, for the local player only, in the browser (prediction).
// Every beast is an "active ragdoll": 14 particles held together by distance constraints (position based
// dynamics), plus a muscle layer that makes it stand, waddle, reach, grab, lift, punch, headbutt and kick.
// When a beast is knocked out the muscles switch off and what is left is a floppy ragdoll.
import { P, NP, REST, RADIUS, MASS, TORSO, STAND_H, IDLE } from './skeleton.js';
import { stageById, dynState } from './stages.js';

export const DT = 1 / 60;
export const BTN = { JUMP: 1, HL: 2, HR: 4, LIFT: 8, KICK: 16, BUTT: 32 };

const GRAV = 26, ITER = 8;
const WALK = 2.9, RUN = 4.7, JUMP_V = 7.3;
const PUNCH_DUR = 0.3, BUTT_DUR = 0.34, KICK_DUR = 0.32;
const { HEAD, CHEST, PELVIS, SHL, SHR, BELLY, ELL, ELR, HAL, HAR, KNL, KNR, FTL, FTR } = P;
const SH = [SHL, SHR], EL = [ELL, ELR], HA = [HAL, HAR], KN = [KNL, KNR], FT = [FTL, FTR], SG = [1, -1];
const BODY = [HEAD, CHEST, PELVIS, SHL, SHR, BELLY, KNL, KNR, FTL, FTR];   // particles that collide with other beasts
const HITSET = [HEAD, CHEST, PELVIS, BELLY, SHL, SHR];                       // particles that can be struck
const GRABSEG = [[HEAD, CHEST], [CHEST, PELVIS], [SHL, ELL], [ELL, HAL], [SHR, ELR], [ELR, HAR], [PELVIS, KNL], [KNL, FTL], [PELVIS, KNR], [KNR, FTR], [SHL, SHR], [BELLY, BELLY]];
const STEER = [HEAD, CHEST, PELVIS, SHL, SHR, BELLY, KNL, KNR, FTL, FTR];

const W = MASS.map(m => 1 / m);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrapPi = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// ---- rest shape of the torso (for shape matching) --------------------------------------------------
let TM = 0; const RCOM = [0, 0, 0];
for (const i of TORSO) { TM += MASS[i]; for (let k = 0; k < 3; k++) RCOM[k] += MASS[i] * REST[i][k]; }
for (let k = 0; k < 3; k++) RCOM[k] /= TM;
const ROFF = TORSO.map(i => [REST[i][0] - RCOM[0], REST[i][1] - RCOM[1], REST[i][2] - RCOM[2]]);
const WT = 1 / TM;

// ---- internal constraints: [i, j, rest, stiffness, mode]  (mode 0 = equal, 1 = max, 2 = min) --------
const CONS = [];
const con = (i, j, k, mode, len) => CONS.push([i, j, len === undefined ? dist3(REST[i], REST[j]) : len, k, mode || 0]);
{
  const core = [CHEST, PELVIS, SHL, SHR, BELLY];
  for (let a = 0; a < core.length; a++) for (let b = a + 1; b < core.length; b++) con(core[a], core[b], 1);
  for (const j of [CHEST, SHL, SHR, BELLY]) con(HEAD, j, 0.8);
  for (let s = 0; s < 2; s++) {
    con(SH[s], EL[s], 1); con(EL[s], HA[s], 1); con(PELVIS, KN[s], 1); con(KN[s], FT[s], 1);
    con(HA[s], CHEST, 0.6, 2, 0.30); con(HA[s], PELVIS, 0.6, 2, 0.30); con(HA[s], BELLY, 0.6, 2, 0.24); con(HA[s], HEAD, 0.6, 2, 0.30);
    con(EL[s], CHEST, 0.6, 2, 0.28); con(EL[s], BELLY, 0.6, 2, 0.26); con(EL[s], PELVIS, 0.6, 2, 0.30);
    con(KN[s], BELLY, 0.6, 2, 0.28); con(KN[s], CHEST, 0.6, 2, 0.48); con(FT[s], PELVIS, 0.6, 2, 0.30);
  }
  con(KNL, KNR, 0.6, 2, 0.22); con(FTL, FTR, 0.6, 2, 0.20); con(HAL, HAR, 0.5, 2, 0.14);
}

// ---- small quaternion helpers ([x,y,z,w]) -----------------------------------------------------------
function quatFromBasis(X, Y, Z) {
  const m00 = X[0], m01 = Y[0], m02 = Z[0], m10 = X[1], m11 = Y[1], m12 = Z[1], m20 = X[2], m21 = Y[2], m22 = Z[2];
  const tr = m00 + m11 + m22; let x, y, z, w, s;
  if (tr > 0) { s = Math.sqrt(tr + 1) * 2; w = 0.25 * s; x = (m21 - m12) / s; y = (m02 - m20) / s; z = (m10 - m01) / s; }
  else if (m00 > m11 && m00 > m22) { s = Math.sqrt(1 + m00 - m11 - m22) * 2; w = (m21 - m12) / s; x = 0.25 * s; y = (m01 + m10) / s; z = (m02 + m20) / s; }
  else if (m11 > m22) { s = Math.sqrt(1 + m11 - m00 - m22) * 2; w = (m02 - m20) / s; x = (m01 + m10) / s; y = 0.25 * s; z = (m12 + m21) / s; }
  else { s = Math.sqrt(1 + m22 - m00 - m11) * 2; w = (m10 - m01) / s; x = (m02 + m20) / s; y = (m12 + m21) / s; z = 0.25 * s; }
  return [x, y, z, w];
}
function quatToward(a, b, maxAngle) { // rotate a toward b by at most maxAngle
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3], bx = b[0], by = b[1], bz = b[2], bw = b[3];
  if (d < 0) { d = -d; bx = -bx; by = -by; bz = -bz; bw = -bw; }
  if (d > 0.99999) return [bx, by, bz, bw];
  const th = Math.acos(d), ang = 2 * th;
  if (ang <= maxAngle) return [bx, by, bz, bw];
  const t = maxAngle / ang, st = Math.sin(th), ka = Math.sin((1 - t) * th) / st, kb = Math.sin(t * th) / st;
  return [a[0] * ka + bx * kb, a[1] * ka + by * kb, a[2] * ka + bz * kb, a[3] * ka + bw * kb];
}
function qrot(q, v, out) {
  const x = q[0], y = q[1], z = q[2], w = q[3], vx = v[0], vy = v[1], vz = v[2];
  const tx = 2 * (y * vz - z * vy), ty = 2 * (z * vx - x * vz), tz = 2 * (x * vy - y * vx);
  out[0] = vx + w * tx + (y * tz - z * ty); out[1] = vy + w * ty + (z * tx - x * tz); out[2] = vz + w * tz + (x * ty - y * tx);
  return out;
}

// ---- colliders --------------------------------------------------------------------------------------
function aabb(b) {
  return {
    x0: b.x - b.w / 2, x1: b.x + b.w / 2, y0: b.y - b.h, y1: b.y, z0: b.z - b.d / 2, z1: b.z + b.d / 2,
    fric: b.slick ? 0.02 : 0.3, trac: b.slick ? 0.03 : 0.22, bounce: b.bounce || 0, cvx: b.conv ? b.conv[0] : 0, cvz: b.conv ? b.conv[1] : 0,
    wall: !!b.wall, nograb: !!b.nograb, vx: 0, vy: 0, vz: 0, mv: -1
  };
}

class Beast {
  constructor(m, sx, sy, sz, yaw) {
    this.id = m.id; this.team = m.team; this.bot = !!m.bot; this.skill = m.skill || 0.7; this.name = m.name;
    this.x = new Float64Array(NP); this.y = new Float64Array(NP); this.z = new Float64Array(NP);
    this.ox = new Float64Array(NP); this.oy = new Float64Array(NP); this.oz = new Float64Array(NP);
    this.pin = new Uint8Array(NP); this.fr = new Uint8Array(NP);
    const c = Math.cos(yaw), s = Math.sin(yaw);
    for (let i = 0; i < NP; i++) {
      const r = IDLE[i];
      this.x[i] = this.ox[i] = sx + r[0] * c + r[2] * s; this.y[i] = this.oy[i] = sy + r[1]; this.z[i] = this.oz[i] = sz - r[0] * s + r[2] * c;
    }
    this.inp = { mx: 0, mz: 0, b: 0 }; this.edge = 0;
    this.alive = true; this.ko = 0; this.koCount = 0; this.stun = 0; this.stunCd = 0; this.bal = 1; this.getup = 0;
    this.yaw = yaw; this.X = [c, 0, -s]; this.Y = [0, 1, 0]; this.Z = [s, 0, c];
    this.gT = [-99, -99]; this.gY = [0, 0]; this.gVx = 0; this.gVy = 0; this.gVz = 0; this.gTrac = 0.22; this.onG = false; this.airT = 0;
    this.phase = 0; this.mv = 0; this.mx = 0; this.mz = 0; this.run = false; this.hang = false; this.lift = false; this.lifted = -99; this.liftedBy = null;
    this.jumpCd = 0; this.knockCd = 0; this.landCd = 0; this.noGrab = 0; this.buttCd = 0; this.kickCd = 0;
    this.arm = [{ mode: 0, t: 0, cd: 0, hit: false, grab: null, grip: 0 }, { mode: 0, t: 0, cd: 0, hit: false, grab: null, grip: 0 }];
    this.at = [{ on: false, off: [0, 0, 0], k: 0, eoff: [0, 0, 0], ke: 0 }, { on: false, off: [0, 0, 0], k: 0, eoff: [0, 0, 0], ke: 0 }];
    this.butt = 0; this.buttHit = false; this.kick = 0; this.kickLeg = 0; this.kickAir = false; this.kickHit = false;
    this.lastHitBy = null; this.aim = null; this.bend = 0; this.mantle = null; this.brain = { t: 0 };
  }
  vel(i) { return [(this.x[i] - this.ox[i]) / DT, (this.y[i] - this.oy[i]) / DT, (this.z[i] - this.oz[i]) / DT]; }
  setVelAll(vx, vy, vz) { for (let i = 0; i < NP; i++) { this.ox[i] = this.x[i] - vx * DT; this.oy[i] = this.y[i] - vy * DT; this.oz[i] = this.z[i] - vz * DT; } }
  addVelAll(vx, vy, vz) { for (let i = 0; i < NP; i++) { this.ox[i] -= vx * DT; this.oy[i] -= vy * DT; this.oz[i] -= vz * DT; } }
  addVel(i, vx, vy, vz) { this.ox[i] -= vx * DT; this.oy[i] -= vy * DT; this.oz[i] -= vz * DT; }
  shift(i, dx, dy, dz) { this.x[i] += dx; this.y[i] += dy; this.z[i] += dz; this.ox[i] += dx; this.oy[i] += dy; this.oz[i] += dz; }
  // a muscle moving limb particle i: the torso recoils so the centre of mass stays put (r = share taken vertically)
  mshift(i, dx, dy, dz, ry) {
    this.shift(i, dx, dy, dz);
    const k = MASS[i] * WT, kx = -dx * k, ky = ry ? -dy * k : 0, kz = -dz * k;
    for (const t of TORSO) { this.x[t] += kx; this.y[t] += ky; this.z[t] += kz; this.ox[t] += kx; this.oy[t] += ky; this.oz[t] += kz; }
  }
}

export class Game {
  constructor(stageId, members, think) {
    this.stage = stageById(stageId);
    this.tick = 0; this.time = 0; this.frozen = true; this.ev = []; this.think = think || null;
    this.puppets = false; this.pk = 1;      // client prediction: other beasts are posed from snapshots (see public/js/predict.js)
    this.boxes = this.stage.solids.map(aabb);
    this.breaks = (this.stage.breakables || []).map(b => Object.assign(aabb(b), { hp: b.hp, alive: true, load: 0 }));
    this.ells = (this.stage.ellipsoids || []).map(e => ({ ...e }));
    this.kills = this.stage.kills || [];
    this.dyn = dynState(this.stage, 0);
    this.mboxes = []; this.buildMovers();
    const sp = this.stage.spawns.slice();
    for (let i = sp.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [sp[i], sp[j]] = [sp[j], sp[i]]; }
    this.beasts = members.map((m, i) => {
      const s = sp[i % sp.length];
      return new Beast(m, s[0], this.surfaceAt(s[0], s[1]) + 0.06, s[1], Math.atan2(-s[0], -s[1] + 0.001));
    });
    this.byId = new Map(this.beasts.map(b => [b.id, b]));
  }

  push(e) { this.ev.push(e); }
  alive() { return this.beasts.filter(b => b.alive); }
  setInput(id, mx, mz, btn) {
    const b = this.byId.get(id); if (!b) return;
    btn = btn | 0;
    b.edge |= btn & ~b.inp.b;
    b.inp.mx = clamp(+mx || 0, -1, 1); b.inp.mz = clamp(+mz || 0, -1, 1); b.inp.b = btn;
  }
  emote(id, n) { const b = this.byId.get(id); if (b && b.alive) this.push({ e: 'emote', i: id, n }); }

  surfaceAt(x, z) {
    let top = -1e9;
    const t = b => { if (!b.invisible && x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && b.y1 > top && b.y1 < 3.5) top = b.y1; };
    this.boxes.forEach((b, i) => { if (!this.stage.solids[i].invisible) t(b); });
    this.breaks.forEach(t); this.mboxes.forEach(m => { if (!m.kill && !m.knock) t(m); });
    for (const e of this.ells) { const u = (x - e.x) / e.rx, v = (z - e.z) / e.rz, q = 1 - u * u - v * v; if (q > 0) top = Math.max(top, e.y + e.ry * Math.sqrt(q)); }
    return top < -1e8 ? 0 : top;
  }

  buildMovers() {
    const defs = this.stage.movers || [], dyn = this.dyn;
    for (let i = 0; i < defs.length; i++) {
      const d = defs[i], s = dyn.movers[i];
      const m = this.mboxes[i] || (this.mboxes[i] = { fric: 0.3, trac: 0.22, bounce: 0, cvx: 0, cvz: 0, wall: false, nograb: false, mv: i, kill: d.kill || null, knock: d.knock || 0 });
      m.x0 = s.x - d.w / 2; m.x1 = s.x + d.w / 2; m.y1 = s.y; m.y0 = s.y - d.h; m.z0 = s.z - d.d / 2; m.z1 = s.z + d.d / 2;
      m.vx = s.vx * DT; m.vy = s.vy * DT; m.vz = s.vz * DT; m.cx = s.x; m.cy = s.y; m.cz = s.z;
    }
  }

  // ================================================================================================ step
  step() {
    this.tick++; this.time += DT;
    this.dyn = dynState(this.stage, this.time);
    this.buildMovers();
    const all = this.beasts.filter(b => b.alive), live = this.puppets ? all.filter(b => !b.puppet) : all;
    for (const b of live) { if (b.bot && !this.frozen && this.think) this.think(this, b); this.control(b); }
    this.applyWind(live);
    for (const b of live) this.integrate(b);
    for (const b of live) { this.frame(b); this.muscles(b); }
    for (let it = 0; it < ITER; it++) {
      for (const b of live) this.solveInternal(b);
      for (const b of live) this.solveArms(b);
      for (const b of live) this.solveGrabs(b);
      if (it & 1) this.collideBeasts(all);
      for (const b of live) this.collideWorld(b);
    }
    for (const b of live) this.post(b);
    this.updateBreakables();
    for (const b of live) b.edge = 0;
  }

  // ================================================================================================ control
  control(b) {
    const frozen = this.frozen, tick = this.tick;
    const btn = frozen ? 0 : b.inp.b, edge = frozen ? 0 : b.edge;
    b.jumpCd -= DT; b.knockCd -= DT; b.landCd -= DT; b.stunCd -= DT; b.noGrab -= DT; b.buttCd -= DT; b.kickCd -= DT;
    b.getup = Math.max(0, b.getup - DT);
    if (b.stunCd <= 0 && b.stun > 0) b.stun = Math.max(0, b.stun - 9 * DT);
    b.bal = Math.min(1, b.bal + 1.5 * DT);
    b.fr.fill(0);

    if (b.ko > 0) {
      b.ko -= DT; if (edge) b.ko -= 0.12;                       // mashing buttons wakes you up sooner
      if (b.ko <= 0) { b.ko = 0; b.getup = 0.7; b.stun = Math.min(55, 22 + 6 * b.koCount); b.bal = 0.3; this.push({ e: 'wake', i: b.id }); }
    } else if (b.stun >= 100) this.knockOut(b);
    const ko = b.ko > 0;

    if (b.mantle) {
      const m = b.mantle, c = m.c; m.t += DT;
      const tx = c.x0 + m.ox, tz = c.z0 + m.oz, ty = c.y1 + STAND_H + RADIUS[FTL] + 0.08;
      let dx = c.vx, dy = c.vy, dz = c.vz;
      const up = ty - b.y[PELVIS], hx = tx - b.x[PELVIS], hz = tz - b.z[PELVIS], hd = Math.hypot(hx, hz);
      if (up > 0.04) dy += Math.min(up, 5.5 * DT);
      else if (hd > 0.04) { const k = Math.min(hd, 4.2 * DT) / hd; dx += hx * k; dz += hz * k; }
      for (let i = 0; i < NP; i++) { b.x[i] += dx; b.y[i] += dy; b.z[i] += dz; b.ox[i] = b.x[i] - c.vx; b.oy[i] = b.y[i]; b.oz[i] = b.z[i] - c.vz; }
      if (ko || (up <= 0.04 && hd <= 0.04) || m.t > 0.9 || (c.alive === false)) { b.mantle = null; b.noGrab = 0.15; }
      b.onG = false; b.airT = 0; b.hang = false; b.mv = 0; b.mx = b.mz = 0; b.run = false; b.lift = false; b.aim = null;
      return;
    }
    b.onG = tick - b.gT[0] <= 3 || tick - b.gT[1] <= 3;
    if (b.onG) b.airT = 0; else b.airT += DT;
    b.hang = !b.onG && (b.pin[HAL] === 1 || b.pin[HAR] === 1);

    let mx = (frozen || ko) ? 0 : b.inp.mx, mz = (frozen || ko) ? 0 : b.inp.mz, mag = Math.hypot(mx, mz);
    if (mag < 0.15) { mx = mz = mag = 0; } else if (mag > 1) { mx /= mag; mz /= mag; mag = 1; }
    b.mv = mag; b.mx = mx; b.mz = mz;
    b.run = !ko && (btn & BTN.JUMP) !== 0 && b.onG && mag > 0.3 && b.jumpCd <= 0;
    if (!ko && mag > 0) b.yaw = wrapPi(b.yaw + clamp(wrapPi(Math.atan2(mx, mz) - b.yaw), -0.17, 0.17));
    b.aim = ko ? null : this.findAim(b);

    // ---- traction: steer the body toward the wanted velocity (relative to whatever we stand on)
    if (!ko) {
      let trac = b.onG ? b.gTrac : (b.hang ? 0.012 : 0.045);
      trac *= 0.35 + 0.65 * b.bal;
      if (b.onG || mag > 0) {
        let sp = b.run ? RUN : WALK;
        if ((b.arm[0].grab && b.arm[0].grab.k === 1) || (b.arm[1].grab && b.arm[1].grab.k === 1)) sp = WALK * 0.62;      // hauling somebody
        const tx = ((b.onG ? b.gVx : 0) + mx * sp) * DT, tz = ((b.onG ? b.gVz : 0) + mz * sp) * DT;
        for (const i of STEER) {
          const vx = b.x[i] - b.ox[i], vz = b.z[i] - b.oz[i];
          b.ox[i] = b.x[i] - (vx + (tx - vx) * trac); b.oz[i] = b.z[i] - (vz + (tz - vz) * trac);
        }
      }
      if (b.onG && mag > 0) {
        const p0 = Math.floor(b.phase / Math.PI);
        b.phase += mag * (b.run ? 17 : 13) * DT;
        if (Math.floor(b.phase / Math.PI) !== p0) this.push({ e: 'step', i: b.id, x: b.x[PELVIS], y: b.y[FTL] - 0.1, z: b.z[PELVIS] });
      }
    }

    // ---- jump / climb
    if (!ko && (edge & BTN.JUMP)) {
      if (b.pin[HAL] || b.pin[HAR]) {
        const s = b.pin[HAL] ? 0 : 1, gr = b.arm[s].grab, c = gr.c, h = HA[s], ax = b.x[h], ay = b.y[h], az = b.z[h];
        this.release(b, 0, false); this.release(b, 1, false); b.noGrab = 0.35; b.arm[0].mode = b.arm[1].mode = 0;
        const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw);
        b.jumpCd = 0.32; b.gT[0] = b.gT[1] = -99; b.onG = false;
        if (c && c.y1 - ay < 1.3 && c.y1 - ay > -0.3) {
          let nx = 0, nz = 0;
          if (Math.abs(ax - c.x0) < 0.03) nx = 1; else if (Math.abs(ax - c.x1) < 0.03) nx = -1; else if (Math.abs(az - c.z0) < 0.03) nz = 1; else if (Math.abs(az - c.z1) < 0.03) nz = -1; else { nx = fx; nz = fz; }
          const mx0 = (c.x0 + c.x1) / 2, mz0 = (c.z0 + c.z1) / 2;
          const tx = clamp(ax + nx * 0.55, Math.min(c.x0 + 0.3, mx0), Math.max(c.x1 - 0.3, mx0)), tz = clamp(az + nz * 0.55, Math.min(c.z0 + 0.3, mz0), Math.max(c.z1 - 0.3, mz0));
          b.mantle = { c, ox: tx - c.x0, oz: tz - c.z0, t: 0 };
        } else for (let i = 0; i < NP; i++) { b.ox[i] = b.x[i] - fx * 2.0 * DT; b.oy[i] = b.y[i] - 9.9 * DT; b.oz[i] = b.z[i] - fz * 2.0 * DT; }
        this.push({ e: 'jump', i: b.id, x: b.x[PELVIS], y: b.y[PELVIS], z: b.z[PELVIS] });
      } else if (b.onG && b.jumpCd <= 0) {
        const sp = b.run ? RUN : WALK, jx = (b.gVx + mx * sp) * DT, jz = (b.gVz + mz * sp) * DT;
        for (let i = 0; i < NP; i++) {
          b.oy[i] = b.y[i] - (JUMP_V + Math.max(0, b.gVy)) * DT;
          if (mag > 0) { const vx = b.x[i] - b.ox[i], vz = b.z[i] - b.oz[i]; b.ox[i] = b.x[i] - (vx + (jx - vx) * 0.85); b.oz[i] = b.z[i] - (vz + (jz - vz) * 0.85); }
        }
        b.jumpCd = 0.32; b.gT[0] = b.gT[1] = -99; b.onG = false;
        this.push({ e: 'jump', i: b.id, x: b.x[PELVIS], y: b.y[FTL] - 0.1, z: b.z[PELVIS] });
      }
    }

    // ---- arms: tap = punch, hold = grab
    b.lift = !ko && (btn & BTN.LIFT) !== 0;
    for (let s = 0; s < 2; s++) {
      const a = b.arm[s], bit = s ? BTN.HR : BTN.HL, held = (btn & bit) !== 0;
      a.cd -= DT;
      if (ko) { if (a.grab) this.release(b, s, false); a.mode = 0; continue; }
      if ((edge & bit) && a.mode === 0 && a.cd <= 0) { a.mode = 1; a.t = 0; a.hit = false; this.push({ e: 'swing', i: b.id }); }
      else if (a.mode === 1) { a.t += DT; if (a.t >= PUNCH_DUR) { if (held) { a.mode = 2; a.t = 0; } else { a.mode = 0; a.cd = 0.16; } } }
      else if (a.mode === 2) { a.t += DT; if (!held) { this.release(b, s, true); a.mode = 0; a.cd = 0.08; } }
    }
    // a lifted victim is (mostly) carried by the lifter instead of by gravity
    if (b.lift && (b.onG || b.airT < 0.8)) for (let s = 0; s < 2; s++) { const g = b.arm[s].grab; if (g && g.k === 1 && g.b.ko > 0) { g.b.lifted = tick; g.b.liftedBy = b; } }

    // ---- headbutt / kick
    if (!ko) {
      if ((edge & BTN.BUTT) && b.butt <= 0 && b.buttCd <= 0) { b.butt = BUTT_DUR; b.buttHit = false; b.buttCd = 0.95; this.push({ e: 'swing', i: b.id }); }
      if ((edge & BTN.KICK) && b.kick <= 0 && b.kickCd <= 0) {
        b.kick = KICK_DUR + (b.onG ? 0 : 0.18); b.kickAir = !b.onG; b.kickLeg ^= 1; b.kickHit = false; b.kickCd = 0.9;
        if (b.kickAir) for (let i = 0; i < NP; i++) b.addVel(i, b.Z[0] * 2.2, 0.6, b.Z[2] * 2.2);
        this.push({ e: 'swing', i: b.id });
      }
    } else { b.butt = 0; b.kick = 0; }
    if (b.butt > 0) b.butt -= DT;
    if (b.kick > 0) b.kick -= DT;
  }

  findAim(b) {
    let best = null, bd = 1.7;
    const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw);
    for (const o of this.beasts) {
      if (o === b || !o.alive) continue;
      const dx = o.x[CHEST] - b.x[CHEST], dz = o.z[CHEST] - b.z[CHEST], d = Math.hypot(dx, dz);
      if (d < bd && d > 0.05 && (dx * fx + dz * fz) / d > 0.45 && Math.abs(o.y[CHEST] - b.y[CHEST]) < 1.2) { bd = d; best = o; }
    }
    return best;
  }

  knockOut(b) {
    b.koCount++; b.ko = Math.min(6, 0.2 + 0.8 * b.koCount); b.stun = 100; b.butt = 0; b.kick = 0;
    this.release(b, 0, false); this.release(b, 1, false); b.arm[0].mode = b.arm[1].mode = 0;
    this.push({ e: 'ko', i: b.id, x: b.x[HEAD], y: b.y[HEAD], z: b.z[HEAD] });
  }

  release(b, s, canThrow) {
    const a = b.arm[s], g = a.grab; if (!g) return;
    a.grab = null; b.pin[HA[s]] = 0; a.grip = 0;
    if (g.k === 1 && canThrow) {
      const og = b.arm[1 - s].grab;
      if (og && og.k === 1 && og.b === g.b) return;                       // the other hand still has them
      if (b.lift && g.b.liftedBy === b && this.tick - g.b.lifted <= 2 && g.b.y[CHEST] > b.y[CHEST] + 0.25) this.toss(b, g.b);    // let go while carrying = throw
      else { const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw); g.b.addVelAll(fx * 2.6, 0.8, fz * 2.6); g.b.bal = Math.min(g.b.bal, 0.5); }
    }
  }

  toss(b, v) {
    const cv = b.vel(CHEST), fx = Math.sin(b.yaw), fz = Math.cos(b.yaw);
    v.setVelAll(cv[0] + fx * 4.4, 3.8, cv[2] + fz * 4.4);
    v.lastHitBy = b.id; v.bal = Math.min(v.bal, 0.2);
    b.addVelAll(-fx * 0.8, 0, -fz * 0.8);
    this.push({ e: 'throw', x: v.x[CHEST], y: v.y[CHEST], z: v.z[CHEST] });
  }

  applyWind(live) {
    const ws = this.stage.winds || [];
    for (let k = 0; k < ws.length; k++) {
      if (!this.dyn.winds[k]) continue;
      const w = ws[k];
      for (const b of live) {
        const f = b.onG && b.ko <= 0 ? 0.75 : 1.2;
        for (let i = 0; i < NP; i++) {
          if (b.x[i] > w.x0 && b.x[i] < w.x1 && b.z[i] > w.z0 && b.z[i] < w.z1 && b.y[i] > w.y0 && b.y[i] < w.y1) b.addVel(i, w.acc[0] * DT * f, w.acc[1] * DT * f, w.acc[2] * DT * f);
        }
      }
    }
  }

  integrate(b) {
    const g0 = GRAV * DT * DT * (b.lifted === this.tick ? 0.1 : 1), vmax = 32 * DT;
    if (b.mantle) return;
    const held = b.ko <= 0 && b.onG && !b.hang;
    if (b.ko <= 0) for (let s = 0; s < 2; s++) {
      const gr = b.arm[s].grab; if (!gr || gr.k !== 1) continue;
      const cvx = b.x[CHEST] - b.ox[CHEST], cvy = b.y[CHEST] - b.oy[CHEST], cvz = b.z[CHEST] - b.oz[CHEST];
      for (const i of [HA[s], EL[s]]) { b.ox[i] = b.x[i] - cvx; b.oy[i] = b.y[i] - cvy; b.oz[i] = b.z[i] - cvz; }
    }
    for (let i = 0; i < NP; i++) {
      const g = held && i < 6 ? g0 * 0.12 : g0;
      if (b.pin[i]) { b.ox[i] = b.x[i]; b.oy[i] = b.y[i]; b.oz[i] = b.z[i]; continue; }
      let vx = (b.x[i] - b.ox[i]) * 0.996, vy = (b.y[i] - b.oy[i]) * 0.996, vz = (b.z[i] - b.oz[i]) * 0.996;
      const sp = Math.hypot(vx, vy, vz); if (sp > vmax) { const k = vmax / sp; vx *= k; vy *= k; vz *= k; }
      b.ox[i] = b.x[i]; b.oy[i] = b.y[i]; b.oz[i] = b.z[i];
      b.x[i] += vx; b.y[i] += vy - g; b.z[i] += vz;
    }
  }

  // torso frame from the particles: X = toward the left shoulder, Y = up the spine, Z = belly side
  frame(b) {
    let xx = b.x[SHL] - b.x[SHR], xy = b.y[SHL] - b.y[SHR], xz = b.z[SHL] - b.z[SHR];
    let l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
    let yx = b.x[CHEST] - b.x[PELVIS], yy = b.y[CHEST] - b.y[PELVIS], yz = b.z[CHEST] - b.z[PELVIS];
    const d = yx * xx + yy * xy + yz * xz; yx -= xx * d; yy -= xy * d; yz -= xz * d;
    l = Math.hypot(yx, yy, yz) || 1; yx /= l; yy /= l; yz /= l;
    b.X[0] = xx; b.X[1] = xy; b.X[2] = xz; b.Y[0] = yx; b.Y[1] = yy; b.Y[2] = yz;
    b.Z[0] = xy * yz - xz * yy; b.Z[1] = xz * yx - xx * yz; b.Z[2] = xx * yy - xy * yx;
  }

  // ================================================================================================ muscles
  muscles(b) {
    const at = b.at; at[0].on = at[1].on = false;
    if (b.ko > 0) return;
    const ramp = b.getup > 0 ? 1 - b.getup / 0.7 : 1, tick = this.tick, onG = b.onG;
    const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw), rx = fz, rz = -fx;       // facing + "left" on the ground plane
    // reaching for something low: bend the knees and lean over it
    let bend = 0;
    if (b.aim && !b.lift && (b.arm[0].mode === 2 || b.arm[1].mode === 2)) bend = clamp((b.y[CHEST] - b.aim.y[CHEST] - 0.25) * 1.3, 0, 1);
    b.bend += (bend - b.bend) * 0.2;
    const buttAge = b.butt > 0 ? BUTT_DUR - b.butt : -1, kickAge = b.kick > 0 ? (KICK_DUR + (b.kickAir ? 0.18 : 0)) - b.kick : -1;

    // ride moving ground vertically
    if (onG && b.gVy !== 0) for (let i = 0; i < NP; i++) if (!b.pin[i]) b.shift(i, 0, b.gVy * DT, 0);

    // ---- legs hold the body up
    if (onG && !b.hang) {
      let gy = 0, n = 0;
      for (let s = 0; s < 2; s++) if (tick - b.gT[s] <= 3) { gy += b.gY[s]; n++; }
      if (n) {
        const want = gy / n + STAND_H - 0.03 * b.mv + Math.abs(Math.sin(b.phase)) * 0.025 * b.mv - (buttAge >= 0 && buttAge < 0.2 ? 0.05 : 0) - b.bend * 0.27;
        const dy = clamp((want - b.y[PELVIS]) * 0.3 * ramp, -0.04, 0.07);
        for (const i of TORSO) { b.y[i] += dy; b.oy[i] = b.y[i] - (b.y[i] - (b.oy[i] + dy)) * 0.55; }
      }
    }

    // ---- balance: turn the torso toward upright + facing (shape matching around its centre of mass)
    {
      let pitch = 0.07 * b.mv * (b.run ? 1.8 : 1), roll = Math.sin(b.phase) * 0.06 * b.mv;
      const dizzy = (b.stun / 100) * (1 - b.bal * 0.5);
      pitch += Math.sin(this.time * 5.1 + b.id) * 0.18 * dizzy; roll += Math.sin(this.time * 4.3 + b.id * 2) * 0.22 * dizzy;
      pitch += b.bend * 0.85;
      if (buttAge >= 0) pitch += buttAge < 0.16 ? 0.75 : 0.25;
      if (kickAge >= 0) pitch -= b.kickAir ? 0.75 : 0.22;
      if (b.lift && !onG && b.hang) pitch += 0.2;
      const cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
      // yaw frame: X0 = (rx,0,rz), Y0 = up, Z0 = (fx,0,fz); pitch leans Y toward Z, roll leans Y toward X
      const Yp = [fx * sp, cp, fz * sp], Zp = [fx * cp, -sp, fz * cp];
      const Yt = [Yp[0] * cr + rx * sr, Yp[1] * cr, Yp[2] * cr + rz * sr], Xt = [rx * cr - Yp[0] * sr, -Yp[1] * sr, rz * cr - Yp[2] * sr];
      const qt = quatFromBasis(Xt, Yt, Zp), qc = quatFromBasis(b.X, b.Y, b.Z), q = quatToward(qc, qt, 0.55);
      let gain = 0.22 * b.bal * ramp * (1 - 0.4 * Math.min(1, b.stun / 100));
      if (!onG) gain *= b.hang ? 0.2 : 0.3;
      let cx = 0, cy = 0, cz = 0, vx = 0, vy = 0, vz = 0;
      for (const i of TORSO) { const m = MASS[i]; cx += m * b.x[i]; cy += m * b.y[i]; cz += m * b.z[i]; vx += m * (b.x[i] - b.ox[i]); vy += m * (b.y[i] - b.oy[i]); vz += m * (b.z[i] - b.oz[i]); }
      cx *= WT; cy *= WT; cz *= WT; vx *= WT; vy *= WT; vz *= WT;
      const kv = (onG ? 0.3 : 0.06) * b.bal * ramp, t = [0, 0, 0];
      for (let n = 0; n < TORSO.length; n++) {
        const i = TORSO[n]; qrot(q, ROFF[n], t);
        b.shift(i, (cx + t[0] - b.x[i]) * gain, (cy + t[1] - b.y[i]) * gain, (cz + t[2] - b.z[i]) * gain);
        // soak up spin and jiggle so the body does not keep rotating
        const ux = b.x[i] - b.ox[i], uy = b.y[i] - b.oy[i], uz = b.z[i] - b.oz[i];
        b.ox[i] = b.x[i] - (ux + (vx - ux) * kv); b.oy[i] = b.y[i] - (uy + (vy - uy) * kv); b.oz[i] = b.z[i] - (uz + (vz - uz) * kv);
      }
    }

    // ---- legs: little waddling steps on the ground, tucked in the air, swinging for kicks
    const px = b.x[PELVIS], py = b.y[PELVIS], pz = b.z[PELVIS];
    for (let s = 0; s < 2; s++) {
      const f = FT[s], k = KN[s], sg = SG[s];
      let tx, ty, tz, kf, kk, bend = 0.06;
      const kicking = kickAge >= 0 && (b.kickAir || b.kickLeg === s) && kickAge < (b.kickAir ? 0.45 : 0.2);
      if (kicking) {
        const up = b.kickAir ? 0.02 : -0.12 + kickAge * 1.6, ext = b.kickAir ? 0.6 : 0.62;
        tx = px + rx * sg * 0.1 + fx * ext; ty = py + up; tz = pz + rz * sg * 0.1 + fz * ext; kf = 0.6; kk = 0.35; bend = 0.02;
      } else if (onG) {
        const ph = b.phase + s * Math.PI, st = Math.sin(ph) * 0.17 * b.mv * (b.run ? 1.25 : 1);
        tx = px + rx * sg * 0.16 + b.mx / (b.mv || 1) * st; tz = pz + rz * sg * 0.16 + b.mz / (b.mv || 1) * st;
        ty = py - STAND_H + b.bend * 0.27 + Math.max(0, Math.cos(ph)) * 0.1 * b.mv; kf = 0.35 * ramp; kk = 0.3 * ramp; bend = 0.06 + b.bend * 0.2;
      } else {
        tx = px + rx * sg * 0.17 + fx * 0.04; ty = py - 0.4; tz = pz + rz * sg * 0.17 + fz * 0.04; kf = b.hang ? 0.04 : 0.12; kk = kf;
      }
      b.mshift(f, (tx - b.x[f]) * kf, (ty - b.y[f]) * kf, (tz - b.z[f]) * kf, !onG);
      const hx = (px + b.x[f]) / 2 + fx * bend + rx * sg * 0.03, hy = (py + b.y[f]) / 2, hz = (pz + b.z[f]) / 2 + fz * bend + rz * sg * 0.03;
      b.mshift(k, (hx - b.x[k]) * kk, (hy - b.y[k]) * kk, (hz - b.z[k]) * kk, !onG);
    }

    // ---- carry whoever we are lifting above the head
    if (b.lift) {
      const g0 = b.arm[0].grab, g1 = b.arm[1].grab, v = (g0 && g0.k === 1 && g0.b) || (g1 && g1.k === 1 && g1.b);
      if (v && v.lifted === tick && v.liftedBy === b) {
        let cx = 0, cy = 0, cz = 0;
        for (const i of TORSO) { cx += MASS[i] * v.x[i]; cy += MASS[i] * v.y[i]; cz += MASS[i] * v.z[i]; }
        let dx = (b.x[HEAD] - cx * WT) * 0.1, dy = (b.y[HEAD] + 0.62 - cy * WT) * 0.1, dz = (b.z[HEAD] - cz * WT) * 0.1;
        const l = Math.hypot(dx, dy, dz); if (l > 0.04) { dx *= 0.04 / l; dy *= 0.04 / l; dz *= 0.04 / l; }
        for (let i = 0; i < NP; i++) v.shift(i, dx, dy, dz);
        // the victim keeps pace with the carrier instead of swinging about
        const cv = [b.x[CHEST] - b.ox[CHEST], b.y[CHEST] - b.oy[CHEST], b.z[CHEST] - b.oz[CHEST]];
        for (let i = 0; i < NP; i++) { v.ox[i] = v.x[i] - ((v.x[i] - v.ox[i]) * 0.85 + cv[0] * 0.15); v.oy[i] = v.y[i] - ((v.y[i] - v.oy[i]) * 0.85 + cv[1] * 0.15); v.oz[i] = v.z[i] - ((v.z[i] - v.oz[i]) * 0.85 + cv[2] * 0.15); }
      }
    }

    // ---- headbutt: throw the head forward
    if (buttAge >= 0.04 && buttAge < 0.2) {
      const h = HEAD, tx = b.x[CHEST] + b.Z[0] * 0.3 + b.Y[0] * 0.3, ty = b.y[CHEST] + b.Z[1] * 0.3 + b.Y[1] * 0.3, tz = b.z[CHEST] + b.Z[2] * 0.3 + b.Y[2] * 0.3;
      b.shift(h, (tx - b.x[h]) * 0.3, (ty - b.y[h]) * 0.3, (tz - b.z[h]) * 0.3);
    }

    // ---- arms (targets are offsets from the shoulder in the torso frame; applied in solveArms)
    let ax = b.Z[0], ay = b.Z[1], az = b.Z[2];                 // "forward" for reaching: nudged toward a nearby opponent
    if (b.aim) {
      const dx = b.aim.x[CHEST] - b.x[CHEST], dy = b.aim.y[CHEST] + 0.1 - b.y[CHEST], dz = b.aim.z[CHEST] - b.z[CHEST], l = Math.hypot(dx, dy, dz) || 1;
      ax = ax * 0.4 + dx / l * 0.6; ay = ay * 0.4 + dy / l * 0.6; az = az * 0.4 + dz / l * 0.6;
      const n = Math.hypot(ax, ay, az) || 1; ax /= n; ay /= n; az /= n;
    }
    for (let s = 0; s < 2; s++) {
      const a = b.arm[s], t = at[s], sg = SG[s], g = a.grab;
      let lx, ly, lz, k, ke = 0.1, fwdAim = false;
      if (g && g.k === 0) { if (!b.lift) continue; lx = sg * 0.1; ly = -0.26; lz = 0.2; k = 0.2; ke = 0; }      // pull up on a ledge
      else if (g && g.k === 1) { if (b.lift) { lx = sg * 0.07; ly = 0.56; lz = 0.1; k = 0.36; } else { lx = sg * 0.03; ly = -0.04; lz = 0.4; k = 0.28; } }
      else if (a.mode === 1 && a.t < 0.13) { lx = -sg * 0.1; ly = 0.13; lz = 0.56; k = 0.75; fwdAim = true; }
      else if (a.mode === 2 || (a.mode === 1 && (b.inp.b & (s ? BTN.HR : BTN.HL)))) { if (b.lift) { lx = sg * 0.07; ly = 0.42; lz = 0.38; k = 0.34; } else { lx = -sg * 0.02; ly = 0.0; lz = 0.56; k = 0.32; fwdAim = true; } }
      else if (b.lift) { lx = sg * 0.08; ly = 0.56; lz = 0.08; k = 0.25; }
      else if (onG) { const sw = Math.sin(b.phase + s * Math.PI + Math.PI) * 0.16 * b.mv; lx = sg * 0.15; ly = -0.5; lz = 0.08 + sw; k = 0.14; ke = 0; }
      else { lx = sg * 0.34; ly = 0.12 + Math.sin(this.time * 11 + s * 2) * 0.1; lz = 0.12; k = 0.07; ke = 0; }
      t.on = true;
      if (fwdAim) { t.off[0] = b.X[0] * lx + b.Y[0] * ly + ax * lz; t.off[1] = b.X[1] * lx + b.Y[1] * ly + ay * lz; t.off[2] = b.X[2] * lx + b.Y[2] * ly + az * lz; }
      else { t.off[0] = b.X[0] * lx + b.Y[0] * ly + b.Z[0] * lz; t.off[1] = b.X[1] * lx + b.Y[1] * ly + b.Z[1] * lz; t.off[2] = b.X[2] * lx + b.Y[2] * ly + b.Z[2] * lz; }
      t.k = 1 - Math.pow(1 - k * ramp, 1 / ITER);
      t.ke = ke ? 1 - Math.pow(1 - ke, 1 / ITER) : 0;
      t.eoff[0] = t.off[0] * 0.5 + b.X[0] * sg * 0.07 - b.Y[0] * 0.08; t.eoff[1] = t.off[1] * 0.5 + b.X[1] * sg * 0.07 - b.Y[1] * 0.08; t.eoff[2] = t.off[2] * 0.5 + b.X[2] * sg * 0.07 - b.Y[2] * 0.08;
    }
  }

  // arm muscles pull the hand toward its target; whatever the hand cannot do is done by the body instead
  // (so a pinned hand pulls the body up, and nobody can lift themselves into the sky)
  solveArms(b) {
    for (let s = 0; s < 2; s++) {
      const t = b.at[s]; if (!t.on) continue;
      const h = HA[s], sh = SH[s], e = EL[s], g = b.arm[s].grab;
      const dx = (b.x[sh] + t.off[0] - b.x[h]) * t.k, dy = (b.y[sh] + t.off[1] - b.y[h]) * t.k, dz = (b.z[sh] + t.off[2] - b.z[h]) * t.k;
      if (b.pin[h]) { for (const i of TORSO) b.shift(i, -dx, -dy, -dz); }
      else if (g && g.k === 1) { const r = b.onG ? 0.04 : 0.2; b.shift(h, dx * 0.8, dy * 0.8, dz * 0.8); for (const i of TORSO) b.shift(i, -dx * r, -dy * r, -dz * r); }
      else b.mshift(h, dx, dy, dz, !b.onG);
      if (t.ke) b.mshift(e, (b.x[sh] + t.eoff[0] - b.x[e]) * t.ke, (b.y[sh] + t.eoff[1] - b.y[e]) * t.ke, (b.z[sh] + t.eoff[2] - b.z[e]) * t.ke, !b.onG);
    }
  }

  solveInternal(b) {
    const x = b.x, y = b.y, z = b.z, pin = b.pin, soft = b.ko > 0;
    for (let c = 0; c < CONS.length; c++) {
      const cn = CONS[c], i = cn[0], j = cn[1], mode = cn[4];
      const dx = x[j] - x[i], dy = y[j] - y[i], dz = z[j] - z[i], d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < 1e-6) continue;
      if (mode === 1 ? d <= cn[2] : mode === 2 ? d >= cn[2] : false) continue;
      const wi = pin[i] ? 0 : W[i], wj = pin[j] ? 0 : W[j], ws = wi + wj; if (!ws) continue;
      const k = soft && i === HEAD ? 0.5 : cn[3];
      const f = (d - cn[2]) / d * k / ws;
      x[i] += dx * f * wi; y[i] += dy * f * wi; z[i] += dz * f * wi; x[j] -= dx * f * wj; y[j] -= dy * f * wj; z[j] -= dz * f * wj;
    }
  }

  solveGrabs(b) {
    for (let s = 0; s < 2; s++) {
      const g = b.arm[s].grab; if (!g) continue;
      const h = HA[s];
      if (g.k === 0) {                                    // hand stuck to the world
        let ax = g.x, ay = g.y, az = g.z;
        if (g.mv >= 0) { const m = this.mboxes[g.mv]; ax = m.cx + g.x; ay = m.cy + g.y; az = m.cz + g.z; }
        b.x[h] = b.ox[h] = ax; b.y[h] = b.oy[h] = ay; b.z[h] = b.oz[h] = az;
      } else {                                            // hand holding a point on another beast's limb
        const v = g.b, A = g.a, B = g.c, t = g.t, u = 1 - t;
        const qx = v.x[A] * u + v.x[B] * t, qy = v.y[A] * u + v.y[B] * t, qz = v.z[A] * u + v.z[B] * t;
        const dx = b.x[h] - qx, dy = b.y[h] - qy, dz = b.z[h] - qz, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d <= 0.04) continue;
        const wv = v.puppet ? 0 : 1, wh = 0.25, wa = W[A] * u * u * wv, wb = A === B ? 0 : W[B] * t * t * wv, lam = (d - 0.04) / d / (wh + wa + wb);
        b.x[h] -= dx * lam * wh; b.y[h] -= dy * lam * wh; b.z[h] -= dz * lam * wh;
        if (!wv) continue;
        v.x[A] += dx * lam * W[A] * u; v.y[A] += dy * lam * W[A] * u; v.z[A] += dz * lam * W[A] * u;
        if (A !== B) { v.x[B] += dx * lam * W[B] * t; v.y[B] += dy * lam * W[B] * t; v.z[B] += dz * lam * W[B] * t; }
      }
    }
  }

  collideBeasts(live) {
    for (let a = 0; a < live.length; a++) for (let c = a + 1; c < live.length; c++) {
      const A = live[a], B = live[c];
      const ddx = A.x[CHEST] - B.x[CHEST], ddy = A.y[CHEST] - B.y[CHEST], ddz = A.z[CHEST] - B.z[CHEST];
      if (ddx * ddx + ddy * ddy + ddz * ddz > 6.3) continue;
      if ((A.liftedBy === B && this.tick - A.lifted < 14) || (B.liftedBy === A && this.tick - B.lifted < 14)) continue;
      const pa = A.puppet === true, pb = B.puppet === true, pk = pa || pb ? this.pk : 1;
      if ((pa && pb) || pk <= 0) continue;
      for (const i of BODY) {
        const px = A.x[i], py = A.y[i], pz = A.z[i], ri = RADIUS[i];
        for (const j of BODY) {
          const r = ri + RADIUS[j], dx = B.x[j] - px, dy = B.y[j] - py, dz = B.z[j] - pz;
          if (dx > r || dx < -r || dy > r || dy < -r || dz > r || dz < -r) continue;
          const d2 = dx * dx + dy * dy + dz * dz; if (d2 >= r * r || d2 < 1e-9) continue;
          const d = Math.sqrt(d2), wi = pa ? 0 : W[i], wj = pb ? 0 : W[j], f = (r - d) / d / (wi + wj) * pk;
          A.x[i] -= dx * f * wi; A.y[i] -= dy * f * wi; A.z[i] -= dz * f * wi; B.x[j] += dx * f * wj; B.y[j] += dy * f * wj; B.z[j] += dz * f * wj;
          const ny = dy / d;                              // standing on somebody counts as ground
          if (ny > 0.7 && (j === FTL || j === FTR)) this.ground(B, j === FTL ? 0 : 1, B.y[j], (A.x[i] - A.ox[i]) / DT, 0, (A.z[i] - A.oz[i]) / DT, 0.15);
          else if (ny < -0.7 && (i === FTL || i === FTR)) this.ground(A, i === FTL ? 0 : 1, A.y[i], (B.x[j] - B.ox[j]) / DT, 0, (B.z[j] - B.oz[j]) / DT, 0.15);
        }
      }
    }
  }

  ground(b, s, y, vx, vy, vz, trac) {
    b.gT[s] = this.tick; b.gY[s] = y; b.gVx = vx; b.gVy = vy; b.gVz = vz; b.gTrac = trac;
  }

  // ================================================================================================ world
  collideWorld(b) {
    if (b.mantle) return;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (let i = 0; i < NP; i++) { const x = b.x[i], y = b.y[i], z = b.z[i]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z; }
    x0 -= 0.3; x1 += 0.3; y0 -= 0.3; y1 += 0.3; z0 -= 0.3; z1 += 0.3;
    const lists = [this.boxes, this.breaks, this.mboxes];
    for (let L = 0; L < 3; L++) {
      const list = lists[L];
      for (let n = 0; n < list.length; n++) {
        const c = list[n];
        if (L === 1 && !c.alive) continue;
        if (L === 2 && (c.kill || c.knock)) continue;
        if (c.x0 > x1 || c.x1 < x0 || c.y0 > y1 || c.y1 < y0 || c.z0 > z1 || c.z1 < z0) continue;
        for (let i = 0; i < NP; i++) if (!b.pin[i]) this.boxHit(b, i, c, L === 1);
      }
    }
    for (const e of this.ells) for (let i = 0; i < NP; i++) if (!b.pin[i]) this.ellHit(b, i, e);
    const bs = this.stage.bumpers || [];
    for (let n = 0; n < bs.length; n++) for (let i = 0; i < NP; i++) if (!b.pin[i]) this.bumperHit(b, i, bs[n], this.dyn.bumpers[n]);
  }

  boxHit(b, i, c, brk) {
    const r = RADIUS[i], px = b.x[i], py = b.y[i], pz = b.z[i];
    const cx = clamp(px, c.x0, c.x1), cy = clamp(py, c.y0, c.y1), cz = clamp(pz, c.z0, c.z1);
    const dx = px - cx, dy = py - cy, dz = pz - cz, d2 = dx * dx + dy * dy + dz * dz;
    if (d2 >= r * r) return;
    let nx, ny, nz, pen;
    if (d2 > 1e-10) { const d = Math.sqrt(d2); nx = dx / d; ny = dy / d; nz = dz / d; pen = r - d; }
    else {                                                // centre is inside the box: leave through the nearest face
      const e = [px - c.x0, c.x1 - px, py - c.y0, c.y1 - py, pz - c.z0, c.z1 - pz]; let m = 3;
      for (let k = 0; k < 6; k++) if (e[k] < e[m]) m = k;
      nx = m === 0 ? -1 : m === 1 ? 1 : 0; ny = m === 2 ? -1 : m === 3 ? 1 : 0; nz = m === 4 ? -1 : m === 5 ? 1 : 0; pen = e[m] + r;
    }
    let svx = c.vx, svz = c.vz;
    if (ny > 0.5 && (c.cvx || c.cvz)) { svx += c.cvx * this.dyn.conv * DT; svz += c.cvz * this.dyn.conv * DT; }
    const vn = this.contact(b, i, nx, ny, nz, pen, c.fric, c.bounce, c.trac, svx, c.vy, svz);
    if (brk && ny > 0.5) { c.load += 1; if (vn < -0.085) c.hp -= (-vn - 0.085) * 9; }
  }

  ellHit(b, i, e) {
    const r = RADIUS[i], qx = (b.x[i] - e.x) / e.rx, qy = (b.y[i] - e.y) / e.ry, qz = (b.z[i] - e.z) / e.rz, len = Math.sqrt(qx * qx + qy * qy + qz * qz);
    if (len > 1.25 || len < 1e-6) return;
    let gx = qx / (len * e.rx), gy = qy / (len * e.ry), gz = qz / (len * e.rz); const gl = Math.sqrt(gx * gx + gy * gy + gz * gz);
    const d = (len - 1) / gl; if (d >= r) return;
    gx /= gl; gy /= gl; gz /= gl;
    this.contact(b, i, gx, gy, gz, r - d, 0.3, 0, 0.22, 0, 0, 0);
  }

  bumperHit(b, i, def, s) {
    let cx = s.x, cy = s.y, cz = s.z;
    if (def.shape === 'capsule') { if (def.axis === 'x') cz = clamp(b.z[i], s.z - def.half, s.z + def.half); else cx = clamp(b.x[i], s.x - def.half, s.x + def.half); }
    const dx = b.x[i] - cx, dy = b.y[i] - cy, dz = b.z[i] - cz, R = RADIUS[i] + def.r, d2 = dx * dx + dy * dy + dz * dz;
    if (d2 >= R * R) return;
    const d = Math.sqrt(d2) || 0.001, nx = dx / d, ny = dy / d, nz = dz / d;
    b.x[i] += nx * (R - d); b.y[i] += ny * (R - d); b.z[i] += nz * (R - d);
    b.ox[i] = b.x[i] - (s.vx * 1.1 + nx * 1.5) * DT; b.oy[i] = b.y[i] - (s.vy * 1.1 + ny * 1.5 + 1) * DT; b.oz[i] = b.z[i] - (s.vz * 1.1 + nz * 1.5) * DT;
    const sp = Math.hypot(s.vx, s.vy, s.vz);
    if (b.knockCd <= 0 && sp > 2.5) {
      b.knockCd = 0.8; b.setVelAll(s.vx * 0.9, s.vy * 0.9 + 3, s.vz * 0.9);
      this.hurt(b, 18 + sp * 3, 0.1); this.release(b, 0, false); this.release(b, 1, false);
      this.push({ e: 'hit', x: b.x[i], y: b.y[i], z: b.z[i], p: 3 });
    }
  }

  // push particle i out along (nx,ny,nz) by pen and sort out its velocity. Returns the incoming normal speed (per tick).
  contact(b, i, nx, ny, nz, pen, fric, bounce, trac, svx, svy, svz) {
    const vx = b.x[i] - b.ox[i] - svx, vy = b.y[i] - b.oy[i] - svy, vz = b.z[i] - b.oz[i] - svz;
    b.x[i] += nx * pen; b.y[i] += ny * pen; b.z[i] += nz * pen;
    let vn = vx * nx + vy * ny + vz * nz, tx = vx - vn * nx, ty = vy - vn * ny, tz = vz - vn * nz;
    const inV = vn, foot = i === FTL || i === FTR;
    if (!b.fr[i]) {                                       // friction is applied once per tick per particle
      b.fr[i] = 1;
      let f = fric; if (b.ko <= 0 && (foot || i === KNL || i === KNR)) f *= b.mv > 0 ? 0.1 : 1.6;
      const k = 1 - Math.min(0.9, f); tx *= k; ty *= k; tz *= k;
    }
    vn = vn < 0 ? (bounce && vn < -0.03 ? -vn * bounce : 0) : vn;
    b.ox[i] = b.x[i] - (svx + tx + vn * nx); b.oy[i] = b.y[i] - (svy + ty + vn * ny); b.oz[i] = b.z[i] - (svz + tz + vn * nz);
    if (ny > 0.72) {
      if (foot) {
        const s = i === FTL ? 0 : 1;
        if (inV < -0.09 && b.landCd <= 0 && this.tick - b.gT[s] > 8) { b.landCd = 0.3; this.push({ e: 'land', i: b.id, x: b.x[i], y: b.y[i] - 0.1, z: b.z[i], p: -inV / DT }); }
        this.ground(b, s, b.y[i], svx / DT, svy / DT, svz / DT, trac);
      }
    }
    if (i === HEAD && inV < -0.16 && b.knockCd <= 0) {      // landing on your head hurts
      b.knockCd = 0.4; this.hurt(b, (-inV / DT - 9.5) * 7, 0.4); this.push({ e: 'bonk', x: b.x[i], y: b.y[i], z: b.z[i] });
    }
    return inV;
  }

  hurt(b, amount, bal) {
    if (amount <= 0 || b.ko > 0) return;
    b.stun += amount; b.stunCd = 1.3; b.bal = Math.min(b.bal, bal);
    if (b.stun >= 100) this.knockOut(b);
  }

  // a strike from attacker a landing on particle j of victim v
  strike(a, v, j, kind) {
    const head = j === HEAD, tm = a.team === v.team ? 0.4 : 1;
    const T = { punch: [15, 5, 1.2, 0.4], butt: [36, 14, 1.9, 0.6], kick: [12, 9, 4.6, 1.6], drop: [34, 25, 7.6, 2.5] }[kind];
    let dx = v.x[CHEST] - a.x[CHEST], dz = v.z[CHEST] - a.z[CHEST]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const push = T[2] * tm;
    v.addVelAll(dx * push * 0.6, T[3] * tm, dz * push * 0.6); v.addVel(j, dx * push * 0.8, 0, dz * push * 0.8);
    a.addVelAll(-dx * 0.6, 0, -dz * 0.6);
    const dmg = (head ? T[0] : T[1]) * tm;
    v.lastHitBy = a.id;
    if (dmg >= 12) { this.release(v, 0, false); this.release(v, 1, false); }
    this.push({ e: 'hit', x: v.x[j], y: v.y[j], z: v.z[j], p: kind === 'punch' ? (head ? 2 : 1) : 3, k: kind });
    this.hurt(v, dmg, kind === 'punch' ? (head ? 0.6 : 0.85) : kind === 'kick' ? 0.35 : kind === 'butt' ? 0.3 : 0.18);
    if (kind === 'drop') a.bal = Math.min(a.bal, 0.25);
    if (kind === 'butt') a.stun += 4;
  }

  hitScan(a, pi, extra, set) {       // nearest strikable particle of another beast touching a's particle pi
    let best = null, bj = -1, bd = 1e9;
    const px = a.x[pi], py = a.y[pi], pz = a.z[pi];
    for (const v of this.beasts) {
      if (v === a || !v.alive) continue;
      for (const j of set) {
        const d = Math.hypot(v.x[j] - px, v.y[j] - py, v.z[j] - pz) - RADIUS[pi] - RADIUS[j] - extra;
        if (d < 0 && d < bd) { bd = d; best = v; bj = j; }
      }
    }
    return best ? [best, bj] : null;
  }

  // ================================================================================================ after the solve
  post(b) {
    const st = this.stage, x = b.x[PELVIS], y = b.y[PELVIS], z = b.z[PELVIS];
    if (!Number.isFinite(x + y + z)) return this.die(b, 'fall');
    if (y < st.killY || Math.abs(x) > 60 || Math.abs(z) > 60 || y > 60) return this.die(b, 'fall');
    for (const k of this.kills) for (const i of [PELVIS, CHEST, HEAD]) {
      if (b.x[i] > k.x0 && b.x[i] < k.x1 && b.y[i] > k.y0 && b.y[i] < k.y1 && b.z[i] > k.z0 && b.z[i] < k.z1) return this.die(b, k.c);
    }
    for (const m of this.mboxes) {
      if (!m.kill && !m.knock) continue;
      for (const i of [HEAD, CHEST, PELVIS, KNL, KNR]) {
        if (b.x[i] > m.x0 - 0.15 && b.x[i] < m.x1 + 0.15 && b.y[i] > m.y0 - 0.1 && b.y[i] < m.y1 + 0.1 && b.z[i] > m.z0 - 0.15 && b.z[i] < m.z1 + 0.15) {
          if (m.kill) return this.die(b, m.kill);
          if (b.knockCd <= 0) {
            b.knockCd = 1; b.setVelAll(m.vx / DT * 0.42, 3.5, m.vz / DT * 0.42 + (b.z[i] > (m.z0 + m.z1) / 2 ? 1.5 : -1.5));
            this.release(b, 0, false); this.release(b, 1, false);
            this.push({ e: 'hit', x: b.x[i], y: b.y[i], z: b.z[i], p: 3 }); this.hurt(b, m.knock, 0.1);
          }
          break;
        }
      }
    }
    if (b.ko > 0) return;

    // ---- strikes
    for (let s = 0; s < 2; s++) {
      const a = b.arm[s];
      if (a.mode === 1 && !a.hit && a.t > 0.03 && a.t < 0.16) { const h = this.hitScan(b, HA[s], 0.06, HITSET); if (h) { a.hit = true; this.strike(b, h[0], h[1], 'punch'); } }
    }
    if (b.butt > 0 && !b.buttHit) { const age = BUTT_DUR - b.butt; if (age > 0.05 && age < 0.22) { const h = this.hitScan(b, HEAD, 0.07, HITSET); if (h) { b.buttHit = true; this.strike(b, h[0], h[1], 'butt'); } } }
    if (b.kick > 0 && !b.kickHit) {
      const age = (KICK_DUR + (b.kickAir ? 0.18 : 0)) - b.kick;
      if (age > 0.04 && age < (b.kickAir ? 0.46 : 0.22)) for (let s = 0; s < 2 && !b.kickHit; s++) {
        if (!b.kickAir && s !== b.kickLeg) continue;
        const h = this.hitScan(b, FT[s], 0.1, BODY); if (h) { b.kickHit = true; this.strike(b, h[0], h[1], b.kickAir ? 'drop' : 'kick'); }
      }
    }

    // ---- hands: grab what they touch, lose grip when overstretched or tired
    for (let s = 0; s < 2; s++) {
      const a = b.arm[s], h = HA[s], held = (b.inp.b & (s ? BTN.HR : BTN.HL)) !== 0;
      if (a.grab) {
        const g = a.grab;
        if (g.k === 1) {
          const v = g.b, u = 1 - g.t;
          const d = Math.hypot(b.x[h] - (v.x[g.a] * u + v.x[g.c] * g.t), b.y[h] - (v.y[g.a] * u + v.y[g.c] * g.t), b.z[h] - (v.z[g.a] * u + v.z[g.c] * g.t));
          if (v.ko > 0) g.h = 0; else g.h = (g.h || 0) + DT * (1 + v.mv + (v.edge ? 4 : 0));
          if (!v.alive || d > 0.5 || g.h > 1.6) { this.release(b, s, false); a.cd = g.h > 1.6 ? 0.7 : 0.3; a.mode = 0; }
        } else {
          if (!b.onG) { a.grip += DT; if (a.grip > 5.5) { this.release(b, s, false); a.mode = 0; a.cd = 1.0; this.push({ e: 'slip', i: b.id }); } } else a.grip = Math.max(0, a.grip - DT * 2);
          if (g.brk && !g.brk.alive) this.release(b, s, false);
        }
      } else if (held && b.noGrab <= 0 && (a.mode === 2 || (a.mode === 1 && a.t > 0.1))) this.tryGrab(b, s);
    }
  }

  tryGrab(b, s) {
    const h = HA[s], hx = b.x[h], hy = b.y[h], hz = b.z[h], hr = RADIUS[h], a = b.arm[s];
    // 1. another beast: closest point on any of its limbs
    let best = null, bd = 0.09;
    for (const v of this.beasts) {
      if (v === b || !v.alive) continue;
      if (Math.abs(v.x[CHEST] - hx) > 1.6 || Math.abs(v.z[CHEST] - hz) > 1.6 || Math.abs(v.y[CHEST] - hy) > 1.8) continue;
      for (const sg of GRABSEG) {
        const A = sg[0], B = sg[1];
        const ex = v.x[B] - v.x[A], ey = v.y[B] - v.y[A], ez = v.z[B] - v.z[A], l2 = ex * ex + ey * ey + ez * ez;
        const t = l2 > 1e-9 ? clamp(((hx - v.x[A]) * ex + (hy - v.y[A]) * ey + (hz - v.z[A]) * ez) / l2, 0, 1) : 0;
        const d = Math.hypot(hx - v.x[A] - ex * t, hy - v.y[A] - ey * t, hz - v.z[A] - ez * t) - hr - (RADIUS[A] * (1 - t) + RADIUS[B] * t) * 0.8;
        if (d < bd) { bd = d; best = { k: 1, b: v, a: A, c: B, t }; }
      }
    }
    if (best) { a.grab = best; a.mode = 2; this.push({ e: 'grab', x: hx, y: hy, z: hz }); return; }
    // 2. the world
    const lists = [this.boxes, this.breaks, this.mboxes];
    for (let L = 0; L < 3; L++) for (const c of lists[L]) {
      if (c.nograb || (L === 1 && !c.alive) || (L === 2 && (c.kill || c.knock))) continue;
      const cx = clamp(hx, c.x0, c.x1), cy = clamp(hy, c.y0, c.y1), cz = clamp(hz, c.z0, c.z1);
      if (Math.hypot(hx - cx, hy - cy, hz - cz) > hr + 0.07) continue;
      a.grab = L === 2 ? { k: 0, x: cx - c.cx, y: cy - c.cy, z: cz - c.cz, mv: c.mv, c } : { k: 0, x: cx, y: cy, z: cz, mv: -1, brk: L === 1 ? c : null, c };
      b.pin[h] = 1; a.mode = 2; a.grip = 0; this.push({ e: 'grab', x: hx, y: hy, z: hz }); return;
    }
    for (const e of this.ells) {
      const qx = (hx - e.x) / e.rx, qy = (hy - e.y) / e.ry, qz = (hz - e.z) / e.rz, len = Math.sqrt(qx * qx + qy * qy + qz * qz);
      if (len < 1 + (hr + 0.07) / Math.min(e.rx, e.ry, e.rz)) { a.grab = { k: 0, x: hx, y: hy, z: hz, mv: -1 }; b.pin[h] = 1; a.mode = 2; a.grip = 0; this.push({ e: 'grab', x: hx, y: hy, z: hz }); return; }
    }
  }

  updateBreakables() {
    for (let n = 0; n < this.breaks.length; n++) {
      const c = this.breaks[n]; if (!c.alive) continue;
      if (c.load > 0) c.hp -= DT * Math.min(3, c.load / ITER) * 0.5;
      c.load = 0;
      if (c.hp <= 0) { c.alive = false; this.push({ e: 'break', n, x: (c.x0 + c.x1) / 2, y: c.y1, z: (c.z0 + c.z1) / 2 }); }
    }
  }

  die(b, cause) {
    b.alive = false; this.release(b, 0, false); this.release(b, 1, false);
    for (const o of this.beasts) for (let s = 0; s < 2; s++) { const g = o.arm[s].grab; if (g && g.k === 1 && g.b === b) this.release(o, s, false); }
    this.push({ e: 'die', i: b.id, c: cause, x: b.x[PELVIS], y: Math.max(b.y[PELVIS], this.stage.killY), z: b.z[PELVIS], by: b.lastHitBy });
  }

  // ================================================================================================ network
  // binary snapshot: header, then per beast: id(u16) flags(u8) stun(u8) [14 × int16 xyz in cm]
  // flags: 1 alive, 2 knocked out, 4/8 left/right hand holding, 16 lifting, 32 dizzy, 64 holding or held by another beast
  snapshot(rid, phase, cd, ts) {
    const n = this.beasts.length; let size = 16;
    for (const b of this.beasts) size += 4 + (b.alive ? NP * 6 : 0);
    const buf = new ArrayBuffer(size), dv = new DataView(buf);
    dv.setUint8(0, 1); dv.setUint8(1, phase); dv.setUint16(2, rid, true); dv.setUint32(4, ts >>> 0, true); dv.setFloat32(8, this.time, true);
    dv.setUint8(12, cd); dv.setUint8(13, n);
    let brk = 0; for (let i = 0; i < this.breaks.length && i < 16; i++) if (!this.breaks[i].alive) brk |= 1 << i;
    dv.setUint16(14, brk, true);
    const tangled = new Set();
    for (const b of this.beasts) for (let s = 0; s < 2; s++) { const g = b.arm[s].grab; if (g && g.k === 1) { tangled.add(b); tangled.add(g.b); } }
    let o = 16;
    for (const b of this.beasts) {
      const f = (b.alive ? 1 : 0) | (b.ko > 0 ? 2 : 0) | (b.arm[0].grab ? 4 : 0) | (b.arm[1].grab ? 8 : 0) | (b.lift ? 16 : 0) | (b.stun > 60 ? 32 : 0) | (tangled.has(b) ? 64 : 0);
      dv.setUint16(o, b.id, true); dv.setUint8(o + 2, f); dv.setUint8(o + 3, Math.min(255, Math.round(b.stun))); o += 4;
      if (!b.alive) continue;
      for (let i = 0; i < NP; i++) {
        dv.setInt16(o, clamp(Math.round(b.x[i] * 100), -32000, 32000), true); dv.setInt16(o + 2, clamp(Math.round(b.y[i] * 100), -32000, 32000), true); dv.setInt16(o + 4, clamp(Math.round(b.z[i] * 100), -32000, 32000), true); o += 6;
      }
    }
    return buf;
  }
  takeEvents() { const e = this.ev; this.ev = []; return e; }
}
