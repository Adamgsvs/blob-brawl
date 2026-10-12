// How do rounds actually play out with bots? node test/stats.mjs
import { Game } from '../src/sim.js';
import { STAGES } from '../public/shared/stages.js';
import { botThink } from '../src/bots.js';
const mem = (id) => ({ id, name: 'P' + id, team: id, bot: true, skill: 0.5 + Math.random() * 0.5 });
const N = +(process.argv[2] || 6), ids = Array.from({ length: N }, (_, i) => i + 1);
console.log(N + ' bots');
for (const st of STAGES) {
  let rounds = 0, len = 0, unfinished = 0, first = 0; const causes = {}, ev = { hit: 0, ko: 0, throw: 0, grab: 0 }; let self = 0, deaths = 0;
  for (let r = 0; r < 12; r++) {
    const g = new Game(st.id, ids.map(mem), botThink); g.frozen = false;
    let t = 0, firstT = -1; const lastHurt = new Map();
    for (; t < 60 * 180; t++) {
      g.step();
      for (const e of g.ev) {
        if (ev[e.e] !== undefined) ev[e.e]++;
        if (e.e === 'die') { causes[e.c] = (causes[e.c] || 0) + 1; deaths++; if (firstT < 0) firstT = t; const b = g.byId.get(e.i); if (b.lastHitBy == null) self++; }
      }
      g.ev = [];
      if (g.alive().length <= 1) break;
    }
    rounds++; len += t / 60; if (g.alive().length > 1) unfinished++; first += (firstT < 0 ? 180 : firstT / 60);
  }
  console.log(st.id.padEnd(12), 'avg round', (len / rounds).toFixed(0).padStart(3) + 's', 'first death', (first / rounds).toFixed(0).padStart(3) + 's', 'unfinished', unfinished, '| per round: hits', (ev.hit / rounds).toFixed(0), 'ko', (ev.ko / rounds).toFixed(1), 'throws', (ev.throw / rounds).toFixed(1), '| deaths', JSON.stringify(causes), 'never-hit', self + '/' + deaths);
}
