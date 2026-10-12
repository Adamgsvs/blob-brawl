// Unified input: keyboard + mouse + gamepad + touch (virtual stick & buttons)
(function () {
  const I = { mx: 0, mz: 0, j: 0, p: 0, g: 0, touchMode: false, enabled: false, onEmote: null, onEmoteMenu: null };
  const keys = {};
  let latchJ = false, latchP = false;
  let mouseP = false, mouseG = false;
  let tx = 0, tz = 0, tJ = false, tP = false, tG = false;
  let padX = 0, padZ = 0, padJ = false, padP = false, padG = false, prevPadEmote = false;

  const typing = e => e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT');
  const LEFT = ['KeyA', 'ArrowLeft'], RIGHT = ['KeyD', 'ArrowRight'], UP = ['KeyW', 'ArrowUp'], DOWN = ['KeyS', 'ArrowDown'], JUMP = ['Space'], PUNCH = ['KeyJ', 'KeyZ', 'KeyF'], GRAB = ['KeyK', 'KeyX', 'ShiftLeft', 'ShiftRight', 'KeyG'];

  window.addEventListener('keydown', e => {
    if (typing(e) || !I.enabled) return;
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (!keys[e.code]) {
      if (JUMP.includes(e.code)) latchJ = true;
      if (PUNCH.includes(e.code)) latchP = true;
      if (/^Digit[1-8]$/.test(e.code) && I.onEmote) I.onEmote(+e.code.slice(5) - 1);
      if (e.code === 'KeyE' && I.onEmote) I.onEmote(Math.floor(Math.random() * 8));
      if (e.code === 'KeyQ' && I.onEmoteMenu) I.onEmoteMenu();
    }
    keys[e.code] = true;
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouseP = mouseG = false; });

  const cv = document.getElementById('game');
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('mousedown', e => {
    if (!I.enabled) return;
    if (e.button === 0) { mouseP = true; latchP = true; } else if (e.button === 2) mouseG = true;
  });
  window.addEventListener('mouseup', e => { if (e.button === 0) mouseP = false; else if (e.button === 2) mouseG = false; });

  // ---------------- touch
  const stick = document.getElementById('stick'), knob = document.getElementById('knob');
  let stickId = null, sx = 0, sy = 0;
  const R = 60;
  stick.addEventListener('pointerdown', e => {
    stickId = e.pointerId; stick.setPointerCapture(e.pointerId);
    const r = stick.getBoundingClientRect(); sx = e.clientX; sy = e.clientY;
    knob.style.display = 'block'; knob.style.left = (sx - r.left) + 'px'; knob.style.top = (sy - r.top) + 'px'; tx = 0; tz = 0; e.preventDefault();
  });
  stick.addEventListener('pointermove', e => {
    if (e.pointerId !== stickId) return;
    const r = stick.getBoundingClientRect();
    let dx = e.clientX - sx, dy = e.clientY - sy; const d = Math.hypot(dx, dy);
    if (d > R) { dx *= R / d; dy *= R / d; }
    knob.style.left = (sx - r.left + dx) + 'px'; knob.style.top = (sy - r.top + dy) + 'px';
    tx = Math.abs(dx) < 8 ? 0 : dx / R; tz = Math.abs(dy) < 8 ? 0 : dy / R;
    e.preventDefault();
  });
  const endStick = e => { if (e.pointerId === stickId) { stickId = null; tx = 0; tz = 0; knob.style.display = 'none'; } };
  stick.addEventListener('pointerup', endStick); stick.addEventListener('pointercancel', endStick);

  function bindBtn(id, down, up) {
    const el = document.getElementById(id); let pid = null;
    el.addEventListener('pointerdown', e => { pid = e.pointerId; el.setPointerCapture(pid); el.classList.add('on'); down(); e.preventDefault(); });
    const end = e => { if (e.pointerId !== pid) return; pid = null; el.classList.remove('on'); up(); };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  }
  bindBtn('tJump', () => { tJ = true; latchJ = true; }, () => { tJ = false; });
  bindBtn('tPunch', () => { tP = true; latchP = true; }, () => { tP = false; });
  bindBtn('tGrab', () => { tG = true; }, () => { tG = false; });
  bindBtn('tEmote', () => { if (I.onEmoteMenu) I.onEmoteMenu(); }, () => { });

  function pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const ax = p.axes[0] || 0;
      const ay = p.axes[1] || 0; padX = Math.abs(ax) > 0.2 ? ax : 0; padZ = Math.abs(ay) > 0.2 ? ay : 0;
      if (p.buttons[12] && p.buttons[12].pressed) padZ = -1; if (p.buttons[13] && p.buttons[13].pressed) padZ = 1; if (p.buttons[14] && p.buttons[14].pressed) padX = -1;
      if (p.buttons[15] && p.buttons[15].pressed) padX = 1;
      const b = i => !!(p.buttons[i] && p.buttons[i].pressed);
      const j = b(0), pu = b(2) || b(1), gr = b(7) || b(5) || b(3);
      if (j && !padJ) latchJ = true; if (pu && !padP) latchP = true;
      padJ = j; padP = pu; padG = gr;
      const em = b(4) || b(6);
      if (em && !prevPadEmote && I.onEmote) I.onEmote(Math.floor(Math.random() * 8));
      prevPadEmote = em;
      return;
    }
    padX = 0; padZ = 0; padJ = padP = padG = false;
  }

  I.poll = function () {
    pollPad();
    let mx = 0;
    if (LEFT.some(k => keys[k])) mx -= 1;
    if (RIGHT.some(k => keys[k])) mx += 1;
    let mz = 0;
    if (UP.some(k => keys[k])) mz -= 1;
    if (DOWN.some(k => keys[k])) mz += 1;
    if (!mx && !mz) { mx = tx || padX; mz = tz || padZ; }
    const mm = Math.hypot(mx, mz); if (mm > 1) { mx /= mm; mz /= mm; }
    const j = JUMP.some(k => keys[k]) || tJ || padJ;
    const p = PUNCH.some(k => keys[k]) || mouseP || tP || padP;
    const g = GRAB.some(k => keys[k]) || mouseG || tG || padG;
    const out = { mx: Math.round(mx * 100) / 100, mz: Math.round(mz * 100) / 100, j: (j || latchJ) ? 1 : 0, p: (p || latchP) ? 1 : 0, g: g ? 1 : 0 };
    latchJ = latchP = false;
    return out;
  };
  I.reset = function () { for (const k in keys) keys[k] = false; tx = 0; tz = 0; tJ = tP = tG = false; mouseP = mouseG = false; latchJ = latchP = false; };
  window.Input = I;
})();
