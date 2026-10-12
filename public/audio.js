// Tiny synthesized sound engine (no asset files => loads instantly even on slow connections)
(function () {
  let ctx = null, master = null, noiseBuf = null;
  const A = { volume: 0.7, muted: false };

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = A.volume; master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ctx = null; }
  }
  function setVolume(v) { A.volume = v; if (master) master.gain.value = A.muted ? 0 : v; }
  function setMuted(m) { A.muted = m; if (master) master.gain.value = m ? 0 : A.volume; }

  function tone(type, f0, f1, dur, vol, delay) {
    if (!ctx || A.muted) return;
    const t = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, freq, delay) {
    if (!ctx || A.muted) return;
    const t = ctx.currentTime + (delay || 0);
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 1200;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.02);
  }

  const S = {
    jump() { tone('sine', 280, 640, 0.14, 0.25); },
    punch() { noise(0.09, 0.25, 2500); tone('triangle', 400, 200, 0.07, 0.15); },
    hit(p) { noise(0.16, 0.55, 900); tone('square', 180 + Math.random() * 40, 60, 0.18, 0.3); if (p > 1) tone('sine', 120, 40, 0.3, 0.4); },
    bonk() { tone('sine', 520, 140, 0.18, 0.4); },
    ko() { tone('sawtooth', 500, 90, 0.7, 0.28); tone('sine', 330, 80, 0.8, 0.22, 0.08); },
    die(c) { tone('sawtooth', 700, 70, 1.0, 0.3); if (c === 'lava') noise(0.7, 0.4, 600, 0.05); },
    up() { tone('sine', 300, 700, 0.18, 0.25); },
    grab() { tone('square', 220, 260, 0.05, 0.15); },
    throw() { noise(0.2, 0.35, 3500); tone('sawtooth', 200, 700, 0.2, 0.2); },
    bounce() { tone('sine', 200, 900, 0.22, 0.35); tone('triangle', 400, 1200, 0.18, 0.15, 0.03); },
    tick() { tone('square', 660, 660, 0.09, 0.2); },
    go() { tone('square', 880, 1320, 0.35, 0.28); },
    win() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone('triangle', f, f, 0.28, 0.3, i * 0.11)); },
    lose() { [400, 340, 280, 200].forEach((f, i) => tone('sawtooth', f, f * 0.9, 0.3, 0.2, i * 0.15)); },
    emote(n) { const b = 300 + (n % 5) * 70; tone('sine', b, b * 1.6, 0.12, 0.3); tone('sine', b * 1.3, b * 0.8, 0.14, 0.3, 0.12); },
    click() { tone('square', 500, 700, 0.05, 0.12); },
    join() { tone('triangle', 500, 800, 0.12, 0.25); tone('triangle', 800, 1000, 0.12, 0.25, 0.1); }
  };

  // tiny funky loop: bass + hats + a plucky lead, scheduled ahead with setInterval
  let mTimer = null, step = 0, nextT = 0;
  const BASS = [0, 0, 7, 0, 5, 5, 7, 3], LEAD = [12, -1, 15, -1, 19, 17, -1, 15, 12, -1, 10, -1, 7, 10, -1, 12];
  function note(freq, dur, type, vol, t) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + dur + 0.02);
  }
  let musicGain = null;
  function schedule() {
    if (!ctx || A.muted) return;
    while (nextT < ctx.currentTime + 0.3) {
      const s = step % 16, root = 55 * Math.pow(2, BASS[(step >> 1) % 8] / 12);
      if (s % 2 === 0) note(root, 0.18, 'sawtooth', 0.5, nextT);
      if (s % 4 === 0) { note(110, 0.12, 'sine', 0.8, nextT); }
      if (s % 2 === 1) { const b = ctx.createBufferSource(); b.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000; const g = ctx.createGain(); g.gain.setValueAtTime(0.18, nextT); g.gain.exponentialRampToValueAtTime(0.001, nextT + 0.05); b.connect(f); f.connect(g); g.connect(musicGain); b.start(nextT); b.stop(nextT + 0.06); }
      const l = LEAD[s]; if (l >= 0) note(220 * Math.pow(2, l / 12), 0.14, 'square', 0.12, nextT);
      nextT += 60 / 118 / 4; step++;
    }
  }
  A.music = on => {
    if (!ctx) return;
    if (!musicGain) { musicGain = ctx.createGain(); musicGain.gain.value = 0.22; musicGain.connect(master); }
    clearInterval(mTimer); mTimer = null;
    if (on) { nextT = ctx.currentTime + 0.1; step = 0; mTimer = setInterval(schedule, 100); }
  };
  A.init = init; A.setVolume = setVolume; A.setMuted = setMuted;
  A.play = (name, a) => { if (S[name]) S[name](a); };
  window.Sfx = A;
})();
