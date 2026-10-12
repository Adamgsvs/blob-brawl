'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { WebSocketServer } = require('ws');
const Maps = require('./public/maps.js');
const { Game, DT } = require('./sim.js');

const PORT = +process.env.PORT || 3000;
const PUB = path.join(__dirname, 'public');
const MAX_MEMBERS = 8;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json'
};

// ---------------------------------------------------------------- http (static files)
const server = http.createServer((req, res) => {
  let url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/') url = '/index.html';
  if (url === '/health') { res.writeHead(200); return res.end('ok'); }
  let file = path.normalize(path.join(PUB, url));
  if (url === '/three.module.js') file = path.join(__dirname, 'node_modules', 'three', 'build', 'three.module.js');
  else if (!file.startsWith(PUB)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

// ---------------------------------------------------------------- helpers
const wss = new WebSocketServer({ server, maxPayload: 4096 });
const rooms = new Map();
let nextId = 1;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const cleanName = s => String(s || '').replace(/[<>&"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 14);
const BOT_NAMES = ['بطّة', 'كعكة', 'زلبحة', 'فستقة', 'شاورما', 'بسبوسة', 'دبّوس', 'طنجرة', 'فلافل', 'ملوخية'];
function cleanLook(l) {
  l = l || {};
  return { s: clamp(l.s | 0, 0, 9), c: clamp(l.c | 0, 0, 15), d: clamp(l.d | 0, 0, 15), o: clamp(l.o | 0, 0, 9), h: clamp(l.h | 0, 0, 11), f: clamp(l.f | 0, 0, 5) };
}
function newCode() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  for (;;) {
    let c = ''; for (let i = 0; i < 4; i++) c += abc[(Math.random() * abc.length) | 0];
    if (!rooms.has(c)) return c;
  }
}
const send = (ws, o) => { if (ws.readyState === 1) ws.send(JSON.stringify(o)); };

// ---------------------------------------------------------------- room
class Room {
  constructor(code, pub) {
    this.code = code; this.pub = pub;
    this.members = []; // {id,name,look,ready,team,bot,wins,ws}
    this.hostId = null;
    this.settings = { map: 'random', mode: 'ffa', wins: 3, bots: 0 };
    this.phase = 'lobby'; // lobby | countdown | playing | roundEnd | matchEnd
    this.game = null; this.rid = 0; this.timer = 0; this.endTimer = 0; this.lastMap = null;
    this.chat = []; this.roundMsg = null; this.steps = 0;
    this.createdAt = Date.now();
  }
  get humans() { return this.members.filter(m => !m.bot); }

  broadcast(o, except) {
    const s = JSON.stringify(o);
    for (const m of this.members) if (!m.bot && m.ws !== except && m.ws.readyState === 1) m.ws.send(s);
  }
  roomInfo() {
    return {
      t: 'room', code: this.code, host: this.hostId, phase: this.phase, pub: this.pub, settings: this.settings,
      members: this.members.map(m => ({ id: m.id, name: m.name, look: m.look, ready: m.ready, team: m.team, bot: m.bot, wins: m.wins }))
    };
  }
  sync() { this.broadcast(this.roomInfo()); }

  add(ws, name, look) {
    const m = { id: nextId++, name: cleanName(name) || 'لاعب', look: cleanLook(look), ready: false, team: 0, bot: false, wins: 0, ws };
    this.members.push(m); ws.member = m; ws.room = this;
    if (this.hostId == null) this.hostId = m.id;
    this.autoTeam(m);
    this.fixBots();
    send(ws, { t: 'joined', id: m.id, code: this.code });
    if (this.roundMsg && this.phase !== 'lobby') send(ws, this.roundMsg);
    this.sync();
    return m;
  }
  autoTeam(m) {
    const c = [0, 0]; for (const x of this.members) if (x !== m) c[x.team]++;
    m.team = c[0] <= c[1] ? 0 : 1;
  }
  remove(m) {
    this.members = this.members.filter(x => x !== m);
    if (this.game && this.game.byId.get(m.id)) { const p = this.game.byId.get(m.id); if (p.alive) this.game.die(p, 'leave'); }
    if (!this.humans.length) { rooms.delete(this.code); return; }
    if (this.hostId === m.id) this.hostId = this.humans[0].id;
    this.fixBots();
    if (this.phase !== 'lobby' && this.members.length < 2) this.toLobby();
    this.sync();
  }
  fixBots() {
    // keep bot count within capacity
    const bots = this.members.filter(m => m.bot);
    const humans = this.humans.length;
    const want = clamp(this.settings.bots, 0, MAX_MEMBERS - humans);
    if (this.phase !== 'lobby') return;
    while (bots.length > want) { const b = bots.pop(); this.members = this.members.filter(x => x !== b); }
    while (bots.length < want) {
      const used = new Set(this.members.map(x => x.name));
      const name = BOT_NAMES.find(n => !used.has(n)) || 'بوت' + nextId;
      const b = { id: nextId++, name, look: { s: (Math.random() * 10) | 0, c: (Math.random() * 16) | 0, d: (Math.random() * 16) | 0, o: (Math.random() * 10) | 0, h: (Math.random() * 12) | 0, f: (Math.random() * 6) | 0 }, ready: true, team: 0, bot: true, wins: 0, skill: 0.55 + Math.random() * 0.45 };
      this.autoTeam(b); this.members.push(b); bots.push(b);
    }
  }

  // ---- settings / lobby actions (host only where relevant)
  handle(ws, msg) {
    const m = ws.member; if (!m) return;
    switch (msg.t) {
      case 'in':
        if (this.game) this.game.setInput(m.id, msg); break;
      case 'emote':
        if (this.game && (msg.n | 0) >= 0 && (msg.n | 0) < 8) this.game.emote(m.id, msg.n | 0); break;
      case 'look':
        m.look = cleanLook(msg.look); if (msg.name !== undefined) m.name = cleanName(msg.name) || m.name; this.sync(); break;
      case 'ready':
        if (this.phase === 'lobby') { m.ready = !!msg.v; this.sync(); } break;
      case 'team':
        if (this.phase === 'lobby') { m.team = m.team ? 0 : 1; this.sync(); } break;
      case 'chat': {
        const text = String(msg.text || '').replace(/[<>]/g, '').slice(0, 120).trim();
        if (text) this.broadcast({ t: 'chat', from: m.name, id: m.id, text });
        break;
      }
      case 'settings':
        if (m.id !== this.hostId || this.phase !== 'lobby') break;
        if (msg.map === 'random' || Maps.list.some(x => x.id === msg.map)) this.settings.map = msg.map;
        if (msg.mode === 'ffa' || msg.mode === 'teams') this.settings.mode = msg.mode;
        if ([1, 2, 3, 5, 7].includes(msg.wins | 0)) this.settings.wins = msg.wins | 0;
        if (msg.bots !== undefined) this.settings.bots = clamp(msg.bots | 0, 0, MAX_MEMBERS - 1);
        this.fixBots(); this.sync(); break;
      case 'start':
        if (m.id === this.hostId && this.phase === 'lobby') this.startMatch(); break;
      case 'tolobby':
        if (m.id === this.hostId && this.phase !== 'lobby') this.toLobby(); break;
      case 'kick': {
        if (m.id !== this.hostId) break;
        const t = this.members.find(x => x.id === (msg.id | 0));
        if (!t || t === m) break;
        if (t.bot) { this.settings.bots = Math.max(0, this.settings.bots - 1); this.members = this.members.filter(x => x !== t); this.sync(); }
        else { send(t.ws, { t: 'kicked' }); t.ws.close(); }
        break;
      }
    }
  }

  // ---- match flow
  startMatch() {
    if (this.members.length < 2) { this.broadcast({ t: 'toast', k: 'need2' }); return; }
    for (const m of this.members) m.wins = 0;
    if (this.settings.mode === 'teams') {
      const c = [0, 0]; this.members.forEach(m => c[m.team]++);
      if (!c[0] || !c[1]) this.members.forEach((m, i) => { m.team = i % 2; });
    }
    this.round = 0;
    this.startRound();
  }
  pickMap() {
    if (this.settings.map !== 'random') return this.settings.map;
    const pool = Maps.list.map(m => m.id).filter(id => id !== this.lastMap);
    return pool[(Math.random() * pool.length) | 0];
  }
  startRound() {
    const teams = this.settings.mode === 'teams';
    const mapId = this.pickMap(); this.lastMap = mapId;
    const parts = this.members.map(m => ({ id: m.id, name: m.name, look: m.look, team: teams ? m.team : m.id, bot: m.bot, skill: m.skill }));
    this.game = new Game(mapId, parts);
    this.rid++; this.round = (this.round || 0) + 1;
    this.phase = 'countdown'; this.timer = Math.round(3.4 / DT); this.endTimer = 0; this.roundTicks = 0;
    this.roundMsg = { t: 'round', rid: this.rid, map: mapId, round: this.round, teams, ids: parts.map(p => p.id) };
    this.broadcast(this.roundMsg);
    this.sync();
  }
  toLobby() {
    this.phase = 'lobby'; this.game = null; this.roundMsg = null;
    for (const m of this.members) { m.wins = 0; if (!m.bot) m.ready = false; }
    this.fixBots();
    this.sync();
  }
  teamOf(p) { return p.team; }

  step() {
    if (!this.game) return;
    const g = this.game;
    this.steps++;
    if (this.phase === 'countdown') {
      g.frozen = true;
      if (--this.timer <= 0) { this.phase = 'playing'; g.frozen = false; }
    } else if (this.phase === 'playing') {
      g.frozen = false; this.roundTicks++;
    }
    g.step();
    if (this.phase === 'playing') {
      const alive = g.alive();
      const teams = new Set(alive.map(p => p.team));
      if (!this.endTimer && g.players.length >= 2 && teams.size <= 1) this.endTimer = Math.round(1.3 / DT);
      if (!this.endTimer && this.roundTicks > 150 / DT) this.endTimer = 1; // time out -> draw
      if (this.endTimer && --this.endTimer <= 0) this.endRound();
    } else if (this.phase === 'roundEnd') {
      if (--this.timer <= 0) {
        const win = this.members.find(m => m.wins >= this.settings.wins);
        if (win) this.endMatch(win); else this.startRound();
      }
    } else if (this.phase === 'matchEnd') {
      if (--this.timer <= 0) this.toLobby();
    }
    // network: snapshot at 30Hz
    if (this.steps % 2 === 0) this.sendSnap();
  }
  endRound() {
    const g = this.game, alive = g.alive();
    const teams = new Set(alive.map(p => p.team));
    let winnerIds = [], winTeam = null;
    if (teams.size === 1 && alive.length) {
      winTeam = alive[0].team;
      winnerIds = g.players.filter(p => p.team === winTeam).map(p => p.id);
      for (const m of this.members) if (winnerIds.includes(m.id)) m.wins++;
    }
    this.phase = 'roundEnd'; this.timer = Math.round(3.6 / DT);
    this.broadcast({ t: 'roundend', winners: winnerIds, teamMode: this.settings.mode === 'teams', team: winTeam, draw: !winnerIds.length });
    this.sync();
  }
  endMatch(win) {
    this.phase = 'matchEnd'; this.timer = Math.round(8 / DT);
    const ids = this.settings.mode === 'teams' ? this.members.filter(m => m.team === win.team).map(m => m.id) : [win.id];
    this.broadcast({ t: 'matchend', winners: ids, teamMode: this.settings.mode === 'teams', team: win.team });
    this.sync();
  }
  sendSnap() {
    const s = this.game.snapshot();
    s.t = 's'; s.rid = this.rid; s.ts = Math.round(process.uptime() * 1000);
    s.ph = this.phase === 'countdown' ? 0 : this.phase === 'playing' ? 1 : this.phase === 'roundEnd' ? 2 : 3;
    if (this.phase === 'countdown') s.cd = Math.ceil(this.timer * DT);
    const str = JSON.stringify(s);
    for (const m of this.members) {
      if (m.bot || m.ws.readyState !== 1) continue;
      if (m.ws.bufferedAmount > 40000) continue; // slow connection: drop this frame instead of lagging further
      m.ws.send(str);
    }
  }
}

// ---------------------------------------------------------------- sockets
wss.on('connection', ws => {
  ws.isAlive = true; ws.msgCount = 0; ws.winStart = Date.now();
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', raw => {
    const now = Date.now();
    if (now - ws.winStart > 1000) { ws.winStart = now; ws.msgCount = 0; }
    if (++ws.msgCount > 150) return; // flood protection
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    if (!msg || typeof msg.t !== 'string') return;
    if (msg.t === 'ping') return send(ws, { t: 'pong', c: msg.c });
    if (ws.room) {
      if (msg.t === 'leave') { const r = ws.room; r.remove(ws.member); ws.room = null; ws.member = null; return; }
      return ws.room.handle(ws, msg);
    }
    if (msg.t === 'create') {
      const r = new Room(newCode(), !!msg.pub); rooms.set(r.code, r); r.add(ws, msg.name, msg.look);
    } else if (msg.t === 'join') {
      const r = rooms.get(String(msg.code || '').toUpperCase().trim());
      if (!r) return send(ws, { t: 'err', k: 'noroom' });
      if (r.members.length >= MAX_MEMBERS) {
        const bot = r.members.find(m => m.bot);
        if (bot && r.phase === 'lobby') { r.members = r.members.filter(x => x !== bot); r.settings.bots = Math.max(0, r.settings.bots - 1); }
        else return send(ws, { t: 'err', k: 'full' });
      }
      r.add(ws, msg.name, msg.look);
    } else if (msg.t === 'quick') {
      let r = [...rooms.values()].find(x => x.pub && x.phase === 'lobby' && x.humans.length < MAX_MEMBERS - 1 && x.members.length < MAX_MEMBERS);
      if (!r) { r = new Room(newCode(), true); rooms.set(r.code, r); }
      r.add(ws, msg.name, msg.look);
    }
  });
  ws.on('close', () => { if (ws.room && ws.member) ws.room.remove(ws.member); });
  ws.on('error', () => { });
});

// keep-alive (also drops dead connections)
setInterval(() => {
  for (const ws of wss.clients) { if (!ws.isAlive) { ws.terminate(); continue; } ws.isAlive = false; try { ws.ping(); } catch { } }
  for (const [code, r] of rooms) if (!r.humans.length) rooms.delete(code);
}, 15000);

// fixed 60Hz simulation loop
let last = process.hrtime.bigint(), acc = 0;
setInterval(() => {
  const now = process.hrtime.bigint();
  acc += Number(now - last) / 1e9; last = now;
  if (acc > 0.25) acc = 0.25;
  while (acc >= DT) { acc -= DT; for (const r of rooms.values()) r.step(); }
}, 8);

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n  BLOB BRAWL server is running!\n');
  console.log('  Local:    http://localhost:' + PORT);
  for (const list of Object.values(os.networkInterfaces()))
    for (const n of list) if (n.family === 'IPv4' && !n.internal) console.log('  Network:  http://' + n.address + ':' + PORT + '   <- friends on the same Wi-Fi use this');
  console.log('\n  For friends over the internet see README.md (start-online.bat)\n');
});
