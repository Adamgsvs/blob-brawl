// The app: menus, costume editor, lobby, networking and the in-game view.
import * as R from './render.js';
import { STAGES, stageById } from '../shared/stages.js';
import { PALETTE, COSTUMES, HEADS, FACES, PRESETS, DEFAULT_LOOK, cleanLook } from '../shared/looks.js';
import { P } from '../shared/skeleton.js';

const $ = id => document.getElementById(id);
const LS = {
  get(k, d) { try { const v = localStorage.getItem('bb2_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('bb2_' + k, JSON.stringify(v)); } catch (e) { } }
};
const Sfx = window.Sfx, Input = window.Input;
const EMOJIS = ['😂', '😡', '👋', '💀', 'GG', '😭', '🔥', '🤡'];
const TEAM = ['#e2483d', '#3b82e0'];

// ============================================================================================ i18n
const TXT = {
  ar: {
    quick: 'لعب سريع', create: 'إنشاء غرفة', join: 'دخول', practice: 'تدريب مع بوتات', costume: 'الأزياء', controls: 'التحكمات', settings: 'الإعدادات',
    done: 'تم', random: 'عشوائي', dragHint: '↔ اسحب لتدوير الشخصية', leave: 'خروج', roomCode: 'رمز الغرفة', copyLink: 'نسخ الرابط',
    mode: 'النمط', melee: 'الكل ضد الكل', gang: 'فرق', winsNeeded: 'الفوز بعد', bots: 'بوتات', switchTeam: 'غيّر الفريق', ready: 'جاهز', start: 'ابدأ',
    spectating: 'بتتفرج لحد الجولة الجاية', rotate: '📱 لفّ الجوال بالعرض', bJump: 'نط', bPunch: 'لكمة', bGrab: 'مسك', bLift: 'رفع', bKick: 'ركلة', bButt: 'نطحة',
    noroom: 'الغرفة مش موجودة', full: 'الغرفة ممتلئة', conn: 'ما قدرت اتصل بالسيرفر', connecting: 'جاري الاتصال...', lost: 'انقطع الاتصال', need2: 'لازم لاعبين اثنين على الأقل — ضيف بوتات',
    kicked: 'انطردت من الغرفة', round: 'الجولة', wins: 'فاز!', draw: 'تعادل', champion: 'بطل المباراة', backLobby: 'رجوع للوبي', waitHost: 'بانتظار المضيف...',
    team: 'الفريق', red: 'الأحمر', blue: 'الأزرق', copied: 'انتسخ الرابط — ابعته لصحابك', chatPh: 'اكتب رسالة...', stageRandom: 'عشوائي',
    language: 'اللغة', volume: 'الصوت', music: 'الموسيقى', quality: 'الجودة', qAuto: 'تلقائي', qLow: 'خفيفة (أجهزة ضعيفة)', qMid: 'متوسطة', qHigh: 'عالية',
    camera: 'الكاميرا', camFollow: 'تتبعني', camGroup: 'الكل', touch: 'أزرار اللمس', tAuto: 'تلقائي', tOn: 'ظاهرة', tOff: 'مخفية', fullscreen: 'ملء الشاشة', resume: 'كمّل', close: 'إغلاق', leaveRoom: 'اترك الغرفة',
    tabs: { presets: 'شخصيات', body: 'لون الجسم', costume: 'الزي', color: 'لون الزي', head: 'الراس', face: 'الوجه' },
    pc: 'الكمبيوتر', mobile: 'الجوال', pad: 'يد التحكم',
    help: [['حركة', '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>'], ['قفز / جري (ضغط مطوّل)', '<kbd>Space</kbd>'], ['اليد اليسرى: ضغطة = لكمة، مطوّل = مسك', '<kbd>J</kbd> أو كليك يسار'], ['اليد اليمنى', '<kbd>K</kbd> أو كليك يمين'], ['رفع (وانت ماسك)', '<kbd>L</kbd> أو <kbd>Shift</kbd>'], ['ركلة (بالهوا = ركلة طائرة)', '<kbd>F</kbd>'], ['نطحة', '<kbd>H</kbd> أو <kbd>E</kbd>'], ['إيموجي', '<kbd>1</kbd>–<kbd>8</kbd>']],
    helpM: [['حركة', 'اسحب على يسار الشاشة'], ['لكمة', '👊 كل ضغطة يد'], ['مسك', '✋ اضغط مرة ليثبت، ومرة ليفلت'], ['رفع', '🙌 بعد المسك'], ['رمي', 'وانت رافع: افلت المسك ✋'], ['ركلة / نطحة / قفز', '🦵 💥 ⤒']],
    how: ['اضرب راس الخصم لحد ما يغمى عليه', 'امسكه بالإيدين وارفعه فوق راسك', 'امشي للحافة وافلته عشان ترميه', 'آخر واحد واقف بيفوز بالجولة'],
    howT: 'كيف تفوز', tipClimb: 'امسك الحافة واضغط قفز عشان تتسلق'
  },
  en: {
    quick: 'Quick play', create: 'Create room', join: 'Join', practice: 'Practice (bots)', costume: 'Costume', controls: 'Controls', settings: 'Settings',
    done: 'Done', random: 'Random', dragHint: '↔ drag to spin', leave: 'Leave', roomCode: 'Room code', copyLink: 'Copy link',
    mode: 'Mode', melee: 'Melee', gang: 'Gang', winsNeeded: 'Wins needed', bots: 'Bots', switchTeam: 'Switch team', ready: 'Ready', start: 'Start',
    spectating: 'Spectating until the next round', rotate: '📱 Rotate your phone', bJump: 'Jump', bPunch: 'Punch', bGrab: 'Grab', bLift: 'Lift', bKick: 'Kick', bButt: 'Butt',
    noroom: 'Room not found', full: 'Room is full', conn: 'Could not reach the server', connecting: 'Connecting...', lost: 'Connection lost', need2: 'Need at least 2 players — add bots',
    kicked: 'You were kicked', round: 'Round', wins: 'wins!', draw: 'Draw', champion: 'Champion', backLobby: 'Back to lobby', waitHost: 'Waiting for the host...',
    team: 'Team', red: 'Red', blue: 'Blue', copied: 'Link copied — send it to your friends', chatPh: 'Message...', stageRandom: 'Random',
    language: 'Language', volume: 'Volume', music: 'Music', quality: 'Quality', qAuto: 'Auto', qLow: 'Low (weak devices)', qMid: 'Medium', qHigh: 'High',
    camera: 'Camera', camFollow: 'Follow me', camGroup: 'Everyone', touch: 'Touch buttons', tAuto: 'Auto', tOn: 'Show', tOff: 'Hide', fullscreen: 'Fullscreen', resume: 'Resume', close: 'Close', leaveRoom: 'Leave room',
    tabs: { presets: 'Characters', body: 'Body colour', costume: 'Costume', color: 'Costume colour', head: 'Head', face: 'Face' },
    pc: 'Keyboard & mouse', mobile: 'Touch', pad: 'Gamepad',
    help: [['Move', '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>'], ['Jump / run (hold)', '<kbd>Space</kbd>'], ['Left hand: tap = punch, hold = grab', '<kbd>J</kbd> or left click'], ['Right hand', '<kbd>K</kbd> or right click'], ['Lift (while grabbing)', '<kbd>L</kbd> or <kbd>Shift</kbd>'], ['Kick (in the air = drop-kick)', '<kbd>F</kbd>'], ['Headbutt', '<kbd>H</kbd> or <kbd>E</kbd>'], ['Emotes', '<kbd>1</kbd>–<kbd>8</kbd>']],
    helpM: [['Move', 'drag on the left side'], ['Punch', '👊 each tap throws a hand'], ['Grab', '✋ tap to hold, tap again to let go'], ['Lift', '🙌 after grabbing'], ['Throw', 'while lifting: release ✋'], ['Kick / headbutt / jump', '🦵 💥 ⤒']],
    how: ['Punch heads until somebody is knocked out', 'Grab them with both hands and lift', 'Walk to the edge and let go to throw', 'Last one standing wins the round'],
    howT: 'How to win', tipClimb: 'Grab a ledge and press jump to climb'
  }
};
let lang = LS.get('lang', (navigator.language || 'ar').startsWith('ar') ? 'ar' : 'en');
const t = k => (TXT[lang][k] !== undefined ? TXT[lang][k] : k);
const nm = o => (lang === 'ar' ? o.ar : o.en);
function applyLang() {
  document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i]').forEach(e => { e.textContent = t(e.dataset.i); });
  $('chatIn').placeholder = t('chatPh');
  const kb = (w, k) => w + ' ' + k.split(' ').map(x => '<kbd>' + x + '</kbd>').join('');
  $('keys').innerHTML = [kb(lang === 'ar' ? 'حركة' : 'Move', 'WASD'), kb(t('bJump'), 'Space'), kb(t('bPunch') + ' / ' + t('bGrab'), 'J K'), kb(t('bLift'), 'L'), kb(t('bKick'), 'F'), kb(t('bButt'), 'H')].join(' &nbsp;·&nbsp; ');
  if (screen === 'costume') renderCostume(); if (room) { buildStages(); renderLobby(); }
}

// ============================================================================================ settings
const S = { vol: LS.get('vol', 0.7), music: LS.get('music', true), quality: LS.get('quality', 'auto'), touch: LS.get('touch', 'auto'), cam: LS.get('cam', 'follow') };
let autoQ = 1;
const qLevel = () => (S.quality === 'auto' ? autoQ : S.quality === 'low' ? 0 : S.quality === 'mid' ? 1 : 2);
const isTouch = () => (S.touch === 'on' ? true : S.touch === 'off' ? false : (window.matchMedia && matchMedia('(pointer:coarse)').matches) || 'ontouchstart' in window);
Sfx.setVolume(S.vol);

// ============================================================================================ identity
const NAMES = ['وحش', 'دبدوب', 'فرفوش', 'بطاطا', 'عنتر', 'شقفة', 'كعكة', 'تنّين'];
let myName = LS.get('name', NAMES[(Math.random() * NAMES.length) | 0] + ((Math.random() * 90 + 10) | 0));
let look = cleanLook(LS.get('look', DEFAULT_LOOK));
$('name').value = myName;
$('name').oninput = e => { myName = e.target.value.slice(0, 14); LS.set('name', myName); };

// ============================================================================================ renderer
const cv = $('game');
R.init(cv, qLevel());
function resize() {
  const q = qLevel(), dpr = Math.min(window.devicePixelRatio || 1, q === 0 ? 1 : q === 1 ? 1.5 : 2) * (q === 0 ? 0.75 : 1);
  R.resize(window.innerWidth, window.innerHeight, dpr);
}
window.addEventListener('resize', resize); window.addEventListener('orientationchange', () => setTimeout(resize, 250));
let sizeKey = '';

// ============================================================================================ network
let ws = null, meId = null, room = null, round = null, screen = 'menu', backTo = 'menu';
let offset = null, pendingPractice = false, lastSent = 0, lastIn = '';
const snaps = [], evq = [];
const send = o => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };
function setMsg(s) { $('menuMsg').textContent = s || ''; }
function toast(s) { const e = $('toast'); e.textContent = s; e.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove('show'), 2600); }

function connect(cb) {
  if (ws && ws.readyState === 1) return cb();
  if (ws && ws.readyState === 0) return;
  setMsg(t('connecting'));
  try { ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host); } catch (e) { return setMsg(t('conn')); }
  ws.binaryType = 'arraybuffer';
  ws.onopen = () => { setMsg(''); cb(); };
  ws.onmessage = ev => { if (typeof ev.data === 'string') { let m; try { m = JSON.parse(ev.data); } catch (e) { return; } onMsg(m); } else onSnap(ev.data); };
  ws.onerror = () => setMsg(t('conn'));
  ws.onclose = () => { const was = room; ws = null; if (was) { toast(t('lost')); goMenu(); } };
}
function onMsg(m) {
  switch (m.t) {
    case 'joined': meId = m.id; Sfx.play('join'); if (pendingPractice) { pendingPractice = false; send({ t: 'set', bots: 3, mode: 'melee' }); send({ t: 'start' }); } break;
    case 'room': {
      const first = !room; room = m; room.byId = {}; m.members.forEach(x => { room.byId[x.id] = x; });
      if (m.phase === 'lobby') round = null;
      if (first) buildStages();
      if (m.phase === 'lobby' && screen !== 'lobby' && screen !== 'costume') show('lobby');
      else if (first && screen === 'menu') show('lobby');
      else syncBeasts();
      renderLobby(); scoreSig = '';
      break;
    }
    case 'round': startRound(m); break;
    case 'ev': evq.push(m); break;
    case 'roundend': onRoundEnd(m); break;
    case 'matchend': onMatchEnd(m); break;
    case 'chat': addChat(m); break;
    case 'toast': toast(t(m.k)); $('lobbyMsg').textContent = t(m.k); break;
    case 'err': setMsg(t(m.k)); toast(t(m.k)); break;
    case 'kicked': toast(t('kicked')); break;
    case 'pong': $('ping').textContent = Math.round(performance.now() - m.c) + ' ms'; break;
  }
}
setInterval(() => { if (room) send({ t: 'ping', c: performance.now() }); }, 2000);
function goMenu() {
  room = null; round = null; meId = null; snaps.length = 0; evq.length = 0;
  if (ws) { try { ws.close(); } catch (e) { } ws = null; }
  closeModal(); show('menu'); history.replaceState(null, '', location.pathname);
}
function needName() { myName = ($('name').value || '').trim().slice(0, 14) || myName; $('name').value = myName; LS.set('name', myName); }
function enter(msg, practice) { Sfx.init(); needName(); pendingPractice = !!practice; connect(() => send(Object.assign({ name: myName, look }, msg))); }
$('btnQuick').onclick = () => enter({ t: 'quick' });
$('btnCreate').onclick = () => enter({ t: 'create', pub: false });
$('btnPractice').onclick = () => enter({ t: 'create', pub: false }, true);
$('btnJoin').onclick = () => { const c = $('code').value.trim().toUpperCase(); if (c.length < 4) return setMsg(t('noroom')); enter({ t: 'join', code: c }); };
$('code').onkeydown = e => { if (e.key === 'Enter') $('btnJoin').click(); };

// ============================================================================================ screens
let sceneKey = '';
function show(s) {
  screen = s;
  for (const id of ['menu', 'costume', 'lobby']) $(id).classList.toggle('hidden', s !== id);
  const g = s === 'game';
  $('hud').classList.toggle('hidden', !g); $('touch').classList.toggle('hidden', !(g && isTouch()));
  document.body.classList.toggle('ingame', g); document.body.classList.toggle('touchmode', isTouch());
  Input.enabled = g; Input.reset(); Sfx.music(g && S.music);
  $('vignette').className = '';
  if (!g && sceneKey !== 'backdrop') { R.showBackdrop(); sceneKey = 'backdrop'; }
  syncBeasts();
}
const tagColor = m => (round && round.gang) || (room && room.set.mode === 'gang' && screen === 'lobby') ? TEAM[m.team] : (m.id === meId ? '#ffe46b' : '#ffffff');
function syncBeasts() {
  if (screen === 'menu' || screen === 'costume') { R.keepBeasts(new Set([-1])); R.setBeast(-1, look, '', '#fff'); }
  else if (screen === 'lobby' && room) {
    R.keepBeasts(new Set(room.members.map(m => m.id)));
    for (const m of room.members) R.setBeast(m.id, m.look, (m.id === room.host ? '👑 ' : '') + m.name + (m.ready && !m.bot && m.id !== room.host ? ' ✔' : ''), tagColor(m));
  } else if (screen === 'game' && room && round) {
    R.keepBeasts(new Set(round.ids));
    for (const id of round.ids) { const m = room.byId[id]; if (m) R.setBeast(id, m.look, m.name, tagColor(m)); }
  }
}

// ============================================================================================ costume editor
let tab = 'presets', turn = 0.5, dragging = false, lastDrag = 0, thumbQueue = [], thumbTimer = null;
function queueThumb(img, l, kind) { thumbQueue.push([img, l, kind]); if (!thumbTimer) thumbTimer = setTimeout(pumpThumbs, 30); }
function pumpThumbs() {
  thumbTimer = null; const t0 = performance.now();
  while (thumbQueue.length && performance.now() - t0 < 24) { const [img, l, kind] = thumbQueue.shift(); if (img.isConnected) img.src = R.thumbBeast(l, 120, 132, kind); }
  if (thumbQueue.length) thumbTimer = setTimeout(pumpThumbs, 16);
}
function setLook(patch) { look = cleanLook(Object.assign({}, look, patch)); LS.set('look', look); R.setBeast(-1, look, '', '#fff'); renderCostume(); Sfx.play('click'); }
function cell(label, l, on, click, kind) {
  const b = document.createElement('button'); b.className = 'cell' + (on ? ' on' : '');
  const img = document.createElement('img'); img.alt = ''; b.appendChild(img); queueThumb(img, l, kind);
  const s = document.createElement('span'); s.textContent = label; b.appendChild(s); b.onclick = click; return b;
}
function swatches(key) {
  const row = document.createElement('div'); row.className = 'swatches';
  PALETTE.forEach((c, i) => { const d = document.createElement('button'); d.className = 'sw' + (look[key] === i ? ' on' : ''); d.style.background = c; d.onclick = () => setLook({ [key]: i }); row.appendChild(d); });
  return row;
}
function renderCostume() {
  const tabs = $('custTabs'), box = $('custOpts'); if (!tabs) return;
  thumbQueue.length = 0; tabs.innerHTML = ''; const keep = box.scrollTop; box.innerHTML = '';
  for (const id of Object.keys(t('tabs'))) { const b = document.createElement('button'); b.className = 'tab' + (id === tab ? ' on' : ''); b.textContent = t('tabs')[id]; b.onclick = () => { tab = id; renderCostume(); $('custOpts').scrollTop = 0; Sfx.play('click'); }; tabs.appendChild(b); }
  const same = (a, b) => a.c === b.c && a.k === b.k && a.kc === b.kc && a.h === b.h && a.f === b.f;
  if (tab === 'presets') PRESETS.forEach(p => box.appendChild(cell(nm(p), p.look, same(p.look, look), () => setLook(p.look), 'body')));
  else if (tab === 'body') box.appendChild(swatches('c'));
  else if (tab === 'color') box.appendChild(swatches('kc'));
  else if (tab === 'costume') COSTUMES.forEach((c, i) => box.appendChild(cell(nm(c), Object.assign({}, look, { k: i }), look.k === i, () => setLook({ k: i }), 'body')));
  else if (tab === 'head') HEADS.forEach((c, i) => box.appendChild(cell(nm(c), Object.assign({}, look, { h: i }), look.h === i, () => setLook({ h: i }), 'head')));
  else if (tab === 'face') FACES.forEach((c, i) => box.appendChild(cell(nm(c), Object.assign({}, look, { f: i }), look.f === i, () => setLook({ f: i }), 'head')));
  box.scrollTop = keep;
}
function openCostume() { backTo = screen; show('costume'); renderCostume(); Sfx.play('click'); }
$('btnCostume').onclick = openCostume; $('btnLobbyCostume').onclick = openCostume;
$('costDone').onclick = () => { if (room) send({ t: 'look', look, name: myName }); show(backTo === 'lobby' && room ? 'lobby' : 'menu'); };
$('custRand').onclick = () => { const r = n => (Math.random() * n) | 0; setLook({ c: r(16), k: r(COSTUMES.length), kc: r(16), h: Math.random() < 0.5 ? 0 : r(HEADS.length), f: Math.random() < 0.6 ? 0 : r(FACES.length) }); };
cv.addEventListener('pointerdown', e => { if (screen === 'menu' || screen === 'costume') { dragging = true; cv._x = e.clientX; } });
window.addEventListener('pointermove', e => { if (dragging) { turn += (e.clientX - cv._x) * 0.012; cv._x = e.clientX; lastDrag = performance.now(); } });
window.addEventListener('pointerup', () => { dragging = false; });

// ============================================================================================ lobby
const isHost = () => room && room.host === meId;
function buildStages() {
  const grid = $('stageGrid'); grid.innerHTML = '';
  const rnd = document.createElement('button'); rnd.className = 'stg rand'; rnd.dataset.stage = 'random'; rnd.innerHTML = '🎲<span>' + t('stageRandom') + '</span>'; grid.appendChild(rnd);
  const imgs = [];
  for (const s of STAGES) {
    const b = document.createElement('button'); b.className = 'stg'; b.dataset.stage = s.id;
    const img = document.createElement('img'); img.alt = ''; b.appendChild(img); imgs.push([img, s.id]);
    const sp = document.createElement('span'); sp.textContent = nm(s.name); b.appendChild(sp); grid.appendChild(b);
  }
  grid.querySelectorAll('.stg').forEach(b => { b.onclick = () => { if (isHost()) { send({ t: 'set', stage: b.dataset.stage }); Sfx.play('click'); } }; });
  const pump = () => { const n = imgs.shift(); if (!n) return; if (n[0].isConnected) n[0].src = R.thumbStage(n[1], 192, 132); setTimeout(pump, 30); };
  setTimeout(pump, 60);
}
function renderLobby() {
  if (!room) return;
  $('roomCode').textContent = room.code;
  const host = isHost(), me = room.byId[meId];
  document.querySelectorAll('.stg').forEach(b => b.classList.toggle('on', b.dataset.stage === room.set.stage));
  document.querySelectorAll('#modeSeg button').forEach(b => b.classList.toggle('on', b.dataset.mode === room.set.mode));
  document.querySelectorAll('#winsSeg button').forEach(b => b.classList.toggle('on', +b.dataset.wins === room.set.wins));
  $('botCount').textContent = room.members.filter(x => x.bot).length;
  for (const id of ['stageGrid', 'modeSeg', 'winsSeg']) $(id).classList.toggle('locked', !host);
  $('botMinus').parentElement.classList.toggle('locked', !host);
  $('btnStart').classList.toggle('hidden', !host); $('btnReady').classList.toggle('hidden', host);
  $('btnTeam').classList.toggle('hidden', room.set.mode !== 'gang');
  if (me) $('btnReady').classList.toggle('on', me.ready);
  $('lobbyMsg').textContent = host ? '' : t('waitHost');
}
document.querySelectorAll('#modeSeg button').forEach(b => { b.onclick = () => send({ t: 'set', mode: b.dataset.mode }); });
document.querySelectorAll('#winsSeg button').forEach(b => { b.onclick = () => send({ t: 'set', wins: +b.dataset.wins }); });
$('botMinus').onclick = () => send({ t: 'set', bots: Math.max(0, room.set.bots - 1) });
$('botPlus').onclick = () => send({ t: 'set', bots: Math.min(7, room.set.bots + 1) });
$('btnReady').onclick = () => { const me = room.byId[meId]; send({ t: 'ready', v: !me.ready }); Sfx.play('click'); };
$('btnTeam').onclick = () => send({ t: 'team' });
$('btnStart').onclick = () => { Sfx.init(); send({ t: 'start' }); };
$('btnLeave').onclick = () => { send({ t: 'leave' }); goMenu(); };
$('btnCopy').onclick = () => { const link = location.origin + '/?room=' + room.code; const ok = () => toast(t('copied')); if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(ok, () => prompt('', link)); else prompt('', link); };
function addChat(m) { const d = document.createElement('div'), b = document.createElement('b'); b.textContent = m.from + ': '; d.appendChild(b); d.appendChild(document.createTextNode(m.text)); const log = $('chatLog'); log.appendChild(d); log.scrollTop = 1e9; while (log.children.length > 40) log.removeChild(log.firstChild); }
const sendChat = () => { const v = $('chatIn').value.trim(); if (v) send({ t: 'chat', text: v }); $('chatIn').value = ''; };
$('chatSend').onclick = sendChat; $('chatIn').onkeydown = e => { if (e.key === 'Enter') sendChat(); };

// ============================================================================================ modals
function openModal(html) { $('modalBody').innerHTML = html; $('modal').classList.remove('hidden'); }
function closeModal() { $('modal').classList.add('hidden'); $('modalBody').innerHTML = ''; openModal.locked = false; }
$('modal').addEventListener('pointerdown', e => { if (e.target === $('modal') && !openModal.locked) closeModal(); });
function openSettings() {
  const g = screen === 'game', sel = (id, opts) => '<select id="' + id + '">' + opts.map(o => '<option value="' + o[0] + '">' + o[1] + '</option>').join('') + '</select>';
  openModal('<h2>' + t('settings') + '</h2>' +
    '<div class="opt"><span>' + t('language') + '</span>' + sel('sLang', [['ar', 'العربية'], ['en', 'English']]) + '</div>' +
    '<div class="opt"><span>' + t('volume') + '</span><input type="range" id="sVol" min="0" max="1" step="0.05"></div>' +
    '<div class="opt"><span>' + t('music') + '</span><input type="checkbox" id="sMusic" style="width:24px;height:24px"></div>' +
    '<div class="opt"><span>' + t('quality') + '</span>' + sel('sQ', [['auto', t('qAuto')], ['low', t('qLow')], ['mid', t('qMid')], ['high', t('qHigh')]]) + '</div>' +
    '<div class="opt"><span>' + t('camera') + '</span>' + sel('sCam', [['follow', t('camFollow')], ['group', t('camGroup')]]) + '</div>' +
    '<div class="opt"><span>' + t('touch') + '</span>' + sel('sT', [['auto', t('tAuto')], ['on', t('tOn')], ['off', t('tOff')]]) + '</div>' +
    '<div class="row"><button class="pill" id="sFs">⛶ ' + t('fullscreen') + '</button>' + (room ? '<button class="pill" id="sLeave">✕ ' + t('leaveRoom') + '</button>' : '') + '</div>' +
    '<div class="row"><button class="go" id="sClose">' + (g ? t('resume') : t('close')) + '</button></div>');
  $('sLang').value = lang; $('sVol').value = S.vol; $('sMusic').checked = S.music; $('sQ').value = S.quality; $('sCam').value = S.cam; $('sT').value = S.touch;
  $('sLang').onchange = e => { lang = e.target.value; LS.set('lang', lang); applyLang(); openSettings(); };
  $('sVol').oninput = e => { S.vol = +e.target.value; LS.set('vol', S.vol); Sfx.setVolume(S.vol); Sfx.play('click'); };
  $('sMusic').onchange = e => { S.music = e.target.checked; LS.set('music', S.music); Sfx.music(S.music && screen === 'game'); };
  $('sQ').onchange = e => { S.quality = e.target.value; LS.set('quality', S.quality); R.setQuality(qLevel()); resize(); };
  $('sCam').onchange = e => { S.cam = e.target.value; LS.set('cam', S.cam); };
  $('sT').onchange = e => { S.touch = e.target.value; LS.set('touch', S.touch); show(screen); };
  $('sFs').onclick = () => { const d = document.documentElement; if (document.fullscreenElement) document.exitFullscreen(); else (d.requestFullscreen || d.webkitRequestFullscreen || (() => { })).call(d); };
  $('sClose').onclick = closeModal;
  if (room) $('sLeave').onclick = () => { send({ t: 'leave' }); goMenu(); };
}
$('btnSettings').onclick = openSettings; $('btnMenu').onclick = openSettings;
$('btnHelp').onclick = () => {
  const rows = a => a.map(r => '<b>' + r[0] + '</b><span>' + r[1] + '</span>').join('');
  openModal('<h2>' + t('controls') + '</h2><h3>' + t('howT') + '</h3><div>' + t('how').map((s, i) => (i + 1) + '. ' + s).join('<br>') + '<br>💡 ' + t('tipClimb') + '</div>' +
    '<h3>🖥️ ' + t('pc') + '</h3><div class="ctl">' + rows(t('help')) + '</div><h3>📱 ' + t('mobile') + '</h3><div class="ctl">' + rows(t('helpM')) + '</div>' +
    '<h3>🎮 ' + t('pad') + '</h3><div>A ' + t('bJump') + ' · LB/RB ' + t('bGrab') + ' · Y ' + t('bLift') + ' · X ' + t('bKick') + ' · B ' + t('bButt') + '</div>' +
    '<div class="row"><button class="go" id="hClose">' + t('close') + '</button></div>');
  $('hClose').onclick = closeModal;
};
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ============================================================================================ emotes
const eb = $('emotebar');
Input.onEmote = n => { if (screen === 'game') send({ t: 'emote', n }); };
EMOJIS.forEach((e, i) => { const b = document.createElement('button'); b.textContent = e; b.onpointerdown = ev => { ev.preventDefault(); Input.onEmote(i); eb.classList.remove('show'); }; eb.appendChild(b); });
$('btnEmote').onclick = () => eb.classList.toggle('show');

// ============================================================================================ game
let stage = null, curPh = -1, lastCd = -1, scoreSig = '', focusId = null, lastGT = 0, lastBrk = 0, keysT = 0, windT = 0;
const INTERP = 100, pose = new Map();
function startRound(m) {
  round = m; stage = stageById(m.stage); snaps.length = 0; evq.length = 0; curPh = -1; lastCd = -1; scoreSig = ''; focusId = null; lastBrk = 0;
  R.showStage(m.stage); sceneKey = m.stage;
  pose.clear(); show('game'); closeModal(); resize();
  for (const id of m.ids) R.poseBeast(id, tmp, { hide: true });
  banner(t('round') + ' ' + m.round + ' — ' + nm(stage.name), 2600);
  $('big').textContent = '';
  if (m.round === 1) { keysT = 12; $('keys').style.display = ''; }
}
function banner(s, ms) { const b = $('banner'); b.textContent = s; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); clearTimeout(banner.t); banner.t = setTimeout(() => { b.textContent = ''; }, ms || 2500); }
function big(s) { const b = $('big'); b.textContent = s; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }

function onSnap(buf) {
  const dv = new DataView(buf); if (dv.getUint8(0) !== 1 || !round) return;
  const s = { ph: dv.getUint8(1), rid: dv.getUint16(2, true), ts: dv.getUint32(4, true), gt: dv.getFloat32(8, true), cd: dv.getUint8(12), brk: dv.getUint16(14, true), b: new Map() };
  if (s.rid !== round.rid) return;
  const n = dv.getUint8(13); let o = 16;
  for (let i = 0; i < n; i++) {
    const id = dv.getUint16(o, true), f = dv.getUint8(o + 2); o += 4; let Pp = null;
    if (f & 1) { Pp = new Float32Array(42); for (let k = 0; k < 42; k++) Pp[k] = dv.getInt16(o + k * 2, true) / 100; o += 84; }
    s.b.set(id, { f, P: Pp });
  }
  const now = performance.now(), sample = s.ts - now;
  if (offset === null || sample > offset || Math.abs(sample - offset) > 2000) offset = sample; else offset += (sample - offset) * 0.02;
  snaps.push(s); if (snaps.length > 40) snaps.shift();
}

// interpolated state of the world at render time rt
function sample(rt) {
  if (!snaps.length) return null;
  let a = null, b = null;
  for (let i = snaps.length - 1; i >= 0; i--) if (snaps[i].ts <= rt) { a = snaps[i]; b = snaps[i + 1] || null; break; }
  if (!a) { a = snaps[0]; b = null; }
  const k = b ? Math.min(1, (rt - a.ts) / Math.max(1, b.ts - a.ts)) : 0; if (!b) b = a;
  while (snaps.length > 3 && snaps[1].ts < rt - 400) snaps.shift();
  for (const [id, pb] of b.b) {
    let o = pose.get(id); if (!o) { o = { P: new Float32Array(42), alive: false, ko: false }; pose.set(id, o); }
    const pa = a.b.get(id);
    o.alive = !!(pb.f & 1) && !!pb.P; o.ko = !!(pb.f & 2);
    if (o.alive) { const A = pa && pa.P ? pa.P : pb.P, B = pb.P; for (let i = 0; i < 42; i++) o.P[i] = A[i] + (B[i] - A[i]) * k; }
  }
  return { gt: a.gt + (b.gt - a.gt) * k, ph: b.ph, cd: b.cd, brk: b.brk };
}

function onEvent(e) {
  const q = qLevel(), FX = R.FX;
  switch (e.e) {
    case 'swing': Sfx.play('swing'); break;
    case 'hit': FX.impact(e.x, e.y, e.z, e.p); Sfx.play('hit', e.p); break;
    case 'bonk': FX.impact(e.x, e.y, e.z, 1); Sfx.play('bonk'); break;
    case 'ko': Sfx.play('ko'); FX.puff(e.x, e.y + 0.2, e.z, q ? 5 : 2, '#ffffff', 1.2, 0.5, 0.07); break;
    case 'wake': Sfx.play('wake'); break;
    case 'jump': Sfx.play('jump'); FX.dust(e.x, e.y, e.z, q ? 5 : 2); break;
    case 'land': Sfx.play('land', e.p); FX.dust(e.x, e.y, e.z, q ? 7 : 3); break;
    case 'step': if (q > 1 && Math.random() < 0.4) FX.dust(e.x, e.y, e.z, 1); break;
    case 'grab': Sfx.play('grab'); break;
    case 'throw': Sfx.play('throw'); break;
    case 'emote': R.emote(e.i, EMOJIS[e.n] || '😂'); Sfx.play('emote', e.n); break;
    case 'break': { const glass = stage.breakables[e.n].m === 'glass'; Sfx.play(glass ? 'glass' : 'wood'); FX.shards(e.x, e.y, e.z, stage.breakables[e.n].w, stage.breakables[e.n].d, glass ? '#cfeefa' : '#c79a62', q ? 26 : 10); break; }
    case 'die': {
      if (e.c === 'train') { Sfx.play('crash'); FX.impact(e.x, e.y, e.z, 3); FX.burst(e.x, e.y, e.z, q ? 16 : 6, ['#ffffff', '#e9e4d4'], 8, 0.8, 0.12); }
      else if (e.c === 'grind') { Sfx.play('grind'); FX.burst(e.x, -0.6, e.z, q ? 26 : 10, ['#d9534f', '#f0a0a0', '#b9433f'], 6, 1, 0.14); }
      else if (e.c === 'fire') { Sfx.play('fire'); FX.burst(e.x, e.y, e.z, q ? 24 : 9, ['#ff7a1f', '#ffd04d', '#ff4a1f'], 5, 0.9, 0.16, -3); }
      else if (e.c === 'fall') {
        Sfx.play('fall');
        if (stage.id === 'containers') { Sfx.play('splash'); FX.burst(e.x, -4.4, e.z, q ? 26 : 10, ['#ffffff', '#bfe2f5', '#69aed9'], 6, 0.9, 0.16); }
        else if (stage.id === 'trucks') FX.puff(e.x, -2.9, e.z, q ? 12 : 5, '#e9dcc0', 3, 0.7, 0.2);
      }
      break;
    }
  }
}
function onRoundEnd(m) {
  focusId = m.winners && m.winners.length ? m.winners[0] : null;
  const me = m.winners.includes(meId);
  if (m.draw) { banner(t('draw'), 3600); Sfx.play('lose'); }
  else { const w = room.byId[m.winners[0]]; banner((m.gang ? t('team') + ' ' + (m.team ? t('blue') : t('red')) : (w ? w.name : '')) + ' ' + t('wins'), 3800); Sfx.play(me ? 'win' : 'lose'); confettiAt = performance.now(); }
  $('big').textContent = '';
}
let confettiAt = 0;
function onMatchEnd(m) {
  const names = m.gang ? t('team') + ' ' + (m.team ? t('blue') : t('red')) : m.winners.map(id => room.byId[id] ? room.byId[id].name : '').join(' + ');
  Sfx.play(m.winners.includes(meId) ? 'win' : 'lose'); confettiAt = performance.now();
  const list = room.members.slice().sort((a, b) => b.wins - a.wins).map((x, i) => '<div class="line"><span>' + (['🥇', '🥈', '🥉'][i] || '&nbsp;&nbsp;&nbsp;') + ' ' + esc(x.name) + (x.bot ? ' 🤖' : '') + '</span><b>' + x.wins + '</b></div>').join('');
  openModal('<div class="results"><div>' + t('champion') + '</div><div class="win">' + esc(names) + '</div>' + list + (isHost() ? '<div class="row"><button class="go" id="rBack">' + t('backLobby') + '</button></div>' : '') + '</div>');
  openModal.locked = true; setTimeout(() => { openModal.locked = false; }, 9000);
  if ($('rBack')) $('rBack').onclick = () => send({ t: 'tolobby' });
}
function renderScore() {
  if (!room || !round) return;
  const sig = round.ids.map(id => { const m = room.byId[id], p = pose.get(id); return id + ':' + (m ? m.wins : 0) + ':' + (p && p.alive ? 1 : 0); }).join('|');
  if (sig === scoreSig) return; scoreSig = sig;
  const box = $('score'); box.innerHTML = '';
  for (const id of round.ids) {
    const m = room.byId[id]; if (!m) continue; const p = pose.get(id);
    const d = document.createElement('div'); d.className = 'dot' + (p && !p.alive ? ' dead' : '') + (id === meId ? ' me' : '');
    d.style.background = round.gang ? TEAM[m.team] : PALETTE[m.look.c]; d.textContent = m.wins || ''; d.title = m.name; box.appendChild(d);
  }
}

const box6 = [0, 0, 0, 0, 0, 0];
function gameFrame(dt, now) {
  // input
  const inp = Input.poll(), key = inp.x + ',' + inp.z + ',' + inp.b;
  if (key !== lastIn || now - lastSent > 150) { lastIn = key; lastSent = now; send({ t: 'in', x: inp.x, z: inp.z, b: inp.b }); }
  const rt = now + (offset || 0) - INTERP, fr = sample(rt);
  while (evq.length && evq[0].ts <= rt) { for (const e of evq.shift().l) onEvent(e); }
  let view = { mode: 'group', box: null }, meAlive = false, mePose = null, n = 0;
  box6[0] = box6[2] = box6[4] = 1e9; box6[1] = box6[3] = box6[5] = -1e9;
  if (fr) {
    for (const id of round.ids) {
      const p = pose.get(id); if (!p) continue;
      R.poseBeast(id, p.P, { ko: p.ko, hide: !p.alive });
      if (!p.alive) continue;
      n++; for (let i = 0; i < 42; i += 3) { box6[0] = Math.min(box6[0], p.P[i]); box6[1] = Math.max(box6[1], p.P[i]); box6[2] = Math.min(box6[2], p.P[i + 1]); box6[3] = Math.max(box6[3], p.P[i + 1]); box6[4] = Math.min(box6[4], p.P[i + 2]); box6[5] = Math.max(box6[5], p.P[i + 2]); }
      if (id === meId) { meAlive = true; mePose = p; }
    }
    const fp = fr.ph >= 2 && focusId != null ? pose.get(focusId) : null;
    if (fp && fp.alive) view = { mode: 'follow', x: fp.P[3], y: fp.P[4], z: fp.P[5], zoom: 0.72 };
    else if (meAlive && S.cam === 'follow') view = { mode: 'follow', x: mePose.P[3], y: mePose.P[4], z: mePose.P[5] };
    else if (n) view = { mode: 'group', box: box6 };
    lastGT = fr.gt; lastBrk = fr.brk;
    if (fr.ph === 0 && fr.cd !== lastCd) { lastCd = fr.cd; if (fr.cd > 0 && fr.cd <= 3) { big(fr.cd); Sfx.play('tick'); } }
    if (fr.ph !== curPh) { if (curPh === 0 && fr.ph === 1) { $('big').textContent = ''; Sfx.play('go'); } curPh = fr.ph; }
    $('vignette').className = meAlive && mePose.ko ? 'on' : 'off';
    renderScore();
    // wind streaks on the blimp
    if (stage.winds) { const dyn = R.stageDyn(); windT -= dt; if (dyn && windT <= 0) { windT = 0.03; stage.winds.forEach((w, i) => { if (dyn.winds[i]) R.FX.add((Math.random() - 0.5) * 20, 0.3 + Math.random() * 3, -Math.sign(w.acc[2]) * (4 + Math.random() * 4), 0, 0, Math.sign(w.acc[2]) * 26, 0.35, 0.05, '#ffffff', 0, { scale: [0.03, 0.03, 1.4], nofade: true }); }); } }
    if (confettiAt && now - confettiAt < 1500 && Math.random() < 0.5) R.FX.confetti(view.x || 0, view.y || 0, view.z || 0, 6);
  }
  const cues = R.draw(dt, now, lastGT, lastBrk, view);
  if (cues) for (const c of cues) Sfx.play(c);
  $('spectate').classList.toggle('hidden', !(fr && !meAlive && curPh === 1));
  if (keysT > 0) { keysT -= dt; if (keysT <= 0) $('keys').style.display = 'none'; }
}

// ============================================================================================ main loop
let last = performance.now(), ema = 1 / 60, slowT = 0, fastT = 0;
const tmp = new Float32Array(42);
function loop(now) { requestAnimationFrame(loop); frame(now); }
function frame(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000)); last = now; ema += (dt - ema) * 0.05;
  const sk = window.innerWidth + 'x' + window.innerHeight; if (sk !== sizeKey) { sizeKey = sk; resize(); }
  const tt = now / 1000, portrait = window.innerHeight > window.innerWidth * 1.05, side = document.documentElement.dir === 'rtl' ? 1 : -1;
  if (screen === 'game' && round) gameFrame(dt, now);
  else if (screen === 'lobby' && room) {
    const n = room.members.length;
    room.members.forEach((m, i) => { const u = i - (n - 1) / 2; R.poseBeast(m.id, R.idlePose(tmp, u * 1.15, -Math.abs(u) * 0.12, -u * 0.09, tt, m.id), { ko: false }); });
    R.draw(dt, now, 0, 0, { mode: 'fixed', x: 0, y: portrait ? -0.2 : 0.05, z: 0, d: (portrait ? 9 : 6.2) + n * 0.55, pitch: 0.2 });
  } else {
    if (!dragging && now - lastDrag > 1800) turn += dt * (screen === 'costume' ? 0.5 : 0.25);
    R.poseBeast(-1, R.idlePose(tmp, 0, 0, turn, tt, 1), { ko: false, tag: false });
    const wide = screen === 'costume' ? 1.75 : 1.45;
    R.draw(dt, now, 0, 0, { mode: 'fixed', x: portrait ? 0 : side * wide * 0.82, y: portrait ? 0.2 : 0.9, z: 0, d: portrait ? 7 : 4.7, pitch: 0.1 });
  }
  if (S.quality === 'auto' && screen === 'game') {            // weak device? drop the quality; fast one? raise it
    if (ema > 1 / 38) { slowT += dt; fastT = 0; } else if (ema < 1 / 57) { fastT += dt; slowT = 0; } else slowT = fastT = 0;
    if (slowT > 2.5 && autoQ > 0) { autoQ--; slowT = 0; R.setQuality(autoQ); resize(); syncBeasts(); }
    if (fastT > 14 && autoQ < 2) { autoQ++; fastT = 0; R.setQuality(autoQ); resize(); syncBeasts(); }
  }
}

// ============================================================================================ boot
window.addEventListener('pointerdown', () => Sfx.init(), { once: true });
window.addEventListener('keydown', () => Sfx.init(), { once: true });
applyLang(); show('menu'); resize();
requestAnimationFrame(loop);
window.__bb = { R, send, get room() { return room; }, get round() { return round; }, get pose() { return pose; }, get screen() { return screen; }, step: (n) => { for (let i = 0; i < (n || 1); i++) frame(performance.now()); } };
const urlRoom = new URLSearchParams(location.search).get('room');
if (urlRoom) { $('code').value = urlRoom.toUpperCase().slice(0, 4); setTimeout(() => enter({ t: 'join', code: urlRoom.toUpperCase().slice(0, 4) }), 300); }
