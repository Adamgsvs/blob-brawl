// The beast's body: one smooth gummy mesh.
// It is generated once from a signed distance field (smooth union of round cones) with surface nets,
// then skinned to 13 bones that are driven directly by the physics particles.
import * as THREE from 'three';
import { P, REST, BONE, NB, HIP_OFF } from '../shared/skeleton.js';

// ---- the shape (rest pose). Left-side parts are mirrored automatically. --------------------------------
const PRIMS = [];
const prim = (bone, a, b, ra, rb) => PRIMS.push({ bone, a, b, ra, rb });
prim(BONE.HEAD, [0, 1.43, 0.02], [0, 1.43, 0.02], 0.285, 0.285);
prim(BONE.CHEST, [0, 1.12, 0.0], [0, 0.88, 0.03], 0.27, 0.305);
prim(BONE.CHEST, [0.19, 1.15, 0], [-0.19, 1.15, 0], 0.17, 0.17);
prim(BONE.PELVIS, [0, 0.88, 0.03], [0, 0.60, 0.0], 0.305, 0.31);
prim(BONE.PELVIS, [0, 0.80, 0.10], [0, 0.80, 0.10], 0.27, 0.27);
for (const s of [1, -1]) {
  const L = s > 0;
  prim(L ? BONE.UARM_L : BONE.UARM_R, [0.26 * s, 1.13, 0], [0.47 * s, 0.96, 0], 0.135, 0.12);
  prim(L ? BONE.FARM_L : BONE.FARM_R, [0.47 * s, 0.96, 0], [0.60 * s, 0.75, 0.035], 0.12, 0.112);
  prim(L ? BONE.FARM_L : BONE.FARM_R, [0.625 * s, 0.715, 0.04], [0.625 * s, 0.715, 0.04], 0.128, 0.128);
  prim(L ? BONE.THIGH_L : BONE.THIGH_R, [0.13 * s, 0.55, 0], [0.16 * s, 0.31, 0.03], 0.17, 0.145);
  prim(L ? BONE.SHIN_L : BONE.SHIN_R, [0.16 * s, 0.31, 0.03], [0.17 * s, 0.14, 0.0], 0.145, 0.125);
  prim(L ? BONE.FOOT_L : BONE.FOOT_R, [0.17 * s, 0.095, -0.03], [0.175 * s, 0.085, 0.13], 0.10, 0.09);
}
const SMOOTH = 0.075;

// texture atlas: left half = the front of the body, right half = the back, both seen along Z
export const ATLAS = { x0: -0.82, x1: 0.82, y0: -0.06, y1: 1.78 };

function primDist(p, x, y, z) {
  const ax = p.a[0], ay = p.a[1], az = p.a[2], bx = p.b[0] - ax, by = p.b[1] - ay, bz = p.b[2] - az;
  const l2 = bx * bx + by * by + bz * bz;
  let t = l2 > 1e-9 ? ((x - ax) * bx + (y - ay) * by + (z - az) * bz) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = x - ax - bx * t, dy = y - ay - by * t, dz = z - az - bz * t;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - (p.ra + (p.rb - p.ra) * t);
}
function sdf(x, y, z) {
  let d = 1e9;
  for (let i = 0; i < PRIMS.length; i++) {
    const e = primDist(PRIMS[i], x, y, z), h = Math.max(SMOOTH - Math.abs(d - e), 0) / SMOOTH;
    d = Math.min(d, e) - h * h * SMOOTH * 0.25;
  }
  return d;
}

// ---- naive surface nets ----------------------------------------------------------------------------------
function buildGeometry(cell) {
  const X0 = ATLAS.x0, Y0 = ATLAS.y0, Z0 = -0.42;
  const nx = Math.ceil((ATLAS.x1 - X0) / cell) + 1, ny = Math.ceil((ATLAS.y1 - Y0) / cell) + 1, nz = Math.ceil(0.88 / cell) + 1;
  const f = new Float32Array(nx * ny * nz);
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) f[x + nx * (y + ny * z)] = sdf(X0 + x * cell, Y0 + y * cell, Z0 + z * cell);
  const idx = new Int32Array(nx * ny * nz).fill(-1), vp = [];
  const EDGES = []; for (let i = 0; i < 8; i++) for (const b of [1, 2, 4]) if (!(i & b)) EDGES.push([i, i | b]);
  const g = new Float32Array(8);
  for (let z = 0; z < nz - 1; z++) for (let y = 0; y < ny - 1; y++) for (let x = 0; x < nx - 1; x++) {
    let mask = 0;
    for (let i = 0; i < 8; i++) { g[i] = f[(x + (i & 1)) + nx * ((y + ((i >> 1) & 1)) + ny * (z + ((i >> 2) & 1)))]; if (g[i] < 0) mask |= 1 << i; }
    if (mask === 0 || mask === 255) continue;
    let cx = 0, cy = 0, cz = 0, n = 0;
    for (const [a, b] of EDGES) {
      if (((mask >> a) & 1) === ((mask >> b) & 1)) continue;
      const t = g[a] / (g[a] - g[b]);
      cx += (a & 1) + ((b & 1) - (a & 1)) * t; cy += ((a >> 1) & 1) + (((b >> 1) & 1) - ((a >> 1) & 1)) * t; cz += ((a >> 2) & 1) + (((b >> 2) & 1) - ((a >> 2) & 1)) * t; n++;
    }
    idx[x + nx * (y + ny * z)] = vp.length / 3;
    vp.push(X0 + (x + cx / n) * cell, Y0 + (y + cy / n) * cell, Z0 + (z + cz / n) * cell);
  }
  const tris = [], step = [1, nx, nx * ny];
  for (let z = 0; z < nz - 1; z++) for (let y = 0; y < ny - 1; y++) for (let x = 0; x < nx - 1; x++) {
    const c = x + nx * (y + ny * z); if (idx[c] < 0) continue;
    const co = [x, y, z], s0 = f[c] < 0;
    for (let d = 0; d < 3; d++) {
      const u = (d + 1) % 3, v = (d + 2) % 3;
      if (co[u] === 0 || co[v] === 0) continue;
      if (s0 === (f[c + step[d]] < 0)) continue;
      const i0 = idx[c], i1 = idx[c - step[u]], i2 = idx[c - step[u] - step[v]], i3 = idx[c - step[v]];
      if (i1 < 0 || i2 < 0 || i3 < 0) continue;
      tris.push(i0, i1, i2, i0, i2, i3);
    }
  }
  // normals from the field (and slide every vertex onto the exact surface so the skin is smooth, not lumpy)
  const nv = vp.length / 3, vn = new Float32Array(nv * 3), e = cell * 0.5;
  for (let i = 0; i < nv; i++) {
    let x = vp[i * 3], y = vp[i * 3 + 1], z = vp[i * 3 + 2], gx = 0, gy = 1, gz = 0;
    for (let pass = 0; pass < 3; pass++) {
      gx = sdf(x + e, y, z) - sdf(x - e, y, z); gy = sdf(x, y + e, z) - sdf(x, y - e, z); gz = sdf(x, y, z + e) - sdf(x, y, z - e);
      const l = Math.hypot(gx, gy, gz) || 1; gx /= l; gy /= l; gz /= l;
      if (pass < 2) { const d = sdf(x, y, z); x -= gx * d; y -= gy * d; z -= gz * d; }
    }
    vp[i * 3] = x; vp[i * 3 + 1] = y; vp[i * 3 + 2] = z; vn[i * 3] = gx; vn[i * 3 + 1] = gy; vn[i * 3 + 2] = gz;
  }
  // split into front-facing and back-facing halves so each gets its own planar UVs
  const map = new Map(), pos = [], nor = [], uv = [], si = [], sw = [], index = [];
  const W = ATLAS.x1 - ATLAS.x0, H = ATLAS.y1 - ATLAS.y0;
  const weights = i => {
    const x = vp[i * 3], y = vp[i * 3 + 1], z = vp[i * 3 + 2], d = new Float32Array(NB).fill(9);
    for (const p of PRIMS) { const q = Math.max(0, primDist(p, x, y, z)); if (q < d[p.bone]) d[p.bone] = q; }
    const w = []; for (let b = 0; b < NB; b++) w.push([Math.exp(-(d[b] * d[b]) / (0.05 * 0.05)), b]);
    w.sort((a, b) => b[0] - a[0]); const top = w.slice(0, 4); const s = top.reduce((a, b) => a + b[0], 0) || 1;
    return top.map(t => [t[0] / s, t[1]]);
  };
  const wcache = new Array(nv);
  const vert = (i, side) => {
    const key = i * 2 + side; let k = map.get(key);
    if (k === undefined) {
      k = pos.length / 3; map.set(key, k);
      const x = vp[i * 3], y = vp[i * 3 + 1], z = vp[i * 3 + 2];
      pos.push(x, y, z); nor.push(vn[i * 3], vn[i * 3 + 1], vn[i * 3 + 2]);
      uv.push((side ? 0.5 : 0) + (x - ATLAS.x0) / W * 0.5, (y - ATLAS.y0) / H);
      const w = wcache[i] || (wcache[i] = weights(i));
      for (let n = 0; n < 4; n++) { si.push(w[n][1]); sw.push(w[n][0]); }
    }
    return k;
  };
  for (let t = 0; t < tris.length; t += 3) {
    let a = tris[t], b = tris[t + 1], c = tris[t + 2];
    const ux = vp[b * 3] - vp[a * 3], uy = vp[b * 3 + 1] - vp[a * 3 + 1], uz = vp[b * 3 + 2] - vp[a * 3 + 2];
    const wx = vp[c * 3] - vp[a * 3], wy = vp[c * 3 + 1] - vp[a * 3 + 1], wz = vp[c * 3 + 2] - vp[a * 3 + 2];
    const fx = uy * wz - uz * wy, fy = uz * wx - ux * wz, fz = ux * wy - uy * wx;
    const ax = vn[a * 3] + vn[b * 3] + vn[c * 3], ay = vn[a * 3 + 1] + vn[b * 3 + 1] + vn[c * 3 + 1], az = vn[a * 3 + 2] + vn[b * 3 + 2] + vn[c * 3 + 2];
    if (fx * ax + fy * ay + fz * az < 0) { const q = b; b = c; c = q; }
    const side = az >= 0 ? 0 : 1;
    index.push(vert(a, side), vert(b, side), vert(c, side));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  geo.setIndex(index);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.3);
  return geo;
}

const geoCache = {};
export function beastGeometry(quality) {
  const cell = quality <= 0 ? 0.056 : quality === 1 ? 0.044 : 0.035;
  return geoCache[cell] || (geoCache[cell] = buildGeometry(cell));
}

// ---- bones -------------------------------------------------------------------------------------------------
const { HEAD, CHEST, PELVIS, SHL, SHR, ELL, ELR, HAL, HAR, KNL, KNR, FTL, FTR } = P;
const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
// where each bone sits in the rest pose, and the rest direction of the limb it follows
export const BONE_ORIGIN = [];
const BONE_DIR = [];
{
  const hipL = [REST[PELVIS][0] + HIP_OFF[0], REST[PELVIS][1] + HIP_OFF[1], REST[PELVIS][2] + HIP_OFF[2]], hipR = [-hipL[0], hipL[1], hipL[2]];
  const set = (b, o, to) => { BONE_ORIGIN[b] = V(o); BONE_DIR[b] = to ? V(to).sub(V(o)).normalize() : null; };
  set(BONE.PELVIS, REST[PELVIS]); set(BONE.CHEST, REST[CHEST]); set(BONE.HEAD, REST[HEAD], null);
  BONE_DIR[BONE.HEAD] = V(REST[HEAD]).sub(V(REST[CHEST])).normalize();
  set(BONE.UARM_L, REST[SHL], REST[ELL]); set(BONE.UARM_R, REST[SHR], REST[ELR]);
  set(BONE.FARM_L, REST[ELL], REST[HAL]); set(BONE.FARM_R, REST[ELR], REST[HAR]);
  set(BONE.THIGH_L, hipL, REST[KNL]); set(BONE.THIGH_R, hipR, REST[KNR]);
  set(BONE.SHIN_L, REST[KNL], REST[FTL]); set(BONE.SHIN_R, REST[KNR], REST[FTR]);
  set(BONE.FOOT_L, REST[FTL]); set(BONE.FOOT_R, REST[FTR]);
}

const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _m = new THREE.Matrix4(), _qT = new THREE.Quaternion(), _q = new THREE.Quaternion(), _qy = new THREE.Quaternion();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _r = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);

// Sets position/quaternion of the 13 bones from 14 particle positions (pp = flat array of 42 numbers).
export function poseBones(bones, pp) {
  const px = i => pp[i * 3], py = i => pp[i * 3 + 1], pz = i => pp[i * 3 + 2];
  _x.set(px(SHL) - px(SHR), py(SHL) - py(SHR), pz(SHL) - pz(SHR)).normalize();
  _y.set(px(CHEST) - px(PELVIS), py(CHEST) - py(PELVIS), pz(CHEST) - pz(PELVIS));
  _y.addScaledVector(_x, -_y.dot(_x)).normalize();
  _z.crossVectors(_x, _y);
  _m.makeBasis(_x, _y, _z); _qT.setFromRotationMatrix(_m);
  const limb = (b, i0, i1, ox, oy, oz) => {
    const bone = bones[b];
    if (ox === undefined) _a.set(px(i0), py(i0), pz(i0));
    else { _a.set(ox, oy, oz).applyQuaternion(_qT); _a.x += px(i0); _a.y += py(i0); _a.z += pz(i0); }
    _d.set(px(i1) - _a.x, py(i1) - _a.y, pz(i1) - _a.z);
    const l = _d.length(); if (l > 1e-5) _d.multiplyScalar(1 / l); else _d.set(0, -1, 0);
    _r.copy(BONE_DIR[b]).applyQuaternion(_qT);
    _q.setFromUnitVectors(_r, _d).multiply(_qT);
    bone.position.copy(_a); bone.quaternion.copy(_q);
  };
  bones[BONE.PELVIS].position.set(px(PELVIS), py(PELVIS), pz(PELVIS)); bones[BONE.PELVIS].quaternion.copy(_qT);
  bones[BONE.CHEST].position.set(px(CHEST), py(CHEST), pz(CHEST)); bones[BONE.CHEST].quaternion.copy(_qT);
  // the head keeps its place but tilts with the neck
  _a.set(px(CHEST), py(CHEST), pz(CHEST)); _d.set(px(HEAD) - _a.x, py(HEAD) - _a.y, pz(HEAD) - _a.z).normalize();
  _r.copy(BONE_DIR[BONE.HEAD]).applyQuaternion(_qT); _q.setFromUnitVectors(_r, _d).multiply(_qT);
  bones[BONE.HEAD].position.set(px(HEAD), py(HEAD), pz(HEAD)); bones[BONE.HEAD].quaternion.copy(_q);
  limb(BONE.UARM_L, SHL, ELL); limb(BONE.UARM_R, SHR, ELR); limb(BONE.FARM_L, ELL, HAL); limb(BONE.FARM_R, ELR, HAR);
  limb(BONE.THIGH_L, PELVIS, KNL, HIP_OFF[0], HIP_OFF[1], HIP_OFF[2]); limb(BONE.THIGH_R, PELVIS, KNR, -HIP_OFF[0], HIP_OFF[1], HIP_OFF[2]);
  limb(BONE.SHIN_L, KNL, FTL); limb(BONE.SHIN_R, KNR, FTR);
  // feet stay flat and point where the body faces while standing; they follow the shin when the body is down
  const up = _y.y, k = up < 0.3 ? 0 : up > 0.7 ? 1 : (up - 0.3) / 0.4;
  _qy.setFromAxisAngle(UP, Math.atan2(_z.x, _z.z));
  for (const [fb, sb, fi] of [[BONE.FOOT_L, BONE.SHIN_L, FTL], [BONE.FOOT_R, BONE.SHIN_R, FTR]]) {
    bones[fb].position.set(px(fi), py(fi), pz(fi)); bones[fb].quaternion.copy(bones[sb].quaternion).slerp(_qy, k);
  }
}

// One beast = skinned body + a rigid container per bone for add-ons (ears, hats, tails...) authored in rest-pose space.
export function createRig(geometry, material) {
  const root = new THREE.Group();
  const bones = [], holders = [];
  for (let i = 0; i < NB; i++) { const b = new THREE.Bone(); bones.push(b); root.add(b); const h = new THREE.Group(); holders.push(h); root.add(h); }
  const skeleton = new THREE.Skeleton(bones, BONE_ORIGIN.map(o => new THREE.Matrix4().makeTranslation(-o.x, -o.y, -o.z)));
  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.frustumCulled = false; root.add(mesh); mesh.bind(skeleton, new THREE.Matrix4());
  const rig = {
    root, mesh, bones, holders, skeleton,
    pose(pp) {
      poseBones(bones, pp);
      for (let i = 0; i < NB; i++) { const h = holders[i]; if (!h.children.length) continue; h.quaternion.copy(bones[i].quaternion); h.position.copy(BONE_ORIGIN[i]).applyQuaternion(h.quaternion).negate().add(bones[i].position); }
    }
  };
  return rig;
}

export const BODY_PRIMS = PRIMS;
