/* ════════════════════════════════════════════════════════════════════════
   THE FLY — town/props.js
   Hand-authored street props & vehicles. Messenger.abeto.co-grade charm built
   strictly on FLY.lib so the whole town reads as ONE place.
   Every factory returns a THREE.Group, footprint centered at origin, base y=0,
   FRONT FACES +Z. world.js positions/rotates.
   Required: makeLamp, makeBench, makeBin, makePlanter, makeHydrant, makeTree,
     makeUtilPole, makeBollard, makeFountain, makeMarketStall, makeCafe,
     makeCar, makeScooter, makeTruck
   Cars/Trucks expose userData.wheels (array) so world spins them (wheel.rotation.y).
   Fountain exposes userData.water (array) so world bobs the discs.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
const L = FLY.lib, T = L.T, TAU = L.TAU;

/* ── shared geometries / materials (reuse across dozens of instances) ── */
const GEO = {};
function torus(r, tube, seg, tubeSeg) {
  const k = 'tor' + r + '_' + tube + '_' + (seg || 16) + '_' + (tubeSeg || 8);
  return GEO[k] || (GEO[k] = new T.TorusGeometry(r, tube, tubeSeg || 8, seg || 16));
}
function cone(r, h, seg) {
  const k = 'con' + r + '_' + h + '_' + (seg || 10);
  return GEO[k] || (GEO[k] = new T.ConeGeometry(r, h, seg || 10));
}
function mesh(geo, mat, opt) {
  const m = new T.Mesh(geo, mat); opt = opt || {};
  if (opt.x != null || opt.y != null || opt.z != null) m.position.set(opt.x || 0, opt.y || 0, opt.z || 0);
  if (opt.cast !== false) m.castShadow = true;
  if (opt.receive) m.receiveShadow = true;
  return m;
}

/* shared accent materials (cached via L.std internally where possible) */
const M = {
  cast:    L.MAT.flat('#26282e'),                                   // cast iron (dark, slightly warm)
  castGreen: L.std({ color: 0x2c4a3a, roughness: 0.6, metalness: 0.45 }), // patinated park-iron
  gold:    L.std({ color: 0xc9a23a, roughness: 0.42, metalness: 0.6 }),
  copper:  L.std({ color: 0x6f9e84, roughness: 0.55, metalness: 0.4 }),   // verdigris copper
  stone:   L.MAT.flat('#c8c0aa'),
  stoneD:  L.MAT.flat('#b3aa92'),
  soil:    L.MAT.flat('#4a3624'),
  moss:    L.MAT.flat('#5d7c46'),
  leaf:    L.MAT.flat('#5f8f48'),
  cream:   L.MAT.flat('#efe7d4'),
  redbright: L.MAT.flat('#c8382f'),
  plateW:  L.MAT.flat('#e7e2d2'),
};
const FLOWER = ['#e0556a', '#f0b53a', '#e88bb0', '#9a6fc0', '#ef7a3a', '#f2e25a', '#d84f4f', '#f5f0e0'];
const PRODUCE = ['#d8392f', '#f0a830', '#4fa83f', '#e6c63a', '#e07ab0', '#9650c4', '#e8632a', '#caa040'];

/* small reusable flower cluster (petals + center) sitting on a stem */
function flower(x, y, z, scale, col) {
  scale = scale || 1;
  const grp = new T.Group(); grp.position.set(x, y, z);
  const stem = L.cyl(0.012, 0.018, 0.22 * scale, 5, M.leaf, { y: 0.11 * scale, cast: false }); grp.add(stem);
  const petalMat = L.MAT.flat(col || L.pick(FLOWER));
  const r = 0.05 * scale, py = 0.24 * scale;
  for (let p = 0; p < 5; p++) {
    const a = p / 5 * TAU;
    grp.add(L.sphere(r, 6, petalMat, { x: Math.cos(a) * r * 1.4, y: py, z: Math.sin(a) * r * 1.4, cast: false }));
  }
  grp.add(L.sphere(r * 0.7, 6, L.MAT.flat('#f6e25a'), { y: py + 0.012, cast: false }));
  return grp;
}

/* ════════════════════════════════════════════════════════════════════════
   STREET LAMP — ornate base, fluted tapered pole, lantern head, arm bracket
   ════════════════════════════════════════════════════════════════════════ */
function makeLamp() {
  const g = new T.Group();
  const iron = M.cast;
  // stepped ornate base
  g.add(L.box(0.46, 0.12, 0.46, iron, { y: 0.06 }));
  g.add(L.box(0.36, 0.1, 0.36, iron, { y: 0.17 }));
  g.add(L.cyl(0.2, 0.28, 0.22, 10, iron, { y: 0.34 }));
  // fluted tapered pole (two segments + a swell collar)
  g.add(L.cyl(0.1, 0.16, 2.4, 12, iron, { y: 1.6 }));
  g.add(mesh(torus(0.13, 0.04, 12, 6), iron, { y: 2.8 }));
  g.add(L.cyl(0.08, 0.1, 2.0, 12, iron, { y: 3.85 }));
  g.add(mesh(torus(0.1, 0.035, 12, 6), iron, { y: 4.85 }));
  // decorative scrolled arm bracket reaching out +X
  const arm = L.cyl(0.04, 0.04, 0.95, 6, iron, { x: 0.45, y: 5.0 }); arm.rotation.z = Math.PI / 2 - 0.18; g.add(arm);
  const scroll = mesh(torus(0.12, 0.03, 10, 6), iron, { x: 0.2, y: 4.78 }); scroll.rotation.y = Math.PI / 2; g.add(scroll);
  // lantern head — frame, glass, warm bulb, crown, finial
  const hx = 0.86, hy = 4.78;
  g.add(L.cyl(0.2, 0.26, 0.08, 8, iron, { x: hx, y: hy + 0.42, cast: false }));      // top cap
  const cap = mesh(cone(0.28, 0.3, 8), iron, { x: hx, y: hy + 0.62, cast: false }); g.add(cap);
  g.add(L.sphere(0.05, 6, M.gold, { x: hx, y: hy + 0.82, cast: false }));            // finial
  // glass cage (4 panes feel via a faceted cylinder)
  g.add(L.cyl(0.2, 0.24, 0.62, 4, L.MAT.glassLit, { x: hx, y: hy + 0.06, cast: false }));
  g.add(L.sphere(0.13, 10, L.MAT.emissive('#ffe9b0', 1.5), { x: hx, y: hy + 0.06, cast: false }));
  // little hanging banner under the arm
  const banner = L.box(0.02, 0.34, 0.26, L.MAT.fabric('#c44a44', '#f4ecd8', 4), { x: 0.42, y: 4.55, cast: false });
  g.add(banner);
  g.userData.lampLight = true;
  return g;
}

/* ════════════════════════════════════════════════════════════════════════
   BENCH — wood slats on cast-iron scrolled end frames
   ════════════════════════════════════════════════════════════════════════ */
function makeBench() {
  const g = new T.Group();
  const wood = L.MAT.wood('#7a4e2c');
  const iron = M.castGreen;
  const W = 2.1;
  // seat slats
  for (let s = 0; s < 4; s++) g.add(L.box(W, 0.05, 0.13, wood, { y: 0.46, z: -0.21 + s * 0.15 }));
  // back slats (reclined)
  for (let s = 0; s < 3; s++) { const b = L.box(W, 0.05, 0.12, wood, { y: 0.66 + s * 0.16, z: -0.3 }); b.rotation.x = 0.16; g.add(b); }
  // scrolled cast-iron end frames
  [-0.92, 0.92].forEach(dx => {
    g.add(L.box(0.07, 0.46, 0.5, iron, { x: dx, y: 0.23 }));                 // seat support
    g.add(L.box(0.06, 0.5, 0.07, iron, { x: dx, y: 0.72, z: -0.3 }));        // back upright
    // scroll ornaments
    const sc = mesh(torus(0.1, 0.025, 10, 6), iron, { x: dx, y: 0.18, z: 0.26 }); sc.rotation.y = Math.PI / 2; g.add(sc);
    const sc2 = mesh(torus(0.08, 0.022, 10, 6), iron, { x: dx, y: 0.95, z: -0.34 }); sc2.rotation.y = Math.PI / 2; g.add(sc2);
    // little feet
    g.add(L.box(0.1, 0.06, 0.6, iron, { x: dx, y: 0.03, cast: false }));
  });
  // armrests
  [-0.92, 0.92].forEach(dx => { const a = L.box(0.06, 0.05, 0.5, iron, { x: dx, y: 0.7, z: 0 }); g.add(a); });
  return g;
}

/* ════════════════════════════════════════════════════════════════════════
   BIN — perforated mesh metal look with a domed lid
   ════════════════════════════════════════════════════════════════════════ */
function makeBin() {
  const g = new T.Group();
  const body = L.std({ color: 0x37503e, roughness: 0.55, metalness: 0.5 });
  const ring = L.std({ color: 0x223428, roughness: 0.5, metalness: 0.55 });
  // body (slatted feel via stacked thin bands)
  g.add(L.cyl(0.27, 0.24, 0.82, 14, body, { y: 0.46 }));
  for (let b = 0; b < 4; b++) g.add(mesh(torus(0.27, 0.012, 16, 6), ring, { y: 0.2 + b * 0.18, cast: false }));
  // domed lid with handle
  g.add(L.cyl(0.31, 0.29, 0.06, 14, ring, { y: 0.9, cast: false }));
  g.add(L.sphere(0.26, 14, ring, { y: 0.96, cast: false }));
  g.add(mesh(torus(0.07, 0.018, 10, 6), M.cast, { y: 1.12, cast: false }));
  // opening hint
  g.add(L.box(0.22, 0.1, 0.02, L.MAT.flat('#141a16'), { y: 0.96, z: 0.27, cast: false }));
  // post foot
  g.add(L.cyl(0.13, 0.16, 0.1, 10, M.cast, { y: 0.05 }));
  return g;
}

/* ════════════════════════════════════════════════════════════════════════
   PLANTER — stone urn with soil + several colourful flowers and trailing leaves
   ════════════════════════════════════════════════════════════════════════ */
function makePlanter() {
  const g = new T.Group();
  const stone = M.stone;
  // tapered urn body + rim + foot
  g.add(L.box(0.34, 0.1, 0.34, stone, { y: 0.05 }));                       // foot
  g.add(L.cyl(0.42, 0.3, 0.55, 12, stone, { y: 0.4 }));                    // bowl
  g.add(mesh(torus(0.42, 0.05, 16, 6), M.stoneD, { y: 0.66, cast: false })); // rim
  // soil
  g.add(L.cyl(0.4, 0.4, 0.08, 12, M.soil, { y: 0.65, cast: false }));
  // greenery mound
  g.add(L.sphere(0.34, 8, L.MAT.flat('#6f9a55'), { y: 0.82, cast: false }));
  g.add(L.sphere(0.22, 8, L.MAT.flat('#7faa60'), { x: 0.18, y: 0.78, z: 0.1, cast: false }));
  // colourful flowers
  const cols = L.shuffle(FLOWER);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * TAU;
    g.add(flower(Math.cos(a) * 0.24, 0.7, Math.sin(a) * 0.24, 0.85, cols[i % cols.length]));
  }
  g.add(flower(0, 0.74, 0, 1.0, cols[0]));
  return g;
}

/* ════════════════════════════════════════════════════════════════════════
   HYDRANT — classic bonnet, side caps, chains
   ════════════════════════════════════════════════════════════════════════ */
function makeHydrant() {
  const g = new T.Group();
  const m = M.redbright;
  const trim = M.gold;
  // base flange + barrel
  g.add(L.cyl(0.2, 0.24, 0.08, 10, m, { y: 0.04 }));
  g.add(L.cyl(0.16, 0.18, 0.5, 12, m, { y: 0.32 }));
  g.add(mesh(torus(0.17, 0.03, 14, 6), trim, { y: 0.34, cast: false }));   // belt ring
  // bonnet (dome) + nut cap
  g.add(L.cyl(0.15, 0.17, 0.14, 12, m, { y: 0.62, cast: false }));
  g.add(L.sphere(0.16, 12, m, { y: 0.7, cast: false }));
  g.add(L.cyl(0.07, 0.09, 0.1, 6, trim, { y: 0.84, cast: false }));        // top bolt
  // side outlets + caps with little chains
  [[0.19, 0], [-0.19, 0]].forEach(([dx, dz]) => {
    const a = L.cyl(0.06, 0.07, 0.14, 8, m, { x: dx, y: 0.42, z: dz, cast: false }); a.rotation.z = Math.PI / 2; g.add(a);
    g.add(L.cyl(0.075, 0.075, 0.04, 8, trim, { x: dx * 1.35, y: 0.42, z: dz, cast: false }));
    // chain hint (3 tiny torus links drooping)
    for (let c = 0; c < 3; c++) g.add(mesh(torus(0.018, 0.007, 6, 4), M.cast, { x: dx * 1.1, y: 0.38 - c * 0.04, z: dz + 0.02, cast: false }));
  });
  // front outlet cap
  g.add(L.cyl(0.07, 0.08, 0.12, 8, m, { y: 0.48, z: 0.17, cast: false }));
  g.add(L.cyl(0.085, 0.085, 0.04, 8, trim, { y: 0.48, z: 0.24, cast: false }));
  return g;
}

/* ════════════════════════════════════════════════════════════════════════
   TREE — layered canopy of varied greens, tapered bark trunk; species by seed
   ════════════════════════════════════════════════════════════════════════ */
function makeTree(opts) {
  opts = opts || {};
  const g = new T.Group();
  const tall = opts.tall != null ? opts.tall : L.chance(0.4);   // taller, narrower species
  const big = opts.big;
  const scale = big ? 1.28 : 1.0;
  const th = (tall ? 3.0 : 2.0) * (big ? 1.15 : 1);
  // tapered trunk with slight bark variance + root flare
  const bark = L.MAT.wood(L.pick(['#6a4e30', '#5e4628', '#735436']));
  g.add(L.cyl(0.26 * scale, 0.4 * scale, 0.3, 8, bark, { y: 0.15 }));      // root flare
  g.add(L.cyl(0.14 * scale, 0.24 * scale, th, 8, bark, { y: th / 2 + 0.2 }));
  // a low branch fork for character
  const br = L.cyl(0.05, 0.09, 1.0, 6, bark, { x: 0.3 * scale, y: th * 0.78, cast: false });
  br.rotation.z = -0.7; g.add(br);
  // layered canopy — several overlapping lobes, varied foliage greens
  const greens = L.shuffle(L.PAL.foliage);
  const top = th + 0.2;
  let lobes;
  if (tall) {
    lobes = [[0, top + 0.9, 0, 0.95], [0.35, top + 1.5, 0.2, 0.7], [-0.3, top + 1.4, -0.2, 0.66],
             [0.2, top + 2.1, -0.25, 0.6], [-0.25, top + 2.0, 0.3, 0.62], [0, top + 2.6, 0, 0.5]];
  } else {
    lobes = [[0, top + 0.7, 0, 1.15], [0.6, top + 1.0, 0.35, 0.82], [-0.5, top + 0.95, -0.3, 0.78],
             [0.25, top + 1.45, -0.35, 0.7], [-0.35, top + 1.35, 0.4, 0.74], [0.45, top + 0.55, -0.45, 0.6],
             [-0.55, top + 0.6, 0.3, 0.58]];
  }
  lobes.forEach(([x, y, z, r], i) => {
    g.add(L.sphere(r * scale, 9, L.MAT.flat(greens[i % greens.length]), { x: x * scale, y, z: z * scale }));
  });
  // optional blossom dots
  if (opts.blossom != null ? opts.blossom : L.chance(0.35)) {
    const pink = L.pick(['#f0b9cf', '#f3c9d8', '#f5d6a0']);
    const pm = L.MAT.flat(pink);
    for (let b = 0; b < 14; b++) {
      const a = L.rand(0, TAU), rr = L.rand(0.5, 1.1) * scale;
      g.add(L.sphere(0.07 * scale, 5, pm, { x: Math.cos(a) * rr, y: top + L.rand(0.6, 1.8), z: Math.sin(a) * rr, cast: false }));
    }
  }
  return g;
}

/* ════════════════════════════════════════════════════════════════════════
   UTILITY POLE — pole, cross-arms, insulators, drooping wire hint
   ════════════════════════════════════════════════════════════════════════ */
function makeUtilPole() {
  const g = new T.Group();
  const woodM = L.MAT.wood('#6a5840');
  g.add(L.cyl(0.09, 0.13, 7.6, 8, woodM, { y: 3.8 }));
  // two cross-arms
  [6.5, 7.05].forEach((cy, k) => {
    const span = k === 0 ? 2.4 : 1.8;
    g.add(L.box(span, 0.12, 0.12, L.MAT.wood('#5a4830'), { y: cy }));
    // diagonal braces
    [-1, 1].forEach(s => { const br = L.box(0.06, 0.5, 0.06, L.MAT.wood('#5a4830'), { x: s * span * 0.2, y: cy - 0.28, cast: false }); br.rotation.z = s * 0.5; g.add(br); });
    // insulators (glassy green-blue) on the arm ends + center
    const ins = L.std({ color: 0x3a6a72, roughness: 0.3, metalness: 0.2, envMapIntensity: 1.4 });
    [-span / 2 + 0.15, 0, span / 2 - 0.15].forEach(ix => {
      g.add(L.cyl(0.07, 0.09, 0.16, 8, ins, { x: ix, y: cy + 0.16, cast: false }));
      g.add(L.sphere(0.06, 8, ins, { x: ix, y: cy + 0.26, cast: false }));
    });
  });
  // a transformer can
  g.add(L.cyl(0.16, 0.16, 0.5, 10, L.MAT.metalDark, { x: 0.18, y: 5.6, cast: false }));
  // drooping wire hint — thin slightly-sagging boxes off the top arm
  const wireMat = L.MAT.flat('#1a1a1e');
  [-0.9, 0, 0.9].forEach(wx => {
    const w = L.box(3.2, 0.02, 0.02, wireMat, { x: wx, y: 7.0, z: 0, cast: false });
    g.add(w);
  });
  return g;
}

/* ════════════════════════════════════════════════════════════════════════
   BOLLARD — metal post with domed cap + painted ring
   ════════════════════════════════════════════════════════════════════════ */
function makeBollard() {
  const g = new T.Group();
  g.add(L.cyl(0.16, 0.2, 0.1, 10, M.cast, { y: 0.05 }));                  // base
  g.add(L.cyl(0.11, 0.13, 0.74, 12, M.cast, { y: 0.45 }));                // post
  g.add(mesh(torus(0.12, 0.025, 14, 6), M.redbright, { y: 0.66, cast: false })); // painted ring
  g.add(L.cyl(0.13, 0.11, 0.06, 12, M.cast, { y: 0.83, cast: false }));   // collar
  g.add(L.sphere(0.13, 12, L.MAT.metalLight, { y: 0.87, cast: false })); // chrome dome cap
  return g;
}

/* ════════════════════════════════════════════════════════════════════════
   FOUNTAIN — multi-tier stone basin, water discs, central spout, mossy accents
   userData.water = [disc meshes]  (world bobs them)
   ════════════════════════════════════════════════════════════════════════ */
function makeFountain() {
  const g = new T.Group();
  const stone = M.stone, stoneD = M.stoneD;
  const waterMat = L.std({ color: 0x4f97c6, roughness: 0.12, metalness: 0.3, transparent: true, opacity: 0.8, envMapIntensity: 1.4 });
  const water = [];
  // lower basin — wall ring + floor + coping
  g.add(L.cyl(2.85, 3.0, 0.55, 28, stone, { y: 0.28, receive: true }));
  g.add(mesh(torus(2.85, 0.12, 32, 8), stoneD, { y: 0.55, cast: false }));    // coping rim
  g.add(L.cyl(2.7, 2.7, 0.12, 24, M.moss, { y: 0.18, cast: false }));         // mossy floor
  const w1 = mesh(new T.CylinderGeometry(2.6, 2.6, 0.18, 28), waterMat, { y: 0.5, cast: false }); g.add(w1); water.push(w1);
  // pedestal + mid bowl
  g.add(L.cyl(0.45, 0.62, 1.3, 12, stone, { y: 1.15 }));
  g.add(mesh(torus(0.5, 0.08, 16, 6), M.moss, { y: 0.7, cast: false }));      // mossy band
  g.add(L.cyl(1.15, 1.25, 0.28, 20, stone, { y: 1.75 }));
  g.add(mesh(torus(1.15, 0.07, 24, 8), stoneD, { y: 1.88, cast: false }));
  const w2 = mesh(new T.CylinderGeometry(1.02, 1.02, 0.12, 20), waterMat, { y: 1.84, cast: false }); g.add(w2); water.push(w2);
  // upper pedestal + small top bowl
  g.add(L.cyl(0.26, 0.34, 0.9, 10, stone, { y: 2.3 }));
  g.add(L.cyl(0.5, 0.56, 0.18, 14, stone, { y: 2.78 }));
  const w3 = mesh(new T.CylinderGeometry(0.42, 0.42, 0.1, 14), waterMat, { y: 2.86, cast: false }); g.add(w3); water.push(w3);
  // central spout finial + a couple of "jet" slivers
  g.add(L.sphere(0.16, 12, stoneD, { y: 3.0 }));
  g.add(L.cyl(0.03, 0.05, 0.5, 8, waterMat, { y: 3.28, cast: false }));
  // four little spouts splashing into lower basin
  for (let i = 0; i < 4; i++) { const a = i / 4 * TAU; g.add(L.sphere(0.09, 8, waterMat, { x: Math.cos(a) * 1.0, y: 1.55, z: Math.sin(a) * 1.0, cast: false })); }
  g.userData.water = water;
  return g;
}

/* ════════════════════════════════════════════════════════════════════════
   MARKET STALL — timber frame, striped canopy, crates of produce, hanging goods
   ════════════════════════════════════════════════════════════════════════ */
function makeMarketStall(opts) {
  opts = opts || {};
  const g = new T.Group();
  const frame = L.MAT.wood('#6a5230');
  // four posts + top rails
  const px = 1.05, pz = 0.78;
  [[-px, pz], [px, pz], [-px, -pz], [px, -pz]].forEach(([x, z]) => g.add(L.cyl(0.06, 0.07, 2.2, 6, frame, { x, y: 1.1, z })));
  g.add(L.box(2.3, 0.07, 0.07, frame, { y: 2.18, z: pz, cast: false }));
  g.add(L.box(2.3, 0.07, 0.07, frame, { y: 2.18, z: -pz, cast: false }));
  // striped canopy — pitched (two slanted panels) using L.MAT.fabric
  const pair = L.pick(L.PAL.awning);
  const fab = L.MAT.fabric(pair[0], pair[1], 12);
  const front = L.box(2.5, 0.06, 1.0, fab, { y: 2.36, z: 0.5 }); front.rotation.x = -0.28; g.add(front);
  const back = L.box(2.5, 0.06, 1.0, fab, { y: 2.36, z: -0.5 }); back.rotation.x = 0.28; g.add(back);
  // scalloped valance hanging off the front
  for (let i = 0; i < 7; i++) g.add(mesh(cone(0.12, 0.18, 6), fab, { x: -1.05 + i * 0.35, y: 2.18, z: 0.92, cast: false }));
  // display table
  g.add(L.box(2.0, 0.08, 0.95, L.MAT.wood('#8a6a3c'), { y: 0.9, z: 0.1 }));
  [[-0.85, 0.45], [0.85, 0.45], [-0.85, -0.3], [0.85, -0.3]].forEach(([x, z]) => g.add(L.cyl(0.04, 0.04, 0.9, 5, frame, { x, y: 0.45, z, cast: false })));
  // crates of colourful produce
  const crateMat = L.MAT.wood('#9a7848');
  const cols = L.shuffle(PRODUCE);
  for (let c = 0; c < 4; c++) {
    const cx = -0.75 + c * 0.5, cz = L.rand(-0.05, 0.25);
    const crate = L.box(0.44, 0.18, 0.4, crateMat, { x: cx, y: 1.03, z: cz, cast: false }); crate.rotation.y = L.jitter(0.12); g.add(crate);
    const fruitCol = L.MAT.flat(cols[c % cols.length]);
    for (let f = 0; f < 5; f++) g.add(L.sphere(L.rand(0.07, 0.1), 7, fruitCol, { x: cx + L.jitter(0.14), y: 1.16, z: cz + L.jitter(0.12), cast: false }));
  }
  // hanging goods (garlic/peppers) from the front rail
  for (let i = 0; i < 3; i++) {
    const hx = -0.6 + i * 0.6;
    g.add(L.cyl(0.012, 0.012, 0.3, 4, frame, { x: hx, y: 1.95, z: pz, cast: false }));
    g.add(L.sphere(0.1, 7, L.MAT.flat(L.pick(['#d8392f', '#e6c63a', '#efe7d4'])), { x: hx, y: 1.78, z: pz, cast: false }));
  }
  // price sign
  const sign = L.box(0.5, 0.32, 0.03, L.std({ map: L.signTex('MERCADO', '#4a7a40'), roughness: 0.8 }), { x: 0.85, y: 1.5, z: 0.55, cast: false });
  sign.rotation.y = -0.2; g.add(sign);
  g.add(L.cyl(0.02, 0.02, 0.5, 4, frame, { x: 0.85, y: 1.2, z: 0.5, cast: false }));
  return g;
}

/* ════════════════════════════════════════════════════════════════════════
   CAFÉ SET — 3 bistro tables w/ chairs, parasols, cups & plates, menu board
   ════════════════════════════════════════════════════════════════════════ */
function makeCafe(opts) {
  opts = opts || {};
  const g = new T.Group();
  const topMat = L.std({ color: 0xf0ece0, roughness: 0.5, metalness: 0.2 });
  const ironMat = M.castGreen;
  const woodMat = L.MAT.wood('#5a3818');
  for (let t = 0; t < 3; t++) {
    const tx = (t - 1) * 2.4;
    // round bistro table — top, apron ring, slim pedestal, splayed foot
    g.add(L.cyl(0.46, 0.46, 0.05, 16, topMat, { x: tx, y: 0.76 }));
    g.add(mesh(torus(0.44, 0.03, 18, 6), ironMat, { x: tx, y: 0.73, cast: false }));
    g.add(L.cyl(0.04, 0.05, 0.74, 8, ironMat, { x: tx, y: 0.38, cast: false }));
    g.add(L.cyl(0.18, 0.2, 0.04, 10, ironMat, { x: tx, y: 0.03, cast: false }));
    // cups + plates + a tiny vase on top
    [[0.16, 0.1], [-0.14, -0.12]].forEach(([dx, dz]) => {
      g.add(L.cyl(0.09, 0.09, 0.01, 10, M.plateW, { x: tx + dx, y: 0.79, z: dz, cast: false }));
      g.add(L.cyl(0.045, 0.04, 0.06, 8, M.cream, { x: tx + dx, y: 0.82, z: dz, cast: false }));
      g.add(L.cyl(0.045, 0.045, 0.005, 8, L.MAT.flat('#5a3a26'), { x: tx + dx, y: 0.855, z: dz, cast: false }));
    });
    g.add(L.cyl(0.03, 0.04, 0.1, 8, L.MAT.glass, { x: tx, y: 0.83, z: 0, cast: false }));
    g.add(L.sphere(0.05, 6, L.MAT.flat(L.pick(FLOWER)), { x: tx, y: 0.91, z: 0, cast: false }));
    // chairs (2-4, iron bistro)
    const seats = [[0.62, 0], [-0.62, 0], [0, 0.62], [0, -0.62]].slice(0, L.chance(0.5) ? 4 : 2);
    seats.forEach(([dx, dz]) => {
      g.add(L.cyl(0.2, 0.2, 0.04, 12, ironMat, { x: tx + dx, y: 0.46, z: dz, cast: false }));     // round seat
      // back hoop (torus arc) facing away from table
      const ang = Math.atan2(dz, dx);
      const back = mesh(torus(0.18, 0.02, 12, 5), ironMat, { x: tx + dx + Math.cos(ang) * 0.16, y: 0.66, z: dz + Math.sin(ang) * 0.16, cast: false });
      back.rotation.y = ang + Math.PI / 2; back.rotation.x = 0.2; g.add(back);
      // 3 thin legs
      for (let l = 0; l < 3; l++) { const la = l / 3 * TAU; g.add(L.cyl(0.015, 0.015, 0.46, 4, ironMat, { x: tx + dx + Math.cos(la) * 0.13, y: 0.23, z: dz + Math.sin(la) * 0.13, cast: false })); }
    });
    // parasol — pole, ribs, scalloped fabric cone, finial
    const pair = L.pick(L.PAL.awning);
    g.add(L.cyl(0.035, 0.04, 2.1, 8, woodMat, { x: tx, y: 1.05, cast: false }));
    const canopy = mesh(cone(1.1, 0.55, 10), L.MAT.fabric(pair[0], pair[1], 10), { x: tx, y: 2.0, cast: false }); g.add(canopy);
    for (let i = 0; i < 8; i++) g.add(mesh(cone(0.1, 0.16, 6), L.MAT.fabric(pair[0], pair[1], 4), { x: tx + Math.cos(i / 8 * TAU) * 1.02, y: 1.78, z: Math.sin(i / 8 * TAU) * 1.02, cast: false }));
    g.add(L.sphere(0.05, 6, M.gold, { x: tx, y: 2.32, cast: false }));
  }
  // menu board (A-frame chalkboard) to one side
  const board = L.box(0.55, 0.7, 0.04, L.MAT.flat('#1f2620'), { x: -3.4, y: 0.78, z: 0.2 });
  board.rotation.y = 0.3; g.add(board);
  const boardFrame = L.box(0.6, 0.74, 0.05, woodMat, { x: -3.42, y: 0.78, z: 0.18, cast: false });
  boardFrame.rotation.y = 0.3; g.add(boardFrame);
  const legB = L.box(0.5, 0.7, 0.04, L.MAT.flat('#3a2a1a'), { x: -3.46, y: 0.78, z: 0.0, cast: false }); legB.rotation.y = -0.3; g.add(legB);
  return g;
}

/* ════════════════════════════════════════════════════════════════════════
   CAR — rounded silhouette, glass, chrome-rim wheels, lights, mirrors, plate
   ORIENTATION: long axis = Z, FRONT faces +Z (headlights/grille at +Z),
   width along X. world.js rotates the car so its length lies along the street.
   body variety (sedan / hatch / van) chosen by seed.  userData.wheels set
   (wheel axle along local X → spin via rotation.x to roll).
   ════════════════════════════════════════════════════════════════════════ */
function makeCar(opts) {
  opts = opts || {};
  const g = new T.Group();
  const col = opts.color || L.pick(L.PAL.carBody);
  const bm = L.std({ color: parseInt(col.replace('#', '0x')), roughness: 0.34, metalness: 0.42, envMapIntensity: 1.35 });
  const sill = L.MAT.flat('#33373e');           // dark lower cladding (two-tone)
  const trimDark = L.MAT.flat('#2a2e34');
  const glass = L.MAT.glassTint, chrome = L.MAT.chrome;
  const kind = L.pick(['sedan', 'sedan', 'hatch', 'wagon']);

  const len = 4.3, wid = 1.82, hl = len / 2;
  // — body: graduated boxes + two-tone dark sill, softly chamfered nose/tail —
  g.add(L.box(wid, 0.30, len, sill, { y: 0.40 }));                          // dark sill band
  g.add(L.box(wid, 0.46, len, bm, { y: 0.78 }));                           // main body
  g.add(L.box(wid - 0.05, 0.30, len - 0.32, bm, { y: 1.04 }));             // shoulder (proud)
  g.add(L.box(wid - 0.16, 0.16, 1.05, bm, { y: 1.10, z: hl - 0.58, cast: false }));   // hood (front +Z)
  g.add(L.box(wid - 0.16, 0.16, 0.85, bm, { y: 1.10, z: -hl + 0.48, cast: false }));  // trunk (-Z)
  g.add(L.box(wid - 0.44, 0.42, 0.18, bm, { y: 0.74, z: hl - 0.01, cast: false }));   // nose chamfer
  g.add(L.box(wid - 0.44, 0.42, 0.18, bm, { y: 0.74, z: -hl + 0.01, cast: false }));  // tail chamfer

  // — greenhouse: side glass + curved roof + raked windshield/backlight —
  let cabLen, cabZ, cabH = 0.58, cabY = 1.40;
  if (kind === 'wagon') { cabLen = 2.45; cabZ = -0.25; cabH = 0.64; }
  else if (kind === 'hatch') { cabLen = 1.85; cabZ = -0.42; }
  else { cabLen = 1.98; cabZ = -0.2; }
  const cabFront = cabZ + cabLen / 2, cabRear = cabZ - cabLen / 2;
  g.add(L.box(1.58, cabH, cabLen, glass, { z: cabZ, y: cabY, cast: false }));         // side glass
  // curved roof — flattened half-cylinder spanning the cabin (axis along X = width)
  const roof = L.cyl(cabLen * 0.54, cabLen * 0.54, 1.52, 16, bm, { z: cabZ, y: cabY + cabH / 2 - 0.06, cast: false });
  roof.rotation.z = Math.PI / 2; roof.scale.x = 0.40;     // flatten height (world Y)
  g.add(roof);
  // body-color pillars at the cabin corners
  [-1, 1].forEach(s => {
    g.add(L.box(0.09, cabH + 0.02, 0.09, bm, { x: s * 0.78, z: cabFront, y: cabY, cast: false }));
    g.add(L.box(0.09, cabH + 0.02, 0.09, bm, { x: s * 0.78, z: cabRear, y: cabY, cast: false }));
  });
  // raked windshield + backlight (slanted tinted glass)
  const ws = L.box(1.5, cabH + 0.32, 0.05, glass, { z: cabFront + 0.16, y: cabY - 0.04, cast: false }); ws.rotation.x = -0.5; g.add(ws);
  const bl = L.box(1.5, cabH + 0.24, 0.05, glass, { z: cabRear - 0.15, y: cabY - 0.04, cast: false }); bl.rotation.x = 0.55; g.add(bl);

  // — bumpers + chrome grille + plates —
  g.add(L.box(wid + 0.06, 0.22, 0.14, trimDark, { y: 0.44, z: hl + 0.02, cast: false }));
  g.add(L.box(wid + 0.06, 0.22, 0.14, trimDark, { y: 0.44, z: -hl - 0.02, cast: false }));
  g.add(L.box(0.92, 0.1, 0.05, chrome, { y: 0.84, z: hl - 0.01, cast: false }));       // grille bar
  g.add(L.box(0.5, 0.13, 0.02, M.plateW, { y: 0.52, z: hl + 0.045, cast: false }));
  g.add(L.box(0.5, 0.13, 0.02, M.plateW, { y: 0.52, z: -hl - 0.045, cast: false }));

  // — round chrome-ringed headlights (+Z) + red taillights (-Z) —
  [0.6, -0.6].forEach(hx => {
    const ring = L.cyl(0.14, 0.14, 0.07, 12, chrome, { x: hx, y: 0.88, z: hl - 0.02, cast: false }); ring.rotation.x = Math.PI / 2; g.add(ring);
    const lens = L.cyl(0.1, 0.1, 0.08, 12, L.MAT.emissive('#fff2c4', 0.5), { x: hx, y: 0.88, z: hl + 0.02, cast: false }); lens.rotation.x = Math.PI / 2; g.add(lens);
    g.add(L.box(0.28, 0.13, 0.06, L.MAT.emissive('#cc1414', 0.7), { x: hx, y: 0.9, z: -hl - 0.01, cast: false }));
  });

  // — door handles + side mirrors —
  [-1, 1].forEach(s => {
    g.add(L.box(0.04, 0.05, 0.16, chrome, { x: s * (wid / 2 + 0.02), y: 0.98, z: cabZ + 0.55, cast: false }));   // handle
    g.add(L.box(0.05, 0.08, 0.11, bm, { x: s * (wid / 2 + 0.05), y: 1.30, z: cabFront - 0.05, cast: false }));    // mirror
  });

  // — wheels: tire + chrome dish + lug; axle along local X (rotation.z = PI/2) —
  const wheels = [];
  [[wid / 2 + 0.0, 1.30], [-(wid / 2), 1.30], [wid / 2, -1.30], [-(wid / 2), -1.30]].forEach(([wx, wz]) => {
    g.add(L.box(0.15, 0.34, 0.94, bm, { x: wx * 0.92, y: 0.64, z: wz, cast: false }));   // wheel arch flare
    const tire = L.cyl(0.38, 0.38, 0.26, 18, L.MAT.rubber, { x: wx, y: 0.38, z: wz });
    tire.rotation.z = Math.PI / 2; g.add(tire); wheels.push(tire);
    const dish = L.cyl(0.24, 0.24, 0.28, 14, chrome, { x: wx, y: 0.38, z: wz, cast: false });
    dish.rotation.z = Math.PI / 2; g.add(dish);
    g.add(L.sphere(0.07, 8, L.MAT.metalLight, { x: wx, y: 0.38, z: wz, cast: false }));   // center lug
  });

  g.userData.wheels = wheels;
  return g;
}

/* ════════════════════════════════════════════════════════════════════════
   SCOOTER — Vespa-style with a delivery box on the back
   ════════════════════════════════════════════════════════════════════════ */
function makeScooter() {
  const g = new T.Group();
  const col = L.pick(['#e0554a', '#4a86d0', '#e6c23a', '#46b88a', '#d96fa0', '#e8e0cc']);
  const bm = L.std({ color: parseInt(col.replace('#', '0x')), roughness: 0.35, metalness: 0.4, envMapIntensity: 1.3 });
  // rounded body / leg shield (front at +X here is the riding direction; world rotates)
  g.add(L.box(1.5, 0.4, 0.5, bm, { x: -0.1, y: 0.62 }));                  // floor pan / body
  g.add(L.sphere(0.42, 12, bm, { x: -0.55, y: 0.66 }));                   // rounded rear cowl
  g.add(L.box(0.42, 0.78, 0.46, bm, { x: 0.72, y: 0.78 }));               // front leg shield
  g.add(mesh(torus(0.18, 0.06, 14, 6), bm, { x: 0.72, y: 1.02, cast: false })); // headlight nacelle ring
  g.add(L.sphere(0.1, 10, L.MAT.emissive('#fff0b0', 0.6), { x: 0.84, y: 1.02, cast: false }));
  // seat
  g.add(L.box(0.6, 0.16, 0.42, L.MAT.flat('#2a2420'), { x: -0.25, y: 0.86, cast: false }));
  // handlebar
  const h = L.cyl(0.025, 0.025, 0.5, 6, L.MAT.metalDark, { x: 0.78, y: 1.28, cast: false }); h.rotation.x = Math.PI / 2; g.add(h);
  g.add(L.cyl(0.03, 0.03, 0.5, 6, L.MAT.metalDark, { x: 0.78, y: 1.08, cast: false }));   // fork stem
  [-0.22, 0.22].forEach(dz => g.add(L.sphere(0.04, 6, L.MAT.flat('#1a1a1a'), { x: 0.78, y: 1.28, z: dz, cast: false }))); // grips
  // mirror
  g.add(L.cyl(0.012, 0.012, 0.16, 4, L.MAT.metalDark, { x: 0.78, y: 1.4, z: 0.18, cast: false }));
  // wheels (small) — front +X, rear -X
  [[0.72], [-0.78]].forEach(([wx]) => {
    const tire = L.cyl(0.25, 0.25, 0.16, 14, L.MAT.rubber, { x: wx, y: 0.3 }); tire.rotation.x = Math.PI / 2; g.add(tire);
    const rim = L.cyl(0.13, 0.13, 0.18, 8, L.MAT.metalLight, { x: wx, y: 0.3, cast: false }); rim.rotation.x = Math.PI / 2; g.add(rim);
  });
  // front fender
  const fend = mesh(torus(0.28, 0.05, 12, 6), bm, { x: 0.72, y: 0.36, cast: false }); fend.rotation.y = Math.PI / 2; g.add(fend);
  // delivery box on the back
  g.add(L.box(0.5, 0.46, 0.5, L.MAT.flat('#e8e0cc'), { x: -0.8, y: 1.16 }));
  g.add(L.box(0.52, 0.1, 0.52, L.MAT.flat('#c84038'), { x: -0.8, y: 1.42, cast: false }));   // lid band
  const box = L.box(0.36, 0.26, 0.02, L.std({ map: L.signTex('FLY', '#c84038'), roughness: 0.8 }), { x: -0.8, y: 1.16, z: 0.26, cast: false });
  g.add(box);
  return g;
}

/* ════════════════════════════════════════════════════════════════════════
   TRUCK — cab + cargo box, 6 wheels into userData.wheels
   ORIENTATION: long axis = Z, cab/front faces +Z (headlights at +Z), cargo box
   toward -Z, width along X. Wheel axle along local X (spin via rotation.x).
   ════════════════════════════════════════════════════════════════════════ */
function makeTruck(opts) {
  opts = opts || {};
  const g = new T.Group();
  const col = opts.color || L.pick(['#d8d0c4', '#3a5a8a', '#b03838', '#4a7a40', '#c8783a', '#5a6a78']);
  const bm = L.std({ color: parseInt(col.replace('#', '0x')), roughness: 0.42, metalness: 0.4, envMapIntensity: 1.2 });
  const glass = L.MAT.glassTint, trimDark = L.MAT.flat('#23262c');

  // — cab (toward +Z, the front) —
  g.add(L.box(2.0, 1.5, 2.3, bm, { z: 1.5, y: 1.1 }));
  g.add(L.box(1.9, 0.3, 2.3, bm, { z: 1.5, y: 1.95, cast: false }));            // cab roof cap
  g.add(L.box(2.02, 0.9, 0.6, glass, { z: 0.45, y: 1.5, cast: false }));        // rear cab glass band toward body
  g.add(L.box(2.04, 0.7, 1.6, glass, { z: 1.7, y: 1.55, cast: false }));        // cab side glass
  g.add(L.box(2.0, 0.4, 0.3, trimDark, { z: 2.6, y: 0.5, cast: false }));       // front bumper (low)
  // grille on +Z front face + headlights
  g.add(L.box(1.0, 0.5, 0.06, L.MAT.chrome, { z: 2.6, y: 0.9, cast: false }));
  [0.55, -0.55].forEach(hx => g.add(L.box(0.3, 0.22, 0.1, L.MAT.emissive('#fff0b0', 0.5), { x: hx, y: 1.0, z: 2.6, cast: false })));
  g.add(L.box(0.46, 0.14, 0.02, M.plateW, { y: 0.55, z: 2.62, cast: false }));
  // exhaust stack (beside cab, rear corner)
  g.add(L.cyl(0.07, 0.07, 1.2, 8, L.MAT.metalLight, { x: 0.9, y: 2.0, z: 0.45, cast: false }));

  // — cargo box (toward -Z) —
  g.add(L.box(2.1, 2.2, 4.3, L.MAT.flat('#e8e2d4'), { z: -1.55, y: 1.35 }));
  // box paneling ribs + a coloured stripe
  for (let i = 0; i < 5; i++) g.add(L.box(2.12, 2.0, 0.04, L.MAT.flat('#d6cfbf'), { z: -3.4 + i * 0.92, y: 1.35, cast: false }));
  g.add(L.box(2.13, 0.18, 4.3, bm, { z: -1.55, y: 1.05, cast: false }));         // colour stripe
  g.add(L.box(2.14, 0.12, 4.32, M.cast, { z: -1.55, y: 0.36, cast: false }));    // skirt
  // rear doors + taillights at -Z end
  g.add(L.box(2.1, 1.9, 0.06, L.MAT.flat('#cfc7b6'), { z: -3.7, y: 1.35, cast: false }));
  [0.7, -0.7].forEach(hx => g.add(L.box(0.22, 0.3, 0.06, L.MAT.emissive('#cc1414', 0.6), { x: hx, y: 0.7, z: -3.71, cast: false })));

  // — 6 wheels: axle along local X (rotation.z = PI/2) —
  const wheels = [];
  [[0.95, 2.0], [-0.95, 2.0], [0.95, -1.4], [-0.95, -1.4], [0.95, -2.7], [-0.95, -2.7]].forEach(([wx, wz]) => {
    g.add(L.box(0.2, 0.36, 0.95, M.cast, { x: wx * 0.96, y: 0.7, z: wz, cast: false }));   // fender
    const tire = L.cyl(0.46, 0.46, 0.32, 16, L.MAT.rubber, { x: wx, y: 0.46, z: wz });
    tire.rotation.z = Math.PI / 2; g.add(tire); wheels.push(tire);
    const rim = L.cyl(0.26, 0.26, 0.34, 10, L.MAT.metalLight, { x: wx, y: 0.46, z: wz, cast: false });
    rim.rotation.z = Math.PI / 2; g.add(rim);
  });
  g.userData.wheels = wheels;
  return g;
}

/* ════════════════════════════════════════════════════════════════════════
   TRAM / STREETCAR — charming multi-segment vintage streetcar.
   ORIENTATION: long axis = Z, FRONT faces +Z (cowcatcher/headlamp at +Z),
   width along X. world.js rotates it so its length lies along the route.
   Two articulated body segments + a rounded nose, big windows, a roof with a
   trolley pole reaching to an overhead wire, destination sign, and wheels
   exposed in userData.wheels (axle along local X → world spins rotation.x).
   ════════════════════════════════════════════════════════════════════════ */
function makeTram(opts) {
  opts = opts || {};
  const g = new T.Group();
  const col = opts.color || L.pick(['#9a2f2a', '#2f6f5a', '#365a8a', '#b06a28', '#5a3a6a', '#356e4a']);
  const bm = L.std({ color: parseInt(col.replace('#', '0x')), roughness: 0.4, metalness: 0.4, envMapIntensity: 1.3 });
  const cream = L.MAT.flat('#efe7d4');
  const glass = L.MAT.glassTint, trimDark = L.MAT.flat('#23262c');
  const roofMat = L.std({ color: 0x4a4640, roughness: 0.7, metalness: 0.3 });

  const wid = 2.5;
  const bodyTopY = 2.65;
  const segLens = [4.6, 4.6];          // two articulated cars
  const segZ = [2.6, -2.6];            // segment centers along Z (front first)
  const wheels = [];

  function segment(cz, len, isFront) {
    // lower skirt + main body + cream upper band + roof
    g.add(L.box(wid, 0.5, len, trimDark, { z: cz, y: 0.55, cast: false }));        // skirt
    g.add(L.box(wid, 1.0, len, bm, { z: cz, y: 1.2 }));                            // lower body (colour)
    g.add(L.box(wid + 0.04, 0.9, len - 0.1, cream, { z: cz, y: 2.0, cast: false })); // cream window band
    g.add(L.box(wid + 0.02, 0.16, len, bm, { z: cz, y: 1.55, cast: false }));      // belt moulding
    // big side windows (a glass band, divided by pillars)
    g.add(L.box(wid + 0.06, 0.74, len - 0.5, glass, { z: cz, y: 2.0, cast: false }));
    const winN = Math.max(3, Math.round((len - 0.6) / 1.2));
    for (let i = 0; i <= winN; i++) {
      const wz = cz - (len - 0.6) / 2 + (len - 0.6) / winN * i;
      [-1, 1].forEach(s => g.add(L.box(0.12, 0.82, 0.06, bm, { x: s * (wid / 2 + 0.02), y: 2.0, z: wz, cast: false })));
    }
    // arched roof cap
    g.add(L.box(wid - 0.1, 0.34, len - 0.06, roofMat, { z: cz, y: bodyTopY - 0.18, cast: false }));
    g.add(L.box(wid - 0.5, 0.18, len - 0.3, roofMat, { z: cz, y: bodyTopY, cast: false }));
  }
  segment(segZ[0], segLens[0], true);
  segment(segZ[1], segLens[1], false);
  // articulation bellows between the two cars
  for (let i = 0; i < 4; i++) g.add(L.box(wid - 0.2, 1.5, 0.12, trimDark, { z: 0.45 - i * 0.3, y: 1.6, cast: false }));

  // — rounded nose at the FRONT (+Z) —
  const noseZ = segZ[0] + segLens[0] / 2;
  g.add(L.box(wid - 0.1, 1.7, 0.5, bm, { z: noseZ + 0.2, y: 1.55 }));
  g.add(L.box(wid - 0.3, 1.0, 0.18, glass, { z: noseZ + 0.46, y: 2.05, cast: false }));   // windshield
  // destination sign (lit) above the windshield
  g.add(L.box(1.5, 0.32, 0.06, L.MAT.emissive('#ffe6a0', 0.7), { z: noseZ + 0.48, y: 2.55, cast: false }));
  // headlamp + cowcatcher
  g.add(L.sphere(0.16, 10, L.MAT.emissive('#fff0b0', 0.6), { z: noseZ + 0.5, y: 1.2, cast: false }));
  g.add(L.box(wid - 0.2, 0.4, 0.3, trimDark, { z: noseZ + 0.45, y: 0.45, cast: false }));
  // rear cap at -Z
  const tailZ = segZ[1] - segLens[1] / 2;
  g.add(L.box(wid - 0.1, 1.7, 0.4, bm, { z: tailZ - 0.15, y: 1.55 }));
  [0.7, -0.7].forEach(hx => g.add(L.box(0.22, 0.26, 0.06, L.MAT.emissive('#cc1414', 0.6), { x: hx, y: 1.0, z: tailZ - 0.34, cast: false })));

  // — doors (folding, hinted by recessed dark panels) on each segment, +X side —
  [segZ[0], segZ[1]].forEach(cz => {
    g.add(L.box(0.06, 1.5, 1.0, trimDark, { x: wid / 2 + 0.02, y: 1.5, z: cz, cast: false }));
  });

  // — trolley pole + roof gear reaching up toward the overhead wire —
  g.add(L.box(0.5, 0.2, 1.2, trimDark, { z: 0.0, y: bodyTopY + 0.12, cast: false }));     // pole base shoe
  const pole = L.cyl(0.04, 0.05, 2.2, 6, L.MAT.metalLight, { y: bodyTopY + 1.2, z: -0.4, cast: false });
  pole.rotation.x = 0.32; g.add(pole);                                                    // angled back & up
  g.add(L.sphere(0.07, 8, L.MAT.chrome, { y: bodyTopY + 2.25, z: -1.0, cast: false }));    // contact wheel
  // roof vents / clerestory ribs
  for (let i = 0; i < 6; i++) g.add(L.box(0.5, 0.06, 0.1, trimDark, { z: 4.4 - i * 1.6, y: bodyTopY + 0.12, cast: false }));

  // — bogies / wheels: axle along local X (rotation.z = PI/2); world spins rotation.x —
  [[0.95, segZ[0] + 1.4], [0.95, segZ[0] - 1.4], [0.95, segZ[1] + 1.4], [0.95, segZ[1] - 1.4]].forEach(([wx, wz]) => {
    [wx, -wx].forEach(sx => {
      const tire = L.cyl(0.42, 0.42, 0.22, 14, M.cast, { x: sx, y: 0.42, z: wz });
      tire.rotation.z = Math.PI / 2; g.add(tire); wheels.push(tire);
      const rim = L.cyl(0.2, 0.2, 0.24, 8, L.MAT.metalLight, { x: sx, y: 0.42, z: wz, cast: false });
      rim.rotation.z = Math.PI / 2; g.add(rim);
    });
  });

  g.userData.wheels = wheels;
  return g;
}

FLY.props = { makeLamp, makeBench, makeBin, makePlanter, makeHydrant, makeTree, makeUtilPole, makeBollard, makeFountain, makeMarketStall, makeCafe, makeCar, makeScooter, makeTruck, makeTram };
})();
