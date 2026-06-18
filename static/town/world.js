/* ════════════════════════════════════════════════════════════════════════
   THE FLY — town/world.js
   The HAND-AUTHORED layout. Builds ground / streets / a town square, places a
   designed list of named shops, props, parked + moving traffic, and NPCs.
   Returns { addresses, update(dt,now), bounds, spawn }.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';

/* layout constants (≈ meters) */
const AVX = 150;        // avenue half-length (x: -AVX..AVX)   [extended for more city]
const SW = 8;           // half road width (z)  (also half-width of the cross-street in x)
const SDW = 6;          // sidewalk depth
const CH = 0.25;        // curb / sidewalk height
const ROWZ = 19;        // building row centerline (z = ±ROWZ)
const PLAZA_HALF = 18;  // plaza spans x ∈ [-18,18] on the +Z side
const PARK_CX = -78;    // park center x on the -Z side
const PARK_HALF = 20;   // park spans x ∈ [PARK_CX±PARK_HALF] on the -Z side

/* ── CROSS-STREET (runs along Z, perpendicular to the avenue) ── */
const CROSSX = 86;            // cross-street centerline x → 4-way intersection at (CROSSX, 0)
const CROSSZ0 = -(ROWZ + 8);  // cross-street extent (z) southern end (-Z)
const CROSSZ1 = (ROWZ + 8);   // northern end (+Z)
const CROSSROWX = CROSSX - (SW + SDW + 4.5);  // west building row centerline (fronts face +X toward street)
const CROSSROWX2 = CROSSX + (SW + SDW + 4.5); // east building row centerline (fronts face -X)

/* the designed shop roster — identity authored by hand
   §2.9/§5.1 WALL AUDIT: every authored `wall` is re-snapped into the §2.2
   warm-dominant family. Cool reliefs (sage #9fb0a0 / faded-blue #9eb2bd /
   olive #aeb39a) are held to ~1-in-4 per block; greens lean to the -Z row
   (park side). signColor + awning accents are LEFT UNTOUCHED (accent budget). */
const ROSTER = [
  // name, wall, archetype, floors, signColor, awning(pair|null), extras
  ['CAFÉ MOTT',    '#cf9a6e', 'cafe',      4, '#8b3528', ['#c44a44', '#f4ecd8'], ['balcony']], // terracotta tan (market)
  ['LIBRERÍA',     '#caa074', 'shop',      3, '#2f5878', ['#2f6f8e', '#e8f0f8'], ['neon']],    // clay (was cool blue)
  ['FLORERÍA',     '#d9b07e', 'shop',      2, '#4a7a40', ['#4a8a42', '#f4f0e0'], ['posters']], // wheat
  ['PANADERÍA',    '#c99a8a', 'shop',      2, '#8a4a28', ['#c87a3a', '#f4ecd8'], []],          // rose-clay
  ['RELOJERÍA',    '#9eb2bd', 'apartment', 5, '#283858', ['#3a5d92', '#f4ecd8'], ['balcony']], // faded sky-blue relief
  ['TABACOS',      '#e3c79a', 'townhouse', 3, '#5a3820', null,                   ['posters']], // cream-ochre
  ['BOTÁNICA',     '#caa074', 'shop',      4, '#5a2870', ['#8a3898', '#f4ecd8'], ['neon']],    // clay (was mauve)
  ['PESCADERÍA',   '#9fb0a0', 'shop',      2, '#28404a', ['#2a5568', '#e0e8f0'], []],          // sage relief (was cool blue)
  ['EL BUZÓN',     '#d8a877', 'civic',     4, '#7a4018', ['#b85828', '#f4ecd8'], ['balcony']], // warm sand
  ['SASTRE',       '#9fb0a0', 'townhouse', 2, '#284828', null,                   []],          // sage relief
  ['FERRETERÍA',   '#c08a63', 'shop',      3, '#4a3818', ['#8a5830', '#f0e8d0'], []],          // burnt sienna
  ['HELADOS',      '#e3c79a', 'shop',      2, '#c04040', ['#e04848', '#f0f0f0'], ['neon']],    // cream-ochre (was cool blue)
  ['SASTRERÍA',    '#d4a890', 'apartment', 5, '#3a2818', ['#7a5028', '#f4ecd8'], ['balcony']], // faded coral
  ['BARBERÍA',     '#9eb2bd', 'shop',      3, '#1a3848', ['#2858a8', '#e8f0f8'], ['neon']],    // faded sky-blue relief
  ['BODEGA',       '#cf9a6e', 'townhouse', 3, '#4a3018', ['#8a5830', '#f0e0c0'], ['posters']], // terracotta tan
  ['FARMACIA',     '#aeb39a', 'shop',      2, '#286848', ['#2a8858', '#eef8ef'], []],          // olive-stone relief (park side)
  ['GALERÍA',      '#e0bd8c', 'civic',     5, '#382848', ['#6838a8', '#f8f0f8'], ['balcony']], // pale ochre
  ['CARNICERÍA',   '#c99a8a', 'shop',      3, '#6a2828', ['#b03838', '#f4ecd8'], []],          // rose-clay (was mauve)
  ['PAPELERÍA',    '#e3c79a', 'shop',      4, '#28404a', ['#3a5878', '#f4ecd8'], ['neon']],    // cream-ochre
  ['ÓPTICA',       '#caa074', 'apartment', 3, '#284858', ['#3a78b8', '#e8f0f8'], ['balcony']], // clay
  ['VERDURERÍA',   '#9fb0a0', 'shop',      2, '#305038', ['#4a8050', '#eef4ee'], ['posters']], // sage relief (greengrocer)
  ['PELUQUERÍA',   '#d4a890', 'shop',      4, '#682040', ['#b03870', '#f8eef4'], []],          // faded coral (was mauve)
  ['BAZAR',        '#caa074', 'townhouse', 2, '#3a2858', null,                   ['posters']], // clay (was cool blue)
  ['TINTORERÍA',   '#d9b07e', 'shop',      4, '#50280a', ['#9a4818', '#f4ecd8'], ['neon']],    // wheat
  ['ZAPATERÍA',    '#caa074', 'shop',      3, '#3a2a1a', ['#7a5a30', '#f0e8d0'], []],          // clay
  ['JOYERÍA',      '#9eb2bd', 'civic',     4, '#1a2a48', ['#2a4a88', '#e8eef8'], ['balcony']], // faded sky-blue relief
  ['MÚSICA',       '#c99a8a', 'shop',      3, '#3a1a48', ['#7a2a98', '#f4ecf8'], ['neon']],    // rose-clay (was mauve)
  ['JUGUETES',     '#e3c79a', 'shop',      2, '#c05020', ['#e87838', '#fff0e0'], ['posters']], // cream-ochre
  ['EL FARO',      '#9fb0a0', 'apartment', 5, '#1a4858', ['#2a7898', '#e8f4f8'], ['balcony']], // sage relief (park side)
  ['MERCADO',      '#d9b07e', 'civic',     3, '#4a3a1a', ['#8a6a28', '#f4ecd8'], []],          // wheat
  ['VINOS',        '#c08a63', 'townhouse', 3, '#3a1818', null,                   ['posters']], // burnt sienna
  ['CERÁMICA',     '#caa074', 'shop',      2, '#6a3a1a', ['#a85a28', '#f4ecd8'], []],          // clay
  ['CONFITERÍA',   '#e3c79a', 'shop',      2, '#a8482a', ['#d86838', '#fff0e0'], ['posters']], // cream-ochre
  ['LAVANDERÍA',   '#9eb2bd', 'shop',      3, '#2a5868', ['#3a7898', '#e8f0f8'], []],          // faded sky-blue relief
  ['FOTOGRAFÍA',   '#d4a890', 'townhouse', 2, '#28284a', null,                   ['posters']], // faded coral (was cool blue)
  ['CESTERÍA',     '#d9b07e', 'shop',      2, '#5a3a18', ['#9a6a28', '#f4ecd8'], []],          // wheat
  ['QUESERÍA',     '#e3c79a', 'shop',      2, '#6a5018', ['#a88028', '#f4ecd8'], ['posters']], // cream-ochre
  ['DROGUERÍA',    '#aeb39a', 'shop',      3, '#28583a', ['#2a8858', '#eef8ef'], ['neon']],    // olive-stone relief (park side)
];

/* the cross-street roster (fronts will face the avenue side-street)
   §5.1 CROSS-STREET zone: artisan, slightly more saturated warm but still
   capped in the §2.2 family; cool reliefs held ~1-in-4. Accents untouched. */
const CROSS_ROSTER = [
  ['LIBROS RAROS', '#caa074', 'shop',      3, '#3a2858', ['#6838a8', '#f8f0f8'], ['neon']],    // clay (was mauve)
  ['CAFÉ ESQUINA', '#cf9a6e', 'cafe',      4, '#8b3528', ['#c44a44', '#f4ecd8'], ['balcony']], // terracotta tan
  ['ARTESANÍAS',   '#d9b07e', 'shop',      2, '#6a4818', ['#a87838', '#f4ecd8'], ['posters']], // wheat
  ['SOMBRERERÍA',  '#9eb2bd', 'townhouse', 3, '#3a2858', null,                   []],          // faded sky-blue relief (was mauve)
  ['EL CORREO',    '#d8a877', 'civic',     4, '#7a4018', ['#b85828', '#f4ecd8'], ['balcony']], // warm sand
  ['ANTICUARIO',   '#9fb0a0', 'apartment', 5, '#3a4828', ['#5a7838', '#f4ecd8'], ['balcony']], // sage relief
  ['CHOCOLATERÍA', '#c08a63', 'shop',      2, '#6a3818', ['#a85838', '#fff0e0'], ['neon']],    // burnt sienna (artisan)
  ['VIDRIERÍA',    '#9eb2bd', 'shop',      3, '#1a4858', ['#2a7898', '#e8f4f8'], []],          // faded sky-blue relief (was cool)
  ['EL MERCADILLO','#d9b07e', 'civic',     3, '#4a3a1a', ['#8a6a28', '#f4ecd8'], []],          // wheat
  ['PERFUMERÍA',   '#d4a890', 'shop',      4, '#682050', ['#b03888', '#f8eef8'], ['neon']],    // faded coral (was mauve)
  ['CARPINTERÍA',  '#caa074', 'townhouse', 2, '#4a3018', null,                   ['posters']], // clay
  ['MARISQUERÍA',  '#9eb2bd', 'shop',      2, '#284a58', ['#2a6888', '#e8f0f8'], []],          // faded sky-blue relief (was cool)
  ['TEJIDOS',      '#c99a8a', 'apartment', 4, '#5a2838', ['#a04868', '#f8eef0'], ['balcony']], // rose-clay
  ['EL ESTANCO',   '#e3c79a', 'townhouse', 3, '#5a3820', null,                   ['posters']], // cream-ochre
];

/* extra civic landmarks that anchor the cross-street / far blocks
   §5.1 CIVIC SPINE: cooler & paler stone-cream walls (restrained, gravitas). */
const LANDMARK_SPECS = [
  ['ESTACIÓN',     '#e3c79a', 'civic', 4, '#3a3018', null, []],                              // stone-cream (paler civic)
  ['CONSERVATORIO','#9eb2bd', 'civic', 5, '#2a1840', ['#5a2878', '#f4ecf8'], ['balcony']],   // slate-blue relief (was mauve)
];

/* civic anchors that frame the plaza — §5.1 civic-spine stone-cream */
const PLAZA_SPECS = [
  ['AYUNTAMIENTO', '#e3c79a', 'civic', 4, '#3a2a48', null, ['balcony']],                     // stone-cream
  ['TEATRO MOTT',  '#e0bd8c', 'civic', 5, '#2a1838', ['#5a2878', '#f4ecf8'], ['balcony']],   // pale-ochre stone-cream (was mauve)
  ['BIBLIOTECA',   '#9fb0a0', 'civic', 4, '#1a3a2a', null, ['balcony']],                     // sage relief (civic)
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
  const pigeons = [];
  const dogs = [];
  // shared player handle — game.js writes player.pos each frame so townsfolk can react
  ctx.player = ctx.player || { pos: new T.Vector3(0, 9, 0) };

  /* ── GROUND ── */
  const base = new T.Mesh(new T.PlaneGeometry(760, 760), L.std({ map: L.dirtTex(), roughness: 1 }));
  base.rotation.x = -Math.PI / 2; base.position.y = -0.05; base.receiveShadow = true; root.add(base);

  const roadMat = L.std({ map: L.roadTex(), roughness: 0.94 });
  // main avenue asphalt (along X)
  const road = new T.Mesh(new T.PlaneGeometry(AVX * 2, SW * 2), roadMat);
  road.rotation.x = -Math.PI / 2; road.receiveShadow = true; root.add(road);
  // cross-street asphalt (along Z)
  const crossLen = CROSSZ1 - CROSSZ0;
  const xroad = new T.Mesh(new T.PlaneGeometry(SW * 2, crossLen), roadMat);
  xroad.rotation.x = -Math.PI / 2; xroad.position.set(CROSSX, 0.002, (CROSSZ0 + CROSSZ1) / 2); xroad.receiveShadow = true; root.add(xroad);

  // lane dashes (avenue) — skip across the intersection
  const dashMat = L.std({ color: 0xd4c890, roughness: 0.8 });
  for (let x = -AVX + 3; x < AVX; x += 4.2) { if (Math.abs(x - CROSSX) < SW + 1) continue; root.add(L.decal(2.2, 0.18, dashMat, 0.012).translateX(x)); }
  // lane dashes (cross-street) — skip across the intersection
  for (let z = CROSSZ0 + 3; z < CROSSZ1; z += 4.2) { if (Math.abs(z) < SW + 1) continue; const dd = L.decal(0.18, 2.2, dashMat, 0.012); dd.position.set(CROSSX, 0.012, z); root.add(dd); }
  const edgeMat = L.std({ color: 0xd8d0a0, roughness: 0.8 });
  [-SW + 0.5, SW - 0.5].forEach(z => { const e = L.decal(AVX * 2, 0.14, edgeMat, 0.013); e.position.z = z; root.add(e); });
  [CROSSX - SW + 0.5, CROSSX + SW - 0.5].forEach(x => { const e = L.decal(0.14, crossLen, edgeMat, 0.013); e.position.set(x, 0.013, (CROSSZ0 + CROSSZ1) / 2); root.add(e); });
  // zebra crossings — avenue (a couple of blocks) + at the four mouths of the intersection
  const zebraMat = L.std({ color: 0xe8e0ca, roughness: 0.88 });
  [-58, 40].forEach(cx0 => { for (let i = 0; i < 9; i++) { const s = L.decal(0.6, SW * 2 - 0.8, zebraMat, 0.016); s.position.set(cx0 + i * 1.1, 0.016, 0); root.add(s); } });
  // intersection crosswalks: across the avenue on the west & east mouths (stripes run along Z)
  [CROSSX - SW - 2.6, CROSSX + SW + 0.6].forEach(x0 => { for (let i = 0; i < 8; i++) { const s = L.decal(0.6, SW * 2 - 0.8, zebraMat, 0.016); s.position.set(x0 + i * 0.55, 0.016, 0); root.add(s); } });
  // across the cross-street on the north & south mouths (stripes run along X)
  [SW + 0.6, -(SW + 2.6)].forEach(z0 => { for (let i = 0; i < 8; i++) { const s = L.decal(SW * 2 - 0.8, 0.6, zebraMat, 0.016); s.position.set(CROSSX, 0.016, z0 + i * 0.55); root.add(s); } });

  // sidewalks + curbs + tile joints
  const swMat = L.std({ map: L.sidewalkTex(), roughness: 0.96 });
  const curbMat = L.std({ color: 0xcac4b4, roughness: 0.9 });
  const jMat = L.std({ color: 0x908880, roughness: 0.96 });
  // avenue sidewalks (along X) — split into segments so they don't pave over the cross-street
  [1, -1].forEach(side => {
    const z0 = side * (SW + SDW / 2);
    // west segment: from -AVX to the cross-street's west sidewalk edge
    const wL = (CROSSX - SW - SDW) - (-AVX), wcx = (-AVX + (CROSSX - SW - SDW)) / 2;
    root.add(L.box(wL, CH, SDW, swMat, { x: wcx, y: CH / 2, z: z0, receive: true }));
    // east segment: from cross-street's east sidewalk edge to +AVX
    const eL = AVX - (CROSSX + SW + SDW), ecx = ((CROSSX + SW + SDW) + AVX) / 2;
    root.add(L.box(eL, CH, SDW, swMat, { x: ecx, y: CH / 2, z: z0, receive: true }));
    // curbs (continuous look but broken at the junction)
    root.add(L.box(wL, CH + 0.06, 0.2, curbMat, { x: wcx, y: (CH + 0.06) / 2, z: side * (SW + 0.1) }));
    root.add(L.box(eL, CH + 0.06, 0.2, curbMat, { x: ecx, y: (CH + 0.06) / 2, z: side * (SW + 0.1) }));
    for (let x = -AVX + 2.5; x < AVX; x += 2.5) { if (Math.abs(x - CROSSX) < SW + SDW) continue; const j = L.decal(0.06, SDW - 0.3, jMat, CH + 0.01); j.position.set(x, CH + 0.01, z0); root.add(j); }
  });
  // cross-street sidewalks (along Z) on each side
  [1, -1].forEach(side => {
    const x0 = CROSSX + side * (SW + SDW / 2);
    // north segment (+Z) and south segment (-Z), broken at the avenue
    const nL = CROSSZ1 - (SW + SDW), ncz = ((SW + SDW) + CROSSZ1) / 2;
    const sL = (CROSSZ0) - (-(SW + SDW)), scz = (CROSSZ0 + (-(SW + SDW))) / 2;
    root.add(L.box(SDW, CH, nL, swMat, { x: x0, y: CH / 2, z: ncz, receive: true }));
    root.add(L.box(SDW, CH, Math.abs(sL), swMat, { x: x0, y: CH / 2, z: scz, receive: true }));
    root.add(L.box(0.2, CH + 0.06, nL, curbMat, { x: CROSSX + side * (SW + 0.1), y: (CH + 0.06) / 2, z: ncz }));
    root.add(L.box(0.2, CH + 0.06, Math.abs(sL), curbMat, { x: CROSSX + side * (SW + 0.1), y: (CH + 0.06) / 2, z: scz }));
    for (let z = CROSSZ0 + 2.5; z < CROSSZ1; z += 2.5) { if (Math.abs(z) < SW + SDW) continue; const j = L.decal(SDW - 0.3, 0.06, jMat, CH + 0.01); j.position.set(x0, CH + 0.01, z); root.add(j); }
  });
  // corner sidewalk pads filling the four quadrants of the intersection
  [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {
    root.add(L.box(SDW, CH, SDW, swMat, { x: CROSSX + sx * (SW + SDW / 2), y: CH / 2, z: sz * (SW + SDW / 2), receive: true }));
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
  // §5.3 focal-heart density bump: planters & lamps ring the founter plaza (densest here)
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + 0.4; const pl = P.makePlanter(); pl.position.set(Math.cos(a) * 9.5, CH, SW + 6 + Math.sin(a) * 9.5); root.add(pl); }
  [[-11, SW + 2], [11, SW + 2], [-11, SW + 10], [11, SW + 10]].forEach(([x, z]) => { const lp = P.makeLamp(); lp.position.set(x, CH, z); root.add(lp); });

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
  // the cross-street corridor (avenue buildings must leave a gap for it to pass through)
  const XGAP = SW + SDW + 1.5;             // half-width of the corridor to keep clear around CROSSX
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
      // leave the cross-street corridor clear (the corner buildings sit on the cross-street rows)
      if (x > CROSSX - XGAP && x < CROSSX + XGAP) { x = CROSSX + XGAP; continue; }
      const spec = ROSTER[ri % ROSTER.length]; ri++;
      const { w, d } = specToDims(spec, ri);
      // don't let a building straddle into the corridor
      if (x < CROSSX - XGAP && x + w > CROSSX - XGAP) { x = CROSSX + XGAP; ri--; continue; }
      const cx = x + w / 2;
      const bspec = { w, d, floors: spec[3], archetype: spec[2], wall: spec[1], name: spec[0], signColor: spec[4], awning: spec[5], extras: spec[6], seed: ri * 97 + side * 13 };
      const g = B.make(bspec); g.position.set(cx, 0, z); g.rotation.y = faceAngle; root.add(g);
      const ax = cx + frontDir.x * (d / 2 + 1.6), az = z + frontDir.z * (d / 2 + 1.6);
      addresses.push({ name: spec[0], pos: new T.Vector3(ax, 2.6, az) });
      x += w + L.rand(0.5, 1.2);
    }
  }
  placeRow(1); placeRow(-1);

  /* ── CROSS-STREET BUILDING ROWS (run along Z; fronts face the cross-street) ── */
  function placeCrossRow(side) {
    // side -1 → west row at CROSSROWX (front faces +X, faceAngle=π/2)
    // side +1 → east row at CROSSROWX2 (front faces -X, faceAngle=-π/2)
    const rowX = side < 0 ? CROSSROWX : CROSSROWX2;
    const faceAngle = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    const frontDir = new T.Vector3(Math.sin(faceAngle), 0, Math.cos(faceAngle));
    let z = CROSSZ0 + 4;
    let ri = side < 0 ? 0 : 7;
    while (z < CROSSZ1 - 4) {
      // keep the avenue corridor (z near 0) clear so the streets connect cleanly
      if (z > -(SW + SDW + 1.5) && z < (SW + SDW + 1.5)) { z = (SW + SDW + 1.5); continue; }
      const spec = CROSS_ROSTER[ri % CROSS_ROSTER.length]; ri++;
      const { w, d } = specToDims(spec, ri);   // w runs along Z here, d is depth into the block
      if (z < -(SW + SDW + 1.5) && z + w > -(SW + SDW + 1.5)) { z = (SW + SDW + 1.5); ri--; continue; }
      const cz = z + w / 2;
      const bspec = { w, d, floors: spec[3], archetype: spec[2], wall: spec[1], name: spec[0], signColor: spec[4], awning: spec[5], extras: spec[6], seed: ri * 89 + side * 23 + 700 };
      const g = B.make(bspec); g.position.set(rowX, 0, cz); g.rotation.y = faceAngle; root.add(g);
      const ax = rowX + frontDir.x * (d / 2 + 1.6), az = cz + frontDir.z * (d / 2 + 1.6);
      addresses.push({ name: spec[0], pos: new T.Vector3(ax, 2.6, az) });
      z += w + L.rand(0.5, 1.2);
    }
  }
  placeCrossRow(-1); placeCrossRow(1);

  // CORNER buildings framing the 4-way intersection (taller, face the diagonal)
  [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz], i) => {
    const w = L.rand(9, 11), d = L.rand(9, 11);
    const cx = CROSSX + sx * (SW + SDW + 1.0 + w / 2);
    const cz = sz * (SW + SDW + 1.0 + d / 2);
    // face toward the avenue (front along -sz Z) so signage reads from the street
    const faceAngle = sz > 0 ? Math.PI : 0;
    const spec = LANDMARK_SPECS[i % LANDMARK_SPECS.length] || ['PLAZA MAYOR', '#cbb488', 'civic', 4, '#4a3a1a', null, ['balcony']];
    const nm = ['CORREO CENTRAL', 'BANCO MOTT', 'GRAN HOTEL', 'TEATRO ESQUINA'][i];
    const bspec = { w, d, floors: L.randInt(4, 5), archetype: 'civic', wall: spec[1], name: nm, signColor: spec[4], awning: spec[5], extras: ['balcony'], seed: 900 + i * 41 };
    const g = B.make(bspec); g.position.set(cx, 0, cz); g.rotation.y = faceAngle; root.add(g);
    const fd = new T.Vector3(Math.sin(faceAngle), 0, Math.cos(faceAngle));
    addresses.push({ name: nm, pos: new T.Vector3(cx + fd.x * (d / 2 + 1.8), 3.0, cz + fd.z * (d / 2 + 1.8)) });
  });

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
    // §5.2 beacon: warm cream stone that CATCHES THE SUN (matte, lifted toward
    // the §2.4 cream family so the shaft glows on the sun-side at golden hour).
    const stoneA = L.std({ color: 0xeadbb6, roughness: 0.9 });   // sunlit cream stone
    const stoneB = L.std({ color: 0xdcc8a0, roughness: 0.9 });   // shaded cream stone
    const trim = L.std({ color: 0xc6b48c, roughness: 0.85 });
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
    const spire = new T.Mesh(new T.ConeGeometry(4.4, 6.0, 4), L.std({ color: 0x6f7d68, roughness: 0.85 })); spire.position.set(tx, 28.5, tz); spire.rotation.y = Math.PI / 4; spire.castShadow = true; root.add(spire);  // §5.1 civic slate-green roof
    // §5.2 finial beacon: warm-gold glow (hero) + a faint halo sphere so it
    // reads as a beacon from down the avenue. Kept low-intensity per §4.10.
    root.add(L.sphere(0.4, 10, L.MAT.emissive('#ffd27a', 0.95), { x: tx, y: 31.8, z: tz, cast: false }));
    root.add(L.sphere(0.7, 10, L.MAT.emissive('#ffe0a0', 0.28), { x: tx, y: 31.8, z: tz, cast: false }));
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

  function makeFurniture(type) {
    switch (type) {
      case 'lamp': return P.makeLamp();
      case 'bench': return P.makeBench();
      case 'bin': return P.makeBin();
      case 'planter': return P.makePlanter();
      case 'hydrant': return P.makeHydrant();
      case 'bollard': return P.makeBollard();
      default: return P.makeTree();
    }
  }
  /* ── DENSITY GRADIENT (§5.3) ──
     The plaza (avenue x≈0) and the 4-way intersection (x=CROSSX) are the focal
     hearts: props cluster tightest there and thin toward the avenue ends/park.
     Returns a 0..1 "near-focus" weight from the nearer of the two focal points. */
  function focusW(x) {
    const dPlaza = Math.abs(x), dCross = Math.abs(x - CROSSX);
    const d = Math.min(dPlaza, dCross);
    return L.clamp(1 - d / 95, 0, 1);            // 1 at a heart → ~0 at the ends
  }
  // spacing step: keep the existing jitter, but scale it wider as we leave a heart.
  function densStep(x, lo, hi) { return L.rand(lo, hi) * (1.0 + 0.85 * (1 - focusW(x))); }

  /* ── STREET FURNITURE along the avenue sidewalks ── */
  [1, -1].forEach(side => {
    const zBase = side * (SW + 0.7);
    const SEQ = side > 0
      ? ['lamp', 'tree', 'bench', 'planter', 'lamp', 'tree', 'planter', 'bin', 'hydrant', 'lamp', 'tree', 'bollard']
      : ['lamp', 'bench', 'tree', 'planter', 'lamp', 'hydrant', 'tree', 'bench', 'lamp', 'planter', 'tree', 'bollard'];
    let x = -AVX + 6, idx = 0;
    while (x < AVX - 6) {
      if (side > 0 && x > -PLAZA_HALF - 2 && x < PLAZA_HALF + 2) { x = PLAZA_HALF + 2; idx++; continue; }
      if (side < 0 && x > PARK_CX - PARK_HALF && x < PARK_CX + PARK_HALF) { x = PARK_CX + PARK_HALF; idx++; continue; }
      if (x > CROSSX - (SW + SDW) && x < CROSSX + (SW + SDW)) { x = CROSSX + (SW + SDW); idx++; continue; }
      const obj = makeFurniture(SEQ[idx % SEQ.length]); idx++;
      obj.position.set(x, CH, zBase); if (side < 0) obj.rotation.y = Math.PI; root.add(obj);
      x += densStep(x, 5.5, 8.5);
    }
    // utility poles
    [-120, -60, -20, 40, 120].forEach(px => { if (Math.abs(px - CROSSX) < SW + SDW) return; const up = P.makeUtilPole(); up.position.set(px, 0, side * (SW + SDW - 0.6)); root.add(up); });
  });
  /* ── STREET FURNITURE along the cross-street sidewalks ── */
  [1, -1].forEach(side => {
    const xBase = CROSSX + side * (SW + 0.7);
    const SEQ = ['lamp', 'tree', 'planter', 'bench', 'lamp', 'bin', 'tree', 'hydrant', 'lamp', 'tree', 'bollard'];
    let z = CROSSZ0 + 5, idx = side > 0 ? 0 : 4;
    while (z < CROSSZ1 - 5) {
      if (z > -(SW + SDW) && z < (SW + SDW)) { z = (SW + SDW); idx++; continue; }
      const obj = makeFurniture(SEQ[idx % SEQ.length]); idx++;
      obj.position.set(xBase, CH, z); obj.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2; root.add(obj);
      // §5.3: dense at the intersection (z≈0), thinning toward the block ends
      const cw = L.clamp(1 - Math.abs(z) / (CROSSZ1 - 4), 0, 1);
      z += L.rand(5.5, 8.0) * (1.0 + 0.7 * (1 - cw));
    }
    [CROSSZ0 + 8, -16, 16, CROSSZ1 - 8].forEach(pz => { if (Math.abs(pz) < SW + SDW) return; const up = P.makeUtilPole(); up.position.set(CROSSX + side * (SW + SDW - 0.6), 0, pz); root.add(up); });
  });

  /* ── PARKED CARS along curbs (avenue + cross-street) ── */
  for (let x = -AVX + 12; x < AVX - 12; x += L.rand(13, 20)) {
    if (Math.abs(x) < PLAZA_HALF + 6) continue;
    if (Math.abs(x - CROSSX) < SW + 4) continue;
    const side = L.chance(0.5) ? 1 : -1;
    const car = (L.chance(0.18) ? P.makeTruck() : P.makeCar());
    car.position.set(x, 0, side * (SW - 1.5));
    car.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2; // align length with street (front faces +Z by default)
    root.add(car);
  }
  for (let z = CROSSZ0 + 10; z < CROSSZ1 - 10; z += L.rand(13, 19)) {
    if (Math.abs(z) < SW + 6) continue;
    const side = L.chance(0.5) ? 1 : -1;
    const car = (L.chance(0.18) ? P.makeTruck() : P.makeCar());
    car.position.set(CROSSX + side * (SW - 1.5), 0, z);
    car.rotation.y = 0; // length lies along Z, front +Z — no rotation needed
    root.add(car);
  }
  // a couple scooters near the plaza & corner
  [[-PLAZA_HALF - 8, 1], [PLAZA_HALF + 8, -1]].forEach(([x, s]) => { const sc = P.makeScooter(); sc.position.set(x, CH, s * (SW + 1.6)); sc.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2; root.add(sc); });

  /* ── MOVING TRAFFIC on the avenue (along X) ── */
  for (let i = 0; i < 10; i++) {
    const dir = i % 2 ? 1 : -1;             // +X or -X
    const lane = dir > 0 ? -SW * 0.45 : SW * 0.45;  // drive-on-right
    const car = (L.chance(0.2) ? P.makeTruck() : P.makeCar());
    car.position.set(L.rand(-AVX + 10, AVX - 10), 0, lane);
    car.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    car.userData.drive = { axis: 'x', dir, speed: L.rand(7, 12), lane };
    root.add(car); cars.push(car);
  }
  /* ── MOVING TRAFFIC on the cross-street (along Z) ── */
  for (let i = 0; i < 4; i++) {
    const dir = i % 2 ? 1 : -1;             // +Z or -Z
    const lane = dir > 0 ? SW * 0.45 : -SW * 0.45;  // drive-on-right
    const car = (L.chance(0.2) ? P.makeTruck() : P.makeCar());
    car.position.set(CROSSX + lane, 0, L.rand(CROSSZ0 + 10, CROSSZ1 - 10));
    car.rotation.y = dir > 0 ? 0 : Math.PI;  // front +Z to drive +Z; flip for -Z
    car.userData.drive = { axis: 'z', dir, speed: L.rand(6, 10), lane };
    root.add(car); cars.push(car);
  }

  /* ── TRAM on the avenue (centre track) + rails ── */
  if (P.makeTram) {
    const railMat = L.std({ color: 0x4a4640, roughness: 0.5, metalness: 0.7 });
    [-0.7, 0.7].forEach(rz => { const rail = L.decal(AVX * 2, 0.12, railMat, 0.02); rail.position.z = rz; root.add(rail); });
    // overhead wire poles down the median
    for (let x = -AVX + 16; x < AVX - 16; x += 28) {
      root.add(L.cyl(0.08, 0.1, 6.2, 7, L.MAT.metalDark, { x, y: 3.1, z: 0, cast: true }));
      root.add(L.box(0.1, 0.1, 2.2, L.MAT.metalDark, { x, y: 5.9, z: 0, cast: false }));
    }
    [1, -1].forEach(dir => {
      const tram = P.makeTram();
      tram.position.set(L.rand(-AVX + 20, AVX - 20), 0, 0);
      tram.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;   // front +Z → +X when dir>0
      tram.userData.drive = { axis: 'x', dir, speed: L.rand(8, 10), lane: 0 };
      root.add(tram); cars.push(tram);
    });
  }

  /* ── NPCS — walkers with a small state machine, plus seated folk & vendors ── */
  function spawnNPC(x, z, kind, cx) {
    const n = C.makeNPC();
    n.position.set(x, CH, z);
    const fast = kind === 'kid';
    n.userData.npc = {
      kind, lane: z, cx: cx == null ? x : cx,
      speed: L.rand(kind === 'plaza' ? 0.5 : 0.9, kind === 'plaza' ? 1.1 : (fast ? 2.4 : 1.7)) * (L.chance(0.5) ? 1 : -1),
      phase: L.rand(0, TAU),
      state: 'walk', timer: L.rand(2, 6), wave: 0,
    };
    root.add(n); npcs.push(n);
  }
  [1, -1].forEach(side => { for (let k = 0; k < 11; k++) spawnNPC(L.rand(-AVX + 8, AVX - 8), side * (SW + L.rand(1.6, SDW - 1.2)), L.chance(0.15) ? 'kid' : 'street'); });
  // plaza strollers
  for (let k = 0; k < 7; k++) spawnNPC(L.rand(-PLAZA_HALF + 2, PLAZA_HALF - 2), SW + L.rand(2, 13), 'plaza');

  // seated folk at café tables + on some benches, and vendors at stalls (static, idle anim)
  function seatNPC(x, z, faceY) {
    const n = C.makeNPC();
    n.position.set(x, CH, z); n.rotation.y = faceY == null ? L.rand(0, TAU) : faceY;
    // sit: rotate thighs forward, drop to seat height
    const lm = n.userData.limbs;
    if (lm) { lm.legL.rotation.x = -1.4; lm.legR.rotation.x = -1.4; }
    n.position.y = CH + 0.18;
    n.userData.npc = { kind: 'seated', phase: L.rand(0, TAU), wave: 0 };
    root.add(n); npcs.push(n);
  }
  [[-13, 1], [13, 1]].forEach(([cx]) => { for (let t = 0; t < 3; t++) { const tx = cx + (t - 1) * 2.4; if (L.chance(0.6)) seatNPC(tx + 0.6, SW + 4, -Math.PI / 2); if (L.chance(0.5)) seatNPC(tx - 0.6, SW + 4, Math.PI / 2); } });
  // a vendor standing at each market stall area (static, faces the street)
  [[-9, SW + 11], [9, SW + 11], [0, SW + 13]].forEach(([x, z]) => {
    const n = C.makeNPC(); n.position.set(x, CH, z); n.rotation.y = Math.PI;
    n.userData.npc = { kind: 'vendor', phase: L.rand(0, TAU), wave: 0 };
    root.add(n); npcs.push(n);
  });

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
  // §5.3/§5.5: festoon clusters tight near the plaza & intersection hearts and
  // spreads out toward the avenue ends. Existing per-strand sag/jitter kept.
  for (let x = -AVX + 20; x < AVX - 20; ) {
    const skipPlaza = Math.abs(x) < PLAZA_HALF + 6;
    const skipPark = x > PARK_CX - PARK_HALF - 6 && x < PARK_CX + PARK_HALF + 6;
    if (!skipPlaza && !skipPark) stringLights(x);
    x += 22 * (1.0 + 0.7 * (1 - focusW(x)));        // ~13m apart at a heart → ~37m at the ends
  }
  // a couple of festoon strands flanking the plaza mouth so the focal heart glows
  [-PLAZA_HALF - 7, PLAZA_HALF + 7].forEach(x => stringLights(x));
  // a festoon strand across the cross-street at the intersection
  (function crossFestoon() {
    const S = SW + SDW + 3, H = 7.6, sag = 2.0, N = 12, x = CROSSX;
    const bulbMat = L.MAT.emissive('#ffd27a', 1.3), cordMat = L.MAT.flat('#2a2620');
    let prev = null;
    for (let i = 0; i <= N; i++) {
      const t = i / N, zz = -S + 2 * S * t, y = H - 4 * sag * t * (1 - t);
      if (i % 2 === 0) root.add(L.sphere(0.12, 8, bulbMat, { x, y, z: zz, cast: false }));
      if (prev) { const dy = y - prev.y, dz = zz - prev.z, len = Math.hypot(dy, dz); const seg = L.box(0.025, 0.025, len, cordMat, { x, y: (y + prev.y) / 2, z: (zz + prev.z) / 2, cast: false }); seg.rotation.x = -Math.atan2(dy, dz); root.add(seg); }
      prev = { y, z: zz };
    }
  })();

  /* ── HANGING BANNERS over the street ── */
  [[-44, '#c44a44', '#f4ecd8'], [44, '#2f7060', '#f4ecd8'], [96, '#3a5d92', '#f4ecd8']].forEach(([x, a, b]) => {
    const ban = L.box((ROWZ - 6) * 2, 1.1, 0.06, L.MAT.fabric(a, b, 6), { x, y: 8.2, z: 0, cast: false });
    ban.rotation.y = Math.PI / 2; root.add(ban);
    root.add(L.box(0.08, 0.08, (ROWZ - 6) * 2, L.MAT.flat('#2a2620'), { x, y: 8.8, z: 0, cast: false }));
  });

  /* ── AMBIENT LIFE: pigeons, dogs, circling birds ── */
  const birds = [];
  if (C.makePigeon) {
    for (let k = 0; k < 16; k++) {
      const pg = C.makePigeon();
      const onPlaza = L.chance(0.4);
      const gy = CH + 0.02;
      pg.position.set(onPlaza ? L.rand(-PLAZA_HALF, PLAZA_HALF) : L.rand(-AVX + 10, AVX - 10), gy, onPlaza ? SW + L.rand(2, 12) : L.pick([1, -1]) * (SW + L.rand(1.5, SDW - 1)));
      pg.rotation.y = L.rand(0, TAU);
      pg.userData.pg = { gy, home: pg.position.clone(), phase: L.rand(0, TAU), flee: 0, hop: L.rand(1, 4) };
      root.add(pg); pigeons.push(pg);
    }
  }
  if (C.makeDog) {
    [[-30, 1], [40, -1], [PARK_CX + 6, -1]].forEach(([x, s]) => {
      const d = C.makeDog(); d.position.set(x, CH, s * (SW + 2.2));
      d.userData.dog = { speed: L.rand(1.4, 2.2) * (L.chance(0.5) ? 1 : -1), lane: s * (SW + 2.2), home: x, range: L.rand(10, 22), phase: L.rand(0, TAU) };
      root.add(d); dogs.push(d);
    });
  }
  // cats lounging on sidewalks / in the park, and street musicians in the squares
  if (C.makeCat) {
    [[-50, 1], [22, -1], [PARK_CX + 10, -1], [CROSSX + 4, 1]].forEach(([x, s]) => {
      const cat = C.makeCat(); cat.position.set(x, CH, s * (SW + L.rand(1.5, 3))); cat.rotation.y = L.rand(0, TAU); root.add(cat);
    });
  }
  if (C.makeStreetMusician) {
    [[2, SW + 9], [CROSSX, -ROWZ - 2]].forEach(([x, z]) => {
      const mus = C.makeStreetMusician(); mus.position.set(x, CH, z); mus.rotation.y = L.rand(0, TAU); root.add(mus);
    });
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

  const PP = ctx.player.pos;
  function update(dt, now) {
    const t = now * 0.004;
    // ── NPCs: walk/pause state machine + wave when the Fly is near ──
    for (const n of npcs) {
      const u = n.userData.npc;
      const dxp = n.position.x - PP.x, dzp = n.position.z - PP.z;
      const near = (dxp * dxp + dzp * dzp) < 64 && PP.y < 14;   // Fly within ~8m and low
      u.wave = L.clamp(u.wave + (near ? dt * 4 : -dt * 4), 0, 1);

      if (u.kind === 'seated' || u.kind === 'vendor') {
        // static folk: gentle idle + look/wave at the Fly
        C.animateWalk(n, t * 1.4 + u.phase, false);
        if (u.wave > 0.05 && n.userData.limbs) n.userData.limbs.armR.rotation.x = -2.4 * u.wave + Math.sin(now * 0.02) * 0.4 * u.wave;
        continue;
      }

      // walkers
      u.timer -= dt;
      if (u.state === 'walk') {
        if (u.timer <= 0 && L.chance(0.5)) { u.state = 'pause'; u.timer = L.rand(1.2, 3.5); }
        else if (u.timer <= 0) { u.speed = -u.speed; u.timer = L.rand(3, 7); }
      } else { // pause
        if (u.timer <= 0) { u.state = 'walk'; u.timer = L.rand(3, 7); }
      }
      const moving = u.state === 'walk' && u.wave < 0.4;
      if (moving) n.position.x += u.speed * dt;
      const lim = u.kind === 'plaza' ? (u.cx + 8) : AVX - 7;
      const lo = u.kind === 'plaza' ? (u.cx - 8) : -(AVX - 7);
      if (n.position.x > lim) u.speed = -Math.abs(u.speed);
      if (n.position.x < lo) u.speed = Math.abs(u.speed);
      n.rotation.y = u.speed > 0 ? Math.PI / 2 : -Math.PI / 2;
      C.animateWalk(n, t * 3 + u.phase, moving);
      n.position.y = CH + (moving ? Math.abs(Math.sin(t * 3 + u.phase)) * 0.03 : 0);
      // wave (raise right arm) at the Fly
      if (u.wave > 0.05 && n.userData.limbs) n.userData.limbs.armR.rotation.x = -2.4 * u.wave + Math.sin(now * 0.02) * 0.4 * u.wave;
    }
    // ── dogs: trot back and forth, with a little bob ──
    for (const d of dogs) {
      const u = d.userData.dog;
      d.position.x += u.speed * dt;
      if (d.position.x > u.home + u.range) u.speed = -Math.abs(u.speed);
      if (d.position.x < u.home - u.range) u.speed = Math.abs(u.speed);
      d.rotation.y = u.speed > 0 ? Math.PI / 2 : -Math.PI / 2;
      d.position.y = CH + Math.abs(Math.sin(now * 0.012 + u.phase)) * 0.05;
    }
    // ── pigeons: idle hop/peck; scatter (fly up & away) when the Fly buzzes them ──
    for (const pg of pigeons) {
      const u = pg.userData.pg;
      const dxp = pg.position.x - PP.x, dzp = pg.position.z - PP.z;
      if ((dxp * dxp + dzp * dzp) < 36 && PP.y < 12 && u.flee <= 0) u.flee = 2.2;
      if (u.flee > 0) {
        u.flee -= dt;
        pg.position.y += (3.5 - (pg.position.y - u.gy)) * dt * 1.2;
        pg.position.x += Math.sign(dxp || 1) * dt * 3.0;
        pg.rotation.y += dt * 2;
      } else {
        // settle back down and hop occasionally
        pg.position.y += (u.gy - pg.position.y) * dt * 2.0;
        u.hop -= dt;
        if (u.hop <= 0) { u.hop = L.rand(1.5, 4); pg.rotation.y = L.rand(0, TAU); }
        pg.position.y = u.gy + Math.abs(Math.sin(now * 0.006 + u.phase)) * 0.04;
      }
    }
    // ── traffic ──
    for (const car of cars) {
      const d = car.userData.drive;
      if (d.axis === 'z') {
        car.position.z += d.dir * d.speed * dt;
        if (d.dir > 0 && car.position.z > CROSSZ1 - 6) car.position.z = CROSSZ0 + 6;
        if (d.dir < 0 && car.position.z < CROSSZ0 + 6) car.position.z = CROSSZ1 - 6;
      } else {
        car.position.x += d.dir * d.speed * dt;
        if (d.dir > 0 && car.position.x > AVX - 8) car.position.x = -AVX + 8;
        if (d.dir < 0 && car.position.x < -AVX + 8) car.position.x = AVX - 8;
      }
      if (car.userData.wheels) car.userData.wheels.forEach(w => w.rotation.x += d.speed * dt * 1.5);
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
