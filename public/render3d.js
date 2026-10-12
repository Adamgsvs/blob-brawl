// 3D rendering with three.js: chunky bean characters with species + outfits, detailed arenas, particles, camera.
import * as THREE from 'three';

const PAL = ['#ff4d5e', '#ff9a2e', '#ffd21f', '#a6e22e', '#4fd05a', '#1fc8b4', '#3d97ff', '#2a5bd7', '#7a5cff', '#bf5cff', '#ff6cc0', '#f2f2f2', '#9a6b50', '#6b4a3a', '#8a8fa0', '#2f2f3d'];
const TEAM = ['#ff4d6d', '#3fa0ff'];
const SPECIES = 10, OUTFITS = 10, HAT_COUNT = 12, FACE_COUNT = 6;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

let renderer, scene, camera, sun, hemi, quality = 1, W = 800, H = 450;
let mapObj = null, curMap = null;
const blobs = new Map(), tagCache = new Map();
const cam = { tx: 0, ty: 1, tz: 0, d: 20, init: false };

// ------------------------------------------------------------------ shared geometry / materials / textures
const G = {};
function initGeo() {
  const seg = quality === 0 ? 10 : 18;
  G.sphere = new THREE.SphereGeometry(1, seg, Math.max(8, seg - 6));
  G.cyl = new THREE.CylinderGeometry(1, 1, 1, seg);
  G.box = new THREE.BoxGeometry(1, 1, 1);
  G.cone = new THREE.ConeGeometry(1, 1, seg);
  G.torus = new THREE.TorusGeometry(1, 0.2, 8, 20);
  G.octa = new THREE.OctahedronGeometry(1);
  G.plane = new THREE.PlaneGeometry(1, 1);
  G.dish = new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2.6);
}
const matCache = new Map();
function mat(color, extra) {
  const k = color + (extra ? JSON.stringify(extra) : '');
  let m = matCache.get(k);
  if (!m) { m = new THREE.MeshLambertMaterial(Object.assign({ color }, extra || {})); matCache.set(k, m); }
  return m;
}
function mesh(geo, material, sx, sy, sz) { const m = new THREE.Mesh(geo, material); m.scale.set(sx, sy === undefined ? sx : sy, sz === undefined ? sx : sz); return m; }
function shade(hex, f) { const c = new THREE.Color(hex); c.multiplyScalar(f); return '#' + c.getHexString(); }
function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; if (repeat) t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 4; return t;
}
const texCache = {};
function cachedTex(key, make) { return texCache[key] || (texCache[key] = make()); }
function withRepeat(tex, rx, ry) { const t = tex.clone(); t.needsUpdate = true; t.repeat.set(rx, ry); return t; }
function speckle(x, w, h, n, c1, c2, s) { const r = rng(7); for (let i = 0; i < n; i++) { x.fillStyle = r() < .5 ? c1 : c2; x.globalAlpha = .25 + r() * .3; x.fillRect(r() * w, r() * h, s * (1 + r() * 2), s * (1 + r() * 2)); } x.globalAlpha = 1; }
const T = {
  concrete: () => cachedTex('concrete', () => canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#8f8a82'; x.fillRect(0, 0, w, h); speckle(x, w, h, 500, '#a8a39a', '#6f6a62', 2); x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = 2; x.strokeRect(0, 0, w, h); })),
  roofTop: () => cachedTex('roofTop', () => canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#7d756f'; x.fillRect(0, 0, w, h); speckle(x, w, h, 700, '#948c85', '#5f5852', 2); x.strokeStyle = 'rgba(0,0,0,.22)'; x.lineWidth = 3; x.strokeRect(0, 0, w, h); })),
  brick: () => cachedTex('brick', () => canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#b9694a'; x.fillRect(0, 0, w, h); x.fillStyle = '#d9c3a8'; for (let r = 0; r < 8; r++) { x.fillRect(0, r * 16, w, 3); for (let c = 0; c < 4; c++) x.fillRect((c * 32 + (r % 2) * 16) % w, r * 16, 3, 16); } speckle(x, w, h, 200, '#c97a58', '#98543a', 3); })),
  parapet: () => cachedTex('parapet', () => canvasTex(128, 64, (x, w, h) => { x.fillStyle = '#dbb890'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(80,50,20,.35)'; x.fillRect(0, 0, w, 3); x.fillRect(0, 31, w, 3); for (let i = 0; i < 4; i++) x.fillRect(i * 32 + 1, 0, 3, 34); speckle(x, w, h, 150, '#e8cca8', '#b8956c', 2); })),
  wood: () => cachedTex('wood', () => canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#c99a5b'; x.fillRect(0, 0, w, h); for (let i = 0; i < 4; i++) { x.fillStyle = i % 2 ? '#bd8c4d' : '#d4a768'; x.fillRect(0, i * 32, w, 30); x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, i * 32 + 30, w, 2); } speckle(x, w, h, 120, '#8a5a26', '#e3b97a', 3); })),
  mat: () => cachedTex('mat', () => canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#b07a52'; x.fillRect(0, 0, w, h); speckle(x, w, h, 600, '#c28a60', '#8f5c3a', 2); x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 6; x.beginPath(); x.arc(w / 2, h / 2, 70, 0, 6.3); x.stroke(); x.font = '900 40px Impact, sans-serif'; x.fillStyle = 'rgba(255,255,255,.5)'; x.textAlign = 'center'; x.fillText('BB', w / 2, h / 2 + 14); })),
  metal: () => cachedTex('metal', () => canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#6d7686'; x.fillRect(0, 0, w, h); speckle(x, w, h, 300, '#8a94a6', '#4a5260', 2); x.fillStyle = '#e8b520'; for (let i = 0; i < 8; i++) { x.beginPath(); x.moveTo(i * 20 - 10, 0); x.lineTo(i * 20 + 3, 0); x.lineTo(i * 20 + 13, 12); x.lineTo(i * 20, 12); x.fill(); } x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 3; x.strokeRect(0, 0, w, h); })),
  tileTop: () => cachedTex('tileTop', () => canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#d9d6cc'; x.fillRect(0, 0, w, h); speckle(x, w, h, 300, '#e8e5dc', '#b5b2a8', 2); x.strokeStyle = '#a9a69b'; x.lineWidth = 3; x.strokeRect(0, 0, w, h); x.beginPath(); x.moveTo(64, 0); x.lineTo(64, 128); x.moveTo(0, 64); x.lineTo(128, 64); x.stroke(); })),
  tileSide: () => cachedTex('tileSide', () => canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#f1efe8'; x.fillRect(0, 0, w, h); x.strokeStyle = '#c9c6bb'; x.lineWidth = 3; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * 32, 0); x.lineTo(i * 32, 128); x.moveTo(0, i * 32); x.lineTo(128, i * 32); x.stroke(); } })),
  track: () => cachedTex('track', () => canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#4b463f'; x.fillRect(0, 0, w, h); speckle(x, w, h, 500, '#6a645b', '#2f2b26', 3); x.fillStyle = '#6b4a30'; for (let i = 0; i < 4; i++) x.fillRect(i * 32 + 6, 0, 14, 128); x.fillStyle = '#9aa0a8'; x.fillRect(0, 26, 128, 6); x.fillRect(0, 96, 128, 6); })),
  cont: (c) => cachedTex('cont' + c, () => canvasTex(128, 128, (x, w, h) => { x.fillStyle = c; x.fillRect(0, 0, w, h); for (let i = 0; i < 16; i++) { x.fillStyle = 'rgba(0,0,0,.22)'; x.fillRect(i * 8, 0, 3, h); x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(i * 8 + 3, 0, 2, h); } speckle(x, w, h, 150, '#ffffff', '#000000', 2); })),
  steel: () => cachedTex('steel', () => canvasTex(64, 64, (x, w, h) => { x.fillStyle = '#7c3a30'; x.fillRect(0, 0, w, h); speckle(x, w, h, 200, '#964a3e', '#5a2a22', 2); })),
  grid: () => cachedTex('grid', () => canvasTex(64, 64, (x, w, h) => { x.fillStyle = '#566074'; x.fillRect(0, 0, w, h); x.strokeStyle = '#2a3140'; x.lineWidth = 4; x.strokeRect(0, 0, w, h); x.beginPath(); x.moveTo(32, 0); x.lineTo(32, 64); x.moveTo(0, 32); x.lineTo(64, 32); x.stroke(); })),
  pot: () => cachedTex('pot', () => canvasTex(64, 64, (x, w, h) => { x.fillStyle = '#c4683d'; x.fillRect(0, 0, w, h); speckle(x, w, h, 120, '#d9804f', '#9a4a28', 2); x.fillStyle = '#a8522c'; x.fillRect(0, 0, w, 10); })),
  fan: () => cachedTex('fan', () => canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#9aa3b2'; x.fillRect(0, 0, w, h); x.fillStyle = '#4a5260'; x.beginPath(); x.arc(64, 64, 46, 0, 6.3); x.fill(); x.strokeStyle = '#9aa3b2'; x.lineWidth = 4; for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(64, 64, 10 + i * 10, 0, 6.3); x.stroke(); } })),
  crate: () => cachedTex('crate', () => canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#d9a05b'; x.fillRect(0, 0, w, h); x.strokeStyle = '#8a5a26'; x.lineWidth = 10; x.strokeRect(5, 5, w - 10, h - 10); x.lineWidth = 8; x.beginPath(); x.moveTo(8, 8); x.lineTo(w - 8, h - 8); x.moveTo(w - 8, 8); x.lineTo(8, h - 8); x.stroke(); })),
  arrow: () => canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#4a4e6a'; x.fillRect(0, 0, w, h); x.fillStyle = '#ffd21f'; for (let i = 0; i < 2; i++) { x.beginPath(); x.moveTo(20 + i * 56, 24); x.lineTo(56 + i * 56, 64); x.lineTo(20 + i * 56, 104); x.lineTo(34 + i * 56, 104); x.lineTo(70 + i * 56, 64); x.lineTo(34 + i * 56, 24); x.fill(); } }),
  stripe: () => cachedTex('stripe', () => canvasTex(64, 64, (x, w, h) => { x.fillStyle = '#ffd21f'; x.fillRect(0, 0, w, h); x.fillStyle = '#2a1b4e'; for (let i = -1; i < 3; i++) { x.beginPath(); x.moveTo(i * 32, 0); x.lineTo(i * 32 + 16, 0); x.lineTo(i * 32 + 48, h); x.lineTo(i * 32 + 32, h); x.fill(); } })),
  lava: () => cachedTex('lava', () => canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#ff6a1a'; x.fillRect(0, 0, w, h); const r = rng(3); for (let i = 0; i < 60; i++) { x.fillStyle = r() < .5 ? '#ffd04d' : '#c92a0a'; x.beginPath(); x.arc(r() * w, r() * h, 6 + r() * 18, 0, 6.3); x.fill(); } }, [60, 60])),
  checker: (a, b) => cachedTex('chk' + a + b, () => canvasTex(128, 128, (x, w, h) => { x.fillStyle = a; x.fillRect(0, 0, w, h); x.fillStyle = b; x.fillRect(0, 0, w / 2, h / 2); x.fillRect(w / 2, h / 2, w / 2, h / 2); })),
  windows: (lit) => cachedTex('win' + lit, () => canvasTex(64, 128, (x, w, h) => { x.fillStyle = lit ? '#b5a6c4' : '#9a90ac'; x.fillRect(0, 0, w, h); const r = rng(lit ? 5 : 9); for (let j = 0; j < 8; j++) for (let i = 0; i < 4; i++) { x.fillStyle = r() < .2 ? '#fff3c4' : '#4a4660'; x.fillRect(4 + i * 15, 6 + j * 15, 9, 10); } })),
  stripes: (c1, c2) => cachedTex('str' + c1 + c2, () => canvasTex(16, 64, (x, w, h) => { x.fillStyle = c1; x.fillRect(0, 0, w, h); x.fillStyle = c2; for (let i = 0; i < 4; i++) x.fillRect(0, i * 16 + 4, w, 8); })),
  hawaii: (c1, c2) => cachedTex('haw' + c1 + c2, () => canvasTex(128, 128, (x, w, h) => { x.fillStyle = c1; x.fillRect(0, 0, w, h); const r = rng(11); for (let i = 0; i < 14; i++) { const px = r() * w, py = r() * h; x.fillStyle = c2; for (let k = 0; k < 5; k++) { x.beginPath(); x.arc(px + Math.cos(k * 1.256) * 7, py + Math.sin(k * 1.256) * 7, 5, 0, 6.3); x.fill(); } x.fillStyle = '#ffe14d'; x.beginPath(); x.arc(px, py, 4, 0, 6.3); x.fill(); } })),
  ribs: () => cachedTex('ribs', () => canvasTex(64, 128, (x, w, h) => { x.fillStyle = '#1c1c26'; x.fillRect(0, 0, w, h); x.strokeStyle = '#f2f2f2'; x.lineWidth = 5; x.lineCap = 'round'; for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(8, 18 + i * 18); x.quadraticCurveTo(32, 8 + i * 18, 56, 18 + i * 18); x.stroke(); } x.beginPath(); x.moveTo(32, 6); x.lineTo(32, 122); x.stroke(); })),
  neon: (text) => cachedTex('neon' + text, () => canvasTex(512, 160, (x, w, h) => { x.clearRect(0, 0, w, h); x.font = '900 100px "Lilita One", Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = '#ff7ac8'; x.shadowBlur = 24; x.fillStyle = '#ff9bd6'; x.fillText(text, w / 2, h / 2); x.shadowBlur = 0; x.fillStyle = '#fff0fa'; x.fillText(text, w / 2, h / 2 - 2); }))
};

// ------------------------------------------------------------------ hats
function buildHat(h) {
  const g = new THREE.Group();
  const add = (m, x, y, z) => { m.position.set(x || 0, y || 0, z || 0); g.add(m); return m; };
  switch (h) {
    case 1: add(mesh(G.cyl, mat('#ffd21f'), .27, .1, .27), 0, .02, 0); for (let i = 0; i < 5; i++) { const a = i * 1.2566; add(mesh(G.cone, mat('#ffd21f'), .07, .2, .07), Math.cos(a) * .25, .17, Math.sin(a) * .25); } break;
    case 2: add(mesh(G.cone, mat('#ff6cc0'), .24, .62, .24), 0, .3, 0); add(mesh(G.sphere, mat('#ffd21f'), .07), 0, .63, 0); break;
    case 3: add(mesh(G.sphere, mat('#ff4d5e'), .37, .28, .37), 0, .08, 0); add(mesh(G.cyl, mat('#d63a4a'), .25, .03, .34), 0, .06, .34); break;
    case 4: for (const s of [-1, 1]) { const c = add(mesh(G.cone, mat('#e63946'), .09, .34, .09), s * .24, .3, 0); c.rotation.z = -s * .45; } break;
    case 5: add(mesh(G.cyl, mat('#ffffff'), .28, .2, .28), 0, .12, 0); for (const [x, z] of [[-.16, 0], [.16, 0], [0, .16], [0, -.16]]) add(mesh(G.sphere, mat('#ffffff'), .19), x, .36, z); break;
    case 6: add(mesh(G.cyl, mat('#9a6b3f'), .55, .03, .55), 0, .1, 0); add(mesh(G.cyl, mat('#b07d4a'), .26, .24, .26), 0, .24, 0); break;
    case 7: for (const s of [-1, 1]) { add(mesh(G.sphere, mat('#ffffff'), .08, .36, .06), s * .14, .56, 0).rotation.z = -s * .15; add(mesh(G.sphere, mat('#ffb3d1'), .04, .27, .03), s * .14, .56, .04).rotation.z = -s * .15; } break;
    case 8: add(mesh(G.sphere, mat('#3d97ff'), .34, .26, .34), 0, .1, 0); add(mesh(G.cyl, mat('#555'), .02, .14, .02), 0, .36, 0); g.userData.prop = add(mesh(G.box, mat('#ffd21f'), .6, .02, .09), 0, .44, 0); break;
    case 9: add(mesh(G.cyl, mat('#2d2d3a'), .42, .03, .42), 0, .08, 0); add(mesh(G.cyl, mat('#2d2d3a'), .26, .36, .26), 0, .26, 0); add(mesh(G.cyl, mat('#e63946'), .265, .07, .265), 0, .15, 0); break;
    case 10: for (const s of [-1, 1]) { add(mesh(G.cone, mat('#ffb347'), .12, .26, .06), s * .2, .34, 0).rotation.z = -s * .35; } break;
    case 11: for (let i = 0; i < 5; i++) { const a = i * 1.2566; add(mesh(G.sphere, mat('#ff8fab'), .07), .17 + Math.cos(a) * .1, .38 + Math.sin(a) * .1, 0); } add(mesh(G.sphere, mat('#ffd21f'), .065), .17, .38, 0); break;
  }
  return g;
}

// ------------------------------------------------------------------ faces
function buildFace(f, noMouth) {
  const g = new THREE.Group(), white = mat('#ffffff'), black = mat('#1d1330');
  const eye = (x, y, r, px, py) => { const e = mesh(G.sphere, white, r, r * 1.2, r * .55); e.position.set(x, y, .31); g.add(e); const p = mesh(G.sphere, black, r * .48, r * .55, r * .3); p.position.set(x + (px || 0), y + (py || 0), .31 + r * .45); g.add(p); };
  const mouth = (x, y, r, arc, rot) => { if (noMouth) return; const m = new THREE.Mesh(new THREE.TorusGeometry(r, .02, 6, 12, arc), black); m.position.set(x, y, .33); m.rotation.z = rot; g.add(m); };
  switch (f) {
    case 0: eye(-.14, .07, .1, .02); eye(.14, .07, .1, .02); mouth(0, -.06, .1, Math.PI, Math.PI); break;
    case 1: eye(-.14, .07, .12, .03); eye(.14, .06, .07, -.01); if (!noMouth) { const t = mesh(G.sphere, mat('#ff5d8a'), .055, .08, .03); t.position.set(.04, -.2, .32); g.add(t); } mouth(0, -.1, .08, Math.PI, Math.PI); break;
    case 2: eye(-.14, .06, .085); eye(.14, .06, .085); for (const s of [-1, 1]) { const b = mesh(G.box, black, .16, .035, .02); b.position.set(s * .14, .19, .32); b.rotation.z = s * .5; g.add(b); } mouth(0, -.12, .08, Math.PI, 0); break;
    case 3: { const glass = mesh(G.box, black, .42, .12, .07); glass.position.set(0, .07, .31); g.add(glass); mouth(.03, -.06, .09, Math.PI * .8, Math.PI * 1.1); break; }
    case 4: eye(-.14, .08, .12, 0); eye(.14, .08, .12, 0); if (!noMouth) { const m = new THREE.Mesh(new THREE.TorusGeometry(.06, .025, 6, 12), black); m.position.set(0, -.12, .33); g.add(m); } break;
    case 5: eye(-.14, .07, .1, .05); eye(.14, .07, .1, -.05); if (!noMouth) { const m = mesh(G.box, black, .2, .03, .02); m.position.set(0, -.1, .33); m.rotation.z = .25; g.add(m); } break;
  }
  return g;
}
function buildKoFace() {
  const g = new THREE.Group(), black = mat('#1d1330');
  for (const s of [-1, 1]) for (const r of [.78, -.78]) { const b = mesh(G.box, black, .18, .035, .02); b.position.set(s * .14, .07, .32); b.rotation.z = r; g.add(b); }
  const m = mesh(G.sphere, mat('#7a1f3d'), .06, .05, .02); m.position.set(0, -.1, .33); g.add(m);
  return g;
}

// ------------------------------------------------------------------ species (head features + tail)
function addSpecies(b, s, Pc, Sc) {
  const head = b.head;
  const A = (geo, m, x, y, z, sx, sy, sz, rx, ry, rz) => { const o = mesh(geo, m, sx, sy, sz); o.position.set(x, y, z); if (rx || ry || rz) o.rotation.set(rx || 0, ry || 0, rz || 0); head.add(o); return o; };
  const white = mat('#fff'), black = mat('#1d1330'), pink = mat('#ff9cc0'), orange = mat('#ff9a2e'), red = mat('#e63946'), tan = mat('#ecd0a8'), body = mat(Pc), dark = mat(shade(Pc, .7)), light = mat(shade(Pc, 1.25));
  switch (s) {
    case 1: // chicken
      A(G.cone, orange, 0, -.03, .42, .11, .24, .09, Math.PI / 2);
      A(G.sphere, red, 0, .4, .0, .07, .12, .1); A(G.sphere, red, 0, .41, .13, .06, .1, .09); A(G.sphere, red, 0, .38, -.12, .06, .09, .08);
      A(G.sphere, red, 0, -.2, .35, .05, .1, .04);
      b.noMouth = true; b.tail = { geo: G.cone, mat: mat(shade(Pc, .85)), sx: .16, sy: .5, sz: .1, dir: [0, .35, -1], back: .34 }; break;
    case 2: // bear
      for (const x of [-1, 1]) { A(G.sphere, body, x * .27, .27, -.02, .14); A(G.sphere, tan, x * .27, .27, .08, .08, .08, .05); }
      A(G.sphere, tan, 0, -.1, .3, .17, .13, .12); A(G.sphere, black, 0, -.03, .41, .05, .04, .03);
      b.noMouth = true; b.tail = { geo: G.sphere, mat: body, sx: .13, sy: .13, sz: .13, dir: [0, 0, -1], back: .3 }; b.belly = '#ecd0a8'; break;
    case 3: // dinosaur
      A(G.sphere, body, 0, -.1, .3, .2, .14, .2); A(G.sphere, black, -.07, -.02, .48, .025, .025, .02); A(G.sphere, black, .07, -.02, .48, .025, .025, .02);
      for (let i = 0; i < 3; i++) A(G.cone, light, 0, .36 - i * .02, .1 - i * .15, .07, .16, .07, -.3 * i);
      b.noMouth = true; b.tail = { geo: G.cone, mat: body, sx: .2, sy: .85, sz: .2, dir: [0, -.25, -1], back: .55 }; b.belly = shade(Pc, 1.3); break;
    case 4: // cat
      for (const x of [-1, 1]) { A(G.cone, body, x * .24, .3, 0, .1, .22, .07, 0, 0, -x * .3); A(G.cone, pink, x * .24, .28, .04, .06, .14, .03, 0, 0, -x * .3); }
      A(G.sphere, pink, 0, -.04, .35, .035, .025, .02);
      for (const x of [-1, 1]) for (const y of [-.07, 0, .07]) A(G.box, white, x * .28, -.07 + y, .31, .22, .008, .008, 0, x * .3, y * 2);
      b.tail = { geo: G.cyl, mat: body, sx: .06, sy: .6, sz: .06, dir: [0, 1, -.6], back: .3 }; break;
    case 5: // bunny
      for (const x of [-1, 1]) { A(G.sphere, body, x * .15, .5, -.02, .09, .38, .07, 0, 0, -x * .12); A(G.sphere, pink, x * .15, .5, .03, .045, .28, .03, 0, 0, -x * .12); }
      A(G.sphere, pink, 0, -.03, .35, .04, .03, .02); A(G.box, white, 0, -.15, .33, .06, .08, .015);
      b.tail = { geo: G.sphere, mat: white, sx: .15, sy: .15, sz: .15, dir: [0, 0, -1], back: .3 }; break;
    case 6: // frog
      for (const x of [-1, 1]) { A(G.sphere, body, x * .2, .3, .08, .14); A(G.sphere, white, x * .2, .34, .17, .1, .1, .07); A(G.sphere, black, x * .2, .34, .23, .045, .045, .03); }
      A(G.box, black, 0, -.09, .33, .3, .03, .02); b.hideFace = true; b.noMouth = true; b.belly = shade(Pc, 1.3); break;
    case 7: // pig
      A(G.cyl, pink, 0, -.06, .35, .14, .09, .14, Math.PI / 2); A(G.sphere, black, -.05, -.06, .44, .02, .03, .01); A(G.sphere, black, .05, -.06, .44, .02, .03, .01);
      for (const x of [-1, 1]) A(G.cone, body, x * .24, .28, 0, .1, .2, .05, 0.4, 0, -x * .7);
      b.noMouth = true; b.tail = { geo: G.torus, mat: pink, sx: .1, sy: .1, sz: .1, dir: [0, 0, -1], back: .32, curl: true }; break;
    case 8: // shark
      A(G.cone, body, 0, .4, -.05, .04, .3, .22, -.2); for (let i = -2; i <= 2; i++) A(G.cone, white, i * .06, -.13, .33, .025, .06, .02, Math.PI);
      A(G.box, black, 0, -.1, .34, .36, .025, .02); b.noMouth = true; b.tail = { geo: G.cone, mat: body, sx: .05, sy: .55, sz: .3, dir: [0, .7, -.7], back: .3 }; break;
    case 9: // alien
      for (const x of [-1, 1]) { A(G.cyl, dark, x * .15, .5, 0, .015, .3, .015, 0, 0, -x * .25); A(G.sphere, mat('#7dff9a', { emissive: '#2a8a44' }), x * .22, .66, 0, .06); A(G.sphere, black, x * .14, .05, .3, .12, .16, .07, 0, 0, x * .35); }
      b.hideFace = true; b.noMouth = true; break;
  }
}

// ------------------------------------------------------------------ outfits: items attached to the torso (t: 0 = chest .. 1 = hip)
function addOutfit(b, o, Pc, Sc) {
  const S = mat(Sc), Sd = mat(shade(Sc, .7));
  const item = (geo, m, t, rx, fz, sx, sy, sz) => { const mm = mesh(geo, m, sx, sy, sz); mm.userData = { t, rx, fz }; b.root.add(mm); b.items.push(mm); return mm; };
  const headAdd = (m, x, y, z) => { m.position.set(x, y, z); b.head.add(m); return m; };
  const shellMat = tex => new THREE.MeshLambertMaterial({ map: tex });
  switch (o) {
    case 1: item(G.cyl, S, .3, 0, 0, .405, 1.0, .405); break; // tank top
    case 2: item(G.cyl, S, .78, 0, 0, .405, .6, .405); for (const s of [-1, 1]) item(G.box, S, .1, s * .16, .3, .07, .5, .04); item(G.box, Sd, .55, 0, .34, .26, .16, .04); break; // overalls
    case 3: item(G.cyl, S, .45, 0, 0, .405, 1.25, .405); item(G.box, Sd, .75, 0, .33, .42, .22, .05); headAdd(mesh(G.sphere, S, .36, .3, .22), 0, -.02, -.26); break; // hoodie
    case 4: item(G.cyl, S, .82, 0, 0, .405, .45, .405); item(G.cyl, mat('#ffd21f'), .58, 0, 0, .35, .06, .35); headAdd(mesh(G.sphere, S, .385, .385, .385), 0, 0, 0); headAdd(mesh(G.octa, mat('#ffd21f'), .07, .09, .03), 0, .24, .34); break; // luchador
    case 5: item(G.cyl, shellMat(T.stripes('#f4f4f4', Sc)), .38, 0, 0, .405, 1.05, .405); { const bd = mesh(G.torus, mat('#e63946'), .37, .37, .37); bd.rotation.x = Math.PI / 2; bd.position.y = .15; b.head.add(bd); headAdd(mesh(G.sphere, mat('#e63946'), .1), .2, .1, -.3); } break; // pirate
    case 6: item(G.cyl, Sd, .45, 0, 0, .405, 1.25, .405); item(G.cyl, mat('#f2f2f2'), .62, 0, 0, .35, .07, .35); { const bd = mesh(G.torus, S, .365, .365, .365); bd.rotation.x = Math.PI / 2; bd.position.y = .1; b.head.add(bd); headAdd(mesh(G.box, S, .06, .3, .02), -.1, .0, -.38).rotation.z = .3; headAdd(mesh(G.box, S, .06, .26, .02), .12, -.03, -.38).rotation.z = -.2; } break; // ninja
    case 7: item(G.cyl, shellMat(T.hawaii('#1fc8b4', '#ffffff')), .35, 0, 0, .405, .85, .405); break; // hawaiian shirt
    case 8: item(G.cyl, S, .85, 0, 0, .405, .45, .405); item(G.box, Sd, .5, 0, -.37, .66, 1.05, .05); item(G.octa, mat('#ffd21f'), .12, 0, .33, .12, .14, .04); break; // hero
    case 9: item(G.cyl, shellMat(T.ribs()), .45, 0, 0, .405, 1.2, .405); break; // skeleton
  }
}

// ------------------------------------------------------------------ blob character
function makeBlob(look) {
  look = Object.assign({ s: 0, c: 4, d: 6, o: 0, h: 0, f: 0 }, look);
  const Pc = PAL[look.c % 16], Sc = PAL[look.d % 16];
  const body = mat(Pc), limb = mat(shade(Pc, .96)), shoe = mat(shade(Pc, .5));
  const root = new THREE.Group();
  const seg = (r, m) => { const c = mesh(G.cyl, m || body, r, 1, r); root.add(c); return c; };
  const ball = (r, m) => { const s = mesh(G.sphere, m || body, r); root.add(s); return s; };
  const b = {
    root, look, items: [], tail: null, noMouth: false, hideFace: false, belly: null,
    torso: seg(.38), chestB: ball(.39), hipB: ball(.37),
    arms: [seg(.15, limb), seg(.15, limb)], hands: [ball(.19, limb), ball(.19, limb)],
    legs: [seg(.19, limb), seg(.19, limb)], feet: [ball(.2, shoe), ball(.2, shoe)],
    head: new THREE.Group(), stars: []
  };
  addSpecies(b, look.s, Pc, Sc);
  if (b.belly) { b.bellyM = mesh(G.sphere, mat(b.belly), .29, .38, .1); root.add(b.bellyM); }
  b.head.add(mesh(G.sphere, body, .37));
  b.faces = []; for (let i = 0; i < FACE_COUNT; i++) { const f = buildFace(i, b.noMouth); f.visible = false; b.head.add(f); b.faces.push(f); }
  b.ko = buildKoFace(); b.ko.visible = false; b.head.add(b.ko);
  b.hat = buildHat(look.h); b.hat.position.y = .26; b.head.add(b.hat);
  addOutfit(b, look.o, Pc, Sc);
  if (b.tail) { const t = b.tail; b.tailM = mesh(t.geo, t.mat, t.sx, t.sy, t.sz); root.add(b.tailM); }
  b.head.scale.setScalar(1.15); root.add(b.head);
  for (let i = 0; i < 3; i++) { const s = mesh(G.octa, mat('#ffd21f', { emissive: '#aa8800' }), .11); s.visible = false; root.add(s); b.stars.push(s); }
  root.traverse(o => { if (o.isMesh) o.castShadow = quality > 0; });
  b.tag = null; b.tagKey = '';
  return b;
}
const _a = V(0, 0, 0), _b = V(0, 0, 0), _d = V(0, 0, 0), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _o = V(0, 0, 0), _z = V(0, 0, 1);
function setSeg(m, ax, ay, az, bx, by, bz) {
  _a.set(ax, ay, az); _b.set(bx, by, bz); _d.subVectors(_b, _a); const len = _d.length() || 1e-4;
  m.position.addVectors(_a, _b).multiplyScalar(.5); m.scale.y = len; m.quaternion.setFromUnitVectors(UP, _d.multiplyScalar(1 / len));
}
function updateBlob(b, P, o, t) {
  const [hx, hy, hz, cx, cy, cz, px, py, pz, lx, ly, lz, rx, ry, rz, flx, fly, flz, frx, fry, frz] = P;
  setSeg(b.torso, cx, cy, cz, px, py, pz); b.chestB.position.set(cx, cy, cz); b.hipB.position.set(px, py, pz);
  setSeg(b.arms[0], cx, cy - .08, cz, lx, ly, lz); setSeg(b.arms[1], cx, cy - .08, cz, rx, ry, rz);
  b.hands[0].position.set(lx, ly, lz); b.hands[1].position.set(rx, ry, rz);
  const sc = i => (o.grab ? .22 : (o.punch && o.hand === i ? .28 : .19));
  b.hands[0].scale.setScalar(sc(0)); b.hands[1].scale.setScalar(sc(1));
  setSeg(b.legs[0], px, py, pz, flx, fly, flz); setSeg(b.legs[1], px, py, pz, frx, fry, frz);
  b.feet[0].position.set(flx, fly + .02, flz); b.feet[1].position.set(frx, fry + .02, frz);
  const fx = Math.sin(o.yaw), fz = Math.cos(o.yaw);
  b.feet[0].rotation.y = b.feet[1].rotation.y = o.yaw; b.feet[0].scale.set(.21, .15, .31); b.feet[1].scale.set(.21, .15, .31);
  // torso frame (axis chest->hip) + facing
  _d.set(cx - px, cy - py, cz - pz).normalize(); _q.setFromUnitVectors(UP, _d); _q2.setFromAxisAngle(UP, o.yaw); _q3.copy(_q).multiply(_q2);
  const tl = Math.hypot(px - cx, py - cy, pz - cz);
  if (b.bellyM) { _o.set(0, 0, .31).applyQuaternion(_q3); b.bellyM.position.set((cx + px) / 2 + _o.x, (cy + py) / 2 + _o.y, (cz + pz) / 2 + _o.z); b.bellyM.quaternion.copy(_q3); }
  for (const m of b.items) {
    const u = m.userData; _o.set(u.rx, 0, u.fz).applyQuaternion(_q3);
    m.position.set(cx + (px - cx) * u.t + _o.x, cy + (py - cy) * u.t + _o.y, cz + (pz - cz) * u.t + _o.z); m.quaternion.copy(_q3);
    if (m.geometry === G.cyl) { if (!u.len) u.len = m.scale.y; m.scale.y = u.len * tl; }
  }
  // head: lowered a bit toward the chest (no visible neck), aligned with the neck then turned to yaw
  const kx = hx + (cx - hx) * .22, ky = hy + (cy - hy) * .22, kz = hz + (cz - hz) * .22;
  _d.set(hx - cx, hy - cy, hz - cz).normalize(); _q.setFromUnitVectors(UP, _d);
  b.head.position.set(kx, ky, kz); b.head.quaternion.copy(_q).multiply(_q2);
  for (let i = 0; i < b.faces.length; i++) b.faces[i].visible = !o.ko && !b.hideFace && i === b.look.f;
  b.ko.visible = o.ko && !b.hideFace;
  if (b.hat.userData.prop) b.hat.userData.prop.rotation.y = t * 20;
  if (b.tailM) {
    const tt = b.tail;
    b.tailM.position.set(px - fx * tt.back, py - .05, pz - fz * tt.back);
    if (tt.curl) b.tailM.quaternion.setFromUnitVectors(_z, V(-fx, 0, -fz));
    else {
      const sw = Math.sin(t * 4) * .25, bk = Math.abs(tt.dir[2]);
      _d.set(-fx * bk - fz * sw, tt.dir[1], -fz * bk + fx * sw).normalize(); b.tailM.quaternion.setFromUnitVectors(UP, _d);
      if (tt.geo === G.cone || tt.geo === G.cyl) b.tailM.position.addScaledVector(_d, tt.sy * .4);
    }
  }
  for (let i = 0; i < 3; i++) { const s = b.stars[i]; s.visible = o.ko; if (o.ko) { const a = t * 5 + i * 2.09; s.position.set(hx + Math.cos(a) * .55, hy + .65, hz + Math.sin(a) * .55); s.rotation.y = a * 2; } }
}
function disposeBlobs() { for (const b of blobs.values()) { scene.remove(b.root); if (b.tag) scene.remove(b.tag); if (b.arrow) scene.remove(b.arrow); if (b.bub) scene.remove(b.bub); } blobs.clear(); }

// ------------------------------------------------------------------ sprites (names, text, emotes)
function textSprite(text, color, font, w, h) {
  const key = text + color + font + w;
  let tex = tagCache.get(key);
  if (!tex) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    x.direction = 'ltr'; x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
    x.lineWidth = h * .16; x.strokeStyle = '#2a1b4e'; x.strokeText(text, w / 2, h / 2); x.fillStyle = color; x.fillText(text, w / 2, h / 2);
    tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tagCache.set(key, tex);
    if (tagCache.size > 150) { const k = tagCache.keys().next().value; tagCache.get(k).dispose(); tagCache.delete(k); }
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  s.renderOrder = 20; return s;
}

// ------------------------------------------------------------------ FX
const FX = { parts: [], texts: [], shake: 0, pool: [], max: 160 };
FX.clear = () => { for (const p of FX.parts) scene.remove(p.m); for (const t of FX.texts) scene.remove(t.s); FX.parts.length = 0; FX.texts.length = 0; FX.shake = 0; };
FX.add = (x, y, z, vx, vy, vz, life, size, color, grav, spin) => {
  if (FX.parts.length >= FX.max) return;
  const m = FX.pool.pop() || new THREE.Mesh(G.box, new THREE.MeshBasicMaterial({ transparent: true }));
  m.material.color.set(color); m.material.opacity = 1; m.position.set(x, y, z); m.scale.setScalar(size); m.visible = true; scene.add(m);
  FX.parts.push({ m, vx, vy, vz, life, max: life, size, grav, spin: spin || 0 });
};
FX.burst = (x, y, z, n, colors, speed, life, size) => {
  for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, e = (Math.random() - .3) * 2, s = speed * (.3 + Math.random() * .7); FX.add(x, y, z, Math.cos(a) * s, Math.abs(e) * s * .7 + 1, Math.sin(a) * s, life, size * (.6 + Math.random() * .8), colors[(Math.random() * colors.length) | 0], 14, 8); }
};
FX.dust = (x, y, z, n) => { for (let i = 0; i < n; i++) FX.add(x + (Math.random() - .5) * .5, y, z + (Math.random() - .5) * .5, (Math.random() - .5) * 2, Math.random() * 1.5, (Math.random() - .5) * 2, .5, .16, '#ffffff', 0, 0); };
FX.confetti = (n) => { for (let i = 0; i < n; i++) FX.add((Math.random() - .5) * 26, 14 + Math.random() * 6, (Math.random() - .5) * 16, (Math.random() - .5) * 2, -2 - Math.random() * 3, (Math.random() - .5) * 2, 4, .22, PAL[(Math.random() * PAL.length) | 0], 0, 6); };
FX.text = (x, y, z, str, color, size) => {
  if (FX.texts.length > 7) return;
  const s = textSprite(str, color || '#fff', '900 74px "Lilita One", Impact, sans-serif', 384, 128);
  const k = size || 1; s.position.set(x, y, z); s.scale.set(3.2 * k, 1.07 * k, 1); scene.add(s); FX.texts.push({ s, life: 1, k });
};
FX.rings = [];
FX.ring = (x, y, z, color, size) => {
  if (FX.rings.length > 10) return;
  const m = new THREE.Mesh(G.torus, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .9 })); m.position.set(x, y, z); m.rotation.x = Math.PI / 2; m.scale.setScalar(.2); scene.add(m); FX.rings.push({ m, life: .45, k: size || 1.6 });
};
FX.update = dt => {
  for (let i = FX.rings.length - 1; i >= 0; i--) { const q = FX.rings[i]; q.life -= dt; if (q.life <= 0) { scene.remove(q.m); q.m.material.dispose(); FX.rings.splice(i, 1); continue; } const a = q.life / .45; q.m.scale.setScalar(.2 + (1 - a) * q.k * 1.8); q.m.material.opacity = a * .9; q.m.rotation.y += dt * 3; }
  for (let i = FX.parts.length - 1; i >= 0; i--) {
    const p = FX.parts[i]; p.life -= dt;
    if (p.life <= 0) { scene.remove(p.m); p.m.visible = false; FX.pool.push(p.m); FX.parts[i] = FX.parts[FX.parts.length - 1]; FX.parts.pop(); continue; }
    p.vy -= p.grav * dt; p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
    p.m.rotation.x += p.spin * dt; p.m.rotation.y += p.spin * dt; const a = p.life / p.max; p.m.material.opacity = Math.min(1, a * 2); p.m.scale.setScalar(p.size * (.4 + .6 * a));
  }
  for (let i = FX.texts.length - 1; i >= 0; i--) {
    const t = FX.texts[i]; t.life -= dt * 1.1;
    if (t.life <= 0) { scene.remove(t.s); t.s.material.dispose(); FX.texts.splice(i, 1); continue; }
    t.s.position.y += dt * 1.6; t.s.material.opacity = Math.min(1, t.life * 2.2); const sc = 1 + Math.max(0, t.life - .75) * 2.4; t.s.scale.set(3.2 * t.k * sc, 1.07 * t.k * sc, 1);
  }
  FX.shake = Math.max(0, FX.shake - dt * 3.2);
};

// ------------------------------------------------------------------ arenas
function skyTexture(c0, c1) { return canvasTex(2, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, c0); g.addColorStop(1, c1); x.fillStyle = g; x.fillRect(0, 0, w, h); }); }
const lm = (tex, extra) => new THREE.MeshLambertMaterial(Object.assign({ map: tex }, extra || {}));

function styleMaterials(b, anim) {
  const st = b.style, type = b.type || 'normal';
  if (b.crate) return lm(T.crate(), type === 'ice' ? { color: '#bfe6ff' } : {});
  if (st === 'rope') return null;
  const sides = (tex, rx, ry) => lm(withRepeat(tex, rx, ry));
  switch (st) {
    case 'roof': { const sx = sides(T.brick(), b.w / 3, b.h / 2.2), sz = sides(T.brick(), b.d / 3, b.h / 2.2); return [sz, sz, lm(withRepeat(T.roofTop(), b.w / 3, b.d / 3)), mat('#444'), sx, sx]; }
    case 'parapet': { const top = mat('#ead0ac'), a = lm(withRepeat(T.parapet(), b.d / 2, 1)), c = lm(withRepeat(T.parapet(), b.w / 2, 1)); return [a, a, top, top, c, c]; }
    case 'ac': { const sd = mat('#b4bccb'); return [sd, sd, lm(T.fan()), sd, sd, sd]; }
    case 'vent': return mat('#9aa3b2');
    case 'mat': { const top = lm(T.mat()), sd = mat('#2f5fb5'); return [sd, sd, top, sd, sd, sd]; }
    case 'concrete': { const t = lm(withRepeat(T.concrete(), b.w / 3, b.d / 3)); return [mat('#8a857d'), mat('#8a857d'), t, mat('#6f6a62'), mat('#8a857d'), mat('#8a857d')]; }
    case 'steel': return lm(withRepeat(T.steel(), b.w / 1.5, 1));
    case 'wood': return lm(withRepeat(T.wood(), b.w / 2, b.d / 2));
    case 'metal': { const t = lm(withRepeat(T.grid(), b.w / 1.5, b.d / 1.5)); const sd = lm(withRepeat(T.metal(), b.w / 3, 1)); return [sd, sd, t, mat('#3a4150'), sd, sd]; }
    case 'pot': return lm(T.pot());
    case 'barrel': return mat('#3d6fb5');
    case 'rail': return mat('#f2f2f2');
    case 'tile': { const sd = lm(withRepeat(T.tileSide(), b.w / 3, b.h / 1.5)), sz = lm(withRepeat(T.tileSide(), b.d / 3, b.h / 1.5)); return [sz, sz, lm(withRepeat(T.tileTop(), b.w / 3, b.d / 3)), mat('#555'), sd, sd]; }
    case 'track': { const t = lm(withRepeat(T.track(), b.w / 4, b.d / 4)); return [mat('#3a3631'), mat('#3a3631'), t, mat('#2a2723'), mat('#3a3631'), mat('#3a3631')]; }
    case 'container': case 'container2': { const col = st === 'container' ? '#b8372e' : '#2f6fb5', a = lm(withRepeat(T.cont(col), b.w / 3, 1)), c = lm(withRepeat(T.cont(col), b.d / 3, 1)); return [c, c, lm(withRepeat(T.cont(shade(col, .85)), b.w / 3, b.d / 3)), mat('#333'), a, a]; }
    case 'deck': { const t = lm(withRepeat(T.wood(), b.w / 3, b.d / 3)), sd = mat('#7a5232'); return [sd, sd, t, sd, sd, sd]; }
  }
  if (type === 'conv') {
    const t = T.arrow(); t.center.set(.5, .5); t.rotation = b.dir > 0 ? -Math.PI / 2 : Math.PI / 2; t.repeat.set(b.d / 2, b.w / 2);
    anim.push(dt => { t.offset.y += dt * (b.speed || 3) / 2; });
    return [mat('#585c78'), mat('#585c78'), new THREE.MeshLambertMaterial({ map: t }), mat('#444'), mat('#585c78'), mat('#585c78')];
  }
  const side = type === 'ice' ? '#a6dcff' : type === 'bounce' ? '#ff8ad2' : '#b97a4b';
  const top = type === 'ice' ? '#ffffff' : type === 'bounce' ? '#ff3fa8' : '#6fd65c';
  return [mat(side), mat(side), lm(withRepeat(T.checker(top, shade(top, .88)), b.w / 4, b.d / 4)), mat(shade(side, .7)), mat(side), mat(side)];
}
function boxMesh(b, anim) {
  const m = styleMaterials(b, anim); if (!m) return null;
  let o;
  if (b.style === 'pot' || b.style === 'barrel') { o = new THREE.Mesh(G.cyl, m); o.scale.set(b.w / 2, b.h, b.d / 2); o.position.set(b.x, b.y - b.h / 2, b.z); const rim = mesh(G.cyl, m, 1.12, .12, 1.12); rim.position.y = .5 - .06; o.add(rim); }
  else { o = new THREE.Mesh(G.box, m); o.scale.set(b.w, b.h, b.d); o.position.set(b.x, b.y - b.h / 2, b.z); }
  o.castShadow = o.receiveShadow = quality > 0; return o;
}

function skyline(g, base, tint, n, r0, r1) {
  const r = rng(99);
  for (let i = 0; i < n; i++) {
    const a = i / n * 6.283 + r() * .25, d = r0 + r() * (r1 - r0), w = 8 + r() * 12, dd = 8 + r() * 12, h = 30 + r() * 70;
    const t = withRepeat(T.windows(r() < .5), w / 7, h / 14); const bm = new THREE.Mesh(G.box, new THREE.MeshLambertMaterial({ map: t, color: tint })); bm.scale.set(w, h, dd); bm.position.set(Math.cos(a) * d, base + h / 2 - 28 + (r() * 14 - 7), Math.sin(a) * d); g.add(bm);
  }
}
function neonSign(g, text, x, y, z, w) { const m = new THREE.Mesh(G.plane, new THREE.MeshBasicMaterial({ map: T.neon(text), transparent: true, side: THREE.DoubleSide })); m.scale.set(w, w * .31, 1); m.position.set(x, y, z); g.add(m); return m; }

function buildDeco(map, g, anim) {
  const A = (geo, material, x, y, z, sx, sy, sz) => { const m = mesh(geo, material, sx, sy, sz); m.position.set(x, y, z); g.add(m); m.castShadow = quality > 0; return m; };
  const r = rng(map.id.length * 977 + 13);
  switch (map.id) {
    case 'rooftop': {
      skyline(g, -34, '#e6c6d8', quality ? 34 : 18, 40, 130);
      const dish = new THREE.Mesh(G.dish, new THREE.MeshLambertMaterial({ color: '#4c4f58', side: THREE.DoubleSide })); dish.scale.set(3.3, 1.7, 3.3); dish.position.set(-8.5, 3.9, -4.5); dish.rotation.set(-1.0, .5, 0); dish.castShadow = quality > 0; g.add(dish);
      A(G.cyl, mat('#777d88'), -8.5, 2.7, -4.5, .12, 2.5, .12); A(G.cyl, mat('#777d88'), -8.1, 1.6, -4.1, .1, 2.2, .1).rotation.z = .35; A(G.box, mat('#8a909c'), -8.5, 1.35, -4.5, 1.4, .25, 1.4);
      A(G.cyl, mat('#9aa0ad'), 8.3, 5.6, -5, .1, 8, .1); for (let i = 0; i < 4; i++) A(G.box, mat('#9aa0ad'), 8.3, 3.4 + i * 1.4, -5, 2.4 - i * .35, .07, .07);
      A(G.box, mat('#6b6f7e'), -5, 3.5, -9.2, .3, 7, .3); A(G.box, mat('#6b6f7e'), 5, 3.5, -9.2, .3, 7, .3); A(G.box, mat('#6b6f7e'), 0, 5.6, -9.2, 11, .2, .2);
      neonSign(g, 'BLOB BRAWL', 0, 6.6, -9.4, 11);
      A(G.box, mat('#c9b8a6'), 14, -1.4, -2, 4, 6, 6);
      for (let i = 0; i < 8; i++) A(G.box, mat('#d8d3cc'), 11.8 + i * .6, .2 - i * .7, 5.5, .8, .18, 2.2);
      A(G.box, new THREE.MeshLambertMaterial({ map: withRepeat(T.brick(), 6, 5) }), -22, -15, -6, 14, 22, 14); A(G.box, mat('#cfcfd8'), -22, -3.9, -6, 14.4, .5, 14.4);
      break;
    }
    case 'ring': {
      A(G.box, mat('#2b2024'), 0, -6, 0, 90, 1, 80);
      const wallM = new THREE.MeshLambertMaterial({ map: withRepeat(T.wood(), 20, 4), color: '#6b5560' });
      for (const [x, z, w, d] of [[0, -34, 90, 1], [0, 34, 90, 1], [-44, 0, 1, 70], [44, 0, 1, 70]]) { const wl = new THREE.Mesh(G.box, wallM); wl.scale.set(w, 22, d); wl.position.set(x, 4, z); g.add(wl); }
      A(G.box, mat('#2f5fb5'), 0, -1.7, 0, 15.8, 2.6, 15.8);
      const postCols = ['#e63946', '#f2f2f2', '#3d97ff', '#f2f2f2'];
      [[-7.4, -7.4], [7.4, -7.4], [7.4, 7.4], [-7.4, 7.4]].forEach(([x, z], i) => { A(G.cyl, mat('#4a4a55'), x, 1.7, z, .22, 3.4, .22); A(G.box, mat(postCols[i]), x, 1.2, z, .5, 1.5, .5); });
      for (const [y, c] of [[.85, '#f2f2f2'], [1.3, '#e63946'], [1.75, '#f2f2f2']]) for (const s of [-1, 1]) { A(G.cyl, mat(c), 0, y, s * 7.4, .06, 14.8, .06).rotation.z = Math.PI / 2; A(G.cyl, mat(c), s * 7.4, y, 0, .06, 14.8, .06).rotation.x = Math.PI / 2; }
      const cr = rng(5), cols = ['#e63946', '#ffd21f', '#3d97ff', '#4fd05a', '#ff9a2e', '#bf5cff'], nc = quality ? 26 : 12;
      for (let row = 0; row < 4; row++) { A(G.box, mat('#3a2f38'), 0, -4.4 + row * 1.1, -26 + row * 2.2, 70, .6, 2.2); for (let i = 0; i < nc; i++) { const c = A(G.sphere, mat(cols[(cr() * 6) | 0]), -33 + i * (66 / nc) + cr(), -3.2 + row * 1.1, -26.4 + row * 2.2, .55, .6, .5); const y0 = c.position.y; anim.push((dt, t) => { c.position.y = y0 + Math.abs(Math.sin(t * 3 + i * 1.7 + row)) * .25; }); } }
      for (let i = 0; i < 3; i++) { const lamp = A(G.cone, new THREE.MeshBasicMaterial({ color: '#fff3c4', transparent: true, opacity: .22 }), -9 + i * 9, 8.5, 0, 3.2, 9, 3.2); lamp.rotation.x = Math.PI; A(G.cyl, mat('#555'), -9 + i * 9, 13.5, 0, .1, 4, .1); }
      break;
    }
    case 'construction': {
      skyline(g, -30, '#e6c6d8', quality ? 40 : 20, 45, 150);
      const steel = mat('#7a2f2f');
      const cc = new THREE.MeshLambertMaterial({ map: T.concrete() }); for (const [x, z, top] of [[-10, -6, 8], [10, -6, 8], [0, -6.5, 8], [-10, 6, -.6], [10, 6, -.6], [0, 6.5, -.6]]) A(G.box, cc, x, (top - 12) / 2, z, .9, top + 12, .9);
      for (const z of [-6, 6]) A(G.box, steel, 0, -1.4, z, 20.4, .5, .5); for (const x of [-10, 10]) A(G.box, steel, x, -1.4, 0, .5, .5, 12.4); A(G.box, steel, 0, 3.1, -6, 20.4, .5, .5); for (const x of [-10, 10]) A(G.box, steel, x, 3.1, -3, .5, .5, 6.4);
      for (let i = 0; i < 10; i++) A(G.cyl, mat('#4a3a30'), -10 + (i % 5) * .35 + (i > 4 ? 20 : 0), 1.6, -6, .03, 3, .03);
      A(G.box, mat('#e8b520'), -12, 8, -3, 1, 36, 1); A(G.box, mat('#e8b520'), 0, 14.6, -3, 26, .8, .8);
      const pl = A(G.box, new THREE.MeshLambertMaterial({ map: T.wood() }), -8.8, 1.2, 4.2, .5, 5, 1.6); pl.rotation.x = .5;
      for (const [x, z] of [[8, 5.5], [-9, -5], [5, -5.5]]) A(G.cone, mat('#ff7a1f'), x, .35, z, .25, .7, .25);
      break;
    }
    case 'furnace': {
      const wall = new THREE.Mesh(G.box, new THREE.MeshLambertMaterial({ map: withRepeat(T.brick(), 30, 8), color: '#ff9b4a' })); wall.scale.set(120, 40, 1); wall.position.set(0, 8, -24); g.add(wall);
      for (let i = 0; i < 6; i++) A(G.cyl, mat('#6a6f7c'), -34 + i * 14, 8, -22.5, .9, 36, .9);
      for (const x of [-26, 26]) A(G.cyl, mat('#7b3a2a'), x, 4, -14, 2.2, 28, 2.2);
      for (const px of [-11, 11]) for (const z of [-5.5, 5.5]) { A(G.box, mat('#ffd21f'), px, 1.1, z, 8, .12, .12); A(G.box, mat('#ffd21f'), px, .6, z, 8, .1, .1); for (let i = 0; i < 5; i++) A(G.cyl, mat('#ffd21f'), px - 3.6 + i * 1.8, .7, z, .07, 1.2, .07); }
      for (const x of [-14.5, 14.5]) { A(G.box, mat('#ffd21f'), x, 1.1, 0, .12, .12, 11); A(G.box, mat('#ffd21f'), x, .6, 0, .1, .1, 11); }
      const fm = new THREE.MeshBasicMaterial({ color: '#ff8a1f', transparent: true, opacity: .85 }), fm2 = new THREE.MeshBasicMaterial({ color: '#ffd04d', transparent: true, opacity: .9 });
      for (let i = 0; i < (quality ? 34 : 14); i++) { const x = (r() - .5) * 30, z = (r() - .5) * 18; if (Math.abs(x) > 6.8 && Math.abs(x) < 15.5 && Math.abs(z) < 5.6) continue; const f = A(G.cone, i % 2 ? fm : fm2, x, -2, z, .8 + r(), 2.2 + r() * 2, .8 + r()); anim.push((dt, t) => { f.scale.y = 2.2 + Math.sin(t * 6 + i) * .8; f.position.y = -3 + f.scale.y / 2; }); }
      break;
    }
    case 'conveyor': {
      const wall = new THREE.Mesh(G.box, new THREE.MeshLambertMaterial({ map: withRepeat(T.metal(), 30, 8), color: '#7b8196' })); wall.scale.set(120, 40, 1); wall.position.set(0, 8, -22); g.add(wall);
      for (let i = 0; i < 8; i++) { const gr = new THREE.Group(); gr.add(mesh(G.cyl, mat('#3a3d52'), 3, .8, 3)); for (let k = 0; k < 10; k++) { const a = k * .628, tooth = mesh(G.box, mat('#3a3d52'), .7, .8, .9); tooth.position.set(Math.cos(a) * 3.2, 0, Math.sin(a) * 3.2); tooth.rotation.y = -a; gr.add(tooth); } gr.rotation.x = Math.PI / 2; gr.position.set(-30 + i * 8.5, 5 + (i % 3) * 4, -20); g.add(gr); anim.push(dt => { gr.rotation.z += dt * (i % 2 ? .5 : -.5); }); }
      break;
    }
    case 'subway': {
      const tw = new THREE.MeshLambertMaterial({ map: withRepeat(T.tileSide(), 14, 4) });
      const wl = new THREE.Mesh(G.box, tw); wl.scale.set(60, 16, 1); wl.position.set(0, 7, -11); g.add(wl);
      
      for (const sz of [-1, 1]) { A(G.box, mat('#ffd21f'), 0, .02, sz * 2.7, 28, .04, .35); }
      for (const sz of [-1, 1]) for (const zz of [-.9, .9]) A(G.box, mat('#8a909c'), 0, -1.7, zz, 28, .12, .12);
      for (const sx of [-1, 1]) A(G.box, mat('#0b0b10'), sx * 18.5, -.3, 0, 5, 8, 6);
      for (let i = 0; i < 4; i++) { const col = A(G.box, mat('#d8d4c8'), -12 + i * 8, 3, -9.5, 1.1, 7, 1.1); A(G.box, mat('#ffd21f'), -12 + i * 8, 2, -8.9, 1.12, .3, .1); }
      for (let i = 0; i < 4; i++) { A(G.box, mat(['#e63946', '#3d97ff', '#ffd21f', '#4fd05a'][i]), -12 + i * 8, 4.2, -10.4, 3.4, 2.2, .1); }
      for (let i = 0; i < 6; i++) A(G.box, new THREE.MeshBasicMaterial({ color: '#fff7d0' }), -14 + i * 5.6, 8.5, -6, 2.2, .12, .5);
      break;
    }
    case 'grind': {
      const wl = new THREE.Mesh(G.box, new THREE.MeshLambertMaterial({ map: withRepeat(T.metal(), 20, 6), color: '#8a7e74' })); wl.scale.set(110, 36, 1); wl.position.set(0, 6, -16); g.add(wl);
      for (let i = 0; i < 7; i++) { A(G.cyl, mat('#4a4f5c'), -24 + i * 8, 8, -14.5, .6, 28, .6); }
      for (let i = 0; i < 5; i++) { const c = A(G.cyl, mat('#9aa0ad'), -16 + i * 8, 11, -13, .1, 6, .1); anim.push((dt, t) => { c.rotation.z = Math.sin(t * 1.5 + i) * .08; }); }
      for (const sx of [-1, 1]) { const l = A(G.sphere, new THREE.MeshBasicMaterial({ color: '#ff3b2f' }), sx * 13.5, 3.5, -7, .3); anim.push((dt, t) => { l.scale.setScalar(.2 + Math.abs(Math.sin(t * 4)) * .2); }); }
      for (let i = 0; i < 5; i++) { const gr = new THREE.Group(); gr.add(mesh(G.cyl, mat('#3a3d52'), 2.5, .8, 2.5)); for (let k = 0; k < 9; k++) { const a = k * .698, tooth = mesh(G.box, mat('#3a3d52'), .6, .8, .8); tooth.position.set(Math.cos(a) * 2.7, 0, Math.sin(a) * 2.7); tooth.rotation.y = -a; gr.add(tooth); } gr.rotation.x = Math.PI / 2; gr.position.set(-20 + i * 10, 12 + (i % 2) * 3, -12); g.add(gr); anim.push(dt => { gr.rotation.z += dt * (i % 2 ? .6 : -.6); }); }
      break;
    }
    case 'container': {
      A(G.box, mat('#2a2a30'), 0, -3.4, 0, 27, .8, 4.2);
      for (const x of [-9, -7.3, 6, 7.7, 9.4]) { const w = A(G.cyl, mat('#1c1c20'), x, -4.4, 2.4, 1.1, .8, 1.1); w.rotation.x = Math.PI / 2; const w2 = A(G.cyl, mat('#1c1c20'), x, -4.4, -2.4, 1.1, .8, 1.1); w2.rotation.x = Math.PI / 2; A(G.cyl, mat('#9aa0ad'), x, -4.4, 2.85, .5, .1, .5).rotation.x = Math.PI / 2; }
      A(G.box, mat('#2f6fb5'), -17.5, -1.2, 0, 5, 4.8, 4.8); A(G.box, mat('#9fd4ff'), -19.9, -.3, 0, .1, 2, 3.6); A(G.box, mat('#e8e8e8'), -20.1, -2.6, 0, .4, .8, 4.6);
      const road = new THREE.Mesh(G.plane, mat('#55565e')); road.rotation.x = -Math.PI / 2; road.scale.set(400, 60, 1); road.position.set(0, -20, 0); g.add(road);
      for (let i = 0; i < 30; i++) A(G.box, mat('#f2f2f2'), -90 + i * 6.5, -19.9, 0, 3, .05, .35);
      skyline(g, -52, '#e8d8c8', quality ? 26 : 12, 60, 150);
      break;
    }
    case 'blimp': {
      const env = A(G.sphere, mat('#f1ead6'), 0, 7, -19, 17, 7.5, 5.5);
      for (const sx of [-1, 1]) { const f = A(G.cone, mat('#e63946'), sx * 15, 6, -19, 2.5, 5, .4); f.rotation.z = -sx * 1.4; }
      A(G.box, mat('#8a6a48'), 0, 1.5, -8.5, 10, 3, 2.5);
      for (const sx of [-1, 1]) { A(G.cyl, mat('#777d88'), sx * 13.5, .3, -4, .2, 2, .2); const pr = A(G.box, mat('#3a3d4a'), sx * 13.5, 1.3, -4, 3.4, .16, .4); anim.push((dt) => { pr.rotation.x += dt * 25; }); }
      const cl = mat('#ffffff', { transparent: true, opacity: .92 });
      for (let i = 0; i < 18; i++) { const a = i / 18 * 6.283 + r() * .3, d = 28 + r() * 40, c = A(G.sphere, cl, Math.cos(a) * d, -9 - r() * 10, Math.sin(a) * d, 5 + r() * 6, 2.5 + r() * 2, 5 + r() * 5); }
      break;
    }
    case 'ice': for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283 + r() * .3, d = 40 + r() * 30, c = mesh(G.cone, mat('#e8f8ff'), 5 + r() * 7, 12 + r() * 16, 5 + r() * 7); c.position.set(Math.cos(a) * d, -12, Math.sin(a) * d); g.add(c); } break;
    case 'trampoline': for (let i = 0; i < 18; i++) { const a = i / 18 * 6.283 + r() * .3, d = 25 + r() * 30, s = mesh(G.octa, mat(PAL[i % 16]), 1.5 + r() * 2.5); s.position.set(Math.cos(a) * d, -2 + r() * 14, Math.sin(a) * d); g.add(s); const y0 = s.position.y; anim.push((dt, t) => { s.rotation.y += dt; s.position.y = y0 + Math.sin(t * 1.5 + i) * .8; }); } break;
    case 'windmill': {
      for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283 + r() * .3, d = 35 + r() * 30, s = 8 + r() * 10, hm = mesh(G.sphere, mat('#4fb04f'), s, s * .6, s); hm.position.set(Math.cos(a) * d, -9, Math.sin(a) * d); g.add(hm); }
      A(G.cyl, mat('#f5f5f5'), -34, 0, -40, 2.5, 16, 2.5); const bl = new THREE.Group(); for (let k = 0; k < 4; k++) { const bb = mesh(G.box, mat('#c9a06a'), .8, 9, .2); bb.position.y = 4.5; const pv2 = new THREE.Group(); pv2.rotation.z = k * 1.5708; pv2.add(bb); bl.add(pv2); } bl.position.set(-34, 8, -38.5); g.add(bl); anim.push(dt => { bl.rotation.z += dt * .8; });
      break;
    }
  }
}

function buildMap(map) {
  const g = new THREE.Group(), anim = [];
  const o = { group: g, anim, movers: [], balls: [], bars: [] };
  for (const b of map.solids) { const m = boxMesh(b, anim); if (m) g.add(m); }
  const st = T.stripe();
  for (const m of map.movers || []) {
    let mm;
    if (m.kind === 'train') {
      mm = new THREE.Group(); const body = mesh(G.box, mat('#c9ccd2'), m.w, m.h, m.d); mm.add(body);
      const band = mesh(G.box, mat('#2f6fb5'), m.w + .02, .5, m.d + .02); band.position.y = -.5; mm.add(band);
      for (let i = 0; i < 6; i++) for (const sz of [-1, 1]) { const wn = mesh(G.box, mat('#2a3340'), 1.3, 1.0, .06); wn.position.set(-5 + i * 2, .5, sz * (m.d / 2 + .02)); mm.add(wn); }
      for (const sx of [-1, 1]) { const lt = mesh(G.box, new THREE.MeshBasicMaterial({ color: '#fff3a0' }), .12, .5, 1.2); lt.position.set(sx * (m.w / 2 + .02), -.9, 0); mm.add(lt); const dk = mesh(G.box, mat('#2a3340'), .08, 1.2, 2.4); dk.position.set(sx * (m.w / 2 + .01), .4, 0); mm.add(dk); }
      mm.traverse(q => { q.castShadow = quality > 0; });
    } else if (m.kind === 'press') {
      mm = new THREE.Group(); const blk = new THREE.Mesh(G.box, [mat('#4a4f5c'), mat('#4a4f5c'), mat('#4a4f5c'), lm(T.metal()), mat('#4a4f5c'), mat('#4a4f5c')]); blk.scale.set(m.w, m.h, m.d); mm.add(blk);
      const rod = mesh(G.cyl, mat('#9aa0ad'), .5, 14, .5); rod.position.y = m.h / 2 + 7; mm.add(rod);
      for (const sx of [-1, 1]) { const sp = mesh(G.box, mat('#ffd21f'), .5, .3, m.d + .05); sp.position.set(sx * m.w / 3, -m.h / 2 + .1, 0); mm.add(sp); }
      mm.traverse(q => { q.castShadow = quality > 0; });
    } else {
      mm = new THREE.Mesh(G.box, [mat('#8f99c4'), mat('#8f99c4'), lm(st), mat('#6e78a0'), mat('#8f99c4'), mat('#8f99c4')]); mm.scale.set(m.w, m.h, m.d); mm.castShadow = mm.receiveShadow = quality > 0;
    }
    g.add(mm); o.movers.push(mm);
  }
  for (const b of map.balls || []) {
    const grp = new THREE.Group(); const ball = mesh(G.sphere, mat('#3b3b4f'), b.r); ball.castShadow = quality > 0; grp.add(ball);
    for (let i = 0; i < 14; i++) { const s = mesh(G.cone, mat('#2f2f3d'), .22 * b.r, .5 * b.r, .22 * b.r); const d = V(Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize(); s.position.copy(d).multiplyScalar(b.r * 1.15); s.quaternion.setFromUnitVectors(UP, d); grp.add(s); }
    const chain = mesh(G.cyl, mat('#777'), .07, 1, .07); g.add(chain);
    g.add(grp); o.balls.push({ grp, chain });
  }
  for (const b of map.bars || []) {
    const grp = new THREE.Group(); const t = withRepeat(T.stripe(), b.len * 2, 1);
    const bar = new THREE.Mesh(G.cyl, new THREE.MeshLambertMaterial({ map: t })); bar.rotation.z = Math.PI / 2; bar.scale.set(b.r, b.len * 2, b.r); bar.castShadow = quality > 0; grp.add(bar);
    for (const s of [-1, 1]) { const cap = mesh(G.sphere, mat('#ffd21f'), b.r); cap.position.x = s * b.len; grp.add(cap); }
    grp.position.set(b.cx, b.cy, b.cz); g.add(grp);
    const hub = mesh(G.cyl, mat('#8f99c4'), .6, 3.2, .6); hub.position.set(b.cx, b.cy - 1.4, b.cz); g.add(hub);
    o.bars.push({ grp });
  }
  const lt = T.lava();
  for (const hz of map.hazards || []) { const p = new THREE.Mesh(G.plane, new THREE.MeshBasicMaterial({ map: lt })); p.rotation.x = -Math.PI / 2; p.scale.set(220, 220, 1); p.position.set(hz.x, hz.y - .2, hz.z); g.add(p); anim.push(dt => { lt.offset.x += dt * .02; lt.offset.y += dt * .012; }); }
  if (map.under === 'water') { const p = new THREE.Mesh(G.plane, new THREE.MeshLambertMaterial({ color: '#2f86d6', transparent: true, opacity: .85 })); p.rotation.x = -Math.PI / 2; p.scale.set(300, 300, 1); p.position.y = -7; g.add(p); }
  buildDeco(map, g, anim);
  return o;
}
function disposeMap() { if (mapObj) { scene.remove(mapObj.group); mapObj = null; } }

// ------------------------------------------------------------------ public API
function init(canvas, q) {
  quality = q;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: q > 0, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = q > 0; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, 16 / 9, .5, 500);
  hemi = new THREE.HemisphereLight('#fff4f8', '#8a7a90', 1.25); scene.add(hemi);
  sun = new THREE.DirectionalLight('#fff0e0', 1.9); sun.position.set(10, 25, 14); sun.castShadow = q > 0;
  sun.shadow.mapSize.set(q > 1 ? 2048 : 1024, q > 1 ? 2048 : 1024); const sc = sun.shadow.camera; sc.left = -30; sc.right = 30; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 90; sun.shadow.bias = -.0005; sun.shadow.radius = 3;
  scene.add(sun); scene.add(sun.target);
  initGeo();
}
function setQuality(q) {
  quality = q; renderer.shadowMap.enabled = q > 0; sun.castShadow = q > 0; FX.max = q === 0 ? 50 : q === 1 ? 110 : 200;
  if (curMap) loadMap(curMap);
}
function resize(w, h, dpr) { W = w; H = h; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
function loadMap(map) {
  disposeMap(); disposeBlobs(); FX.clear(); curMap = map; mapObj = buildMap(map); scene.add(mapObj.group);
  scene.background = skyTexture(map.sky[0], map.sky[1]); scene.fog = new THREE.Fog(map.fog || map.sky[1], 45, 190);
  hemi.color.set(map.id === 'ring' ? '#b8a8c8' : '#fff4f8'); hemi.intensity = map.id === 'ring' ? .9 : 1.25;
  cam.init = false;
}
function ensureBlob(id, look) {
  let b = blobs.get(id);
  const L = b && b.look;
  if (!b || L.s !== look.s || L.c !== look.c || L.d !== look.d || L.o !== look.o || L.h !== look.h || L.f !== look.f) { if (b) scene.remove(b.root); b = makeBlob(look); blobs.set(id, b); scene.add(b.root); }
  return b;
}

function render(frame, dt, now, info, opts) {
  const t = now / 1000;
  FX.update(dt);
  if (mapObj && frame) {
    const dyn = window.Maps.dyn(curMap, frame.gt);
    dyn.movers.forEach((m, i) => { mapObj.movers[i].position.set(m.x, m.y - m.h / 2, m.z); });
    dyn.balls.forEach((b, i) => { const o = mapObj.balls[i]; o.grp.position.set(b.x, b.y, b.z); setSeg(o.chain, b.px, b.py, b.pz, b.x, b.y, b.z); });
    dyn.bars.forEach((b, i) => { mapObj.bars[i].grp.rotation.y = -b.ang; });
  }
  if (mapObj) for (const a of mapObj.anim) a(dt, t);
  if (curMap && curMap.hazards && quality > 0 && Math.random() < dt * 9) { const hz = curMap.hazards[0]; FX.add((Math.random() - .5) * 30, hz.y - .1, (Math.random() - .5) * 20, 0, 2.5 + Math.random() * 2, 0, .8, .22, Math.random() < .5 ? '#ffb02e' : '#ff5a1f', 4, 3); }
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, y0 = 1e9, y1 = -1e9, n = 0, mine = null, focusP = null;
  const seen = new Set();
  if (frame) for (const p of frame.list) {
    if (!p.alive || !p.P) { const b = blobs.get(p.id); if (b) { b.root.visible = false; if (b.tag) b.tag.visible = false; if (b.arrow) b.arrow.visible = false; if (b.bub) b.bub.visible = false; } continue; }
    const inf = info(p.id), b = ensureBlob(p.id, inf.look); b.root.visible = true; seen.add(p.id);
    updateBlob(b, p.P, p, t);
    for (let i = 0; i < 21; i += 3) { x0 = Math.min(x0, p.P[i]); x1 = Math.max(x1, p.P[i]); y0 = Math.min(y0, p.P[i + 1]); y1 = Math.max(y1, p.P[i + 1]); z0 = Math.min(z0, p.P[i + 2]); z1 = Math.max(z1, p.P[i + 2]); }
    n++;
    const isMe = p.id === opts.meId; if (isMe) mine = p.P; if (opts.focus === p.id) focusP = p.P;
    const col = opts.teams ? TEAM[inf.team] : (isMe ? '#ffd93d' : '#ffffff'), key = inf.name + col;
    if (b.tagKey !== key) { if (b.tag) { scene.remove(b.tag); b.tag.material.dispose(); } b.tag = textSprite(inf.name, col, '800 54px "Baloo Bhaijaan 2", Tahoma, sans-serif', 384, 96); b.tag.scale.set(2.6, .65, 1); scene.add(b.tag); b.tagKey = key; }
    b.tag.visible = true; b.tag.position.set(p.P[0], p.P[1] + .95, p.P[2]);
    if (isMe) {
      if (!b.arrow) { b.arrow = mesh(G.cone, new THREE.MeshBasicMaterial({ color: '#ffd93d' }), .25, .45, .25); b.arrow.rotation.x = Math.PI; scene.add(b.arrow); }
      b.arrow.visible = true; b.arrow.position.set(p.P[0], p.P[1] + 1.5 + Math.sin(t * 6) * .1, p.P[2]);
    }
    const bb = opts.bubbles[p.id];
    if (bb && now < bb.until) { if (!b.bub || b.bubText !== bb.text) { if (b.bub) scene.remove(b.bub); b.bub = textSprite(bb.text, '#ffffff', '80px "Segoe UI Emoji","Apple Color Emoji",sans-serif', 160, 128); b.bub.scale.set(1.4, 1.1, 1); scene.add(b.bub); b.bubText = bb.text; } b.bub.visible = true; b.bub.position.set(p.P[0], p.P[1] + 2.1, p.P[2]); }
    else if (b.bub) b.bub.visible = false;
  }
  for (const [id, b] of blobs) if (!seen.has(id)) { b.root.visible = false; if (b.tag) b.tag.visible = false; if (b.arrow) b.arrow.visible = false; if (b.bub) b.bub.visible = false; }
  let tx = 0, ty = 1.5, tz = 0, dist = 26;
  if (n) {
    tx = (x0 + x1) / 2; tz = (z0 + z1) / 2; ty = (y0 + y1) / 2;
    const spanX = x1 - x0, spanZ = z1 - z0, aspect = W / H;
    dist = Math.min(44, Math.max(10.5, Math.max(spanX / aspect, spanZ * 1.25) * 0.95 + 5 + (y1 - y0) * .3));
  }
  if (focusP && frame.ph === 2) { tx = focusP[6]; ty = focusP[7] + .3; tz = focusP[8]; dist = 8; }
  else if (mine) { tx = mine[6]; ty = mine[7] + .3; tz = mine[8]; dist = 11.5; } // follow my own character; spectators get the group view
  const k = Math.min(1, dt * (mine ? 5 : 3.5));
  if (!cam.init) { Object.assign(cam, { tx, ty, tz, d: dist, init: true }); }
  cam.tx += (tx - cam.tx) * k; cam.ty += (ty - cam.ty) * k; cam.tz += (tz - cam.tz) * k; cam.d += (dist - cam.d) * k * .7;
  const el = 0.95, sh = FX.shake * .35;
  camera.position.set(cam.tx + (Math.random() - .5) * sh, cam.ty + Math.sin(el) * cam.d + (Math.random() - .5) * sh, cam.tz + Math.cos(el) * cam.d);
  camera.lookAt(cam.tx, cam.ty - .5, cam.tz);
  sun.position.set(cam.tx + 10, 25, cam.tz + 14); sun.target.position.set(cam.tx, 0, cam.tz);
  renderer.render(scene, camera);
}

// ------------------------------------------------------------------ character preview (menu + lobby cards + customization thumbnails)
let pv = null;
function createPreview(canvas) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true }); r.setClearColor(0x000000, 0);
  const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight('#ffffff', '#9a8ab0', 1.5)); const dl = new THREE.DirectionalLight('#fff', 1.6); dl.position.set(3, 6, 8); sc.add(dl);
  const cm = new THREE.PerspectiveCamera(30, canvas.width / canvas.height, .1, 50); cm.position.set(0, 1.5, 6.4); cm.lookAt(0, 1.3, 0);
  pv = { r, sc, cm, blob: null, key: '' };
}
function drawPreview(look, t, yawOverride, zoomHead) {
  if (!pv) return;
  const key = JSON.stringify(look);
  if (pv.key !== key) { if (pv.blob) pv.sc.remove(pv.blob.root); pv.blob = makeBlob(look); pv.sc.add(pv.blob.root); pv.key = key; }
  const yaw = yawOverride !== undefined ? yawOverride : .5, bob = Math.sin(t * 3) * .03, sw = Math.sin(t * 3) * .12;
  const P = [0, 1.72 + bob, 0, 0, 1.3 + bob * .6, 0, 0, .78, 0, -.62, .86 + sw, .12, .62, .86 - sw, .12, -.2, .2, 0, .2, .2, 0];
  updateBlob(pv.blob, P, { yaw, ko: false, punch: false, grab: false }, t);
  pv.cm.position.set(0, zoomHead ? 1.75 : 1.3, zoomHead ? 3.8 : 5.6); pv.cm.lookAt(0, zoomHead ? 1.6 : 1.0, 0);
  pv.r.render(pv.sc, pv.cm);
}
function previewTo(look, w, h, head) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  if (!pv) return c;
  const pc = pv.r.domElement; drawPreview(look, 0, .45, head);
  c.getContext('2d').drawImage(pc, 0, 0, pc.width, pc.height, 0, 0, w, h); return c;
}

window.R3 = { PAL, TEAM, SPECIES, OUTFITS, HAT_COUNT, FACE_COUNT, init, setQuality, resize, loadMap, render, FX, createPreview, drawPreview, previewTo, THREE };
window.dispatchEvent(new Event('r3ready'));
