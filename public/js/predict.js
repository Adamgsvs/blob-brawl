// Client-side prediction of the local player's own beast.
// The server stays the authority. This only takes the network round trip out of what you see of yourself: the
// same physics runs here for your beast alone, driven by your input the moment you press it, and is steadily
// nudged toward what the server reports (compared against where the prediction was when the server had seen the
// same input). Everybody else is posed from the snapshots and acts as a solid obstacle. Whenever the server knows
// something this cannot (knocked out, holding or held by somebody, sent tumbling) the server pose is shown instead.
import { Game, DT } from '../shared/sim.js';
import { P, NP } from '../shared/skeleton.js';

const N3 = NP * 3, CH = P.CHEST * 3, PE = P.PELVIS * 3;
const HARD = 1.6;                                   // metres of disagreement before restarting from the server pose
const OWN = { jump: 1, land: 1, step: 1, swing: 1 };  // events of our own that are played from the prediction

const tilt = Pp => {                                // angle between the spine and straight up
  const x = Pp[CH] - Pp[PE], y = Pp[CH + 1] - Pp[PE + 1], z = Pp[CH + 2] - Pp[PE + 2];
  return Math.acos(Math.max(-1, Math.min(1, y / (Math.hypot(x, y, z) || 1))));
};

export class Predictor {
  constructor(stageId, meId, members) {
    const g = this.g = new Game(stageId, members.map(m => ({ id: m.id, team: m.team })), null);
    g.puppets = true; g.die = () => { }; g.knockOut = () => { };       // dying and knock-outs are the server's call
    for (const c of g.breaks) c.hp = 1e9;
    this.meId = meId; this.me = g.byId.get(meId) || null;
    for (const b of g.beasts) if (b !== this.me) { b.puppet = true; b.alive = false; }
    this.on = false; this.w = 0; this.acc = 0; this.simT = 0;
    this.prev = new Float32Array(N3); this.cur = new Float32Array(N3); this.out = new Float32Array(N3);
    this.hist = []; this.vo = [0, 0, 0]; this.pend = [0, 0, 0];
    this.last = null; this.before = null; this.flags = 0; this.frozen = true;
    this.hard = false; this.err = 0; this.tiltT = 0; this.tiltLock = false; this.tiltMax = 0;
    this.events = []; this.resets = 0;
  }
  // true while the picture of our own beast comes (mostly) from the prediction
  get active() { return this.on && this.w > 0.5; }

  shiftAll(dx, dy, dz) {
    const b = this.me;
    for (let i = 0; i < NP; i++) b.shift(i, dx, dy, dz);
    for (let i = 0; i < N3; i += 3) { this.prev[i] += dx; this.prev[i + 1] += dy; this.prev[i + 2] += dz; this.cur[i] += dx; this.cur[i + 1] += dy; this.cur[i + 2] += dz; }
    for (const h of this.hist) { h.x += dx; h.y += dy; h.z += dz; }
  }
  histAt(t) {
    const H = this.hist; if (!H.length || t < H[0].t) return null;
    for (let i = H.length - 1; i >= 0; i--) {
      if (H[i].t > t) continue;
      const a = H[i], b = H[i + 1]; if (!b) return a;
      const k = (t - a.t) / (b.t - a.t);
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k, ux: a.ux, uy: a.uy, uz: a.uz };
    }
    return null;
  }

  // a snapshot arrived. offset: server clock - ours (see Timeline), rtt: measured round trip in ms
  onSnap(s, now, offset, rtt) {
    const b = this.me; if (!b) return;
    this.before = this.last; this.last = s;
    const m = s.b.get(this.meId); this.flags = m ? m.f : 0; this.frozen = s.ph === 0;
    const br = this.g.breaks; for (let n = 0; n < br.length; n++) br[n].alive = !((s.brk >> n) & 1);
    if (!this.on || !m || !m.P) return;
    b.stun = m.st;
    // the server state at s.ts has seen the input we sent up to about (s.ts - offset - rtt) on our clock
    const h = this.histAt(s.ts - offset - rtt - 8); if (!h) return;
    const ex = (m.P[CH] + m.P[PE]) / 2 - h.x, ey = (m.P[CH + 1] + m.P[PE + 1]) / 2 - h.y, ez = (m.P[CH + 2] + m.P[PE + 2]) / 2 - h.z, len = Math.hypot(ex, ey, ez);
    this.err += (len - this.err) * 0.3;
    if (len > HARD) { this.hard = true; return; }
    this.pend[0] = ex; this.pend[1] = ey; this.pend[2] = ez;        // paid off smoothly, a little every frame
    // spine pointing somewhere else entirely: we were floored or sent flying
    const sx = m.P[CH] - m.P[PE], sy = m.P[CH + 1] - m.P[PE + 1], sz = m.P[CH + 2] - m.P[PE + 2], sl = Math.hypot(sx, sy, sz) || 1;
    if ((sx * h.ux + sy * h.uy + sz * h.uz) / sl < 0.74) this.tiltT += this.before ? Math.min(100, s.ts - this.before.ts) : 16; else this.tiltT = 0;
    if (this.tiltT > 110) { this.tiltLock = true; this.tiltMax = now + 1500; this.tiltT = 0; }
  }

  // restart the prediction from the pose the server is showing for us
  seed(Pp, inp) {
    const b = this.me, a = this.before, z = this.last;
    const pa = a && a.b.get(this.meId), pz = z && z.b.get(this.meId), dts = a && z ? (z.ts - a.ts) / 1000 : 0;
    const vel = pa && pz && pa.P && pz.P && dts > 0.004 && dts < 0.2;
// whatever the picture was showing a moment ago is kept and faded out, so restarting never pops
    const ox = this.vo[0] + (this.out[CH] - Pp[CH]) * this.w, oy = this.vo[1] + (this.out[CH + 1] - Pp[CH + 1]) * this.w, oz = this.vo[2] + (this.out[CH + 2] - Pp[CH + 2]) * this.w;
    for (let i = 0; i < NP; i++) {
      const j = i * 3; let vx = 0, vy = 0, vz = 0;
      if (vel) { vx = (pz.P[j] - pa.P[j]) / dts; vy = (pz.P[j + 1] - pa.P[j + 1]) / dts; vz = (pz.P[j + 2] - pa.P[j + 2]) / dts; const sp = Math.hypot(vx, vy, vz); if (sp > 20) { vx *= 20 / sp; vy *= 20 / sp; vz *= 20 / sp; } }
      b.x[i] = Pp[j]; b.y[i] = Pp[j + 1]; b.z[i] = Pp[j + 2]; b.ox[i] = b.x[i] - vx * DT; b.oy[i] = b.y[i] - vy * DT; b.oz[i] = b.z[i] - vz * DT;
    }
    b.alive = true; b.ko = 0; b.bal = 1; b.getup = tilt(Pp) > 0.9 ? 0.5 : 0; b.stun = pz ? pz.st : 0;
    b.pin.fill(0); b.mantle = null; b.butt = 0; b.kick = 0; b.aim = null; b.bend = 0; b.lift = false; b.hang = false;
    b.gT[0] = b.gT[1] = this.g.tick; b.gY[0] = Pp[P.FTL * 3 + 1]; b.gY[1] = Pp[P.FTR * 3 + 1]; b.gVx = b.gVy = b.gVz = 0;
    b.jumpCd = b.knockCd = b.landCd = 0.2; b.noGrab = 0;
    for (let s = 0; s < 2; s++) { const held = (inp.b & (s ? 4 : 2)) !== 0; b.arm[s] = { mode: held ? 2 : 0, t: 0, cd: 0, hit: false, grab: null, grip: 0 }; }
    b.inp.mx = inp.x; b.inp.mz = inp.z; b.inp.b = inp.b; b.edge = 0;
    this.g.frame(b);
    b.yaw = Math.abs(b.Z[1]) < 0.7 ? Math.atan2(b.Z[0], b.Z[2]) : Math.atan2(-b.X[2], b.X[0]);
    this.prev.set(Pp); this.cur.set(Pp); this.out.set(Pp);
    this.vo[0] = ox; this.vo[1] = oy; this.vo[2] = oz; this.pend[0] = this.pend[1] = this.pend[2] = 0;
    this.hist.length = 0; this.acc = 0; this.hard = false; this.err = 0; this.tiltT = 0; this.on = true;
  }

  // once per rendered frame. shown: Map id -> { P, alive, ko } being displayed (from the snapshots); inp: { x, z, b }.
  // Blends the predicted pose into shown.get(meId).P and returns true if it did.
  frame(now, dt, inp, shown, offset, rtt) {
    const g = this.g, b = this.me, sm = b && shown.get(this.meId);
    if (!sm || !sm.alive || !this.last) { this.on = false; this.w = 0; return false; }
    for (const o of g.beasts) {                                   // pose everybody else as they are displayed
      if (!o.puppet) continue;
      const p = shown.get(o.id);
      if (!p || !p.alive) { o.alive = false; continue; }
      const was = o.alive; o.alive = true; o.ko = p.ko ? 1 : 0;
      for (let i = 0; i < NP; i++) {
        const j = i * 3, x = p.P[j], y = p.P[j + 1], z = p.P[j + 2];
        if (was) { o.ox[i] = o.x[i]; o.oy[i] = o.y[i]; o.oz[i] = o.z[i]; } else { o.ox[i] = x; o.oy[i] = y; o.oz[i] = z; }
        o.x[i] = x; o.y[i] = y; o.z[i] = z;
      }
    }
    let want = !(this.flags & 2) && !(this.flags & 64);
    if (this.tiltLock) { if (tilt(sm.P) < 0.5 || now > this.tiltMax) this.tiltLock = false; else want = false; }
    if (!want) { this.on = false; this.w = Math.max(0, this.w - dt / 0.12); }
    else {
      if (!this.on) this.seed(sm.P, inp); else if (this.hard) { this.seed(sm.P, inp); this.resets++; }
      this.w = Math.min(1, this.w + dt / 0.15);
    }
    if (this.on) {
      g.frozen = this.frozen; g.pk = Math.max(0, Math.min(1, 1 - (this.err - 0.25) / 0.5));   // stop arguing with obstacles the server says we passed
      g.setInput(this.meId, inp.x, inp.z, inp.b);
      const pa = 1 - Math.exp(-dt / 0.12), pe = this.pend;
      this.shiftAll(pe[0] * pa, pe[1] * pa, pe[2] * pa); pe[0] *= 1 - pa; pe[1] *= 1 - pa; pe[2] *= 1 - pa;
      this.acc = Math.min(0.1, this.acc + dt);
      const gt = this.last.gt + (now + offset + rtt - this.last.ts) / 1000;
      while (this.acc >= DT) {
        this.acc -= DT;
        g.time = gt - this.acc - DT;
        g.step(); b.alive = true;
        this.prev.set(this.cur);
        for (let i = 0; i < NP; i++) { this.cur[i * 3] = b.x[i]; this.cur[i * 3 + 1] = b.y[i]; this.cur[i * 3 + 2] = b.z[i]; }
        const ux = b.x[P.CHEST] - b.x[P.PELVIS], uy = b.y[P.CHEST] - b.y[P.PELVIS], uz = b.z[P.CHEST] - b.z[P.PELVIS], ul = Math.hypot(ux, uy, uz) || 1;
        this.hist.push({ t: now - this.acc * 1000, x: (b.x[P.CHEST] + b.x[P.PELVIS]) / 2, y: (b.y[P.CHEST] + b.y[P.PELVIS]) / 2, z: (b.z[P.CHEST] + b.z[P.PELVIS]) / 2, ux: ux / ul, uy: uy / ul, uz: uz / ul });
        if (this.hist.length > 150) this.hist.shift();
        for (const e of g.takeEvents()) if (e.i === this.meId && OWN[e.e]) this.events.push(e);
      }
      const k = this.acc / DT;
      for (let i = 0; i < N3; i++) this.out[i] = this.prev[i] + (this.cur[i] - this.prev[i]) * k;
    }
    const w = this.w, S = sm.P, O = this.out, vo = this.vo, f = Math.exp(-dt / 0.09);
    if (w <= 0 && Math.abs(vo[0]) + Math.abs(vo[1]) + Math.abs(vo[2]) < 0.002) return false;
    for (let i = 0; i < N3; i += 3) { S[i] += (O[i] - S[i]) * w + vo[0]; S[i + 1] += (O[i + 1] - S[i + 1]) * w + vo[1]; S[i + 2] += (O[i + 2] - S[i + 2]) * w + vo[2]; }
    vo[0] *= f; vo[1] *= f; vo[2] *= f;
    return true;
  }
  takeEvents() { const e = this.events; this.events = []; return e; }
}
