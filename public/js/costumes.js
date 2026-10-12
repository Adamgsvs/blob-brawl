// Costumes: painted straight onto the body (front / back atlas) plus rigid add-ons hung on the bones.
import * as THREE from 'three';
import { ATLAS } from './beastmesh.js';
import { PALETTE, COSTUMES, HEADS, FACES } from '../shared/looks.js';
import { BONE } from '../shared/skeleton.js';

const HEAD = 0, TORSO = 1, UARM = 2, FARM = 3, THIGH = 4, SHIN = 5, FOOT = 6;
const hex = s => parseInt(s.slice(1), 16);
const PAL = PALETTE.map(hex);
const WHITE = 0xf2f2f2, BLACK = 0x24242b, CREAM = 0xf2e2c4, ORANGE = 0xf08a24, RED = 0xd43a2f, YELLOW = 0xf3c623, JEANS = 0x3c4f78, BROWN = 0x7a4a26, GOLD = 0xe8b923, PINK = 0xf7a8c4, GRAY = 0x8d9099;
const css = c => '#' + c.toString(16).padStart(6, '0');
function mix(a, b, t) {
  const r = ((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * t, g = ((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * t, bl = (a & 255) + ((b & 255) - (a & 255)) * t;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}
const shade = (c, f) => f <= 1 ? mix(0, c, f) : mix(c, 0xffffff, f - 1);
const E = (x, y, cx, cy, rx, ry) => { const u = (x - cx) / rx, v = (y - cy) / ry; return u * u + v * v < 1; };
const frac = v => v - Math.floor(v);
const between = (v, a, b) => v >= a && v < b;

// ------------------------------------------------------------------------------------------------ body paint
// q = { x, y, ax, back, part, t }  (rest-pose coordinates; t runs 0..1 from the root of a limb to its tip)
const shoe = q => q.part === FOOT || (q.part === SHIN && q.t > 0.72);
const legs = q => q.part === THIGH || q.part === SHIN;
const onesie = (q, S, belly, muzzle) => {
  if (!q.back) {
    if (belly !== undefined && q.part === TORSO && E(q.x, q.y, 0, 0.79, 0.19, 0.25)) return belly;
    if (muzzle !== undefined && q.part === HEAD && E(q.x, q.y, 0, 1.375, 0.125, 0.095)) return muzzle;
  }
  return S;
};

const PAINT = {
  chicken: (q, S) => (q.part === FOOT ? ORANGE : S),
  bear: (q, S) => onesie(q, S, CREAM, CREAM),
  dino: (q, S) => { const b = mix(S, 0xfff2b0, 0.6); return onesie(q, S, (Math.floor(q.y * 16) & 1) ? b : shade(b, 0.92)); },
  cat: (q, S) => onesie(q, S, WHITE, WHITE),
  bunny: (q, S) => onesie(q, S, mix(S, PINK, 0.55), undefined),
  shark: (q, S) => {
    if (!q.back && ((q.part === TORSO && E(q.x, q.y, 0, 0.8, 0.22, 0.38)) || (q.part === HEAD && q.y < 1.41 && E(q.x, q.y, 0, 1.36, 0.21, 0.14)))) return WHITE;
    return S;
  },
  frog: (q, S) => onesie(q, S, mix(S, 0xfffbc8, 0.65)),
  panda: q => {
    if (q.part === UARM || q.part === FARM || q.part === SHIN || q.part === FOOT || (q.part === THIGH && q.t > 0.25)) return BLACK;
    if (q.part === TORSO && between(q.y, 1.0, 1.26)) return BLACK;
    if (q.part === HEAD && !q.back && E(q.ax, q.y, 0.09, 1.462, 0.072, 0.08)) return BLACK;
    return WHITE;
  },
  penguin: (q, S) => {
    if (q.part === FOOT) return ORANGE;
    if (!q.back && ((q.part === TORSO && E(q.x, q.y, 0, 0.84, 0.21, 0.37)) || (q.part === HEAD && E(q.x, q.y, 0, 1.39, 0.2, 0.17)))) return WHITE;
    return S;
  },
  skeleton: () => 0x1d1d24,
  singlet: (q, S) => {
    if (q.part === TORSO && (q.y < 1.0 || (q.ax > 0.07 && q.ax < 0.2 && q.y < 1.33))) return S;
    if (q.part === THIGH && q.t < 0.3) return S;
    if (q.part === FOOT || (q.part === SHIN && q.t > 0.3)) return q.part === SHIN && q.t < 0.42 ? WHITE : BLACK;
  },
  hoodie: (q, S) => {
    if (q.part === HEAD) return (q.back || !E(q.x, q.y, 0, 1.445, 0.215, 0.2)) ? S : undefined;
    if ((q.part === TORSO && q.y > 0.56) || q.part === UARM || (q.part === FARM && q.t < 0.78)) return (q.part === TORSO && q.y < 0.62) || (q.part === FARM && q.t > 0.68) ? shade(S, 0.85) : S;
    if (shoe(q)) return WHITE;
    if (q.part === TORSO || legs(q)) return JEANS;
  },
  tshirt: (q, S) => {
    if ((q.part === TORSO && q.y > 0.6) || (q.part === UARM && q.t < 0.7)) return S;
    if (q.part === TORSO || (q.part === THIGH && q.t < 0.8)) return 0x2f3f6e;
    if (q.part === FOOT) return WHITE;
  },
  suit: (q, S) => {
    if (!q.back && q.part === TORSO && q.y > 0.74 && q.ax < (q.y - 0.74) * 0.3) return WHITE;
    if ((q.part === TORSO && q.y > 0.54) || q.part === UARM || (q.part === FARM && q.t < 0.8)) return S;
    if (shoe(q)) return BLACK;
    if (q.part === TORSO || legs(q)) return shade(S, 0.8);
  },
  cop: (q, S) => {
    if (q.part === TORSO && between(q.y, 0.56, 0.635)) return BLACK;
    if ((q.part === TORSO && q.y > 0.6) || q.part === UARM || (q.part === FARM && q.t < 0.25)) return S;
    if (shoe(q)) return BLACK;
    if (q.part === TORSO || legs(q)) return shade(S, 0.7);
  },
  prisoner: (q, S) => {
    if (shoe(q)) return WHITE;
    if (q.part === TORSO || q.part === UARM || (q.part === FARM && q.t < 0.8) || legs(q)) return S;
  },
  builder: (q, S) => {
    if (q.part === TORSO && q.y > 0.6 && q.y < 1.29 && (q.back || q.ax > 0.045) && q.ax < 0.275) return (between(q.y, 0.72, 0.79) || (between(q.ax, 0.13, 0.185) && q.y > 0.79)) ? 0xeceec2 : S;
    if ((q.part === TORSO && q.y > 0.58) || (q.part === UARM && q.t < 0.65)) return WHITE;
    if (shoe(q)) return BROWN;
    if (q.part === TORSO || legs(q)) return JEANS;
  },
  chef: q => {
    if (q.part === TORSO && between(q.y, 1.14, 1.245)) return RED;
    if (!q.back && q.part === TORSO && between(q.y, 0.34, 0.98) && q.ax < 0.2) return 0xdbe4ee;
    if ((q.part === TORSO && q.y > 0.52) || q.part === UARM || (q.part === FARM && q.t < 0.82)) return WHITE;
    if (shoe(q)) return BLACK;
    if (q.part === TORSO || legs(q)) return ((Math.floor(q.x * 22 + 50) + Math.floor(q.y * 22)) & 1) ? 0x2a2a30 : 0xe8e8e8;
  },
  boxer: (q, S) => {
    if (q.part === TORSO && between(q.y, 0.585, 0.655)) return WHITE;
    if ((q.part === TORSO && q.y < 0.585 && q.y > 0.3) || (q.part === THIGH && q.t < 0.6)) return q.ax > 0.255 ? WHITE : S;
    if (q.part === FARM && q.t > 0.6) return q.t < 0.68 ? WHITE : RED;
    if (q.part === FOOT || (q.part === SHIN && q.t > 0.25)) return BLACK;
  },
  hero: (q, S, B, kc) => {
    const C = kc === 0 ? YELLOW : RED;
    if (q.part === TORSO && between(q.y, 0.6, 0.665)) return YELLOW;
    if (q.part === TORSO && q.y < 0.6 && q.y > 0.36) return C;
    if ((q.part === FARM && q.t > 0.6) || q.part === FOOT || (q.part === SHIN && q.t > 0.3)) return C;
    if (q.part !== HEAD) return S;
  },
  ninja: (q, S) => {
    if (q.part === HEAD) return (!q.back && between(q.y, 1.405, 1.545) && q.ax < 0.215) ? undefined : S;
    if (q.part === TORSO && between(q.y, 0.58, 0.66)) return 0xb3261e;
    if ((q.part === FARM && between(q.t, 0.35, 0.8)) || (q.part === SHIN && between(q.t, 0.2, 0.7))) return (Math.floor(q.t * 14) & 1) ? shade(S, 1.35) : S;
    return S;
  },
  santa: (q, S) => {
    if (q.part === TORSO && between(q.y, 0.62, 0.7)) return BLACK;
    if ((q.part === TORSO && between(q.y, 0.5, 0.585)) || (!q.back && q.part === TORSO && q.ax < 0.04 && q.y > 0.585) || (q.part === FARM && between(q.t, 0.58, 0.76)) || (q.part === SHIN && between(q.t, 0.15, 0.32))) return WHITE;
    if (q.part === FOOT || (q.part === SHIN && q.t >= 0.32)) return BLACK;
    if (q.part === FARM && q.t >= 0.76) return 0x2f8f4a;
    if (q.part !== HEAD) return S;
  },
  pirate: (q, S) => {
    if (q.part === TORSO && between(q.y, 0.56, 0.66)) return 0xb3261e;
    if (q.part === TORSO && q.y > 0.66) return (Math.floor(q.y * 16) & 1) ? S : 0xf0ead8;
    if (q.part === UARM || (q.part === FARM && q.t < 0.3)) return (Math.floor(q.t * 5 + (q.part === FARM ? 5 : 0)) & 1) ? S : 0xf0ead8;
    if (q.part === FOOT || (q.part === SHIN && q.t >= 0.3)) return 0x1f1f24;
    if (q.part === TORSO || legs(q)) return 0x4a3626;
  },
  astronaut: (q, S) => {
    if ((q.part === FARM && between(q.t, 0.28, 0.4)) || (q.part === SHIN && between(q.t, 0.12, 0.26)) || (q.part === UARM && between(q.t, 0.5, 0.64))) return 0x2f6fd6;
    if ((q.part === FARM && q.t > 0.66) || q.part === FOOT || (q.part === SHIN && q.t > 0.5)) return GRAY;
    if (q.part !== HEAD) return S;
  },
  overalls: (q, S) => {
    if (q.part === TORSO && q.y < 0.98 && (q.y < 0.62 || q.ax < 0.17)) return S;
    if (q.part === TORSO && between(q.y, 0.98, 1.32) && between(q.ax, 0.09, 0.17)) return S;
    if ((q.part === TORSO && q.y > 0.55) || q.part === UARM || (q.part === FARM && q.t < 0.45)) return (frac(q.x * 9) < 0.14 || frac(q.y * 9) < 0.14) ? 0x8f2c26 : 0xc8433a;
    if (shoe(q)) return BROWN;
    if (legs(q)) return S;
  },
  hawaii: (q, S) => {
    if (!q.back && q.part === TORSO && q.y > 0.95 && q.ax < (q.y - 0.95) * 0.36) return undefined;
    if ((q.part === TORSO && q.y > 0.58) || (q.part === UARM && q.t < 0.75)) {
      const gx = q.x * 6.5 + 20, gy = q.y * 6.5 + (Math.floor(gx) & 1) * 0.5, fx = frac(gx) - 0.5, fy = frac(gy) - 0.5, d = Math.hypot(fx, fy);
      if (d < 0.1) return YELLOW;
      if (d < 0.23 + 0.09 * Math.cos(5 * Math.atan2(fy, fx))) return WHITE;
      return S;
    }
    if (q.part === TORSO || (q.part === THIGH && q.t < 0.85)) return 0xd9c38f;
    if (q.part === FOOT) return BROWN;
  },
  karate: (q, S) => {
    if (q.part === TORSO && between(q.y, 0.585, 0.66)) return BLACK;
    if (q.part === TORSO || q.part === UARM || (q.part === FARM && q.t < 0.7) || q.part === THIGH || (q.part === SHIN && q.t < 0.6)) return S;
  },
  referee: q => {
    if (q.part === TORSO && between(q.y, 1.16, 1.26)) return BLACK;
    if ((q.part === TORSO && q.y > 0.58) || (q.part === UARM && q.t < 0.7)) return (Math.floor(q.x * 13 + 100.5) & 1) ? BLACK : WHITE;
    if (q.part === TORSO || legs(q) || q.part === FOOT) return BLACK;
  },
  jersey: (q, S) => {
    if ((q.part === UARM && between(q.t, 0.55, 0.7)) || (q.part === TORSO && between(q.y, 1.17, 1.25))) return WHITE;
    if ((q.part === TORSO && q.y > 0.6) || (q.part === UARM && q.t < 0.7)) return S;
    if (q.part === TORSO || (q.part === THIGH && q.t < 0.7)) return WHITE;
    if (q.part === SHIN && between(q.t, 0.15, 0.72)) return S;
    if (shoe(q)) return BLACK;
  },
  mummy: q => {
    if (q.part === HEAD && !q.back && between(q.y, 1.425, 1.52) && q.ax < 0.2) return 0x2a2620;
    return Math.sin(q.y * 70 + Math.sin(q.x * 9 + q.part) * 3 + q.part * 1.7) > 0.86 ? 0xa89f84 : 0xe6dfc8;
  },
  robot: (q, S) => {
    if (q.part === HEAD && !q.back && E(q.x, q.y, 0, 1.47, 0.2, 0.09)) return 0x1c2733;
    if ((q.part === UARM && q.t > 0.8) || (q.part === FARM && q.t < 0.15) || (q.part === THIGH && q.t > 0.85) || (q.part === SHIN && q.t < 0.12) || (q.part === TORSO && between(q.y, 0.62, 0.66))) return 0x4a4d57;
    return S;
  },
  clown: (q, S) => {
    if (shoe(q)) return RED;
    if (q.part === FARM && between(q.t, 0.7, 0.8)) return WHITE;
    if (q.part === TORSO || q.part === UARM || (q.part === FARM && q.t < 0.7) || legs(q)) {
      const gx = q.x * 5 + 20, gy = q.y * 5 + (Math.floor(gx) & 1) * 0.5;
      if (Math.hypot(frac(gx) - 0.5, frac(gy) - 0.5) < 0.24) return [RED, 0x2f6fd6, 0x44a94e, 0xf07ab0][(Math.floor(gx) * 3 + Math.floor(gy) * 5) & 3];
      return S;
    }
  }
};
const HEAD_PAINT = {
  lucha: (q, S) => {
    if (q.part !== HEAD) return undefined;
    if (!q.back && (E(q.ax, q.y, 0.088, 1.468, 0.078, 0.072) || E(q.x, q.y, 0, 1.325, 0.075, 0.04))) return undefined;
    return S;
  }
};
const FACE_PAINT = {
  bandit: q => (q.part === HEAD && between(q.y, 1.415, 1.53)) ? BLACK : undefined
};

// ------------------------------------------------------------------------------------------------ decals
// drawn with the 2D canvas API on top of the painted atlas. D gives character-space drawing helpers.
const DECAL = {
  bear: D => { D.ell(0, 1.405, 0.042, 0.03, BLACK); D.line([[0, 1.375], [0, 1.345]], 0.012, BLACK); },
  cat: D => {
    D.poly([[-0.03, 1.405], [0.03, 1.405], [0, 1.375]], PINK);
    for (const s of [-1, 1]) for (const dy of [-0.025, 0, 0.025]) D.line([[s * 0.05, 1.37 + dy * 0.4], [s * 0.2, 1.37 + dy * 1.6]], 0.008, 0x444444);
  },
  bunny: D => { D.ell(0, 1.395, 0.028, 0.02, PINK); D.rect(-0.025, 1.3, 0.025, 1.355, WHITE); D.line([[0, 1.3], [0, 1.355]], 0.006, 0x999999); },
  shark: D => {
    const pts = []; for (let i = 0; i <= 12; i++) pts.push([-0.19 + i * 0.0317, 1.41 - (i & 1) * 0.04 - Math.abs(i - 6) * 0.004]);
    D.poly([[-0.19, 1.41], ...pts, [0.19, 1.41]], 0x8a2030); D.line(pts, 0.012, WHITE);
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { D.line([[s * (0.2 + i * 0.03), 1.1], [s * (0.18 + i * 0.03), 0.98]], 0.012, 0x555c66); D.line([[s * (0.2 + i * 0.03), 1.1], [s * (0.18 + i * 0.03), 0.98]], 0.012, 0x555c66, true); }
  },
  frog: (D, S) => { for (const [x, y, r] of [[-0.12, 1.0, 0.04], [0.1, 0.9, 0.05], [-0.05, 0.72, 0.045], [0.15, 0.62, 0.035], [-0.16, 0.6, 0.03], [0.02, 1.15, 0.035]]) D.ell(x, y, r, r, shade(S, 0.75), true); },
  penguin: D => { D.poly([[-0.035, 1.42], [0.035, 1.42], [0, 1.37]], ORANGE); },
  skeleton: D => {
    const W = 0xf4f4ec;
    for (const b of [false, true]) {
      for (let i = 0; i < 5; i++) { const y = 1.13 - i * 0.075, w = 0.2 - Math.abs(i - 1.5) * 0.015; D.curve([[-w, y + 0.02], [0, y - 0.03 + (b ? 0.05 : 0)], [w, y + 0.02]], 0.026, W, b); }
      D.line([[0, b ? 1.2 : 1.17], [0, b ? 0.62 : 0.82]], 0.03, W, b);
      D.ring(0, 0.6, 0.15, 0.085, 0.035, W, b);
      for (const s of [-1, 1]) {
        D.line([[s * 0.27, 1.13], [s * 0.46, 0.965]], 0.036, W, b); D.line([[s * 0.48, 0.95], [s * 0.6, 0.76]], 0.03, W, b);
        D.ell(s * 0.625, 0.715, 0.05, 0.05, W, b); D.ell(s * 0.47, 0.96, 0.035, 0.035, W, b);
        D.line([[s * 0.14, 0.52], [s * 0.16, 0.34]], 0.04, W, b); D.line([[s * 0.165, 0.29], [s * 0.17, 0.16]], 0.034, W, b);
        D.ell(s * 0.16, 0.315, 0.036, 0.036, W, b); D.ell(s * 0.17, 0.075, 0.06, 0.035, W, b);
      }
    }
    D.ell(0, 1.46, 0.2, 0.19, W); D.rect(-0.11, 1.26, 0.11, 1.36, W);
    D.ell(-0.088, 1.47, 0.062, 0.068, 0x1d1d24); D.ell(0.088, 1.47, 0.062, 0.068, 0x1d1d24);
    D.poly([[-0.022, 1.375], [0.022, 1.375], [0, 1.41]], 0x1d1d24);
    for (let i = -3; i <= 3; i++) D.line([[i * 0.03, 1.265], [i * 0.03, 1.33]], 0.008, 0x1d1d24);
    D.ell(0, 1.46, 0.2, 0.2, W, true);
  },
  singlet: (D, S) => {
    const c = S === BLACK || (S & 0xff) + ((S >> 8) & 0xff) + (S >> 16) < 200 ? WHITE : WHITE;
    D.ell(0, 0.86, 0.085, 0.075, c); D.rect(-0.05, 0.765, 0.05, 0.82, c);
    D.ell(-0.035, 0.865, 0.024, 0.028, S); D.ell(0.035, 0.865, 0.024, 0.028, S);
    D.poly([[-0.012, 0.815], [0.012, 0.815], [0, 0.84]], S);
    for (const i of [-1, 0, 1]) D.line([[i * 0.024, 0.768], [i * 0.024, 0.795]], 0.007, S);
  },
  hoodie: (D, S) => {
    D.rrect(-0.15, 0.64, 0.15, 0.8, 0.04, shade(S, 0.82));
    for (const s of [-1, 1]) { D.line([[s * 0.05, 1.2], [s * 0.06, 1.02]], 0.014, WHITE); D.ell(s * 0.06, 1.01, 0.014, 0.02, WHITE); }
  },
  suit: (D, S) => {
    D.poly([[-0.035, 1.14], [0.035, 1.14], [0.022, 1.09], [0.045, 0.86], [0, 0.8], [-0.045, 0.86], [-0.022, 1.09]], RED);
    for (const s of [-1, 1]) D.line([[s * 0.125, 1.16], [s * 0.01, 0.76]], 0.012, shade(S, 0.6));
    D.ell(0, 0.68, 0.016, 0.016, shade(S, 0.5));
  },
  cop: D => {
    D.star(0.12, 1.0, 0.055, GOLD); D.rect(-0.05, 0.565, 0.05, 0.63, 0xc8ccd4);
    D.poly([[-0.025, 1.18], [0.025, 1.18], [0.018, 0.8], [0, 0.77], [-0.018, 0.8]], BLACK);
    D.line([[-0.2, 0.93], [-0.07, 0.93]], 0.008, 0x111827);
  },
  prisoner: (D, S) => {
    D.rrect(-0.15, 0.94, -0.02, 1.02, 0.01, WHITE); D.text('24601', -0.085, 0.98, 0.045, BLACK);
    D.text('P-07', 0, 0.95, 0.13, shade(S, 0.55), true);
  },
  chef: D => { for (const s of [-1, 1]) for (let i = 0; i < 3; i++) D.ell(s * 0.07, 1.08 - i * 0.045, 0.013, 0.013, 0x444444); },
  boxer: (D, S) => { D.text('B', 0, 0.615, 0.06, S); },
  hero: (D, S, B, kc) => { D.poly([[0, 1.14], [0.12, 1.0], [0, 0.86], [-0.12, 1.0]], YELLOW); D.star(0, 1.0, 0.07, kc === 0 ? 0x2f6fd6 : RED); D.rect(-0.04, 0.6, 0.04, 0.665, GOLD); },
  santa: D => { D.rect(-0.05, 0.615, 0.05, 0.705, GOLD); D.rect(-0.028, 0.635, 0.028, 0.685, BLACK); },
  pirate: D => { D.rect(-0.04, 0.565, 0.04, 0.655, GOLD); },
  astronaut: D => {
    D.rrect(-0.12, 0.88, 0.12, 1.04, 0.02, 0xc9ccd4); D.ell(-0.07, 0.96, 0.022, 0.022, RED); D.ell(0, 0.96, 0.022, 0.022, YELLOW); D.ell(0.07, 0.96, 0.022, 0.022, 0x44a94e);
    D.rect(-0.1, 1.07, 0.1, 1.085, 0x2f6fd6);
  },
  overalls: (D, S) => {
    D.rrect(-0.09, 0.72, 0.09, 0.86, 0.015, shade(S, 0.82)); D.line([[-0.09, 0.82], [0.09, 0.82]], 0.008, shade(S, 0.6));
    for (const s of [-1, 1]) D.ell(s * 0.13, 0.97, 0.022, 0.022, GOLD);
  },
  karate: D => {
    for (const s of [-1, 1]) D.line([[s * 0.11, 1.2], [-s * 0.03, 0.68]], 0.016, 0xc8c8c8);
    D.rect(-0.04, 0.575, 0.04, 0.665, BLACK); D.line([[-0.02, 0.58], [-0.07, 0.4]], 0.03, BLACK); D.line([[0.02, 0.58], [0.06, 0.42]], 0.03, BLACK);
  },
  jersey: D => { D.text('10', 0, 0.95, 0.1, WHITE); D.text('10', 0, 0.95, 0.2, WHITE, true); },
  robot: D => {
    D.rrect(-0.14, 0.8, 0.14, 1.06, 0.02, 0x3a3d47);
    D.ell(-0.08, 0.99, 0.025, 0.025, RED); D.ell(0, 0.99, 0.025, 0.025, YELLOW); D.ell(0.08, 0.99, 0.025, 0.025, 0x44d06a);
    for (let i = 0; i < 4; i++) D.rect(-0.1, 0.84 + i * 0.025, 0.1, 0.852 + i * 0.025, 0x8d9099);
    for (const [x, y] of [[-0.22, 1.1], [0.22, 1.1], [-0.2, 0.7], [0.2, 0.7]]) D.ell(x, y, 0.014, 0.014, 0x33363f);
  },
  clown: D => { for (let i = 0; i < 3; i++) D.ell(0, 1.08 - i * 0.14, 0.04, 0.04, [RED, 0x2f6fd6, YELLOW][i]); }
};
const HEAD_DECAL = {
  lucha: (D, S) => {
    const c = WHITE;
    for (const s of [-1, 1]) D.ring(s * 0.088, 1.468, 0.078, 0.072, 0.016, c);
    D.ring(0, 1.325, 0.075, 0.04, 0.014, c);
    D.poly([[0, 1.66], [0.03, 1.6], [0, 1.57], [-0.03, 1.6]], GOLD);
    for (let i = 0; i < 5; i++) { D.line([[-0.035, 1.62 - i * 0.07], [0.035, 1.585 - i * 0.07]], 0.01, c, true); D.line([[0.035, 1.62 - i * 0.07], [-0.035, 1.585 - i * 0.07]], 0.01, c, true); }
  }
};

// ------------------------------------------------------------------------------------------------ part map
const mapCache = {};
function partMap(hw, hh) {
  const key = hw + 'x' + hh; if (mapCache[key]) return mapCache[key];
  const part = new Uint8Array(hw * hh), tt = new Float32Array(hw * hh);
  const W = ATLAS.x1 - ATLAS.x0, H = ATLAS.y1 - ATLAS.y0;
  const segs = [   // [part, ax, ay, bx, by, ra, rb]
    [HEAD, 0, 1.43, 0, 1.43, 0.285, 0.285], [TORSO, 0, 1.12, 0, 0.6, 0.27, 0.31], [TORSO, 0, 1.15, 0.19, 1.15, 0.17, 0.17],
    [UARM, 0.26, 1.13, 0.47, 0.96, 0.135, 0.12], [FARM, 0.47, 0.96, 0.625, 0.715, 0.12, 0.128],
    [THIGH, 0.13, 0.55, 0.16, 0.31, 0.17, 0.145], [SHIN, 0.16, 0.31, 0.17, 0.14, 0.145, 0.125], [FOOT, 0.17, 0.085, 0.17, 0.085, 0.115, 0.115]
  ];
  for (let j = 0; j < hh; j++) for (let i = 0; i < hw; i++) {
    const x = Math.abs(ATLAS.x0 + (i + 0.5) / hw * W), y = ATLAS.y1 - (j + 0.5) / hh * H;
    let bd = 1e9, bp = 0, bt = 0;
    for (const s of segs) {
      const ex = s[3] - s[1], ey = s[4] - s[2], l2 = ex * ex + ey * ey;
      let t = l2 > 1e-9 ? ((x - s[1]) * ex + (y - s[2]) * ey) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const d = Math.hypot(x - s[1] - ex * t, y - s[2] - ey * t) - (s[5] + (s[6] - s[5]) * t);
      if (d < bd) { bd = d; bp = s[0]; bt = t; }
    }
    part[j * hw + i] = bp; tt[j * hw + i] = bt;
  }
  return (mapCache[key] = { part, t: tt });
}

function decalHelper(ctx, hw, hh) {
  const W = ATLAS.x1 - ATLAS.x0, H = ATLAS.y1 - ATLAS.y0, s = hw / W;
  const X = (x, b) => (b ? hw : 0) + (x - ATLAS.x0) * s, Y = y => (ATLAS.y1 - y) / H * hh;
  const clip = b => { ctx.save(); ctx.beginPath(); ctx.rect(b ? hw : 0, 0, hw, hh); ctx.clip(); };
  const D = {
    ell(x, y, rx, ry, c, b) { clip(b); ctx.fillStyle = css(c); ctx.beginPath(); ctx.ellipse(X(x, b), Y(y), rx * s, ry * s, 0, 0, 6.3); ctx.fill(); ctx.restore(); },
    ring(x, y, rx, ry, w, c, b) { clip(b); ctx.strokeStyle = css(c); ctx.lineWidth = w * s; ctx.beginPath(); ctx.ellipse(X(x, b), Y(y), rx * s, ry * s, 0, 0, 6.3); ctx.stroke(); ctx.restore(); },
    rect(x0, y0, x1, y1, c, b) { clip(b); ctx.fillStyle = css(c); ctx.fillRect(X(x0, b), Y(y1), (x1 - x0) * s, (y1 - y0) * s); ctx.restore(); },
    rrect(x0, y0, x1, y1, r, c, b) { clip(b); ctx.fillStyle = css(c); ctx.beginPath(); ctx.roundRect(X(x0, b), Y(y1), (x1 - x0) * s, (y1 - y0) * s, r * s); ctx.fill(); ctx.restore(); },
    poly(p, c, b) { clip(b); ctx.fillStyle = css(c); ctx.beginPath(); p.forEach((q, i) => (i ? ctx.lineTo(X(q[0], b), Y(q[1])) : ctx.moveTo(X(q[0], b), Y(q[1])))); ctx.closePath(); ctx.fill(); ctx.restore(); },
    line(p, w, c, b) { clip(b); ctx.strokeStyle = css(c); ctx.lineWidth = w * s; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); p.forEach((q, i) => (i ? ctx.lineTo(X(q[0], b), Y(q[1])) : ctx.moveTo(X(q[0], b), Y(q[1])))); ctx.stroke(); ctx.restore(); },
    curve(p, w, c, b) { clip(b); ctx.strokeStyle = css(c); ctx.lineWidth = w * s; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(X(p[0][0], b), Y(p[0][1])); ctx.quadraticCurveTo(X(p[1][0], b), Y(p[1][1]), X(p[2][0], b), Y(p[2][1])); ctx.stroke(); ctx.restore(); },
    star(x, y, r, c, b) { clip(b); ctx.fillStyle = css(c); ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = (i & 1 ? r * 0.45 : r) * s; ctx.lineTo(X(x, b) + Math.cos(a) * q, Y(y) + Math.sin(a) * q); } ctx.closePath(); ctx.fill(); ctx.restore(); },
    text(str, x, y, size, c, b) {
      clip(b); ctx.fillStyle = css(c); ctx.font = '900 ' + Math.round(size * s) + 'px Impact, "Arial Black", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.translate(X(x, b), Y(y)); if (b) ctx.scale(-1, 1); ctx.fillText(str, 0, 0); ctx.restore();
    }
  };
  return D;
}

// Paints the whole body atlas for a look. hw = width of one half in pixels.
export function paintLook(look, hw) {
  const hh = Math.round(hw * 1.125), cv = document.createElement('canvas'); cv.width = hw * 2; cv.height = hh;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(hw * 2, hh), px = new Uint32Array(img.data.buffer);
  const { part, t } = partMap(hw, hh), W = ATLAS.x1 - ATLAS.x0, H = ATLAS.y1 - ATLAS.y0;
  const B = PAL[look.c], S = PAL[look.kc], kid = COSTUMES[look.k].id, hid = HEADS[look.h].id, fid = FACES[look.f].id;
  const cp = PAINT[kid], hp = HEAD_PAINT[hid], fp = FACE_PAINT[fid];
  const q = { x: 0, y: 0, ax: 0, back: false, part: 0, t: 0 };
  const abgr = c => 0xff000000 | ((c & 255) << 16) | (c & 0xff00) | (c >> 16);
  for (let j = 0; j < hh; j++) {
    q.y = ATLAS.y1 - (j + 0.5) / hh * H;
    for (let i = 0; i < hw; i++) {
      const n = j * hw + i; q.x = ATLAS.x0 + (i + 0.5) / hw * W; q.ax = Math.abs(q.x); q.part = part[n]; q.t = t[n];
      for (let b = 0; b < 2; b++) {
        q.back = b === 1; let c = B, r;
        if (cp && (r = cp(q, S, B, look.kc)) !== undefined) c = r;
        if (hp && (r = hp(q, S, B)) !== undefined) c = r;
        if (fp && (r = fp(q, S, B)) !== undefined) c = r;
        px[j * hw * 2 + i + b * hw] = abgr(c);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  const D = decalHelper(ctx, hw, hh);
  if (DECAL[kid]) DECAL[kid](D, S, B, look.kc);
  if (HEAD_DECAL[hid]) HEAD_DECAL[hid](D, S, B);
  return cv;
}

// ------------------------------------------------------------------------------------------------ add-ons
const GEO = {}; const MATS = new Map();
function geo() {
  if (!GEO.sph) {
    GEO.sph = new THREE.SphereGeometry(1, 16, 12); GEO.box = new THREE.BoxGeometry(1, 1, 1); GEO.cone = new THREE.ConeGeometry(1, 1, 14);
    GEO.cyl = new THREE.CylinderGeometry(1, 1, 1, 16); GEO.tor = new THREE.TorusGeometry(1, 0.12, 8, 24); GEO.dome = new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    GEO.tcone = new THREE.CylinderGeometry(0.72, 1, 1, 16);
  }
  return GEO;
}
function mat(c, extra) {
  const k = c + (extra ? JSON.stringify(extra) : ''); let m = MATS.get(k);
  if (!m) { m = new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.66, metalness: 0 }, extra || {})); MATS.set(k, m); }
  return m;
}
const UP = new THREE.Vector3(0, 1, 0), _v = new THREE.Vector3();
function put(h, g, m, x, y, z, sx, sy, sz, dir) {
  const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz);
  if (dir) o.quaternion.setFromUnitVectors(UP, _v.set(dir[0], dir[1], dir[2]).normalize());
  o.castShadow = true; h.add(o); return o;
}
const A = {
  sph: (h, x, y, z, rx, ry, rz, c, e) => put(h, geo().sph, mat(c, e), x, y, z, rx, ry === undefined ? rx : ry, rz === undefined ? rx : rz),
  box: (h, x, y, z, w, hh, d, c, dir) => put(h, geo().box, mat(c), x, y, z, w, hh, d, dir),
  // cone with its base centred at (x,y,z), pointing along dir
  cone: (h, x, y, z, r, len, c, dir, rz) => { const d = _v.set(dir[0], dir[1], dir[2]).normalize().clone(); return put(h, geo().cone, mat(c), x + d.x * len / 2, y + d.y * len / 2, z + d.z * len / 2, r, len, rz === undefined ? r : rz, [d.x, d.y, d.z]); },
  cyl: (h, x, y, z, r, len, c, dir, e) => put(h, geo().cyl, mat(c, e), x, y, z, r, len, r, dir),
  tor: (h, x, y, z, R, c, dir, thick) => { const o = put(h, geo().tor, mat(c), x, y, z, R, R, R * (thick || 1), null); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), _v.set(dir[0], dir[1], dir[2]).normalize()); return o; },
  dome: (h, x, y, z, rx, ry, rz, c, e) => put(h, geo().dome, mat(c, e), x, y, z, rx, ry, rz)
};

const ADDON = {
  chicken: (H, S) => {
    const h = H[BONE.HEAD], p = H[BONE.PELVIS];
    A.sph(h, 0, 1.75, 0.1, 0.045, 0.075, 0.07, RED); A.sph(h, 0, 1.77, 0.0, 0.05, 0.09, 0.08, RED); A.sph(h, 0, 1.745, -0.1, 0.045, 0.07, 0.07, RED);
    A.cone(h, 0, 1.395, 0.285, 0.07, 0.16, ORANGE, [0, -0.15, 1], 0.05); A.sph(h, 0, 1.31, 0.3, 0.035, 0.065, 0.03, RED);
    for (const s of [-1, 0, 1]) A.sph(p, s * 0.08, 0.72, -0.3, 0.06, 0.16, 0.035, shade(S, 0.9)).rotation.set(-0.7, 0, -s * 0.35);
  },
  bear: (H, S) => {
    const h = H[BONE.HEAD];
    for (const s of [-1, 1]) { A.sph(h, s * 0.2, 1.685, 0.0, 0.095, 0.095, 0.06, S); A.sph(h, s * 0.2, 1.685, 0.035, 0.055, 0.055, 0.035, CREAM); }
    A.sph(H[BONE.PELVIS], 0, 0.62, -0.31, 0.07, 0.07, 0.06, S);
  },
  dino: (H, S) => {
    const h = H[BONE.HEAD], c = H[BONE.CHEST], p = H[BONE.PELVIS], L = mix(S, 0xfff2b0, 0.55);
    A.cone(h, 0, 1.69, 0.08, 0.03, 0.11, L, [0, 1, 0.2], 0.06); A.cone(h, 0, 1.7, -0.06, 0.03, 0.12, L, [0, 1, -0.3], 0.065); A.cone(h, 0, 1.6, -0.2, 0.03, 0.12, L, [0, 0.5, -1], 0.065);
    A.cone(c, 0, 1.22, -0.26, 0.03, 0.13, L, [0, 0.3, -1], 0.07); A.cone(c, 0, 1.02, -0.29, 0.03, 0.13, L, [0, 0, -1], 0.07);
    A.cone(p, 0, 0.8, -0.3, 0.03, 0.12, L, [0, -0.1, -1], 0.07);
    A.cone(p, 0, 0.56, -0.24, 0.17, 0.62, S, [0, -0.45, -1]); A.cone(p, 0, 0.5, -0.5, 0.025, 0.1, L, [0, 0.8, -0.4], 0.05);
  },
  cat: (H, S) => {
    const h = H[BONE.HEAD], p = H[BONE.PELVIS];
    for (const s of [-1, 1]) { A.cone(h, s * 0.17, 1.64, 0.0, 0.085, 0.15, S, [s * 0.35, 1, 0], 0.05); A.cone(h, s * 0.17, 1.65, 0.03, 0.05, 0.1, PINK, [s * 0.35, 1, 0], 0.025); }
    A.cyl(p, 0, 0.62, -0.38, 0.045, 0.26, S, [0, 0.5, -1]); A.cyl(p, 0, 0.78, -0.5, 0.045, 0.24, S, [0, 1, -0.2]); A.sph(p, 0, 0.9, -0.52, 0.05, 0.05, 0.05, S);
  },
  bunny: (H, S) => {
    const h = H[BONE.HEAD];
    for (const s of [-1, 1]) { A.sph(h, s * 0.11, 1.9, -0.01, 0.062, 0.24, 0.04, S).rotation.z = -s * 0.14; A.sph(h, s * 0.11, 1.9, 0.02, 0.034, 0.18, 0.025, PINK).rotation.z = -s * 0.14; }
    A.sph(H[BONE.PELVIS], 0, 0.62, -0.32, 0.09, 0.09, 0.08, WHITE);
  },
  shark: (H, S) => {
    A.cone(H[BONE.HEAD], 0, 1.66, -0.06, 0.035, 0.26, S, [0, 1, -0.45], 0.16);
    A.cone(H[BONE.CHEST], 0, 1.05, -0.28, 0.03, 0.22, S, [0, 0.4, -1], 0.13);
    const p = H[BONE.PELVIS]; A.cone(p, 0, 0.6, -0.28, 0.1, 0.28, S, [0, -0.2, -1]); A.cone(p, 0, 0.56, -0.5, 0.025, 0.24, S, [0, 1, -0.5], 0.1); A.cone(p, 0, 0.54, -0.5, 0.025, 0.16, S, [0, -1, -0.5], 0.08);
  },
  frog: (H, S) => { for (const s of [-1, 1]) A.sph(H[BONE.HEAD], s * 0.15, 1.69, 0.08, 0.1, 0.1, 0.1, S); },
  panda: H => { for (const s of [-1, 1]) A.sph(H[BONE.HEAD], s * 0.2, 1.685, 0.0, 0.095, 0.095, 0.06, BLACK); },
  hero: (H, S, B, kc) => { const c = kc === 0 ? YELLOW : RED, ch = H[BONE.CHEST]; A.box(ch, 0, 0.82, -0.33, 0.56, 0.82, 0.035, c).rotation.x = -0.1; A.box(ch, 0, 1.2, -0.27, 0.5, 0.1, 0.06, c); },
  astronaut: H => { const c = H[BONE.CHEST]; A.box(c, 0, 0.98, -0.34, 0.4, 0.46, 0.16, 0xdcdfe6); A.box(c, 0, 1.22, -0.36, 0.26, 0.08, 0.1, GRAY); },
  boxer: (H) => { A.sph(H[BONE.FARM_L], 0.625, 0.715, 0.04, 0.155, 0.155, 0.155, RED); A.sph(H[BONE.FARM_R], -0.625, 0.715, 0.04, 0.155, 0.155, 0.155, RED); },
  clown: H => {
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; A.sph(H[BONE.CHEST], Math.cos(a) * 0.25, 1.21, Math.sin(a) * 0.23 + 0.01, 0.075, 0.05, 0.075, WHITE); }
    A.sph(H[BONE.FOOT_L], 0.175, 0.085, 0.13, 0.115, 0.09, 0.19, RED); A.sph(H[BONE.FOOT_R], -0.175, 0.085, 0.13, 0.115, 0.09, 0.19, RED);
  },
  santa: H => { A.sph(H[BONE.CHEST], 0, 1.21, 0.0, 0.3, 0.07, 0.29, WHITE); }
};

const HEAD_ADDON = {
  hair: h => { const c = 0x5a3a22; A.sph(h, 0, 1.6, -0.04, 0.275, 0.17, 0.275, c); A.sph(h, 0.02, 1.645, 0.15, 0.2, 0.085, 0.12, c); A.sph(h, 0, 1.47, -0.2, 0.25, 0.2, 0.14, c); },
  mohawk: h => { for (let i = 0; i < 6; i++) { const a = -0.5 + i * 0.42; A.sph(h, 0, 1.43 + Math.cos(a) * 0.3, 0.02 - Math.sin(a) * 0.3 + 0.12, 0.035, 0.1, 0.075, 0xe0399a).rotation.x = a; } },
  afro: h => { A.sph(h, 0, 1.64, -0.08, 0.34, 0.33, 0.33, 0x2b211c); },
  cap: (h, S) => { A.dome(h, 0, 1.53, 0.01, 0.295, 0.2, 0.295, S); A.sph(h, 0, 1.545, 0.31, 0.19, 0.022, 0.16, shade(S, 0.8)); A.sph(h, 0, 1.73, 0.01, 0.03, 0.02, 0.03, shade(S, 0.8)); },
  beanie: (h, S) => { A.dome(h, 0, 1.5, 0.01, 0.3, 0.26, 0.3, S); A.tor(h, 0, 1.52, 0.01, 0.285, shade(S, 0.8), [0, 1, 0], 1.6); A.sph(h, 0, 1.79, 0.01, 0.06, 0.06, 0.06, WHITE); },
  hardhat: h => { A.dome(h, 0, 1.54, 0.01, 0.3, 0.22, 0.3, YELLOW); A.cyl(h, 0, 1.545, 0.04, 0.35, 0.025, YELLOW, [0, 1, 0]); A.box(h, 0, 1.66, 0.01, 0.06, 0.2, 0.5, 0xd9ac12); },
  chefhat: h => { A.cyl(h, 0, 1.72, 0, 0.23, 0.2, WHITE, [0, 1, 0]); for (let i = 0; i < 5; i++) { const a = i * 1.2566; A.sph(h, Math.cos(a) * 0.13, 1.88, Math.sin(a) * 0.13, 0.15, 0.13, 0.15, WHITE); } A.sph(h, 0, 1.93, 0, 0.14, 0.11, 0.14, WHITE); },
  copcap: h => { const c = 0x1f2a5c; A.cyl(h, 0, 1.68, 0, 0.26, 0.1, c, [0, 1, 0]); A.cyl(h, 0, 1.76, 0.02, 0.31, 0.07, c, [0, 1, 0.12]); A.sph(h, 0, 1.63, 0.29, 0.2, 0.02, 0.13, BLACK); A.sph(h, 0, 1.7, 0.27, 0.045, 0.05, 0.02, GOLD); },
  crown: h => { A.cyl(h, 0, 1.72, 0, 0.21, 0.1, GOLD, [0, 1, 0], { metalness: 0.5, roughness: 0.35 }); for (let i = 0; i < 6; i++) { const a = i * 1.047; A.cone(h, Math.cos(a) * 0.19, 1.76, Math.sin(a) * 0.19, 0.05, 0.13, GOLD, [0, 1, 0]); A.sph(h, Math.cos(a) * 0.2, 1.72, Math.sin(a) * 0.2, 0.025, 0.025, 0.025, i & 1 ? RED : 0x2f6fd6); } },
  party: h => { A.cone(h, 0.04, 1.68, 0, 0.14, 0.4, 0xf07ab0, [0.12, 1, 0]); A.sph(h, 0.09, 2.08, 0, 0.045, 0.045, 0.045, YELLOW); A.tor(h, 0.055, 1.8, 0, 0.1, YELLOW, [0.12, 1, 0], 1); },
  tophat: h => { A.cyl(h, 0, 1.69, 0, 0.34, 0.03, BLACK, [0, 1, 0]); A.cyl(h, 0, 1.88, 0, 0.22, 0.36, BLACK, [0, 1, 0]); A.cyl(h, 0, 1.74, 0, 0.225, 0.06, RED, [0, 1, 0]); },
  cowboy: h => { const c = 0x8a5a33; A.sph(h, 0, 1.67, 0, 0.44, 0.03, 0.4, c); A.sph(h, 0, 1.77, 0, 0.21, 0.16, 0.2, shade(c, 1.12)); A.tor(h, 0, 1.7, 0, 0.2, BLACK, [0, 1, 0], 1); },
  santahat: h => { A.tor(h, 0, 1.62, 0.01, 0.27, WHITE, [0, 1, 0], 2.2); A.cone(h, 0, 1.63, 0.01, 0.26, 0.42, RED, [0.35, 1, -0.1]); A.sph(h, 0.17, 2.0, -0.04, 0.07, 0.07, 0.07, WHITE); },
  headband: h => { A.tor(h, 0, 1.585, 0.02, 0.265, RED, [0, 1, 0], 1.4); A.box(h, 0.06, 1.5, -0.27, 0.05, 0.2, 0.015, RED).rotation.z = 0.25; A.box(h, -0.05, 1.49, -0.27, 0.05, 0.17, 0.015, RED).rotation.z = -0.3; },
  bandana: h => { A.dome(h, 0, 1.52, 0.01, 0.293, 0.21, 0.293, RED); A.sph(h, 0.18, 1.5, -0.24, 0.06, 0.06, 0.06, RED); A.cone(h, 0.2, 1.48, -0.26, 0.04, 0.16, RED, [0.5, -0.8, -0.6], 0.015); },
  horns: h => { for (const s of [-1, 1]) A.cone(h, s * 0.17, 1.64, 0.03, 0.055, 0.2, RED, [s * 0.6, 1, 0]); },
  halo: h => { A.tor(h, 0, 1.92, 0, 0.16, GOLD, [0, 1, 0], 1).material = mat(0xffe680, { emissive: 0x997a00, roughness: 0.3 }); },
  propeller: (h, S, rig) => {
    A.dome(h, 0, 1.56, 0.01, 0.27, 0.16, 0.27, 0x2f6fd6); A.dome(h, 0, 1.561, 0.01, 0.271, 0.161, 0.135, RED); A.cyl(h, 0, 1.76, 0.01, 0.012, 0.09, 0x555555, [0, 1, 0]);
    const p = A.box(h, 0, 1.81, 0.01, 0.4, 0.015, 0.06, YELLOW); rig.spin.push(p);
  },
  viking: h => { A.dome(h, 0, 1.53, 0.01, 0.3, 0.22, 0.3, 0x8d9099, { metalness: 0.5, roughness: 0.4 }); A.tor(h, 0, 1.54, 0.01, 0.29, 0x6b5330, [0, 1, 0], 1.5); for (const s of [-1, 1]) { A.cone(h, s * 0.27, 1.6, 0, 0.06, 0.16, CREAM, [s, 0.5, 0]); A.cone(h, s * 0.4, 1.66, 0, 0.045, 0.16, CREAM, [s * 0.3, 1, 0]); } },
  space: h => { A.sph(h, 0, 1.45, 0.03, 0.37, 0.37, 0.37, 0xcfe8ff, { transparent: true, opacity: 0.28, roughness: 0.1 }).castShadow = false; A.tor(h, 0, 1.19, 0.01, 0.29, 0xdcdfe6, [0, 1, 0], 1.8); },
  bucket: h => { put(h, geo().tcone, mat(0x9aa0aa, { metalness: 0.4, roughness: 0.45 }), 0, 1.68, 0.0, 0.3, 0.3, 0.3); A.tor(h, 0, 1.54, 0, 0.3, 0x7d838d, [0, 1, 0], 0.7); },
  cone: h => { A.box(h, 0, 1.655, 0, 0.48, 0.03, 0.48, ORANGE); A.cone(h, 0, 1.66, 0, 0.18, 0.5, ORANGE, [0, 1, 0]); A.cyl(h, 0, 1.82, 0, 0.125, 0.07, WHITE, [0, 1, 0]); },
  wig: h => { const cs = [RED, YELLOW, 0x44a94e, 0x2f6fd6, 0xf07ab0, ORANGE]; for (let i = 0; i < 9; i++) { const a = -2.6 + i * 0.65; A.sph(h, Math.cos(a) * 0.27, 1.56 + (i % 2) * 0.04, 0.0 + Math.sin(a) * 0.24 - 0.04, 0.13, 0.13, 0.13, cs[i % 6]); } A.sph(h, 0, 1.72, -0.03, 0.14, 0.11, 0.14, cs[1]); },
  ponytail: h => { const c = 0x8a5a33; A.dome(h, 0, 1.5, 0.01, 0.293, 0.225, 0.293, c); A.sph(h, 0, 1.6, -0.3, 0.07, 0.07, 0.07, c); A.sph(h, 0, 1.43, -0.38, 0.075, 0.2, 0.075, c).rotation.x = -0.35; },
  headphones: h => { const o = A.tor(h, 0, 1.47, 0, 0.3, BLACK, [0, 0, 1], 1.2); o.scale.z = 0.36; for (const s of [-1, 1]) { A.cyl(h, s * 0.29, 1.45, 0.01, 0.09, 0.07, 0x33333c, [1, 0, 0]); A.cyl(h, s * 0.33, 1.45, 0.01, 0.06, 0.02, RED, [1, 0, 0]); } }
};
const FACE_ADDON = {
  shades: h => { for (const s of [-1, 1]) A.sph(h, s * 0.09, 1.47, 0.285, 0.075, 0.055, 0.03, 0x15151a, { roughness: 0.2 }); A.box(h, 0, 1.485, 0.292, 0.06, 0.018, 0.02, 0x15151a); for (const s of [-1, 1]) A.box(h, s * 0.21, 1.48, 0.17, 0.015, 0.018, 0.24, 0x15151a); },
  glasses: h => { for (const s of [-1, 1]) A.tor(h, s * 0.09, 1.47, 0.3, 0.062, 0x222228, [0, 0, 1], 0.9); A.box(h, 0, 1.475, 0.3, 0.05, 0.012, 0.012, 0x222228); },
  patch: h => { A.sph(h, 0.088, 1.47, 0.287, 0.062, 0.062, 0.022, 0x15151a); const o = A.tor(h, 0, 1.5, 0.02, 0.29, 0x15151a, [0.25, 1, 0], 0.5); o.rotation.z += 0.0; },
  moustache: h => { for (const s of [-1, 1]) A.sph(h, s * 0.055, 1.365, 0.292, 0.07, 0.028, 0.03, 0x4a3020).rotation.z = -s * 0.25; },
  beard: (h, S, rig, look) => { const c = COSTUMES[look.k].id === 'santa' ? WHITE : 0x6b4a30; A.sph(h, 0, 1.3, 0.14, 0.22, 0.15, 0.17, c); A.sph(h, 0, 1.22, 0.2, 0.12, 0.1, 0.09, c); },
  angry: h => { for (const s of [-1, 1]) A.box(h, s * 0.09, 1.545, 0.285, 0.1, 0.026, 0.02, 0x2a1f1a).rotation.z = -s * 0.42; },
  nose: h => { A.sph(h, 0, 1.4, 0.31, 0.058, 0.058, 0.058, RED, { roughness: 0.3 }); },
  monocle: h => { A.tor(h, -0.088, 1.47, 0.3, 0.066, GOLD, [0, 0, 1], 0.8); A.cyl(h, -0.15, 1.36, 0.27, 0.004, 0.2, GOLD, [0.25, 1, 0.1]); }
};

// Dresses a rig: body texture + add-ons + eyes. Returns the material so the caller can dispose it.
const texCache = new Map();
export function lookTexture(look, hw) {
  const key = hw + ':' + look.c + ',' + look.k + ',' + look.kc + ',' + look.h + ',' + look.f;
  let t = texCache.get(key);
  if (!t) {
    t = new THREE.CanvasTexture(paintLook(look, hw)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    texCache.set(key, t);
    if (texCache.size > 80) { const k = texCache.keys().next().value; texCache.get(k).dispose(); texCache.delete(k); }
  }
  return t;
}
export function dress(rig, look) {
  rig.spin = [];
  const S = PAL[look.kc], B = PAL[look.c], H = rig.holders, head = H[BONE.HEAD];
  // eyes: the two white dots, plus crosses for when the lights go out
  rig.eyes = []; rig.xeyes = [];
  for (const s of [-1, 1]) {
    rig.eyes.push(A.sph(head, s * 0.088, 1.47, 0.281, 0.043, 0.053, 0.02, 0xffffff, { roughness: 0.4, emissive: 0x555555 }));
    for (const r of [0.78, -0.78]) { const b = A.box(head, s * 0.088, 1.47, 0.292, 0.11, 0.022, 0.015, 0xffffff); b.rotation.z = r; b.visible = false; rig.xeyes.push(b); }
  }
  rig.eyes.forEach(e => { e.castShadow = false; });
  const kid = COSTUMES[look.k].id, hid = HEADS[look.h].id, fid = FACES[look.f].id;
  if (ADDON[kid]) ADDON[kid](H, S, B, look.kc);
  if (HEAD_ADDON[hid]) HEAD_ADDON[hid](head, S, rig, look);
  if (FACE_ADDON[fid]) FACE_ADDON[fid](head, S, rig, look);
  rig.setKo = ko => { if (rig.ko === ko) return; rig.ko = ko; rig.eyes.forEach(e => { e.visible = !ko; }); rig.xeyes.forEach(e => { e.visible = ko; }); };
}
