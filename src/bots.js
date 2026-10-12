// Bot brains. A bot only produces the same inputs a player would (stick + buttons).
import { DT, BTN } from './sim.js';
import { P } from '../public/shared/skeleton.js';

const { CHEST, PELVIS } = P;
const DIRS = []; for (let i = 0; i < 16; i++) DIRS.push([Math.sin(i * Math.PI / 8), Math.cos(i * Math.PI / 8)]);

// is there something safe to stand on below (x, z), for something whose feet are at height y?
export function hasGround(g, x, z, y) {
  for (const k of g.kills) if (x > k.x0 && x < k.x1 && z > k.z0 && z < k.z1 && k.y1 > y - 4) return false;
  for (const a of g.stage.avoid || []) if (x > a.x0 && x < a.x1 && z > a.z0 && z < a.z1) return false;
  const solids = g.stage.solids;
  for (let i = 0; i < solids.length; i++) {
    if (solids[i].wall || solids[i].invisible) continue;
    const c = g.boxes[i];
    if (x >= c.x0 - 0.02 && x <= c.x1 + 0.02 && z >= c.z0 - 0.02 && z <= c.z1 + 0.02 && c.y1 <= y + 0.5 && c.y1 >= y - 3.2) return true;
  }
  for (const c of g.mboxes) {
    if (c.kill || c.knock) continue;
    if (x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1 && c.y1 <= y + 0.6 && c.y1 >= y - 3.2) return true;
  }
  for (const e of g.ells) { const u = (x - e.x) / e.rx, v = (z - e.z) / e.rz; if (1 - u * u - v * v > 0.46) return true; }
  return false;
}

// height of the floor under (x,z), or null (static floors only)
function floorY(g, x, z, y) {
  let best = null; const solids = g.stage.solids;
  for (let i = 0; i < solids.length; i++) { if (solids[i].wall || solids[i].invisible) continue; const c = g.boxes[i]; if (x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1 && c.y1 <= y + 0.5 && (best === null || c.y1 > best)) best = c.y1; }
  return best;
}

// walk outward from (x,z) and return the direction of the closest drop
function nearestEdge(g, x, z, y) {
  let best = null, bd = 1e9;
  for (const [dx, dz] of DIRS) {
    for (let d = 0.5; d < 12; d += 0.5) {
      if (!hasGround(g, x + dx * d, z + dz * d, y)) { if (d < bd) { bd = d; best = [dx, dz, d]; } break; }
    }
  }
  return best;
}

export function botThink(g, b) {
  const br = b.brain;
  br.t -= DT; if (br.t > 0) return;
  const step = 0.08 + Math.random() * 0.08; br.t = step;
  let mx = 0, mz = 0, btn = 0;
  const px = b.x[PELVIS], pz = b.z[PELVIS], fy = b.y[PELVIS] - 0.6, sk = b.skill;
  const out = () => {
    if (b.onG && Math.hypot(b.gVx, b.gVz) > 1) {            // on a conveyor: walk against it, run if it is fast
      mx -= b.gVx / 2.9; mz -= b.gVz / 2.9;
      const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; if (l > 1.25) btn |= BTN.JUMP; }
    }
    b.edge |= btn & ~b.inp.b; b.inp.mx = mx; b.inp.mz = mz; b.inp.b = btn;
  };
  const safe = (ux, uz) => {
    if (!hasGround(g, px + ux * 0.45, pz + uz * 0.45, fy) || !hasGround(g, px + ux * 0.95, pz + uz * 0.95, fy)) return false;
    const f = floorY(g, px + ux * 0.95, pz + uz * 0.95, fy);                 // stepping down a level? make sure there is room to land
    return !(f !== null && f < fy - 1) || (hasGround(g, px + ux * 1.6, pz + uz * 1.6, fy) && hasGround(g, px + ux * 2.3, pz + uz * 2.3, fy));
  };
  // head for (x,z) but only along directions that have floor under them
  const go = (x, z, s) => {
    let dx = x - px, dz = z - pz; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d; s = s === undefined ? 1 : s;
    if (!b.onG || safe(dx, dz)) { mx = dx * s; mz = dz * s; return; }
    let best = -0.25, bx = 0, bz = 0;
    for (const [ux, uz] of DIRS) { const sc = ux * dx + uz * dz; if (sc > best && safe(ux, uz)) { best = sc; bx = ux; bz = uz; } }
    mx = bx * s; mz = bz * s;
  };

  if (b.ko > 0) { btn = Math.random() < 0.5 ? BTN.JUMP : 0; return out(); }

  // somewhere safe to head for when in trouble
  let hx = 0, hz = 0;
  if (!hasGround(g, 0, 0, fy + 1)) { let bd = 1e9; for (const s of g.stage.spawns) { const d = Math.hypot(s[0] - px, s[1] - pz); if (d < bd && hasGround(g, s[0], s[1], fy + 2)) { bd = d; hx = s[0]; hz = s[1]; } } }
  const home = (s) => { const dx = hx - px, dz = hz - pz, d = Math.hypot(dx, dz) || 1; mx = dx / d * s; mz = dz / d * s; };

  if (b.pin[P.HAL] || b.pin[P.HAR] || b.mantle) { home(1); btn = BTN.HL | BTN.HR | (Math.random() < 0.6 ? BTN.JUMP : 0); return out(); }
  if (!hasGround(g, px, pz, fy)) { home(1); btn = b.onG ? 0 : (BTN.HL | BTN.HR | BTN.LIFT); if (b.onG && Math.random() < 0.3) btn |= BTN.JUMP; return out(); }

  // committed to a dodge: keep going until we are across
  if (br.dodge) {
    br.dodge.t -= step; mz = br.dodge.dir; mx = 0;
    if (b.onG && !hasGround(g, px, pz + br.dodge.dir * 0.55, fy) && hasGround(g, px, pz + br.dodge.dir * 1.7, fy)) btn |= BTN.JUMP;
    if (br.dodge.t <= 0 || (b.onG && Math.abs(pz - br.dodge.z) < 0.5)) br.dodge = null;
    return out();
  }
  // a swinging hazard close by? step away from where it sweeps
  for (let n = 0; n < g.dyn.bumpers.length; n++) {
    const s = g.dyn.bumpers[n], d0 = g.stage.bumpers[n];
    if (Math.hypot(s.x - px, s.z - pz) < 3 && Math.abs(pz - d0.pivot[2]) < (d0.half || d0.r) + 0.9 && d0.axis === 'x') { go(px, pz + (pz < d0.pivot[2] ? -2 : 2), 1); return out(); }
    if (Math.hypot(s.x - px, s.z - pz) < 2.2 && d0.axis === 'z' && Math.abs(px - d0.pivot[0]) < d0.r + 0.7) { go(px + (px < d0.pivot[0] ? -2 : 2), pz, 1); return out(); }
  }
  // something big coming down my lane (road signs)? get out of the way
  for (const m of g.mboxes) {
    if (!m.knock || pz < m.z0 - 0.3 || pz > m.z1 + 0.3) continue;
    const vx = m.vx / DT; if (Math.abs(vx) < 1) continue;
    const eta = (vx > 0 ? px - m.x1 : m.x0 - px) / Math.abs(vx);
    if (eta < -0.15 || eta > 1.4) continue;
    const zc = (m.z0 + m.z1) / 2; let dir = pz > zc ? 1 : -1;
    const tz = dir > 0 ? m.z1 + 1.7 : m.z0 - 1.7;
    if (!hasGround(g, px, tz, fy)) dir = -dir;
    br.dodge = { dir, z: dir > 0 ? m.z1 + 1.6 : m.z0 - 1.6, t: 1.6 }; mz = dir; mx = 0;
    return out();
  }

  // carrying or holding somebody?
  const g0 = b.arm[0].grab, g1 = b.arm[1].grab, held = (g0 && g0.k === 1 && g0.b) || (g1 && g1.k === 1 && g1.b);
  if (held && held.ko <= 0) {                                 // got hold of somebody who is awake: nut them, then let go
    btn = BTN.HL | BTN.HR | (Math.random() < 0.4 ? BTN.BUTT : 0);
    br.hold = (br.hold || 0) + 1; if (br.hold > 8) { btn = 0; br.hold = 0; }
    return out();
  }
  br.hold = 0;
  if (held) {                                                  // an unconscious body: carry it to the nearest drop and throw it
    br.carry = (br.carry || 0) + 1;
    const e = nearestEdge(g, px, pz, fy);
    btn = BTN.HL | BTN.HR | BTN.LIFT;
    if (e && br.carry > 5) {
      if (e[2] > 1.4) go(px + e[0] * 3, pz + e[1] * 3, 1);
      else { mx = e[0] * 0.35; mz = e[1] * 0.35; if ((held.y[CHEST] > b.y[CHEST] + 0.3 && Math.abs(Math.atan2(e[0], e[1]) - b.yaw) < 0.5) || br.carry > 45) { btn = BTN.LIFT; br.carry = 0; } }
    } else if (br.carry > 40) { btn = BTN.LIFT; br.carry = 0; }
    return out();
  }
  br.carry = 0;

  // pick a target
  let tgt = null, bd = 1e9;
  for (const o of g.beasts) {
    if (o === b || !o.alive || o.team === b.team) continue;
    let d = Math.hypot(o.x[PELVIS] - px, o.z[PELVIS] - pz) + Math.abs(o.y[PELVIS] - b.y[PELVIS]) * 2;
    if (o.ko > 0.8) d *= 0.5;                                 // helpless bodies are tempting
    if (d < bd) { bd = d; tgt = o; }
  }
  if (!tgt) return out();
  const tx = tgt.x[CHEST], tz = tgt.z[CHEST], d = Math.hypot(tx - px, tz - pz), dy = tgt.y[PELVIS] - b.y[PELVIS];
  const down = tgt.ko > 0.6;

  // mood: scrap for a while, then back off and wander
  br.moodT = (br.moodT || 0) - step;
  if (br.moodT <= 0) {
    br.fight = !br.fight || Math.random() < 0.25;
    br.moodT = br.fight ? 2 + Math.random() * 3 * sk : 0.8 + Math.random() * 1.6 * (1.3 - sk);
    const s = g.stage.spawns[(Math.random() * g.stage.spawns.length) | 0]; br.rx = s[0] + Math.random() - 0.5; br.rz = s[1] + Math.random() - 0.5;
  }

  if (down && d < 6) {
    go(tx, tz, d < 0.5 ? 0.3 : 1);
    if (d < 1.3) btn |= BTN.HL | BTN.HR;
  } else if (d < 1.15 && Math.abs(dy) < 1.0 && (br.fight || Math.random() < 0.3)) {
    go(tx, tz, d < 0.7 ? 0.15 : 0.6);
    const r = Math.random();
    if (r < 0.15 * sk) btn |= br.alt ? BTN.HL : BTN.HR, br.alt = !br.alt;
    else if (r < 0.19 * sk && d < 0.85) btn |= BTN.BUTT;
    else if (r < 0.22 * sk) btn |= BTN.KICK;
    else if (r < 0.24 * sk) btn |= BTN.HL | BTN.HR;
  } else if (br.fight) {
    go(tx, tz, 1);
    if (dy > 0.9 && d < 2.5) { btn |= BTN.HL | BTN.HR | BTN.LIFT; if (Math.random() < 0.4) btn |= BTN.JUMP; }
    else if (d > 2 && d < 3.2 && Math.random() < 0.04 * sk) { btn |= BTN.JUMP; br.drop = 3; }
    if (br.drop > 0 && --br.drop === 0 && !b.onG) btn |= BTN.KICK;        // running drop-kick
  } else go(br.rx, br.rz, 0.7);

  if (Math.random() < 0.003) g.emote(b.id, (Math.random() * 8) | 0);
  out();
}
