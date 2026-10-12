// node test/netprobe.mjs <ws-url> <bots>   — measures ping, snapshot pacing, sim speed and input→motion latency
import WebSocket from 'ws';
const url = process.argv[2] || 'ws://localhost:3000', bots = +(process.argv[3] || 3);
const ws = new WebSocket(url);
let me = null, t0 = 0, last = 0, gaps = [], pings = [], first = null, lastS = null, sentAt = 0, base = null, lat = [], phase = 0, n = 0;
const q = (a, p) => a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))];
const send = o => ws.send(JSON.stringify(o));
ws.on('open', () => send({ t: 'create', name: 'probe' }));
ws.on('message', (d, bin) => {
  const now = performance.now();
  if (!bin) {
    const m = JSON.parse(d.toString());
    if (m.t === 'joined') { me = m.id ?? m.you ?? m.me; send({ t: 'set', bots, stage: 'ring', wins: 7 }); send({ t: 'start' }); setInterval(() => send({ t: 'ping', c: performance.now() }), 500); }
    else if (m.t === 'pong') pings.push(now - m.c);
    else if (m.t === 'round') { first = null; phase = 0; }
    return;
  }
  const dv = new DataView(d.buffer, d.byteOffset, d.byteLength);
  if (dv.getUint8(0) !== 1) return;
  const ph = dv.getUint8(1), ts = dv.getUint32(4, true), gt = dv.getFloat32(8, true), cnt = dv.getUint8(13);
  if (last) gaps.push(now - last); last = now; n++;
  if (ph !== 1) return;
  if (!first) first = { now, ts, gt }; lastS = { now, ts, gt };
  let o = 16, x = null;
  for (let i = 0; i < cnt; i++) { const id = dv.getUint16(o, true), f = dv.getUint8(o + 2); o += 4; if (f & 1) { if (id === me) x = dv.getInt16(o + 6, true) / 100; o += 84; } }
  if (x === null) return;
  // alternate: stand still 0.7 s, then push +x / -x and time the first 3 cm of chest motion
  if (phase === 0) { phase = 1; t0 = now; send({ t: 'in', x: 0, z: 0, b: 0 }); }
  else if (phase === 1 && now - t0 > 700) { phase = 2; base = x; sentAt = now; send({ t: 'in', x: lat.length % 2 ? -1 : 1, z: 0, b: 0 }); }
  else if (phase === 2 && Math.abs(x - base) > 0.03) { lat.push(now - sentAt); phase = 0; }
  else if (phase === 2 && now - sentAt > 1500) phase = 0;
});
setTimeout(() => {
  const wall = lastS.now - first.now;
  console.log(`url ${url} bots ${bots} me ${me}`);
  console.log(`ping ms   min ${q(pings, 0).toFixed(0)} med ${q(pings, .5).toFixed(0)} p95 ${q(pings, .95).toFixed(0)}`);
  console.log(`snap gap  med ${q(gaps, .5).toFixed(1)} p95 ${q(gaps, .95).toFixed(1)} max ${q(gaps, 1).toFixed(0)}  (${(n / 20).toFixed(1)}/s)`);
  console.log(`sim speed ${(100 * (lastS.gt - first.gt) * 1000 / wall).toFixed(1)}% of real time, server clock ${(100 * (lastS.ts - first.ts) / wall).toFixed(1)}%`);
  console.log(`input→3cm move ms: n ${lat.length} min ${q(lat, 0).toFixed(0)} med ${q(lat, .5).toFixed(0)} max ${q(lat, 1).toFixed(0)}`);
  process.exit(0);
}, 20000);
