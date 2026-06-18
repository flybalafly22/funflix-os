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
      // leave a gap on the +Z side for the plaza
      if (side > 0 && x > -PLAZA_HALF - 4 && x < PLAZA_HALF + 4) { x = PLAZA_HALF + 4; continue; }
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

  /* ── STREET FURNITURE along sidewalks ── */
  [1, -1].forEach(side => {
    const zBase = side * (SW + 0.7);
    const SEQ = side > 0
      ? ['lamp', 'tree', 'bench', 'planter', 'lamp', 'tree', 'planter', 'bin', 'hydrant', 'lamp', 'tree', 'bollard']
      : ['lamp', 'bench', 'tree', 'planter', 'lamp', 'hydrant', 'tree', 'bench', 'lamp', 'planter', 'tree', 'bollard'];
    let x = -AVX + 6, idx = 0;
    while (x < AVX - 6) {
      if (side > 0 && x > -PLAZA_HALF - 2 && x < PLAZA_HALF + 2) { x = PLAZA_HALF + 2; idx++; continue; }
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
  }

  return { addresses, update, bounds, spawn };
}

FLY.world = { build };
})();
