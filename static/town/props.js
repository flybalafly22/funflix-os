/* ════════════════════════════════════════════════════════════════════════
   THE FLY — town/props.js   (BASELINE — agents enrich this)
   Every factory returns a THREE.Group, footprint centered at origin, base y=0,
   FRONT FACES +Z. world.js positions/rotates.
   Required: makeLamp, makeBench, makeBin, makePlanter, makeHydrant, makeTree,
     makeUtilPole, makeBollard, makeFountain, makeMarketStall, makeCafe,
     makeCar, makeScooter, makeTruck
   Cars expose userData.wheels (array) so world can spin them.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
const L = FLY.lib, T = L.T, TAU = L.TAU;

function makeLamp() {
  const g = new T.Group();
  g.add(L.cyl(0.22, 0.18, 0.2, 8, L.MAT.metalDark, { y: 0.1 }));
  g.add(L.cyl(0.08, 0.11, 5.0, 8, L.MAT.metalDark, { y: 2.6 }));
  const arm = L.cyl(0.045, 0.045, 0.9, 6, L.MAT.metalDark, { x: 0.42, y: 4.95 }); arm.rotation.z = Math.PI / 2; g.add(arm);
  g.add(L.cyl(0.22, 0.14, 0.35, 10, L.MAT.flat('#303030'), { x: 0.8, y: 4.85 }));
  g.add(L.sphere(0.14, 10, L.MAT.emissive('#fff0c0', 1.4), { x: 0.8, y: 4.7, cast: false }));
  g.userData.lampLight = true;
  return g;
}
function makeBench() {
  const g = new T.Group(); const wood = L.MAT.wood('#7a4e2c');
  for (let s = 0; s < 3; s++) g.add(L.box(2.1, 0.08, 0.14, wood, { y: 0.46, z: -0.18 + s * 0.18 }));
  for (let s = 0; s < 2; s++) { const b = L.box(2.1, 0.08, 0.12, wood, { y: 0.7 + s * 0.18, z: -0.28 }); b.rotation.x = 0.12; g.add(b); }
  [-0.9, 0.9].forEach(dx => g.add(L.box(0.1, 0.46, 0.48, L.MAT.metalDark, { x: dx, y: 0.23, cast: false })));
  return g;
}
function makeBin() {
  const g = new T.Group();
  g.add(L.cyl(0.28, 0.24, 0.88, 10, L.MAT.flat('#3a5840'), { y: 0.44 }));
  g.add(L.cyl(0.3, 0.3, 0.07, 10, L.MAT.flat('#2a4030'), { y: 0.92, cast: false }));
  return g;
}
function makePlanter() {
  const g = new T.Group();
  g.add(L.box(0.85, 0.55, 0.85, L.MAT.flat('#b09070'), { y: 0.28 }));
  g.add(L.box(0.75, 0.08, 0.75, L.MAT.flat('#4a3828'), { y: 0.59, cast: false }));
  g.add(L.sphere(0.45, 8, L.MAT.flat(L.pick(['#6f9a55', '#7faa60', '#5a8844'])), { y: 0.88 }));
  return g;
}
function makeHydrant() {
  const g = new T.Group(); const m = L.MAT.flat('#be3830');
  g.add(L.cyl(0.16, 0.18, 0.55, 8, m, { y: 0.28 }));
  g.add(L.cyl(0.12, 0.15, 0.18, 8, m, { y: 0.62, cast: false }));
  g.add(L.cyl(0.09, 0.12, 0.1, 6, L.MAT.flat('#b8b020'), { y: 0.76, cast: false }));
  [-0.19, 0.19].forEach(dx => { const a = L.cyl(0.06, 0.06, 0.16, 6, m, { x: dx, y: 0.44, cast: false }); a.rotation.z = Math.PI / 2; g.add(a); });
  return g;
}
function makeTree(opts) {
  opts = opts || {}; const g = new T.Group();
  const th = opts.big ? 2.6 : 2.0;
  g.add(L.cyl(0.16, 0.24, th, 8, L.MAT.wood('#6a4e30'), { y: th / 2 }));
  const lobes = [[0, th + 0.8, 0, 1.1], [0.5, th + 1.2, 0.3, 0.82], [-0.4, th + 1.1, -0.25, 0.76], [0.2, th + 1.5, -0.3, 0.65], [-0.3, th + 1.4, 0.3, 0.7]];
  lobes.forEach(([x, y, z, r]) => g.add(L.sphere(r * (opts.big ? 1.25 : 1), 8, L.MAT.flat(L.pick(L.PAL.foliage)), { x, y, z })));
  return g;
}
function makeUtilPole() {
  const g = new T.Group();
  g.add(L.cyl(0.07, 0.1, 7.5, 7, L.MAT.wood('#6a5840'), { y: 3.75, cast: false }));
  g.add(L.box(2.2, 0.1, 0.1, L.MAT.flat('#5a4830'), { y: 7.0, cast: false }));
  [-0.9, 0.9].forEach(dx => g.add(L.cyl(0.08, 0.06, 0.2, 6, L.MAT.flat('#607848'), { x: dx, y: 7.12, cast: false })));
  return g;
}
function makeBollard() {
  const g = new T.Group();
  g.add(L.cyl(0.12, 0.14, 0.8, 8, L.MAT.metalDark, { y: 0.4 }));
  g.add(L.sphere(0.13, 8, L.MAT.metalLight, { y: 0.8, cast: false }));
  return g;
}
function makeFountain() {
  const g = new T.Group();
  g.add(L.cyl(2.6, 2.8, 0.6, 24, L.MAT.flat('#c4bca8'), { y: 0.3, receive: true }));
  const water = new T.Mesh(new T.CylinderGeometry(2.4, 2.4, 0.2, 24), L.std({ color: 0x4a90c0, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.85 }));
  water.position.y = 0.52; g.add(water);
  g.add(L.cyl(0.5, 0.6, 1.6, 16, L.MAT.flat('#b8b09a'), { y: 1.3 }));
  g.add(L.cyl(1.0, 1.1, 0.3, 18, L.MAT.flat('#c4bca8'), { y: 1.6 }));
  const water2 = new T.Mesh(new T.CylinderGeometry(0.9, 0.9, 0.12, 16), L.std({ color: 0x4a90c0, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.85 }));
  water2.position.y = 1.72; g.add(water2);
  g.add(L.sphere(0.25, 10, L.MAT.metalLight, { y: 2.0 }));
  g.userData.water = [water, water2];
  return g;
}
function makeMarketStall(opts) {
  opts = opts || {}; const g = new T.Group();
  const frame = L.MAT.wood('#5a4828');
  [-0.9, 0.9].forEach(dx => { g.add(L.cyl(0.06, 0.06, 2.2, 6, frame, { x: dx, y: 1.1 })); g.add(L.cyl(0.06, 0.06, 2.2, 6, frame, { x: dx, y: 1.1, z: 0.8 })); });
  const aw = L.pick(['#e05040', '#e0b030', '#3060c0', '#408040', '#b03080']);
  const can = L.box(2.2, 0.1, 1.4, L.MAT.fabric(aw, '#f4f0e0', 12), { y: 2.2, z: 0.4 }); can.rotation.x = -0.06; g.add(can);
  g.add(L.box(1.8, 0.08, 0.8, L.MAT.flat('#c8b890'), { y: 0.88, z: 0.2, cast: false }));
  for (let i = 0; i < 5; i++) g.add(L.box(L.rand(0.2, 0.5), L.rand(0.15, 0.35), L.rand(0.2, 0.4), L.MAT.flat(L.pick(['#e04040', '#f0b030', '#40a040', '#e080a0', '#f0e040', '#a040c0'])), { x: L.jitter(0.7), y: 0.97, z: 0.2 }));
  return g;
}
function makeCafe(opts) {
  opts = opts || {}; const g = new T.Group();
  const tableMat = L.MAT.flat('#f0ece0'), chairMat = L.MAT.flat('#3a3028');
  for (let t = 0; t < 3; t++) {
    const tx = (t - 1) * 2.4;
    g.add(L.cyl(0.48, 0.48, 0.06, 10, tableMat, { x: tx, y: 0.76 }));
    g.add(L.cyl(0.04, 0.04, 0.76, 6, L.MAT.wood('#4a3828'), { x: tx, y: 0.38, cast: false }));
    [[0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6]].slice(0, L.chance(0.5) ? 4 : 2).forEach(([dx, dz]) => {
      g.add(L.box(0.42, 0.04, 0.42, chairMat, { x: tx + dx, y: 0.47, z: dz, cast: false }));
      g.add(L.box(0.42, 0.45, 0.04, chairMat, { x: tx + dx, y: 0.7, z: dz - 0.19, cast: false }));
    });
    // parasol
    const um = L.pick(['#e84040', '#f0a030', '#3870c0', '#40a058']);
    g.add(L.cyl(0.04, 0.04, 2.0, 7, L.MAT.wood('#5a3818'), { x: tx, y: 1.0, cast: false }));
    g.add(new T.Mesh(new T.ConeGeometry(1.05, 0.5, 8), L.MAT.fabric(um, '#f4f0e0', 8)).translateX(tx).translateY(1.95));
  }
  return g;
}

function makeCar(opts) {
  opts = opts || {}; const g = new T.Group();
  const col = opts.color || L.pick(L.PAL.carBody);
  const bm = L.std({ color: parseInt(col.replace('#', '0x')), roughness: 0.32, metalness: 0.5, envMapIntensity: 1.4 });
  g.add(L.box(4.2, 0.78, 1.82, bm, { y: 0.64 }));
  g.add(L.box(2.3, 0.72, 1.66, bm, { x: -0.15, y: 1.29 }));
  g.add(L.box(2.1, 0.62, 1.54, L.MAT.glassTint, { x: -0.15, y: 1.3, cast: false }));
  const bumpMat = L.MAT.flat('#2a2e34');
  g.add(L.box(4.35, 0.26, 0.12, bumpMat, { y: 0.36, z: 0.96, cast: false }));
  g.add(L.box(4.35, 0.26, 0.12, bumpMat, { y: 0.36, z: -0.96, cast: false }));
  const wheels = [];
  [[1.3, 0.92], [1.3, -0.92], [-1.3, 0.92], [-1.3, -0.92]].forEach(([wx, wz]) => {
    const tire = L.cyl(0.36, 0.36, 0.28, 14, L.MAT.rubber, { x: wx, y: 0.36, z: wz }); tire.rotation.x = Math.PI / 2; g.add(tire); wheels.push(tire);
    const rim = L.cyl(0.24, 0.24, 0.3, 10, L.MAT.metalLight, { x: wx, y: 0.36, z: wz, cast: false }); rim.rotation.x = Math.PI / 2; g.add(rim);
  });
  // lights — headlights point +Z (front)
  g.add(L.box(0.34, 0.2, 0.12, L.MAT.emissive('#fff0b0', 0.4), { x: 0.58, y: 0.72, z: 2.07, cast: false }));
  g.add(L.box(0.34, 0.2, 0.12, L.MAT.emissive('#fff0b0', 0.4), { x: -0.58, y: 0.72, z: 2.07, cast: false }));
  g.add(L.box(0.32, 0.2, 0.12, L.MAT.emissive('#cc1010', 0.6), { x: 0.58, y: 0.72, z: -2.07, cast: false }));
  g.add(L.box(0.32, 0.2, 0.12, L.MAT.emissive('#cc1010', 0.6), { x: -0.58, y: 0.72, z: -2.07, cast: false }));
  g.userData.wheels = wheels;
  return g;
}
function makeScooter() {
  const g = new T.Group();
  const bm = L.MAT.flat(L.pick(['#e04040', '#4080e0', '#e0c040', '#40c080']));
  g.add(L.box(1.8, 0.6, 0.7, bm, { y: 0.6 }));
  g.add(L.box(0.4, 0.8, 0.5, bm, { x: 0.8, y: 0.72 }));
  const h = L.cyl(0.035, 0.035, 1.0, 6, L.MAT.metalDark, { x: 0.8, y: 1.25, cast: false }); h.rotation.z = Math.PI / 2; g.add(h);
  [[0.7], [-0.7]].forEach(([wx]) => { const w = L.cyl(0.24, 0.24, 0.2, 12, L.MAT.rubber, { x: wx, y: 0.3 }); w.rotation.x = Math.PI / 2; g.add(w); });
  g.add(L.box(0.7, 0.5, 0.6, L.MAT.flat('#e8e0cc'), { x: -0.65, y: 0.95 }));
  return g;
}
function makeTruck(opts) {
  opts = opts || {}; const g = new T.Group();
  const col = opts.color || L.pick(['#d8d0c4', '#3a5a8a', '#b03838', '#4a7a40']);
  const bm = L.std({ color: parseInt(col.replace('#', '0x')), roughness: 0.4, metalness: 0.4 });
  g.add(L.box(2.4, 1.6, 2.0, bm, { x: 1.5, y: 1.2 }));              // cab
  g.add(L.box(2.0, 1.0, 1.9, L.MAT.glassTint, { x: 1.6, y: 1.5, cast: false }));
  g.add(L.box(4.2, 2.2, 2.1, L.MAT.flat('#e8e2d4'), { x: -1.6, y: 1.4 }));  // box
  const wheels = [];
  [[2.0, 0.95], [2.0, -0.95], [-1.5, 0.95], [-1.5, -0.95], [-2.8, 0.95], [-2.8, -0.95]].forEach(([wx, wz]) => {
    const tire = L.cyl(0.45, 0.45, 0.34, 14, L.MAT.rubber, { x: wx, y: 0.45, z: wz }); tire.rotation.x = Math.PI / 2; g.add(tire); wheels.push(tire);
  });
  g.userData.wheels = wheels;
  return g;
}

FLY.props = { makeLamp, makeBench, makeBin, makePlanter, makeHydrant, makeTree, makeUtilPole, makeBollard, makeFountain, makeMarketStall, makeCafe, makeCar, makeScooter, makeTruck };
})();
