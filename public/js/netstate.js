// Snapshot timeline: parses the server's binary snapshots, keeps a short buffer of them and plays the world back
// a little in the past (just far enough that there is nearly always a newer snapshot to interpolate toward).
const N3 = 42;

export function parseSnap(buf) {
  const dv = new DataView(buf); if (dv.byteLength < 16 || dv.getUint8(0) !== 1) return null;
  const s = { ph: dv.getUint8(1), rid: dv.getUint16(2, true), ts: dv.getUint32(4, true), gt: dv.getFloat32(8, true), cd: dv.getUint8(12), brk: dv.getUint16(14, true), b: new Map() };
  const n = dv.getUint8(13); let o = 16;
  for (let i = 0; i < n; i++) {
    const id = dv.getUint16(o, true), f = dv.getUint8(o + 2), st = dv.getUint8(o + 3); o += 4; let Pp = null;
    if (f & 1) { Pp = new Float32Array(N3); for (let k = 0; k < N3; k++) Pp[k] = dv.getInt16(o + k * 2, true) / 100; o += N3 * 2; }
    s.b.set(id, { f, st, P: Pp });
  }
  return s;
}

export class Timeline {
  constructor() { this.snaps = []; this.pose = new Map(); this.reset(true); }
  reset(clock) {
    this.snaps.length = 0; this.pose.clear(); this.lastTs = 0;
    if (clock) { this.offset = null; this.delay = 70; this.late = 5; this.dev = 6; this.gap = 17; }
  }
  // offset = (server clock - our clock) as seen through the fastest packets; late = how far behind that a packet arrives
  add(s, now) {
    const sample = s.ts - now;
    if (this.offset === null || sample > this.offset || Math.abs(sample - this.offset) > 2000) this.offset = sample; else this.offset += (sample - this.offset) * 0.004;
    const late = Math.min(250, this.offset - sample);
    this.dev += (Math.abs(late - this.late) - this.dev) * 0.05; this.late += (late - this.late) * 0.05;
    if (this.lastTs && s.ts > this.lastTs) this.gap += (Math.min(120, s.ts - this.lastTs) - this.gap) * 0.05;
    this.lastTs = s.ts;
    this.snaps.push(s); if (this.snaps.length > 80) this.snaps.shift();
  }
  // render time: as close to "now" as the measured snapshot spacing and jitter allow
  time(now, dt) {
    const want = Math.max(30, Math.min(170, this.gap * 1.25 + this.late + 2.5 * this.dev));
    this.delay += (want - this.delay) * Math.min(1, dt * 1.2);
    return now + (this.offset || 0) - this.delay;
  }
  // interpolated state of the world at render time rt (poses land in this.pose)
  sample(rt) {
    const snaps = this.snaps, pose = this.pose;
    if (!snaps.length) return null;
    let a = null, b = null;
    for (let i = snaps.length - 1; i >= 0; i--) if (snaps[i].ts <= rt) { a = snaps[i]; b = snaps[i + 1] || null; break; }
    if (!a) { a = snaps[0]; b = null; }
    const k = b ? Math.min(1, (rt - a.ts) / Math.max(1, b.ts - a.ts)) : 0; if (!b) b = a;
    while (snaps.length > 3 && snaps[1].ts < rt - 400) snaps.shift();
    for (const [id, pb] of b.b) {
      let o = pose.get(id); if (!o) { o = { P: new Float32Array(N3), alive: false, ko: false }; pose.set(id, o); }
      const pa = a.b.get(id);
      o.alive = !!(pb.f & 1) && !!pb.P; o.ko = !!(pb.f & 2);
      if (o.alive) { const A = pa && pa.P ? pa.P : pb.P, B = pb.P; for (let i = 0; i < N3; i++) o.P[i] = A[i] + (B[i] - A[i]) * k; }
    }
    return { gt: a.gt + (b.gt - a.gt) * k, ph: b.ph, cd: b.cd, brk: b.brk };
  }
}
