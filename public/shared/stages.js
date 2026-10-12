// Stage definitions shared by the server (physics) and the client (rendering).
// Units: metres, Y up. The camera looks from +Z toward -Z, so "back" of a stage is -Z.
// Box: centre (x,z), TOP surface y, size w (x) × d (z), thickness h going downward.
const B = (x, z, y, w, d, h, o) => Object.assign({ x, z, y, w, d, h }, o || {});
const PI = Math.PI;

export const STAGES = [
  { // ------------------------------------------------------------------ ROOF
    id: 'roof', name: { ar: 'السطح', en: 'Roof' }, icon: '🏙️',
    sky: ['#f4bfd6', '#fdeaf1'], fog: ['#f5cfe0', 28, 170], killY: -9,
    solids: [
      // the roof slab is built around two skylight holes at x = ±4
      B(-6.6, 0, 0, 2.8, 11, 5, { m: 'roof' }), B(0, 0, 0, 5.6, 11, 5, { m: 'roof' }), B(6.6, 0, 0, 2.8, 11, 5, { m: 'roof' }),
      B(-4, -3.35, 0, 2.4, 4.3, 5, { m: 'roof' }), B(-4, 3.35, 0, 2.4, 4.3, 5, { m: 'roof' }),
      B(4, -3.35, 0, 2.4, 4.3, 5, { m: 'roof' }), B(4, 3.35, 0, 2.4, 4.3, 5, { m: 'roof' }),
      // parapet
      B(0, -5.25, 0.8, 16, 0.5, 0.8, { m: 'parapet', wall: 1 }), B(0, 5.25, 0.8, 16, 0.5, 0.8, { m: 'parapet', wall: 1 }),
      B(-7.75, 0, 0.8, 0.5, 10, 0.8, { m: 'parapet', wall: 1 }), B(7.75, 0, 0.8, 0.5, 10, 0.8, { m: 'parapet', wall: 1 }),
      // props
      B(0, -3.7, 1.15, 2.2, 1.4, 1.15, { m: 'ac' }),
      B(-6.2, -3.7, 2.3, 2.4, 2.4, 2.3, { m: 'hut' }),
      B(6.6, 3.4, 0.9, 1.1, 1.1, 0.9, { m: 'vent' })
    ],
    breakables: [
      { x: -4, z: 0, y: 0, w: 2.4, d: 2.4, h: 0.14, hp: 1.4, m: 'glass' },
      { x: 4, z: 0, y: 0, w: 2.4, d: 2.4, h: 0.14, hp: 1.4, m: 'glass' }
    ],
    kills: [
      { x0: -5.2, x1: -2.8, z0: -1.2, z1: 1.2, y0: -6, y1: -1.7, c: 'fall' },
      { x0: 2.8, x1: 5.2, z0: -1.2, z1: 1.2, y0: -6, y1: -1.7, c: 'fall' }
    ],
    spawns: [[-6.4, 1.5], [-1.5, -1.2], [1.5, -1.2], [6.4, 0], [-1.5, 3], [1.5, 3], [0, 1], [-6.4, 4]]
  },
  { // ------------------------------------------------------------------ RING
    id: 'ring', name: { ar: 'الحلبة', en: 'Ring' }, icon: '🥊',
    sky: ['#2a1f26', '#120d12'], fog: ['#1c141a', 22, 80], killY: -0.38, dark: 1,
    solids: [
      B(0, 0, 0, 9, 9, 1.2, { m: 'mat' }),
      B(0, -4.42, 1.3, 9, 0.14, 1.16, { m: 'rope', wall: 1, bounce: 0.85 }), B(0, 4.42, 1.3, 9, 0.14, 1.16, { m: 'rope', wall: 1, bounce: 0.85 }),
      B(-4.42, 0, 1.3, 0.14, 9, 1.16, { m: 'rope', wall: 1, bounce: 0.85 }), B(4.42, 0, 1.3, 0.14, 9, 1.16, { m: 'rope', wall: 1, bounce: 0.85 }),
      B(-4.42, -4.42, 1.5, 0.34, 0.34, 1.5, { m: 'post' }), B(4.42, -4.42, 1.5, 0.34, 0.34, 1.5, { m: 'post' }),
      B(-4.42, 4.42, 1.5, 0.34, 0.34, 1.5, { m: 'post' }), B(4.42, 4.42, 1.5, 0.34, 0.34, 1.5, { m: 'post' })
    ],
    spawns: [[-3, -3], [3, 3], [3, -3], [-3, 3], [0, -3], [0, 3], [-3, 0], [3, 0]]
  },
  { // ------------------------------------------------------------------ SUBWAY
    // an island platform between two tracks: get knocked off and the next train will find you
    id: 'subway', name: { ar: 'المترو', en: 'Subway' }, icon: '🚇',
    sky: ['#3a4048', '#22262c'], fog: ['#2c3138', 24, 90], killY: -6, dark: 1,
    avoid: [{ x0: -40, x1: 40, z0: -9, z1: -2.2 }, { x0: -40, x1: 40, z0: 2.2, z1: 9 }],
    solids: [
      B(0, 0, 0, 22, 4.4, 1.3, { m: 'tile' }),
      B(0, 0, -1.3, 60, 11.6, 1, { m: 'track' }),
      B(0, -6.1, 4.6, 26, 0.6, 6.9, { m: 'tilewall', wall: 1 }),
      B(0, 6.0, -0.5, 26, 0.4, 0.8, { m: 'tile', wall: 1 }),
      B(0, 6.25, 6, 26, 0.3, 7.3, { invisible: 1, nograb: 1 }),
      B(-13.3, 0, 6, 0.6, 12, 7.3, { invisible: 1, nograb: 1 }), B(13.3, 0, 6, 0.6, 12, 7.3, { invisible: 1, nograb: 1 }),
      B(-5.5, 0, 3.0, 0.7, 0.7, 3.0, { m: 'pillar' }), B(5.5, 0, 3.0, 0.7, 0.7, 3.0, { m: 'pillar' })
    ],
    movers: [
      { model: 'train', kill: 'train', w: 22, d: 2.5, h: 3.3, path: { type: 'linear', from: [-70, 2.0, -3.95], vel: [26, 0, 0], period: 6.5, phase: 0 } },
      { model: 'train', kill: 'train', w: 22, d: 2.5, h: 3.3, path: { type: 'linear', from: [70, 2.0, 3.95], vel: [-26, 0, 0], period: 6.5, phase: 3.25 } }
    ],
    spawns: [[-9, 0], [-6.5, 0.8], [-3, -0.8], [-1, 0.8], [1, -0.8], [3, 0.8], [6.5, -0.8], [9, 0]]
  },
  { // ------------------------------------------------------------------ GRIND
    id: 'grind', name: { ar: 'المطحنة', en: 'Grind' }, icon: '🥩',
    sky: ['#6e625b', '#3b322d'], fog: ['#4a403a', 22, 90], killY: -7, dark: 1,
    solids: [
      B(0, -3, 0, 14, 3, 1.4, { m: 'belt', conv: [-1.4, 0] }), B(0, 0, 0, 14, 3, 1.4, { m: 'grate' }), B(0, 3, 0, 14, 3, 1.4, { m: 'belt', conv: [1.4, 0] }),
      B(0, -4.8, 5.4, 22, 0.6, 7, { m: 'factorywall', wall: 1 }),
      B(0, 4.65, 0.45, 14, 0.3, 0.45, { m: 'curb', wall: 1 }),
      B(-10.6, 0, 1.4, 1.2, 9, 3, { m: 'steel', wall: 1 }), B(10.6, 0, 1.4, 1.2, 9, 3, { m: 'steel', wall: 1 })
    ],
    kills: [
      { x0: -10, x1: -7, z0: -4.5, z1: 4.5, y0: -4, y1: -0.3, c: 'grind' },
      { x0: 7, x1: 10, z0: -4.5, z1: 4.5, y0: -4, y1: -0.3, c: 'grind' }
    ],
    bumpers: [
      { pivot: [-2.6, 6.6, 0], len: 5.2, r: 0.72, amp: 0.85, period: 4.4, phase: 0, axis: 'z', model: 'beef' },
      { pivot: [2.6, 6.6, 0], len: 5.2, r: 0.72, amp: 0.85, period: 4.4, phase: PI, axis: 'z', model: 'beef' }
    ],
    spawns: [[-5, 0], [5, 0], [-5, -3], [5, 3], [0, -3], [0, 3], [-5, 3], [5, -3]]
  },
  { // ------------------------------------------------------------------ INCINERATOR
    id: 'incinerator', name: { ar: 'المحرقة', en: 'Incinerator' }, icon: '🔥',
    sky: ['#f0a04c', '#b84a1c'], fog: ['#d8702c', 20, 90], killY: -7, convRamp: 1,
    solids: [
      B(0.2, 0, 0, 16.4, 4.4, 1.2, { m: 'belt', conv: [-2.2, 0] }),
      B(0.2, -3.1, 0.5, 16.4, 1.8, 1.7, { m: 'catwalk' }), B(0.2, 3.1, 0.5, 16.4, 1.8, 1.7, { m: 'catwalk' }),
      B(9, 0, 4.2, 1.2, 8, 5.4, { m: 'steel', wall: 1 }),
      B(-9.4, -3.1, 4.2, 2.8, 1.8, 3.7, { m: 'furnace', wall: 1 }), B(-9.4, 3.1, 4.2, 2.8, 1.8, 3.7, { m: 'furnace', wall: 1 }),
      B(-9.4, 0, 6.4, 2.8, 4.4, 2.6, { m: 'furnace', wall: 1 }),
      B(0, -4.3, 5.4, 22, 0.6, 6.6, { m: 'factorywall', wall: 1 })
    ],
    kills: [{ x0: -13, x1: -8.1, z0: -2.3, z1: 2.3, y0: -4, y1: 3.9, c: 'fire' }],
    spawns: [[-2, -3.1], [2, -3.1], [6, -3.1], [-2, 3.1], [2, 3.1], [6, 3.1], [4, 0], [7, 0]]
  },
  { // ------------------------------------------------------------------ TRUCKS
    id: 'trucks', name: { ar: 'الشاحنات', en: 'Trucks' }, icon: '🚚',
    sky: ['#bcdcf2', '#f6ead8'], fog: ['#e9dfd0', 30, 170], killY: -2.3,
    solids: [],
    movers: [
      { model: 'truck', tint: '#c8433a', w: 11, d: 2.8, h: 3, path: { type: 'ping', a: [-1.6, 0, -1.8], b: [1.6, 0, -1.8], period: 13, phase: 0 } },
      { model: 'cab', tint: '#c8433a', w: 2.3, d: 2.6, h: 2.4, path: { type: 'ping', a: [-8.4, -0.6, -1.8], b: [-5.2, -0.6, -1.8], period: 13, phase: 0 } },
      { model: 'truck', tint: '#3b78c2', w: 11, d: 2.8, h: 3, path: { type: 'ping', a: [1.9, 0, 1.8], b: [-1.9, 0, 1.8], period: 17, phase: 1 } },
      { model: 'cab', tint: '#3b78c2', w: 2.3, d: 2.6, h: 2.4, path: { type: 'ping', a: [-4.9, -0.6, 1.8], b: [-8.7, -0.6, 1.8], period: 17, phase: 1 } },
      { model: 'sign', knock: 35, w: 0.5, d: 3.2, h: 1.75, path: { type: 'linear', from: [-64, 2.65, -1.8], vel: [17, 0, 0], period: 11, phase: 0 } },
      { model: 'sign', knock: 35, w: 0.5, d: 3.2, h: 1.75, path: { type: 'linear', from: [-64, 2.65, 1.8], vel: [17, 0, 0], period: 11, phase: 5.5 } }
    ],
    spawns: [[-3, -1.8], [0, -1.8], [3, -1.8], [-3, 1.8], [0, 1.8], [3, 1.8], [-1.5, -1.8], [1.5, 1.8]]
  },
  { // ------------------------------------------------------------------ BLIMP
    id: 'blimp', name: { ar: 'المنطاد', en: 'Blimp' }, icon: '🎈',
    sky: ['#7fc3f7', '#e9f6ff'], fog: ['#d4ebfb', 40, 220], killY: -9,
    solids: [
      B(8.2, 0, 0.9, 3.2, 0.4, 2.4, { m: 'fin', wall: 1 }),
      B(-1.5, 0, 0.42, 1.4, 1.4, 0.7, { m: 'hatch' })
    ],
    ellipsoids: [{ x: 0, y: -4.0, z: 0, rx: 11, ry: 4.0, rz: 6.2, m: 'envelope', fric: 0.5 }],
    winds: [
      { x0: -13, x1: 13, z0: -9, z1: 9, y0: -4, y1: 9, acc: [0, 0, 6], period: 9, duty: 0.25, phase: 0.1 },
      { x0: -13, x1: 13, z0: -9, z1: 9, y0: -4, y1: 9, acc: [0, 0, -6], period: 9, duty: 0.25, phase: 0.6 }
    ],
    spawns: [[-5, 0], [-3, 1], [-3, -1], [0.5, 0.8], [0.5, -0.8], [3, 1], [3, -1], [5, 0]]
  },
  { // ------------------------------------------------------------------ GIRDERS
    id: 'girders', name: { ar: 'العوارض', en: 'Girders' }, icon: '🏗️',
    sky: ['#f4bfd6', '#fdeaf1'], fog: ['#f5cfe0', 28, 170], killY: -10,
    solids: [
      B(0, -3.2, 0, 15, 0.95, 0.7, { m: 'girder' }), B(0, 0, 0, 15, 0.95, 0.7, { m: 'girder' }), B(0, 3.2, 0, 15, 0.95, 0.7, { m: 'girder' }),
      B(-6, 0, 0, 0.95, 7.35, 0.7, { m: 'girder' }), B(0, 0, 0, 0.95, 7.35, 0.7, { m: 'girder' }), B(6, 0, 0, 0.95, 7.35, 0.7, { m: 'girder' }),
      B(-3, -1.6, 0.1, 5.2, 2.4, 0.12, { m: 'plank' }),
      B(-6, -3.2, 2.6, 0.95, 0.95, 2.6, { m: 'girder' }), B(6, -3.2, 2.6, 0.95, 0.95, 2.6, { m: 'girder' })
    ],
    breakables: [{ x: 3, z: 1.6, y: 0.1, w: 5.2, d: 2.4, h: 0.12, hp: 4, m: 'plank' }],
    bumpers: [{ shape: 'capsule', half: 0.7, pivot: [0, 9.2, 3.2], len: 8.0, r: 0.3, amp: 0.7, period: 5.6, phase: Math.PI / 2, axis: 'x', model: 'ibeam' }],
    spawns: [[-6, -3.2], [6, -3.2], [0, -3.2], [-6, 0], [6, 0], [0, 0], [-3, -1.6], [3, 1.2]]
  },
  { // ------------------------------------------------------------------ CONTAINERS
    id: 'containers', name: { ar: 'الحاويات', en: 'Containers' }, icon: '📦',
    sky: ['#9fd0ee', '#f3e6d3'], fog: ['#dfe6e4', 30, 170], killY: -5.2,
    solids: [
      B(-3.9, -1.35, 0, 6.1, 2.6, 2.6, { m: 'cont', tint: '#c8433a' }), B(-3.9, 1.35, 0, 6.1, 2.6, 2.6, { m: 'cont', tint: '#3b78c2' }),
      B(3.9, -1.35, 0, 6.1, 2.6, 2.6, { m: 'cont', tint: '#3f9a58' }), B(3.9, 1.35, 0, 6.1, 2.6, 2.6, { m: 'cont', tint: '#e0a63a' }),
      B(-4.6, -1.35, 2.6, 4.7, 2.6, 2.6, { m: 'cont', tint: '#d9772f' }),
      B(5.3, -1.35, 2.6, 3.3, 2.6, 2.6, { m: 'cont', tint: '#2f9c9c' })
    ],
    movers: [{ model: 'container', tint: '#8b5fc7', w: 1.56, d: 2.6, h: 2.6, path: { type: 'ping', a: [0, 0, -2.6], b: [0, 0, 2.6], period: 11, phase: 0 } }],
    spawns: [[-6, 1.35], [-3, 1.35], [3, 1.35], [6, 1.35], [2.5, -1.35], [-4.6, -1.35], [-1.6, -1.35], [5.3, -1.35]]
  },
  { // ------------------------------------------------------------------ ELEVATORS
    id: 'elevators', name: { ar: 'المصاعد', en: 'Elevators' }, icon: '🛗',
    sky: ['#7b8597', '#474e5c'], fog: ['#5a6272', 24, 110], killY: -12, dark: 1,
    solids: [
      B(-6.3, 0, 0, 3, 5, 16, { m: 'concrete' }), B(6.3, 0, 0, 3, 5, 16, { m: 'concrete' }),
      B(0, -2.9, 8, 15.6, 0.6, 24, { m: 'shaftwall', wall: 1 })
    ],
    movers: [
      { model: 'elevator', w: 4.1, d: 4.6, h: 3, path: { type: 'ping', a: [-2.35, -2.6, 0], b: [-2.35, 2.6, 0], period: 11, phase: 0 } },
      { model: 'elevator', w: 4.1, d: 4.6, h: 3, path: { type: 'ping', a: [2.35, 2.6, 0], b: [2.35, -2.6, 0], period: 11, phase: 0 } }
    ],
    spawns: [[-6.3, -1], [-6.3, 1], [6.3, -1], [6.3, 1], [-6.6, 0], [6.6, 0], [-5.6, 1.6], [5.6, -1.6]]
  }
];

export function stageById(id) { return STAGES.find(s => s.id === id) || STAGES[0]; }

// Everything that moves in a stage is a pure function of the stage time, so server and client agree.
export function dynState(stage, t) {
  const movers = (stage.movers || []).map(m => {
    const p = m.path;
    if (p.type === 'ping') {
      const w = 2 * PI / p.period, ph = w * t + (p.phase || 0), s = 0.5 - 0.5 * Math.cos(ph), ds = 0.5 * w * Math.sin(ph);
      return {
        x: p.a[0] + (p.b[0] - p.a[0]) * s, y: p.a[1] + (p.b[1] - p.a[1]) * s, z: p.a[2] + (p.b[2] - p.a[2]) * s,
        vx: (p.b[0] - p.a[0]) * ds, vy: (p.b[1] - p.a[1]) * ds, vz: (p.b[2] - p.a[2]) * ds, tau: 0
      };
    }
    const tau = (((t + (p.phase || 0)) % p.period) + p.period) % p.period;
    return { x: p.from[0] + p.vel[0] * tau, y: p.from[1] + p.vel[1] * tau, z: p.from[2] + p.vel[2] * tau, vx: p.vel[0], vy: p.vel[1], vz: p.vel[2], tau };
  });
  const bumpers = (stage.bumpers || []).map(b => {
    const w = 2 * PI / b.period, a = b.amp * Math.sin(w * t + (b.phase || 0)), da = b.amp * w * Math.cos(w * t + (b.phase || 0));
    const sx = Math.sin(a) * b.len, cy = Math.cos(a) * b.len, vs = Math.cos(a) * b.len * da, vy = Math.sin(a) * b.len * da;
    return b.axis === 'x'
      ? { x: b.pivot[0] + sx, y: b.pivot[1] - cy, z: b.pivot[2], vx: vs, vy, vz: 0, ang: a }
      : { x: b.pivot[0], y: b.pivot[1] - cy, z: b.pivot[2] + sx, vx: 0, vy, vz: vs, ang: a };
  });
  const winds = (stage.winds || []).map(w => (((t / w.period + (w.phase || 0)) % 1) + 1) % 1 < w.duty);
  const conv = stage.convRamp ? Math.min(2, 1 + t / 45) : 1;
  return { movers, bumpers, winds, conv };
}
