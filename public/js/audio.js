// Synthesised sound (no audio files: nothing to download, works on any connection)
(function () {
  let ctx = null, master = null, musicGain = null, noiseBuf = null;
  const A = { volume: 0.7, muted: false };

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = A.volume; master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.16; musicGain.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ctx = null; }
  }
  A.setVolume = v => { A.volume = v; if (master) master.gain.value = v; };

  function tone(type, f0, f1, dur, vol, delay, out) {
    if (!ctx) return;
    const t = ctx.currentTime + (delay || 0), o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(out || master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, f0, f1, type, delay, out) {
    if (!ctx) return;
    const t = ctx.currentTime + (delay || 0), s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1 || f0), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(out || master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  const S = {
    swing() { noise(0.13, 0.16, 700, 2600, 'bandpass'); },
    hit(p) { const k = 0.5 + (p || 1) * 0.25; tone('sine', 150, 45, 0.16, 0.7 * k); noise(0.09, 0.45 * k, 1400, 300); if (p >= 3) tone('square', 90, 40, 0.22, 0.25); },
    bonk() { tone('sine', 420, 150, 0.12, 0.35); tone('triangle', 620, 300, 0.06, 0.2); },
    ko() { tone('sine', 520, 110, 0.5, 0.3); tone('sine', 780, 150, 0.55, 0.14, 0.03); },
    wake() { tone('sine', 220, 420, 0.16, 0.14); },
    jump() { tone('sine', 220, 380, 0.11, 0.14); },
    land(p) { tone('sine', 110, 50, 0.12, Math.min(0.5, 0.12 + (p || 5) * 0.02)); noise(0.06, 0.12, 500, 200); },
    grab() { tone('triangle', 240, 180, 0.05, 0.14); },
    throw() { noise(0.26, 0.26, 500, 3200, 'bandpass'); },
    fall() { tone('sawtooth', 760, 110, 1.1, 0.16); tone('sine', 900, 140, 1.1, 0.18); },
    crash() { noise(0.5, 0.8, 2400, 150); tone('square', 110, 35, 0.4, 0.4); },
    grind() { noise(0.7, 0.5, 900, 400, 'bandpass'); tone('sawtooth', 70, 50, 0.7, 0.4); },
    fire() { noise(0.8, 0.5, 3000, 600, 'highpass'); },
    splash() { noise(0.6, 0.5, 2500, 400, 'bandpass'); },
    glass() { noise(0.25, 0.4, 6000, 3000, 'highpass'); [2400, 3100, 2700, 3600].forEach((f, i) => tone('triangle', f, f * 0.9, 0.12, 0.1, 0.03 + i * 0.05)); },
    wood() { noise(0.18, 0.5, 1200, 250); tone('square', 160, 70, 0.12, 0.25); },
    horn() { tone('sawtooth', 311, 305, 0.8, 0.16); tone('sawtooth', 370, 362, 0.8, 0.16); },
    tick() { tone('square', 620, 620, 0.07, 0.14); },
    go() { tone('square', 880, 1240, 0.3, 0.2); },
    win() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone('triangle', f, f, 0.26, 0.24, i * 0.1)); },
    lose() { [400, 340, 280, 210].forEach((f, i) => tone('sawtooth', f, f * 0.92, 0.28, 0.12, i * 0.14)); },
    emote(n) { const b = 320 + ((n || 0) % 5) * 70; tone('sine', b, b * 1.6, 0.1, 0.2); tone('sine', b * 1.3, b * 0.9, 0.12, 0.2, 0.1); },
    click() { tone('square', 520, 700, 0.04, 0.08); },
    join() { tone('triangle', 520, 800, 0.1, 0.18); tone('triangle', 800, 1040, 0.1, 0.18, 0.09); }
  };

  // a small funky loop: bass, kick, hat, plucky lead
  let timer = null, step = 0, nextT = 0;
  const BASS = [0, 0, 7, 0, 5, 5, 7, 3], LEAD = [12, -1, 15, -1, 19, 17, -1, 15, 12, -1, 10, -1, 7, 10, -1, 12];
  function schedule() {
    if (!ctx) return;
    while (nextT < ctx.currentTime + 0.3) {
      const s = step % 16, d = nextT - ctx.currentTime, root = 55 * Math.pow(2, BASS[(step >> 1) % 8] / 12);
      if (s % 2 === 0) tone('sawtooth', root, root, 0.17, 0.5, d, musicGain);
      if (s % 4 === 0) tone('sine', 120, 45, 0.12, 0.9, d, musicGain);
      if (s % 2 === 1) noise(0.04, 0.25, 8000, 8000, 'highpass', d, musicGain);
      const l = LEAD[s]; if (l >= 0) tone('square', 220 * Math.pow(2, l / 12), 220 * Math.pow(2, l / 12), 0.13, 0.13, d, musicGain);
      nextT += 60 / 116 / 4; step++;
    }
  }
  A.music = on => { clearInterval(timer); timer = null; if (on && ctx) { nextT = ctx.currentTime + 0.1; step = 0; timer = setInterval(schedule, 100); } };
  A.init = init;
  A.play = (name, a) => { if (ctx && S[name]) S[name](a); };
  window.Sfx = A;
})();
