'use strict';
// Headless sanity test for the 3D physics: node test-sim.js
const { Game } = require('./sim.js');
const Maps = require('./public/maps.js');
let fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const mem = (id, bot) => ({ id, name: 'P' + id, look: { c: 0, h: 0, f: 0 }, team: id, bot });

let g = new Game('rooftop', [mem(1)]);
const pl = g.players[0]; g.frozen = false;
for (let i = 0; i < 180; i++) g.step();
const hip = pl.pts[2], head = pl.pts[0];
console.log('stand hip y', hip.y.toFixed(2), 'head y', head.y.toFixed(2), 'feet y', pl.pts[5].y.toFixed(2));
ok(pl.alive, 'alive');
ok(head.y > hip.y + 0.8, 'upright');
ok(pl.onG, 'on ground');
let x0 = hip.x, z0 = hip.z; const sx = hip.x > 0 ? -1 : 1, sz = hip.z > 0 ? -1 : 1; pl.in.mx = sx;
for (let i = 0; i < 60; i++) g.step();
console.log('walk +x per sec', (hip.x - x0).toFixed(2));
ok(Math.abs(hip.x - x0) > 2.5, 'walks in x');
pl.in.mx = 0; const sz2 = hip.z > 0 ? -1 : 1; pl.in.mz = sz2; z0 = hip.z;
for (let i = 0; i < 60; i++) g.step();
ok(Math.abs(hip.z - z0) > 2.5, 'walks in z');
pl.in.mz = 0; for (let i = 0; i < 40; i++) g.step();
const yb = hip.y; let maxY = yb;
g.setInput(1, { mx: 0, mz: 0, j: 1 });
for (let i = 0; i < 50; i++) { g.step(); maxY = Math.max(maxY, hip.y); if (i === 0) g.setInput(1, { j: 0 }); }
console.log('jump height', (maxY - yb).toFixed(2));
ok(maxY - yb > 1.5, 'jumps');

for (const m of Maps.list) {
  const G = new Game(m.id, [1, 2, 3, 4, 5, 6, 7, 8].map(i => mem(i, true)));
  G.frozen = false;
  const t0 = Date.now(); let bad = false, hits = 0, deaths = 0;
  for (let i = 0; i < 60 * 40; i++) {
    G.step();
    for (const e of G.ev) { if (e.e === 'hit') hits++; if (e.e === 'die') deaths++; }
    G.ev = [];
    for (const p of G.players) if (p.alive) for (const q of p.pts) if (!isFinite(q.x + q.y + q.z)) bad = true;
    if (bad) break;
  }
  const ms = Date.now() - t0;
  console.log(m.id.padEnd(11), 'ms', ms, 'hits', hits, 'deaths', deaths, 'alive', G.alive().length);
  ok(!bad, m.id + ' stable'); ok(ms < 3000, m.id + ' fast');
}
console.log(fail ? fail + ' FAILED' : 'ALL OK');
process.exit(fail ? 1 : 0);
