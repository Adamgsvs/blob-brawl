// node test/predict.test.mjs [upMs] [downMs] [bots] [stage]
// Runs a real server-side Game and the client's Timeline + Predictor against it through a simulated laggy link,
// and reports how quickly and how truthfully the local player's own beast is shown.
import { Game, DT, BTN } from '../src/sim.js';
import { botThink } from '../src/bots.js';
import { parseSnap, Timeline } from '../public/js/netstate.js';
import { Predictor } from '../public/js/predict.js';
import { P } from '../public/shared/skeleton.js';

export function run(dU, dD, bots, stage, quiet, seconds = 30, predict = true, pace = 1) {
  const TICK = 1000 * DT, CLOCK = 123456, JIT = 12;
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const members = [{ id: 1, team: 0, name: 'me' }];
  for (let i = 0; i < bots; i++) members.push({ id: 2 + i, team: 1 + i, name: 'bot', bot: true, skill: 0.7 });
  const g = new Game(stage, members, botThink), me = g.byId.get(1);
  const tl = new Timeline(), pr = predict ? new Predictor(stage, 1, members) : null;
  const toServer = [], toClient = [];                 // { at, ... } queues
  const truth = [];                                   // server-side centre of our beast, by virtual time
  const shownLog = [];                                // what the client displayed for us: { t, x, y, z }
  const centre = (x, y, z) => [(x[P.CHEST] + x[P.PELVIS]) / 2, (y[P.CHEST] + y[P.PELVIS]) / 2, (z[P.CHEST] + z[P.PELVIS]) / 2];
  // scripted input: [seconds, x, z, buttons]
  const script = [[1.2, 0, 0, 0], [1.0, 1, 0, 0], [0.6, 0, 0, 0], [1.0, 0, 1, 0], [0.5, 0, 0, 0], [0.9, -1, 0, BTN.JUMP], [0.4, 0, 0, 0], [0.1, 0, 0, BTN.JUMP], [0.9, 0, 0, 0],
    [0.08, 0, 0, BTN.HL], [0.5, 0, 0, 0], [0.08, 0, 0, BTN.HR], [0.5, 0, 0, 0], [0.8, 0.7, -0.7, 0], [0.1, 0.7, -0.7, BTN.KICK], [0.7, 0, -1, 0], [0.5, 0, 0, 0], [0.1, 0, 0, BTN.BUTT], [0.6, 0, 0, 0], [1.0, -1, 0.3, 0], [0.5, 0, 0, 0]];
  for (const s of script) if (s[1] || s[2]) s[0] *= pace;                    // shorter walks on narrow stages
  let total = 0; for (const s of script) total += s[0];
  const inputAt = t => { let u = (t / 1000) % total; for (const s of script) { if (u < s[0]) return { x: s[1], z: s[2], b: s[3] }; u -= s[0]; } return { x: 0, z: 0, b: 0 }; };

  const resp = { pred: [], n: 0 };
  let deadAt = -1e9; const deaths = [];
  let lastKey = '', watch = null, frames = 0, active = 0, koT = 0, nextTick = 0, nextFrame = 5, lastFrame = 0;
  g.frozen = true;
  const END = seconds * 1000;
  for (let t = 0; t < END; t += 1) {
    // ---- server
    while (toServer.length && toServer[0].at <= t) { const m = toServer.shift(); g.setInput(1, m.x, m.z, m.b); }
    if (t >= nextTick) {
      nextTick += TICK;
      if (t > 700) g.frozen = false;
      if (!me.alive) { deadAt = t; for (let i = 0; i < 14; i++) { me.x[i] = me.ox[i] = 0 + (i % 3) * 0.05; me.y[i] = me.oy[i] = g.surfaceAt(0, 0) + 0.4 + i * 0.05; me.z[i] = me.oz[i] = 0; } me.alive = true; me.ko = 0; me.stun = 0; deaths.push(t); }   // keep the test subject in play
      g.step(); g.takeEvents();
      const c = me.alive ? centre(me.x, me.y, me.z) : null;
      truth.push({ t, c, ko: me.ko > 0 || !me.alive });
      const buf = g.snapshot(1, g.frozen ? 0 : 1, 0, Math.round(t + CLOCK));
      toClient.push({ at: t + dD + rnd() * JIT, buf });
      toClient.sort((a, b) => a.at - b.at);
    }
    // ---- client
    while (toClient.length && toClient[0].at <= t) { const s = parseSnap(toClient.shift().buf); tl.add(s, t); if (pr) pr.onSnap(s, t, tl.offset, dU + dD); }
    if (t >= nextFrame) {
      nextFrame += TICK * (rnd() < 0.1 ? 2 : 1);                                  // the odd dropped frame
      const dt = Math.min(0.05, (t - lastFrame) / 1000) || DT; lastFrame = t;
      const inp = inputAt(t), key = inp.x + ',' + inp.z + ',' + inp.b;
      if (key !== lastKey) { toServer.push({ at: t + dU + rnd() * 4, ...inp }); if ((inp.x || inp.z) && !lastKey.match(/[1-9]\b.*,.*,|^-?[01]\.?\d*,-?[1-9]/) && lastKey.startsWith('0,0,')) watch = { t, c: null }; lastKey = key; }
      const fr = tl.sample(tl.time(t, dt)); if (!fr) continue;
      const before = tl.pose.get(1), raw = before && before.alive ? centre2(before.P) : null;
      if (pr) pr.frame(t, dt, inp, tl.pose, tl.offset, dU + dD);
      const p = tl.pose.get(1); if (!p || !p.alive) continue;
      const c = centre2(p.P); frames++; if (pr && pr.active) active++;
      shownLog.push({ t, c, raw, act: pr ? pr.active : false });
      if (watch) { if (!watch.c) watch.c = c; else if (Math.hypot(c[0] - watch.c[0], c[2] - watch.c[2]) > 0.03) { resp.pred.push(t - watch.t); watch = null; } else if (t - watch.t > 1500) watch = null; }
    }
  }
  function centre2(Pp) { return [(Pp[3] + Pp[6]) / 2, (Pp[4] + Pp[7]) / 2, (Pp[5] + Pp[8]) / 2]; }
  // ---- compare what was shown at t with where the server has us once the input sent at t has arrived (t + dU)
  const at = tt => { const i = Math.round(tt / TICK); return truth[Math.min(truth.length - 1, Math.max(0, i))]; };
  const errs = [], rawErrs = [], jerks = []; let jitter = 0, jn = 0;
  for (let i = 1; i < shownLog.length; i++) {
    const s = shownLog[i], tr = at(s.t + dU + TICK); if (!tr.c || tr.ko || s.t < 1500) continue;
    if (deaths.some(d => s.t > d - 400 && s.t < d + 1500)) continue;           // the test's own respawn teleport
    errs.push(Math.hypot(s.c[0] - tr.c[0], s.c[1] - tr.c[1], s.c[2] - tr.c[2]));
    if (s.raw) rawErrs.push(Math.hypot(s.raw[0] - tr.c[0], s.raw[1] - tr.c[1], s.raw[2] - tr.c[2]));
    // frame-to-frame smoothness: second difference of the displayed position
    if (i > 1) { const a = shownLog[i - 2].c, b = shownLog[i - 1].c; const j = Math.hypot(s.c[0] - 2 * b[0] + a[0], s.c[1] - 2 * b[1] + a[1], s.c[2] - 2 * b[2] + a[2]); jerks.push(j); jitter = Math.max(jitter, j); jn++; }
  }
  const q = (a, p) => a.length ? a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))] : NaN;
  const mean = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);
  const out = {
    respMed: q(resp.pred, 0.5), respMax: q(resp.pred, 1), respN: resp.pred.length,
    err: mean(errs), err95: q(errs, 0.95), errMax: q(errs, 1), rawErr: mean(rawErrs), raw95: q(rawErrs, 0.95),
    active: active / (frames || 1), resets: pr ? pr.resets : 0, delay: tl.delay, jerk: jitter, jerk99: q(jerks, 0.99), pops: jerks.filter(j => j > 0.15).length
  };
  if (!quiet) console.log(`${stage.padEnd(11)} up ${dU} down ${dD} bots ${bots} ${predict ? 'PREDICT' : 'plain  '} | input→motion ${out.respMed.toFixed(0)} ms (max ${out.respMax.toFixed(0)}, n ${out.respN}) | shown vs truth: ${(out.err * 100).toFixed(0)} cm avg, ${(out.err95 * 100).toFixed(0)} p95, ${(out.errMax * 100).toFixed(0)} max  [server pose alone: ${(out.rawErr * 100).toFixed(0)} avg, ${(out.raw95 * 100).toFixed(0)} p95] | predicting ${(out.active * 100).toFixed(0)}% resets ${out.resets} deaths ${deaths.length} | interp ${out.delay.toFixed(0)} ms | jerk p99 ${(out.jerk99 * 100).toFixed(1)} max ${(out.jerk * 100).toFixed(1)} cm, pops ${out.pops}`);
  return out;
}

if (process.argv[1] && process.argv[1].endsWith('predict.test.mjs')) {
  if (process.argv[2] === '--check') {                // used by "npm test": a 220 ms round trip must not be felt in your own movement
    const o = run(110, 110, 0, 'ring', true, 30, true), b = run(110, 110, 3, 'ring', true, 30, true);
    const ok = o.respMed <= 60 && o.err < 0.12 && o.resets === 0 && b.respMed <= 100 && b.err < b.rawErr * 1.25 + 0.05;   // a brawl is random: never worse than not predicting
    console.log((ok ? '  ok  ' : '  FAIL') + ` prediction: input→motion ${o.respMed.toFixed(0)} ms, ${(o.err * 100).toFixed(0)} cm off alone, ${(b.err * 100).toFixed(0)} cm off in a brawl`);
    process.exit(ok ? 0 : 1);
  }
  const [dU, dD, bots, stage] = [+(process.argv[2] ?? 110), +(process.argv[3] ?? 110), +(process.argv[4] ?? 0), process.argv[5] || 'ring'];
  run(dU, dD, bots, stage, false, 30, false);
  run(dU, dD, bots, stage, false, 30, true);
}
