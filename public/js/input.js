// One input source for keyboard + mouse, gamepad and touch.  poll() -> { x, z, b }  (b = button bits)
(function () {
  const BTN = { JUMP: 1, HL: 2, HR: 4, LIFT: 8, KICK: 16, BUTT: 32 };
  const I = { enabled: false, onEmote: null, BTN };
  const keys = {};
  let latch = 0;                         // buttons pressed (and maybe already released) since the last poll
  let mouse = 0, touch = 0, pad = 0, padPrev = 0, padX = 0, padZ = 0, tx = 0, tz = 0;
  let punchUntil = 0, punchBit = BTN.HL, grabOn = false, liftOn = false, liftOffAt = 0;

  const KEYMAP = {
    Space: BTN.JUMP, KeyJ: BTN.HL, KeyK: BTN.HR, KeyL: BTN.LIFT, ShiftLeft: BTN.LIFT, ShiftRight: BTN.LIFT,
    KeyF: BTN.KICK, KeyM: BTN.KICK, KeyH: BTN.BUTT, KeyE: BTN.BUTT, ControlLeft: BTN.BUTT, ControlRight: BTN.BUTT
  };
  const typing = e => e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
  window.addEventListener('keydown', e => {
    if (typing(e) || !I.enabled) return;
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (!keys[e.code]) {
      if (KEYMAP[e.code]) latch |= KEYMAP[e.code];
      if (/^Digit[1-8]$/.test(e.code) && I.onEmote) I.onEmote(+e.code.slice(5) - 1);
    }
    keys[e.code] = true;
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse = 0; });

  const cv = document.getElementById('game');
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('mousedown', e => { if (!I.enabled) return; const b = e.button === 0 ? BTN.HL : e.button === 2 ? BTN.HR : e.button === 1 ? BTN.LIFT : 0; mouse |= b; latch |= b; });
  window.addEventListener('mouseup', e => { mouse &= ~(e.button === 0 ? BTN.HL : e.button === 2 ? BTN.HR : e.button === 1 ? BTN.LIFT : 0); });

  // ---- touch: floating stick on the left
  const stick = document.getElementById('stick'), knob = document.getElementById('knob');
  let sid = null, sx = 0, sy = 0; const R = 56;
  stick.addEventListener('pointerdown', e => {
    sid = e.pointerId; stick.setPointerCapture(sid); const r = stick.getBoundingClientRect(); sx = e.clientX; sy = e.clientY;
    knob.style.display = 'block'; knob.style.left = (sx - r.left) + 'px'; knob.style.top = (sy - r.top) + 'px'; tx = tz = 0; e.preventDefault();
  });
  stick.addEventListener('pointermove', e => {
    if (e.pointerId !== sid) return;
    const r = stick.getBoundingClientRect(); let dx = e.clientX - sx, dy = e.clientY - sy; const d = Math.hypot(dx, dy);
    if (d > R) { dx *= R / d; dy *= R / d; }
    knob.style.left = (sx - r.left + dx) + 'px'; knob.style.top = (sy - r.top + dy) + 'px';
    tx = Math.abs(dx) < 7 ? 0 : dx / R; tz = Math.abs(dy) < 7 ? 0 : dy / R; e.preventDefault();
  });
  const endStick = e => { if (e.pointerId === sid) { sid = null; tx = tz = 0; knob.style.display = 'none'; } };
  stick.addEventListener('pointerup', endStick); stick.addEventListener('pointercancel', endStick);

  function hold(id, bit) {                // a button that is down while your thumb is on it
    const el = document.getElementById(id); let pid = null;
    el.addEventListener('pointerdown', e => { pid = e.pointerId; el.setPointerCapture(pid); el.classList.add('on'); touch |= bit; latch |= bit; e.preventDefault(); });
    const end = e => { if (e.pointerId !== pid) return; pid = null; el.classList.remove('on'); touch &= ~bit; };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  }
  hold('tJump', BTN.JUMP); hold('tKick', BTN.KICK); hold('tButt', BTN.BUTT);
  const tap = (id, fn) => document.getElementById(id).addEventListener('pointerdown', e => { fn(e.currentTarget); e.preventDefault(); });
  // punch: every tap throws the other hand
  tap('tPunch', el => { punchBit = punchBit === BTN.HL ? BTN.HR : BTN.HL; punchUntil = performance.now() + 110; latch |= punchBit; el.classList.add('on'); setTimeout(() => el.classList.remove('on'), 110); });
  // grab and lift stay on until tapped again, so one thumb can hold somebody, lift and still jump
  const gEl = document.getElementById('tGrab'), lEl = document.getElementById('tLift');
  tap('tGrab', () => { grabOn = !grabOn; gEl.classList.toggle('on', grabOn); if (grabOn) latch |= BTN.HL | BTN.HR; else if (liftOn) { liftOffAt = performance.now() + 170; } });
  tap('tLift', () => { liftOn = !liftOn; liftOffAt = 0; lEl.classList.toggle('on', liftOn); if (liftOn) latch |= BTN.LIFT; });

  function pollPad() {
    pad = 0; padX = padZ = 0;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0, b = i => !!(p.buttons[i] && p.buttons[i].pressed);
      if (Math.hypot(ax, ay) > 0.22) { padX = ax; padZ = ay; }
      if (b(14)) padX = -1; if (b(15)) padX = 1; if (b(12)) padZ = -1; if (b(13)) padZ = 1;
      if (b(0)) pad |= BTN.JUMP; if (b(4) || b(6)) pad |= BTN.HL; if (b(5) || b(7)) pad |= BTN.HR; if (b(3)) pad |= BTN.LIFT; if (b(2)) pad |= BTN.KICK; if (b(1)) pad |= BTN.BUTT;
      break;
    }
    latch |= pad & ~padPrev; padPrev = pad;
  }

  I.poll = function () {
    pollPad();
    const now = performance.now();
    let x = 0, z = 0;
    if (keys.KeyA || keys.ArrowLeft) x -= 1; if (keys.KeyD || keys.ArrowRight) x += 1;
    if (keys.KeyW || keys.ArrowUp) z -= 1; if (keys.KeyS || keys.ArrowDown) z += 1;
    if (!x && !z) { x = tx || padX; z = tz || padZ; }
    const m = Math.hypot(x, z); if (m > 1) { x /= m; z /= m; }
    let b = mouse | touch | pad;
    for (const k in KEYMAP) if (keys[k]) b |= KEYMAP[k];
    if (now < punchUntil) b |= punchBit;
    if (grabOn) b |= BTN.HL | BTN.HR;
    if (liftOffAt && now > liftOffAt) { liftOn = false; liftOffAt = 0; lEl.classList.remove('on'); }
    if (liftOn) b |= BTN.LIFT;
    b |= latch; latch = 0;
    return { x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100, b };
  };
  I.reset = function () {
    for (const k in keys) keys[k] = false; mouse = touch = latch = 0; tx = tz = 0; grabOn = liftOn = false; liftOffAt = 0; punchUntil = 0;
    gEl.classList.remove('on'); lEl.classList.remove('on');
  };
  window.Input = I;
})();
