/* ════════════════════════════════════════════════════════════════════════
   THE FLY — town/lib.js
   Shared foundation for the hand-authored town. Everything (buildings, props,
   characters, world, game) is built on this so the whole world reads as ONE
   art-directed place.

   GLOBALS: THREE (r128, classic build — NO ES modules, NO CapsuleGeometry).
   This file attaches a single global namespace:  window.FLY = { lib }
   Other modules attach FLY.buildings / FLY.props / FLY.characters / FLY.world /
   FLY.game.

   ── CONVENTIONS every factory MUST follow ──────────────────────────────────
   • A factory returns a THREE.Group (or Mesh) whose FOOTPRINT is centered at the
     origin in X and Z, sitting ON the ground at Y=0 (base at y=0, grows upward).
   • "Front" faces +Z. world.js rotates/positions the object into place.
   • Use FLY.lib materials & textures (do not invent new MeshStandardMaterials for
     common surfaces) so the palette stays unified. Custom accents are fine.
   • castShadow on anything chunky; receiveShadow on big flat things.
   • Units ≈ meters: floor ≈ 3, NPC ≈ 1.7 tall, car ≈ 4.3 long, lamp ≈ 5 tall.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
const T = THREE;
const TAU = Math.PI * 2;

/* ── math ── */
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp  = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
const dampT = (dt, rate) => 1 - Math.exp(-rate * dt);

/* ── seeded RNG (deterministic authoring) ── */
function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let _rng = mulberry32(1337);
const setSeed = s => { _rng = mulberry32(s); };
const rng = () => _rng();
const rand    = (a, b) => a + _rng() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick    = arr => arr[(_rng() * arr.length) | 0];
const chance  = p => _rng() < p;
const jitter  = a => (_rng() * 2 - 1) * a;
function shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (_rng() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }

/* ════════ CANVAS / TEXTURE ════════ */
function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function finishTex(c, opts = {}) {
  const t = new T.CanvasTexture(c);
  t.encoding = T.sRGBEncoding;
  t.anisotropy = opts.aniso || 4;
  if (opts.repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(opts.repeat[0], opts.repeat[1]); }
  return t;
}

// generic grain overlay
function grain(g, w, h, n, amax) {
  for (let i = 0; i < n; i++) { g.fillStyle = `rgba(0,0,0,${_rng() * amax})`; g.fillRect(_rng() * w, _rng() * h, 1, 1 + ((_rng() * 1.5) | 0)); }
}

const _texCache = new Map();
function cached(key, build) { if (_texCache.has(key)) return _texCache.get(key); const v = build(); _texCache.set(key, v); return v; }

/* — painted plaster (the main wall surface) — */
function plasterTex(hex) {
  return cached('plaster' + hex, () => {
    const w = 256, h = 256, c = cnv(w, h), g = c.getContext('2d');
    g.fillStyle = hex; g.fillRect(0, 0, w, h);
    // soft mottling
    for (let i = 0; i < 40; i++) {
      g.globalAlpha = rand(0.02, 0.06); g.fillStyle = chance(0.5) ? '#ffffff' : '#000000';
      const r = rand(10, 50); g.beginPath(); g.arc(rand(0, w), rand(0, h), r, 0, TAU); g.fill();
    }
    g.globalAlpha = 1; grain(g, w, h, 2600, 0.05);
    // a couple of weather streaks from the top
    for (let i = 0; i < 3; i++) { g.fillStyle = `rgba(0,0,0,${rand(0.03, 0.08)})`; const x = rand(0, w); g.fillRect(x, 0, rand(2, 6), rand(40, h)); }
    return finishTex(c, { repeat: [2, 3], aniso: 8 });
  });
}

/* — brick — */
function brickTex(hex, mortar = '#d8cdbb') {
  return cached('brick' + hex + mortar, () => {
    const w = 256, h = 256, c = cnv(w, h), g = c.getContext('2d');
    g.fillStyle = mortar; g.fillRect(0, 0, w, h);
    const bh = 18, bw = 56, gap = 4;
    for (let row = 0, y = 0; y < h; row++, y += bh + gap) {
      const off = (row % 2) ? (bw + gap) / 2 : 0;
      for (let x = -bw; x < w; x += bw + gap) {
        const shade = 1 + jitter(0.12);
        g.fillStyle = shadeHex(hex, shade);
        g.fillRect(x + off, y, bw, bh);
      }
    }
    grain(g, w, h, 1800, 0.05);
    return finishTex(c, { repeat: [3, 4], aniso: 8 });
  });
}

/* — wood planks — */
function woodTex(hex) {
  return cached('wood' + hex, () => {
    const w = 128, h = 128, c = cnv(w, h), g = c.getContext('2d');
    g.fillStyle = hex; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) { g.strokeStyle = `rgba(0,0,0,${rand(0.02, 0.08)})`; g.lineWidth = rand(0.5, 1.5); g.beginPath(); const y = rand(0, h); g.moveTo(0, y); g.bezierCurveTo(w / 3, y + jitter(3), 2 * w / 3, y + jitter(3), w, y + jitter(2)); g.stroke(); }
    return finishTex(c, { repeat: [1, 1], aniso: 4 });
  });
}

/* — striped awning fabric — */
function awningTex(a, b, stripes = 10) {
  return cached('awn' + a + b + stripes, () => {
    const w = 96, h = 32, c = cnv(w, h), g = c.getContext('2d');
    const sw = w / stripes;
    for (let i = 0; i < stripes; i++) { g.fillStyle = i % 2 ? a : b; g.fillRect(i * sw, 0, sw + 1, h); }
    g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(0, 0, w, h);
    return finishTex(c, { repeat: [3, 1] });
  });
}

/* — road / sidewalk / dirt — */
function roadTex() {
  return cached('road', () => {
    const w = 256, h = 256, c = cnv(w, h), g = c.getContext('2d');
    g.fillStyle = '#3a3e46'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 6000; i++) { const lite = chance(0.5); g.fillStyle = `rgba(${lite ? '255,255,255' : '0,0,0'},${_rng() * 0.07})`; g.fillRect(_rng() * w, _rng() * h, 1, 1); }
    // cracks
    for (let i = 0; i < 6; i++) { g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 1; g.beginPath(); let x = rand(0, w), y = rand(0, h); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += jitter(30); y += jitter(30); g.lineTo(x, y); } g.stroke(); }
    return finishTex(c, { repeat: [6, 14], aniso: 8 });
  });
}
function sidewalkTex() {
  return cached('sidewalk', () => {
    const w = 128, h = 128, c = cnv(w, h), g = c.getContext('2d');
    g.fillStyle = '#bcb4a4'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = 2;
    for (let x = 0; x <= w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y <= h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    grain(g, w, h, 800, 0.05);
    return finishTex(c, { repeat: [8, 4], aniso: 8 });
  });
}
function dirtTex() {
  return cached('dirt', () => {
    const w = 128, h = 128, c = cnv(w, h), g = c.getContext('2d');
    g.fillStyle = '#9aa183'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) { g.globalAlpha = rand(0.03, 0.08); g.fillStyle = chance(0.5) ? '#7c8466' : '#b4ba9c'; g.beginPath(); g.arc(rand(0, w), rand(0, h), rand(6, 20), 0, TAU); g.fill(); }
    g.globalAlpha = 1; grain(g, w, h, 1500, 0.05);
    return finishTex(c, { repeat: [24, 24], aniso: 4 });
  });
}

/* — text sign canvas — */
function signTex(name, bg, fg = '#fdf3df', font = 'bold 34px Georgia, serif') {
  const w = 320, h = 80, c = cnv(w, h), g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(0, 0, w, 9);
  g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(0, h - 9, w, 9);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = font;
  g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillText(name, w / 2 + 2, h / 2 + 2);
  g.fillStyle = fg; g.fillText(name, w / 2, h / 2);
  return finishTex(c, { aniso: 8 });
}

/* — neon sign (emissive) — returns {map} ready for emissiveMap usage — */
function neonTex(text, glow, txtCol = '#ffffff') {
  const w = 280, h = 64, c = cnv(w, h), g = c.getContext('2d');
  g.fillStyle = '#0a0a12'; g.fillRect(0, 0, w, h);
  g.shadowColor = glow; g.shadowBlur = 14; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = txtCol; g.font = 'bold 30px Arial, sans-serif';
  g.fillText(text, w / 2, h / 2); g.fillText(text, w / 2, h / 2);
  return finishTex(c, { aniso: 4 });
}

/* — poster — */
function posterTex(seed) {
  setSeed(seed * 9173 + 7);
  const w = 128, h = 192, c = cnv(w, h), g = c.getContext('2d');
  const palettes = [['#e8e0cc', '#3a3018', '#c04030'], ['#1a1a2a', '#e0c840', '#a0c0e0'], ['#e04040', '#ffffff', '#ffe040'], ['#234', '#9fe', '#fff']];
  const [bg, ink, accent] = pick(palettes);
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = accent; g.fillRect(8, 8, w - 16, 40);
  g.fillStyle = ink; g.font = 'bold 13px Georgia, serif'; g.textAlign = 'center';
  g.fillText(pick(['GRAN CONCIERTO', 'FIESTA MOTT', 'OPEN TODAY', 'MERCADO', 'CINE CLUB']), w / 2, 34);
  for (let i = 0; i < 5; i++) { g.fillStyle = chance(0.5) ? accent : ink; g.globalAlpha = rand(0.4, 0.9); g.fillRect(rand(12, w - 40), rand(60, h - 30), rand(20, 60), rand(8, 26)); }
  g.globalAlpha = 1;
  return finishTex(c);
}

function shadeHex(hex, mul) {
  const n = parseInt(hex.replace('#', ''), 16);
  let r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
  r = clamp(r * mul, 0, 255) | 0; gg = clamp(gg * mul, 0, 255) | 0; b = clamp(b * mul, 0, 255) | 0;
  return `rgb(${r},${gg},${b})`;
}

/* ════════ MATERIAL PALETTE + FACTORIES (cached) ════════ */
const PAL = {
  walls:  ['#d8a86a', '#c98a63', '#a9b48f', '#8fa8c0', '#d9bd80', '#c096a8', '#e0c389', '#9aae97', '#cf926f', '#86a0ad', '#dcc7a0', '#b5896f'],
  roofs:  ['#8a5d4e', '#5c6b78', '#7d6e86', '#b0844f', '#6f7d5e', '#9a5848'],
  trims:  ['#f7f2e6', '#eadfca', '#f1e6d0', '#e6dcc4'],
  signbg: ['#8b3528', '#2f5878', '#4a7a40', '#7a4828', '#5a2870', '#28404a', '#b03838', '#286848'],
  awning: [['#c44a44', '#f4ecd8'], ['#2f7060', '#f4ecd8'], ['#3a5d92', '#f4ecd8'], ['#c8893f', '#f6efdc'], ['#7a4f86', '#f4ecd8'], ['#b03860', '#f6efdc'], ['#347', '#f4ecd8']],
  carBody:['#cf4b46', '#3f72ae', '#2a8e68', '#e0c240', '#d8d0c4', '#40444e', '#c8783a', '#a8c8d8', '#e89060', '#6a4a8a', '#3a5a4a', '#b0b4bc'],
  cloth:  ['#d96f8a', '#4a8090', '#e0b840', '#7868b0', '#40a068', '#c84040', '#8090d0', '#d08840', '#6090a0', '#b04080', '#5080a0', '#e09050', '#30a868'],
  hair:   ['#2a1d14', '#4a3322', '#6b4a2c', '#1a1a1f', '#7a5a3a', '#3a2410', '#866', '#321'],
  skin:   ['#f0c090', '#e0b888', '#f4c8a0', '#c88060', '#d8a080', '#e8c090', '#caa07a', '#b78a64'],
  foliage:['#5a8c48', '#6ea058', '#5c9450', '#4a7c3c', '#79a85f', '#5e8a44'],
};

const _matCache = new Map();
function matKey(o) { return JSON.stringify(o); }
function std(opts) {
  const k = matKey(opts);
  if (_matCache.has(k)) return _matCache.get(k);
  const o = Object.assign({ roughness: 0.9, metalness: 0.0 }, opts);
  if (o.colorHex) { o.color = parseInt(o.colorHex.replace('#', '0x')); delete o.colorHex; }
  const m = new T.MeshStandardMaterial(o);
  _matCache.set(k, m); return m;
}

const MAT = {
  wall:     hex => std({ map: plasterTex(hex), roughness: 0.92 }),
  wallFlat: hex => std({ color: parseInt(hex.replace('#', '0x')), roughness: 0.92 }),
  brick:    hex => std({ map: brickTex(hex), roughness: 0.95 }),
  wood:     hex => std({ map: woodTex(hex), roughness: 0.85 }),
  trim:     hex => std({ color: parseInt((hex || pick(PAL.trims)).replace('#', '0x')), roughness: 0.82 }),
  glass:        std({ color: 0x18283a, roughness: 0.06, metalness: 0.92, envMapIntensity: 1.6 }),
  glassTint:    std({ color: 0x28503a, roughness: 0.08, metalness: 0.9, envMapIntensity: 1.3 }),
  glassLit:     std({ color: 0xffe8a0, emissive: 0xffd060, emissiveIntensity: 1.1, roughness: 0.25 }),
  glassFrame:   std({ color: 0x2a2926, roughness: 0.85 }),
  metalDark:    std({ color: 0x252830, roughness: 0.5, metalness: 0.7 }),
  metalLight:   std({ color: 0xb6bac2, roughness: 0.3, metalness: 0.7, envMapIntensity: 1.4 }),
  chrome:       std({ color: 0xc4c8d0, roughness: 0.16, metalness: 0.9, envMapIntensity: 2 }),
  rubber:       std({ color: 0x14151a, roughness: 0.92 }),
  fabric:   (a, b, n) => std({ map: awningTex(a, b, n || 10), roughness: 0.85, side: T.DoubleSide }),
  flat:     hex => std({ color: parseInt(hex.replace('#', '0x')), roughness: 0.85 }),
  emissive: (hex, i) => std({ color: parseInt(hex.replace('#', '0x')), emissive: parseInt(hex.replace('#', '0x')), emissiveIntensity: i == null ? 0.8 : i, roughness: 0.4 }),
};

/* ════════ GEOMETRY / MESH HELPERS ════════ */
const _boxCache = new Map();
function _place(m, opt) {
  if (opt.x != null || opt.y != null || opt.z != null) m.position.set(opt.x || 0, opt.y || 0, opt.z || 0);
}
function box(w, h, d, mat, opt = {}) {
  const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat); _place(m, opt);
  if (opt.cast !== false) m.castShadow = true;
  if (opt.receive) m.receiveShadow = true;
  return m;
}
function cyl(rt, rb, h, seg, mat, opt = {}) {
  const m = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg || 12), mat); _place(m, opt);
  if (opt.cast !== false) m.castShadow = true;
  return m;
}
function sphere(r, seg, mat, opt = {}) {
  const m = new T.Mesh(new T.SphereGeometry(r, seg || 12, (seg || 12) * 0.75 | 0), mat); _place(m, opt);
  if (opt.cast !== false) m.castShadow = true;
  return m;
}
// build an InstancedMesh from a list of THREE.Matrix4
function instanced(geo, mat, mats) {
  if (!mats.length) return null;
  const im = new T.InstancedMesh(geo, mat, mats.length);
  for (let i = 0; i < mats.length; i++) im.setMatrixAt(i, mats[i]);
  im.instanceMatrix.needsUpdate = true; im.castShadow = true; im.receiveShadow = true;
  return im;
}
// flat ground-decal quad (lies on XZ at y)
function decal(w, d, mat, y) { const m = new T.Mesh(new T.PlaneGeometry(w, d), mat); m.rotation.x = -Math.PI / 2; m.position.y = y == null ? 0.02 : y; m.receiveShadow = true; return m; }

const _v = new T.Vector3(), _qq = new T.Quaternion(), _ss = new T.Vector3();
function compose(x, y, z, rotY, sx, sy, sz) { _v.set(x, y, z); _qq.setFromAxisAngle(new T.Vector3(0, 1, 0), rotY || 0); _ss.set(sx, sy, sz == null ? 1 : sz); const m = new T.Matrix4(); m.compose(_v, _qq, _ss); return m; }

/* ════════ EXPORT ════════ */
window.FLY = window.FLY || {};
window.FLY.lib = {
  T, TAU,
  clamp, lerp, smooth, dampT,
  setSeed, rng, rand, randInt, pick, chance, jitter, shuffle,
  cnv, finishTex, grain, shadeHex,
  plasterTex, brickTex, woodTex, awningTex, roadTex, sidewalkTex, dirtTex, signTex, neonTex, posterTex,
  PAL, MAT, std,
  box, cyl, sphere, instanced, decal, compose,
};
})();
