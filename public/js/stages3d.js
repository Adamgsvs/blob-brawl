// Stage visuals. Collision shapes come from shared/stages.js; this file only makes them look like places.
import * as THREE from 'three';
import { dynState } from '../shared/stages.js';

let Q = 1;                       // quality 0..2
const GEO = {};
function geo() {
  if (!GEO.box) {
    GEO.box = new THREE.BoxGeometry(1, 1, 1); GEO.cyl = new THREE.CylinderGeometry(1, 1, 1, 18); GEO.sph = new THREE.SphereGeometry(1, 20, 14);
    GEO.cone = new THREE.ConeGeometry(1, 1, 16); GEO.plane = new THREE.PlaneGeometry(1, 1); GEO.tor = new THREE.TorusGeometry(1, 0.08, 6, 20);
  }
  return GEO;
}
const MATS = new Map();
export function lam(color, extra) {
  const k = color + (extra ? JSON.stringify(extra) : ''); let m = MATS.get(k);
  if (!m) { m = new THREE.MeshLambertMaterial(Object.assign({ color }, extra || {})); MATS.set(k, m); }
  return m;
}
const basic = (color, extra) => new THREE.MeshBasicMaterial(Object.assign({ color }, extra || {}));
const TEX = {};
function tex(key, w, h, draw) {
  if (TEX[key]) return TEX[key];
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return (TEX[key] = t);
}
const rep = (t, rx, ry) => { const c = t.clone(); c.needsUpdate = true; c.repeat.set(rx, ry); return c; };
const lmap = (t, extra) => new THREE.MeshLambertMaterial(Object.assign({ map: t }, extra || {}));
function rng(seed) { let s = seed || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

// ---- flat, simple textures ---------------------------------------------------------------------------------
const T = {
  brick: () => tex('brick', 128, 64, (x, w, h) => { x.fillStyle = '#b4614a'; x.fillRect(0, 0, w, h); x.fillStyle = '#c9a78f'; for (let r = 0; r < 4; r++) { x.fillRect(0, r * 16, w, 2); for (let c = 0; c < 4; c++) x.fillRect(c * 32 + (r & 1) * 16, r * 16, 2, 16); } }),
  roofTop: () => tex('roofTop', 128, 128, (x, w, h) => { x.fillStyle = '#8f8a86'; x.fillRect(0, 0, w, h); x.strokeStyle = '#827d79'; x.lineWidth = 3; x.strokeRect(0, 0, w, h); }),
  blocks: () => tex('blocks', 128, 64, (x, w, h) => { x.fillStyle = '#d9b68e'; x.fillRect(0, 0, w, h); x.fillStyle = '#c4a079'; x.fillRect(0, 0, 3, h); x.fillRect(0, h - 3, w, 3); }),
  tile: () => tex('tile', 64, 64, (x, w, h) => { x.fillStyle = '#d7d3ca'; x.fillRect(0, 0, w, h); x.strokeStyle = '#bdb8ad'; x.lineWidth = 2; x.strokeRect(0, 0, w, h); }),
  wtile: () => tex('wtile', 64, 32, (x, w, h) => { x.fillStyle = '#ecebe4'; x.fillRect(0, 0, w, h); x.strokeStyle = '#cfccc2'; x.lineWidth = 2; x.strokeRect(0, 0, w, h); }),
  gravel: () => tex('gravel', 64, 64, (x, w, h) => { x.fillStyle = '#3f3b37'; x.fillRect(0, 0, w, h); const r = rng(4); for (let i = 0; i < 120; i++) { x.fillStyle = r() < 0.5 ? '#4b4641' : '#34302d'; x.fillRect(r() * w, r() * h, 3, 3); } }),
  chevron: () => tex('chevron', 64, 64, (x, w, h) => { x.fillStyle = '#34363f'; x.fillRect(0, 0, w, h); x.strokeStyle = '#4b4e5a'; x.lineWidth = 7; x.beginPath(); x.moveTo(12, 8); x.lineTo(40, 32); x.lineTo(12, 56); x.stroke(); }),
  grate: () => tex('grate', 32, 32, (x, w, h) => { x.fillStyle = '#5a606c'; x.fillRect(0, 0, w, h); x.fillStyle = '#3d424c'; x.fillRect(4, 4, 24, 24); x.fillStyle = '#5a606c'; x.fillRect(14, 0, 4, 32); x.fillRect(0, 14, 32, 4); }),
  panels: () => tex('panels', 128, 128, (x, w, h) => { x.fillStyle = '#5a504a'; x.fillRect(0, 0, w, h); x.strokeStyle = '#4a413c'; x.lineWidth = 4; x.strokeRect(0, 0, w, h); x.fillStyle = '#4a413c'; for (const [a, b] of [[10, 10], [w - 14, 10], [10, h - 14], [w - 14, h - 14]]) x.fillRect(a, b, 4, 4); }),
  hazard: () => tex('hazard', 64, 64, (x, w, h) => { x.fillStyle = '#f0c022'; x.fillRect(0, 0, w, h); x.fillStyle = '#26262c'; for (let i = -1; i < 3; i++) { x.beginPath(); x.moveTo(i * 32, 0); x.lineTo(i * 32 + 16, 0); x.lineTo(i * 32 + 48, h); x.lineTo(i * 32 + 32, h); x.fill(); } }),
  wood: () => tex('wood', 128, 64, (x, w, h) => { for (let i = 0; i < 4; i++) { x.fillStyle = ['#c79a62', '#bd8e55', '#cda46d', '#c2935b'][i]; x.fillRect(0, i * 16, w, 15); x.fillStyle = '#9a7141'; x.fillRect(0, i * 16 + 15, w, 1); } }),
  corr: () => tex('corr', 64, 64, (x, w, h) => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h); for (let i = 0; i < 8; i++) { x.fillStyle = 'rgba(0,0,0,.2)'; x.fillRect(i * 8, 0, 3, h); x.fillStyle = 'rgba(255,255,255,.2)'; x.fillRect(i * 8 + 4, 0, 2, h); } }),
  rivets: () => tex('rivets', 64, 64, (x, w, h) => { x.fillStyle = '#b84a2e'; x.fillRect(0, 0, w, h); x.fillStyle = '#9c3c24'; for (const [a, b] of [[8, 8], [56, 8], [8, 56], [56, 56]]) { x.beginPath(); x.arc(a, b, 4, 0, 7); x.fill(); } }),
  windows: (k) => tex('win' + k, 64, 128, (x, w, h) => { x.fillStyle = k ? '#c9b3c4' : '#b7a3b8'; x.fillRect(0, 0, w, h); const r = rng(k + 3); for (let j = 0; j < 8; j++) for (let i = 0; i < 4; i++) { x.fillStyle = r() < 0.18 ? '#fff0c8' : '#8f7f97'; x.fillRect(5 + i * 15, 5 + j * 15, 8, 10); } }),
  mat: () => tex('mat', 256, 256, (x, w, h) => { x.fillStyle = '#c9d2d8'; x.fillRect(0, 0, w, h); x.strokeStyle = '#b3bdc5'; x.lineWidth = 10; x.beginPath(); x.arc(w / 2, h / 2, 78, 0, 7); x.stroke(); x.fillStyle = '#b3bdc5'; x.font = '900 60px Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('BB', w / 2, h / 2 + 4); }),
  shaft: () => tex('shaft', 64, 128, (x, w, h) => { x.fillStyle = '#5d6572'; x.fillRect(0, 0, w, h); x.fillStyle = '#4c535f'; x.fillRect(0, 0, w, 6); x.fillRect(0, 0, 3, h); }),
  road: () => tex('road', 256, 64, (x, w, h) => { x.fillStyle = '#55565e'; x.fillRect(0, 0, w, h); x.fillStyle = '#e9e4d4'; x.fillRect(20, 30, 110, 4); x.fillStyle = '#f0c022'; x.fillRect(0, 2, w, 3); x.fillRect(0, h - 5, w, 3); }),
  envelope: () => tex('envelope', 128, 64, (x, w, h) => { x.fillStyle = '#f1ead9'; x.fillRect(0, 0, w, h); x.fillStyle = '#cf4a3c'; x.fillRect(0, 26, w, 12); x.fillStyle = 'rgba(0,0,0,.06)'; for (let i = 0; i < 8; i++) x.fillRect(i * 16, 0, 1, h); }),
  water: () => tex('water', 128, 128, (x, w, h) => { x.fillStyle = '#3f8fc4'; x.fillRect(0, 0, w, h); const r = rng(8); x.strokeStyle = '#69aed9'; x.lineWidth = 2; for (let i = 0; i < 26; i++) { const a = r() * w, b = r() * h; x.beginPath(); x.moveTo(a, b); x.quadraticCurveTo(a + 10, b - 4, a + 20, b); x.stroke(); } }),
  sign: (txt) => tex('sign' + txt, 256, 128, (x, w, h) => { x.fillStyle = '#2f8a4e'; x.fillRect(0, 0, w, h); x.strokeStyle = '#fff'; x.lineWidth = 8; x.strokeRect(8, 8, w - 16, h - 16); x.fillStyle = '#fff'; x.font = '900 54px Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, w / 2, h / 2); }),
  neon: (txt, col) => tex('neon' + txt, 512, 160, (x, w, h) => { x.clearRect(0, 0, w, h); x.font = '900 120px Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = col; x.shadowBlur = 26; x.fillStyle = col; x.fillText(txt, w / 2, h / 2); x.shadowBlur = 0; x.fillStyle = '#fff5fb'; x.fillText(txt, w / 2, h / 2 - 2); }),
  station: () => tex('station', 256, 64, (x, w, h) => { x.fillStyle = '#23508f'; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.font = '900 40px Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('BLOB STREET', w / 2, h / 2 + 2); })
};

// ---- tiny modelling helpers --------------------------------------------------------------------------------
function add(g, geom, m, x, y, z, sx, sy, sz) { const o = new THREE.Mesh(geom, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = o.receiveShadow = Q > 0; g.add(o); return o; }
const box = (g, x, y, z, w, h, d, m) => add(g, geo().box, typeof m === 'string' ? lam(m) : m, x, y, z, w, h, d);
const cyl = (g, x, y, z, r, h, m, axis) => { const o = add(g, geo().cyl, typeof m === 'string' ? lam(m) : m, x, y, z, r, h, r); if (axis === 'x') o.rotation.z = Math.PI / 2; else if (axis === 'z') o.rotation.x = Math.PI / 2; return o; };
const sph = (g, x, y, z, rx, ry, rz, m) => add(g, geo().sph, typeof m === 'string' ? lam(m) : m, x, y, z, rx, ry, rz);
const cone = (g, x, y, z, r, h, m) => add(g, geo().cone, typeof m === 'string' ? lam(m) : m, x, y, z, r, h, r);
function rod(g, a, b, r, m) { // cylinder between two points
  const o = add(g, geo().cyl, typeof m === 'string' ? lam(m) : m, 0, 0, 0, r, 1, r); setRod(o, a, b); return o;
}
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
function setRod(o, a, b) { _a.set(a[0], a[1], a[2]); _b.set(b[0], b[1], b[2]); _d.subVectors(_b, _a); const l = _d.length() || 1e-4; o.position.addVectors(_a, _b).multiplyScalar(0.5); o.scale.y = l; o.quaternion.setFromUnitVectors(UP, _d.multiplyScalar(1 / l)); }

// six materials for a box: [+x, -x, +y(top), -y, +z, -z]
const six = (side, top, bottom) => [side, side, top, bottom || side, side, side];

function solidMesh(g, b, st, anim) {
  if (b.invisible) return null;
  const cy = b.y - b.h / 2, m = b.m;
  const mk = mats => box(g, b.x, cy, b.z, b.w, b.h, b.d, mats);
  switch (m) {
    case 'roof': { const sx = lmap(rep(T.brick(), b.d / 2.2, b.h / 1.1)), sz = lmap(rep(T.brick(), b.w / 2.2, b.h / 1.1)), top = lmap(rep(T.roofTop(), b.w / 2, b.d / 2)); return mk([sx, sx, top, lam('#444'), sz, sz]); }
    case 'parapet': { const a = lmap(rep(T.blocks(), Math.max(1, b.d / 1.2), 1)), c = lmap(rep(T.blocks(), Math.max(1, b.w / 1.2), 1)), top = lam('#e6c8a2'); return mk([a, a, top, top, c, c]); }
    case 'ac': { const o = mk(lam('#b9c0cb')); cyl(g, b.x, b.y + 0.03, b.z, 0.5, 0.06, '#59606c'); cyl(g, b.x, b.y + 0.05, b.z, 0.42, 0.06, '#8a919d'); for (let i = 0; i < 5; i++) box(g, b.x, cy - 0.3 + i * 0.16, b.z + b.d / 2 + 0.01, b.w * 0.8, 0.05, 0.02, '#8a919d'); return o; }
    case 'hut': { const o = mk(six(lam('#cdb99f'), lam('#a59a8c'))); box(g, b.x, b.y + 0.06, b.z, b.w + 0.3, 0.14, b.d + 0.3, '#b3a797'); box(g, b.x + 0.2, b.y - b.h + 1.0, b.z + b.d / 2 + 0.02, 0.95, 2.0, 0.05, '#7b3f36'); sph(g, b.x + 0.52, b.y - b.h + 1.0, b.z + b.d / 2 + 0.06, 0.05, 0.05, 0.05, '#d8c36a'); return o; }
    case 'vent': { const o = mk(lam('#aab1bc')); cyl(g, b.x, b.y + 0.12, b.z, 0.34, 0.24, '#8d949f'); cyl(g, b.x, b.y + 0.28, b.z, 0.5, 0.08, '#aab1bc'); return o; }
    case 'mat': return mk(six(lam('#2c58a8'), lmap(T.mat()), lam('#333')));
    case 'rope': {
      const horiz = b.w > b.d, len = horiz ? b.w : b.d, cols = ['#f2f2f2', '#d8382f', '#f2f2f2'];
      for (let i = 0; i < 3; i++) cyl(g, b.x, b.y - b.h + 0.08 + i * (b.h - 0.12) / 2, b.z, 0.04, len, cols[i], horiz ? 'x' : 'z');
      return null;
    }
    case 'post': { cyl(g, b.x, cy, b.z, 0.12, b.h, '#3c3f48'); const c = (b.x < 0) === (b.z < 0) ? '#d8382f' : '#2c58a8'; box(g, b.x - Math.sign(b.x) * 0.08, b.y - 0.6, b.z - Math.sign(b.z) * 0.08, 0.34, 0.95, 0.34, c); return null; }
    case 'tile': return mk(six(lmap(rep(T.wtile(), Math.max(b.w, b.d) / 1.2, b.h / 0.6)), lmap(rep(T.tile(), b.w / 1.2, b.d / 1.2))));
    case 'track': return mk(six(lam('#34302d'), lmap(rep(T.gravel(), b.w / 3, b.d / 3))));
    case 'tilewall': { const t = lmap(rep(T.wtile(), Math.max(b.w, b.d) / 1.2, b.h / 0.6)); return mk(six(t, lam('#d9d6cc'))); }
    case 'pillar': return mk(lmap(rep(T.wtile(), 1, b.h / 0.6)));
    case 'belt': {
      const t = rep(T.chevron(), b.w / 1.2, b.d / 1.2); if (b.conv[0] < 0) { t.center.set(0.5, 0.5); t.rotation = Math.PI; }
      anim.push((dt, tt, dyn) => { t.offset.x += -Math.abs(b.conv[0]) * dyn.conv * dt / 1.2 * (b.conv[0] < 0 ? 1 : 1); });
      const o = mk(six(lam('#2c2e36'), lmap(t), lam('#222'))); for (const s of [-1, 1]) cyl(g, b.x + s * b.w / 2, b.y - 0.28, b.z, 0.28, b.d, '#4b4e5a', 'z'); return o;
    }
    case 'grate': return mk(six(lam('#454a54'), lmap(rep(T.grate(), b.w / 0.8, b.d / 0.8))));
    case 'factorywall': return mk(lmap(rep(T.panels(), Math.max(b.w, b.d) / 3, b.h / 3)));
    case 'curb': return mk(lmap(rep(T.hazard(), Math.max(b.w, b.d) / 1.2, 1)));
    case 'steel': return mk(lam('#4d525c'));
    case 'catwalk': return mk(six(lam('#454a54'), lmap(rep(T.grate(), b.w / 0.8, b.d / 0.8))));
    case 'furnace': return mk(lmap(rep(T.brick(), Math.max(b.w, b.d) / 2.2, b.h / 1.1), { color: '#8a7a78' }));
    case 'girder': {
      const mt = lmap(rep(T.rivets(), Math.max(b.w, b.d) / 0.9, 1)), o = mk(mt), horiz = b.w >= b.d;
      if (b.h < 1.5) { box(g, b.x, b.y - 0.03, b.z, b.w + (horiz ? 0 : 0.14), 0.07, b.d + (horiz ? 0.14 : 0), '#a8432a'); box(g, b.x, b.y - b.h + 0.03, b.z, b.w + (horiz ? 0 : 0.14), 0.07, b.d + (horiz ? 0.14 : 0), '#a8432a'); }
      return o;
    }
    case 'plank': return mk(lmap(rep(T.wood(), b.w / 2.4, b.d / 1.2)));
    case 'cont': return contMesh(g, b.x, cy, b.z, b.w, b.h, b.d, b.tint);
    case 'concrete': return mk(lam('#9a9690'));
    case 'shaftwall': return mk(lmap(rep(T.shaft(), Math.max(b.w, b.d) / 2, b.h / 4)));
    case 'fin': { const o = mk(lam('#f1ead9')); box(g, b.x, b.y - 0.25, b.z, b.w + 0.02, 0.3, b.d + 0.02, '#cf4a3c'); return o; }
    case 'hatch': { const o = mk(lam('#8a919d')); cyl(g, b.x, b.y + 0.04, b.z, 0.32, 0.06, '#59606c'); return o; }
    default: return mk(lam('#9a9690'));
  }
}
function contMesh(g, x, y, z, w, h, d, tint) {
  const long = w >= d, a = lmap(rep(T.corr(), (long ? w : d) / 0.9, 1), { color: tint }), e = lmap(rep(T.corr(), (long ? d : w) / 0.9, 1), { color: tint }), top = lmap(rep(T.corr(), (long ? w : d) / 0.9, 1), { color: new THREE.Color(tint).multiplyScalar(0.85) });
  if (!long) top.map.rotation = Math.PI / 2;
  const o = box(g, x, y, z, w, h, d, long ? [e, e, top, lam('#333'), a, a] : [a, a, top, lam('#333'), e, e]);
  const fr = new THREE.Color(tint).multiplyScalar(0.7); const fm = lam('#' + fr.getHexString());
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, x + sx * (w / 2 - 0.05), y, z + sz * (d / 2 - 0.05), 0.12, h + 0.02, 0.12, fm);
  return o;
}

// ---- things that move ------------------------------------------------------------------------------------------
function moverModel(def) {
  const g = new THREE.Group(), w = def.w, h = def.h, d = def.d; let spin = null;
  switch (def.model) {
    case 'train': {
      box(g, 0, -h / 2 + 0.15, 0, w, h - 0.3, d, '#c6cbd4'); box(g, 0, -h + 0.25, 0, w + 0.02, 0.5, d + 0.02, '#3a3f4a'); box(g, 0, -0.06, 0, w - 0.4, 0.14, d - 0.5, '#9aa0ab');
      box(g, 0, -h * 0.55, 0, w + 0.03, 0.22, d + 0.03, '#d8382f');
      for (let i = 0; i < 9; i++) for (const s of [-1, 1]) box(g, -w / 2 + 1.5 + i * (w - 3) / 8, -h * 0.32, s * (d / 2 + 0.01), 1.4, 0.85, 0.03, '#27323f');
      for (const sx of [-1, 1]) { box(g, sx * (w / 2 + 0.01), -h * 0.33, 0, 0.03, 0.9, d - 0.6, '#27323f'); for (const sz of [-1, 1]) add(g, geo().sph, basic('#fff6c2'), sx * (w / 2 + 0.02), -h * 0.72, sz * 0.75, 0.05, 0.16, 0.16); }
      break;
    }
    case 'truck': {
      contMesh(g, 0, -1.25, 0, w, 2.5, d, def.tint); box(g, 0, -2.62, 0, w, 0.24, d - 0.5, '#2c2d33');
      spin = []; for (const x of [-w / 2 + 1.2, -w / 2 + 2.3, w / 2 - 2.6, w / 2 - 1.5, w / 2 - 0.4]) for (const s of [-1, 1]) spin.push(cyl(g, x, -2.62, s * (d / 2 - 0.25), 0.44, 0.34, '#1d1d21', 'z'));
      break;
    }
    case 'cab': {
      box(g, 0, -h / 2, 0, w, h, d, def.tint); box(g, -w / 2 - 0.5, -h + 0.75, 0, 1.0, 1.5, d - 0.1, def.tint);
      box(g, -w / 2 - 0.02, -0.75, 0, 0.05, 0.9, d - 0.5, '#9fd4f5'); box(g, -w / 2 - 1.02, -h + 0.4, 0, 0.1, 0.5, d - 0.2, '#d8d8de');
      for (const s of [-1, 1]) { cyl(g, w / 2 - 0.2, -0.2, s * (d / 2 - 0.15), 0.08, 1.2, '#9aa0ab'); add(g, geo().sph, basic('#fff6c2'), -w / 2 - 1.05, -h + 0.75, s * (d / 2 - 0.4), 0.05, 0.14, 0.14); }
      spin = []; for (const x of [-w / 2 - 0.3, w / 2 - 0.5]) for (const s of [-1, 1]) spin.push(cyl(g, x, -h + 0.02, s * (d / 2 - 0.2), 0.44, 0.34, '#1d1d21', 'z'));
      break;
    }
    case 'sign': {
      const m = lmap(T.sign('EXIT 9 ➜'));
      const b = box(g, 0, -h / 2, 0, 0.14, h, d, [lam('#2f8a4e'), m, lam('#2f8a4e'), lam('#2f8a4e'), lam('#2f8a4e'), lam('#2f8a4e')]);
      box(g, 0, 0.12, 0, 0.3, 0.24, d + 1.4, '#8a919d'); for (const s of [-1, 1]) box(g, 0, -3, s * (d / 2 + 0.6), 0.28, 6.4, 0.28, '#8a919d');
      break;
    }
    case 'container': {
      contMesh(g, 0, -h / 2, 0, w, h, d, def.tint);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(g, sx * (w / 2 - 0.25), 9, sz * (d / 2 - 0.25), 0.03, 18, '#55585f');
      box(g, 0, 0.1, 0, w + 0.1, 0.16, d + 0.1, '#e0b22a');
      break;
    }
    case 'elevator': {
      box(g, 0, -0.1, 0, w, 0.2, d, '#4d525c'); box(g, 0, -h + 0.1, 0, w, 0.2, d, '#4d525c');
      const gl = new THREE.MeshLambertMaterial({ color: '#bfe2f2', transparent: true, opacity: 0.3 });
      const p = box(g, 0, -h / 2, 0, w - 0.1, h - 0.4, d - 0.1, gl); p.castShadow = false;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, sx * (w / 2 - 0.06), -h / 2, sz * (d / 2 - 0.06), 0.12, h, 0.12, '#8a919d');
      for (const s of [-1, 1]) cyl(g, s * 0.5, 12, -d / 2 + 0.6, 0.04, 24, '#33363d');
      box(g, 0, 0.06, -d / 2 + 0.6, 1.4, 0.3, 0.5, '#33363d');
      break;
    }
    default: box(g, 0, -h / 2, 0, w, h, d, lmap(rep(T.hazard(), w / 1.2, 1)));
  }
  g.userData.spin = spin;
  return g;
}

function bumperModel(def) {
  const g = new THREE.Group();
  if (def.model === 'beef') {
    sph(g, 0, 0, 0, def.r * 0.75, def.r * 1.25, def.r * 0.6, '#b9433f'); sph(g, 0, 0.1, def.r * 0.42, def.r * 0.5, def.r * 0.95, def.r * 0.25, '#e9d7c4'); sph(g, 0, def.r * 0.2, -def.r * 0.4, def.r * 0.45, def.r * 0.8, def.r * 0.25, '#d98f86');
    cyl(g, 0, def.r * 1.3, 0, 0.05, 0.4, '#d9d2c2');
  } else {
    box(g, 0, 0, 0, 0.16, def.r * 2, def.half * 2, '#b84a2e'); box(g, 0, def.r - 0.04, 0, 0.6, 0.09, def.half * 2, '#b84a2e'); box(g, 0, -def.r + 0.04, 0, 0.6, 0.09, def.half * 2, '#b84a2e');
  }
  return g;
}

// ---- scenery ------------------------------------------------------------------------------------------------------
function skyline(g, baseY, tint, n, r0, r1, seed) {
  const r = rng(seed || 7);
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + r() * 0.3, d = r0 + r() * (r1 - r0), w = 7 + r() * 12, dd = 7 + r() * 12, h = 30 + r() * 80;
    if (Math.sin(a) > 0.55 && d < r0 + 25) continue;              // keep the space in front of the camera clear
    const m = lmap(rep(T.windows(i & 1), w / 6, h / 12), { color: tint });
    const b = box(g, Math.cos(a) * d, baseY - h / 2 + r() * 26, Math.sin(a) * d, w, h, dd, m); b.castShadow = false;
  }
}
function neon(g, txt, col, x, y, z, w) { const m = new THREE.Mesh(geo().plane, new THREE.MeshBasicMaterial({ map: T.neon(txt, col), transparent: true })); m.scale.set(w, w * 0.31, 1); m.position.set(x, y, z); g.add(m); return m; }
function cloud(g, x, y, z, s, m) { const c = new THREE.Group(); for (const [dx, dy, dz, k] of [[0, 0, 0, 1], [0.9, 0.2, 0.2, 0.8], [-0.9, 0.1, -0.1, 0.75], [0.3, 0.4, -0.3, 0.7]]) { const o = sph(c, dx * s, dy * s, dz * s, s * k, s * k * 0.55, s * k * 0.8, m); o.castShadow = false; o.receiveShadow = false; } c.position.set(x, y, z); g.add(c); return c; }

const DECO = {
  roof(g, st, anim) {
    skyline(g, -6, '#e9c9da', Q ? 46 : 22, 34, 150);
    // neighbouring roofs
    for (const [x, z, w, d, y] of [[-21, -3, 14, 16, -3.5], [22, 2, 15, 14, -6], [2, -22, 20, 14, -2.2]]) { box(g, x, y - 20, z, w, 40, d, lmap(rep(T.brick(), w / 2.2, 36), { color: '#d9b9b0' })); box(g, x, y + 0.1, z, w + 0.4, 0.3, d + 0.4, '#b8a79b'); }
    // billboard frame + neon letters behind the roof
    for (const x of [-4.2, 4.2]) { box(g, x, 3.2, -6.3, 0.22, 6.4, 0.22, '#5d6470'); rod(g, [x, 0.2, -5.6], [x, 4.6, -6.3], 0.07, '#5d6470'); }
    for (const y of [3.4, 5.2, 6.3]) box(g, 0, y, -6.3, 8.8, 0.16, 0.16, '#5d6470');
    neon(g, 'BLOB', '#ff5fb0', 0, 4.4, -6.15, 8.2);
    // satellite dish on the hut, antenna, pipes
    const dish = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2.7), new THREE.MeshLambertMaterial({ color: '#5b5e66', side: THREE.DoubleSide }));
    dish.scale.set(1.1, 0.55, 1.1); dish.position.set(-6.2, 3.35, -3.7); dish.rotation.set(-0.9, 0.5, 0.2); dish.castShadow = Q > 0; g.add(dish);
    cyl(g, -6.2, 2.75, -3.7, 0.06, 0.9, '#7d838d'); box(g, -6.2, 2.36, -3.7, 0.5, 0.1, 0.5, '#7d838d');
    cyl(g, 7.0, 3.4, -4.6, 0.05, 5.2, '#8a919d'); for (let i = 0; i < 4; i++) box(g, 7.0, 3.2 + i * 0.7, -4.6, 1.4 - i * 0.25, 0.04, 0.04, '#8a919d');
    for (const z of [-5.75, 5.75]) cyl(g, 0, -0.6, z, 0.09, 16, '#8a7f78', 'x');
    // skylight frames stay when the glass goes
    for (const x of [-4, 4]) { for (const s of [-1, 1]) { box(g, x + s * 1.2, 0.05, 0, 0.1, 0.12, 2.5, '#6d7480'); box(g, x, 0.05, s * 1.2, 2.5, 0.12, 0.1, '#6d7480'); } box(g, x, -3, 0, 2.3, 0.1, 2.3, '#3b3540'); }
  },
  ring(g, st, anim) {
    box(g, 0, -1.6, 0, 70, 0.8, 60, '#2a2126');
    box(g, 0, -0.62, 0, 9.3, 1.16, 9.3, '#2c58a8'); box(g, 0, -0.15, 0, 9.34, 0.1, 9.34, '#f2f2f2');
    for (const [x, z] of [[0, 5.4], [5.4, 0]]) box(g, x, -0.9, z, x ? 1 : 1.8, 0.6, x ? 1.8 : 1, '#3c3f48');
    // crowd
    const r = rng(11), cols = ['#3a3540', '#4a3b45', '#2f2c38', '#4f4350', '#d8382f', '#2c58a8', '#e0b22a', '#3f9a58'];
    const body = new THREE.InstancedMesh(geo().sph, new THREE.MeshLambertMaterial({ color: '#ffffff' }), 4 * 4 * (Q ? 26 : 14));
    const mm = new THREE.Matrix4(), col = new THREE.Color(); let n = 0; const seats = [];
    for (let side = 0; side < 4; side++) for (let row = 0; row < 4; row++) {
      const dist = 9 + row * 1.5, y = -0.9 + row * 0.7, cnt = Q ? 26 : 14;
      box(g, side % 2 ? (side === 1 ? dist : -dist) : 0, y - 0.55, side % 2 ? 0 : (side === 0 ? -dist : dist), side % 2 ? 1.4 : 30, 0.5, side % 2 ? 30 : 1.4, '#332a30');
      for (let i = 0; i < cnt; i++) {
        const u = -14 + i * 28 / (cnt - 1) + (r() - 0.5) * 0.4, x = side % 2 ? (side === 1 ? dist : -dist) : u, z = side % 2 ? u : (side === 0 ? -dist : dist);
        if (side === 2 && row < 2) continue;
        seats.push([x, y, z, r() * 6.28]); mm.makeScale(0.36, 0.62, 0.36); mm.setPosition(x, y, z); body.setMatrixAt(n, mm); body.setColorAt(n, col.set(cols[(r() * (r() < 0.7 ? 4 : 8)) | 0])); n++;
      }
    }
    body.count = n; body.instanceMatrix.needsUpdate = true; g.add(body);
    if (Q) anim.push((dt, t) => { for (let i = 0; i < n; i += 3) { const s = seats[i]; mm.makeScale(0.36, 0.62, 0.36); mm.setPosition(s[0], s[1] + Math.max(0, Math.sin(t * 3 + s[3])) * 0.18, s[2]); body.setMatrixAt(i, mm); } body.instanceMatrix.needsUpdate = true; });
    // lighting rig
    for (const s of [-1, 1]) { box(g, 0, 9, s * 4, 12, 0.25, 0.25, '#3c3f48'); box(g, s * 4, 9, 0, 0.25, 0.25, 12, '#3c3f48'); }
    for (const [x, z] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) { const c = add(g, geo().cone, basic('#fff3c8', { transparent: true, opacity: 0.1, depthWrite: false }), x * 0.6, 4.5, z * 0.6, 3.2, 9, 3.2); c.castShadow = c.receiveShadow = false; cyl(g, x, 8.7, z, 0.3, 0.5, '#26262c'); }
    neon(g, 'FIGHT', '#ffd24a', 0, 6.5, -16, 12);
  },
  subway(g, st, anim, ctx) {
    // tunnel mouths, two tracks, the island's safety lines, lights
    for (const sx of [-1, 1]) { box(g, sx * 19.5, 1.9, 0, 12, 7, 12.4, '#0c0d10'); box(g, sx * 13.2, 5.9, 0, 0.7, 1.4, 12.4, lmap(rep(T.wtile(), 10, 2))); }
    for (const zc of [-3.95, 3.95]) {
      for (const dz of [-0.72, 0.72]) box(g, 0, -1.24, zc + dz, 60, 0.12, 0.1, '#9aa0ab');
      for (let i = -13; i <= 13; i++) box(g, i * 1.0, -1.28, zc, 0.3, 0.06, 2.1, '#5a4636');
    }
    for (const sz of [-1, 1]) box(g, 0, 0.012, sz * 1.96, 22, 0.02, 0.36, '#f0c022');
    box(g, 0, 3.3, -5.78, 26, 0.5, 0.04, '#23508f'); const sg = new THREE.Mesh(geo().plane, lmap(T.station())); sg.scale.set(5, 1.25, 1); sg.position.set(0, 2.4, -5.77); g.add(sg);
    for (const [x, c] of [[-9, '#d8382f'], [-4.5, '#e0b22a'], [4.5, '#3f9a58'], [9, '#8b5fc7']]) box(g, x, 2.2, -5.77, 2.2, 1.5, 0.04, c);
    for (let i = 0; i < 5; i++) { const l = add(g, geo().box, basic('#fff7dc'), -9.6 + i * 4.8, 6.4, 0, 2.6, 0.08, 0.4); l.castShadow = false; box(g, -9.6 + i * 4.8, 6.5, 0, 2.8, 0.1, 0.6, '#3c3f48'); }
    for (const x of [-5.5, 5.5]) box(g, x, 3.05, 0, 0.9, 0.12, 0.9, '#c9c5ba');
    const lamps = []; for (const sx of [-1, 1]) for (const z of [-3.95, 3.95]) lamps.push([add(g, geo().sph, basic('#401010'), sx * 12.7, 3.6, z, 0.18, 0.18, 0.18), z < 0 ? 0 : 1]);
    anim.push((dt, t, dyn) => { for (const [l, k] of lamps) { const tau = dyn.movers[k].tau, on = tau > 0.25 && tau < 2.0 && Math.sin(t * 16) > 0; l.material.color.set(on ? '#ff3020' : '#401010'); } });
    ctx.cue = (prev, dyn) => { const out = []; for (let k = 0; k < 2; k++) if (prev.movers[k].tau < 0.3 && dyn.movers[k].tau >= 0.3) out.push('horn'); return out; };
  },
  grind(g, st, anim) {
    box(g, 0, -4.4, 0, 30, 1, 14, '#2a2523');
    const rollers = [];
    for (const s of [-1, 1]) {
      box(g, s * 8.5, -2.2, 0, 3.2, 3.6, 9.4, '#2f2a28'); box(g, s * 7.02, -0.02, 0, 0.1, 0.06, 9, lmap(rep(T.hazard(), 8, 1)));
      for (const dx of [-0.7, 0.7]) { const r = cyl(g, s * 8.5 + dx, -0.85, 0, 0.6, 9, '#8a919d', 'z'); for (let i = 0; i < 18; i++) { const sp = add(r, geo().cone, lam('#c9ccd4'), Math.cos(i * 2.1) * 1.05, -0.45 + i / 18 * 0.9, Math.sin(i * 2.1) * 1.05, 0.16, 0.05, 0.16); sp.rotation.set(Math.sin(i * 2.1) * 1.57, 0, -Math.cos(i * 2.1) * 1.57); } rollers.push([r, dx * s > 0 ? 1 : -1]); }
    }
    anim.push(dt => { for (const [r, d] of rollers) r.rotation.y += dt * 6 * d; });
    for (const x of [-2.6, 2.6]) box(g, x, 6.75, 0, 0.3, 0.3, 12, '#4d525c');
    for (let i = 0; i < 6; i++) cyl(g, -9 + i * 3.6, 5, -4.45, 0.22, 10, '#6a6f7a');
    cyl(g, 0, 8.4, -4.4, 0.35, 22, '#6a6f7a', 'x');
    for (const s of [-1, 1]) { const l = add(g, geo().sph, basic('#ff3020'), s * 7.4, 3.2, -4.4, 0.2, 0.2, 0.2); anim.push((dt, t) => { l.scale.setScalar(0.14 + Math.abs(Math.sin(t * 4)) * 0.1); }); }
  },
  incinerator(g, st, anim) {
    box(g, 0, -4, 0, 34, 1, 16, '#3a2a22');
    // furnace: glowing mouth + flames
    const glow = add(g, geo().plane, basic('#ffb347'), -8.02, 1.9, 0, 4.2, 3.8, 1); glow.rotation.y = Math.PI / 2; glow.castShadow = false;
    box(g, -11.5, 2.4, 0, 3, 8, 8, '#4a3530'); cyl(g, -11, 10, 0, 1.1, 8, '#4a3530');
    const flames = []; const fm = [basic('#ff7a1f', { transparent: true, opacity: 0.9 }), basic('#ffd04d', { transparent: true, opacity: 0.9 })];
    for (let i = 0; i < 9; i++) { const f = add(g, geo().cone, fm[i & 1], -8.5 - (i % 3) * 0.5, 1, -1.8 + (i % 5) * 0.9, 0.5, 2, 0.5); f.castShadow = false; flames.push(f); }
    anim.push((dt, t) => { flames.forEach((f, i) => { const s = 1.6 + Math.sin(t * 9 + i * 1.7) * 0.7; f.scale.y = s; f.position.y = 0.1 + s / 2; }); glow.material.color.setHSL(0.08 + Math.sin(t * 7) * 0.012, 1, 0.6 + Math.sin(t * 11) * 0.05); });
    // chute at the other end, rails on the catwalks, trash riding the belt
    box(g, 9.4, 2.6, 0, 1.4, 0.3, 4.6, '#6a6f7a').rotation.z = 0.5;
    for (const z of [-4.0, 4.0]) { for (let i = 0; i < 9; i++) cyl(g, -7.6 + i * 1.95, 1.0, z, 0.04, 1.0, '#e0b22a'); box(g, 0.2, 1.5, z, 16.4, 0.07, 0.07, '#e0b22a'); box(g, 0.2, 1.05, z, 16.4, 0.05, 0.05, '#e0b22a'); }
    const bags = []; const r = rng(5);
    for (let i = 0; i < 7; i++) bags.push([sph(g, 0, 0.2, (r() - 0.5) * 3.4, 0.28 + r() * 0.14, 0.2, 0.3, ['#3c3f48', '#565a66', '#7a5a3c'][i % 3]), r() * 16]);
    anim.push((dt, t, dyn) => { for (const b of bags) { b[1] = (b[1] + 2.2 * dyn.conv * dt) % 16; b[0].position.x = 8 - b[1]; } });
    for (let i = 0; i < 5; i++) cyl(g, -6 + i * 4, 6, -4.2, 0.25, 10, '#6a4a3c');
  },
  trucks(g, st, anim) {
    const rt = rep(T.road(), 30, 1), road = add(g, geo().plane, lmap(rt), 0, -3.06, 0, 300, 10, 1); road.rotation.x = -Math.PI / 2; road.castShadow = false;
    const sand = add(g, geo().plane, lam('#d9c8a0'), 0, -3.1, 0, 400, 240, 1); sand.rotation.x = -Math.PI / 2; sand.castShadow = false;
    for (const z of [-5.3, 5.3]) box(g, 0, -2.6, z, 300, 0.18, 0.08, '#c9ccd4');
    const props = []; const r = rng(3);
    for (let i = 0; i < 14; i++) {
      const o = new THREE.Group(), z = (i & 1 ? 1 : -1) * (7 + r() * 8);
      if (i % 3 === 0) { cyl(o, 0, 1.5, 0, 0.28, 3, '#5f9a4e'); cyl(o, 0.5, 1.9, 0, 0.16, 1.0, '#5f9a4e'); cyl(o, 0.5, 1.5, 0, 0.16, 0.6, '#5f9a4e', 'x'); }
      else if (i % 3 === 1) { cyl(o, 0, 3, 0, 0.09, 6, '#8a919d'); box(o, 0.6, 5.9, 0, 1.4, 0.12, 0.3, '#8a919d'); }
      else { sph(o, 0, 0.4, 0, 1.4 + r(), 0.8, 1.2, '#b8a47c'); }
      o.position.set(0, -3.05, z); g.add(o); props.push([o, r() * 160]);
    }
    for (const [x, z, s] of [[-60, -70, 30], [20, -90, 44], [90, -80, 34]]) { const m = cone(g, x, -3 + s * 0.3, z, s, s * 0.6, '#c9a985'); m.castShadow = false; }
    anim.push((dt) => { rt.offset.x -= dt * 17 / 10; for (const p of props) { p[1] = (p[1] + 17 * dt) % 160; p[0].position.x = -80 + p[1]; } });
  },
  blimp(g, st, anim) {
    const e = st.ellipsoids[0], env = sph(g, e.x, e.y, e.z, e.rx, e.ry, e.rz, lmap(rep(T.envelope(), 4, 1))); env.castShadow = false;
    box(g, 0, -9.6, 0, 6, 1.6, 2.2, '#8a6a48'); for (let i = 0; i < 4; i++) box(g, -2 + i * 1.3, -9.4, 1.11, 0.8, 0.6, 0.02, '#9fd4f5');
    for (const s of [-1, 1]) { const f = box(g, 8.2, -4.4, s * 2.6, 3, 0.3, 2.6, '#f1ead9'); f.rotation.x = s * 0.5; box(g, 8.2, -6.6, 0, 3, 2.2, 0.3, '#f1ead9'); }
    const props = []; for (const s of [-1, 1]) { rod(g, [1, -7, s * 3.4], [1, -8.2, s * 5.2], 0.1, '#7d838d'); const p = box(g, 0.6, -8.2, s * 5.2, 0.12, 2.4, 0.3, '#3c3f48'); props.push(p); cyl(g, 1.2, -8.2, s * 5.2, 0.4, 1.2, '#cf4a3c', 'x'); }
    const cl = lam('#ffffff'), clouds = []; const r = rng(2);
    for (let i = 0; i < (Q ? 22 : 10); i++) clouds.push([cloud(g, 0, -14 - r() * 16, -50 + r() * 100, 4 + r() * 6, cl), r() * 240, 3 + r() * 5]);
    anim.push((dt) => { for (const p of props) p.rotation.x += dt * 22; for (const c of clouds) { c[1] = (c[1] + c[2] * dt) % 240; c[0].position.x = -120 + c[1]; } });
  },
  girders(g, st, anim) {
    skyline(g, -30, '#e9c9da', Q ? 50 : 24, 40, 160, 21);
    for (const x of [-6, 0, 6]) for (const z of [-3.2, 0, 3.2]) { if (x === 0 && z === 0) continue; box(g, x, -25.7, z, 0.8, 50, 0.8, lmap(rep(T.rivets(), 1, 50))); }
    for (const y of [-6, -12, -18]) { for (const z of [-3.2, 3.2]) box(g, 0, y, z, 12.8, 0.5, 0.5, '#a8432a'); for (const x of [-6, 6]) box(g, x, y, 0, 0.5, 0.5, 6.9, '#a8432a'); }
    box(g, -12, 4, -6, 1.2, 60, 1.2, '#e0b22a'); box(g, -2, 9.6, -6, 24, 0.9, 0.9, '#e0b22a'); box(g, 0, 9.5, -2.2, 0.5, 0.5, 8.4, '#e0b22a');
    box(g, -3.4, 0.3, -2.2, 0.5, 0.36, 0.3, '#d8382f'); cone(g, -1.4, 0.4, -0.9, 0.16, 0.5, '#ee8130'); cone(g, 4.6, 0.4, 2.2, 0.16, 0.5, '#ee8130');
  },
  containers(g, st, anim) {
    const wt = rep(T.water(), 30, 30), water = add(g, geo().plane, lmap(wt), 0, -4.5, 0, 400, 400, 1); water.rotation.x = -Math.PI / 2; water.castShadow = false;
    anim.push((dt) => { wt.offset.x += dt * 0.02; wt.offset.y += dt * 0.012; });
    for (const x of [-3.9, 3.9]) { box(g, x, -3.5, 0, 6.6, 1.8, 6.4, '#4d525c'); box(g, x, -2.65, 0, 6.8, 0.14, 6.6, '#3c3f48'); }
    // gantry crane carrying the moving container
    box(g, 0, 18, -1, 1.0, 1.0, 16, '#e0b22a'); for (const s of [-1, 1]) { box(g, s * 3, 6.5, -9, 0.8, 23, 0.8, '#e0b22a'); box(g, s * 3, 18.2, -9, 0.9, 0.6, 0.9, '#e0b22a'); } box(g, 0, 17.6, -9, 7, 0.8, 0.8, '#e0b22a');
    const r = rng(6), tints = ['#c8433a', '#3b78c2', '#3f9a58', '#e0a63a', '#d9772f', '#2f9c9c', '#8b5fc7'];
    for (let i = 0; i < 16; i++) { const x = -26 + (i % 8) * 7.2, lvl = (r() * 3) | 0; for (let k = 0; k <= lvl; k++) contMesh(g, x, -3.2 + k * 2.6, -16 - Math.floor(i / 8) * 3, 6.1, 2.6, 2.6, tints[(r() * 7) | 0]); }
    box(g, 0, -4.2, -17.5, 70, 1.6, 9, '#6a6f7a');
    box(g, 44, -1, -40, 40, 8, 9, '#3c3f48'); box(g, 52, 5, -40, 8, 6, 7, '#f2f2f2');
  },
  elevators(g, st, anim) {
    for (const x of [-2.35, 2.35]) for (const s of [-1, 1]) box(g, x + s * 1.9, 4, -2.5, 0.16, 40, 0.16, '#33363d');
    for (let i = -3; i < 4; i++) { box(g, 0, i * 5.2 - 2.9, -2.58, 9.4, 0.18, 0.05, '#3f4651'); for (const x of [-2.35, 2.35]) box(g, x, i * 5.2 - 0.3, -2.57, 2.4, 3.2, 0.04, '#77808f'); }
    for (const s of [-1, 1]) { for (let i = 0; i < 4; i++) cyl(g, s * (5.0 + i * 0.8), 0.55, 2.42, 0.035, 1.1, '#e0b22a'); box(g, s * 6.3, 1.1, 2.42, 2.9, 0.07, 0.07, '#e0b22a'); }
    const l = add(g, geo().sph, basic('#fff3c8'), 0, 7.5, 0, 0.3, 0.3, 0.3); l.castShadow = false; cyl(g, 0, 11, 0, 0.02, 7, '#222');
    box(g, 0, -13.5, 0, 20, 1, 8, '#22252b');
  }
};

// ---- public -----------------------------------------------------------------------------------------------------
export function setStageQuality(q) { Q = q; }

export function buildStage(stage) {
  const g = new THREE.Group(), anim = [], ctx = { cue: null };
  const s = { group: g, stage, breaks: [], movers: [], bumpers: [], prev: null, ctx };
  for (const b of stage.solids) solidMesh(g, b, stage, anim);
  for (const b of stage.breakables || []) {
    let m;
    if (b.m === 'glass') { m = box(g, b.x, b.y - b.h / 2, b.z, b.w, b.h, b.d, new THREE.MeshLambertMaterial({ color: '#d6f1fb', transparent: true, opacity: 0.62 })); m.castShadow = false; for (const k of [-0.5, 0.1, 0.6]) { const sh = box(m, k, 0.52, 0, 0.05, 0.02, 0.8, basic('#ffffff', { transparent: true, opacity: 0.55 })); sh.rotation.y = 0.6; sh.castShadow = sh.receiveShadow = false; } }
    else m = box(g, b.x, b.y - b.h / 2, b.z, b.w, b.h, b.d, lmap(rep(T.wood(), b.w / 2.4, b.d / 1.2)));
    s.breaks.push(m);
  }
  for (const d of stage.movers || []) { const m = moverModel(d); g.add(m); s.movers.push(m); }
  for (const d of stage.bumpers || []) {
    const m = bumperModel(d); g.add(m);
    const lines = d.model === 'beef' ? [rod(g, [0, 0, 0], [0, 1, 0], 0.03, '#8a919d')] : [rod(g, [0, 0, 0], [0, 1, 0], 0.025, '#33363d'), rod(g, [0, 0, 0], [0, 1, 0], 0.025, '#33363d')];
    s.bumpers.push({ m, lines, d });
  }
  if (stage.kills) for (const k of stage.kills) if (k.c === 'fire') { /* drawn by the stage's own scenery */ }
  if (DECO[stage.id]) DECO[stage.id](g, stage, anim, ctx);
  s.update = (gt, dt, t, brokenMask) => {
    const dyn = dynState(stage, gt);
    for (let i = 0; i < s.movers.length; i++) { const p = dyn.movers[i], m = s.movers[i]; m.position.set(p.x, p.y, p.z); const sp = m.userData.spin; if (sp) for (const w of sp) w.rotation.y -= dt * 30; }
    for (let i = 0; i < s.bumpers.length; i++) {
      const p = dyn.bumpers[i], b = s.bumpers[i], d = b.d; b.m.position.set(p.x, p.y, p.z);
      if (d.axis === 'x') b.m.rotation.z = p.ang; else b.m.rotation.x = -p.ang;
      if (b.lines.length === 1) setRod(b.lines[0], d.pivot, [p.x, p.y + d.r * 1.3, p.z]);
      else { setRod(b.lines[0], [d.pivot[0], d.pivot[1], d.pivot[2] - d.half * 0.7], [p.x, p.y + d.r, p.z - d.half * 0.7]); setRod(b.lines[1], [d.pivot[0], d.pivot[1], d.pivot[2] + d.half * 0.7], [p.x, p.y + d.r, p.z + d.half * 0.7]); }
    }
    for (let i = 0; i < s.breaks.length; i++) s.breaks[i].visible = !(brokenMask & (1 << i));
    for (const a of anim) a(dt, t, dyn);
    let cues = null;
    if (ctx.cue && s.prev) cues = ctx.cue(s.prev, dyn);
    s.prev = dyn; s.dyn = dyn;
    return cues;
  };
  return s;
}

// a plain pedestal for the menu and the lobby
export function buildBackdrop() {
  const g = new THREE.Group();
  const fl = add(g, geo().cyl, lam('#f3bcd3'), 0, -0.25, 0, 7.5, 0.5, 7.5); fl.castShadow = false;
  const rim = add(g, geo().cyl, lam('#e79fbe'), 0, -0.3, 0, 7.8, 0.44, 7.8); rim.castShadow = false;
  return { group: g, stage: { sky: ['#f6bfd8', '#fde8f1'], fog: ['#f8d3e3', 20, 80] }, update() { return null; }, breaks: [], movers: [], bumpers: [] };
}
