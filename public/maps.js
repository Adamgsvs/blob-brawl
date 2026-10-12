// Shared by server (physics) and client (rendering). 3D, meters, Y is up.
// Box: center (x,z), TOP surface y, size w (x) d (z) h (thickness, goes downward).
// `wall:1` = something you can climb/knock people over (ignored by bots when looking for floor).
(function (root) {
  'use strict';
  const B = (x, z, y, w, d, h, o) => Object.assign({ x, z, y, w, d, h: h || 2 }, o || {});

  const maps = [
    { // iconic rooftop with a parapet, satellite dish, neon sign and a pink skyline
      id: 'rooftop', ar: 'السطح', en: 'Rooftop', emoji: '🏙️', sky: ['#ffd6e8', '#fbe3ef'], fog: '#f3c4dc', under: 'void', killY: -16,
      solids: [
        B(0, 0, 0, 20, 14, 4, { style: 'roof' }),
        B(0, -6.5, 1.25, 21, 1, 1.25, { wall: 1, style: 'parapet' }), B(0, 6.5, 1.25, 21, 1, 1.25, { wall: 1, style: 'parapet' }),
        B(-10, 0, 1.25, 1, 14, 1.25, { wall: 1, style: 'parapet' }), B(10, 0, 1.25, 1, 14, 1.25, { wall: 1, style: 'parapet' }),
        B(4.5, -2.5, 1.7, 3.2, 2.4, 1.7, { style: 'ac' }), B(-5.5, 2.5, 1.2, 2.4, 2.4, 1.2, { style: 'vent' })
      ],
      spawns: [[-7, -4], [-1, -4], [7, -4], [-7, 4.5], [0, 4], [7, 4.5], [-3, 0], [2, 1]]
    },
    { // boxing ring: ropes are low walls, fall out = out
      id: 'ring', ar: 'حلبة الملاكمة', en: 'Boxing Ring', emoji: '🥊', sky: ['#3b2a2a', '#17101a'], fog: '#2a1c24', under: 'void', killY: -3.2,
      solids: [
        B(0, 0, 0, 15, 15, 1.4, { style: 'mat' }),
        B(0, -7.4, 1.75, 15, .3, 1.15, { wall: 1, style: 'rope' }), B(0, 7.4, 1.75, 15, .3, 1.15, { wall: 1, style: 'rope' }),
        B(-7.4, 0, 1.75, .3, 15, 1.15, { wall: 1, style: 'rope' }), B(7.4, 0, 1.75, .3, 15, 1.15, { wall: 1, style: 'rope' })
      ],
      spawns: [[-5, -5], [5, -5], [-5, 5], [5, 5], [0, -5], [0, 5], [-5, 0], [5, 0]]
    },
    { // unfinished skyscraper: slabs, steel beam bridge, clay pots and a wrecking ball
      id: 'construction', ar: 'موقع البناء', en: 'Construction Site', emoji: '🏗️', sky: ['#ffd6e8', '#fbe3ef'], fog: '#f3c4dc', under: 'void', killY: -16,
      solids: [
        B(0, 0, 0, 20, 13, .9, { style: 'concrete' }),
        B(-5.5, -1.5, 3.6, 9, 8, .8, { style: 'concrete' }),
        B(6.5, 0, 1.8, 8, .9, .5, { style: 'steel' }),
        B(7.5, 4.2, 2.2, 1.5, 1.5, 2.2, { style: 'pot' }), B(7.5, 4.2, 4.2, 1.2, 1.2, 2, { style: 'pot' }),
        B(-3, 4, .55, 3.4, 2.2, .55, { style: 'wood' }), B(2, -4.5, .6, 2.4, 2.4, .6, { crate: 1 })
      ],
      balls: [{ px: 2, py: 14, pz: 1, len: 11, r: 1.2, amp: 0.95, period: 3.8, phase: 0 }],
      spawns: [[-6, -3], [-3, 0], [8, -3], [4, 4], [-8, 4.5], [0, -1], [3, -4], [9, 1]]
    },
    { // furnace: catwalks over fire
      id: 'furnace', ar: 'الفرن', en: 'The Furnace', emoji: '🔥', sky: ['#ffb066', '#c4421a'], fog: '#e0662a', under: 'lava', killY: -12,
      solids: [B(-11, 0, 0, 8, 11, 1.2, { style: 'metal' }), B(11, 0, 0, 8, 11, 1.2, { style: 'metal' }), B(0, -7, 4, 6, 3, .6, { style: 'metal' })],
      movers: [{ w: 5, d: 5, h: 0.8, ax: -4.5, ay: 0, az: 0, bx: 4.5, by: 0, bz: 0, period: 6, phase: 0 }, { w: 4, d: 4, h: 0.8, ax: 0, ay: 2.2, az: -4, bx: 0, by: 2.2, bz: 5, period: 8, phase: 1 }],
      hazards: [{ x: 0, z: 0, y: -2, w: 200, d: 200, h: 8, kind: 'lava' }],
      spawns: [[-12, -3], [-12, 3], [-9, -3], [-9, 3], [12, -3], [12, 3], [9, -3], [9, 3]]
    },
    { // factory conveyors
      id: 'conveyor', ar: 'المصنع', en: 'Factory', emoji: '🏭', sky: ['#7b8196', '#3a3e55'], fog: '#4b5068', under: 'lava', killY: -14,
      solids: [B(-7.5, 0, 0, 15, 11, 1.6, { type: 'conv', dir: -1, speed: 3.2 }), B(0, 0, 0, 2, 11, 1.6, { style: 'metal' }), B(7.5, 0, 0, 15, 11, 1.6, { type: 'conv', dir: 1, speed: 3.2 }), B(0, 0, 4.2, 7, 5, 0.6, { style: 'metal' })],
      hazards: [{ x: 0, z: 0, y: -3, w: 200, d: 200, h: 8, kind: 'lava' }],
      spawns: [[-10, -3], [-6, 3], [-3, -4], [3, -4], [6, 3], [10, -3], [-12, 3], [12, 3]]
    },
    { // slippery ice rink
      id: 'ice', ar: 'حلبة الجليد', en: 'Ice Rink', emoji: '🧊', sky: ['#d6f3ff', '#8fcfff'], fog: '#bfe6ff', under: 'water', killY: -14,
      solids: [B(0, 0, 0, 26, 20, 1.6, { type: 'ice' }), B(0, 0, 1.6, 2.2, 2.2, 1.6, { type: 'ice', crate: 1 })],
      spawns: [[-10, -7], [-5, -8], [5, -8], [10, -7], [-10, 7], [-5, 8], [5, 8], [10, 7]]
    },
    { // trampolines
      id: 'trampoline', ar: 'ملعب النط', en: 'Bounce Park', emoji: '🤸', sky: ['#ffc2ee', '#a98bff'], fog: '#d9a8ff', under: 'void', killY: -16,
      solids: [B(-9, 0, 0, 9, 16, 1.6, { type: 'bounce' }), B(9, 0, 0, 9, 16, 1.6, { type: 'bounce' }), B(0, 0, 1.2, 9, 12, 2.4), B(0, 0, 6.5, 6, 5, 0.6)],
      spawns: [[-9, -5], [-9, 5], [9, -5], [9, 5], [-3, 4], [3, 4], [-3, -4], [3, -4]]
    },
    { // windmill with a sweeping bar
      id: 'windmill', ar: 'الطاحونة', en: 'Windmill', emoji: '🌀', sky: ['#bfe9ff', '#e8f6c8'], fog: '#d4efc0', under: 'void', killY: -14,
      solids: [B(0, 0, 0, 20, 20, 2.2)],
      bars: [{ cx: 0, cy: 0.9, cz: 0, len: 7.5, r: 0.38, omega: 1.5, phase: 0 }],
      spawns: [[-8, -8], [8, -8], [-8, 8], [8, 8], [0, -8], [0, 8], [-8, 0], [8, 0]]
    },
    { // subway platform: a train sweeps across the tracks
      id: 'subway', ar: 'المترو', en: 'Subway', emoji: '🚇', sky: ['#9ab8cc', '#d6e4ea'], fog: '#bccfd8', under: 'void', killY: -14,
      solids: [B(0, -5.5, 0, 28, 6, 1.4, { style: 'tile' }), B(0, 5.5, 0, 28, 6, 1.4, { style: 'tile' }), B(0, 0, -2.2, 28, 5, .8, { style: 'track' })],
      movers: [{ kind: 'train', kill: 1, w: 12, d: 4.2, h: 3.8, ax: -34, ay: 1.6, az: 0, bx: 34, by: 1.6, bz: 0, period: 11, phase: 0 }],
      spawns: [[-9, -5.5], [-3, -6], [4, -5], [10, -6], [-9, 5.5], [-2, 6], [5, 5], [11, 5.5]]
    },
    { // meat-grinder style factory: crushing presses
      id: 'grind', ar: 'المطحنة', en: 'The Grinder', emoji: '⚙️', sky: ['#8a7e74', '#4e453e'], fog: '#5f564f', under: 'void', killY: -14,
      solids: [B(0, -5, 0, 26, 4, 1.6, { type: 'conv', dir: 1, speed: 2.6 }), B(0, 0, 0, 26, 6, 1.6, { style: 'metal' }), B(0, 5, 0, 26, 4, 1.6, { type: 'conv', dir: -1, speed: 2.6 })],
      movers: [{ kind: 'press', kill: 1, w: 4.6, d: 5.6, h: 1.6, ax: -5.5, ay: 8, az: 0, bx: -5.5, by: 1.5, bz: 0, period: 4.4, phase: 0 }, { kind: 'press', kill: 1, w: 4.6, d: 5.6, h: 1.6, ax: 5.5, ay: 8, az: 0, bx: 5.5, by: 1.5, bz: 0, period: 4.4, phase: Math.PI }],
      spawns: [[-11, 0], [11, 0], [-11, -5], [11, 5], [0, -1.5], [0, 1.5], [-11, 5], [11, -5]]
    },
    { // the truck container: long and narrow, with a lower container to land on
      id: 'container', ar: 'الشاحنة', en: 'Truck Container', emoji: '🚚', sky: ['#cfe7ff', '#fbe9d0'], fog: '#e6dccb', under: 'void', killY: -14,
      solids: [B(0, 0, 0, 28, 5.6, 2.6, { style: 'container' }), B(0, 0, 1.2, 1.6, 1.6, 1.2, { style: 'barrel' }), B(10, 7.5, -2.4, 12, 5.4, 2.6, { style: 'container2' }), B(-9, -2, 1.1, 2, 1.8, 1.1, { crate: 1 })],
      spawns: [[-12, 0], [-8, 1.8], [-4, -1.8], [4, 1.8], [8, -1.8], [12, 0], [0, 2], [0, -2]]
    },
    { // airship deck with gusts of wind
      id: 'blimp', ar: 'المنطاد', en: 'Blimp', emoji: '🎈', sky: ['#8ccaff', '#eaf6ff'], fog: '#d4ecff', under: 'void', killY: -16,
      solids: [B(0, 0, 0, 24, 10, 1.4, { style: 'deck' }), B(0, -4.8, .9, 24, .4, .9, { wall: 1, style: 'rail' }), B(0, 4.8, .9, 24, .4, .9, { wall: 1, style: 'rail' }), B(0, 0, 1.3, 2, 2, 1.3, { crate: 1 })],
      wind: [{ x: 0, z: 0, w: 26, d: 10, y0: -3, y1: 7, ax: 9, az: 0, period: 7, duty: .3, phase: 0 }, { x: 0, z: 0, w: 26, d: 10, y0: -3, y1: 7, ax: -9, az: 0, period: 7, duty: .3, phase: .5 }],
      spawns: [[-9, -2.5], [-9, 2.5], [-4, 0], [4, 0], [9, -2.5], [9, 2.5], [0, -3], [0, 3]]
    }
  ];

  function byId(id) { return maps.find(m => m.id === id) || maps[0]; }

  function dyn(map, t) {
    const movers = (map.movers || []).map(m => {
      const s = 0.5 - 0.5 * Math.cos(2 * Math.PI * t / m.period + (m.phase || 0));
      return { x: m.ax + (m.bx - m.ax) * s, y: m.ay + (m.by - m.ay) * s, z: m.az + (m.bz - m.az) * s, w: m.w, d: m.d, h: m.h, kill: !!m.kill, kind: m.kind || '' };
    });
    const balls = (map.balls || []).map(b => {
      const w = 2 * Math.PI / b.period, a = b.amp * Math.sin(w * t + (b.phase || 0)), da = b.amp * w * Math.cos(w * t + (b.phase || 0));
      return { x: b.px + Math.sin(a) * b.len, y: b.py - Math.cos(a) * b.len, z: b.pz, r: b.r, px: b.px, py: b.py, pz: b.pz, vx: Math.cos(a) * b.len * da, vy: Math.sin(a) * b.len * da, vz: 0 };
    });
    const bars = (map.bars || []).map(b => ({ cx: b.cx, cy: b.cy, cz: b.cz, len: b.len, r: b.r, ang: (b.phase || 0) + b.omega * t, om: b.omega }));
    const wind = (map.wind || []).map(w => ({ x: w.x, z: w.z, w: w.w, d: w.d, y0: w.y0, y1: w.y1, ax: w.ax, az: w.az, on: ((t / w.period + (w.phase || 0)) % 1) < w.duty }));
    return { movers, balls, bars, wind };
  }

  const api = { list: maps, byId, dyn };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Maps = api;
})(typeof window !== 'undefined' ? window : this);
