/* ════════════════════════════════════════════════════════════════════════
   THE FLY — town/buildings.js   (HAND-CRAFTED VARIETY)
   Contract (do NOT break — world.js & game.js depend on it):
     • FLY.buildings = { make, ARCHETYPES, heightOf }
     • make(spec) -> THREE.Group : footprint CENTERED at origin (x,z),
       base at y=0, FRONT (shopfront/signage/main windows) FACES +Z.
       Self-contained: own instanced windows, own rooftop clutter.
     • heightOf(spec) -> total height (floor-based; anchors/markers use it).
     • ARCHETYPES = supported archetype strings.
   spec: { w, d, floors, archetype, wall, trim, accent, name, signColor,
           awning:[a,b]|null, extras:[...subset], seed }
   r128: NO CapsuleGeometry. MeshStandardMaterial only. Windows are instanced.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
const L = FLY.lib, T = L.T, TAU = L.TAU;
const FLOOR_H = 3.0, GROUND_H = 2.4;
const ARCHETYPES = ['shop', 'apartment', 'cafe', 'civic', 'townhouse', 'corner'];
const heightOf = spec => GROUND_H + (spec && spec.floors || 3) * FLOOR_H;

/* shared unit geometries (reused across every building for performance) */
const UNIT_PLANE = new T.PlaneGeometry(1, 1);
const UNIT_BOX = new T.BoxGeometry(1, 1, 1);

/* ── small helpers ─────────────────────────────────────────────────────── */
function darker(hex, mul) { // returns "#rrggbb"
  const n = parseInt(hex.replace('#', ''), 16);
  let r = Math.max(0, Math.min(255, ((n >> 16) & 255) * mul)) | 0;
  let gg = Math.max(0, Math.min(255, ((n >> 8) & 255) * mul)) | 0;
  let b = Math.max(0, Math.min(255, (n & 255) * mul)) | 0;
  return '#' + ((1 << 24) + (r << 16) + (gg << 8) + b).toString(16).slice(1);
}
function mix(h1, h2, t) {
  const a = parseInt(h1.replace('#', ''), 16), b = parseInt(h2.replace('#', ''), 16);
  const r = (((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t) | 0;
  const g = (((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t) | 0;
  const bl = ((a & 255) * (1 - t) + (b & 255) * t) | 0;
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
}

/* ── ROOF PALETTE / MATERIAL (ART BIBLE §2.3, §5.4) ──────────────────────────
   Rooftops are the player's #1 aerial surface. Bias selection ~65% toward the
   THREE terracotta tiles (the first three entries of PAL.roofs) so the roofscape
   reads as one warm tiled field; the weathered timber / slate-green / oxblood
   tones are the minority relief. */
function pickRoof() {
  const roofs = L.PAL.roofs;               // [terracotta×3, ...relief]
  const terra = roofs.slice(0, 3);         // a85f43 / 9c5740 / b56b48
  return L.chance(0.65) ? L.pick(terra) : L.pick(roofs);
}
/* matte roof-tile material (§3.1: roof tile roughness 0.88, metalness 0) */
function roofTileMat(hex) {
  return L.std({ color: parseInt(hex.replace('#', '0x')), roughness: 0.88, metalness: 0 });
}

/* ── PITCHED / HIPPED TILED ROOF CAP ─────────────────────────────────────────
   A low tiled cap that gives an archetype silhouette interest from the air
   (replaces the flat parapet when used). Two ridge orientations:
     ridge 'x' → gable faces ±Z (slopes shed toward ±X)
     ridge 'z' → gable faces ±X (slopes shed toward ±Z)
   When hip is true, the ends are also sloped (4-sided hipped cap = no gable).
   Returns nothing; adds straight to g. Caller supplies eave height (topY). */
function pitchedRoof(g, w, d, topY, roofHex, opts) {
  opts = opts || {};
  const tileMat = roofTileMat(roofHex);
  const eaveMat = roofTileMat(darker(roofHex, 0.82));
  const ridgeAlongX = opts.ridge !== 'z';        // default ridge runs along X (gables ±Z)
  const span = ridgeAlongX ? w : d;              // horizontal distance the slopes cover
  const len  = ridgeAlongX ? d : w;              // ridge length
  const capH = opts.capH != null ? opts.capH : Math.min(span * 0.28, 1.7);
  const over = 0.28;                             // eave overhang
  const slopeW = Math.sqrt((span / 2) * (span / 2) + capH * capH) + over;
  const tilt = Math.atan2(capH, span / 2);
  // two main slopes
  for (const side of [-1, 1]) {
    const slope = L.box(
      ridgeAlongX ? slopeW : len + over * 2,
      0.16,
      ridgeAlongX ? len + over * 2 : slopeW,
      tileMat,
      { x: ridgeAlongX ? side * span / 4 : 0, y: topY + capH / 2, z: ridgeAlongX ? 0 : side * span / 4 }
    );
    slope.rotation[ridgeAlongX ? 'z' : 'x'] = (ridgeAlongX ? side : -side) * tilt;
    g.add(slope);
  }
  // ridge cap beam
  g.add(L.box(
    ridgeAlongX ? 0.2 : len + 0.1,
    0.14,
    ridgeAlongX ? len + 0.1 : 0.2,
    eaveMat,
    { y: topY + capH + 0.02, cast: false }
  ));
  if (opts.hip) {
    // hipped: triangular end slopes instead of gable walls (4-sided cap)
    for (const end of [-1, 1]) {
      const endTilt = Math.atan2(capH, len / 2);
      const endSlopeW = Math.sqrt((len / 2) * (len / 2) + capH * capH) + over;
      const es = L.box(
        ridgeAlongX ? w + over * 2 : endSlopeW,
        0.15,
        ridgeAlongX ? endSlopeW : d + over * 2,
        tileMat,
        { x: ridgeAlongX ? 0 : end * len / 4, y: topY + capH / 2, z: ridgeAlongX ? end * len / 4 : 0 }
      );
      es.rotation[ridgeAlongX ? 'x' : 'z'] = (ridgeAlongX ? -end : end) * endTilt;
      g.add(es);
    }
  } else {
    // gable end walls fill the triangle under each slope end
    const gw = ridgeAlongX ? w : d;
    const wallMat = opts.gableMat || tileMat;
    for (const end of [-1, 1]) {
      const gable = new T.Shape();
      gable.moveTo(-gw / 2, 0); gable.lineTo(gw / 2, 0); gable.lineTo(0, capH); gable.lineTo(-gw / 2, 0);
      const gGeo = new T.ExtrudeGeometry(gable, { depth: 0.18, bevelEnabled: false });
      const gm = new T.Mesh(gGeo, wallMat);
      if (ridgeAlongX) { gm.position.set(0, topY, end * (d / 2 - 0.09)); }
      else { gm.position.set(end * (w / 2 - 0.09), topY, 0); gm.rotation.y = Math.PI / 2; }
      gm.castShadow = true; g.add(gm);
    }
  }
}

/* a thin railing built from balusters + top/bottom rails (added straight to g) */
function railing(g, cx, y, z, span, height, mat, bars) {
  const n = bars || Math.max(4, Math.round(span / 0.42));
  const x0 = cx - span / 2;
  for (let i = 0; i <= n; i++) {
    const x = x0 + (span / n) * i;
    g.add(L.box(0.05, height, 0.05, mat, { x, y: y + height / 2, z, cast: false }));
  }
  g.add(L.box(span + 0.08, 0.07, 0.07, mat, { x: cx, y: y + height, z, cast: false }));
  g.add(L.box(span + 0.08, 0.05, 0.07, mat, { x: cx, y: y + height * 0.5, z, cast: false }));
}

/* a flower box (planter + blooms) hung under a window */
function flowerBox(g, x, y, z, foliageMat) {
  g.add(L.box(1.0, 0.22, 0.3, L.MAT.wood('#6b4a30'), { x, y, z }));
  const palette = ['#d8506a', '#e8a030', '#dcd040', '#c060a8', '#e85850', '#f0f0e0'];
  for (let i = 0; i < 5; i++) {
    g.add(L.box(0.16, 0.18, 0.16, foliageMat, { x: x - 0.4 + i * 0.2, y: y + 0.2, z: z + L.jitter(0.05), cast: false }));
    if (L.chance(0.7)) g.add(L.box(0.1, 0.1, 0.1, L.MAT.flat(L.pick(palette)), { x: x - 0.4 + i * 0.2 + L.jitter(0.05), y: y + 0.32, z: z + 0.04, cast: false }));
  }
}

/* a colored shutter pair flanking a window opening */
function shutters(g, x, y, z, wH, mat) {
  const sw = 0.42, sh = wH;
  g.add(L.box(sw, sh, 0.06, mat, { x: x - 0.62, y, z }));
  g.add(L.box(sw, sh, 0.06, mat, { x: x + 0.62, y, z }));
  // slat lines (darker tone on the shutter face)
  const slatMat = L.MAT.flat('#2a2620');
  for (const sx of [x - 0.62, x + 0.62]) {
    for (let k = 0; k < 3; k++) g.add(L.box(sw - 0.06, 0.03, 0.04, slatMat, { x: sx, y: y - sh / 2 + sh * (0.25 + k * 0.25), z: z + 0.04, cast: false }));
  }
}

/* ── WINDOWS (instanced) ───────────────────────────────────────────────────
   Collect Matrix4 in LOCAL space; add InstancedMesh children so windows
   move with the group. winW/winH let each archetype set proportions.       */
function buildWindows(g, opts) {
  const { w, h, floors, frontZ, backZ, sideX, winW, winH, litP, startFloor, doSides, doBack } = opts;
  const dark = [], lit = [], frame = [], sill = [];
  const cols = Math.max(2, Math.floor(w / 2.5));
  const gap = w / cols;
  const f0 = startFloor || 0;
  // FRONT + BACK
  for (let f = f0; f < floors; f++) {
    const wy = GROUND_H + 0.55 + f * FLOOR_H;
    if (wy + winH / 2 + 0.4 > h - 0.4) break;
    for (let ci = 0; ci < cols; ci++) {
      const wx = -w / 2 + gap * (ci + 0.5);
      (L.chance(litP) ? lit : dark).push(L.compose(wx, wy, frontZ + 0.05, 0, winW, winH, 1));
      frame.push(L.compose(wx, wy, frontZ + 0.03, 0, winW + 0.22, winH + 0.26, 1));
      sill.push(L.compose(wx, wy - winH / 2 - 0.12, frontZ + 0.12, 0, winW + 0.34, 0.12, 0.34));
      if (doBack) {
        (L.chance(litP) ? lit : dark).push(L.compose(wx, wy, backZ - 0.05, Math.PI, winW, winH, 1));
        frame.push(L.compose(wx, wy, backZ - 0.03, Math.PI, winW + 0.22, winH + 0.26, 1));
      }
    }
  }
  // SIDES
  if (doSides) {
    const dcols = Math.max(1, Math.floor((sideX * 2) / 3.0));
    const dgap = (sideX * 2) / dcols;
    for (let f = Math.max(f0, 1); f < floors; f++) {
      const wy = GROUND_H + 0.55 + f * FLOOR_H;
      if (wy + winH / 2 + 0.4 > h - 0.4) break;
      for (let ci = 0; ci < dcols; ci++) {
        const wz = -sideX + dgap * (ci + 0.5);
        const m1 = L.compose(0, wy, wz, Math.PI / 2, winW, winH, 1); m1.setPosition(w / 2 + 0.05, wy, wz);
        const m2 = L.compose(0, wy, wz, -Math.PI / 2, winW, winH, 1); m2.setPosition(-w / 2 - 0.05, wy, wz);
        (L.chance(litP * 0.7) ? lit : dark).push(m1);
        (L.chance(litP * 0.7) ? lit : dark).push(m2);
      }
    }
  }
  const sm = L.instanced(UNIT_BOX, L.MAT.trim('#e7ddc8'), sill); if (sm) g.add(sm);
  const fm = L.instanced(UNIT_PLANE, L.MAT.glassFrame, frame); if (fm) g.add(fm);
  const dm = L.instanced(UNIT_PLANE, L.MAT.glass, dark); if (dm) g.add(dm);
  const lm = L.instanced(UNIT_PLANE, L.MAT.glassLit, lit); if (lm) g.add(lm);
}

/* ── SHARED CORNICES / STRING COURSES ──────────────────────────────────── */
function bandsAndCornice(g, w, d, h, floors, trimMat, opts) {
  opts = opts || {};
  // string course between every floor
  for (let f = 1; f <= floors; f++) {
    const y = GROUND_H + f * FLOOR_H - 0.18;
    if (y > h - 0.5) break;
    g.add(L.box(w + 0.14, 0.18, d + 0.14, trimMat, { y, cast: false }));
  }
  // ground-floor base course
  g.add(L.box(w + 0.18, 0.5, d + 0.18, trimMat, { y: 0.25, cast: false, receive: true }));
  // main cornice
  if (opts.cornice !== false) {
    g.add(L.box(w + 0.36, 0.4, d + 0.36, trimMat, { y: h - 0.06 }));
    g.add(L.box(w + 0.5, 0.12, d + 0.5, trimMat, { y: h + 0.16, cast: false }));
  }
}

/* ── ROOFTOP CLUTTER ───────────────────────────────────────────────────── */
function rooftop(g, w, d, topY, wallMat, opts) {
  opts = opts || {};
  // flat tar roof deck
  g.add(L.box(w - 0.3, 0.08, d - 0.3, L.MAT.flat('#46423b'), { y: topY + 0.04, cast: false }));
  // parapet (unless a pitched cap covers it)
  if (!opts.noParapet) {
    g.add(L.box(w + 0.12, 0.5, 0.18, wallMat, { y: topY + 0.25, z: d / 2 }));
    g.add(L.box(w + 0.12, 0.5, 0.18, wallMat, { y: topY + 0.25, z: -d / 2 }));
    g.add(L.box(0.18, 0.5, d + 0.12, wallMat, { y: topY + 0.25, x: w / 2 }));
    g.add(L.box(0.18, 0.5, d + 0.12, wallMat, { y: topY + 0.25, x: -w / 2 }));
  }
  // water tank with bands (banded barrel)
  if (L.chance(0.55)) {
    const r = L.rand(0.55, 0.8), hh = L.rand(1.1, 1.7);
    const tx = L.jitter(w / 4), tz = -L.rand(d / 8, d / 3);
    // legs
    for (const dx of [-1, 1]) for (const dz of [-1, 1])
      g.add(L.box(0.08, 0.5, 0.08, L.MAT.metalDark, { x: tx + dx * r * 0.6, y: topY + 0.25, z: tz + dz * r * 0.6, cast: false }));
    g.add(L.cyl(r, r, hh, 12, L.MAT.wood('#9a7a52'), { x: tx, y: topY + 0.5 + hh / 2, z: tz }));
    for (let b = 0; b < 3; b++) g.add(L.cyl(r + 0.02, r + 0.02, 0.06, 12, L.MAT.metalDark, { x: tx, y: topY + 0.5 + hh * (0.2 + b * 0.3), z: tz, cast: false }));
    g.add(L.cyl(r * 0.55, r, 0.4, 12, L.MAT.metalDark, { x: tx, y: topY + 0.5 + hh + 0.18, z: tz, cast: false }));
  }
  // AC units with grills
  const acN = 1 + (L.rng() * 3 | 0);
  for (let i = 0; i < acN; i++) {
    const aw = L.rand(0.7, 1.1), ah = L.rand(0.4, 0.6), ad = L.rand(0.5, 0.8);
    const ax = L.jitter(w / 3), az = L.jitter(d / 3);
    g.add(L.box(aw, ah, ad, L.MAT.flat('#a6a097'), { x: ax, y: topY + ah / 2 + 0.1, z: az }));
    // grill lines
    for (let k = 0; k < 4; k++) g.add(L.box(aw - 0.12, 0.02, 0.02, L.MAT.metalDark, { x: ax, y: topY + 0.16 + k * 0.08, z: az + ad / 2, cast: false }));
  }
  // vents / pipes
  if (L.chance(0.6)) {
    const vx = L.jitter(w / 3), vz = L.jitter(d / 3);
    g.add(L.cyl(0.14, 0.14, L.rand(0.6, 1.1), 8, L.MAT.metalDark, { x: vx, y: topY + 0.5, z: vz, cast: false }));
    g.add(L.cyl(0.2, 0.2, 0.12, 8, L.MAT.metalLight, { x: vx, y: topY + 0.95, z: vz, cast: false }));
  }
  // antenna
  if (L.chance(0.45)) {
    const ax = L.jitter(w / 3), az = L.jitter(d / 4);
    g.add(L.cyl(0.025, 0.04, L.rand(2, 3.2), 5, L.MAT.metalLight, { x: ax, y: topY + 1.3, z: az, cast: false }));
  }
  // occasional rooftop garden
  if (opts.garden && L.chance(0.5)) {
    const gx = L.jitter(w / 4);
    g.add(L.box(1.4, 0.3, 0.5, L.MAT.wood('#6b4a30'), { x: gx, y: topY + 0.2, z: L.rand(0, d / 4) }));
    for (let i = 0; i < 4; i++) g.add(L.box(0.22, 0.4, 0.22, L.std({ color: 0x5a8c48, roughness: 0.9 }), { x: gx - 0.5 + i * 0.33, y: topY + 0.5, z: L.rand(0, d / 4), cast: false }));
  }
}

/* downpipe on a side corner */
function downpipe(g, w, h, frontZ) {
  const px = (L.chance(0.5) ? 1 : -1) * (w / 2 - 0.15);
  g.add(L.cyl(0.1, 0.1, h - 0.4, 8, L.MAT.metalDark, { x: px, y: (h - 0.4) / 2, z: frontZ - 0.12, cast: false }));
  // bracket clamps
  for (let k = 1; k < Math.floor(h / 3); k++) g.add(L.box(0.18, 0.08, 0.18, L.MAT.metalDark, { x: px, y: k * 3, z: frontZ - 0.12, cast: false }));
}

/* a small wall lamp (bracket arm + lit shade) */
function wallLamp(g, x, y, z) {
  g.add(L.box(0.06, 0.06, 0.35, L.MAT.metalDark, { x, y, z: z + 0.18, cast: false }));
  g.add(L.box(0.22, 0.16, 0.22, L.MAT.emissive('#ffce7a', 1.2), { x, y: y - 0.06, z: z + 0.36, cast: false }));
}

/* ── SHOPFRONT (ground retail) — recessed glass, door, bulkhead, blade sign  */
function shopfront(g, spec, w, frontZ, opts) {
  opts = opts || {};
  const sfH = opts.tall ? GROUND_H - 0.2 : 2.05;
  const fz = frontZ;
  const inset = 0.35;
  const bayW = w - 1.0;
  // stallriser (bulkhead) under the glass
  g.add(L.box(bayW + 0.4, 0.55, 0.18, L.MAT.wood(darker(spec.wall, 0.7)), { y: 0.3, z: fz + 0.04 }));
  // recessed glass plane (set back)
  g.add(L.box(bayW, sfH, 0.06, L.MAT.glass, { y: 0.55 + sfH / 2, z: fz - inset, cast: false }));
  // interior warm glow hint
  g.add(L.box(bayW - 0.2, sfH - 0.2, 0.04, L.MAT.emissive('#ffe6b0', 0.35), { y: 0.55 + sfH / 2, z: fz - inset - 0.06, cast: false }));
  // mullions (frame grid)
  const frameMat = L.MAT.wood(darker(spec.trim || '#e8dcc0', 0.85));
  g.add(L.box(bayW + 0.3, 0.16, 0.2, frameMat, { y: 0.55 + sfH + 0.08, z: fz, cast: false }));        // lintel
  g.add(L.box(bayW + 0.3, 0.16, 0.2, frameMat, { y: 0.55, z: fz, cast: false }));                      // base
  const mulN = Math.max(2, Math.round(bayW / 1.4));
  for (let i = 0; i <= mulN; i++) {
    const mx = -bayW / 2 + (bayW / mulN) * i;
    g.add(L.box(0.1, sfH, 0.16, frameMat, { x: mx, y: 0.55 + sfH / 2, z: fz, cast: false }));
  }
  // side pilasters framing the bay
  for (const sx of [-1, 1]) g.add(L.box(0.3, GROUND_H, 0.28, frameMat, { x: sx * (w / 2 - 0.1), y: GROUND_H / 2, z: fz - 0.04 }));
  // recessed entry door, off-center
  const doorX = (L.chance(0.5) ? 1 : -1) * (bayW / 2 - 0.85);
  const doorCol = L.pick(['#4a3020', '#2a4050', '#303828', '#4a3840', '#52301e']);
  g.add(L.box(1.2, 2.1, 0.12, L.MAT.wood(doorCol), { x: doorX, y: 1.05 + 0.05, z: fz - inset + 0.12 }));
  g.add(L.box(0.5, 0.5, 0.05, L.MAT.glass, { x: doorX, y: 1.7, z: fz - inset + 0.19, cast: false }));     // door window
  g.add(L.cyl(0.04, 0.04, 0.5, 6, L.MAT.chrome, { x: doorX + 0.4, y: 1.05, z: fz - inset + 0.2, cast: false })); // handle
  // sign board fascia spanning the shopfront
  if (spec.name && opts.fascia !== false) {
    const sgT = L.signTex(spec.name, spec.signColor || L.pick(L.PAL.signbg));
    const board = new T.Mesh(new T.PlaneGeometry(Math.min(w - 0.6, bayW + 0.2), 0.78), L.std({ map: sgT, roughness: 0.55 }));
    board.position.set(0, GROUND_H + 0.05, fz + 0.13); g.add(board);
    // board frame
    g.add(L.box(Math.min(w - 0.5, bayW + 0.3), 0.92, 0.12, frameMat, { y: GROUND_H + 0.05, z: fz + 0.06, cast: false }));
  }
}

/* perpendicular HANGING BLADE sign (sticks out from facade) */
function bladeSign(g, spec, w, frontZ, neon) {
  const name = spec.name || 'TIENDA';
  const y = GROUND_H + 0.7;
  const armX = w / 2 - 0.5;
  // bracket arm
  g.add(L.box(0.9, 0.08, 0.08, L.MAT.metalDark, { x: armX - 0.45, y: y + 0.55, z: frontZ + 0.4, cast: false }));
  g.add(L.box(0.08, 0.55, 0.08, L.MAT.metalDark, { x: armX - 0.9, y: y + 0.28, z: frontZ + 0.4, cast: false }));
  if (neon) {
    const glow = L.pick(['#40a8e0', '#ff8060', '#d060f0', '#f0a830', '#30c8f0', '#50e0a0']);
    const nT = L.neonTex(name, glow);
    const bl = new T.Mesh(new T.PlaneGeometry(1.3, 0.7), L.std({ map: nT, emissive: parseInt(glow.replace('#', '0x')), emissiveMap: nT, emissiveIntensity: 1.5, roughness: 0.25 }));
    bl.position.set(armX - 0.45, y, frontZ + 0.42); bl.rotation.y = Math.PI / 2; g.add(bl);
    const bl2 = bl.clone(); bl2.rotation.y = -Math.PI / 2; bl2.position.z = frontZ + 0.38; g.add(bl2);
  } else {
    const sgT = L.signTex(name, spec.signColor || L.pick(L.PAL.signbg));
    const bl = new T.Mesh(new T.PlaneGeometry(1.3, 0.62), L.std({ map: sgT, roughness: 0.5 }));
    bl.position.set(armX - 0.45, y, frontZ + 0.42); bl.rotation.y = Math.PI / 2; g.add(bl);
    const bl2 = bl.clone(); bl2.rotation.y = -Math.PI / 2; bl2.position.z = frontZ + 0.38; g.add(bl2);
    g.add(L.box(1.4, 0.08, 0.1, L.MAT.metalDark, { x: armX - 0.45, y: y + 0.34, z: frontZ + 0.4, cast: false }));
  }
}

/* sloped striped awning over the shopfront */
function awning(g, pair, w, frontZ, opts) {
  opts = opts || {};
  const awMat = L.MAT.fabric(pair[0], pair[1], opts.stripes || 12);
  const aw = w - 0.6, depth = opts.depth || 1.6, y = opts.y || (GROUND_H - 0.55);
  const sheet = L.box(aw, 0.08, depth, awMat, { y, z: frontZ + depth / 2 - 0.1 });
  sheet.rotation.x = 0.34; g.add(sheet);
  // scalloped valance
  g.add(L.box(aw, 0.34, 0.05, awMat, { y: y - depth * 0.27, z: frontZ + depth * 0.78, cast: false }));
  // support arms
  for (const sx of [-1, 1]) g.add(L.box(0.05, 0.05, depth, L.MAT.metalDark, { x: sx * (aw / 2 - 0.2), y: y - 0.05, z: frontZ + depth / 2 - 0.1, cast: false }));
}

/* string lights swag (for cafe / festive) */
function stringLights(g, w, frontZ, y) {
  const n = Math.max(5, Math.round(w / 0.9));
  for (let i = 0; i <= n; i++) {
    const x = -w / 2 + (w / n) * i;
    const sag = Math.sin((i / n) * Math.PI) * 0.25;
    g.add(L.sphere(0.07, 6, L.MAT.emissive(L.pick(['#ffd070', '#ff9060', '#fff0c0']), 1.3), { x, y: y - sag, z: frontZ + 0.5, cast: false }));
  }
}

/* a painted mural drawn on its own canvas */
function muralTex(seed, baseHex) {
  L.setSeed(seed * 733 + 19);
  const w = 256, h = 256, c = L.cnv(w, h), g = c.getContext('2d');
  g.fillStyle = baseHex; g.fillRect(0, 0, w, h);
  const pals = [['#e85850', '#f0c040', '#4aa0c0', '#3a6a48'], ['#2a3a6a', '#e8a030', '#d04060', '#f0e8d0'], ['#5a3a78', '#e0d040', '#40a080', '#e87850']];
  const pal = L.pick(pals);
  // big organic shapes (leaves / sun / waves)
  for (let i = 0; i < 7; i++) {
    g.fillStyle = pal[i % pal.length]; g.globalAlpha = L.rand(0.6, 0.95);
    g.beginPath();
    const cx = L.rand(0, w), cy = L.rand(0, h), r = L.rand(25, 80);
    g.ellipse(cx, cy, r, r * L.rand(0.5, 1.1), L.rand(0, TAU), 0, TAU);
    g.fill();
  }
  // a few bold strokes
  g.globalAlpha = 0.9; g.lineWidth = 8; g.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    g.strokeStyle = pal[(i + 1) % pal.length];
    g.beginPath(); g.moveTo(L.rand(0, w), L.rand(0, h));
    g.bezierCurveTo(L.rand(0, w), L.rand(0, h), L.rand(0, w), L.rand(0, h), L.rand(0, w), L.rand(0, h));
    g.stroke();
  }
  g.globalAlpha = 1;
  return L.finishTex(c, { aniso: 8 });
}

/* ════════════════════════════════════════════════════════════════════════
   MAKE
   ════════════════════════════════════════════════════════════════════════ */
function make(spec) {
  spec = spec || {};
  L.setSeed(spec.seed || ((spec.name || 'x').charCodeAt(0) * 131 + (spec.floors || 3) * 17 + (spec.w || 7) * 3) | 0);

  const arch = spec.archetype || 'shop';
  const w = spec.w || 7, d = spec.d || 8, floors = spec.floors || 3;
  const h = heightOf(spec);
  const frontZ = d / 2, backZ = -d / 2, sideX = d / 2 - 0.6;
  const wallHex = spec.wall || L.pick(L.PAL.walls);
  const trimHex = spec.trim || L.pick(L.PAL.trims);
  const accentHex = spec.accent || spec.signColor || L.pick(L.PAL.signbg);
  const extras = spec.extras || [];
  const has = k => extras.includes(k);

  // brick walls for townhouse (option) and some apartments
  const useBrick = (arch === 'townhouse' && L.chance(0.6));
  const wallMat = useBrick ? L.MAT.brick(wallHex) : L.MAT.wall(wallHex);
  const trimMat = L.MAT.trim(trimHex);
  const g = new T.Group();

  // main body
  g.add(L.box(w, h, d, wallMat, { y: h / 2, receive: true }));

  // archetype-specific window proportions
  // litP kept modest per §4.10 (emissive discipline: bloom threshold raised to
  // 0.86) so lit windows GLOW without the town reading as a christmas tree by day.
  let winW = 0.95, winH = 1.35, litP = 0.20, doSides = (w > 8 || d > 9), doBack = false;
  if (arch === 'apartment') { winW = 0.85; winH = 1.4; litP = 0.24; doSides = true; }
  else if (arch === 'civic') { winW = 1.05; winH = 1.9; litP = 0.16; doSides = true; }
  else if (arch === 'townhouse') { winW = 0.8; winH = 1.4; litP = 0.20; }
  else if (arch === 'cafe') { winW = 1.0; winH = 1.45; litP = 0.26; }

  /* ── COMMON STRUCTURE: bands + cornice ── */
  bandsAndCornice(g, w, d, h, floors, trimMat, { cornice: true });

  /* ── UPPER WINDOWS (instanced) — skip ground floor (start at 1) ── */
  buildWindows(g, { w, d, h, floors, frontZ, backZ, sideX, winW, winH, litP, startFloor: 1, doSides, doBack });

  /* ── ALWAYS-ON DETAILING ── */
  downpipe(g, w, h, frontZ);

  /* ════════ ARCHETYPE BODIES ════════ */
  if (arch === 'shop') {
    shopfront(g, spec, w, frontZ, {});
    if (spec.awning) awning(g, spec.awning, w, frontZ, {});
    bladeSign(g, spec, w, frontZ, has('neon'));
    // a couple sills already from windows; add a wall lamp
    if (L.chance(0.6)) wallLamp(g, -w / 2 + 0.4, GROUND_H + 0.6, frontZ);
  }

  else if (arch === 'cafe') {
    shopfront(g, spec, w, frontZ, { fascia: true });
    awning(g, spec.awning || L.pick(L.PAL.awning), w, frontZ, { depth: 2.0, stripes: 14 });
    stringLights(g, w, frontZ, GROUND_H + 0.2);
    bladeSign(g, spec, w, frontZ, has('neon'));
    // terrace hint: low fence + 2 round tables out front
    const terrZ = frontZ + 1.6;
    railing(g, 0, 0, terrZ, w - 1.0, 0.6, L.MAT.metalDark, Math.round((w - 1) / 0.6));
    for (const tx of [-w / 4, w / 4]) {
      g.add(L.cyl(0.04, 0.04, 0.74, 8, L.MAT.metalDark, { x: tx, y: 0.37, z: frontZ + 1.0, cast: false }));
      g.add(L.cyl(0.42, 0.42, 0.05, 14, L.MAT.wood('#9a7a52'), { x: tx, y: 0.74, z: frontZ + 1.0 }));
    }
    // blackboard menu
    g.add(L.box(0.7, 1.1, 0.06, L.MAT.flat('#23241f'), { x: -w / 2 + 0.55, y: 0.9, z: frontZ + 0.6 }));
    g.add(L.box(0.78, 1.18, 0.04, L.MAT.wood('#6b4a30'), { x: -w / 2 + 0.55, y: 0.9, z: frontZ + 0.57, cast: false }));
  }

  else if (arch === 'apartment') {
    // dignified ground floor with entry portal (no big shopfront)
    g.add(L.box(w + 0.1, 0.6, d + 0.1, trimMat, { y: GROUND_H, cast: false }));
    // arched-ish entry: door + transom + surround
    const doorX = 0;
    g.add(L.box(2.1, GROUND_H - 0.2, 0.3, trimMat, { y: (GROUND_H - 0.2) / 2, z: frontZ + 0.02 }));
    g.add(L.box(1.5, 2.1, 0.14, L.MAT.wood('#4a3422'), { x: doorX, y: 1.05, z: frontZ + 0.16 }));
    g.add(L.box(1.5, 0.4, 0.08, L.MAT.glass, { x: doorX, y: 2.3, z: frontZ + 0.18, cast: false }));
    g.add(L.cyl(0.04, 0.04, 0.6, 6, L.MAT.chrome, { x: doorX + 0.5, y: 1.0, z: frontZ + 0.24, cast: false }));
    // ground floor windows (a couple) flanking entry
    for (const sx of [-1, 1]) {
      g.add(L.box(0.9, 1.3, 0.06, L.MAT.glass, { x: sx * (w / 2 - 1.0), y: 1.4, z: frontZ + 0.04, cast: false }));
      g.add(L.box(1.12, 1.56, 0.1, trimMat, { x: sx * (w / 2 - 1.0), y: 1.4, z: frontZ + 0.02, cast: false }));
    }
    // SHUTTERS on most upper windows + FLOWER BOXES under some (front)
    const cols = Math.max(2, Math.floor(w / 2.5));
    const gap = w / cols;
    const foliageMat = L.std({ color: parseInt(L.pick(L.PAL.foliage).replace('#', '0x')), roughness: 0.9 });
    const shutterMat = L.MAT.wood(L.pick(['#3a6a52', '#5a3a78', '#7a3a30', '#2a4a6a', '#4a5a30']));
    for (let f = 1; f < floors; f++) {
      const wy = GROUND_H + 0.55 + f * FLOOR_H;
      if (wy + winH / 2 + 0.4 > h - 0.4) break;
      for (let ci = 0; ci < cols; ci++) {
        const wx = -w / 2 + gap * (ci + 0.5);
        if (has('shutters') || L.chance(0.7)) shutters(g, wx, wy, frontZ + 0.06, winH + 0.1, shutterMat);
        if ((has('flowerbox') || L.chance(0.35)) && f < floors) flowerBox(g, wx, wy - winH / 2 - 0.25, frontZ + 0.22, foliageMat);
      }
    }
    // wall lamp by the door
    wallLamp(g, -1.4, GROUND_H - 0.3, frontZ);
    wallLamp(g, 1.4, GROUND_H - 0.3, frontZ);
    if (spec.name) {
      const sgT = L.signTex(spec.name, accentHex, '#f0e8d0', 'bold 26px Georgia, serif');
      const plaque = new T.Mesh(new T.PlaneGeometry(1.6, 0.4), L.std({ map: sgT, roughness: 0.5 }));
      plaque.position.set(0, GROUND_H + 0.4, frontZ + 0.06); g.add(plaque);
    }
  }

  else if (arch === 'civic') {
    // grander: taller ground floor with engaged columns + pediment + steps
    const colN = Math.max(4, Math.round(w / 1.8));
    const colMat = L.MAT.wall(mix(wallHex, '#ffffff', 0.25));
    for (let i = 0; i < colN; i++) {
      const cx = -w / 2 + (w / (colN - 1)) * i;
      g.add(L.cyl(0.34, 0.4, GROUND_H + 0.6, 12, colMat, { x: cx, y: (GROUND_H + 0.6) / 2, z: frontZ - 0.1 }));
      // capital + base
      g.add(L.box(0.85, 0.2, 0.85, trimMat, { x: cx, y: GROUND_H + 0.55, z: frontZ - 0.1, cast: false }));
      g.add(L.box(0.85, 0.2, 0.85, trimMat, { x: cx, y: 0.1, z: frontZ - 0.1, cast: false }));
    }
    // architrave above columns
    g.add(L.box(w + 0.3, 0.55, 0.6, trimMat, { y: GROUND_H + 0.85, z: frontZ - 0.05 }));
    // pediment (triangular prism via a Shape)
    const pedShape = new T.Shape();
    pedShape.moveTo(-w / 2 - 0.2, 0); pedShape.lineTo(w / 2 + 0.2, 0); pedShape.lineTo(0, 1.5); pedShape.lineTo(-w / 2 - 0.2, 0);
    const pedGeo = new T.ExtrudeGeometry(pedShape, { depth: 0.6, bevelEnabled: false });
    const pediment = new T.Mesh(pedGeo, trimMat);
    pediment.position.set(0, GROUND_H + 1.15, frontZ - 0.05); pediment.castShadow = true; g.add(pediment);
    // emblem / clock in the tympanum
    if (L.chance(0.6)) {
      const clk = L.cyl(0.42, 0.42, 0.1, 20, L.MAT.trim('#f4ecd8'), { y: GROUND_H + 1.7, z: frontZ + 0.3 });
      clk.rotation.x = Math.PI / 2; g.add(clk);
      g.add(L.box(0.05, 0.3, 0.04, L.MAT.metalDark, { y: GROUND_H + 1.75, z: frontZ + 0.36, cast: false }));
      g.add(L.box(0.22, 0.05, 0.04, L.MAT.metalDark, { y: GROUND_H + 1.7, z: frontZ + 0.36, cast: false }));
    } else {
      g.add(L.sphere(0.34, 12, L.MAT.metalLight, { y: GROUND_H + 1.7, z: frontZ + 0.2, cast: false }));
    }
    // grand central doorway
    g.add(L.box(2.4, GROUND_H - 0.1, 0.3, trimMat, { y: (GROUND_H - 0.1) / 2, z: frontZ - 0.05 }));
    g.add(L.box(1.9, GROUND_H - 0.5, 0.16, L.MAT.wood('#3a2818'), { y: (GROUND_H - 0.5) / 2 + 0.05, z: frontZ + 0.08 }));
    // entrance steps
    for (let s = 0; s < 3; s++) g.add(L.box(w * 0.5 - s * 0.3, 0.18, 0.5, L.MAT.trim('#d8cdb8'), { y: 0.09 + s * 0.18, z: frontZ + 0.7 - s * 0.22, receive: true }));
    // signage on architrave
    if (spec.name) {
      const sgT = L.signTex(spec.name, accentHex, '#f4ecd8', 'bold 26px Georgia, serif');
      const board = new T.Mesh(new T.PlaneGeometry(Math.min(w - 1, 5.5), 0.46), L.std({ map: sgT, roughness: 0.5 }));
      board.position.set(0, GROUND_H + 0.85, frontZ + 0.27); g.add(board);
    }
  }

  else if (arch === 'townhouse') {
    // narrow brick option, modest door, ground windows
    const doorX = (L.chance(0.5) ? 1 : -1) * (w / 2 - 1.0);
    g.add(L.box(1.4, GROUND_H - 0.2, 0.26, trimMat, { x: doorX, y: (GROUND_H - 0.2) / 2, z: frontZ + 0.02 }));
    g.add(L.box(1.0, 2.0, 0.14, L.MAT.wood(L.pick(['#3a2818', '#2a3a48', '#4a2a30'])), { x: doorX, y: 1.0, z: frontZ + 0.14 }));
    g.add(L.box(1.0, 0.32, 0.06, L.MAT.glass, { x: doorX, y: 2.15, z: frontZ + 0.16, cast: false }));
    // steps
    g.add(L.box(1.6, 0.2, 0.5, L.MAT.trim('#d0c5b0'), { x: doorX, y: 0.1, z: frontZ + 0.35, receive: true }));
    // a ground bay window
    g.add(L.box(1.5, 1.5, 0.06, L.MAT.glass, { x: -doorX * 0.6, y: 1.4, z: frontZ + 0.04, cast: false }));
    g.add(L.box(1.75, 1.78, 0.1, trimMat, { x: -doorX * 0.6, y: 1.4, z: frontZ + 0.02, cast: false }));
    // shutters on upper windows
    const cols = Math.max(2, Math.floor(w / 2.5));
    const gap = w / cols;
    const shutterMat = L.MAT.wood(L.pick(['#3a4a2a', '#2a3a4a', '#4a2a2a', '#3a2a4a']));
    for (let f = 1; f < floors; f++) {
      const wy = GROUND_H + 0.55 + f * FLOOR_H;
      if (wy + winH / 2 + 0.4 > h - 0.4) break;
      for (let ci = 0; ci < cols; ci++) {
        const wx = -w / 2 + gap * (ci + 0.5);
        if (has('shutters') || L.chance(0.6)) shutters(g, wx, wy, frontZ + 0.06, winH + 0.08, shutterMat);
      }
    }
    if (spec.name) {
      const sgT = L.signTex(spec.name, accentHex);
      const board = new T.Mesh(new T.PlaneGeometry(Math.min(w - 0.6, 3.2), 0.6), L.std({ map: sgT, roughness: 0.55 }));
      board.position.set(0, GROUND_H + 0.2, frontZ + 0.1); g.add(board);
    }
  }

  else if (arch === 'corner') {
    // chamfered corner facade: shopfront on the +Z front, angled chamfer at +X+Z
    shopfront(g, spec, w - 1.2, frontZ, {});
    if (spec.awning) awning(g, spec.awning, w - 1.2, frontZ, {});
    bladeSign(g, spec, w, frontZ, has('neon'));
    // chamfer wedge: a rotated thin box across the front-right corner
    const chamf = L.box(2.0, h, 0.6, wallMat, { x: w / 2 - 0.7, y: h / 2, z: frontZ - 0.7 });
    chamf.rotation.y = -Math.PI / 4; g.add(chamf);
    // a tall corner entrance on the chamfer
    const cd = L.box(1.2, 2.2, 0.14, L.MAT.wood('#3a2818'), { x: w / 2 - 0.7, y: 1.1, z: frontZ - 0.7 });
    cd.rotation.y = -Math.PI / 4; g.add(cd);
  }

  /* ════════ ROOFLINE VARIATION ════════ */
  let roofOpts = { garden: (arch === 'apartment' || arch === 'civic') };
  // townhouse: pitched cap / mansard + chimney
  if (arch === 'townhouse') {
    // classic pitched tiled cap (terracotta-biased), gable ends + a chimney
    const capH = L.rand(1.2, 1.8);
    const roofHex = pickRoof();
    pitchedRoof(g, w, d, h, roofHex, { ridge: 'x', capH, gableMat: wallMat });
    // chimney
    g.add(L.box(0.7, 1.4, 0.7, L.MAT.brick(darker(wallHex, 0.8)), { x: w / 4, y: h + capH + 0.2, z: -d / 4 }));
    g.add(L.box(0.85, 0.2, 0.85, L.MAT.flat('#3a3530'), { x: w / 4, y: h + capH + 0.9, z: -d / 4, cast: false }));
    roofOpts.noParapet = true;
  } else if (arch === 'civic') {
    // civic gets a stronger cornice + central roof lantern/dome hint
    g.add(L.box(w + 0.6, 0.3, d + 0.6, trimMat, { y: h + 0.3, cast: false }));
    if (L.chance(0.5)) {
      g.add(L.cyl(1.0, 1.2, 0.8, 12, L.MAT.wall(mix(wallHex, '#ffffff', 0.2)), { y: h + 0.8 }));
      g.add(L.sphere(0.9, 14, L.MAT.metalLight, { y: h + 1.6, cast: true }));
    }
    rooftop(g, w, d, h, wallMat, roofOpts);
  } else {
    // shop / cafe / corner / apartment: mix flat-parapet with the occasional
    // low TILED pitched/hipped cap so the aerial roofscape gets silhouette
    // interest and reads terracotta-dominant (§3.4 / §5.4). Corner buildings
    // keep flat parapets (their chamfer wedge wants a clean top).
    const wantPitch = arch !== 'corner' && L.chance(arch === 'apartment' ? 0.4 : 0.5);
    if (wantPitch) {
      const roofHex = pickRoof();
      // shallow cap; ridge runs along the longer plan axis, ends sometimes hipped
      const ridge = w >= d ? 'x' : 'z';
      const hip = L.chance(0.4);
      const capH = L.rand(0.9, 1.5);
      // tar deck under the cap (kept for grounded look), but no parapet
      g.add(L.box(w - 0.3, 0.08, d - 0.3, L.MAT.flat('#46423b'), { y: h + 0.04, cast: false }));
      pitchedRoof(g, w, d, h, roofHex, { ridge, hip, capH, gableMat: wallMat });
      // a tasteful chimney or roof vent poking through (clutter, §5.4)
      if (L.chance(0.5)) {
        const cx = L.jitter(w / 4), cz = -L.rand(0, d / 4);
        g.add(L.box(0.5, 1.0, 0.5, L.MAT.brick(darker(wallHex, 0.8)), { x: cx, y: h + capH + 0.3, z: cz }));
        g.add(L.box(0.62, 0.14, 0.62, L.MAT.flat('#3a3530'), { x: cx, y: h + capH + 0.85, z: cz, cast: false }));
      }
    } else {
      rooftop(g, w, d, h, wallMat, roofOpts);
    }
  }

  /* ════════ EXTRAS (shared, flagged) ════════ */
  // BALCONY (front, projecting, with railing + occasional laundry)
  if (has('balcony')) {
    for (let f = 1; f <= Math.min(floors - 1, 3); f++) {
      const by = GROUND_H + f * FLOOR_H + 0.35;
      if (by > h - 1) break;
      const span = w * 0.55, proj = 0.95;
      g.add(L.box(span, 0.16, proj, trimMat, { y: by, z: frontZ + proj / 2 }));
      // corbels
      for (const sx of [-1, 1]) g.add(L.box(0.18, 0.3, 0.5, trimMat, { x: sx * span / 2 * 0.7, y: by - 0.2, z: frontZ + 0.3, cast: false }));
      railing(g, 0, by + 0.08, frontZ + proj - 0.05, span, 0.7, L.MAT.metalDark, Math.round(span / 0.4));
      // side rails
      for (const sx of [-1, 1]) {
        g.add(L.box(0.06, 0.7, proj, L.MAT.metalDark, { x: sx * span / 2, y: by + 0.43, z: frontZ + proj / 2, cast: false }));
      }
      // occasional laundry line
      if (L.chance(0.35)) {
        for (let i = 0; i < 3; i++) g.add(L.box(0.3, 0.4, 0.02, L.MAT.flat(L.pick(['#e8e0d0', '#d06080', '#5080b0', '#e0c050'])), { x: -span / 4 + i * span / 4, y: by + 0.9, z: frontZ + proj - 0.1, cast: false }));
      }
    }
  }
  // NEON blade sign (if not already added through archetype; civic/apartment etc.)
  if (has('neon') && spec.name && arch !== 'shop' && arch !== 'cafe' && arch !== 'corner') {
    const glow = L.pick(['#40a8e0', '#ff8060', '#d060f0', '#f0a830', '#30c8f0']);
    const nT = L.neonTex(spec.name, glow);
    const nSign = new T.Mesh(new T.PlaneGeometry(2.8, 0.6), L.std({ map: nT, emissive: parseInt(glow.replace('#', '0x')), emissiveMap: nT, emissiveIntensity: 1.5, roughness: 0.25 }));
    nSign.position.set(0, GROUND_H + 0.9, frontZ + 0.15); g.add(nSign);
  }
  // MURAL (painted wall graphic on a side wall)
  if (has('mural')) {
    const mT = muralTex(spec.seed || 7, mix(wallHex, '#ffffff', 0.1));
    const muralW = Math.min(d - 1.5, 5), muralH = Math.min(h - GROUND_H - 1, floors * 2.0);
    const mural = new T.Mesh(new T.PlaneGeometry(muralW, muralH), L.std({ map: mT, roughness: 0.92 }));
    const sideSign = L.chance(0.5) ? 1 : -1;
    mural.position.set(sideSign * (w / 2 + 0.05), GROUND_H + muralH / 2 + 0.3, 0);
    mural.rotation.y = sideSign * Math.PI / 2; g.add(mural);
  }
  // POSTERS (pasted on the ground-floor facade)
  if (has('posters')) {
    for (let pi = 0; pi < 2 + (L.rng() * 2 | 0); pi++) {
      const pT = L.posterTex((spec.seed || 1) + pi * 7);
      const poster = new T.Mesh(new T.PlaneGeometry(0.55, 0.82), L.std({ map: pT, roughness: 0.9 }));
      poster.position.set(L.jitter(w / 2.4), 0.7 + L.rand(0.4, 1.6), frontZ + 0.07);
      poster.rotation.z = L.jitter(0.05); g.add(poster);
    }
  }
  // FLOWERBOX flag for non-apartment archetypes
  if (has('flowerbox') && arch !== 'apartment') {
    const foliageMat = L.std({ color: parseInt(L.pick(L.PAL.foliage).replace('#', '0x')), roughness: 0.9 });
    const cols = Math.max(2, Math.floor(w / 2.5)), gap = w / cols;
    const wy = GROUND_H + 0.55 + 1 * FLOOR_H;
    if (wy + winH / 2 + 0.4 < h - 0.4) {
      for (let ci = 0; ci < cols; ci++) {
        if (L.chance(0.6)) flowerBox(g, -w / 2 + gap * (ci + 0.5), wy - winH / 2 - 0.25, frontZ + 0.22, foliageMat);
      }
    }
  }
  // SHUTTERS flag for non-apartment/townhouse archetypes (front upper windows)
  if (has('shutters') && arch !== 'apartment' && arch !== 'townhouse') {
    const shutterMat = L.MAT.wood(L.pick(['#3a6a52', '#5a3a78', '#7a3a30', '#2a4a6a']));
    const cols = Math.max(2, Math.floor(w / 2.5)), gap = w / cols;
    for (let f = 1; f < floors; f++) {
      const wy = GROUND_H + 0.55 + f * FLOOR_H;
      if (wy + winH / 2 + 0.4 > h - 0.4) break;
      for (let ci = 0; ci < cols; ci++) shutters(g, -w / 2 + gap * (ci + 0.5), wy, frontZ + 0.06, winH + 0.08, shutterMat);
    }
  }

  return g;
}

FLY.buildings = { make, ARCHETYPES, heightOf };
})();
