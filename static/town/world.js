/* ════════════════════════════════════════════════════════════════════════
   THE FLY — town/world.js
   The HAND-AUTHORED layout. Builds ground / streets / a town square, places a
   designed list of named shops, props, parked + moving traffic, and NPCs.
   Returns { addresses, update(dt,now), bounds, spawn }.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';

/* layout constants (≈ meters) */
const AVX = 124;        // avenue half-length (x: -AVX..AVX)
const SW = 8;           // half road width (z)
const SDW = 6;          // sidewalk depth
const CH = 0.25;        // curb / sidewalk height
const ROWZ = 19;        // building row centerline (z = ±ROWZ)
const PLAZA_HALF = 18;  // plaza spans x ∈ [-18,18] on the +Z side
const PARK_CX = -74;    // park center x on the -Z side
const PARK_HALF = 20;   // park spans x ∈ [PARK_CX±PARK_HALF] on the -Z side

/* the designed shop roster — identity authored by hand */
const ROSTER = [
  // name, wall, archetype, floors, signColor, awning(pair|null), extras
  ['CAFÉ MOTT',    '#c9824a', 'cafe',      4, '#8b3528', ['#c44a44', '#f4ecd8'], ['balcony']],
  ['LIBRERÍA',     '#8fa8c0', 'shop',      3, '#2f5878', ['#2f6f8e', '#e8f0f8'], ['neon']],
  ['FLORERÍA',     '#d5b87a', 'shop',      2, '#4a7a40', ['#4a8a42', '#f4f0e0'], ['posters']],
  ['PANADERÍA',    '#c49080', 'shop',      2, '#8a4a28', ['#c87a3a', '#f4ecd8'], []],
  ['RELOJERÍA',    '#a0b898', 'apartment', 5, '#283858', ['#3a5d92', '#f4ecd8'], ['balcony']],
  ['TABACOS',      '#c8c09a', 'townhouse', 3, '#5a3820', null,                   ['posters']],
  ['BOTÁNICA',     '#b880a8', 'shop',      4, '#5a2870', ['#8a3898', '#f4ecd8'], ['neon']],
  ['PESCADERÍA',   '#9aa8c8', 'shop',      2, '#28404a', ['#2a5568', '#e0e8f0'], []],
  ['EL BUZÓN',     '#d4a060', 'civic',     4, '#7a4018', ['#b85828', '#f4ecd8'], ['balcony']],
  ['SASTRE',       '#a0c890', 'townhouse', 2, '#284828', null,                   []],
  ['FERRETERÍA',   '#c09070', 'shop',      3, '#4a3818', ['#8a5830', '#f0e8d0'], []],
  ['HELADOS',      '#88a0c0', 'shop',      2, '#c04040', ['#e04848', '#f0f0f0'], ['neon']],
  ['SASTRERÍA',    '#cfa870', 'apartment', 5, '#3a2818', ['#7a5028', '#f4ecd8'], ['balcony']],
  ['BARBERÍA',     '#9abcc4', 'shop',      3, '#1a3848', ['#2858a8', '#e8f0f8'], ['neon']],
  ['BODEGA',       '#c49068', 'townhouse', 3, '#4a3018', ['#8a5830', '#f0e0c0'], ['posters']],
  ['FARMACIA',     '#a8b8a0', 'shop',      2, '#286848', ['#2a8858', '#eef8ef'], []],
  ['GALERÍA',      '#d4b890', 'civic',     5, '#382848', ['#6838a8', '#f8f0f8'], ['balcony']],
  ['CARNICERÍA',   '#b8a0c4', 'shop',      3, '#6a2828', ['#b03838', '#f4ecd8'], []],
  ['PAPELERÍA',    '#d8c880', 'shop',      4, '#28404a', ['#3a5878', '#f4ecd8'], ['neon']],
  ['ÓPTICA',       '#c0a080', 'apartment', 3, '#284858', ['#3a78b8', '#e8f0f8'], ['balcony']],
  ['VERDURERÍA',   '#a8c8a8', 'shop',      2, '#305038', ['#4a8050', '#eef4ee'], ['posters']],
  ['PELUQUERÍA',   '#c8a0b0', 'shop',      4, '#682040', ['#b03870', '#f8eef4'], []],
  ['BAZAR',        '#a0b0c8', 'townhouse', 2, '#3a2858', null,                   ['posters']],
  ['TINTORERÍA',   '#d0a878', 'shop',      4, '#50280a', ['#9a4818', '#f4ecd8'], ['neon']],
  ['ZAPATERÍA',    '#b89a78', 'shop',      3, '#3a2a1a', ['#7a5a30', '#f0e8d0'], []],
  ['JOYERÍA',      '#9ab0c8', 'civic',     4, '#1a2a48', ['#2a4a88', '#e8eef8'], ['balcony']],
  ['MÚSICA',       '#caa0b8', 'shop',      3, '#3a1a48', ['#7a2a98', '#f4ecf8'], ['neon']],
  ['JUGUETES',     '#e0b870', 'shop',      2, '#c05020', ['#e87838', '#fff0e0'], ['posters']],
  ['EL FARO',      '#90b0b8', 'apartment', 5, '#1a4858', ['#2a7898', '#e8f4f8'], ['balcony']],
  ['MERCADO',      '#cbb488', 'civic',     3, '#4a3a1a', ['#8a6a28', '#f4ecd8'], []],
  ['VINOS',        '#a87858', 'townhouse', 3, '#3a1818', null,                   ['posters']],
  ['CERÁMICA',     '#c8a888', 'shop',      2, '#6a3a1a', ['#a85a28', '#f4ecd8'], []],
];

/* civic anchors that frame the plaza */
const PLAZA_SPECS = [
  ['AYUNTAMIENTO', '#d8c8a0', 'civic', 4, '#3a2a48', null, ['balcony']],
  ['TEATRO MOTT',  '#c0a8c8', 'civic', 5, '#2a1838', ['#5a2878', '#f4ecf8'], ['balcony']],
  ['BIBLIOTECA',   '#a8c0b0', 'civic', 4, '#1a3a2a', null, ['balcony']],
];

function build(ctx) {
  const { scene, root, lib } = ctx;
  const L = lib, T = L.T, TAU = L.TAU;
  const B = FLY.buildings, P = FLY.props, C = FLY.characters;
  L.setSeed(20240617);

  const addresses = [];
  const npcs = [];
  const cars = [];
  const fountains = [];

  /* ── GROUND ── */
  const base = new T.Mesh(new T.PlaneGeometry(660, 660), L.std({ map: L.dirtTex(), roughness: 1 }));
  base.rotation.x = -Math.PI / 2; base.position.y = -0.05; base.receiveShadow = true; root.add(base);

  // main avenue asphalt
  const road = new T.Mesh(new T.PlaneGeometry(AVX * 2, SW * 2), L.std({ map: L.roadTex(), roughness: 0.94 }));
  road.rotation.x = -Math.PI / 2; road.receiveShadow = true; root.add(road);

  // lane dashes + edge lines
  const dashMat = L.std({ color: 0xd4c890, roughness: 0.8 });
  for (let x = -AVX + 3; x < AVX; x += 4.2) root.add(L.decal(2.2, 0.18, dashMat, 0.012).translateX(x));
  const edgeMat = L.std({ color: 0xd8d0a0, roughness: 0.8 });
  [-SW + 0.5, SW - 0.5].forEach(z => { const e = L.decal(AVX * 2, 0.14, edgeMat, 0.013); e.position.z = z; root.add(e); });
  // crossings
  [-58, 58].forEach(cx0 => { for (let i = 0; i < 9; i++) { const s = L.decal(0.6, SW * 2 - 0.8, L.std({ color: 0xe8e0ca, roughness: 0.88 }), 0.016); s.position.set(cx0 + i * 1.1, 0.016, 0); root.add(s); } });

  // sidewalks + curbs + tile joints
  const swMat = L.std({ map: L.sidewalkTex(), roughness: 0.96 });
  const curbMat = L.std({ color: 0xcac4b4, roughness: 0.9 });
  [1, -1].forEach(side => {
    const z0 = side * (SW + SDW / 2);
    const sw = L.box(AVX * 2, CH, SDW, swMat, { y: CH / 2, z: z0, receive: true }); root.add(sw);
    const curb = L.box(AVX * 2, CH + 0.06, 0.2, curbMat, { y: (CH + 0.06) / 2, z: side * (SW + 0.1) }); root.add(curb);
    const jMat = L.std({ color: 0x908880, roughness: 0.96 });
    for (let x = -AVX + 2.5; x < AVX; x += 2.5) { const j = L.decal(0.06, SDW - 0.3, jMat, CH + 0.01); j.position.set(x, CH + 0.01, z0); root.add(j); }
  });

  /* ── PLAZA (town square on the +Z side, center) ── */
  const plazaTileTex = (() => {
    const c = L.cnv(128, 128), g = c.getContext('2d');
    g.fillStyle = '#cabfa6'; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 2;
    for (let i = 0; i <= 128; i += 21) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke(); }
    L.grain(g, 128, 128, 700, 0.05);
    return L.finishTex(c, { repeat: [8, 6], aniso: 8 });
  })();
  const plaza = L.box(PLAZA_HALF * 2, CH, (ROWZ + 7) - SW, L.std({ map: plazaTileTex, roughness: 0.95 }), { y: CH / 2, z: (SW + ROWZ + 7) / 2, receive: true });
  root.add(plaza);
  // fountain centerpiece
  const fountain = P.makeFountain(); fountain.position.set(0, CH, SW + 6); root.add(fountain);
  if (fountain.userData.water) fountains.push(fountain);
  // benches ringing the fountain + trees + cafés + stalls
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; const b = P.makeBench(); b.position.set(Math.cos(a) * 6, CH, SW + 6 + Math.sin(a) * 6); b.rotation.y = -a + Math.PI / 2; root.add(b); }
  [[-13, 1], [13, 1]].forEach(([x, s]) => { const cf = P.makeCafe(); cf.position.set(x, CH, SW + 4); root.add(cf); });
  [[-9, 0], [9, 0], [0, 1]].forEach(([dx, dz]) => { const st = P.makeMarketStall(); st.position.set(dx, CH, SW + 11 + dz * 2); st.rotation.y = Math.PI; root.add(st); });
  [[-15, SW + 12], [15, SW + 12], [-7, SW + 13], [7, SW + 13]].forEach(([x, z]) => { const tr = P.makeTree({ big: true }); tr.position.set(x, CH, z); root.add(tr); });

  /* ── BUILDING ROWS ── */
  function specToDims(spec, i) {
    const arch = spec[2];
    let w = 7, d = 8;
    if (arch === 'apartment') { w = L.rand(7.5, 9); d = L.rand(8, 9.5); }
    else if (arch === 'civic') { w = L.rand(9, 12); d = L.rand(9, 11); }
    else if (arch === 'townhouse') { w = L.rand(5.5, 7); d = L.rand(7, 8.5); }
    else if (arch === 'cafe') { w = L.rand(7, 9); d = L.rand(8, 9); }
    else { w = L.rand(6, 8.5); d = L.rand(7.5, 9); }
    return { w, d };
  }
  function placeRow(side) {
    // side +1 → buildings on +Z (front faces -Z, faceAngle=π); side -1 → -Z (faceAngle=0)
    const z = side * ROWZ;
    const faceAngle = side > 0 ? Math.PI : 0;
    const frontDir = new T.Vector3(Math.sin(faceAngle), 0, Math.cos(faceAngle));
    let x = -AVX + 5;
    let ri = (side > 0 ? 0 : 7);
    while (x < AVX - 6) {
      // leave a gap on the +Z side for the plaza, and on the -Z side for the park
      if (side > 0 && x > -PLAZA_HALF - 4 && x < PLAZA_HALF + 4) { x = PLAZA_HALF + 4; continue; }
      if (side < 0 && x > PARK_CX - PARK_HALF - 2 && x < PARK_CX + PARK_HALF + 2) { x = PARK_CX + PARK_HALF + 2; continue; }
      const spec = ROSTER[ri % ROSTER.length]; ri++;
      const { w, d } = specToDims(spec, ri);
      const cx = x + w / 2;
      const bspec = { w, d, floors: spec[3], archetype: spec[2], wall: spec[1], name: spec[0], signColor: spec[4], awning: spec[5], extras: spec[6], seed: ri * 97 + side * 13 };
      const g = B.make(bspec); g.position.set(cx, 0, z); g.rotation.y = faceAngle; root.add(g);
      const ax = cx + frontDir.x * (d / 2 + 1.6), az = z + frontDir.z * (d / 2 + 1.6);
      addresses.push({ name: spec[0], pos: new T.Vector3(ax, 2.6, az) });
      x += w + L.rand(0.5, 1.2);
    }
  }
  placeRow(1); placeRow(-1);

  // plaza civic buildings (set back, framing the square, facing -Z toward avenue)
  PLAZA_SPECS.forEach((spec, i) => {
    const { w, d } = { w: L.rand(11, 14), d: L.rand(10, 12) };
    const cx = (i - 1) * 16;
    const z = ROWZ + 9;
    const bspec = { w, d, floors: spec[3], archetype: 'civic', wall: spec[1], name: spec[0], signColor: spec[4], awning: spec[5], extras: spec[6], seed: 500 + i * 31 };
    const g = B.make(bspec); g.position.set(cx, 0, z); g.rotation.y = Math.PI; root.add(g);
    addresses.push({ name: spec[0], pos: new T.Vector3(cx, 3.0, z - d / 2 - 1.8) });
  });

  /* ── CLOCK TOWER landmark (behind the plaza, tall silhouette) ── */
  (function clockTower() {
    const tx = 0, tz = ROWZ + 22;
    const stoneA = L.std({ color: 0xe2d6b8, roughness: 0.9 });
    const stoneB = L.std({ color: 0xd2c2a0, roughness: 0.9 });
    const trim = L.std({ color: 0xbfae8a, roughness: 0.85 });
    root.add(L.box(7.5, 1.0, 7.5, stoneB, { x: tx, y: 0.5, z: tz, receive: true }));      // plinth
    root.add(L.box(6.0, 22, 6.0, stoneA, { x: tx, y: 11, z: tz }));                         // shaft
    for (let f = 1; f <= 6; f++) root.add(L.box(6.3, 0.3, 6.3, trim, { x: tx, y: 2 + f * 3, z: tz, cast: false }));  // string courses
    // clock faces on all 4 sides
    const clockTex = (() => {
      const c = L.cnv(128, 128), g = c.getContext('2d');
      g.fillStyle = '#f4eede'; g.beginPath(); g.arc(64, 64, 60, 0, TAU); g.fill();
      g.strokeStyle = '#2a2620'; g.lineWidth = 5; g.beginPath(); g.arc(64, 64, 58, 0, TAU); g.stroke();
      for (let h = 0; h < 12; h++) { const a = h / 12 * TAU; g.lineWidth = h % 3 === 0 ? 5 : 2; g.beginPath(); g.moveTo(64 + Math.cos(a) * 50, 64 + Math.sin(a) * 50); g.lineTo(64 + Math.cos(a) * 44, 64 + Math.sin(a) * 44); g.stroke(); }
      g.lineWidth = 5; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + Math.cos(-1.2) * 30, 64 + Math.sin(-1.2) * 30); g.stroke();
      g.lineWidth = 3; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + Math.cos(1.7) * 42, 64 + Math.sin(1.7) * 42); g.stroke();
      return L.finishTex(c, { aniso: 8 });
    })();
    const faceMat = L.std({ map: clockTex, roughness: 0.6 });
    const fY = 20.5, off = 3.06;
    [[0, off, 0], [0, -off, Math.PI], [off, 0, Math.PI / 2], [-off, 0, -Math.PI / 2]].forEach(([dx, dz, ry]) => {
      const face = new T.Mesh(new T.CircleGeometry(2.0, 24), faceMat); face.position.set(tx + dx, fY, tz + dz); face.rotation.y = ry; root.add(face);
    });
    // belfry + spire
    root.add(L.box(6.6, 0.5, 6.6, trim, { x: tx, y: 22.3, z: tz, cast: false }));
    root.add(L.box(5.2, 3.0, 5.2, stoneB, { x: tx, y: 24, z: tz }));                          // belfry openings level
    [[-1.4, 0], [1.4, 0], [0, -1.4], [0, 1.4]].forEach(([dx, dz]) => root.add(L.box(dx === 0 ? 1.6 : 0.2, 2.0, dz === 0 ? 1.6 : 0.2, L.MAT.glassLit, { x: tx + dx * 1.9, y: 24, z: tz + dz * 1.9, cast: false })));
    const spire = new T.Mesh(new T.ConeGeometry(4.4, 6.0, 4), L.std({ color: 0x8a5d4e, roughness: 0.85 })); spire.position.set(tx, 28.5, tz); spire.rotation.y = Math.PI / 4; spire.castShadow = true; root.add(spire);
    root.add(L.sphere(0.4, 10, L.MAT.emissive('#ffd27a', 0.8), { x: tx, y: 31.8, z: tz, cast: false }));
    addresses.push({ name: 'TORRE DEL RELOJ', pos: new T.Vector3(tx, 3.2, tz - 4.0) });
  })();

  /* ── TOWN PARK (on the -Z side, off-center) ── */
  (function buildPark() {
    const z0 = -SW, z1 = -(ROWZ + 7);          // park depth (into -Z)
    const cz = (z0 + z1) / 2;                    // park center z
    const pw = PARK_HALF * 2, pd = z0 - z1;
    // grass
    const grassTex = (() => {
      const c = L.cnv(128, 128), g = c.getContext('2d');
      g.fillStyle = '#6f9a52'; g.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 80; i++) { g.globalAlpha = L.rand(0.04, 0.1); g.fillStyle = L.chance(0.5) ? '#5c8a44' : '#80aa60'; g.beginPath(); g.arc(L.rand(0, 128), L.rand(0, 128), L.rand(4, 16), 0, TAU); g.fill(); }
      g.globalAlpha = 1; L.grain(g, 128, 128, 1200, 0.05);
      return L.finishTex(c, { repeat: [6, 6], aniso: 8 });
    })();
    const grass = L.box(pw, CH, pd, L.std({ map: grassTex, roughness: 1 }), { x: PARK_CX, y: CH / 2, z: cz, receive: true }); root.add(grass);
    // low hedge border
    const hedgeMat = L.std({ color: 0x4f7a3c, roughness: 0.96 });
    for (let x = PARK_CX - PARK_HALF; x <= PARK_CX + PARK_HALF; x += 1.4) { root.add(L.box(1.4, 0.7, 0.5, hedgeMat, { x, y: CH + 0.35, z: z0 })); root.add(L.box(1.4, 0.7, 0.5, hedgeMat, { x, y: CH + 0.35, z: z1 })); }
    for (let z = z1; z <= z0; z += 1.4) { root.add(L.box(0.5, 0.7, 1.4, hedgeMat, { x: PARK_CX - PARK_HALF, y: CH + 0.35, z })); root.add(L.box(0.5, 0.7, 1.4, hedgeMat, { x: PARK_CX + PARK_HALF, y: CH + 0.35, z })); }
    // cross paths
    const pathMat = L.std({ color: 0xc8b894, roughness: 0.95 });
    root.add(L.box(pw - 2, 0.02, 2.4, pathMat, { x: PARK_CX, y: CH + 0.02, z: cz, cast: false }));
    root.add(L.box(2.4, 0.02, pd - 2, pathMat, { x: PARK_CX, y: CH + 0.02, z: cz, cast: false }));
    // pond
    const pond = new T.Mesh(new T.CylinderGeometry(4.2, 4.2, 0.2, 28), L.std({ color: 0x3f7fb0, roughness: 0.12, metalness: 0.3, transparent: true, opacity: 0.88 }));
    pond.position.set(PARK_CX + 8, CH + 0.04, cz - 5); root.add(pond);
    root.add(L.cyl(4.6, 4.8, 0.3, 28, L.std({ color: 0xb8b09a, roughness: 0.9 }), { x: PARK_CX + 8, y: CH + 0.12, z: cz - 5 }));
    // gazebo (bandstand)
    (function gazebo() {
      const gx = PARK_CX - 8, gz = cz + 4;
      root.add(L.cyl(2.6, 2.8, 0.35, 12, L.std({ color: 0xc4bca8, roughness: 0.92 }), { x: gx, y: CH + 0.17, z: gz, receive: true }));
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; root.add(L.cyl(0.1, 0.1, 2.6, 7, L.MAT.wood('#8a6a44'), { x: gx + Math.cos(a) * 2.3, y: CH + 1.5, z: gz + Math.sin(a) * 2.3 })); }
      const roof = new T.Mesh(new T.ConeGeometry(3.1, 1.6, 12), L.std({ color: 0x8a5d4e, roughness: 0.9 })); roof.position.set(gx, CH + 3.6, gz); roof.castShadow = true; root.add(roof);
    })();
    // statue near the avenue edge
    (function statue() {
      const sx = PARK_CX + 12, sz = z0 - 3;
      root.add(L.box(1.6, 1.0, 1.6, L.std({ color: 0xb0a890, roughness: 0.9 }), { x: sx, y: CH + 0.5, z: sz }));
      root.add(L.cyl(0.5, 0.6, 0.5, 10, L.std({ color: 0x9a9078, roughness: 0.9 }), { x: sx, y: CH + 1.25, z: sz }));
      const figMat = L.std({ color: 0x8c8470, roughness: 0.85, metalness: 0.2 });
      root.add(L.cyl(0.28, 0.34, 1.4, 10, figMat, { x: sx, y: CH + 2.2, z: sz }));
      root.add(L.sphere(0.3, 12, figMat, { x: sx, y: CH + 3.1, z: sz }));
    })();
    // trees, benches, flower beds scattered on the grass
    const slots = [[-15, -3], [-12, 6], [-4, -7], [3, 5], [13, -6], [15, 4], [6, 9], [-7, -9]];
    slots.forEach(([dx, dz], i) => {
      const x = PARK_CX + dx, z = cz + dz;
      if (i % 3 === 0) { const b = P.makeBench(); b.position.set(x, CH, z); b.rotation.y = L.rand(0, TAU); root.add(b); }
      else if (i % 3 === 1) { const pl = P.makePlanter(); pl.position.set(x, CH, z); root.add(pl); }
      else { const tr = P.makeTree({ big: L.chance(0.6) }); tr.position.set(x, CH, z); root.add(tr); }
    });
    // a few park strollers
    for (let k = 0; k < 4; k++) { const n = C.makeNPC(); n.position.set(PARK_CX + L.rand(-PARK_HALF + 3, PARK_HALF - 3), CH, cz + L.rand(-pd / 2 + 3, pd / 2 - 3)); n.userData.npc = { speed: L.rand(0.4, 0.9) * (L.chance(0.5) ? 1 : -1), phase: L.rand(0, TAU), lane: n.position.z, kind: 'plaza', cx: n.position.x }; root.add(n); npcs.push(n); }
  })();

  /* ── STREET FURNITURE along sidewalks ── */
  [1, -1].forEach(side => {
    const zBase = side * (SW + 0.7);
    const SEQ = side > 0
      ? ['lamp', 'tree', 'bench', 'planter', 'lamp', 'tree', 'planter', 'bin', 'hydrant', 'lamp', 'tree', 'bollard']
      : ['lamp', 'bench', 'tree', 'planter', 'lamp', 'hydrant', 'tree', 'bench', 'lamp', 'planter', 'tree', 'bollard'];
    let x = -AVX + 6, idx = 0;
    while (x < AVX - 6) {
      if (side > 0 && x > -PLAZA_HALF - 2 && x < PLAZA_HALF + 2) { x = PLAZA_HALF + 2; idx++; continue; }
      if (side < 0 && x > PARK_CX - PARK_HALF && x < PARK_CX + PARK_HALF) { x = PARK_CX + PARK_HALF; idx++; continue; }
      const type = SEQ[idx % SEQ.length]; idx++;
      let obj;
      switch (type) {
        case 'lamp': obj = P.makeLamp(); break;
        case 'bench': obj = P.makeBench(); break;
        case 'bin': obj = P.makeBin(); break;
        case 'planter': obj = P.makePlanter(); break;
        case 'hydrant': obj = P.makeHydrant(); break;
        case 'bollard': obj = P.makeBollard(); break;
        default: obj = P.makeTree(); break;
      }
      obj.position.set(x, CH, zBase); if (side < 0) obj.rotation.y = Math.PI; root.add(obj);
      x += L.rand(5.5, 8.5);
    }
    // utility poles
    [-90, -30, 30, 90].forEach(px => { const up = P.makeUtilPole(); up.position.set(px, 0, side * (SW + SDW - 0.6)); root.add(up); });
  });

  /* ── PARKED CARS along curbs ── */
  for (let x = -AVX + 12; x < AVX - 12; x += L.rand(13, 20)) {
    if (Math.abs(x) < PLAZA_HALF + 6) continue;
    const side = L.chance(0.5) ? 1 : -1;
    const car = (L.chance(0.18) ? P.makeTruck() : P.makeCar());
    car.position.set(x, 0, side * (SW - 1.5));
    car.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2; // align length with street
    root.add(car);
  }
  // a couple scooters near the plaza
  [[-PLAZA_HALF - 8, 1], [PLAZA_HALF + 8, -1]].forEach(([x, s]) => { const sc = P.makeScooter(); sc.position.set(x, CH, s * (SW + 1.6)); sc.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2; root.add(sc); });

  /* ── MOVING TRAFFIC ── */
  for (let i = 0; i < 8; i++) {
    const dir = i % 2 ? 1 : -1;             // +X or -X
    const lane = dir > 0 ? -SW * 0.45 : SW * 0.45;  // drive-on-right
    const car = (L.chance(0.2) ? P.makeTruck() : P.makeCar());
    car.position.set(L.rand(-AVX + 10, AVX - 10), 0, lane);
    car.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    car.userData.drive = { dir, speed: L.rand(7, 12) };
    root.add(car); cars.push(car);
  }

  /* ── NPCS ── */
  function spawnNPC(x, z, sideForFacing) {
    const n = C.makeNPC();
    n.position.set(x, CH, z);
    n.userData.npc = { speed: L.rand(0.9, 1.7) * (L.chance(0.5) ? 1 : -1), phase: L.rand(0, TAU), lane: z, kind: 'street' };
    root.add(n); npcs.push(n);
  }
  [1, -1].forEach(side => { for (let k = 0; k < 9; k++) spawnNPC(L.rand(-AVX + 8, AVX - 8), side * (SW + L.rand(1.6, SDW - 1.2))); });
  // plaza strollers
  for (let k = 0; k < 6; k++) { const n = C.makeNPC(); n.position.set(L.rand(-PLAZA_HALF + 2, PLAZA_HALF - 2), CH, SW + L.rand(2, 13)); n.userData.npc = { speed: L.rand(0.5, 1.1) * (L.chance(0.5) ? 1 : -1), phase: L.rand(0, TAU), lane: n.position.z, kind: 'plaza', cx: n.position.x }; root.add(n); npcs.push(n); }

  /* ── STRING LIGHTS across the avenue (cozy festoon) ── */
  function stringLights(x0) {
    const S = ROWZ - 4, H = 7.6, sag = 2.4, N = 14;
    const bulbHex = L.pick(['#ffd27a', '#ff9a6a', '#aee0ff', '#ffe070', '#ffb0c0']);
    const bulbMat = L.MAT.emissive(bulbHex, 1.3);
    const cordMat = L.MAT.flat('#2a2620');
    let prev = null;
    for (let i = 0; i <= N; i++) {
      const t = i / N, z = -S + 2 * S * t, y = H - 4 * sag * t * (1 - t);
      if (i % 2 === 0) root.add(L.sphere(0.12, 8, bulbMat, { x: x0, y, z, cast: false }));
      if (prev) {
        const dy = y - prev.y, dz = z - prev.z, len = Math.hypot(dy, dz);
        const seg = L.box(0.025, 0.025, len, cordMat, { x: x0, y: (y + prev.y) / 2, z: (z + prev.z) / 2, cast: false });
        seg.rotation.x = -Math.atan2(dy, dz); root.add(seg);
      }
      prev = { y, z };
    }
  }
  for (let x = -AVX + 20; x < AVX - 20; x += 22) {
    if (Math.abs(x) < PLAZA_HALF + 6) continue;
    if (x > PARK_CX - PARK_HALF - 6 && x < PARK_CX + PARK_HALF + 6) continue;
    stringLights(x);
  }

  /* ── HANGING BANNERS over the street ── */
  [[-44, '#c44a44', '#f4ecd8'], [44, '#2f7060', '#f4ecd8'], [96, '#3a5d92', '#f4ecd8']].forEach(([x, a, b]) => {
    const ban = L.box((ROWZ - 6) * 2, 1.1, 0.06, L.MAT.fabric(a, b, 6), { x, y: 8.2, z: 0, cast: false });
    ban.rotation.y = Math.PI / 2; root.add(ban);
    root.add(L.box(0.08, 0.08, (ROWZ - 6) * 2, L.MAT.flat('#2a2620'), { x, y: 8.8, z: 0, cast: false }));
  });

  /* ── AMBIENT LIFE: pigeons, dogs, circling birds ── */
  const birds = [];
  if (C.makePigeon) {
    for (let k = 0; k < 14; k++) {
      const pg = C.makePigeon();
      const onPlaza = L.chance(0.4);
      pg.position.set(onPlaza ? L.rand(-PLAZA_HALF, PLAZA_HALF) : L.rand(-AVX + 10, AVX - 10), CH + 0.02, onPlaza ? SW + L.rand(2, 12) : L.pick([1, -1]) * (SW + L.rand(1.5, SDW - 1)));
      pg.rotation.y = L.rand(0, TAU); root.add(pg);
    }
  }
  if (C.makeDog) {
    [[-30, 1], [40, -1]].forEach(([x, s]) => { const d = C.makeDog(); d.position.set(x, CH, s * (SW + 2.2)); d.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2; root.add(d); });
  }
  // simple circling birds high up
  const birdMat = L.MAT.flat('#3a3540');
  for (let k = 0; k < 7; k++) {
    const bd = new T.Group();
    const wl = L.box(0.5, 0.04, 0.18, birdMat, { x: -0.3, cast: false });
    const wr = L.box(0.5, 0.04, 0.18, birdMat, { x: 0.3, cast: false });
    bd.add(wl, wr); bd.add(L.box(0.18, 0.08, 0.4, birdMat, { cast: false }));
    bd.userData = { cx: L.rand(-60, 60), cz: L.rand(-10, 20), r: L.rand(14, 30), a: L.rand(0, TAU), sp: L.rand(0.2, 0.45), yy: L.rand(22, 34), wl, wr };
    root.add(bd); birds.push(bd);
  }

  /* ── UPDATE ── */
  const bounds = { minX: -AVX + 4, maxX: AVX - 4, minZ: -(ROWZ + 11), maxZ: ROWZ + 13, minY: 2.2, maxY: 42 };
  const spawn = new T.Vector3(0, 9, -4);

  function update(dt, now) {
    const t = now * 0.004;
    // NPCs
    for (const n of npcs) {
      const u = n.userData.npc;
      n.position.x += u.speed * dt;
      const lim = u.kind === 'plaza' ? PLAZA_HALF - 2 : AVX - 7;
      const cen = u.kind === 'plaza' ? (u.cx || 0) : 0;
      if (n.position.x > (u.kind === 'plaza' ? cen + 8 : lim)) u.speed = -Math.abs(u.speed);
      if (n.position.x < (u.kind === 'plaza' ? cen - 8 : -lim)) u.speed = Math.abs(u.speed);
      n.rotation.y = u.speed > 0 ? Math.PI / 2 : -Math.PI / 2;
      C.animateWalk(n, t * 3 + u.phase, true);
      n.position.y = CH + Math.abs(Math.sin((t * 3 + u.phase))) * 0.03;
    }
    // traffic
    for (const car of cars) {
      const d = car.userData.drive;
      car.position.x += d.dir * d.speed * dt;
      if (d.dir > 0 && car.position.x > AVX - 8) car.position.x = -AVX + 8;
      if (d.dir < 0 && car.position.x < -AVX + 8) car.position.x = AVX - 8;
      if (car.userData.wheels) car.userData.wheels.forEach(w => w.rotation.y += d.speed * dt * 1.5);
    }
    // fountain water shimmer
    for (const f of fountains) f.userData.water.forEach((w, i) => { w.position.y += Math.sin(now * 0.005 + i) * 0.0006; });
    // circling birds
    for (const bd of birds) {
      const u = bd.userData; u.a += u.sp * dt;
      bd.position.set(u.cx + Math.cos(u.a) * u.r, u.yy + Math.sin(now * 0.001 + u.cx) * 1.2, u.cz + Math.sin(u.a) * u.r);
      bd.rotation.y = -u.a + Math.PI / 2;
      const flap = Math.sin(now * 0.02 + u.cx) * 0.5;
      u.wl.rotation.z = flap; u.wr.rotation.z = -flap;
    }
  }

  return { addresses, update, bounds, spawn };
}

FLY.world = { build };
})();
