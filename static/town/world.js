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

/* ── SECOND AVENUE (a parallel east-west street, offset to +Z) ──
   This turns the single corridor into a real grid. It runs along X like the main
   avenue, sits north of the plaza, and gets its own road / sidewalks / rows. */
const AV2Z = 64;              // second-avenue centerline (z); main avenue is z=0
const AV2X = 108;             // second-avenue half-length (a touch shorter than the main one)
const ROW2ZF = AV2Z - (SW + SDW + 4.5);  // its SOUTH building row (fronts face -Z toward the avenue → toward plaza side)
const ROW2ZB = AV2Z + (SW + SDW + 4.5);  // its NORTH building row (fronts face +Z)
const GREEN2_CX = -34;                   // a small leafy green set into the second avenue's south row
const GREEN2_HALF = 13;                  // its half-width along X (centered at GREEN2_CX)

/* ── BLOCK DEPTH ── a second rank of buildings set behind the main-avenue front
   rows so the town reads as deep blocks, not a one-building-thick wall. */
const BACKZ = 31;             // back-rank centerline distance from the main avenue (z = ±BACKZ)

/* ── CROSS-STREETS (run along Z, perpendicular to the avenues) ──
   CROSSX (east) is the original; CROSSX2 (west) mirrors it so we get a 3×N grid
   of intersections and the streets all connect. Both now span up past AV2Z so
   they tie the two avenues together. */
const CROSSX = 86;            // east cross-street centerline x → 4-way intersection at (CROSSX, 0)
const CROSSX2 = -86;          // west cross-street centerline x (mirror) → intersection at (CROSSX2, 0)
const CROSSZ0 = -(ROWZ + 8);  // cross-street extent (z) southern end (-Z)
const CROSSZ1 = AV2Z + (SW + SDW + 6);   // northern end (+Z) — runs up to meet the second avenue
const CROSSROWX = CROSSX - (SW + SDW + 4.5);  // east cross-street west building row (fronts face +X)
const CROSSROWX2 = CROSSX + (SW + SDW + 4.5); // east cross-street east building row (fronts face -X)
const CROSS2ROWX = CROSSX2 - (SW + SDW + 4.5);  // west cross-street west building row
const CROSS2ROWX2 = CROSSX2 + (SW + SDW + 4.5); // west cross-street east building row

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

/* SECOND-AVENUE roster — a quieter residential/neighbourhood mix (more
   townhouses & apartments, everyday shops). §2.1 3:1 warm:cool kept. */
const AV2_ROSTER = [
  ['PINTURAS',     '#d8a877', 'townhouse', 3, '#5a3820', null,                   ['posters']], // warm sand
  ['EL RINCÓN',    '#cf9a6e', 'cafe',      3, '#8b3528', ['#c44a44', '#f4ecd8'], ['balcony']], // terracotta tan
  ['MODAS',        '#caa074', 'shop',      4, '#682050', ['#b03888', '#f8eef8'], ['neon']],    // clay
  ['LA COCINA',    '#9fb0a0', 'apartment', 5, '#284828', ['#4a8050', '#eef4ee'], ['balcony']], // sage relief
  ['REGALOS',      '#e3c79a', 'shop',      2, '#c05020', ['#e87838', '#fff0e0'], ['posters']], // cream-ochre
  ['EL ALMACÉN',   '#d9b07e', 'civic',     3, '#4a3a1a', ['#8a6a28', '#f4ecd8'], []],          // wheat
  ['SEMILLAS',     '#aeb39a', 'shop',      2, '#286848', ['#2a8858', '#eef8ef'], []],          // olive-stone relief
  ['EL TALLER',    '#c08a63', 'townhouse', 2, '#3a1818', null,                   ['posters']], // burnt sienna
  ['NOTARÍA',      '#9eb2bd', 'civic',     4, '#1a2a48', ['#2a4a88', '#e8eef8'], ['balcony']], // faded sky-blue relief
  ['DULCES',       '#d4a890', 'shop',      2, '#a8482a', ['#d86838', '#fff0e0'], []],          // faded coral
  ['LA IMPRENTA',  '#caa074', 'apartment', 5, '#3a2a1a', ['#7a5a30', '#f0e8d0'], ['balcony']], // clay
  ['VIVERO',       '#9fb0a0', 'shop',      2, '#305038', ['#4a8050', '#eef4ee'], ['posters']], // sage relief (plants)
  ['EL HORNO',     '#c99a8a', 'cafe',      3, '#8a4a28', ['#c87a3a', '#f4ecd8'], []],          // rose-clay
  ['LA PRENSA',    '#e3c79a', 'shop',      3, '#28404a', ['#3a5878', '#f4ecd8'], ['neon']],    // cream-ochre
  ['CURIOSIDADES', '#d9b07e', 'townhouse', 3, '#5a3a18', null,                   ['posters']], // wheat
  ['EL DEPÓSITO',  '#caa074', 'shop',      2, '#6a3a1a', ['#a85a28', '#f4ecd8'], []],          // clay
];

/* BACK-RANK roster — buildings set behind the main-avenue front rows (block
   depth). Mostly plain townhouses/apartments so they read as the block interior,
   not competing storefronts. */
const BACK_ROSTER = [
  ['—',            '#d9b07e', 'townhouse', 3, '#4a3018', null, []],                          // wheat
  ['—',            '#caa074', 'apartment', 4, '#3a2a1a', null, []],                          // clay
  ['—',            '#cf9a6e', 'townhouse', 2, '#5a3820', null, []],                          // terracotta tan
  ['—',            '#e3c79a', 'apartment', 5, '#28404a', null, ['balcony']],                 // cream-ochre
  ['—',            '#9fb0a0', 'townhouse', 3, '#284828', null, []],                          // sage relief
  ['—',            '#d8a877', 'apartment', 4, '#3a2818', null, []],                          // warm sand
  ['—',            '#c08a63', 'townhouse', 2, '#3a1818', null, []],                          // burnt sienna
  ['—',            '#9eb2bd', 'apartment', 4, '#1a2a48', null, ['balcony']],                 // faded sky-blue relief
  ['—',            '#c99a8a', 'townhouse', 3, '#6a2828', null, []],                          // rose-clay
  ['—',            '#aeb39a', 'apartment', 4, '#28583a', null, []],                          // olive-stone relief
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
  /* ── COLLISION + WALKABLE SURFACES ──
     colliders: static solids the courier can't walk through.
       { t:'b', x, z, hw, hd }  axis-aligned box (all placements are axis-aligned)
       { t:'c', x, z, r }       circle (lamps, trees, fountains, …)
     floors: raised walkable slabs (sidewalks/plaza/park) so feet ride on top.
       { x, z, hw, hd, h } */
  const colliders = [];
  const floors = [];
  const colB = (x, z, hw, hd) => colliders.push({ t: 'b', x, z, hw, hd });
  const colC = (x, z, r) => colliders.push({ t: 'c', x, z, r });
  const floorR = (x, z, hw, hd, h) => floors.push({ x, z, hw, hd, h: h == null ? CH : h });
  // transform a building's local clutter colliders (from buildings.js userData.cols)
  const addLocalCols = (g, wx, wz, ang) => {
    const cs = g.userData && g.userData.cols; if (!cs) return;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    for (const c of cs) colC(wx + c.x * ca + c.z * sa, wz - c.x * sa + c.z * ca, c.r);
    // rooftop vents double as chimney-smoke emitters (cap the town total)
    const sm = g.userData.smoke;
    if (sm && smokePts.length < 10) for (const s of sm) {
      if (smokePts.length >= 10 || !L.chance(0.5)) continue;
      smokePts.push(new T.Vector3(wx + s.x * ca + s.z * sa, s.y, wz - s.x * sa + s.z * ca));
    }
  };
  const smokePts = [];
  const treePts = [];   // every planted tree — anchors for falling leaves
  // handcrafted, not plotted: ordinary buildings lean and settle a hair so the
  // rows stop reading as a perfect grid (landmarks stay crisp)
  const dressB = g => { g.rotation.y += L.jitter(0.018); g.scale.set(1 + L.jitter(0.02), 1 + L.jitter(0.03), 1 + L.jitter(0.02)); };
  // shared player handle — game.js writes player.pos each frame so townsfolk can react
  ctx.player = ctx.player || { pos: new T.Vector3(0, 9, 0) };

  /* ── GROUND ── (tessellated so the tiny-planet curvature bends them smoothly) */
  const base = new T.Mesh(new T.PlaneGeometry(900, 900, 90, 90), L.std({ map: L.dirtTex(), roughness: 1 }));
  base.rotation.x = -Math.PI / 2; base.position.y = -0.05; base.receiveShadow = true; root.add(base);

  const roadMat = L.std({ map: L.roadTex(), roughness: 0.94 });
  // main avenue asphalt (along X) — tessellated so the curvature shader bends it
  const road = new T.Mesh(new T.PlaneGeometry(AVX * 2, SW * 2, 120, 2), roadMat);
  road.rotation.x = -Math.PI / 2; road.receiveShadow = true; root.add(road);
  // SECOND avenue asphalt (along X, offset +Z) — tessellated
  const road2 = new T.Mesh(new T.PlaneGeometry(AV2X * 2, SW * 2, Math.ceil(AV2X * 2 / 4), 2), roadMat);
  road2.rotation.x = -Math.PI / 2; road2.position.set(0, 0.002, AV2Z); road2.receiveShadow = true; root.add(road2);
  // cross-street asphalt (along Z) — tessellated
  const crossLen = CROSSZ1 - CROSSZ0;
  [CROSSX, CROSSX2].forEach(cxx => {
    const xroad = new T.Mesh(new T.PlaneGeometry(SW * 2, crossLen, 2, Math.ceil(crossLen / 4)), roadMat);
    xroad.rotation.x = -Math.PI / 2; xroad.position.set(cxx, 0.002, (CROSSZ0 + CROSSZ1) / 2); xroad.receiveShadow = true; root.add(xroad);
  });

  const CROSSXS = [CROSSX, CROSSX2];   // the two cross-street centerlines
  const nearAnyCrossX = x => CROSSXS.some(cx => Math.abs(x - cx) < SW + 1);
  // lane dashes (both avenues) — skip across each intersection
  const dashMat = L.std({ color: 0xd4c890, roughness: 0.8 });
  for (let x = -AVX + 3; x < AVX; x += 4.2) { if (nearAnyCrossX(x)) continue; root.add(L.decal(2.2, 0.18, dashMat, 0.012).translateX(x)); }
  for (let x = -AV2X + 3; x < AV2X; x += 4.2) { if (nearAnyCrossX(x)) continue; const dd = L.decal(2.2, 0.18, dashMat, 0.012); dd.position.set(x, 0.012, AV2Z); root.add(dd); }
  // lane dashes (cross-streets) — skip across the avenue intersections (z≈0 and z≈AV2Z)
  CROSSXS.forEach(cxx => { for (let z = CROSSZ0 + 3; z < CROSSZ1; z += 4.2) { if (Math.abs(z) < SW + 1 || Math.abs(z - AV2Z) < SW + 1) continue; const dd = L.decal(0.18, 2.2, dashMat, 0.012); dd.position.set(cxx, 0.012, z); root.add(dd); } });
  const edgeMat = L.std({ color: 0xd8d0a0, roughness: 0.8 });
  [-SW + 0.5, SW - 0.5].forEach(z => { const e = L.decal(AVX * 2, 0.14, edgeMat, 0.013); e.position.z = z; root.add(e); });
  [AV2Z - SW + 0.5, AV2Z + SW - 0.5].forEach(z => { const e = L.decal(AV2X * 2, 0.14, edgeMat, 0.013); e.position.set(0, 0.013, z); root.add(e); });
  CROSSXS.forEach(cxx => { [cxx - SW + 0.5, cxx + SW - 0.5].forEach(x => { const e = L.decal(0.14, crossLen, edgeMat, 0.013); e.position.set(x, 0.013, (CROSSZ0 + CROSSZ1) / 2); root.add(e); }); });
  // zebra crossings — a couple along each avenue + at the mouths of every intersection
  const zebraMat = L.std({ color: 0xe8e0ca, roughness: 0.88 });
  [-58, -18, 40].forEach(cx0 => { if (nearAnyCrossX(cx0)) return; for (let i = 0; i < 9; i++) { const s = L.decal(0.6, SW * 2 - 0.8, zebraMat, 0.016); s.position.set(cx0 + i * 1.1, 0.016, 0); root.add(s); } });
  [-36, 36].forEach(cx0 => { if (nearAnyCrossX(cx0)) return; for (let i = 0; i < 9; i++) { const s = L.decal(0.6, SW * 2 - 0.8, zebraMat, 0.016); s.position.set(cx0 + i * 1.1, 0.016, AV2Z); root.add(s); } });
  // intersection crosswalks at each avenue×cross-street junction
  [[CROSSX, 0], [CROSSX2, 0], [CROSSX, AV2Z], [CROSSX2, AV2Z]].forEach(([cxx, cz]) => {
    // across the avenue on the west & east mouths (stripes run along Z)
    [cxx - SW - 2.6, cxx + SW + 0.6].forEach(x0 => { for (let i = 0; i < 8; i++) { const s = L.decal(0.6, SW * 2 - 0.8, zebraMat, 0.016); s.position.set(x0 + i * 0.55, 0.016, cz); root.add(s); } });
    // across the cross-street on the north & south mouths (stripes run along X)
    [cz + SW + 0.6, cz - (SW + 2.6)].forEach(z0 => { for (let i = 0; i < 8; i++) { const s = L.decal(SW * 2 - 0.8, 0.6, zebraMat, 0.016); s.position.set(cxx, 0.016, z0 + i * 0.55); root.add(s); } });
  });

  // sidewalks + curbs + tile joints
  const swMat = L.std({ map: L.sidewalkTex(), roughness: 0.96 });
  const curbMat = L.std({ color: 0xcac4b4, roughness: 0.9 });
  const jMat = L.std({ color: 0x908880, roughness: 0.96 });
  // helper: emit one straight sidewalk run (+ curb + joints) along X for an
  // avenue at z=avZ, breaking it into segments around the cross-streets it crosses.
  function avenueSidewalk(avZ, x0, x1, crossXs) {
    [1, -1].forEach(side => {
      const z0 = avZ + side * (SW + SDW / 2);
      // build the list of clear "gaps" (cross-street corridors) and pave between them
      const gaps = crossXs.map(cx => [cx - SW - SDW, cx + SW + SDW]).sort((a, b) => a[0] - b[0]);
      let segStart = x0;
      const emit = (a, b) => {
        if (b - a < 0.5) return;
        const L0 = b - a, cx0 = (a + b) / 2;
        root.add(L.box(L0, CH, SDW, swMat, { x: cx0, y: CH / 2, z: z0, receive: true }));
        root.add(L.box(L0, CH + 0.06, 0.2, curbMat, { x: cx0, y: (CH + 0.06) / 2, z: avZ + side * (SW + 0.1) }));
        floorR(cx0, z0, L0 / 2, SDW / 2);
      };
      gaps.forEach(([ga, gb]) => { if (ga > segStart) emit(segStart, ga); segStart = Math.max(segStart, gb); });
      emit(segStart, x1);
      for (let x = x0 + 2.5; x < x1; x += 2.5) { if (crossXs.some(cx => Math.abs(x - cx) < SW + SDW)) continue; const j = L.decal(0.06, SDW - 0.3, jMat, CH + 0.01); j.position.set(x, CH + 0.01, z0); root.add(j); }
    });
  }
  // helper: one cross-street's sidewalks (along Z), broken at the avenue(s) it crosses.
  function crossSidewalk(cxx, z0in, z1in, avenueZs) {
    [1, -1].forEach(side => {
      const x0 = cxx + side * (SW + SDW / 2);
      const gaps = avenueZs.map(az => [az - SW - SDW, az + SW + SDW]).sort((a, b) => a[0] - b[0]);
      let segStart = z0in;
      const emit = (a, b) => {
        if (b - a < 0.5) return;
        const L0 = b - a, cz0 = (a + b) / 2;
        root.add(L.box(SDW, CH, L0, swMat, { x: x0, y: CH / 2, z: cz0, receive: true }));
        root.add(L.box(0.2, CH + 0.06, L0, curbMat, { x: cxx + side * (SW + 0.1), y: (CH + 0.06) / 2, z: cz0 }));
        floorR(x0, cz0, SDW / 2, L0 / 2);
      };
      gaps.forEach(([ga, gb]) => { if (ga > segStart) emit(segStart, ga); segStart = Math.max(segStart, gb); });
      emit(segStart, z1in);
      for (let z = z0in + 2.5; z < z1in; z += 2.5) { if (avenueZs.some(az => Math.abs(z - az) < SW + SDW)) continue; const j = L.decal(SDW - 0.3, 0.06, jMat, CH + 0.01); j.position.set(x0, CH + 0.01, z); root.add(j); }
    });
  }
  avenueSidewalk(0, -AVX, AVX, CROSSXS);
  avenueSidewalk(AV2Z, -AV2X, AV2X, CROSSXS);
  crossSidewalk(CROSSX, CROSSZ0, CROSSZ1, [0, AV2Z]);
  crossSidewalk(CROSSX2, CROSSZ0, CROSSZ1, [0, AV2Z]);
  // corner sidewalk pads filling the four quadrants of every intersection
  [[CROSSX, 0], [CROSSX2, 0], [CROSSX, AV2Z], [CROSSX2, AV2Z]].forEach(([cxx, cz]) => {
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {
      root.add(L.box(SDW, CH, SDW, swMat, { x: cxx + sx * (SW + SDW / 2), y: CH / 2, z: cz + sz * (SW + SDW / 2), receive: true }));
      floorR(cxx + sx * (SW + SDW / 2), cz + sz * (SW + SDW / 2), SDW / 2, SDW / 2);
    });
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
  floorR(0, (SW + ROWZ + 7) / 2, PLAZA_HALF, ((ROWZ + 7) - SW) / 2);
  // fountain centerpiece
  const fountain = P.makeFountain(); fountain.position.set(0, CH, SW + 6); root.add(fountain);
  if (fountain.userData.water) fountains.push(fountain);
  colC(0, SW + 6, 2.9);
  // benches ringing the fountain + trees + cafés + stalls
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; const b = P.makeBench(); b.position.set(Math.cos(a) * 6, CH, SW + 6 + Math.sin(a) * 6); b.rotation.y = -a + Math.PI / 2; root.add(b); colC(Math.cos(a) * 6, SW + 6 + Math.sin(a) * 6, 0.75); }
  [[-13, 1], [13, 1]].forEach(([x, s]) => { const cf = P.makeCafe(); cf.position.set(x, CH, SW + 4); root.add(cf); colC(x, SW + 4, 3.0); });
  [[-9, 0], [9, 0], [0, 1]].forEach(([dx, dz]) => { const st = P.makeMarketStall(); st.position.set(dx, CH, SW + 11 + dz * 2); st.rotation.y = Math.PI; root.add(st); colC(dx, SW + 11 + dz * 2, 2.1); });
  [[-15, SW + 12], [15, SW + 12], [-7, SW + 13], [7, SW + 13]].forEach(([x, z]) => { const tr = P.makeTree({ big: true }); tr.position.set(x, CH, z); root.add(tr); colC(x, z, 0.55); treePts.push([x, z]); });
  // §5.3 focal-heart density bump: planters & lamps ring the founter plaza (densest here)
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + 0.4; const pl = P.makePlanter(); pl.position.set(Math.cos(a) * 9.5, CH, SW + 6 + Math.sin(a) * 9.5); root.add(pl); colC(Math.cos(a) * 9.5, SW + 6 + Math.sin(a) * 9.5, 0.62); }
  [[-11, SW + 2], [11, SW + 2], [-11, SW + 10], [11, SW + 10]].forEach(([x, z]) => { const lp = P.makeLamp(); lp.position.set(x, CH, z); root.add(lp); colC(x, z, 0.28); });

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
  // the cross-street corridors (avenue buildings must leave a gap for each to pass through)
  const XGAP = SW + SDW + 1.5;             // half-width of the corridor to keep clear around a cross-street
  // returns true (and advances x past the corridor) if x is inside any cross-street gap.
  function clearCrossGaps(xRef) {
    for (const cx of CROSSXS) { if (xRef.x > cx - XGAP && xRef.x < cx + XGAP) { xRef.x = cx + XGAP; return true; } }
    return false;
  }
  // would a building of width w starting at x straddle into a cross-street corridor?
  function straddlesCross(x, w) {
    for (const cx of CROSSXS) { if (x < cx - XGAP && x + w > cx - XGAP) return cx; }
    return null;
  }
  function placeRow(side) {
    // side +1 → buildings on +Z (front faces -Z, faceAngle=π); side -1 → -Z (faceAngle=0)
    const z = side * ROWZ;
    const faceAngle = side > 0 ? Math.PI : 0;
    const frontDir = new T.Vector3(Math.sin(faceAngle), 0, Math.cos(faceAngle));
    const xRef = { x: -AVX + 5 };
    let ri = (side > 0 ? 0 : 7);
    while (xRef.x < AVX - 6) {
      // leave a gap on the +Z side for the plaza, and on the -Z side for the park
      if (side > 0 && xRef.x > -PLAZA_HALF - 4 && xRef.x < PLAZA_HALF + 4) { xRef.x = PLAZA_HALF + 4; continue; }
      if (side < 0 && xRef.x > PARK_CX - PARK_HALF - 2 && xRef.x < PARK_CX + PARK_HALF + 2) { xRef.x = PARK_CX + PARK_HALF + 2; continue; }
      // leave the cross-street corridors clear (corner buildings sit on the cross rows)
      if (clearCrossGaps(xRef)) continue;
      const spec = ROSTER[ri % ROSTER.length]; ri++;
      const { w, d } = specToDims(spec, ri);
      const sc = straddlesCross(xRef.x, w);
      if (sc != null) { xRef.x = sc + XGAP; ri--; continue; }
      const cx = xRef.x + w / 2;
      const bspec = { w, d, floors: spec[3], archetype: spec[2], wall: spec[1], name: spec[0], signColor: spec[4], awning: spec[5], extras: spec[6], seed: ri * 97 + side * 13 };
      const g = B.make(bspec); g.position.set(cx, 0, z); g.rotation.y = faceAngle; dressB(g); root.add(g);
      colB(cx, z, w / 2, d / 2); addLocalCols(g, cx, z, faceAngle);
      const ax = cx + frontDir.x * (d / 2 + 1.6), az = z + frontDir.z * (d / 2 + 1.6);
      addresses.push({ name: spec[0], pos: new T.Vector3(ax, 2.6, az) });
      xRef.x += w + L.rand(1.0, 2.2);
    }
  }
  placeRow(1); placeRow(-1);

  /* ── BACK-RANK BUILDINGS (block depth behind the main-avenue front rows) ──
     Set behind each front row (further from the avenue in Z), facing AWAY from
     the avenue so the block reads as solid. Sparse/no addresses (block interior),
     thinning toward the avenue ends per §5.3. */
  function placeBackRank(side) {
    const z = side * BACKZ;                 // behind the front row (|BACKZ| > |ROWZ|)
    const faceAngle = side > 0 ? Math.PI : 0;   // still face the avenue-ward direction for tidy roofs
    const xRef = { x: -AVX + 12 };
    let ri = (side > 0 ? 0 : 5);
    while (xRef.x < AVX - 12) {
      // keep plaza/park/landmark zones clear behind them too
      if (side > 0 && xRef.x > -PLAZA_HALF - 6 && xRef.x < PLAZA_HALF + 6) { xRef.x = PLAZA_HALF + 6; continue; }
      if (side < 0 && xRef.x > PARK_CX - PARK_HALF - 6 && xRef.x < PARK_CX + PARK_HALF + 6) { xRef.x = PARK_CX + PARK_HALF + 6; continue; }
      // the back rank sits at z=±BACKZ, in the cross-street rows' band — keep a
      // WIDE corridor (cross road + both its building rows) clear to avoid clashes.
      let bumpedC = false;
      for (const cx of CROSSXS) { if (xRef.x > cx - 25 && xRef.x < cx + 25) { xRef.x = cx + 25; bumpedC = true; break; } }
      if (bumpedC) continue;
      const spec = BACK_ROSTER[ri % BACK_ROSTER.length]; ri++;
      const { w, d } = specToDims(spec, ri);
      let straddleC = null;
      for (const cx of CROSSXS) { if (xRef.x < cx - 25 && xRef.x + w > cx - 25) { straddleC = cx; break; } }
      if (straddleC != null) { xRef.x = straddleC + 25; ri--; continue; }
      const cx = xRef.x + w / 2;
      const bspec = { w, d, floors: spec[3], archetype: spec[2], wall: spec[1], name: '', signColor: spec[4], awning: spec[5], extras: spec[6], seed: ri * 67 + side * 41 + 1300 };
      const g = B.make(bspec); g.position.set(cx, 0, z); g.rotation.y = faceAngle; dressB(g); root.add(g);
      colB(cx, z, w / 2, d / 2); addLocalCols(g, cx, z, faceAngle);
      // wide spacing so the back rank stays sparse (block interior) and thins at the ends
      xRef.x += w + L.rand(6, 10) * (1.0 + 0.6 * (1 - L.clamp(1 - Math.abs(cx) / 110, 0, 1)));
    }
  }
  placeBackRank(1); placeBackRank(-1);

  /* ── SECOND-AVENUE BUILDING ROWS (run along X at z=AV2Z) ── */
  function placeAv2Row(side) {
    // side -1 → south row at ROW2ZF (front faces -Z toward avenue, faceAngle=Math.PI)
    // side +1 → north row at ROW2ZB (front faces +Z, faceAngle=0)
    const z = side < 0 ? ROW2ZF : ROW2ZB;
    const faceAngle = side < 0 ? Math.PI : 0;
    const frontDir = new T.Vector3(Math.sin(faceAngle), 0, Math.cos(faceAngle));
    const xRef = { x: -AV2X + 5 };
    let ri = side < 0 ? 0 : 6;
    while (xRef.x < AV2X - 6) {
      // leave a small green/plaza gap mid-street on the south row
      if (side < 0 && xRef.x > GREEN2_CX - GREEN2_HALF - 3 && xRef.x < GREEN2_CX + GREEN2_HALF + 3) { xRef.x = GREEN2_CX + GREEN2_HALF + 3; continue; }
      // keep the clock-tower silhouette (x≈0, z≈ROWZ+22) clear behind the south row
      if (side < 0 && xRef.x > -10 && xRef.x < 10) { xRef.x = 10; continue; }
      if (clearCrossGaps(xRef)) continue;
      const spec = AV2_ROSTER[ri % AV2_ROSTER.length]; ri++;
      const { w, d } = specToDims(spec, ri);
      const sc = straddlesCross(xRef.x, w);
      if (sc != null) { xRef.x = sc + XGAP; ri--; continue; }
      const cx = xRef.x + w / 2;
      const bspec = { w, d, floors: spec[3], archetype: spec[2], wall: spec[1], name: spec[0], signColor: spec[4], awning: spec[5], extras: spec[6], seed: ri * 83 + side * 29 + 2100 };
      const g = B.make(bspec); g.position.set(cx, 0, z); g.rotation.y = faceAngle; dressB(g); root.add(g);
      colB(cx, z, w / 2, d / 2); addLocalCols(g, cx, z, faceAngle);
      const ax = cx + frontDir.x * (d / 2 + 1.6), az = z + frontDir.z * (d / 2 + 1.6);
      addresses.push({ name: spec[0], pos: new T.Vector3(ax, 2.6, az) });
      // roomier spacing than the main avenue (quieter neighbourhood feel)
      xRef.x += w + L.rand(4.0, 6.5);
    }
  }
  placeAv2Row(-1); placeAv2Row(1);

  /* ── CROSS-STREET BUILDING ROWS (run along Z; fronts face the cross-street) ──
     Breaks at BOTH avenue corridors (z≈0 and z≈AV2Z) so the grid connects. */
  const AVZS = [0, AV2Z];
  const ZGAP = SW + SDW + 1.5;
  function nearAnyAvenueZ(z) { return AVZS.some(az => z > az - ZGAP && z < az + ZGAP); }
  function placeCrossRow(cxx, rowOffsetSign, roster, seedBase) {
    // rowOffsetSign -1 → west row (front faces +X, faceAngle=π/2)
    // rowOffsetSign +1 → east row (front faces -X, faceAngle=-π/2)
    const rowX = cxx + rowOffsetSign * (SW + SDW + 4.5);
    const faceAngle = rowOffsetSign < 0 ? Math.PI / 2 : -Math.PI / 2;
    const frontDir = new T.Vector3(Math.sin(faceAngle), 0, Math.cos(faceAngle));
    let z = CROSSZ0 + 4;
    let ri = rowOffsetSign < 0 ? 0 : 7;
    while (z < CROSSZ1 - 4) {
      // keep both avenue corridors clear so the streets connect cleanly
      let bumped = false;
      for (const az of AVZS) { if (z > az - ZGAP && z < az + ZGAP) { z = az + ZGAP; bumped = true; break; } }
      if (bumped) continue;
      const spec = roster[ri % roster.length]; ri++;
      const { w, d } = specToDims(spec, ri);   // w runs along Z here, d is depth into the block
      let straddle = false;
      for (const az of AVZS) { if (z < az - ZGAP && z + w > az - ZGAP) { z = az + ZGAP; ri--; straddle = true; break; } }
      if (straddle) continue;
      const cz = z + w / 2;
      const bspec = { w, d, floors: spec[3], archetype: spec[2], wall: spec[1], name: spec[0], signColor: spec[4], awning: spec[5], extras: spec[6], seed: ri * 89 + rowOffsetSign * 23 + seedBase };
      const g = B.make(bspec); g.position.set(rowX, 0, cz); g.rotation.y = faceAngle; dressB(g); root.add(g);
      colB(rowX, cz, d / 2, w / 2);   // rotated ±90°: depth runs along X, width along Z
      addLocalCols(g, rowX, cz, faceAngle);
      const ax = rowX + frontDir.x * (d / 2 + 1.6), az = cz + frontDir.z * (d / 2 + 1.6);
      addresses.push({ name: spec[0], pos: new T.Vector3(ax, 2.6, az) });
      z += w + L.rand(0.5, 1.2);
    }
  }
  placeCrossRow(CROSSX, -1, CROSS_ROSTER, 700); placeCrossRow(CROSSX, 1, CROSS_ROSTER, 700);
  placeCrossRow(CROSSX2, -1, CROSS_ROSTER, 1800); placeCrossRow(CROSSX2, 1, CROSS_ROSTER, 1800);

  // CORNER buildings framing each main-avenue 4-way intersection (taller, civic)
  [[CROSSX, 900], [CROSSX2, 960]].forEach(([cxx, seedBase], ci) => {
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz], i) => {
      const w = L.rand(9, 11), d = L.rand(9, 11);
      const cx = cxx + sx * (SW + SDW + 1.0 + w / 2);
      const cz = sz * (SW + SDW + 1.0 + d / 2);
      const faceAngle = sz > 0 ? Math.PI : 0;
      const spec = LANDMARK_SPECS[i % LANDMARK_SPECS.length] || ['PLAZA MAYOR', '#cbb488', 'civic', 4, '#4a3a1a', null, ['balcony']];
      const names = ci === 0
        ? ['CORREO CENTRAL', 'BANCO MOTT', 'GRAN HOTEL', 'TEATRO ESQUINA']
        : ['MERCADO VIEJO', 'CASA DE LA VILLA', 'EL ATENEO', 'POSADA MOTT'];
      const nm = names[i];
      const bspec = { w, d, floors: L.randInt(4, 5), archetype: 'civic', wall: spec[1], name: nm, signColor: spec[4], awning: spec[5], extras: ['balcony'], seed: seedBase + i * 41 };
      const g = B.make(bspec); g.position.set(cx, 0, cz); g.rotation.y = faceAngle; root.add(g);
      colB(cx, cz, w / 2, d / 2); addLocalCols(g, cx, cz, faceAngle);
      const fd = new T.Vector3(Math.sin(faceAngle), 0, Math.cos(faceAngle));
      addresses.push({ name: nm, pos: new T.Vector3(cx + fd.x * (d / 2 + 1.8), 3.0, cz + fd.z * (d / 2 + 1.8)) });
    });
  });

  // plaza civic buildings (set back, framing the square, facing -Z toward avenue)
  PLAZA_SPECS.forEach((spec, i) => {
    const { w, d } = { w: L.rand(11, 14), d: L.rand(10, 12) };
    const cx = (i - 1) * 16;
    const z = ROWZ + 9;
    const bspec = { w, d, floors: spec[3], archetype: 'civic', wall: spec[1], name: spec[0], signColor: spec[4], awning: spec[5], extras: spec[6], seed: 500 + i * 31 };
    const g = B.make(bspec); g.position.set(cx, 0, z); g.rotation.y = Math.PI; root.add(g);
    colB(cx, z, w / 2, d / 2); addLocalCols(g, cx, z, Math.PI);
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
    colB(tx, tz, 3.8, 3.8);
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
    floorR(PARK_CX, cz, PARK_HALF, pd / 2);
    // low hedge border — with GATES where the cross paths meet it, so the park
    // has real entrances now that hedges are solid.
    const hedgeMat = L.std({ color: 0x4f7a3c, roughness: 0.96 });
    const GATE = 1.9;
    for (let x = PARK_CX - PARK_HALF; x <= PARK_CX + PARK_HALF; x += 1.4) {
      if (Math.abs(x - PARK_CX) < GATE) continue;   // north/south gates (Z path)
      root.add(L.box(1.4, 0.7, 0.5, hedgeMat, { x, y: CH + 0.35, z: z0 })); root.add(L.box(1.4, 0.7, 0.5, hedgeMat, { x, y: CH + 0.35, z: z1 }));
    }
    for (let z = z1; z <= z0; z += 1.4) {
      if (Math.abs(z - cz) < GATE) continue;        // east/west gates (X path)
      root.add(L.box(0.5, 0.7, 1.4, hedgeMat, { x: PARK_CX - PARK_HALF, y: CH + 0.35, z })); root.add(L.box(0.5, 0.7, 1.4, hedgeMat, { x: PARK_CX + PARK_HALF, y: CH + 0.35, z }));
    }
    // hedge colliders: 2 segments per side, split at the gates
    [z0, z1].forEach(hz => {
      colB(PARK_CX - (PARK_HALF + GATE) / 2, hz, (PARK_HALF - GATE) / 2 + 0.7, 0.4);
      colB(PARK_CX + (PARK_HALF + GATE) / 2, hz, (PARK_HALF - GATE) / 2 + 0.7, 0.4);
    });
    [PARK_CX - PARK_HALF, PARK_CX + PARK_HALF].forEach(hx => {
      colB(hx, cz - (pd / 2 + GATE) / 2, 0.4, (pd / 2 - GATE) / 2 + 0.7);
      colB(hx, cz + (pd / 2 + GATE) / 2, 0.4, (pd / 2 - GATE) / 2 + 0.7);
    });
    // cross paths
    const pathMat = L.std({ color: 0xc8b894, roughness: 0.95 });
    root.add(L.box(pw - 2, 0.02, 2.4, pathMat, { x: PARK_CX, y: CH + 0.02, z: cz, cast: false }));
    root.add(L.box(2.4, 0.02, pd - 2, pathMat, { x: PARK_CX, y: CH + 0.02, z: cz, cast: false }));
    // pond
    const pond = new T.Mesh(new T.CylinderGeometry(4.2, 4.2, 0.2, 28), L.std({ color: 0x3f7fb0, roughness: 0.12, metalness: 0.3, transparent: true, opacity: 0.88 }));
    pond.position.set(PARK_CX + 8, CH + 0.04, cz - 5); root.add(pond);
    colC(PARK_CX + 8, cz - 5, 4.7);
    root.add(L.cyl(4.6, 4.8, 0.3, 28, L.std({ color: 0xb8b09a, roughness: 0.9 }), { x: PARK_CX + 8, y: CH + 0.12, z: cz - 5 }));
    // gazebo (bandstand)
    (function gazebo() {
      const gx = PARK_CX - 8, gz = cz + 4;
      colC(gx, gz, 2.9);
      root.add(L.cyl(2.6, 2.8, 0.35, 12, L.std({ color: 0xc4bca8, roughness: 0.92 }), { x: gx, y: CH + 0.17, z: gz, receive: true }));
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; root.add(L.cyl(0.1, 0.1, 2.6, 7, L.MAT.wood('#8a6a44'), { x: gx + Math.cos(a) * 2.3, y: CH + 1.5, z: gz + Math.sin(a) * 2.3 })); }
      const roof = new T.Mesh(new T.ConeGeometry(3.1, 1.6, 12), L.std({ color: 0x8a5d4e, roughness: 0.9 })); roof.position.set(gx, CH + 3.6, gz); roof.castShadow = true; root.add(roof);
    })();
    // statue near the avenue edge
    (function statue() {
      const sx = PARK_CX + 12, sz = z0 - 3;
      colC(sx, sz, 1.2);
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
      if (i % 3 === 0) { const b = P.makeBench(); b.position.set(x, CH, z); b.rotation.y = L.rand(0, TAU); root.add(b); colC(x, z, 0.75); }
      else if (i % 3 === 1) { const pl = P.makePlanter(); pl.position.set(x, CH, z); root.add(pl); colC(x, z, 0.62); }
      else { const tr = P.makeTree({ big: L.chance(0.6) }); tr.position.set(x, CH, z); root.add(tr); colC(x, z, 0.55); treePts.push([x, z]); }
    });
    // a few park strollers
    for (let k = 0; k < 4; k++) { const n = C.makeNPC(); n.position.set(PARK_CX + L.rand(-PARK_HALF + 3, PARK_HALF - 3), CH, cz + L.rand(-pd / 2 + 3, pd / 2 - 3)); n.userData.npc = { speed: L.rand(0.4, 0.9) * (L.chance(0.5) ? 1 : -1), phase: L.rand(0, TAU), lane: n.position.z, kind: 'plaza', cx: n.position.x }; root.add(n); npcs.push(n); }
  })();

  /* ── SECOND-AVENUE GREEN (a small leafy neighbourhood square set into the
     south row of the second avenue) — a new small landmark per the brief. ── */
  (function buildGreen2() {
    // patch sits between the avenue's south curb and the south building row
    const zNear = AV2Z - (SW + 1), zFar = ROW2ZF + 3.5;   // zNear (closer to avenue) > zFar (closer to row)
    const cz = (zNear + zFar) / 2, gw = GREEN2_HALF * 2, gd = Math.abs(zNear - zFar);
    // grass — tessellated so the curvature shader bends it
    const grassTex = (() => {
      const c = L.cnv(128, 128), g = c.getContext('2d');
      g.fillStyle = '#7aa257'; g.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 70; i++) { g.globalAlpha = L.rand(0.04, 0.1); g.fillStyle = L.chance(0.5) ? '#5c8a44' : '#86b066'; g.beginPath(); g.arc(L.rand(0, 128), L.rand(0, 128), L.rand(4, 14), 0, TAU); g.fill(); }
      g.globalAlpha = 1; L.grain(g, 128, 128, 900, 0.05);
      return L.finishTex(c, { repeat: [4, 3], aniso: 8 });
    })();
    const grass = new T.Mesh(new T.PlaneGeometry(gw, gd, Math.ceil(gw / 4), Math.ceil(gd / 4)), L.std({ map: grassTex, roughness: 1 }));
    grass.rotation.x = -Math.PI / 2; grass.position.set(GREEN2_CX, CH, cz); grass.receiveShadow = true; root.add(grass);
    floorR(GREEN2_CX, cz, GREEN2_HALF, gd / 2);
    // a small monument + trees + benches
    colC(GREEN2_CX, cz, 0.9);
    root.add(L.box(1.4, 0.8, 1.4, L.std({ color: 0xc4bca8, roughness: 0.9 }), { x: GREEN2_CX, y: CH + 0.4, z: cz }));
    root.add(L.cyl(0.22, 0.28, 1.6, 10, L.std({ color: 0x8c8470, roughness: 0.85 }), { x: GREEN2_CX, y: CH + 1.6, z: cz }));
    [[-9, -2], [9, -2], [-9, 2], [9, 2], [0, 2.4]].forEach(([dx, dz], i) => {
      const x = GREEN2_CX + dx, z = cz + dz;
      if (i % 2 === 0) { const tr = P.makeTree({ big: L.chance(0.6) }); tr.position.set(x, CH, z); root.add(tr); colC(x, z, 0.55); treePts.push([x, z]); }
      else { const b = P.makeBench(); b.position.set(x, CH, z); b.rotation.y = L.rand(0, TAU); root.add(b); colC(x, z, 0.75); }
    });
    [[-GREEN2_HALF + 1, 0], [GREEN2_HALF - 1, 0]].forEach(([dx]) => { const lp = P.makeLamp(); lp.position.set(GREEN2_CX + dx, CH, cz); root.add(lp); colC(GREEN2_CX + dx, cz, 0.28); });
    // strollers
    for (let k = 0; k < 3; k++) { const n = C.makeNPC(); n.position.set(GREEN2_CX + L.rand(-GREEN2_HALF + 3, GREEN2_HALF - 3), CH, cz + L.rand(-gd / 2 + 1.5, gd / 2 - 1.5)); n.userData.npc = { speed: L.rand(0.4, 0.9) * (L.chance(0.5) ? 1 : -1), phase: L.rand(0, TAU), state: 'walk', timer: L.rand(2, 6), wave: 0, lane: n.position.z, kind: 'plaza', cx: n.position.x }; root.add(n); npcs.push(n); }
  })();

  // collision radius per furniture type (small enough to keep sidewalks navigable)
  const FURN_R = { lamp: 0.28, bench: 0.7, bin: 0.32, planter: 0.62, hydrant: 0.28, bollard: 0.22, tree: 0.5 };

  /* ── OVERHEAD WIRES — actually connected pole-to-pole with catenary sag.
     The tangled sky is half the Messenger street-level look. ── */
  const wireMat = L.std({ color: 0x2a2a30, roughness: 0.9 });
  const _wq = new T.Quaternion(), _wd = new T.Vector3(), _wz = new T.Vector3(0, 0, 1);
  function stringWire(x1, y1, z1, x2, y2, z2, sag) {
    const SEGN = 4; let prev = null;
    for (let i = 0; i <= SEGN; i++) {
      const t = i / SEGN;
      const x = x1 + (x2 - x1) * t, z = z1 + (z2 - z1) * t;
      const y = y1 + (y2 - y1) * t - Math.sin(Math.PI * t) * sag;
      if (prev) {
        _wd.set(x - prev.x, y - prev.y, z - prev.z);
        const len = _wd.length(); _wd.normalize();
        const seg = L.box(0.032, 0.032, len, wireMat, { x: (x + prev.x) / 2, y: (y + prev.y) / 2, z: (z + prev.z) / 2, cast: false });
        seg.quaternion.copy(_wq.setFromUnitVectors(_wz, _wd));
        root.add(seg);
      }
      prev = { x, y, z };
    }
  }
  // connect a run of poles ([x,z] points) with two sagging lines + a stray third
  function wireRun(pts) {
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
      const span = Math.hypot(bx - ax, bz - az);
      if (span < 4 || span > 95) continue;
      const sag = L.clamp(span * 0.035, 0.5, 2.0);
      stringWire(ax + 0.1, 7.05, az + 0.1, bx + 0.1, 7.05, bz + 0.1, sag);
      stringWire(ax - 0.12, 6.55, az - 0.12, bx - 0.12, 6.55, bz - 0.12, sag * 0.85);
      if (L.chance(0.5)) stringWire(ax, 7.05, az - 0.3, bx, 6.55, bz + 0.25, sag * 1.15);
    }
  }

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
     The plaza (avenue x≈0) and the two 4-way intersections (x=±86) are the focal
     hearts: props cluster tightest there and thin toward the avenue ends/park.
     Returns a 0..1 "near-focus" weight from the nearest focal point. */
  function focusW(x) {
    const d = Math.min(Math.abs(x), Math.abs(x - CROSSX), Math.abs(x - CROSSX2));
    return L.clamp(1 - d / 80, 0, 1);            // 1 at a heart → ~0 at the ends
  }
  // spacing step: keep the existing jitter, but scale it wider as we leave a heart.
  function densStep(x, lo, hi) { return L.rand(lo, hi) * (1.0 + 0.85 * (1 - focusW(x))); }

  /* ── STREET FURNITURE along the avenue sidewalks (helper, reused per avenue) ── */
  function avenueFurniture(avZ, x0, x1, opts) {
    const o = opts || {};
    [1, -1].forEach(side => {
      const zBase = avZ + side * (SW + 0.7);
      const SEQ = side > 0
        ? ['lamp', 'tree', 'bench', 'planter', 'lamp', 'tree', 'planter', 'bin', 'hydrant', 'lamp', 'tree', 'bollard']
        : ['lamp', 'bench', 'tree', 'planter', 'lamp', 'hydrant', 'tree', 'bench', 'lamp', 'planter', 'tree', 'bollard'];
      let x = x0 + 6, idx = 0;
      while (x < x1 - 6) {
        if (o.plazaGap && side > 0 && x > -PLAZA_HALF - 2 && x < PLAZA_HALF + 2) { x = PLAZA_HALF + 2; idx++; continue; }
        if (o.parkGap && side < 0 && x > PARK_CX - PARK_HALF && x < PARK_CX + PARK_HALF) { x = PARK_CX + PARK_HALF; idx++; continue; }
        if (o.greenGap && side < 0 && x > GREEN2_CX - GREEN2_HALF && x < GREEN2_CX + GREEN2_HALF) { x = GREEN2_CX + GREEN2_HALF; idx++; continue; }
        if (CROSSXS.some(cx => x > cx - (SW + SDW) && x < cx + (SW + SDW))) { const cx = CROSSXS.find(c => x > c - (SW + SDW) && x < c + (SW + SDW)); x = cx + (SW + SDW); idx++; continue; }
        const typ = SEQ[idx % SEQ.length];
        const obj = makeFurniture(typ); idx++;
        obj.position.set(x, CH, zBase); obj.rotation.y = side < 0 ? Math.PI : 0; root.add(obj);
        colC(x, zBase, FURN_R[typ] || 0.4); if (typ === 'tree') treePts.push([x, zBase]);
        x += densStep(x, 5.5, 8.5);
      }
      // utility poles + connected wires along the run
      const poleZ = avZ + side * (SW + SDW - 0.6), polePts = [];
      [-120, -60, -20, 40, 120].forEach(px => { if (px < x0 + 4 || px > x1 - 4) return; if (CROSSXS.some(cx => Math.abs(px - cx) < SW + SDW)) return; const up = P.makeUtilPole(); up.position.set(px, 0, poleZ); root.add(up); colC(px, poleZ, 0.25); polePts.push([px, poleZ]); });
      wireRun(polePts);
    });
  }
  avenueFurniture(0, -AVX, AVX, { plazaGap: true, parkGap: true });
  avenueFurniture(AV2Z, -AV2X, AV2X, { greenGap: true });
  /* ── STREET FURNITURE along the cross-street sidewalks (helper, both crosses) ── */
  function crossFurniture(cxx) {
    [1, -1].forEach(side => {
      const xBase = cxx + side * (SW + 0.7);
      const SEQ = ['lamp', 'tree', 'planter', 'bench', 'lamp', 'bin', 'tree', 'hydrant', 'lamp', 'tree', 'bollard'];
      let z = CROSSZ0 + 5, idx = side > 0 ? 0 : 4;
      while (z < CROSSZ1 - 5) {
        if (nearAnyAvenueZ(z)) { const az = AVZS.find(a => z > a - (SW + SDW) && z < a + (SW + SDW)); if (az != null) { z = az + (SW + SDW); idx++; continue; } }
        const typ = SEQ[idx % SEQ.length];
        const obj = makeFurniture(typ); idx++;
        obj.position.set(xBase, CH, z); obj.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2; root.add(obj);
        colC(xBase, z, FURN_R[typ] || 0.4); if (typ === 'tree') treePts.push([xBase, z]);
        // §5.3: dense near the avenue junctions, thinning toward block ends
        const cw = L.clamp(1 - Math.min(Math.abs(z), Math.abs(z - AV2Z)) / 26, 0, 1);
        z += L.rand(5.5, 8.0) * (1.0 + 0.7 * (1 - cw));
      }
      const poleX = cxx + side * (SW + SDW - 0.6), polePts = [];
      [CROSSZ0 + 8, -16, 16, AV2Z - 16, AV2Z + 12].forEach(pz => { if (nearAnyAvenueZ(pz)) return; if (pz < CROSSZ0 + 4 || pz > CROSSZ1 - 4) return; const up = P.makeUtilPole(); up.rotation.y = Math.PI / 2; up.position.set(poleX, 0, pz); root.add(up); colC(poleX, pz, 0.25); polePts.push([poleX, pz]); });
      wireRun(polePts);
    });
  }
  crossFurniture(CROSSX); crossFurniture(CROSSX2);

  /* ── PARKED CARS along curbs (both avenues + both cross-streets) ── */
  function parkAlongAvenue(avZ, x0, x1) {
    for (let x = x0 + 12; x < x1 - 12; x += L.rand(15, 24)) {
      if (avZ === 0 && Math.abs(x) < PLAZA_HALF + 6) continue;
      if (CROSSXS.some(cx => Math.abs(x - cx) < SW + 4)) continue;
      const side = L.chance(0.5) ? 1 : -1;
      const isTruck = L.chance(0.18);
      const car = (isTruck ? P.makeTruck() : P.makeCar());
      car.position.set(x, 0, avZ + side * (SW - 1.5));
      car.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2; // align length with street
      root.add(car);
      colB(x, avZ + side * (SW - 1.5), isTruck ? 2.9 : 2.2, 1.0);   // length lies along X
    }
  }
  parkAlongAvenue(0, -AVX, AVX);
  parkAlongAvenue(AV2Z, -AV2X, AV2X);
  CROSSXS.forEach(cxx => {
    for (let z = CROSSZ0 + 10; z < CROSSZ1 - 10; z += L.rand(16, 24)) {
      if (AVZS.some(az => Math.abs(z - az) < SW + 6)) continue;
      const side = L.chance(0.5) ? 1 : -1;
      const isTruck = L.chance(0.18);
      const car = (isTruck ? P.makeTruck() : P.makeCar());
      car.position.set(cxx + side * (SW - 1.5), 0, z);
      car.rotation.y = 0; // length lies along Z, front +Z — no rotation needed
      root.add(car);
      colB(cxx + side * (SW - 1.5), z, 1.0, isTruck ? 2.9 : 2.2);   // length lies along Z
    }
  });
  // a couple scooters near the plaza & corners
  [[-PLAZA_HALF - 8, 1], [PLAZA_HALF + 8, -1], [CROSSX2 + 8, 1]].forEach(([x, s]) => { const sc = P.makeScooter(); sc.position.set(x, CH, s * (SW + 1.6)); sc.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2; root.add(sc); colC(x, s * (SW + 1.6), 0.7); });

  /* ── ROAD-SURFACE STORYTELLING: cones, manholes, tar patches ── */
  const coneOr = L.std({ color: 0xd85c28, roughness: 0.88 });
  const coneWh = L.std({ color: 0xf0ead8, roughness: 0.8 });
  function makeCone(x, z) {
    const gc = new T.Group(); gc.position.set(x, 0, z); gc.rotation.y = L.rand(0, TAU);
    gc.add(L.box(0.34, 0.05, 0.34, coneOr, { y: 0.025, cast: false }));
    const c1 = new T.Mesh(new T.ConeGeometry(0.15, 0.5, 10), coneOr); c1.position.y = 0.3; c1.castShadow = true; gc.add(c1);
    gc.add(L.cyl(0.105, 0.125, 0.09, 10, coneWh, { y: 0.3, cast: false }));
    root.add(gc); colC(x, z, 0.17);
  }
  // a little roadwork cluster near each intersection + strays by the zebra crossings
  [[CROSSX, 0], [CROSSX2, 0], [CROSSX, AV2Z], [CROSSX2, AV2Z]].forEach(([cxx, cz]) => {
    const sx = L.chance(0.5) ? 1 : -1, sz = L.chance(0.5) ? 1 : -1;
    const bx = cxx + sx * (SW - 1.6), bz = cz + sz * (SW - 1.6);
    for (let i = 0; i < L.randInt(2, 3); i++) makeCone(bx + L.jitter(1.4), bz + L.jitter(1.4));
  });
  [-58, 40].forEach(x => { if (!nearAnyCrossX(x)) makeCone(x + L.rand(2, 4), L.pick([1, -1]) * (SW - 1.2)); });

  const mhMat = L.std({ color: 0x4a443c, roughness: 0.7, metalness: 0.3 });
  function manhole(x, z) {
    const m = new T.Mesh(new T.CircleGeometry(0.46, 14), mhMat);
    m.rotation.x = -Math.PI / 2; m.rotation.z = L.rand(0, TAU); m.position.set(x, 0.018, z); m.receiveShadow = true; root.add(m);
  }
  for (let x = -AVX + 15; x < AVX - 10; x += L.rand(24, 40)) { if (nearAnyCrossX(x)) continue; manhole(x + L.jitter(3), L.jitter(SW - 3)); }
  for (let x = -AV2X + 15; x < AV2X - 10; x += L.rand(26, 44)) { if (nearAnyCrossX(x)) continue; manhole(x, AV2Z + L.jitter(SW - 3)); }
  CROSSXS.forEach(cxx => { for (let z = CROSSZ0 + 12; z < CROSSZ1 - 10; z += L.rand(26, 40)) { if (AVZS.some(az => Math.abs(z - az) < SW + 3)) continue; manhole(cxx + L.jitter(SW - 3), z); } });

  const patchMat = L.std({ color: 0x554f47, roughness: 0.98 });
  for (let i = 0; i < 12; i++) {
    const onAv2 = L.chance(0.3);
    const x = L.rand(onAv2 ? -AV2X + 10 : -AVX + 10, onAv2 ? AV2X - 10 : AVX - 10);
    if (nearAnyCrossX(x)) continue;
    const p = L.decal(L.rand(1.6, 3.4), L.rand(1.2, 2.4), patchMat, 0.009);
    p.position.set(x, 0.009, (onAv2 ? AV2Z : 0) + L.jitter(SW - 2.5));
    p.rotation.z = L.jitter(0.5); root.add(p);
  }

  /* ── MOVING TRAFFIC on the avenues (along X) ── total ≤ 14 cars + tram ── */
  // main avenue (longer): 9 cars; second avenue: 5 cars
  [[0, -AVX, AVX, 9], [AV2Z, -AV2X, AV2X, 5]].forEach(([avZ, x0, x1, count]) => {
    for (let i = 0; i < count; i++) {
      const dir = i % 2 ? 1 : -1;             // +X or -X
      const lane = avZ + (dir > 0 ? -SW * 0.45 : SW * 0.45);  // drive-on-right
      const isTruck = L.chance(0.2);
      const car = (isTruck ? P.makeTruck() : P.makeCar());
      car.position.set(L.rand(x0 + 10, x1 - 10), 0, lane);
      car.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      car.userData.drive = { axis: 'x', dir, speed: L.rand(7, 12), lane, avZ, x0: x0 + 8, x1: x1 - 8, hl: isTruck ? 2.9 : 2.2, hw: 1.0 };
      root.add(car); cars.push(car);
    }
  });
  /* ── MOVING TRAFFIC on the cross-streets (along Z) — 3 per cross ── */
  CROSSXS.forEach(cxx => {
    for (let i = 0; i < 3; i++) {
      const dir = i % 2 ? 1 : -1;             // +Z or -Z
      const lane = dir > 0 ? SW * 0.45 : -SW * 0.45;  // drive-on-right
      const isTruck = L.chance(0.2);
      const car = (isTruck ? P.makeTruck() : P.makeCar());
      car.position.set(cxx + lane, 0, L.rand(CROSSZ0 + 10, CROSSZ1 - 10));
      car.rotation.y = dir > 0 ? 0 : Math.PI;  // front +Z to drive +Z; flip for -Z
      car.userData.drive = { axis: 'z', dir, speed: L.rand(6, 10), lane: cxx + lane, cxx, hl: isTruck ? 2.9 : 2.2, hw: 1.0 };
      root.add(car); cars.push(car);
    }
  });

  /* ── TRAM on the avenue (centre track) + rails ── */
  if (P.makeTram) {
    const railMat = L.std({ color: 0x4a4640, roughness: 0.5, metalness: 0.7 });
    [-0.7, 0.7].forEach(rz => { const rail = L.decal(AVX * 2, 0.12, railMat, 0.02); rail.position.z = rz; root.add(rail); });
    // overhead wire poles down the median
    for (let x = -AVX + 16; x < AVX - 16; x += 28) {
      root.add(L.cyl(0.08, 0.1, 6.2, 7, L.MAT.metalDark, { x, y: 3.1, z: 0, cast: true }));
      root.add(L.box(0.1, 0.1, 2.2, L.MAT.metalDark, { x, y: 5.9, z: 0, cast: false }));
      colC(x, 0, 0.22);
    }
    [1, -1].forEach(dir => {
      const tram = P.makeTram();
      tram.position.set(L.rand(-AVX + 20, AVX - 20), 0, 0);
      tram.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;   // front +Z → +X when dir>0
      tram.userData.drive = { axis: 'x', dir, speed: L.rand(8, 10), lane: 0, hl: 5.1, hw: 1.3 };
      root.add(tram); cars.push(tram);
    });
  }

  /* ── NPCS — walkers with a small state machine, plus seated folk & vendors ── */
  function spawnNPC(x, z, kind, cx, roam) {
    const n = C.makeNPC();
    n.position.set(x, CH, z);
    const fast = kind === 'kid';
    n.userData.npc = {
      kind, lane: z, cx: cx == null ? x : cx,
      lo: roam ? roam[0] : -(AVX - 7), hi: roam ? roam[1] : (AVX - 7),
      speed: L.rand(kind === 'plaza' ? 0.5 : 0.9, kind === 'plaza' ? 1.1 : (fast ? 2.4 : 1.7)) * (L.chance(0.5) ? 1 : -1),
      phase: L.rand(0, TAU),
      state: 'walk', timer: L.rand(2, 6), wave: 0,
    };
    root.add(n); npcs.push(n);
  }
  // main-avenue walkers (denser) + second-avenue walkers (a bit thinner) — ≤ ~40 here
  [1, -1].forEach(side => { for (let k = 0; k < 11; k++) spawnNPC(L.rand(-AVX + 8, AVX - 8), side * (SW + L.rand(1.6, SDW - 1.2)), L.chance(0.15) ? 'kid' : 'street'); });
  [1, -1].forEach(side => { for (let k = 0; k < 7; k++) spawnNPC(L.rand(-AV2X + 8, AV2X - 8), AV2Z + side * (SW + L.rand(1.6, SDW - 1.2)), L.chance(0.15) ? 'kid' : 'street', null, [-(AV2X - 7), AV2X - 7]); });
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

  /* ── STRING LIGHTS across an avenue (cozy festoon) — spans z=avZ±(ROWZ-4) ── */
  function stringLights(x0, avZ) {
    const cz = avZ || 0, S = ROWZ - 4, H = 7.6, sag = 2.4, N = 14;
    const bulbHex = L.pick(['#ffd27a', '#ff9a6a', '#aee0ff', '#ffe070', '#ffb0c0']);
    const bulbMat = L.MAT.emissive(bulbHex, 1.3);
    const cordMat = L.MAT.flat('#2a2620');
    let prev = null;
    for (let i = 0; i <= N; i++) {
      const t = i / N, z = cz - S + 2 * S * t, y = H - 4 * sag * t * (1 - t);
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
    if (!skipPlaza && !skipPark) stringLights(x, 0);
    x += 22 * (1.0 + 0.7 * (1 - focusW(x)));        // ~13m apart at a heart → ~37m at the ends
  }
  // festoon along the SECOND avenue too (sparser)
  for (let x = -AV2X + 24; x < AV2X - 24; ) {
    const skipGreen = x > GREEN2_CX - GREEN2_HALF - 6 && x < GREEN2_CX + GREEN2_HALF + 6;
    if (!skipGreen) stringLights(x, AV2Z);
    x += 26 * (1.0 + 0.6 * (1 - focusW(x)));
  }
  // a couple of festoon strands flanking the plaza mouth so the focal heart glows
  [-PLAZA_HALF - 7, PLAZA_HALF + 7].forEach(x => stringLights(x, 0));
  // festoon strands across each cross-street at its avenue intersections
  function crossFestoon(x, cz) {
    const S = SW + SDW + 3, H = 7.6, sag = 2.0, N = 12;
    const bulbMat = L.MAT.emissive('#ffd27a', 1.3), cordMat = L.MAT.flat('#2a2620');
    let prev = null;
    for (let i = 0; i <= N; i++) {
      const t = i / N, zz = cz - S + 2 * S * t, y = H - 4 * sag * t * (1 - t);
      if (i % 2 === 0) root.add(L.sphere(0.12, 8, bulbMat, { x, y, z: zz, cast: false }));
      if (prev) { const dy = y - prev.y, dz = zz - prev.z, len = Math.hypot(dy, dz); const seg = L.box(0.025, 0.025, len, cordMat, { x, y: (y + prev.y) / 2, z: (zz + prev.z) / 2, cast: false }); seg.rotation.x = -Math.atan2(dy, dz); root.add(seg); }
      prev = { y, z: zz };
    }
  }
  [[CROSSX, 0], [CROSSX2, 0], [CROSSX, AV2Z], [CROSSX2, AV2Z]].forEach(([x, cz]) => crossFestoon(x, cz));

  /* ── HANGING BANNERS over the streets ── */
  [[-44, '#c44a44', '#f4ecd8', 0], [44, '#2f7060', '#f4ecd8', 0], [-96, '#3a5d92', '#f4ecd8', 0], [-30, '#c8783a', '#f4ecd8', AV2Z], [30, '#8a5288', '#f3ecd9', AV2Z]].forEach(([x, a, b, cz]) => {
    const ban = L.box((ROWZ - 6) * 2, 1.1, 0.06, L.MAT.fabric(a, b, 6), { x, y: 8.2, z: cz, cast: false });
    ban.rotation.y = Math.PI / 2; root.add(ban);
    root.add(L.box(0.08, 0.08, (ROWZ - 6) * 2, L.MAT.flat('#2a2620'), { x, y: 8.8, z: cz, cast: false }));
  });

  /* ── AMBIENT LIFE: pigeons, dogs, circling birds ── */
  const birds = [];
  if (C.makePigeon) {
    for (let k = 0; k < 20; k++) {
      const pg = C.makePigeon();
      const where = L.rng();   // 0..0.4 plaza, 0.4..0.75 main avenue, 0.75..1 second avenue
      const gy = CH + 0.02;
      if (where < 0.4) pg.position.set(L.rand(-PLAZA_HALF, PLAZA_HALF), gy, SW + L.rand(2, 12));
      else if (where < 0.75) pg.position.set(L.rand(-AVX + 10, AVX - 10), gy, L.pick([1, -1]) * (SW + L.rand(1.5, SDW - 1)));
      else pg.position.set(L.rand(-AV2X + 10, AV2X - 10), gy, AV2Z + L.pick([1, -1]) * (SW + L.rand(1.5, SDW - 1)));
      pg.rotation.y = L.rand(0, TAU);
      pg.userData.pg = { gy, home: pg.position.clone(), phase: L.rand(0, TAU), flee: 0, hop: L.rand(1, 4) };
      root.add(pg); pigeons.push(pg);
    }
  }
  if (C.makeDog) {
    // dogs roam along X on a fixed lane (avZ + side*offset stored as `lane`)
    [[-30, SW + 2.2], [40, -(SW + 2.2)], [PARK_CX + 6, -(SW + 2.2)], [-20, AV2Z + (SW + 2.2)], [50, AV2Z - (SW + 2.2)]].forEach(([x, lane]) => {
      const d = C.makeDog(); d.position.set(x, CH, lane);
      d.userData.dog = { speed: L.rand(1.4, 2.2) * (L.chance(0.5) ? 1 : -1), lane, home: x, range: L.rand(10, 22), phase: L.rand(0, TAU) };
      root.add(d); dogs.push(d);
    });
  }
  // cats lounging on sidewalks / in the squares, and street musicians
  if (C.makeCat) {
    [[-50, SW + 2], [22, -(SW + 2)], [PARK_CX + 10, -(SW + 2)], [CROSSX + 4, SW + 2], [CROSSX2 - 4, -(SW + 2)], [GREEN2_CX + 6, AV2Z - (SW + 2)]].forEach(([x, lane]) => {
      const cat = C.makeCat(); cat.position.set(x, CH, lane + L.rand(-1, 1)); cat.rotation.y = L.rand(0, TAU); root.add(cat);
    });
  }
  if (C.makeStreetMusician) {
    [[2, SW + 9], [CROSSX, -ROWZ - 2], [GREEN2_CX, AV2Z - 4]].forEach(([x, z]) => {
      const mus = C.makeStreetMusician(); mus.position.set(x, CH, z); mus.rotation.y = L.rand(0, TAU); root.add(mus);
    });
  }
  // simple circling birds high up (spread over the wider map)
  const birdMat = L.MAT.flat('#3a3540');
  for (let k = 0; k < 9; k++) {
    const bd = new T.Group();
    const wl = L.box(0.5, 0.04, 0.18, birdMat, { x: -0.3, cast: false });
    const wr = L.box(0.5, 0.04, 0.18, birdMat, { x: 0.3, cast: false });
    bd.add(wl, wr); bd.add(L.box(0.18, 0.08, 0.4, birdMat, { cast: false }));
    bd.userData = { cx: L.rand(-90, 90), cz: L.rand(-10, AV2Z), r: L.rand(14, 30), a: L.rand(0, TAU), sp: L.rand(0.2, 0.45), yy: L.rand(22, 34), wl, wr };
    root.add(bd); birds.push(bd);
  }

  /* ── PERF: townsfolk/dogs/pigeons don't cast shadows (hundreds of tiny meshes
     re-rendered into the shadow map every frame). Buildings/trees/cars/the Fly
     still cast — those carry the scene's shadow read. ── */
  npcs.forEach(n => n.traverse(o => { o.castShadow = false; }));
  dogs.forEach(d => d.traverse(o => { o.castShadow = false; }));
  pigeons.forEach(p => p.traverse(o => { o.castShadow = false; }));

  /* ── PERF: BATCH STATIC GEOMETRY ──────────────────────────────────────────
     The town is ~9k separate meshes → ~9k draw calls/frame, tripled across the
     beauty/shadow/outline passes. Merge every STATIC mesh that shares a material
     into one geometry (baking world transforms) → a few hundred draw calls.
     Dynamic objects (npcs/cars/trams/dogs/pigeons/birds/fountains) and instanced
     windows are left untouched. Safe: a bucket is only collapsed if its merge
     succeeds. Merged materials are the same cached (cel + curvature) materials,
     so the look and the world-bend are preserved. */
  (function batchStatic() {
    const BU = (window.THREE && THREE.BufferGeometryUtils);
    if (!BU || !BU.mergeBufferGeometries) return;
    const dyn = new Set();
    [npcs, cars, dogs, pigeons, birds, fountains].forEach(arr => { if (arr) arr.forEach(o => o && dyn.add(o)); });
    const buckets = new Map();
    root.updateMatrixWorld(true);
    root.children.forEach(child => {
      if (dyn.has(child)) return;                       // leave dynamic groups
      child.traverse(o => {
        if (!o.isMesh || o.isInstancedMesh || !o.geometry || Array.isArray(o.material)) return;
        const key = o.material.uuid;
        let bk = buckets.get(key); if (!bk) { bk = { mat: o.material, meshes: [] }; buckets.set(key, bk); }
        bk.meshes.push(o);
      });
    });
    let merged = 0, removed = 0;
    buckets.forEach(bk => {
      if (bk.meshes.length < 2) return;                 // nothing to gain
      const geos = [];
      for (const o of bk.meshes) {
        let g = o.geometry.clone();
        if (g.index) g = g.toNonIndexed();
        g.applyMatrix4(o.matrixWorld);
        for (const name in g.attributes) { if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name); }
        geos.push(g);
      }
      let mg = null; try { mg = BU.mergeBufferGeometries(geos, false); } catch (e) { mg = null; }
      geos.forEach(g => g.dispose && g.dispose());
      if (!mg) return;                                  // leave originals intact on failure
      bk.meshes.forEach(o => { if (o.parent) o.parent.remove(o); o.geometry.dispose(); removed++; });
      const m = new T.Mesh(mg, bk.mat); m.castShadow = true; m.receiveShadow = true; root.add(m); merged++;
    });
    if (window.console) console.log('[FLY] batched static geometry:', removed, 'meshes ->', merged, 'merged draws');
  })();

  /* ── MICRO-DETAIL LAYER: grass, flowers, butterflies, leaves.
     Primary=buildings · secondary=trees/lamps · tertiary=clutter — this is the
     4th tier that makes the ground feel grown rather than tiled. ── */
  (function grassAndFlowers() {
    const BU = window.THREE && THREE.BufferGeometryUtils;
    if (!BU || !BU.mergeBufferGeometries) return;
    // one tuft = two small crossed blades
    const q1 = new T.PlaneGeometry(0.12, 0.15);
    const q2 = q1.clone(); q2.rotateY(Math.PI / 2);
    const tuftGeo = BU.mergeBufferGeometries([q1, q2], false);
    tuftGeo.translate(0, 0.07, 0);
    const parkCz = (-SW - (ROWZ + 7)) / 2, parkHd = ((ROWZ + 7) - SW) / 2;
    const gCz = ((AV2Z - SW - 1) + (ROW2ZF + 3.5)) / 2, gHd = ((AV2Z - SW - 1) - (ROW2ZF + 3.5)) / 2;
    function clearOfLandmarks(x, z) {
      if (Math.hypot(x - (PARK_CX + 8), z - (parkCz - 5)) < 5.4) return false;   // pond
      if (Math.hypot(x - (PARK_CX - 8), z - (parkCz + 4)) < 3.4) return false;   // gazebo
      if (Math.hypot(x - GREEN2_CX, z - gCz) < 1.6) return false;                // monument
      return true;
    }
    // grow in CLUMPS around cluster hearts — patches read as growth, scatter reads as confetti
    const spots = [];
    function clump(cx, cz2, n) {
      for (let k = 0; k < n; k++) {
        const x = cx + L.jitter(1.3), z = cz2 + L.jitter(1.3);
        if (clearOfLandmarks(x, z)) spots.push([x, z]);
      }
    }
    for (let c = 0; c < 34; c++) {   // park clumps (skip the cross paths)
      const x = PARK_CX + L.rand(-PARK_HALF + 2, PARK_HALF - 2), z = parkCz + L.rand(-parkHd + 2, parkHd - 2);
      if (Math.abs(x - PARK_CX) < 2.2 || Math.abs(z - parkCz) < 2.2) continue;
      clump(x, z, L.randInt(5, 9));
    }
    for (let c = 0; c < 12; c++) clump(GREEN2_CX + L.rand(-GREEN2_HALF + 2, GREEN2_HALF - 2), gCz + L.rand(-gHd + 1, gHd - 1), L.randInt(4, 7));
    // split per shade: guaranteed color variety with zero instanceColor dependence
    const GRASS_COLS = [0x41682f, 0x4d7a38, 0x578542];
    const buckets = GRASS_COLS.map(() => []);
    spots.forEach((s, i) => buckets[i % buckets.length].push(s));
    buckets.forEach((bkt, bi) => {
      if (!bkt.length) return;
      const im = new T.InstancedMesh(tuftGeo, L.std({ colorHex: '#' + GRASS_COLS[bi].toString(16).padStart(6, '0'), side: T.DoubleSide, roughness: 0.95 }), bkt.length);
      bkt.forEach(([x, z], i) => im.setMatrixAt(i, L.compose(x, CH, z, L.rand(0, TAU), 1, L.rand(0.7, 1.3), 1)));
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = false; im.receiveShadow = false;
      root.add(im);
    });
    // flower dots at some clump hearts (accent budget: warm + one cool)
    const FLOWER_COLS = ['#a8352c', '#b0741c', '#7a3f7a'];
    const fGeo = new T.SphereGeometry(0.045, 6, 5);
    FLOWER_COLS.forEach((fc, fi) => {
      const pts = spots.filter((s, i) => i % 9 === fi * 3);
      if (!pts.length) return;
      const fim = new T.InstancedMesh(fGeo, L.std({ colorHex: fc, roughness: 0.8 }), pts.length);
      pts.forEach(([x, z], i) => fim.setMatrixAt(i, L.compose(x + L.jitter(0.3), CH + 0.14, z + L.jitter(0.3), 0, 1, 1, 1)));
      fim.instanceMatrix.needsUpdate = true; fim.castShadow = false;
      root.add(fim);
    });
  })();

  /* butterflies — tiny two-wing flutters orbiting the green places */
  const butterflies = [];
  (function makeButterflies() {
    const anchors = [
      [PARK_CX + 4, (-SW - (ROWZ + 7)) / 2 + 2], [PARK_CX - 10, (-SW - (ROWZ + 7)) / 2 - 4],
      [GREEN2_CX + 4, ((AV2Z - SW - 1) + (ROW2ZF + 3.5)) / 2], [6, SW + 9], [-8, SW + 10],
    ];
    const COLS = [0xe8e2d0, 0xd8b14a, 0xb58ac8, 0xe0906a];
    for (let k = 0; k < 7; k++) {
      const g = new T.Group();
      const mat = new T.MeshBasicMaterial({ color: L.pick(COLS), side: T.DoubleSide });
      L.curve(mat);
      const pl = new T.Group(), pr = new T.Group();
      const wl = new T.Mesh(new T.PlaneGeometry(0.09, 0.07), mat); wl.position.x = -0.05;
      const wr = new T.Mesh(new T.PlaneGeometry(0.09, 0.07), mat); wr.position.x = 0.05;
      pl.add(wl); pr.add(wr); g.add(pl, pr);
      const [ax, az] = anchors[k % anchors.length];
      g.userData = { ax, az, a: L.rand(0, TAU), r: L.rand(1.5, 4), sp: L.rand(0.5, 0.9), ph: L.rand(0, TAU), pl, pr };
      root.add(g); butterflies.push(g);
    }
  })();

  /* falling leaves — drift down out of the planted trees, then respawn */
  const leaves = [];
  (function makeLeaves() {
    if (!treePts.length) return;
    const LCOLS = [0x4d7a34, 0x5d8542, 0x8a7a2c];
    for (let k = 0; k < 14; k++) {
      const mat = new T.MeshBasicMaterial({ color: L.pick(LCOLS), side: T.DoubleSide, transparent: true, opacity: 0.9 });
      L.curve(mat);
      const m = new T.Mesh(new T.PlaneGeometry(0.11, 0.08), mat);
      const [tx, tz] = L.pick(treePts);
      m.position.set(tx + L.jitter(0.8), L.rand(1.4, 3.4), tz + L.jitter(0.8));
      m.userData = { vy: L.rand(0.3, 0.55), ph: L.rand(0, TAU), sw: L.rand(0.4, 0.9) };
      root.add(m); leaves.push(m);
    }
  })();

  /* ── CHIMNEY SMOKE — soft puffs drifting off rooftop vents (post-batch, dynamic) ── */
  const smokes = [];
  smokePts.forEach(p => {
    for (let k = 0; k < 3; k++) {
      const mat = new T.MeshBasicMaterial({ color: 0xe8e2d4, transparent: true, opacity: 0, depthWrite: false });
      L.curve(mat);
      const m = new T.Mesh(new T.SphereGeometry(0.3, 8, 6), mat);
      m.position.copy(p);
      m.userData = { home: p, t: k / 3 + L.rand(0, 0.2), speed: L.rand(0.13, 0.19), driftX: L.rand(-0.15, 0.3), phase: L.rand(0, TAU) };
      root.add(m); smokes.push(m);
    }
  });

  /* ── UPDATE ── */
  // bounds enclose the WHOLE grid: main avenue (x ±AVX), the two cross-streets &
  // their rows (down to CROSSZ0, up to CROSSZ1 past the second avenue), the
  // second-avenue north row, the park (-Z) and the clock tower (+Z).
  const bounds = {
    minX: -AVX - 4, maxX: AVX + 4,
    minZ: -(ROWZ + 14),                      // park / south cross-rows
    maxZ: CROSSZ1 + 6,                       // second-avenue north row / cross-street north ends
    minY: 2.2, maxY: 46,
  };
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
      const lim = u.kind === 'plaza' ? (u.cx + 8) : u.hi;
      const lo = u.kind === 'plaza' ? (u.cx - 8) : u.lo;
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
      // wings: rapid flap while fleeing, fold back at rest
      const wings = pg.userData.wings;
      if (wings) {
        const f = u.flee > 0 ? Math.sin(now * 0.05 + u.phase) * 0.95 : 0;
        for (const wp of wings) wp.rotation.z += (wp.userData.side * f - wp.rotation.z) * Math.min(1, dt * 14);
      }
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
    // ── traffic (wraps within each car's own street extent) ──
    for (const car of cars) {
      const d = car.userData.drive;
      if (d.axis === 'z') {
        car.position.z += d.dir * d.speed * dt;
        if (d.dir > 0 && car.position.z > CROSSZ1 - 6) car.position.z = CROSSZ0 + 6;
        if (d.dir < 0 && car.position.z < CROSSZ0 + 6) car.position.z = CROSSZ1 - 6;
      } else {
        const x0 = d.x0 == null ? -AVX + 8 : d.x0, x1 = d.x1 == null ? AVX - 8 : d.x1;
        car.position.x += d.dir * d.speed * dt;
        if (d.dir > 0 && car.position.x > x1) car.position.x = x0;
        if (d.dir < 0 && car.position.x < x0) car.position.x = x1;
      }
      if (car.userData.wheels) car.userData.wheels.forEach(w => w.rotation.x += d.speed * dt * 1.5);
    }
    // fountain water shimmer
    for (const f of fountains) f.userData.water.forEach((w, i) => { w.position.y += Math.sin(now * 0.005 + i) * 0.0006; });
    // chimney smoke: rise, drift, swell, fade, recycle
    for (const s of smokes) {
      const u = s.userData;
      u.t += dt * u.speed; if (u.t > 1) u.t -= 1;
      const t = u.t;
      s.position.set(u.home.x + t * u.driftX * 6 + Math.sin(now * 0.001 + u.phase) * 0.3 * t, u.home.y + t * 3.4, u.home.z + t * 0.6);
      s.scale.setScalar(0.5 + t * 1.7);
      s.material.opacity = 0.32 * Math.sin(Math.PI * Math.min(1, t * 1.15));
    }
    // butterflies: lazy orbit + fast wing flap, always facing travel
    for (const bf of butterflies) {
      const u = bf.userData;
      u.a += u.sp * dt * (0.7 + 0.3 * Math.sin(now * 0.0007 + u.ph));
      const r = u.r + Math.sin(now * 0.0011 + u.ph) * 0.8;
      bf.position.set(u.ax + Math.cos(u.a) * r, CH + 0.9 + Math.sin(now * 0.0021 + u.ph) * 0.45, u.az + Math.sin(u.a) * r);
      bf.rotation.y = -u.a;
      const flap = 0.25 + Math.abs(Math.sin(now * 0.024 + u.ph)) * 1.05;
      u.pl.rotation.y = flap; u.pr.rotation.y = -flap;
    }
    // falling leaves: tumble down with sway, respawn in another tree
    for (const lf of leaves) {
      const u = lf.userData;
      lf.position.y -= u.vy * dt;
      lf.position.x += Math.sin(now * 0.0016 + u.ph) * u.sw * dt;
      lf.rotation.x += dt * 1.6; lf.rotation.z += dt * 0.9;
      lf.material.opacity = Math.min(0.9, (lf.position.y - CH) * 2.4);
      if (lf.position.y < CH + 0.03) {
        const [tx, tz] = L.pick(treePts);
        lf.position.set(tx + L.jitter(0.9), L.rand(1.6, 3.4), tz + L.jitter(0.9));
      }
    }
    // circling birds
    for (const bd of birds) {
      const u = bd.userData; u.a += u.sp * dt;
      bd.position.set(u.cx + Math.cos(u.a) * u.r, u.yy + Math.sin(now * 0.001 + u.cx) * 1.2, u.cz + Math.sin(u.a) * u.r);
      bd.rotation.y = -u.a + Math.PI / 2;
      const flap = Math.sin(now * 0.02 + u.cx) * 0.5;
      u.wl.rotation.z = flap; u.wr.rotation.z = -flap;
    }
  }

  /* minimap layout — the hand-authored street grid, so the HUD can draw a real map */
  const layout = {
    AVX, SW, AV2Z, AV2X, CROSSX, CROSSX2, CROSSZ0, CROSSZ1,
    plaza: { x: 0, z: (SW + ROWZ + 7) / 2, hw: PLAZA_HALF, hd: ((ROWZ + 7) - SW) / 2 },
    park: { x: PARK_CX, z: (-SW - (ROWZ + 7)) / 2, hw: PARK_HALF, hd: ((ROWZ + 7) - SW) / 2 },
    green: { x: GREEN2_CX, z: ((AV2Z - SW - 1) + (ROW2ZF + 3.5)) / 2, hw: GREEN2_HALF, hd: ((AV2Z - SW - 1) - (ROW2ZF + 3.5)) / 2 },
  };

  return { addresses, update, bounds, spawn, colliders, floors, layout, traffic: cars, npcs };
}

FLY.world = { build };
})();
