/* ════════════════════════════════════════════════════════════════════════
   THE FLY — town/buildings.js   (BASELINE — agents enrich this)
   Contract: FLY.buildings.make(spec) -> THREE.Group
     • footprint centered at origin (x,z), base at y=0, FRONT FACES +Z.
     • self-contained (own windows via InstancedMesh children, own rooftop).
   spec: { w, d, floors, archetype, wall, trim, accent, name, signColor,
           awning:[a,b]|null, extras:[...], seed }
   Also: FLY.buildings.ARCHETYPES, FLY.buildings.heightOf(spec)
   ════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
const L = FLY.lib, T = L.T, TAU = L.TAU;
const FLOOR_H = 3.0, GROUND_H = 2.4;
const ARCHETYPES = ['shop', 'apartment', 'cafe', 'civic', 'townhouse', 'corner'];
const heightOf = spec => GROUND_H + (spec.floors || 3) * FLOOR_H;

// collect window instance matrices (local space; instanced meshes are children → move with group)
function windowsFor(g, w, h, floors, frontZ) {
  const dark = [], lit = [], frame = [];
  const cols = Math.max(2, Math.floor(w / 2.4));
  const gap = w / cols;
  for (let f = 0; f < floors; f++) {
    const wy = GROUND_H + 0.4 + f * FLOOR_H;
    if (wy + 0.7 > h - 0.5) break;
    for (let ci = 0; ci < cols; ci++) {
      const wx = -w / 2 + gap * (ci + 0.5);
      (L.chance(0.26) ? lit : dark).push(L.compose(wx, wy, frontZ + 0.06, 0, 0.92, 1.2, 1));
      frame.push(L.compose(wx, wy, frontZ + 0.04, 0, 1.16, 1.46, 1));
    }
  }
  const wg = new T.PlaneGeometry(1, 1);
  const fm = L.instanced(wg, L.MAT.glassFrame, frame); if (fm) g.add(fm);
  const dm = L.instanced(wg, L.MAT.glass, dark); if (dm) g.add(dm);
  const lm = L.instanced(wg, L.MAT.glassLit, lit); if (lm) g.add(lm);
}

function rooftop(g, w, d, topY, wallMat) {
  const pp = L.box(w + 0.16, 0.5, d + 0.16, wallMat, { y: topY + 0.25 }); g.add(pp);
  const rf = L.box(w - 0.3, 0.08, d - 0.3, L.MAT.flat('#48443e'), { y: topY + 0.04, cast: false }); g.add(rf);
  if (L.chance(0.65)) {
    const r = L.rand(0.55, 0.75), hh = L.rand(1.0, 1.6);
    const tx = L.jitter(w / 4), tz = L.jitter(d / 4);
    g.add(L.cyl(r, r, hh, 10, L.MAT.wood('#8a6e50'), { x: tx, y: topY + hh / 2 + 0.04, z: tz }));
    g.add(L.box(r * 1.5, 0.6, r * 1.5, L.MAT.metalDark, { x: tx, y: topY + 0.3, z: tz }));
  }
  const acN = 1 + (L.rng() * 3 | 0);
  for (let i = 0; i < acN; i++) {
    const aw = L.rand(0.7, 1.2), ah = L.rand(0.4, 0.6), ad = L.rand(0.5, 0.8);
    g.add(L.box(aw, ah, ad, L.MAT.flat('#9a9488'), { x: L.jitter(w / 3), y: topY + ah / 2 + 0.06, z: L.jitter(d / 3) }));
  }
}

function make(spec) {
  spec = spec || {};
  L.setSeed(spec.seed || ((spec.name || 'x').charCodeAt(0) * 131 + (spec.floors || 3) * 17 + (spec.w || 7) * 3) | 0);
  const w = spec.w || 7, d = spec.d || 8, floors = spec.floors || 3;
  const h = heightOf(spec);
  const wallHex = spec.wall || L.pick(L.PAL.walls);
  const trimHex = spec.trim || L.pick(L.PAL.trims);
  const wallMat = (spec.archetype === 'townhouse' && L.chance(0.5)) ? L.MAT.brick(wallHex) : L.MAT.wall(wallHex);
  const trimMat = L.MAT.trim(trimHex);
  const frontZ = d / 2;
  const g = new T.Group();

  const body = L.box(w, h, d, wallMat, { y: h / 2, receive: true }); g.add(body);

  // string courses + cornice
  for (let f = 1; f <= floors; f++) g.add(L.box(w + 0.16, 0.2, d + 0.16, trimMat, { y: GROUND_H + f * FLOOR_H - 0.2, cast: false }));
  g.add(L.box(w + 0.36, 0.42, d + 0.36, trimMat, { y: h - 0.08 }));
  g.add(L.box(w + 0.5, 0.12, d + 0.5, trimMat, { y: h + 0.18, cast: false }));

  windowsFor(g, w, h, floors, frontZ);

  // ground-floor shopfront
  const sfH = 2.1, sfZ = frontZ + 0.03;
  g.add(L.box(w - 0.6, sfH, 0.1, L.MAT.glass, { y: sfH / 2 + 0.08, z: sfZ, cast: false }));
  g.add(L.box(w - 0.4, sfH + 0.15, 0.14, L.MAT.metalDark, { y: sfH / 2 + 0.08, z: sfZ - 0.04, cast: false }));
  const door = L.box(1.1, 2.0, 0.15, L.MAT.flat(L.pick(['#4a3020', '#2a4050', '#303828', '#4a3840'])), { x: L.jitter(w / 5), y: 1.02, z: sfZ + 0.06 });
  g.add(door);

  // signage
  if (spec.name) {
    const sgT = L.signTex(spec.name, spec.signColor || L.pick(L.PAL.signbg));
    const sign = new T.Mesh(new T.PlaneGeometry(Math.min(w - 0.8, 4.0), 0.9), L.std({ map: sgT, roughness: 0.55 }));
    sign.position.set(0, 2.6, sfZ + 0.1); g.add(sign);
  }
  // awning
  if (spec.awning) {
    const awMat = L.MAT.fabric(spec.awning[0], spec.awning[1]);
    const aw = L.box(w - 0.7, 0.1, 1.5, awMat, { y: 2.1, z: sfZ + 0.8 }); aw.rotation.x = 0.28; g.add(aw);
    g.add(L.box(w - 0.7, 0.32, 0.05, awMat, { y: 1.82, z: sfZ + 1.44, cast: false }));
  }

  // extras
  const extras = spec.extras || [];
  if (extras.includes('balcony')) {
    for (let f = 1; f <= Math.min(floors, 3); f++) {
      const by = GROUND_H + f * FLOOR_H + 0.6; if (by > h - 1) break;
      g.add(L.box(w * 0.55, 0.14, 0.9, trimMat, { y: by, z: frontZ + 0.5 }));
      const railMat = L.MAT.metalDark;
      for (let ri = 0; ri < 5; ri++) g.add(L.box(0.06, 0.7, 0.06, railMat, { x: -w * 0.55 / 2 + (w * 0.55 / 4) * ri, y: by + 0.35, z: frontZ + 0.95, cast: false }));
      g.add(L.box(w * 0.55 + 0.1, 0.06, 0.06, railMat, { y: by + 0.72, z: frontZ + 0.95, cast: false }));
    }
  }
  if (extras.includes('neon') && spec.name) {
    const glow = L.pick(['#40a8e0', '#ff8060', '#d060f0', '#f0a830', '#30c8f0']);
    const nT = L.neonTex(spec.name, glow);
    const nSign = new T.Mesh(new T.PlaneGeometry(2.8, 0.6), L.std({ map: nT, emissive: parseInt(glow.replace('#', '0x')), emissiveMap: nT, emissiveIntensity: 1.8, roughness: 0.2, transparent: true }));
    nSign.position.set(0, 3.4, sfZ + 0.15); g.add(nSign);
  }
  if (extras.includes('posters')) {
    for (let pi = 0; pi < 1 + (L.rng() * 2 | 0); pi++) {
      const pT = L.posterTex((spec.seed || 1) + pi);
      const poster = new T.Mesh(new T.PlaneGeometry(0.55, 0.82), L.std({ map: pT, roughness: 0.85 }));
      poster.position.set(L.jitter(w / 3), 0.5 + L.rand(0.5, 1.8), frontZ + 0.06); g.add(poster);
    }
  }

  rooftop(g, w, d, h, wallMat);
  return g;
}

FLY.buildings = { make, ARCHETYPES, heightOf };
})();
