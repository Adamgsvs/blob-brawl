// HTTP (static files) + WebSocket (rooms, lobby, matches). The server owns the physics.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Game, DT } from './src/sim.js';
import { botThink } from './src/bots.js';
import { STAGES } from './public/shared/stages.js';
import { cleanLook, randomLook } from './public/shared/looks.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.join(ROOT, 'public');
const PORT = +process.env.PORT || 3000;
const MAX = 8;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

// ---------------------------------------------------------------- static files
const server = http.createServer((req, res) => {
  let url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/') url = '/index.html';
  if (url === '/health') { res.writeHead(200); return res.end('ok'); }
  let file;
  if (url.startsWith('/three/')) file = path.normalize(path.join(ROOT, 'node_modules', 'three', url.slice(7)));   // three.js straight from node_modules
  else file = path.normalize(path.join(PUB, url));
  if (!file.startsWith(PUB) && !file.startsWith(path.join(ROOT, 'node_modules', 'three'))) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': url.startsWith('/three/') ? 'public, max-age=86400' : 'no-cache' });
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
const send = (ws, o) => { if (ws.readyState === 1) ws.send(JSON.stringify(o)); };
const now = () => Math.round(performance.now());
function newCode() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  for (;;) { let c = ''; for (let i = 0; i < 4; i++) c += abc[(Math.random() * abc.length) | 0]; if (!rooms.has(c)) return c; }
}

// ---------------------------------------------------------------- room
class Room {
  constructor(code, pub) {
    this.code = code; this.pub = pub; this.members = []; this.hostId = null;
    this.set = { stage: 'random', mode: 'melee', wins: 3, bots: 0 };
    this.phase = 'lobby';                // lobby | countdown | playing | roundEnd | matchEnd
    this.game = null; this.rid = 0; this.round = 0; this.timer = 0; this.endTimer = 0; this.ticks = 0; this.steps = 0;
    this.lastStage = null; this.roundMsg = null;
  }
  get humans() { return this.members.filter(m => !m.bot); }
  broadcast(o) { const s = JSON.stringify(o); for (const m of this.members) if (!m.bot && m.ws.readyState === 1) m.ws.send(s); }
  info() {
    return {
      t: 'room', code: this.code, host: this.hostId, phase: this.phase, pub: this.pub, set: this.set,
      members: this.members.map(m => ({ id: m.id, name: m.name, look: m.look, ready: m.ready, team: m.team, bot: m.bot, wins: m.wins }))
    };
  }
  sync() { this.broadcast(this.info()); }

  add(ws, name, look) {
    const m = { id: nextId++, name: cleanName(name) || 'لاعب', look: cleanLook(look), ready: false, team: 0, bot: false, wins: 0, ws };
    this.balance(m); this.members.push(m); ws.member = m; ws.room = this;
    if (this.hostId == null) this.hostId = m.id;
    this.fixBots();
    send(ws, { t: 'joined', id: m.id, code: this.code });
    if (this.roundMsg && this.phase !== 'lobby') send(ws, this.roundMsg);
    this.sync();
  }
  balance(m) { const c = [0, 0]; for (const x of this.members) c[x.team]++; m.team = c[0] <= c[1] ? 0 : 1; }
  remove(m) {
    this.members = this.members.filter(x => x !== m);
    const b = this.game && this.game.byId.get(m.id); if (b && b.alive) this.game.die(b, 'left');
    if (!this.humans.length) { rooms.delete(this.code); return; }
    if (this.hostId === m.id) this.hostId = this.humans[0].id;
    this.fixBots();
    if (this.phase !== 'lobby' && this.members.length < 2) this.toLobby();
    this.sync();
  }
  fixBots() {
    if (this.phase !== 'lobby') return;
    const bots = this.members.filter(m => m.bot), want = clamp(this.set.bots, 0, MAX - this.humans.length);
    while (bots.length > want) { const b = bots.pop(); this.members = this.members.filter(x => x !== b); }
    while (bots.length < want) {
      const used = new Set(this.members.map(x => x.name));
      const b = { id: nextId++, name: BOT_NAMES.find(n => !used.has(n)) || 'بوت' + nextId, look: randomLook(), ready: true, team: 0, bot: true, wins: 0, skill: 0.5 + Math.random() * 0.5 };
      this.balance(b); this.members.push(b); bots.push(b);
    }
  }

  handle(ws, msg) {
    const m = ws.member; if (!m) return;
    const host = m.id === this.hostId, lobby = this.phase === 'lobby';
    switch (msg.t) {
      case 'in': if (this.game) this.game.setInput(m.id, msg.x, msg.z, msg.b); break;
      case 'emote': if (this.game) this.game.emote(m.id, clamp(msg.n | 0, 0, 7)); break;
      case 'look': m.look = cleanLook(msg.look); if (msg.name !== undefined) m.name = cleanName(msg.name) || m.name; this.sync(); break;
      case 'ready': if (lobby) { m.ready = !!msg.v; this.sync(); } break;
      case 'team': if (lobby) { m.team = m.team ? 0 : 1; this.sync(); } break;
      case 'chat': { const text = String(msg.text || '').replace(/[<>]/g, '').slice(0, 120).trim(); if (text) this.broadcast({ t: 'chat', from: m.name, text }); break; }
      case 'set':
        if (!host || !lobby) break;
        if (msg.stage === 'random' || STAGES.some(s => s.id === msg.stage)) this.set.stage = msg.stage;
        if (msg.mode === 'melee' || msg.mode === 'gang') this.set.mode = msg.mode;
        if ([1, 2, 3, 5, 7].includes(msg.wins | 0)) this.set.wins = msg.wins | 0;
        if (msg.bots !== undefined) this.set.bots = clamp(msg.bots | 0, 0, MAX - 1);
        this.fixBots(); this.sync(); break;
      case 'start': if (host && lobby) this.startMatch(); break;
      case 'tolobby': if (host && !lobby) this.toLobby(); break;
      case 'kick': {
        if (!host) break;
        const t = this.members.find(x => x.id === (msg.id | 0)); if (!t || t === m) break;
        if (t.bot) { this.set.bots = Math.max(0, this.set.bots - 1); this.members = this.members.filter(x => x !== t); this.sync(); }
        else { send(t.ws, { t: 'kicked' }); t.ws.close(); }
        break;
      }
    }
  }

  // ---- match flow
  startMatch() {
    if (this.members.length < 2) { this.broadcast({ t: 'toast', k: 'need2' }); return; }
    for (const m of this.members) m.wins = 0;
    if (this.set.mode === 'gang') { const c = [0, 0]; this.members.forEach(m => c[m.team]++); if (!c[0] || !c[1]) this.members.forEach((m, i) => { m.team = i % 2; }); }
    this.round = 0; this.startRound();
  }
  pickStage() {
    if (this.set.stage !== 'random') return this.set.stage;
    const pool = STAGES.map(s => s.id).filter(id => id !== this.lastStage);
    return pool[(Math.random() * pool.length) | 0];
  }
  startRound() {
    const gang = this.set.mode === 'gang', stage = this.pickStage(); this.lastStage = stage;
    const parts = this.members.map(m => ({ id: m.id, name: m.name, team: gang ? m.team : 100 + m.id, bot: m.bot, skill: m.skill }));
    this.game = new Game(stage, parts, botThink);
    this.rid = (this.rid + 1) & 0xffff; this.round++;
    this.phase = 'countdown'; this.timer = Math.round(3.6 / DT); this.endTimer = 0; this.ticks = 0; this.winTeam = null;
    this.roundMsg = { t: 'round', rid: this.rid, stage, round: this.round, gang, ids: parts.map(p => p.id) };
    this.broadcast(this.roundMsg); this.sync();
  }
  toLobby() {
    this.phase = 'lobby'; this.game = null; this.roundMsg = null;
    for (const m of this.members) { m.wins = 0; if (!m.bot) m.ready = false; }
    this.fixBots(); this.sync();
  }

  step() {
    const g = this.game; if (!g) return;
    this.steps++;
    if (this.phase === 'countdown') { g.frozen = true; if (--this.timer <= 0) { this.phase = 'playing'; g.frozen = false; } }
    else if (this.phase === 'playing') this.ticks++;
    g.step();
    if (this.phase === 'playing') {
      const teams = new Set(g.alive().map(b => b.team));
      if (!this.endTimer && g.beasts.length >= 2 && teams.size <= 1) { this.endTimer = Math.round(1.4 / DT); this.winTeam = teams.size === 1 ? [...teams][0] : null; }
      if (!this.endTimer && this.ticks > 180 / DT) this.endTimer = 1;           // nobody finished it: draw
      if (this.endTimer && --this.endTimer <= 0) this.endRound();
    } else if (this.phase === 'roundEnd') {
      if (--this.timer <= 0) { const w = this.members.find(m => m.wins >= this.set.wins); if (w) this.endMatch(w); else this.startRound(); }
    } else if (this.phase === 'matchEnd') { if (--this.timer <= 0) this.toLobby(); }

    const ev = g.takeEvents();
    if (ev.length) this.broadcast({ t: 'ev', ts: now(), l: ev });
    {                                                                         // a snapshot every tick (60 Hz)
      const ph = this.phase === 'countdown' ? 0 : this.phase === 'playing' ? 1 : this.phase === 'roundEnd' ? 2 : 3;
      const buf = g.snapshot(this.rid, ph, this.phase === 'countdown' ? Math.ceil(this.timer * DT) : 0, now());
      for (const m of this.members) {
        if (m.bot || m.ws.readyState !== 1) continue;
        if (m.ws.bufferedAmount > 30000) continue;                               // slow link: skip a frame rather than queue up lag
        m.ws.send(buf);
      }
    }
  }
  endRound() {
    const g = this.game;
    let winners = [], team = null;
    if (this.winTeam != null) {
      team = this.winTeam; winners = g.beasts.filter(b => b.team === team).map(b => b.id);
      for (const m of this.members) if (winners.includes(m.id)) m.wins++;
    }
    this.phase = 'roundEnd'; this.timer = Math.round(4.2 / DT);
    this.broadcast({ t: 'roundend', winners, gang: this.set.mode === 'gang', team, draw: !winners.length });
    this.sync();
  }
  endMatch(w) {
    this.phase = 'matchEnd'; this.timer = Math.round(9 / DT);
    const gang = this.set.mode === 'gang';
    this.broadcast({ t: 'matchend', winners: gang ? this.members.filter(m => m.team === w.team).map(m => m.id) : [w.id], gang, team: w.team });
    this.sync();
  }
}

// ---------------------------------------------------------------- sockets
wss.on('connection', ws => {
  ws.isAlive = true; ws.n = 0; ws.t0 = Date.now();
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', (raw, isBinary) => {
    if (isBinary) return;
    const t = Date.now(); if (t - ws.t0 > 1000) { ws.t0 = t; ws.n = 0; }
    if (++ws.n > 160) return;                                                    // flood protection
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    if (!msg || typeof msg.t !== 'string') return;
    if (msg.t === 'ping') return send(ws, { t: 'pong', c: msg.c });
    if (ws.room) {
      if (msg.t === 'leave') { const r = ws.room; r.remove(ws.member); ws.room = null; ws.member = null; return; }
      return ws.room.handle(ws, msg);
    }
    if (msg.t === 'create') { const r = new Room(newCode(), !!msg.pub); rooms.set(r.code, r); r.add(ws, msg.name, msg.look); }
    else if (msg.t === 'join') {
      const r = rooms.get(String(msg.code || '').toUpperCase().trim());
      if (!r) return send(ws, { t: 'err', k: 'noroom' });
      if (r.members.length >= MAX) {
        const bot = r.members.find(m => m.bot);
        if (bot && r.phase === 'lobby') { r.members = r.members.filter(x => x !== bot); r.set.bots = Math.max(0, r.set.bots - 1); }
        else return send(ws, { t: 'err', k: 'full' });
      }
      r.add(ws, msg.name, msg.look);
    } else if (msg.t === 'quick') {
      let r = [...rooms.values()].find(x => x.pub && x.phase === 'lobby' && x.humans.length < MAX - 1 && x.members.length < MAX);
      if (!r) { r = new Room(newCode(), true); rooms.set(r.code, r); }
      r.add(ws, msg.name, msg.look);
    }
  });
  ws.on('close', () => { if (ws.room && ws.member) ws.room.remove(ws.member); });
  ws.on('error', () => { });
});

setInterval(() => {
  for (const ws of wss.clients) { if (!ws.isAlive) { ws.terminate(); continue; } ws.isAlive = false; try { ws.ping(); } catch { } }
  for (const [code, r] of rooms) if (!r.humans.length) rooms.delete(code);
}, 15000);

// fixed 60 Hz simulation
let last = performance.now(), acc = 0;
setInterval(() => {
  const t = performance.now(); acc += (t - last) / 1000; last = t;
  if (acc > 0.2) acc = 0.2;
  while (acc >= DT) { acc -= DT; for (const r of rooms.values()) { try { r.step(); } catch (e) { console.error('room', r.code, e); r.toLobby(); } } }
}, 8);

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n  BLOB BRAWL server is running\n\n  Local:    http://localhost:' + PORT);
  for (const list of Object.values(os.networkInterfaces())) for (const n of list) if (n.family === 'IPv4' && !n.internal) console.log('  Network:  http://' + n.address + ':' + PORT);
  console.log('');
});
