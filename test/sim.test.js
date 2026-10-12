// Headless checks of the physics: node test/sim.test.js
import { Game, DT, BTN } from '../src/sim.js';
import { STAGES } from '../public/shared/stages.js';
import { P } from '../public/shared/skeleton.js';
import { botThink } from '../src/bots.js';

let fail = 0;
const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fail++; };
const mem = (id, bot) => ({ id, name: 'P' + id, team: id, bot: !!bot });
const B = (x, z, y, w, d, h, o) => Object.assign({ x, z, y, w, d, h }, o || {});
STAGES.push({ id: '_flat', name: {}, sky: [], fog: [], killY: -10, solids: [B(0, 0, 0, 60, 60, 2), B(6, 0, 2.0, 2, 6, 2.0), B(-10, 0, 3.0, 4, 6, 0.5)], spawns: [[0, 0], [0, 0]] });

function place(b, x, z, yaw) {
  const dx = x - b.x[P.PELVIS], dz = z - b.z[P.PELVIS];
  for (let i = 0; i < 14; i++) { b.x[i] += dx; b.z[i] += dz; b.ox[i] += dx; b.oz[i] += dz; }
  if (yaw !== undefined) {
    const c = Math.cos(yaw - b.yaw), s = Math.sin(yaw - b.yaw), px = b.x[P.PELVIS], pz = b.z[P.PELVIS];
    for (let i = 0; i < 14; i++) { const rx = b.x[i] - px, rz = b.z[i] - pz; b.x[i] = b.ox[i] = px + rx * c + rz * s; b.z[i] = b.oz[i] = pz - rx * s + rz * c; }
    b.yaw = yaw;
  }
}
const run = (g, n, f) => { for (let i = 0; i < n; i++) { if (f) f(i); g.step(); } };
const yawOf = b => Math.atan2(b.Z[0], b.Z[2]);
const finite = g => g.beasts.every(b => !b.alive || [...b.x, ...b.y, ...b.z].every(Number.isFinite));

console.log('standing / walking / jumping');
{
  const g = new Game('_flat', [mem(1)]); g.frozen = false; const b = g.beasts[0];
  place(b, 0, 0, 0); run(g, 150);
  console.log('   pelvis', b.y[P.PELVIS].toFixed(3), 'head', b.y[P.HEAD].toFixed(3), 'hands', b.y[P.HAL].toFixed(2), b.y[P.HAR].toFixed(2), 'feet', b.y[P.FTL].toFixed(3));
  ok(Math.abs(b.y[P.PELVIS] - 0.60) < 0.05, 'stands at the right height');
  ok(b.y[P.HEAD] > 1.3, 'upright');
  const dr = Math.hypot(b.x[P.PELVIS], b.z[P.PELVIS]);
  ok(dr < 0.05, 'does not drift while idle (' + dr.toFixed(3) + ' m in 2.5 s)');
  g.setInput(1, 1, 0, 0); run(g, 90);
  console.log('   walked +x', b.x[P.PELVIS].toFixed(2), 'in 1.5 s, yaw', yawOf(b).toFixed(2));
  ok(b.x[P.PELVIS] > 3.3 && b.x[P.PELVIS] < 4.6, 'walks at walking speed');
  ok(Math.abs(yawOf(b) - Math.PI / 2) < 0.25, 'turned to face +x');
  ok(b.y[P.HEAD] > 1.25, 'still upright while walking');
  g.setInput(1, 0, -1, 0); run(g, 90);
  ok(Math.abs(Math.abs(yawOf(b)) - Math.PI) < 0.3, 'turned to face -z');
  g.setInput(1, 0, 0, 0); run(g, 60);
  const y0 = b.y[P.PELVIS]; let top = y0;
  g.setInput(1, 0, 0, BTN.JUMP); run(g, 2); g.setInput(1, 0, 0, 0); run(g, 60, () => { top = Math.max(top, b.y[P.PELVIS]); });
  console.log('   jump height', (top - y0).toFixed(2));
  ok(top - y0 > 0.75 && top - y0 < 1.5, 'jump height is sensible');
  ok(b.onG && b.y[P.HEAD] > 1.3, 'lands on its feet');
}

console.log('punch / headbutt / knock-out');
{
  const g = new Game('_flat', [mem(1), mem(2)]); g.frozen = false; const [a, v] = g.beasts;
  place(a, 0, 0, Math.PI / 2); place(v, 0.85, 0, -Math.PI / 2); run(g, 40);
  let hits = 0;
  for (let n = 0; n < 40 && v.ko <= 0; n++) {
    g.setInput(1, 0, 0, n % 2 ? BTN.HL : BTN.HR); run(g, 3); g.setInput(1, 0, 0, 0); run(g, 20);
    hits += g.ev.filter(e => e.e === 'hit').length; g.ev = [];
    if (Math.hypot(v.x[P.CHEST] - a.x[P.CHEST], v.z[P.CHEST] - a.z[P.CHEST]) > 1.0) place(v, a.x[P.PELVIS] + 0.85, a.z[P.PELVIS]);
  }
  console.log('   punches landed', hits, 'victim stun', v.stun.toFixed(0), 'ko', v.ko.toFixed(1));
  ok(hits >= 4, 'punches land');
  ok(v.ko > 0, 'enough punches knock the victim out (' + hits + ' hits)');
  v.ko = 2.5; run(g, 70);
  ok(v.y[P.HEAD] < 0.7, 'a knocked-out beast collapses (head at ' + v.y[P.HEAD].toFixed(2) + ')');
  run(g, 60 * 4);
  ok(v.ko <= 0 && v.y[P.HEAD] > 1.25, 'and gets back up after a while (head at ' + v.y[P.HEAD].toFixed(2) + ')');

  const g2 = new Game('_flat', [mem(1), mem(2)]); g2.frozen = false; const [a2, v2] = g2.beasts;
  place(a2, 0, 0, Math.PI / 2); place(v2, 0.72, 0, -Math.PI / 2); run(g2, 40);
  g2.setInput(1, 0, 0, BTN.BUTT); run(g2, 2); g2.setInput(1, 0, 0, 0); run(g2, 30);
  ok(g2.ev.some(e => e.e === 'hit' && e.k === 'butt'), 'headbutt lands (victim stun ' + v2.stun.toFixed(0) + ')');
  const g3 = new Game('_flat', [mem(1), mem(2)]); g3.frozen = false; const [a3, v3] = g3.beasts;
  place(a3, 0, 0, Math.PI / 2); place(v3, 0.95, 0, -Math.PI / 2); run(g3, 40);
  g3.setInput(1, 0, 0, BTN.KICK); run(g3, 2); g3.setInput(1, 0, 0, 0); run(g3, 30);
  ok(g3.ev.some(e => e.e === 'hit' && e.k === 'kick'), 'kick lands');
}

console.log('grab / lift / throw');
{
  const g = new Game('_flat', [mem(1), mem(2)]); g.frozen = false; const [a, v] = g.beasts;
  place(a, 0, 14, Math.PI / 2); place(v, 0.8, 14, -Math.PI / 2); run(g, 30);
  v.stun = 100; run(g, 2); v.ko = 60; run(g, 50);             // victim is out cold on the floor (and stays out for this test)
  place(a, v.x[P.CHEST] - 0.75, v.z[P.CHEST], Math.PI / 2);
  const hold = BTN.HL | BTN.HR;
  // walk into the body while reaching, like a player would
  run(g, 90, () => g.setInput(1, a.arm[0].grab && a.arm[1].grab ? 0 : 0.6, 0, hold));
  console.log('   grabs', !!a.arm[0].grab, !!a.arm[1].grab);
  ok(a.arm[0].grab || a.arm[1].grab, 'hands grab a body');
  g.setInput(1, 0, 0, hold | BTN.LIFT); run(g, 110);
  const vy = (v.y[P.CHEST] + v.y[P.PELVIS] + v.y[P.HEAD]) / 3;
  console.log('   victim height while lifted', vy.toFixed(2), 'lifter head', a.y[P.HEAD].toFixed(2), 'lifter pelvis', a.y[P.PELVIS].toFixed(2));
  ok(vy > 1.2, 'the victim is lifted off the ground');
  ok(a.y[P.PELVIS] > 0.45 && a.y[P.HEAD] > 1.1, 'the lifter stays on its feet');
  g.setInput(1, 1, 0, hold | BTN.LIFT); run(g, 40);
  const x0 = v.x[P.CHEST];
  g.setInput(1, 1, 0, BTN.LIFT); run(g, 2);
  ok(g.ev.some(e => e.e === 'throw'), 'letting go while lifting throws');
  g.setInput(1, 0, 0, 0); run(g, 70);
  console.log('   thrown distance', (v.x[P.CHEST] - x0).toFixed(2));
  ok(v.x[P.CHEST] - x0 > 2.5, 'the victim flies a few metres');
}

console.log('ledge: grab, hang, climb');
{
  const g = new Game('_flat', [mem(1)]); g.frozen = false; const b = g.beasts[0];
  place(b, 4.0, 0, Math.PI / 2); run(g, 30);                  // facing a 2 m high block at x = 5..7
  const hands = BTN.HL | BTN.HR; let grabbed = false, t = 0;
  // what a player does: hold forward, hold both hands, tap jump until on top
  for (; t < 60 * 6 && !(b.y[P.PELVIS] > 2.45 && b.onG); t++) {
    g.setInput(1, 1, 0, hands | (t % 40 < 3 ? BTN.JUMP : 0)); g.step();
    if (b.pin[P.HAL] || b.pin[P.HAR]) grabbed = true;
  }
  console.log('   grabbed', grabbed, 'time', (t / 60).toFixed(1) + ' s', 'x', b.x[P.PELVIS].toFixed(2), 'y', b.y[P.PELVIS].toFixed(2));
  ok(grabbed, 'hands stick to the wall');
  ok(b.y[P.PELVIS] > 2.45 && b.x[P.PELVIS] > 4.9, 'climbs on top of a 2 m block');
  // hanging from the edge of a floating platform (top at 3.0, edge at x = -8)
  const g2 = new Game('_flat', [mem(1)]); g2.frozen = false; const c = g2.beasts[0];
  place(c, -7.55, 0, -Math.PI / 2);
  for (let i = 0; i < 14; i++) { c.y[i] += 1.6; c.oy[i] += 1.6; }
  run(g2, 90, () => g2.setInput(1, -1, 0, hands));
  console.log('   hanging: pinned', c.pin[P.HAL], c.pin[P.HAR], 'pelvis', c.y[P.PELVIS].toFixed(2), 'feet', c.y[P.FTL].toFixed(2));
  ok((c.pin[P.HAL] || c.pin[P.HAR]) && c.y[P.FTL] > 0.8, 'hangs from a ledge by its hands');
  for (let i = 0; i < 60 * 5 && !(c.y[P.PELVIS] > 3.45 && c.onG); i++) { g2.setInput(1, -1, 0, hands | (i % 40 < 3 ? BTN.JUMP : 0)); g2.step(); }
  ok(c.y[P.PELVIS] > 3.45 && c.onG, 'and pulls itself up (pelvis ' + c.y[P.PELVIS].toFixed(2) + ')');
}

console.log('every stage with 8 bots for 45 simulated seconds');
for (const st of STAGES) {
  if (st.id[0] === '_') continue;
  const g = new Game(st.id, [1, 2, 3, 4, 5, 6, 7, 8].map(i => mem(i, true)), botThink); g.frozen = false;
  const t0 = performance.now(); let bad = false; const c = { hit: 0, ko: 0, die: 0, grab: 0, throw: 0 };
  for (let i = 0; i < 60 * 45 && !bad; i++) { g.step(); for (const e of g.ev) if (c[e.e] !== undefined) c[e.e]++; g.ev = []; if (i % 30 === 0 && !finite(g)) bad = true; }
  const ms = performance.now() - t0;
  console.log('   ' + st.id.padEnd(12), (ms | 0) + ' ms', JSON.stringify(c), 'alive', g.alive().length);
  ok(!bad, st.id + ' is numerically stable'); ok(ms < 4000, st.id + ' is fast enough');
}
console.log(fail ? '\n' + fail + ' FAILED' : '\nALL OK');
process.exit(fail ? 1 : 0);
