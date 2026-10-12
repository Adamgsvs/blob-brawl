// UI, networking and the game view
(function () {
  'use strict';
  const R = window.R3;
  const $ = id => document.getElementById(id);
  const LS = {
    get(k, d) { try { const v = localStorage.getItem('bb_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('bb_' + k, JSON.stringify(v)); } catch (e) { } }
  };
    const EMOJIS = ['😂', '😡', '👋', '💀', 'GG', '😭', '🔥', '🤡'];

  // ------------------------------------------------------------------ i18n
  const TXT = {
    ar: {
      subtitle: 'معارك أونلاين مضحكة مع صحابك — اللي يوقع بخسر! 🤪', yourName: 'اسمك', quick: '🎲 لعب سريع', create: '➕ إنشاء غرفة', practice: '🤖 تدريب مع بوتات',
      publicRoom: 'غرفة عامة (أي حد يقدر ينضم)', join: 'دخول', settings: 'الإعدادات', controls: 'التحكمات', hat: 'القبعة', face: 'الوجه',
      leave: 'خروج', roomCode: 'رمز الغرفة', copyLink: 'نسخ الرابط', players: 'اللاعبين', map: 'الخريطة', mode: 'النمط', ffa: 'كل واحد لحاله', teams: 'فرق',
      winsNeeded: 'الفوز بعد', bots: 'بوتات', switchTeam: 'غيّر الفريق', ready: 'جاهز ✔', notReady: 'مش جاهز', start: '▶ ابدأ اللعب', chatPh: 'اكتب رسالة...',
      spectating: '👀 بتتفرج لحد الجولة الجاية', rotate: '📱 لفّ الجوال بالعرض عشان تلعب', bJump: 'نط', bPunch: 'ضرب', bGrab: 'مسك',
      random: 'عشوائي', noroom: 'الغرفة مش موجودة ❌', full: 'الغرفة ممتلئة', conn: 'ما قدرت اتصل بالسيرفر', lost: 'انقطع الاتصال', need2: 'لازم لاعبين اثنين على الأقل — ضيف بوتات!',
      kicked: 'انطردت من الغرفة', round: 'الجولة', wonRound: 'فاز بالجولة!', draw: 'تعادل! 🤝', champion: '🏆 بطل المباراة', backLobby: 'رجوع للوبي', go: 'يلا!',
      language: 'اللغة', volume: 'الصوت', quality: 'الجودة', qAuto: 'تلقائي', qLow: 'خفيفة (للأجهزة الضعيفة)', qMid: 'متوسطة', qHigh: 'عالية',
      touch: 'أزرار اللمس', tAuto: 'تلقائي', tOn: 'ظاهرة', tOff: 'مخفية', fullscreen: 'ملء الشاشة', resume: 'كمّل', close: 'إغلاق', leaveRoom: 'اترك الغرفة',
      copied: 'انسخ الرابط وابعته لصحابك ✔', waitHost: 'بانتظار المضيف يبدأ...', team: 'فريق', red: 'الأحمر', blue: 'الأزرق', wins: 'فوز',
      ctlPc: 'الكمبيوتر', ctlMobile: 'الجوال',
      help: [['حركة (كل الاتجاهات)', '<kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> أو الأسهم'], ['نط / تسلّق', '<kbd>Space</kbd> (وانت معلّق = اطلع فوق)'], ['ضرب', '<kbd>J</kbd> أو <kbd>Z</kbd> أو كليك يسار'],
        ['مسك (اضغط مطوّلاً)', '<kbd>K</kbd> أو <kbd>Shift</kbd> أو كليك يمين — امسك لاعب أو حافة'], ['رمي', 'وإنت ماسك لاعب اضغط ضرب'], ['إيموجي', '<kbd>1</kbd>–<kbd>8</kbd> أو <kbd>E</kbd>'], ['يد التحكم', 'مدعومة 🎮']],
      helpM: [['حركة', 'اسحب بإصبعك على الجهة اليسرى'], ['نط', 'زر ⬆'], ['ضرب', 'زر 👊'], ['مسك', 'زر ✋ (اضغط مطوّلاً) — وبعدين 👊 ترمي'], ['إيموجي', 'زر 😜']],
      tips: ['💡 اضرب راس خصمك مرتين تقريباً وبيطلع عنده نجوم', '💡 امسك الحافة بزر المسك وانت بالهوا!', '💡 اضغط أزرار كثير وإنت مخدّر بتصحى أسرع', '💡 امسك لاعب وبعدين اضغط ضرب عشان ترميه من المنصة']
    },
    en: {
      subtitle: 'Wobbly online brawls with your friends — last one standing wins! 🤪', yourName: 'Your name', quick: '🎲 Quick Play', create: '➕ Create room', practice: '🤖 Practice (bots)',
      publicRoom: 'Public room (anyone can join)', join: 'Join', settings: 'Settings', controls: 'Controls', hat: 'Hat', face: 'Face',
      leave: 'Leave', roomCode: 'Room code', copyLink: 'Copy link', players: 'Players', map: 'Map', mode: 'Mode', ffa: 'Free-for-all', teams: 'Teams',
      winsNeeded: 'Wins needed', bots: 'Bots', switchTeam: 'Switch team', ready: 'Ready ✔', notReady: 'Not ready', start: '▶ Start game', chatPh: 'Type a message...',
      spectating: '👀 Spectating until next round', rotate: '📱 Rotate your phone to landscape', bJump: 'Jump', bPunch: 'Punch', bGrab: 'Grab',
      random: 'Random', noroom: 'Room not found ❌', full: 'Room is full', conn: 'Could not reach the server', lost: 'Connection lost', need2: 'Need at least 2 players — add bots!',
      kicked: 'You were kicked', round: 'Round', wonRound: 'wins the round!', draw: 'Draw! 🤝', champion: '🏆 Match champion', backLobby: 'Back to lobby', go: 'GO!',
      language: 'Language', volume: 'Volume', quality: 'Quality', qAuto: 'Auto', qLow: 'Low (weak devices)', qMid: 'Medium', qHigh: 'High',
      touch: 'Touch buttons', tAuto: 'Auto', tOn: 'Show', tOff: 'Hide', fullscreen: 'Fullscreen', resume: 'Resume', close: 'Close', leaveRoom: 'Leave room',
      copied: 'Link copied — send it to your friends ✔', waitHost: 'Waiting for the host to start...', team: 'Team', red: 'Red', blue: 'Blue', wins: 'wins',
      ctlPc: 'Keyboard & mouse', ctlMobile: 'Mobile',
      help: [['Move (any direction)', '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or arrows'], ['Jump / climb', '<kbd>Space</kbd> (while hanging = pull up)'], ['Punch', '<kbd>J</kbd> / <kbd>Z</kbd> / left click'],
        ['Grab (hold)', '<kbd>K</kbd> / <kbd>Shift</kbd> / right click — grab players or ledges'], ['Throw', 'while holding a player press Punch'], ['Emotes', '<kbd>1</kbd>–<kbd>8</kbd> or <kbd>E</kbd>'], ['Gamepad', 'supported 🎮']],
      helpM: [['Move', 'drag on the left side'], ['Jump', '⬆ button'], ['Punch', '👊 button'], ['Grab', 'hold ✋ — then 👊 to throw'], ['Emote', '😜 button']],
      tips: ['💡 Punch the head twice to see stars', '💡 Hold Grab in mid-air to hang from ledges!', '💡 Mash buttons while knocked out to wake up faster', '💡 Grab a player then Punch to throw them off the map']
    }
  };
  let lang = LS.get('lang', (navigator.language || 'ar').startsWith('ar') ? 'ar' : 'en');
  const t = k => (TXT[lang][k] !== undefined ? TXT[lang][k] : k);
  function applyLang() {
    document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-i]').forEach(e => { e.textContent = t(e.dataset.i); });
    document.querySelectorAll('[data-iph]').forEach(e => { e.placeholder = t(e.dataset.iph); });
    renderCust(); if (room) { buildMaps(); renderLobby(); }
  }

  // ------------------------------------------------------------------ settings
  const S = { music: LS.get('music', true), vol: LS.get('vol', 0.7), quality: LS.get('quality', 'auto'), touch: LS.get('touch', 'auto') };
  let autoQ = 1; // 0 low, 1 mid, 2 high (used when quality==='auto')
  const qLevel = () => (S.quality === 'auto' ? autoQ : S.quality === 'low' ? 0 : S.quality === 'mid' ? 1 : 2);
  Sfx.setVolume(S.vol);
  function isTouch() {
    if (S.touch === 'on') return true; if (S.touch === 'off') return false;
    return (window.matchMedia && matchMedia('(pointer:coarse)').matches) || 'ontouchstart' in window;
  }

  // ------------------------------------------------------------------ player look + customization
  const NAMES = ['وحش', 'دبدوب', 'فرفوش', 'بطاطا', 'عنتر', 'شقفة', 'كعكة', 'تنّين'];
  let myName = LS.get('name', NAMES[(Math.random() * NAMES.length) | 0] + ((Math.random() * 90 + 10) | 0));
  const DEF_LOOK = { s: 1, c: 2, d: 0, o: 0, h: 0, f: 0 };
  let look = Object.assign({}, DEF_LOOK, LS.get('look', {}));
  look.c %= 16; look.d %= 16;
  $('name').value = myName;
  const CU = {
    ar: {
      tabs: { skins: '⭐ شخصيات جاهزة', species: '🐾 النوع', colors: '🎨 الألوان', outfit: '👕 الزي', hat: '🎩 القبعة', face: '😀 الوجه' },
      species: ['فاصوليا', 'دجاجة', 'دب', 'ديناصور', 'قط', 'أرنب', 'ضفدع', 'خنزير', 'قرش', 'فضائي'],
      outfit: ['بدون', 'فانيلة', 'أفرول', 'هودي', 'مصارع', 'قرصان', 'نينجا', 'هاواي', 'بطل خارق', 'هيكل عظمي'],
      hat: ['بدون', 'تاج', 'قبعة حفلة', 'كاب', 'قرون', 'طباخ', 'كاوبوي', 'أذن أرنب', 'مروحة', 'سيلندر', 'أذن قط', 'وردة'],
      face: ['سعيد', 'مهبّل', 'غاضب', 'كول', 'مصدوم', 'مجنون'],
      primary: 'اللون الأساسي', secondary: 'لون الزي / الثانوي', rand: 'عشوائي',
      presets: ['الدجاجة', 'المصارع', 'الديناصور', 'الدب', 'القط القرصان', 'النينجا', 'البطل', 'الخنزير الهاواي', 'الهيكل', 'الضفدع', 'الفضائي', 'القرش']
    },
    en: {
      tabs: { skins: '⭐ Skins', species: '🐾 Species', colors: '🎨 Colors', outfit: '👕 Outfit', hat: '🎩 Hat', face: '😀 Face' },
      species: ['Bean', 'Chicken', 'Bear', 'Dino', 'Cat', 'Bunny', 'Frog', 'Pig', 'Shark', 'Alien'],
      outfit: ['None', 'Tank top', 'Overalls', 'Hoodie', 'Luchador', 'Pirate', 'Ninja', 'Hawaiian', 'Hero', 'Skeleton'],
      hat: ['None', 'Crown', 'Party', 'Cap', 'Horns', 'Chef', 'Cowboy', 'Bunny ears', 'Propeller', 'Top hat', 'Cat ears', 'Flower'],
      face: ['Happy', 'Derp', 'Angry', 'Cool', 'Shocked', 'Silly'],
      primary: 'Main color', secondary: 'Outfit / accent color', rand: 'Randomize',
      presets: ['Chicken', 'Luchador', 'Dino', 'Bear', 'Pirate Cat', 'Ninja', 'Hero', 'Hawaii Pig', 'Skeleton', 'Frog', 'Alien', 'Shark']
    }
  };
  const PRESETS = [
    { s: 1, c: 2, d: 0, o: 0, h: 0, f: 0 }, { s: 0, c: 6, d: 0, o: 4, h: 0, f: 0 }, { s: 3, c: 4, d: 2, o: 0, h: 0, f: 3 }, { s: 2, c: 12, d: 1, o: 2, h: 0, f: 0 },
    { s: 4, c: 1, d: 6, o: 5, h: 0, f: 2 }, { s: 5, c: 15, d: 0, o: 6, h: 0, f: 3 }, { s: 0, c: 0, d: 7, o: 8, h: 0, f: 0 }, { s: 7, c: 10, d: 0, o: 7, h: 11, f: 0 },
    { s: 0, c: 15, d: 11, o: 9, h: 0, f: 4 }, { s: 6, c: 3, d: 7, o: 2, h: 0, f: 0 }, { s: 9, c: 9, d: 4, o: 0, h: 8, f: 0 }, { s: 8, c: 14, d: 6, o: 1, h: 0, f: 0 }
  ];
  let tab = 'skins', thumbCache = {}, previewYaw = 0.5, dragging = false, lastDrag = 0;
  function saveLook() { LS.set('look', look); LS.set('name', myName); if (room) send({ t: 'look', look, name: myName }); }
  function setLook(patch) { look = Object.assign({}, look, patch); saveLook(); renderCust(); Sfx.play('click'); }
  function thumb(l, head) {
    const k = JSON.stringify(l) + (head ? 'h' : 'b');
    if (!thumbCache[k]) thumbCache[k] = R.previewTo(l, 84, head ? 84 : 100, head);
    const c = document.createElement('canvas'); c.width = 84; c.height = head ? 84 : 100; c.getContext('2d').drawImage(thumbCache[k], 0, 0); return c;
  }
  function optButton(label, l, on, click, head) {
    const b = document.createElement('button'); b.className = 'opt' + (on ? ' on' : ''); b.appendChild(thumb(l, head));
    const sp = document.createElement('span'); sp.textContent = label; b.appendChild(sp); b.onclick = click; return b;
  }
  function renderCust() {
    const C = CU[lang], tabs = $('custTabs'), box = $('custOpts');
    tabs.innerHTML = ''; box.innerHTML = '';
    for (const id of Object.keys(C.tabs)) { const b = document.createElement('button'); b.className = 'tab' + (id === tab ? ' on' : ''); b.textContent = C.tabs[id]; b.onclick = () => { tab = id; renderCust(); Sfx.play('click'); }; tabs.appendChild(b); }
    if (tab === 'skins') PRESETS.forEach((p, i) => box.appendChild(optButton(C.presets[i], p, JSON.stringify(p) === JSON.stringify(look), () => setLook(p))));
    else if (tab === 'species') C.species.forEach((n, i) => box.appendChild(optButton(n, Object.assign({}, look, { s: i }), look.s === i, () => setLook({ s: i }), true)));
    else if (tab === 'outfit') C.outfit.forEach((n, i) => box.appendChild(optButton(n, Object.assign({}, look, { o: i }), look.o === i, () => setLook({ o: i }))));
    else if (tab === 'hat') C.hat.forEach((n, i) => box.appendChild(optButton(n, Object.assign({}, look, { h: i }), look.h === i, () => setLook({ h: i }), true)));
    else if (tab === 'face') C.face.forEach((n, i) => box.appendChild(optButton(n, Object.assign({}, look, { f: i }), look.f === i, () => setLook({ f: i }), true)));
    else if (tab === 'colors') {
      for (const [key, label] of [['c', C.primary], ['d', C.secondary]]) {
        const h = document.createElement('div'); h.className = 'lbl'; h.textContent = label; box.appendChild(h);
        const row = document.createElement('div'); row.className = 'swatches';
        R.PAL.forEach((c, i) => { const d = document.createElement('div'); d.className = 'sw' + (i === look[key] ? ' on' : ''); d.style.background = c; d.onclick = () => setLook({ [key]: i }); row.appendChild(d); });
        box.appendChild(row);
      }
    }
    $('rand').textContent = '🎲 ' + C.rand;
  }
  $('rand').onclick = () => { look = { s: (Math.random() * R.SPECIES) | 0, c: (Math.random() * 16) | 0, d: (Math.random() * 16) | 0, o: (Math.random() * R.OUTFITS) | 0, h: (Math.random() * R.HAT_COUNT) | 0, f: (Math.random() * R.FACE_COUNT) | 0 }; saveLook(); renderCust(); Sfx.play('emote', 2); };
  $('name').oninput = e => { myName = e.target.value.slice(0, 14); LS.set('name', myName); };
  function pickLabels() { }
  (function () { // drag the preview to spin your character
    const pc = $('preview'); let sx = 0;
    pc.addEventListener('pointerdown', e => { dragging = true; sx = e.clientX; pc.setPointerCapture(e.pointerId); });
    pc.addEventListener('pointermove', e => { if (dragging) { previewYaw += (e.clientX - sx) * 0.02; sx = e.clientX; lastDrag = performance.now(); } });
    pc.addEventListener('pointerup', () => { dragging = false; });
  })();

  // ------------------------------------------------------------------ network
  let ws = null, meId = null, room = null, round = null, screen = 'menu';
  let offset = null, rtt = 0, lastInputSent = 0, lastIn = '', pendingPractice = false;
  const snaps = [];
  const send = o => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };

  function connect(cb) {
    if (ws && ws.readyState === 1) return cb();
    if (ws && ws.readyState === 0) return;
    setMsg(t('conn') + ' ...', true);
    try { ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host); } catch (e) { return setMsg(t('conn')); }
    ws.onopen = () => { setMsg(''); cb(); };
    ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } onMsg(m); };
    ws.onerror = () => setMsg(t('conn'));
    ws.onclose = () => { const was = room; ws = null; if (was) { toast(t('lost')); goMenu(); } };
  }
  function setMsg(s) { $('menuMsg').textContent = s || ''; }
  function toast(s) { const e = $('toast'); e.textContent = s; e.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove('show'), 2400); }

  function needName() { myName = ($('name').value || '').trim().slice(0, 14) || myName; $('name').value = myName; LS.set('name', myName); LS.set('look', look); }
  function doCreate(pub, practice) { Sfx.init(); needName(); pendingPractice = !!practice; connect(() => send({ t: 'create', pub, name: myName, look })); }
  $('btnCreate').onclick = () => doCreate($('pubChk').checked, false);
  $('btnPractice').onclick = () => doCreate(false, true);
  $('btnQuick').onclick = () => { Sfx.init(); needName(); connect(() => send({ t: 'quick', name: myName, look })); };
  function doJoin(code) { Sfx.init(); needName(); connect(() => send({ t: 'join', code, name: myName, look })); }
  $('btnJoin').onclick = () => { const c = $('code').value.trim().toUpperCase(); if (c.length < 4) return setMsg(t('noroom')); doJoin(c); };
  $('code').onkeydown = e => { if (e.key === 'Enter') $('btnJoin').click(); };

  function onMsg(m) {
    switch (m.t) {
      case 'joined':
        meId = m.id; Sfx.play('join');
        if (pendingPractice) { pendingPractice = false; send({ t: 'settings', bots: 3, mode: 'ffa' }); send({ t: 'start' }); }
        break;
      case 'room': {
        const first = !room; room = m; room.byId = {}; m.members.forEach(x => { room.byId[x.id] = x; });
        if (first) buildMaps();
        if (m.phase === 'lobby' && screen !== 'lobby') { screen = 'lobby'; updateScreens(); closeModal(); }
        else if (first && screen === 'menu') { screen = 'lobby'; updateScreens(); }
        renderLobby(); renderScore();
        break;
      }
      case 'round': startRoundView(m); break;
      case 's': onSnap(m); break;
      case 'roundend': onRoundEnd(m); break;
      case 'matchend': onMatchEnd(m); break;
      case 'chat': addChat(m); break;
      case 'toast': toast(t(m.k)); $('lobbyMsg').textContent = t(m.k); break;
      case 'err': setMsg(t(m.k)); toast(t(m.k)); break;
      case 'kicked': toast(t('kicked')); break;
      case 'pong': rtt = performance.now() - m.c; $('ping').textContent = Math.round(rtt) + 'ms'; break;
    }
  }
  setInterval(() => { if (room) send({ t: 'ping', c: performance.now() }); }, 2000);

  function goMenu() {
    room = null; round = null; meId = null; snaps.length = 0; screen = 'menu'; closeModal(); updateScreens();
    if (ws) { try { ws.close(); } catch (e) { } ws = null; }
    history.replaceState(null, '', location.pathname);
  }

  // ------------------------------------------------------------------ screens
  function updateScreens() {
    $('menu').classList.toggle('hidden', screen !== 'menu');
    $('lobby').classList.toggle('hidden', screen !== 'lobby');
    const g = screen === 'game';
    $('hud').classList.toggle('hidden', !g);
    $('touch').classList.toggle('hidden', !(g && isTouch()));
    document.body.classList.toggle('ingame', g);
    document.body.classList.toggle('touchmode', isTouch());
    Input.enabled = g; Input.reset(); Sfx.music(g && S.music);
    if (g) resize();
  }

  // ------------------------------------------------------------------ lobby
  const mapCanvases = {};
  function buildMaps() {
    const grid = $('mapGrid'); grid.innerHTML = '';
    const rnd = document.createElement('button'); rnd.className = 'mapbtn rand'; rnd.dataset.map = 'random';
    rnd.innerHTML = '🎲<span>' + t('random') + '</span>'; grid.appendChild(rnd);
    Maps.list.forEach(m => {
      const b = document.createElement('button'); b.className = 'mapbtn'; b.dataset.map = m.id;
      let c = mapCanvases[m.id];
      if (!c) { c = document.createElement('canvas'); c.width = 192; c.height = 120; drawMapThumb(c, m); mapCanvases[m.id] = c; }
      b.appendChild(c); const sp = document.createElement('span'); sp.textContent = m.emoji + ' ' + (lang === 'ar' ? m.ar : m.en); b.appendChild(sp); grid.appendChild(b);
    });
    grid.querySelectorAll('.mapbtn').forEach(b => b.onclick = () => { if (isHost()) { send({ t: 'settings', map: b.dataset.map }); Sfx.play('click'); } });
  }
  const isHost = () => room && room.host === meId;

  function renderLobby() {
    if (!room) return;
    $('roomCode').textContent = room.code;
    const host = isHost(), me = room.byId[meId];
    const box = $('players'); box.innerHTML = '';
    for (let i = 0; i < 8; i++) {
      const m = room.members[i], d = document.createElement('div');
      if (!m) { d.className = 'pcard empty'; d.innerHTML = '<div style="height:100px;display:flex;align-items:center;justify-content:center;font-size:26px">＋</div><div class="nm">&nbsp;</div>'; box.appendChild(d); continue; }
      d.className = 'pcard' + (m.ready || m.bot ? ' ready' : '') + (m.id === meId ? ' me' : '');
      const c = R.previewTo(m.look, 90, 104); d.appendChild(c);
      const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = m.name; d.appendChild(nm);
      const tag = document.createElement('div'); tag.className = 'tag'; tag.textContent = (m.id === room.host ? '👑' : '') + (m.bot ? '🤖' : '') + (m.ready && !m.bot && m.id !== room.host ? '✔' : ''); d.appendChild(tag);
      if (room.settings.mode === 'teams') { const tm = document.createElement('div'); tm.className = 'tm'; tm.style.background = R.TEAM[m.team]; d.appendChild(tm); }
      if (host && m.id !== meId) { const x = document.createElement('button'); x.className = 'x'; x.textContent = '✕'; x.onclick = () => send({ t: 'kick', id: m.id }); d.appendChild(x); }
      box.appendChild(d);
    }
    document.querySelectorAll('.mapbtn').forEach(b => b.classList.toggle('on', b.dataset.map === room.settings.map));
    document.querySelectorAll('#modeSeg button').forEach(b => b.classList.toggle('on', b.dataset.mode === room.settings.mode));
    document.querySelectorAll('#winsSeg button').forEach(b => b.classList.toggle('on', +b.dataset.wins === room.settings.wins));
    $('botCount').textContent = room.members.filter(x => x.bot).length;
    for (const id of ['mapGrid', 'modeSeg', 'winsSeg']) $(id).style.pointerEvents = host ? '' : 'none';
    $('botMinus').disabled = $('botPlus').disabled = !host;
    $('mapGrid').style.opacity = $('modeSeg').style.opacity = $('winsSeg').style.opacity = host ? 1 : 0.7;
    $('btnStart').classList.toggle('hidden', !host);
    $('btnReady').classList.toggle('hidden', host);
    $('btnTeam').classList.toggle('hidden', room.settings.mode !== 'teams');
    if (me) { $('btnReady').textContent = me.ready ? t('notReady') : t('ready'); $('btnReady').className = 'big ' + (me.ready ? 'orange' : 'yellow'); }
    $('lobbyMsg').textContent = host ? '' : t('waitHost');
  }
  document.querySelectorAll('#modeSeg button').forEach(b => b.onclick = () => send({ t: 'settings', mode: b.dataset.mode }));
  document.querySelectorAll('#winsSeg button').forEach(b => b.onclick = () => send({ t: 'settings', wins: +b.dataset.wins }));
  $('botMinus').onclick = () => send({ t: 'settings', bots: Math.max(0, room.settings.bots - 1) });
  $('botPlus').onclick = () => send({ t: 'settings', bots: Math.min(7, room.settings.bots + 1) });
  $('btnReady').onclick = () => { const me = room.byId[meId]; send({ t: 'ready', v: !me.ready }); Sfx.play('click'); };
  $('btnTeam').onclick = () => send({ t: 'team' });
  $('btnStart').onclick = () => { Sfx.init(); send({ t: 'start' }); };
  $('btnLeave').onclick = () => { send({ t: 'leave' }); goMenu(); };
  $('btnCopy').onclick = () => {
    const link = location.origin + '/?room=' + room.code;
    const done = () => toast(t('copied'));
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(done, () => prompt('', link)); else prompt('', link);
  };
  function addChat(m) {
    const d = document.createElement('div'); const b = document.createElement('b'); b.textContent = m.from + ': ';
    d.appendChild(b); d.appendChild(document.createTextNode(m.text)); const log = $('chatLog'); log.appendChild(d); log.scrollTop = 1e9;
    while (log.children.length > 40) log.removeChild(log.firstChild);
  }
  const sendChat = () => { const v = $('chatIn').value.trim(); if (v) send({ t: 'chat', text: v }); $('chatIn').value = ''; };
  $('chatSend').onclick = sendChat; $('chatIn').onkeydown = e => { if (e.key === 'Enter') sendChat(); };

  // ------------------------------------------------------------------ modals
  function openModal(html) { $('modalBody').innerHTML = html; $('modal').classList.remove('hidden'); }
  function closeModal() { $('modal').classList.add('hidden'); $('modalBody').innerHTML = ''; }
  $('modal').addEventListener('pointerdown', e => { if (e.target === $('modal') && !openModal.locked) closeModal(); });

  function settingsHtml(inGame) {
    return '<h2>⚙️ ' + t('settings') + '</h2>' +
      '<div class="optrow"><span>' + t('language') + '</span><select id="sLang"><option value="ar">العربية</option><option value="en">English</option></select></div>' +
      '<div class="optrow"><span>' + t('volume') + '</span><input type="range" id="sVol" min="0" max="1" step="0.05"></div>' +
      '<div class="optrow"><span>' + (lang === 'ar' ? 'الموسيقى' : 'Music') + '</span><input type="checkbox" id="sMusic" style="width:24px;height:24px"></div>' +
      '<div class="optrow"><span>' + t('quality') + '</span><select id="sQ"><option value="auto">' + t('qAuto') + '</option><option value="low">' + t('qLow') + '</option><option value="mid">' + t('qMid') + '</option><option value="high">' + t('qHigh') + '</option></select></div>' +
      '<div class="optrow"><span>' + t('touch') + '</span><select id="sT"><option value="auto">' + t('tAuto') + '</option><option value="on">' + t('tOn') + '</option><option value="off">' + t('tOff') + '</option></select></div>' +
      '<div class="row" style="margin-top:12px"><button class="big blue" id="sFs">⛶ ' + t('fullscreen') + '</button>' +
      (inGame ? '<button class="big red" id="sLeave">' + t('leaveRoom') + '</button>' : '') + '</div>' +
      '<div class="row" style="margin-top:10px"><button class="big green" id="sClose">' + (inGame ? t('resume') : t('close')) + '</button></div>';
  }
  function openSettings() {
    const inGame = screen === 'game';
    openModal(settingsHtml(inGame));
    $('sLang').value = lang; $('sVol').value = S.vol; $('sQ').value = S.quality; $('sT').value = S.touch;
    $('sLang').onchange = e => { lang = e.target.value; LS.set('lang', lang); applyLang(); openSettings(); };
    $('sVol').oninput = e => { S.vol = +e.target.value; LS.set('vol', S.vol); Sfx.setVolume(S.vol); Sfx.play('click'); };
    $('sQ').onchange = e => { S.quality = e.target.value; LS.set('quality', S.quality); R.setQuality(qLevel()); resize(); };
    $('sMusic').checked = S.music; $('sMusic').onchange = e => { S.music = e.target.checked; LS.set('music', S.music); Sfx.music(S.music && screen === 'game'); };
    $('sT').onchange = e => { S.touch = e.target.value; LS.set('touch', S.touch); updateScreens(); };
    $('sFs').onclick = () => { const d = document.documentElement; if (document.fullscreenElement) document.exitFullscreen(); else (d.requestFullscreen || d.webkitRequestFullscreen || (() => { })).call(d); };
    $('sClose').onclick = closeModal;
    if (inGame) $('sLeave').onclick = () => { send({ t: 'leave' }); goMenu(); };
  }
  $('btnSettings').onclick = $('btnSettings2').onclick = openSettings;
  $('btnMenu').onclick = openSettings;
  $('btnHelp').onclick = () => {
    const rows = a => a.map(r => '<b>' + r[0] + '</b><span>' + r[1] + '</span>').join('');
    openModal('<h2>🎮 ' + t('controls') + '</h2><h3>🖥️ ' + t('ctlPc') + '</h3><div class="ctl">' + rows(t('help')) + '</div><h3>📱 ' + t('ctlMobile') + '</h3><div class="ctl">' + rows(t('helpM')) + '</div>' +
      '<div class="row" style="margin-top:12px"><button class="big green" id="hClose">' + t('close') + '</button></div>');
    $('hClose').onclick = closeModal;
  };

  // ------------------------------------------------------------------ emotes
  const bubbles = {};
  Input.onEmote = n => { if (screen !== 'game' || n < 0 || n > 7) return; send({ t: 'emote', n }); };
  const eb = $('emotebar');
  EMOJIS.forEach((e, i) => { const b = document.createElement('button'); b.textContent = e; b.onpointerdown = ev => { ev.preventDefault(); Input.onEmote(i); eb.classList.remove('show'); }; eb.appendChild(b); });
  Input.onEmoteMenu = () => eb.classList.toggle('show');

  // ------------------------------------------------------------------ game view (3D)
  const cv = $('game');
  let map = null, anim = 0;
  let curPh = -1, lastCd = -1, scoreSig = '', focusId = null;
  R.init(cv, qLevel());
  R.createPreview($('preview'));

  function resize() {
    const q = qLevel();
    const dpr = Math.min(window.devicePixelRatio || 1, q === 0 ? 1 : q === 1 ? 1.5 : 2) * (q === 0 ? 0.7 : 1);
    R.resize(Math.max(2, window.innerWidth), Math.max(2, window.innerHeight), dpr);
  }
  window.addEventListener('resize', resize); window.addEventListener('orientationchange', () => setTimeout(resize, 200));

  function startRoundView(m) {
    round = m; focusId = null; map = Maps.byId(m.map); snaps.length = 0; curPh = -1; lastCd = -1; scoreSig = '';
    for (const k in bubbles) delete bubbles[k];
    screen = 'game'; updateScreens(); closeModal();
    R.loadMap(map); resize();
    showBanner(t('round') + ' ' + m.round + ' — ' + (lang === 'ar' ? map.ar : map.en) + ' ' + map.emoji, 2600);
    if (m.round === 1 && isTouch() === false) toast(t('tips')[(Math.random() * t('tips').length) | 0]);
  }
  function showBanner(s, ms) { const b = $('banner'); b.textContent = s; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); clearTimeout(showBanner.t); showBanner.t = setTimeout(() => { b.textContent = ''; }, ms || 2500); }
  function showBig(s) { const b = $('big'); b.textContent = s; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }

  function onSnap(s) {
    if (!round || s.rid !== round.rid) return;
    const now = performance.now(), sample = s.ts - now;
    if (offset === null || sample > offset) offset = sample; else offset += (sample - offset) * 0.02;
    s.map = {}; for (const a of s.pl) s.map[a[0]] = a;
    snaps.push(s); if (snaps.length > 40) snaps.shift();
  }

  function lerpAngle(a, b, k) { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * k; }
  function lerpFrame(rt) {
    if (!snaps.length) return null;
    let a = null, b = snaps[snaps.length - 1];
    for (let i = snaps.length - 1; i >= 0; i--) { if (snaps[i].ts <= rt) { a = snaps[i]; b = snaps[i + 1] || null; break; } }
    if (!a) { a = snaps[0]; b = null; }
    let k = 0;
    if (b) k = Math.min(1, (rt - a.ts) / Math.max(1, b.ts - a.ts)); else b = a;
    for (const s of snaps) { if (s.ts <= rt && !s.done) { s.done = true; for (const e of s.ev) onEvent(e); } }
    while (snaps.length > 3 && snaps[1].ts < rt - 400) snaps.shift();
    const list = [];
    for (const id in b.map) {
      const pb = b.map[id], pa = a.map[id] || pb, f = pb[1];
      const o = { id: +id, alive: f & 1, ko: !!(f & 2), punch: !!(f & 8), grab: !!(f & 16), hang: !!(f & 32), hand: f & 64 ? 1 : 0, stun: pb[2], yaw: lerpAngle(pa[3] / 100, pb[3] / 100, k), P: null };
      if (o.alive && pb.length >= 25) {
        const P = new Array(21), same = pa.length >= 25;
        for (let i = 0; i < 21; i++) P[i] = (same ? pa[4 + i] + (pb[4 + i] - pa[4 + i]) * k : pb[4 + i]) / 100;
        o.P = P;
      } else o.alive = 0;
      list.push(o);
    }
    return { gt: a.gt + (b.gt - a.gt) * k, list, ph: b.ph, cd: b.cd };
  }

  function memberInfo(id) { return (room && room.byId[id]) || { name: '?', look: { s: 0, c: 4, d: 6, o: 0, h: 0, f: 0 }, team: 0 }; }

  const HIT_WORDS = ['POW!', 'BONK!', 'WHAM!', 'OOF!', 'BAM!', 'SMACK!'];
  function onEvent(e) {
    const q = qLevel(), FX = R.FX;
    switch (e.e) {
      case 'punch': Sfx.play('punch'); break;
      case 'hit': FX.ring(e.x, e.y, e.z, e.p > 1 ? '#ff9f43' : '#ffffff', 1 + e.p * .45); Sfx.play('hit', e.p); FX.burst(e.x, e.y, e.z, q ? 10 : 5, ['#ffd93d', '#ffffff', '#ff9f43'], 6, .5, .2); FX.text(e.x, e.y + .8, e.z, e.p === 3 ? 'BOINK!' : HIT_WORDS[(Math.random() * HIT_WORDS.length) | 0], e.p > 1 ? '#ff9f43' : '#ffd93d', e.p > 1 ? 1.2 : .9); FX.shake = Math.max(FX.shake, e.p > 1 ? 2.2 : 1.2); break;
      case 'land': if (e.p > 9) { Sfx.play('bonk'); FX.ring(e.x, e.y + .05, e.z, '#ffffff', 1.3); } FX.dust(e.x, e.y, e.z, q ? 8 : 3); break;
      case 'step': if (q > 0 && Math.random() < .6) FX.dust(e.x, e.y, e.z, 1); break;
      case 'jump': Sfx.play('jump'); FX.dust(e.x, e.y, e.z, q ? 8 : 3); break;
      case 'bounce': Sfx.play('bounce'); FX.burst(e.x, e.y, e.z, q ? 12 : 5, ['#ff7ac8', '#fff'], 5, .5, .18); FX.text(e.x, e.y + 1, e.z, 'BOING!', '#ff7ac8', .9); break;
      case 'bonk': Sfx.play('bonk'); FX.text(e.x, e.y + .8, e.z, 'BONK!', '#fff', .8); FX.shake = Math.max(FX.shake, 1); break;
      case 'grab': Sfx.play('grab'); break;
      case 'throw': Sfx.play('throw'); FX.text(e.x, e.y + 1, e.z, 'YEET!', '#4da3ff', 1.2); break;
      case 'ko': FX.ring(e.x, e.y, e.z, '#ffd93d', 2.2); if (e.i === meId) flashVignette(); Sfx.play('ko'); FX.burst(e.x, e.y, e.z, q ? 14 : 6, ['#ffd93d', '#fff'], 6, .8, .2); FX.text(e.x, e.y + 1, e.z, ['K.O.!', 'NOOO!', 'OOF!'][(Math.random() * 3) | 0], '#ff5d73', 1.3); FX.shake = Math.max(FX.shake, 3); break;
      case 'up': Sfx.play('up'); break;
      case 'die': {
        Sfx.play('die', e.c); FX.shake = Math.max(FX.shake, 4);
        FX.text(e.x, e.y + 1, e.z, e.c === 'crush' ? 'SPLAT!' : e.c === 'lava' ? 'SIZZLE!' : ['AAAH!', 'WHOOOA!', 'NOOOO!', 'BYE!'][(Math.random() * 4) | 0], '#ff5d73', 1.5);
        FX.burst(e.x, e.y, e.z, q ? 26 : 10, e.c === 'lava' ? ['#ff7a1f', '#ffd04d'] : ['#fff', '#ffd93d', '#ff7ac8'], 9, 1, .25);
        break;
      }
      case 'emote': bubbles[e.i] = { text: EMOJIS[e.n] || '😂', until: performance.now() + 2000 }; Sfx.play('emote', e.n); break;
    }
  }

  function flashVignette() { const v = $('vignette'); v.classList.remove('flash'); void v.offsetWidth; v.classList.add('flash'); }
  function onRoundEnd(m) {
    focusId = m.winners && m.winners.length ? m.winners[0] : null;
    const names = m.winners.map(id => memberInfo(id).name);
    if (m.draw) showBanner(t('draw'), 3300);
    else showBanner(m.teamMode ? t('team') + ' ' + (m.team ? t('blue') : t('red')) + ' ' + t('wonRound') : names[0] + ' ' + t('wonRound'), 3300);
    if (!m.draw) { R.FX.confetti(qLevel() ? 90 : 40); Sfx.play(m.winners.includes(meId) ? 'win' : 'lose'); } else Sfx.play('lose');
    $('big').textContent = '';
  }
  function onMatchEnd(m) {
    const names = m.winners.map(id => memberInfo(id).name).join(' + ');
    R.FX.confetti(140); Sfx.play(m.winners.includes(meId) ? 'win' : 'lose');
    const rows = room.members.slice().sort((a, b) => b.wins - a.wins).map((x, i) => '<div class="optrow"><span>' + (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '') + ' ' + esc(x.name) + (x.bot ? ' 🤖' : '') + '</span><b>' + x.wins + ' ★</b></div>').join('');
    openModal('<div class="results"><div>' + t('champion') + '</div><div class="win">' + esc(names) + '</div>' + rows + '<div class="row" style="margin-top:10px">' + (isHost() ? '<button class="big green" id="rBack">' + t('backLobby') + '</button>' : '') + '</div></div>');
    openModal.locked = true;
    if ($('rBack')) $('rBack').onclick = () => send({ t: 'tolobby' });
    setTimeout(() => { openModal.locked = false; }, 8000);
  }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function renderScore(frame) {
    if (!room || !round) return;
    const alive = {}; if (frame) frame.list.forEach(p => { alive[p.id] = p.alive; });
    const sig = room.members.map(m => m.id + ':' + m.wins + ':' + (alive[m.id] ? 1 : 0)).join('|') + lang;
    if (sig === scoreSig) return; scoreSig = sig;
    const box = $('score'); box.innerHTML = '';
    room.members.forEach(m => {
      if (round.ids.indexOf(m.id) < 0) return;
      const c = document.createElement('div'); c.className = 'chip' + (frame && !alive[m.id] ? ' dead' : '') + (m.id === meId ? ' me' : '');
      const dot = document.createElement('i'); dot.style.background = round.teams ? R.TEAM[m.team] : R.PAL[m.look.c % 16];
      c.appendChild(dot); c.appendChild(document.createTextNode(m.name + (m.wins ? ' ' + '★'.repeat(Math.min(m.wins, 7)) : ''))); box.appendChild(c);
    });
  }

  function renderGame(dt, now) {
    anim += dt;
    const fr = lerpFrame(now + (offset || 0) - 110);
    R.render(fr, dt, now, memberInfo, { meId, teams: !!(round && round.teams), bubbles, focus: focusId });
    let meAlive = false;
    if (fr) {
      for (const p of fr.list) if (p.id === meId && p.alive) meAlive = true;
      if (fr.ph === 0 && fr.cd !== lastCd) { lastCd = fr.cd; if (fr.cd > 0) { showBig(fr.cd); Sfx.play('tick'); } }
      if (fr.ph !== curPh) { if (curPh === 0 && fr.ph === 1) { showBig(t('go')); Sfx.play('go'); setTimeout(() => { if ($('big').textContent === t('go')) $('big').textContent = ''; }, 800); } curPh = fr.ph; }
      renderScore(fr);
    }
    $('spectate').classList.toggle('hidden', !(fr && !meAlive && curPh !== 0 && curPh !== 2));
  }

  // map thumbnails for the lobby picker (top-down sketch)
  function drawMapThumb(c, m) {
    const x = c.getContext('2d'), w = c.width, h = c.height, g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, m.sky[0]); g.addColorStop(1, m.sky[1]); x.fillStyle = g; x.fillRect(0, 0, w, h);
    if (m.hazards) { x.fillStyle = '#ff6a1a'; x.fillRect(0, h * .55, w, h * .45); }
    const s = w / 40;
    const box = (b, col) => { x.fillStyle = col; x.strokeStyle = '#2a1b4e'; x.lineWidth = 2; const px = w / 2 + (b.x - b.w / 2) * s, py = h * .5 + (b.z - b.d / 2) * s * .8 - b.y * s * .5; x.fillRect(px, py, b.w * s, b.d * s * .8); x.strokeRect(px, py, b.w * s, b.d * s * .8); };
    const SC = { roof: '#8a817a', parapet: '#dbb890', ac: '#b4bccb', vent: '#9aa3b2', mat: '#b07a52', concrete: '#8f8a82', steel: '#7c3a30', wood: '#c99a5b', metal: '#6d7686', pot: '#c4683d', barrel: '#3d6fb5', tile: '#d9d6cc', track: '#4b463f', container: '#b8372e', container2: '#2f6fb5', deck: '#a9784a', rail: '#f2f2f2', rope: 'rgba(255,255,255,.0)' };
    for (const b of m.solids) box(b, b.crate ? '#d9a05b' : SC[b.style] || (b.type === 'ice' ? '#e8f8ff' : b.type === 'bounce' ? '#ff6cc0' : b.type === 'conv' ? '#6b6f95' : '#7bd36b'));
    for (const mv of m.movers || []) box({ x: (mv.ax + mv.bx) / 2, z: (mv.az + mv.bz) / 2, y: mv.ay, w: mv.w + Math.abs(mv.bx - mv.ax), d: mv.d + Math.abs(mv.bz - mv.az) }, 'rgba(255,210,31,.7)');
    for (const mv of m.movers || []) if (mv.kill) box({ x: (mv.ax + mv.bx) / 2, z: (mv.az + mv.bz) / 2, y: mv.ay, w: mv.kind === 'train' ? 30 : mv.w, d: mv.d, h: 1 }, 'rgba(230,57,70,.55)');
    if (m.bars) { x.strokeStyle = '#ffd21f'; x.lineWidth = 4; x.beginPath(); x.moveTo(w / 2 - 7 * s, h / 2); x.lineTo(w / 2 + 7 * s, h / 2); x.stroke(); }
    if (m.balls) { x.fillStyle = '#333'; for (const b of m.balls) { x.beginPath(); x.arc(w / 2 + b.px * s, h / 2 + b.pz * s * .8, 7, 0, 6.3); x.fill(); } }
  }

  // ------------------------------------------------------------------ main loop
  let last = performance.now(), emaDt = 1 / 60, lowTimer = 0, highTimer = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    emaDt += (dt - emaDt) * 0.05;
    if (screen === 'menu') {
      R.drawPreview(look, now / 1000, dragging || now - lastDrag < 1500 ? previewYaw : (previewYaw += dt * 0.6));
    } else if (screen === 'game') {
      // send input
      const inp = Input.poll(), str = inp.mx + ',' + inp.mz + ',' + inp.j + ',' + inp.p + ',' + inp.g;
      if (str !== lastIn || now - lastInputSent > 120) { lastIn = str; lastInputSent = now; send({ t: 'in', mx: inp.mx, mz: inp.mz, j: inp.j, p: inp.p, g: inp.g }); }
      renderGame(dt, now);
      // adaptive quality for weak devices
      if (S.quality === 'auto') {
        if (emaDt > 1 / 38) { lowTimer += dt; highTimer = 0; } else if (emaDt < 1 / 57) { highTimer += dt; lowTimer = 0; } else { lowTimer = highTimer = 0; }
        if (lowTimer > 2.5 && autoQ > 0) { autoQ--; lowTimer = 0; R.setQuality(autoQ); resize(); }
        if (highTimer > 12 && autoQ < 2) { autoQ++; highTimer = 0; R.setQuality(autoQ); resize(); }
      }
    }
  }

  // ------------------------------------------------------------------ boot
  window.addEventListener('pointerdown', () => Sfx.init(), { once: true });
  window.addEventListener('keydown', () => Sfx.init(), { once: true });
  renderCust(); applyLang(); resize(); updateScreens();
  requestAnimationFrame(frame);
  window.__bb = { get room() { return room; }, get round() { return round; }, send, get snaps() { return snaps; } };

  const urlRoom = new URLSearchParams(location.search).get('room');
  if (urlRoom) { $('code').value = urlRoom.toUpperCase().slice(0, 4); setTimeout(() => doJoin(urlRoom.toUpperCase().slice(0, 4)), 200); }
})();
