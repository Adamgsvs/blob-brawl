// Scene, lights, camera, beasts and effects.
import * as THREE from 'three';
import { beastGeometry, createRig } from './beastmesh.js';
import { dress, lookTexture } from './costumes.js';
import { buildStage, buildBackdrop, setStageQuality, lam } from './stages3d.js';
import { stageById } from '../shared/stages.js';
import { IDLE, P, NP } from '../shared/skeleton.js';

let renderer, scene, camera, sun, hemi, quality = 1, W = 800, H = 450;
let stageObj = null, curStage = null;
const beasts = new Map();
const cam = { x: 0, y: 1, z: 0, d: 10, pitch: 0.72, init: false };
const _v = new THREE.Vector3();

// ------------------------------------------------------------------------------------------------ setup
export function init(canvas, q) {
  quality = q; setStageQuality(q);
  renderer = new THREE.WebGLRenderer({ canvas, antialias: q > 0, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = q > 0; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.3, 600);
  hemi = new THREE.HemisphereLight('#ffffff', '#9a8a98', 1.25); scene.add(hemi);
  sun = new THREE.DirectionalLight('#fff2e2', 2.1); sun.castShadow = q > 0;
  const s = q > 1 ? 2048 : 1024; sun.shadow.mapSize.set(s, s);
  Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 17, bottom: -17, near: 1, far: 70 }); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
  scene.add(sun); scene.add(sun.target);
}
export function setQuality(q) {
  if (q === quality) return;
  quality = q; setStageQuality(q); renderer.shadowMap.enabled = q > 0; sun.castShadow = q > 0;
  FX.max = q === 0 ? 60 : q === 1 ? 140 : 260;
  const looks = [...beasts.entries()].map(([id, b]) => [id, b.look, b.name, b.tagColor]);
  const st = curStage; clearBeasts();
  if (st === '_backdrop') showBackdrop(); else if (st) showStage(st);
  for (const [id, look, name, col] of looks) setBeast(id, look, name, col);
}
export function resize(w, h, dpr) { w = Math.max(2, w | 0); h = Math.max(2, h | 0); W = w; H = h; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }

function skyTex(a, b) {
  const c = document.createElement('canvas'); c.width = 2; c.height = 256; const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, a); g.addColorStop(1, b); x.fillStyle = g; x.fillRect(0, 0, 2, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function mount(obj, key) {
  if (stageObj) scene.remove(stageObj.group);
  FX.clear(); stageObj = obj; curStage = key; scene.add(obj.group);
  const st = obj.stage;
  scene.background = skyTex(st.sky[0], st.sky[1]); scene.fog = new THREE.Fog(st.fog[0], st.fog[1], st.fog[2]);
  hemi.intensity = st.dark ? 0.8 : 1.3; hemi.color.set(st.dark ? '#c9c2d6' : '#ffffff'); sun.intensity = st.dark ? 1.9 : 2.1;
  cam.init = false;
}
export function showStage(id) { mount(buildStage(stageById(id)), id); }
export function showBackdrop() { mount(buildBackdrop(), '_backdrop'); }

// ------------------------------------------------------------------------------------------------ beasts
const lookKey = l => l.c + ',' + l.k + ',' + l.kc + ',' + l.h + ',' + l.f;
function makeRig(look, q, texSize) {
  const map = lookTexture(look, texSize);
  const material = q > 0 ? new THREE.MeshStandardMaterial({ map, roughness: 0.62, metalness: 0 }) : new THREE.MeshLambertMaterial({ map });
  const rig = createRig(beastGeometry(q), material); dress(rig, look);
  rig.mesh.castShadow = q > 0; rig.root.traverse(o => { if (o.isMesh && o !== rig.mesh) o.castShadow = q > 0 && o.castShadow; });
  return rig;
}
const tagCache = new Map();
function textSprite(text, color, size) {
  const key = text + color + size; let t = tagCache.get(key);
  if (!t) {
    const c = document.createElement('canvas'); c.width = 384; c.height = 96; const x = c.getContext('2d');
    x.direction = 'ltr'; x.font = '800 ' + size + 'px "Baloo Bhaijaan 2", Tahoma, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
    x.lineWidth = 9; x.strokeStyle = 'rgba(30,20,40,.85)'; x.strokeText(text, 192, 50); x.fillStyle = color; x.fillText(text, 192, 50);
    t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; tagCache.set(key, t);
    if (tagCache.size > 120) { const k = tagCache.keys().next().value; tagCache.get(k).dispose(); tagCache.delete(k); }
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); s.renderOrder = 20; return s;
}
export function setBeast(id, look, name, tagColor) {
  let b = beasts.get(id); const key = lookKey(look);
  if (!b || b.key !== key) {
    if (b) scene.remove(b.rig.root);
    const rig = makeRig(look, quality, quality === 0 ? 256 : quality === 1 ? 384 : 512);
    scene.add(rig.root);
    b = Object.assign(b || { tag: null, tagKey: '', bub: null }, { rig, key, look });
    beasts.set(id, b);
  }
  b.name = name; b.tagColor = tagColor;
  const tk = (name || '') + tagColor;
  if (b.tagKey !== tk) {
    if (b.tag) { scene.remove(b.tag); b.tag.material.dispose(); b.tag = null; }
    if (name) { b.tag = textSprite(name, tagColor || '#ffffff', 46); b.tag.scale.set(2.0, 0.5, 1); scene.add(b.tag); }
    b.tagKey = tk;
  }
  return b;
}
export function removeBeast(id) { const b = beasts.get(id); if (!b) return; scene.remove(b.rig.root); if (b.tag) scene.remove(b.tag); if (b.bub) scene.remove(b.bub); b.rig.mesh.material.dispose(); beasts.delete(id); }
export function clearBeasts() { for (const id of [...beasts.keys()]) removeBeast(id); }
export function keepBeasts(ids) { for (const id of [...beasts.keys()]) if (!ids.has(id)) removeBeast(id); }
// pp: 42 numbers (14 particles); o: { ko, hide, tag }
export function poseBeast(id, pp, o) {
  const b = beasts.get(id); if (!b) return;
  const vis = !(o && o.hide); b.rig.root.visible = vis; if (b.tag) b.tag.visible = vis && !(o && o.tag === false);
  if (!vis) { if (b.bub) b.bub.visible = false; return; }
  b.rig.pose(pp); b.rig.setKo(!!(o && o.ko));
  for (const s of b.rig.spin) s.rotation.y += 0.4;
  const hx = pp[0], hy = pp[1], hz = pp[2];
  if (b.tag) b.tag.position.set(hx, hy + 0.62, hz);
  if (b.bub) b.bub.position.set(hx, hy + 1.15, hz);
}
export function emote(id, text) {
  const b = beasts.get(id); if (!b) return;
  if (b.bub) { scene.remove(b.bub); b.bub.material.dispose(); }
  b.bub = textSprite(text, '#ffffff', 64); b.bub.scale.set(2.4, 0.6, 1); b.bub.userData.until = performance.now() + 2000; scene.add(b.bub);
}

// a standing, breathing pose for menus and the lobby
export function idlePose(out, x, z, yaw, t, seed) {
  const c = Math.cos(yaw), s = Math.sin(yaw), br = Math.sin(t * 2.1 + seed) * 0.008, sw = Math.sin(t * 1.3 + seed * 2) * 0.012;
  for (let i = 0; i < NP; i++) {
    const p = IDLE[i]; let px = p[0], py = p[1], pz = p[2];
    if (i < 6) { py += br; px += sw * (py - 0.6); }
    else if (i <= P.HAR) { py += br * 0.6; pz += Math.sin(t * 1.7 + seed + i) * 0.012; }
    out[i * 3] = x + px * c + pz * s; out[i * 3 + 1] = py; out[i * 3 + 2] = z - px * s + pz * c;
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ effects
const BOXG = new THREE.BoxGeometry(1, 1, 1), SPHG = new THREE.SphereGeometry(1, 8, 6);
export const FX = { parts: [], pool: [], max: 140, shake: 0 };
FX.clear = () => { for (const p of FX.parts) { scene.remove(p.m); FX.pool.push(p.m); } FX.parts.length = 0; FX.shake = 0; };
FX.add = (x, y, z, vx, vy, vz, life, size, color, grav, o) => {
  if (FX.parts.length >= FX.max) return null;
  const m = FX.pool.pop() || new THREE.Mesh(BOXG, new THREE.MeshBasicMaterial({ transparent: true }));
  m.geometry = o && o.round ? SPHG : BOXG; m.material.color.set(color); m.material.opacity = 1; m.position.set(x, y, z); m.rotation.set(0, 0, 0);
  if (o && o.scale) m.scale.set(o.scale[0], o.scale[1], o.scale[2]); else m.scale.setScalar(size);
  scene.add(m);
  const p = { m, vx, vy, vz, life, max: life, size, grav, spin: o && o.spin || 0, grow: o && o.grow || 0, fade: !(o && o.nofade), sc: o && o.scale || null, floor: o && o.floor };
  FX.parts.push(p); return p;
};
FX.puff = (x, y, z, n, color, speed, life, size) => {
  for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, e = Math.random() * 1.2 - 0.2, s = speed * (0.4 + Math.random() * 0.6); FX.add(x, y, z, Math.cos(a) * s, e * s, Math.sin(a) * s, life * (0.6 + Math.random() * 0.5), size * (0.6 + Math.random() * 0.7), color, 0, { round: true, grow: 1.5 }); }
};
FX.dust = (x, y, z, n) => { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = 0.6 + Math.random() * 1.1; FX.add(x + Math.cos(a) * 0.15, y + 0.05, z + Math.sin(a) * 0.15, Math.cos(a) * s, 0.3 + Math.random() * 0.5, Math.sin(a) * s, 0.45, 0.07, '#f5efe8', 0, { round: true, grow: 2.2 }); } };
// the little white burst when a hit lands
FX.impact = (x, y, z, power) => {
  const n = quality ? 7 : 4, k = 0.7 + power * 0.35;
  for (let i = 0; i < n; i++) { const a = i / n * 6.283 + Math.random(), e = (Math.random() - 0.3) * 1.2, s = 4.5 * k; FX.add(x, y, z, Math.cos(a) * s, e * s, Math.sin(a) * s, 0.16, 0.05, '#ffffff', 0, { scale: [0.05 * k, 0.05 * k, 0.24 * k], nofade: true, look: true }); }
  FX.puff(x, y, z, quality ? 4 : 2, '#ffffff', 1.2 * k, 0.22, 0.09 * k);
  FX.shake = Math.max(FX.shake, 0.12 * power);
};
FX.shards = (x, y, z, w, d, color, n) => { for (let i = 0; i < n; i++) FX.add(x + (Math.random() - 0.5) * w, y, z + (Math.random() - 0.5) * d, (Math.random() - 0.5) * 2, Math.random() * 1.5, (Math.random() - 0.5) * 2, 1.4, 0.1, color, 22, { scale: [0.1 + Math.random() * 0.25, 0.03, 0.1 + Math.random() * 0.2], spin: 7 }); };
FX.burst = (x, y, z, n, colors, speed, life, size, grav) => { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = speed * (0.3 + Math.random() * 0.7); FX.add(x, y, z, Math.cos(a) * s, Math.random() * speed, Math.sin(a) * s, life * (0.6 + Math.random() * 0.6), size * (0.6 + Math.random() * 0.8), colors[(Math.random() * colors.length) | 0], grav === undefined ? 18 : grav, { spin: 6 }); } };
FX.confetti = (cx, cy, cz, n) => { const cols = ['#d94436', '#f3c623', '#44a94e', '#2f6fd6', '#f07ab0', '#ffffff']; for (let i = 0; i < n; i++) FX.add(cx + (Math.random() - 0.5) * 9, cy + 5 + Math.random() * 3, cz + (Math.random() - 0.5) * 7, (Math.random() - 0.5) * 1.5, -1.5 - Math.random() * 2, (Math.random() - 0.5) * 1.5, 3.5, 0.1, cols[(Math.random() * 6) | 0], 0, { scale: [0.14, 0.02, 0.08], spin: 5 }); };
FX.update = dt => {
  for (let i = FX.parts.length - 1; i >= 0; i--) {
    const p = FX.parts[i]; p.life -= dt;
    if (p.life <= 0) { scene.remove(p.m); FX.pool.push(p.m); FX.parts[i] = FX.parts[FX.parts.length - 1]; FX.parts.pop(); continue; }
    p.vy -= p.grav * dt; const m = p.m; m.position.x += p.vx * dt; m.position.y += p.vy * dt; m.position.z += p.vz * dt;
    const a = p.life / p.max;
    if (p.spin) { m.rotation.x += p.spin * dt; m.rotation.z += p.spin * 0.7 * dt; }
    else if (p.sc) m.lookAt(m.position.x + p.vx, m.position.y + p.vy, m.position.z + p.vz);
    if (p.grow) m.scale.setScalar(p.size * (1 + (1 - a) * p.grow));
    if (p.fade) m.material.opacity = Math.min(1, a * 1.6);
  }
  FX.shake = Math.max(0, FX.shake - dt * 1.2);
};

// ------------------------------------------------------------------------------------------------ frame
// view: { mode: 'follow', x, y, z } | { mode: 'group', box: [x0,x1,y0,y1,z0,z1] } | { mode: 'fixed', x, y, z, d, pitch }
export function draw(dt, now, gt, brokenMask, view) {
  const t = now / 1000;
  FX.update(dt);
  let cues = null;
  if (stageObj) cues = stageObj.update(gt, dt, t, brokenMask || 0);
  for (const b of beasts.values()) if (b.bub && now > b.bub.userData.until) { scene.remove(b.bub); b.bub.material.dispose(); b.bub = null; }
  let tx = 0, ty = 1, tz = 0, d = 10, pitch = 0.72, k = Math.min(1, dt * 4.5);
  if (view.mode === 'follow') { tx = view.x; ty = view.y; tz = view.z; d = 11.2 * (view.zoom || 1); pitch = 0.76; }
  else if (view.mode === 'group' && view.box) {
    const b = view.box; tx = (b[0] + b[1]) / 2; ty = (b[2] + b[3]) / 2; tz = (b[4] + b[5]) / 2;
    d = Math.min(34, Math.max(9, Math.max((b[1] - b[0]) / (W / H), (b[5] - b[4]) * 1.25) * 1.1 + 6 + (b[3] - b[2]) * 0.4)); pitch = 0.78; k = Math.min(1, dt * 3);
  } else if (view.mode === 'fixed') { tx = view.x; ty = view.y; tz = view.z; d = view.d; pitch = view.pitch; k = Math.min(1, dt * 6); }
  if (W / H < 1.5) d *= Math.min(2.2, 1.5 / (W / H));              // narrow screens: pull back so nothing is cut off
  if (!cam.init) { cam.x = tx; cam.y = ty; cam.z = tz; cam.d = d; cam.pitch = pitch; cam.init = true; }
  cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k; cam.z += (tz - cam.z) * k; cam.d += (d - cam.d) * k * 0.8; cam.pitch += (pitch - cam.pitch) * k;
  const sh = FX.shake;
  camera.position.set(cam.x + (Math.random() - 0.5) * sh, cam.y + Math.sin(cam.pitch) * cam.d + (Math.random() - 0.5) * sh, cam.z + Math.cos(cam.pitch) * cam.d);
  camera.lookAt(cam.x, cam.y + (view.mode === 'fixed' ? 0 : 0.2), cam.z);
  sun.position.set(cam.x - 7, cam.y + 20, cam.z + 9); sun.target.position.set(cam.x, cam.y, cam.z);
  renderer.render(scene, camera);
  return cues;
}
export function stageDyn() { return stageObj && stageObj.dyn; }
export function stageBreak(i) { return stageObj && stageObj.breaks[i]; }

// ------------------------------------------------------------------------------------------------ thumbnails
let TR = null;
function thumbRenderer(w, h) {
  if (!TR) {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); r.setClearColor(0, 0);
    const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight('#ffffff', '#b09aa8', 1.6)); const d = new THREE.DirectionalLight('#fff', 2); d.position.set(3, 6, 8); sc.add(d);
    TR = { r, sc, cam: new THREE.PerspectiveCamera(28, 1, 0.1, 400), tmp: new Array(NP * 3) };
  }
  TR.r.setSize(w, h, false); TR.cam.aspect = w / h; TR.cam.updateProjectionMatrix();
  return TR;
}
const thumbCache = new Map();
// kind: 'body' (whole beast) or 'head' (close-up)
export function thumbBeast(look, w, h, kind) {
  const key = lookKey(look) + kind + w; let url = thumbCache.get(key);
  if (!url) {
    const T = thumbRenderer(w, h), rig = makeRig(look, 1, 256);
    T.sc.add(rig.root); rig.pose(idlePose(T.tmp, 0, 0, 0.45, 0, 0));
    if (kind === 'head') { T.cam.position.set(0.25, 1.5, 2.6); T.cam.lookAt(0, 1.45, 0); } else { T.cam.position.set(0.5, 1.15, 4.6); T.cam.lookAt(0, 0.9, 0); }
    T.r.render(T.sc, T.cam); url = T.r.domElement.toDataURL('image/png');
    T.sc.remove(rig.root); rig.mesh.material.dispose();
    thumbCache.set(key, url);
  }
  return url;
}
export function thumbStage(id, w, h) {
  const key = 'stage' + id + w; let url = thumbCache.get(key);
  if (!url) {
    const T = thumbRenderer(w, h), st = stageById(id);
    setStageQuality(0); const s = buildStage(st); setStageQuality(quality);
    s.update(1.2, 0, 0, 0);
    const sc = new THREE.Scene(); sc.background = skyTex(st.sky[0], st.sky[1]); sc.fog = new THREE.Fog(st.fog[0], st.fog[1] * 1.6, st.fog[2] * 1.6);
    sc.add(new THREE.HemisphereLight('#ffffff', '#9a8a98', st.dark ? 1.1 : 1.4)); const d = new THREE.DirectionalLight('#fff2e2', 2); d.position.set(-7, 20, 9); sc.add(d); sc.add(s.group);
    T.cam.position.set(0, 15, 17); T.cam.lookAt(0, 0, 0); T.r.render(sc, T.cam); url = T.r.domElement.toDataURL('image/jpeg', 0.8);
    thumbCache.set(key, url);
  }
  return url;
}
export { quality };
export const dbg = () => ({ scene, camera, renderer, cam, beasts, stageObj });
