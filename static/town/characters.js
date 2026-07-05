/* ════════════════════════════════════════════════════════════════════════
   THE FLY — town/characters.js   (charming, lively townsfolk + the hero courier)
   FLY.characters.makeNPC(opts) -> THREE.Group  (base y=0, facing +Z)
       group.userData.limbs = { legL, legR, armL, armR }  for walk animation
       group.userData.torso = THREE.Group           (internal bob target)
       group.userData.gait  = { stride, armSwing, bob, knee, elbow, baseY, baseRX, breath }
       group.userData.headGrp = THREE.Group          (neck pivot; head/face/hair)
   FLY.characters.animateWalk(group, t, moving)  -> poses limbs (no world move)
   FLY.characters.makeHero() -> THREE.Group (the player courier)
       userData.{limbs,torso,gait,headGrp,scarfTail,capMat,scarfMat}
   FLY.characters.makeFly() -> THREE.Group (the fly mascot)
       userData = { wingL, wingR, scarfTail }
   BONUS: makePigeon()(userData.wings), makeDog(), makeCat(), makeStreetMusician()
   ════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
const L = FLY.lib, T = L.T, TAU = L.TAU;
const hx = s => parseInt(s.replace('#', '0x'));

/* ── small shared material helpers (all cached via L.std) ── */
const cloth = hex => L.std({ color: hx(hex), roughness: 0.86 });
const skinMat = hex => L.std({ color: hx(hex), roughness: 0.66 });
const hairMat = hex => L.std({ color: hx(hex), roughness: 0.92 });
const EYE = L.std({ color: 0x2a2228, roughness: 0.36 });
const WHITE = L.std({ color: 0xf6f1e8, roughness: 0.55 });
const MOUTH = L.std({ color: 0x9a4a44, roughness: 0.7 });
const SOLE = L.std({ color: 0x14110d, roughness: 0.9 });
const GLASS_FRAME = L.std({ color: 0x2a2622, roughness: 0.5, metalness: 0.3 });
const GLASS_LENS = L.std({ color: 0xbfe6ef, roughness: 0.2, metalness: 0.2, transparent: true, opacity: 0.55 });
const GREY_HAIR = L.std({ color: 0xc8c4bc, roughness: 0.92 });
const BLUSH = L.std({ color: 0xe4977a, roughness: 0.72 });

// ── local accessory palettes, harmonized to the warm town (ARTBIBLE §2.8) ──
const PANTS_PAL = ['#4a4a52', '#5a4830', '#3f5060', '#2c2824', '#4c4a40', '#3a342e', '#6a4a2e', '#445258', '#5a3a44'];
const SHOE_PAL  = ['#241a12', '#2a1c12', '#33240f', '#1c1814', '#3a2418', '#2a221a'];
const ACCENT_PAL = ['#cf8a3c', '#c8504a', '#3f7d6e', '#d8b14a', '#8a5288', '#b0506a', '#3f9468'];
const COAT_PAL = ['#44505a', '#5a4030', '#3d463c', '#52384a', '#3a4650', '#4a3a2a', '#3a5048'];
const BAG_PAL = ['#6a4a2e', '#444c54', '#6a3838', '#3d463c', '#52423a'];
const PACK_PAL = ['#3f5a4a', '#4a3a5a', '#5a4030', '#3a4650', '#7a4a3a'];
const APRON_PAL = ['#7a4a2e', '#3f5a4a', '#5a3a4a', '#8a6a3a', '#4c4a48'];

/* a soft rounded "limb": a tapered cylinder capped with spheres, grown DOWN from
   y=0. Returns a Group so the caller can drop it into a pivot cleanly. */
function softLimb(rTop, rBot, len, mat, capBot) {
  const grp = new T.Group();
  grp.add(L.cyl(rTop, rBot, len, 8, mat, { y: -len / 2, cast: true }));
  grp.add(L.sphere(rTop, 8, mat, { y: 0, cast: false }));               // shoulder/hip cap
  if (capBot !== false) grp.add(L.sphere(rBot, 8, mat, { y: -len, cast: false }));
  return grp;
}

/* a soft rounded TORSO built from a tapered barrel + sphere caps, added to `parent`.
   Grows from hips (waist) up to the shoulders; gently flattened front-to-back so it
   reads as a body, not a can. Overlays (coats, aprons) are layered on top by callers. */
function softTorso(parent, mat, o) {
  const midY = (o.hipY + o.shoulderY) / 2 + 0.02;
  const bodyH = o.shoulderY - o.hipY + 0.04;
  const trunk = L.cyl(o.chestR, o.waistR, bodyH, 12, mat, { y: midY });
  trunk.scale.z = o.depth; parent.add(trunk);
  const chestCap = L.sphere(o.chestR, 12, mat, { y: o.shoulderY - 0.03 });
  chestCap.scale.set(1, 0.82, o.depth); parent.add(chestCap);
  const bellyCap = L.sphere(o.waistR, 10, mat, { y: o.hipY + 0.05, cast: false });
  bellyCap.scale.set(1.02, 0.92, o.depth + 0.06); parent.add(bellyCap);
  return trunk;
}

/* expressive human face, positioned RELATIVE to a head pivot `H` (its origin is the
   head centre). Shared by NPCs, the hero and the musician for a consistent, cute read. */
function addHumanFace(H, headR, skMat, hrMat, opt) {
  opt = opt || {};
  const head = L.sphere(headR, 14, skMat, { y: 0 });
  head.scale.set(0.97, 1.06, 0.98); H.add(head);
  // ears
  [-1, 1].forEach(s => H.add(L.sphere(0.048, 6, skMat, { x: s * headR * 0.96, y: -0.01, z: -0.02, cast: false })));
  // little rounded nose
  H.add(L.sphere(0.032, 6, skMat, { y: -0.012, z: headR * 0.98, cast: false }));
  // eyes: bright white + dark pupil + a crisp catch-light
  const eDx = headR * (opt.wideEyes ? 0.4 : 0.36), eZ = headR * 0.82;
  [-eDx, eDx].forEach(ex => {
    H.add(L.sphere(0.044, 10, WHITE, { x: ex, y: 0.03, z: eZ, cast: false }));
    H.add(L.sphere(0.024, 8, EYE, { x: ex, y: 0.026, z: eZ + 0.02, cast: false }));
    H.add(L.sphere(0.0085, 6, WHITE, { x: ex + 0.013, y: 0.052, z: eZ + 0.035, cast: false }));
  });
  // soft brows
  [-eDx, eDx].forEach(ex => H.add(L.box(0.058, 0.013, 0.01, hrMat, { x: ex, y: 0.09, z: headR * 0.85, cast: false })));
  // a warm upturned smile (half-torus arc)
  const smile = new T.Mesh(new T.TorusGeometry(0.03, 0.0085, 6, 10, Math.PI), MOUTH);
  smile.position.set(0, -0.052, headR * 0.9); smile.rotation.z = Math.PI; H.add(smile);
  // rosy cheeks
  [-1, 1].forEach(s => H.add(L.sphere(0.026, 6, BLUSH, { x: s * headR * 0.56, y: -0.04, z: headR * 0.8, cast: false })));
}

/* ════════════════════════════════════════════════════════════════════════
   NPC — townsfolk with rounded forms, proportion archetypes + accessory variety.
   ════════════════════════════════════════════════════════════════════════ */
function makeNPC(opts) {
  opts = opts || {};
  const g = new T.Group();

  // ── proportion archetype: adult / kid / elder, chosen by seed ──
  const ar = L.rand(0, 1);
  const arch = ar < 0.16 ? 'kid' : (ar < 0.30 ? 'elder' : 'adult');
  const isKid = arch === 'kid', isElder = arch === 'elder';
  const scaleH = isKid ? L.rand(0.60, 0.74)
               : isElder ? L.rand(0.86, 0.98)
               : L.rand(0.92, 1.1);
  const build = isKid ? L.rand(0.82, 1.0)
              : isElder ? L.rand(0.94, 1.22)
              : L.rand(0.86, 1.18);
  const stoop = isElder ? L.rand(0.06, 0.14) : 0;
  const shirtHex = opts.shirt || L.pick(L.PAL.cloth);
  const pantsHex = opts.pants || L.pick(PANTS_PAL);
  const skinHex  = opts.skin  || L.pick(L.PAL.skin);
  const hairHex  = opts.hair  || (isElder ? L.pick(['#c8c4bc', '#b0aca4', '#9a9690', '#86807a']) : L.pick(L.PAL.hair));
  const shoeHex  = L.pick(SHOE_PAL);
  const shirtMat = cloth(shirtHex);
  const pantsMat = cloth(pantsHex);
  const skMat = skinMat(skinHex);
  const hrMat = isElder ? GREY_HAIR : hairMat(hairHex);
  const shoeMat = L.std({ color: hx(shoeHex), roughness: 0.78 });

  // key vertical anchors (pre-scale; whole group scaled at the end)
  const hipY = 0.62, shoulderY = 1.16, neckY = 1.30, headY = 1.46;
  const legLen = 0.58, armLen = 0.50;
  const hipDx = 0.115 * build, shDx = 0.235 * build;

  // ── LEGS (pivot at hip) — each holds an internal "shin" group for a knee bend ──
  const legL = new T.Group(), legR = new T.Group();
  legL.position.set(-hipDx, hipY, 0);
  legR.position.set(hipDx, hipY, 0);
  [legL, legR].forEach(lg => {
    lg.add(softLimb(0.108 * build, 0.09 * build, legLen * 0.52, pantsMat, false));   // thigh
    const shin = new T.Group();
    shin.position.y = -legLen * 0.52;
    shin.add(softLimb(0.09 * build, 0.076 * build, legLen * 0.48, pantsMat, false));  // calf
    // rounded little boot pointing +Z
    const shoe = new T.Group();
    shoe.position.set(0, -legLen * 0.48 - 0.02, 0.03);
    shoe.add(L.box(0.15 * build, 0.09, 0.24, shoeMat, { z: 0.02 }));
    shoe.add(L.sphere(0.078 * build, 8, shoeMat, { z: 0.11, cast: false }));          // rounded toe
    shoe.add(L.box(0.16 * build, 0.045, 0.26, SOLE, { y: -0.05, z: 0.02, cast: false }));
    shin.add(shoe);
    lg.add(shin);
    lg.userData.shin = shin;
  });
  g.add(legL, legR);

  // ── TORSO (internal group so animateWalk can bob it without moving the world) ──
  const torso = new T.Group();
  if (stoop) torso.rotation.x = stoop;
  g.add(torso);

  // rounded pelvis
  const pelvis = L.sphere(0.155 * build, 10, pantsMat, { y: hipY - 0.02 });
  pelvis.scale.set(1.06, 0.78, 0.86); torso.add(pelvis);

  // soft rounded chest/belly barrel
  const waistR = 0.152 * build, chestR = 0.205 * build, depth = 0.82;
  const torsoCY = (hipY + shoulderY) / 2 + 0.02;
  softTorso(torso, shirtMat, { hipY, shoulderY, waistR, chestR, depth });

  // body type: tee, hoodie, coat, tunic, dress, or apron-wearing worker
  const bodyType = L.pick(['tee', 'tee', 'hoodie', 'coat', 'tunic', 'dress', 'apron']);
  let sleeveMat = shirtMat;
  if (bodyType === 'coat') {
    const coatMat = cloth(L.pick(COAT_PAL));
    sleeveMat = coatMat;
    // an open coat wrapping the lower ~3/4 of the torso
    const coat = L.cyl(chestR * 1.06, waistR * 1.16, (shoulderY - hipY) * 0.9, 12, coatMat, { y: torsoCY - 0.04 });
    coat.scale.z = depth + 0.04; torso.add(coat);
    torso.add(L.box(0.09, (shoulderY - hipY) * 0.8, 0.006, shirtMat, { y: torsoCY, z: (chestR * depth) + 0.01, cast: false }));
    for (let i = 0; i < 3; i++) torso.add(L.sphere(0.018, 6, EYE, { x: 0.07 * build, y: shoulderY - 0.16 - i * 0.14, z: (chestR * depth) + 0.012, cast: false }));
  } else if (bodyType === 'hoodie') {
    // hood-down lump + soft collar + kangaroo pocket
    const hood = L.sphere(0.15 * build, 12, shirtMat, { y: shoulderY - 0.02, z: -0.13 * build, cast: false });
    hood.scale.set(1.1, 0.72, 0.82); torso.add(hood);
    const col = new T.Mesh(new T.TorusGeometry(0.095 * build, 0.036, 6, 14), shirtMat);
    col.position.set(0, neckY - 0.07, 0.01); col.rotation.x = TAU / 4; col.scale.set(1, 1, 0.85); torso.add(col);
    torso.add(L.box(0.2 * build, 0.14, 0.03, cloth(shirtHex), { y: hipY + 0.14, z: (waistR * depth) + 0.02, cast: false }));
  } else if (bodyType === 'tunic') {
    torso.add(L.cyl(waistR * 1.05, 0.3 * build, 0.34, 12, shirtMat, { y: hipY - 0.06 }));
  } else if (bodyType === 'dress') {
    const skirt = L.cyl(waistR * 1.02, 0.31 * build, 0.4, 14, shirtMat, { y: hipY - 0.08 });
    torso.add(skirt);
  } else if (bodyType === 'apron') {
    const apronMat = cloth(L.pick(APRON_PAL));
    const panel = L.cyl(chestR * 0.9, waistR * 1.05, (shoulderY - hipY) * 0.82, 12, apronMat, { y: torsoCY - 0.02 });
    panel.scale.set(1, 1, 0.32); panel.position.z = (chestR * depth) - 0.02; torso.add(panel);
    torso.add(L.box(0.045, 0.22, 0.02, apronMat, { x: 0.07 * build, y: shoulderY - 0.02, z: (chestR * depth) - 0.02, cast: false }));
    torso.add(L.box(0.14 * build, 0.08, 0.02, cloth(L.pick(APRON_PAL)), { y: hipY + 0.16, z: (chestR * depth) + 0.01, cast: false }));
  }

  // rounded shoulder caps (in sleeve/coat colour) to blend the arms in
  [-1, 1].forEach(s => {
    const cap = L.sphere(0.09 * build, 10, sleeveMat, { x: s * 0.165 * build, y: shoulderY - 0.02 });
    cap.scale.set(1, 0.9, 0.92); torso.add(cap);
  });
  // collar / neckline accent
  const collarAcc = new T.Mesh(new T.TorusGeometry(0.075 * build, 0.022, 6, 14), L.std({ color: hx(L.pick(L.PAL.trims)), roughness: 0.8 }));
  collarAcc.rotation.x = TAU / 4; collarAcc.position.set(0, shoulderY - 0.01, 0.01); torso.add(collarAcc);

  // neck
  torso.add(L.cyl(0.058, 0.07, 0.14, 8, skMat, { y: neckY - 0.05, cast: false }));

  // ── HEAD PIVOT (neck) → face + hair; game.js may rotate this on some NPCs ──
  const headR = 0.2 * (isKid ? 1.1 : (isElder ? 0.97 : 1.0));
  const H = new T.Group(); H.position.set(0, headY, 0); torso.add(H);
  g.userData.headGrp = H;
  addHumanFace(H, headR, skMat, hrMat, { wideEyes: isKid });

  // elder: rosier cheeks + maybe a soft beard
  if (isElder) {
    if (L.chance(0.5)) {
      const beard = L.sphere(headR * 0.78, 10, GREY_HAIR, { y: -0.11, z: headR * 0.6, cast: false });
      beard.scale.set(1.0, 0.72, 0.7); H.add(beard);
    }
  }

  // ── HAIR (rounded silhouettes; richer set) ──
  const hairStyle = isElder
    ? L.pick(['bald', 'bald', 'short', 'short', 'bun'])
    : L.pick(['short', 'short', 'bun', 'long', 'bald', 'mohawk', 'ponytail', 'curly', 'pigtails', 'fringe']);
  if (hairStyle !== 'bald') {
    const cap = L.sphere(headR * 1.05, 12, hrMat, { y: 0.055, cast: false });
    cap.scale.set(1.03, 0.82, 1.03); H.add(cap);
    if (hairStyle === 'bun') {
      H.add(L.sphere(0.09, 8, hrMat, { y: 0.13, z: -0.07, cast: false }));
    } else if (hairStyle === 'long') {
      const back = L.sphere(headR * 0.95, 10, hrMat, { y: -0.12, z: -headR * 0.78, cast: false });
      back.scale.set(1.1, 1.35, 0.7); H.add(back);
    } else if (hairStyle === 'mohawk') {
      cap.scale.set(0.96, 0.55, 0.96);
      const crest = L.box(0.05, 0.15, 0.26, hrMat, { y: 0.14, cast: false });
      crest.scale.z = 1; H.add(crest);
    } else if (hairStyle === 'ponytail') {
      const tail = L.cyl(0.05, 0.028, 0.26, 8, hrMat, { y: -0.02, z: -headR * 0.95, cast: false });
      tail.rotation.x = -0.5; H.add(tail);
    } else if (hairStyle === 'curly') {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        H.add(L.sphere(0.055, 6, hrMat, { x: Math.cos(a) * headR * 0.92, y: 0.09, z: Math.sin(a) * headR * 0.72 - 0.02, cast: false }));
      }
    } else if (hairStyle === 'pigtails') {
      [-1, 1].forEach(s => H.add(L.sphere(0.062, 8, hrMat, { x: s * headR * 1.05, y: 0.0, z: -0.02, cast: false })));
    } else if (hairStyle === 'fringe') {
      for (let i = -1; i <= 1; i++) H.add(L.sphere(0.05, 8, hrMat, { x: i * 0.08, y: 0.09, z: headR * 0.72, cast: false }));
    }
  }

  // ── ARMS (pivot at shoulder; internal forearm group for an elbow feel) ──
  const armL = new T.Group(), armR = new T.Group();
  armL.position.set(-shDx, shoulderY, 0);
  armR.position.set(shDx, shoulderY, 0);
  [armL, armR].forEach(a2 => {
    a2.add(softLimb(0.075 * build, 0.062 * build, armLen * 0.52, sleeveMat, false));   // upper arm
    const fore = new T.Group();
    fore.position.y = -armLen * 0.52;
    fore.add(softLimb(0.06 * build, 0.048 * build, armLen * 0.48, sleeveMat, false));   // forearm
    fore.add(L.sphere(0.058, 8, skMat, { y: -armLen * 0.48 - 0.01, cast: false }));     // hand
    a2.add(fore);
    a2.userData.fore = fore;
  });
  g.add(armL, armR);

  // ── ACCESSORIES (seeded variety) ── glasses
  if (L.chance(isElder ? 0.5 : 0.22)) {
    [-0.075, 0.075].forEach(ex => {
      const rim = new T.Mesh(new T.TorusGeometry(0.045, 0.008, 6, 12), GLASS_FRAME);
      rim.position.set(ex, 0.03, headR * 0.86); H.add(rim);
      H.add(L.sphere(0.038, 8, GLASS_LENS, { x: ex, y: 0.03, z: headR * 0.84, cast: false }));
    });
    H.add(L.box(0.06, 0.008, 0.008, GLASS_FRAME, { y: 0.03, z: headR * 0.88, cast: false }));
  }

  // hat or cap
  const hatRoll = L.rand(0, 1);
  if (hatRoll < 0.13) {
    const hatMat = cloth(L.pick(['#3a2c1c', '#4a3a22', '#322e2a', '#5a3030']));
    H.add(L.cyl(0.2, 0.22, 0.01, 14, hatMat, { y: 0.16, cast: false }));           // brim
    H.add(L.cyl(0.135, 0.14, 0.16, 12, hatMat, { y: 0.24, cast: false }));         // crown
    H.add(L.cyl(0.142, 0.142, 0.04, 12, cloth(L.pick(ACCENT_PAL)), { y: 0.18, cast: false })); // band
  } else if (hatRoll < 0.24) {
    const capMat = cloth(L.pick(ACCENT_PAL));
    const dome = L.sphere(headR * 1.02, 12, capMat, { y: 0.06, cast: false });
    dome.scale.set(1.04, 0.62, 1.04); H.add(dome);
    H.add(L.box(0.18, 0.02, 0.14, capMat, { y: 0.08, z: headR * 1.0, cast: false }));
  } else if (hatRoll < 0.3) {
    const beanieMat = cloth(L.pick(ACCENT_PAL));
    const dome = L.sphere(headR * 1.06, 12, beanieMat, { y: 0.07, cast: false });
    dome.scale.set(1.05, 0.72, 1.05); H.add(dome);
    H.add(L.cyl(headR * 1.05, headR * 1.05, 0.05, 12, beanieMat, { y: 0.085, cast: false }));
    H.add(L.sphere(0.04, 6, beanieMat, { y: 0.2, cast: false }));
  }

  // scarf
  if (L.chance(isElder ? 0.3 : 0.16)) {
    const scarfMat = L.std({ color: hx(L.pick(ACCENT_PAL)), roughness: 0.85 });
    const ring = new T.Mesh(new T.TorusGeometry(0.1 * build, 0.045, 6, 14), scarfMat);
    ring.position.set(0, neckY - 0.02, 0); ring.rotation.x = TAU / 4; torso.add(ring);
    torso.add(L.box(0.09, 0.24, 0.045, scarfMat, { y: neckY - 0.2, z: 0.12, cast: false }));
  }

  // bag: shoulder bag or backpack
  const bagRoll = L.rand(0, 1);
  if (bagRoll < 0.18) {
    const bagMat = L.std({ color: hx(L.pick(BAG_PAL)), roughness: 0.8 });
    torso.add(L.box(0.2, 0.19, 0.09, bagMat, { x: 0.22 * build, y: hipY + 0.08, z: 0.08 }));
    torso.add(L.sphere(0.055, 8, bagMat, { x: 0.24 * build, y: hipY + 0.14, z: 0.08, cast: false }));
    const strap = L.box(0.04, 0.5, 0.02, bagMat, { x: 0.02, y: shoulderY - 0.18, z: 0.13, cast: false });
    strap.rotation.z = 0.5; torso.add(strap);
  } else if (bagRoll < 0.34) {
    const packMat = L.std({ color: hx(L.pick(PACK_PAL)), roughness: 0.82 });
    const pack = L.box(0.28 * build, 0.32, 0.15, packMat, { y: torsoCY + 0.02, z: -0.19 * build });
    torso.add(pack);
    [-1, 1].forEach(s => torso.add(L.sphere(0.075 * build, 8, packMat, { x: s * 0.14 * build, y: torsoCY + 0.14, z: -0.19 * build, cast: false })));
    [-1, 1].forEach(s => { const st = L.box(0.04, 0.34, 0.02, packMat, { x: s * 0.12 * build, y: torsoCY + 0.04, z: 0.1, cast: false }); st.rotation.x = 0.05; torso.add(st); });
  }

  // elder: a walking cane in the right hand
  if (isElder && L.chance(0.55)) {
    const caneMat = L.MAT.wood('#6a4a2e');
    const fore = armR.userData.fore;
    fore.add(L.cyl(0.018, 0.022, 0.62, 6, caneMat, { y: -armLen * 0.48 - 0.32, z: 0.06, cast: false }));
    fore.add(L.sphere(0.04, 6, caneMat, { y: -armLen * 0.48 - 0.02, z: 0.06, cast: false }));
  }

  // ── finalize: scale whole figure (near-uniform so footprint stays sane) ──
  g.scale.set(scaleH * (0.9 + build * 0.1), scaleH, scaleH * (0.9 + build * 0.1));

  g.userData.limbs = { legL, legR, armL, armR };
  g.userData.torso = torso;
  g.userData.gait = {
    stride: L.rand(0.42, 0.6) * (isKid ? 1.15 : (isElder ? 0.7 : 1)),
    armSwing: L.rand(0.55, 0.85) * (isElder ? 0.6 : 1),
    bob: L.rand(0.02, 0.045) * (isElder ? 0.6 : 1),
    knee: L.rand(0.18, 0.32),
    elbow: L.rand(0.1, 0.22),
    baseY: torso.position.y,
    baseRX: torso.rotation.x,
    breath: L.rand(0.85, 1.2),
  };
  return g;
}

/* ════════════════════════════════════════════════════════════════════════
   animateWalk — cheap, lifelike gait. Rotates the limb rig + bobs the internal
   torso only. Backward compatible (works even without shin/forearm refs).
   Never touches headGrp or scarfTail (game.js owns those).
   ════════════════════════════════════════════════════════════════════════ */
function animateWalk(group, t, moving) {
  const lm = group.userData.limbs; if (!lm) return;
  const ga = group.userData.gait || {};
  const stride   = ga.stride   != null ? ga.stride   : 0.5;
  const armSwing = ga.armSwing != null ? ga.armSwing : 0.7;
  const bobAmt   = ga.bob      != null ? ga.bob      : 0.03;
  const kneeAmt  = ga.knee     != null ? ga.knee     : 0.24;
  const elbowAmt = ga.elbow    != null ? ga.elbow    : 0.16;
  const baseY    = ga.baseY    != null ? ga.baseY    : 0;
  const baseRX   = ga.baseRX   != null ? ga.baseRX   : 0;
  const torso = group.userData.torso;
  const shL = lm.legL.userData && lm.legL.userData.shin;
  const shR = lm.legR.userData && lm.legR.userData.shin;
  const foL = lm.armL.userData && lm.armL.userData.fore;
  const foR = lm.armR.userData && lm.armR.userData.fore;

  if (moving) {
    const s = Math.sin(t), c = Math.cos(t);
    // opposing thigh swing from the hips
    lm.legL.rotation.x = s * stride;
    lm.legR.rotation.x = -s * stride;
    // knee tucks under during the forward recovery of each leg
    if (shL) shL.rotation.x = Math.max(0, -s) * kneeAmt * 1.5 + kneeAmt * 0.2;
    if (shR) shR.rotation.x = Math.max(0, s) * kneeAmt * 1.5 + kneeAmt * 0.2;
    // opposing arm swing (counter to the legs) + a little outward splay
    lm.armL.rotation.x = -s * stride * armSwing;
    lm.armR.rotation.x = s * stride * armSwing;
    lm.armL.rotation.z = 0.08;
    lm.armR.rotation.z = -0.08;
    // elbows flex a touch more on the back-swing
    if (foL) foL.rotation.x = -(Math.max(0, s) * elbowAmt + elbowAmt * 0.45);
    if (foR) foR.rotation.x = -(Math.max(0, -s) * elbowAmt + elbowAmt * 0.45);
    // torso: bob twice per stride + counter-sway, hip roll, slight forward lean
    if (torso) {
      torso.position.y = baseY + Math.abs(c) * bobAmt;
      torso.rotation.y = s * 0.06;
      torso.rotation.z = -s * 0.03;
      torso.rotation.x = baseRX + 0.035;
    }
  } else {
    // gentle idle: breathing + slow weight-shift, limbs ease toward neutral
    const b = ga.breath != null ? ga.breath : 1;
    const breath = Math.sin(t * 0.9 * b);
    const shift = Math.sin(t * 0.4);
    lm.legL.rotation.x = shift * 0.03; lm.legR.rotation.x = -shift * 0.03;
    if (shL) shL.rotation.x = 0.03; if (shR) shR.rotation.x = 0.03;
    lm.armL.rotation.x = breath * 0.045; lm.armR.rotation.x = -breath * 0.03;
    lm.armL.rotation.z = 0.08 + shift * 0.025; lm.armR.rotation.z = -0.08 - shift * 0.025;
    if (foL) foL.rotation.x = -0.14 + breath * 0.02; if (foR) foR.rotation.x = -0.14 - breath * 0.02;
    if (torso) {
      torso.position.y = baseY + (breath * 0.5 + 0.5) * 0.014;   // chest rise
      torso.rotation.y = shift * 0.06;                            // weight shift
      torso.rotation.z = shift * 0.02;
      torso.rotation.x = baseRX;
    }
  }
}

/* ════════════════════════════════════════════════════════════════════════
   makeFly — the fly mascot. Rounded, friendly, readable from ~13u back.
   userData = { wingL, wingR, scarfTail }.
   ════════════════════════════════════════════════════════════════════════ */
function makeFly() {
  const g = new T.Group();

  const bodyMat = L.std({ color: 0x33414f, roughness: 0.5, metalness: 0.12 });
  const bodyDeep = L.std({ color: 0x2a3540, roughness: 0.52, metalness: 0.12 });
  const bellyMat = L.std({ color: 0xe6bc5e, roughness: 0.58 });
  const darkMat = L.std({ color: 0x232a32, roughness: 0.6 });

  // ── ABDOMEN / body (slightly egg, pointing back -Z so head reads forward) ──
  const body = L.sphere(0.44, 18, bodyMat, { y: 0, z: -0.06 });
  body.scale.set(1.0, 0.9, 1.32); g.add(body);
  const belly = L.sphere(0.42, 16, bellyMat, { y: -0.16, z: 0.04, cast: false });
  belly.scale.set(0.74, 0.6, 1.05); g.add(belly);
  [0.04, -0.16, -0.34].forEach((bz, i) => {
    const band = new T.Mesh(new T.TorusGeometry(0.4 - i * 0.05, 0.032, 8, 18), darkMat);
    band.position.set(0, -0.02, bz); band.rotation.x = Math.PI / 2; band.scale.set(1, 0.66, 1); g.add(band);
  });
  const tail = L.sphere(0.12, 10, bodyDeep, { y: -0.04, z: -0.5, cast: false });
  tail.scale.set(0.9, 0.8, 1.2); g.add(tail);

  // ── thorax + HEAD (forward, +Z) ──
  const thorax = L.sphere(0.31, 16, bodyDeep, { y: 0.1, z: 0.34 });
  thorax.scale.set(1.05, 1.0, 1.0); g.add(thorax);
  const ruff = new T.Mesh(new T.TorusGeometry(0.27, 0.06, 8, 18), bodyMat);
  ruff.position.set(0, 0.12, 0.48); ruff.rotation.x = 1.5; ruff.scale.set(1, 1, 0.7); g.add(ruff);
  const head = L.sphere(0.28, 16, bodyMat, { y: 0.2, z: 0.6 });
  head.scale.set(1.05, 1.0, 0.95); g.add(head);
  [-1, 1].forEach(s => g.add(L.sphere(0.06, 8, bellyMat, { x: s * 0.16, y: 0.12, z: 0.7, cast: false })));
  const smile = new T.Mesh(new T.TorusGeometry(0.07, 0.016, 6, 12, Math.PI), darkMat);
  smile.position.set(0, 0.1, 0.78); smile.rotation.z = Math.PI; g.add(smile);

  // ── GOGGLES (expressive emissive lenses + glints) ──
  const goggMat = L.std({ color: 0x4a3320, roughness: 0.45, metalness: 0.2 });
  const lensMat = L.std({ color: 0xb6e6f2, emissive: 0x2a7d96, emissiveIntensity: 0.5, roughness: 0.18, metalness: 0.4 });
  const lensHighlight = L.std({ color: 0xffffff, emissive: 0xeaffff, emissiveIntensity: 0.45, roughness: 0.2 });
  [-0.13, 0.13].forEach(dx => {
    const ring = new T.Mesh(new T.TorusGeometry(0.105, 0.04, 8, 16), goggMat);
    ring.position.set(dx, 0.27, 0.74); g.add(ring);
    const lens = new T.Mesh(new T.CircleGeometry(0.095, 16), lensMat);
    lens.position.set(dx, 0.27, 0.755); g.add(lens);
    g.add(L.sphere(0.024, 6, lensHighlight, { x: dx - 0.03, y: 0.315, z: 0.772, cast: false }));
    g.add(L.sphere(0.012, 6, lensHighlight, { x: dx + 0.035, y: 0.245, z: 0.772, cast: false }));
  });
  g.add(L.box(0.06, 0.02, 0.02, goggMat, { y: 0.27, z: 0.755, cast: false }));
  const strap = new T.Mesh(new T.TorusGeometry(0.29, 0.032, 6, 20), goggMat);
  strap.position.set(0, 0.27, 0.5); strap.rotation.y = Math.PI / 2; strap.scale.set(1, 1, 0.9); g.add(strap);

  // ── ANTENNAE (curved up, glowing tips) ──
  const tipMat = L.MAT.emissive('#ffb020', 0.8);
  [-0.1, 0.1].forEach(dx => {
    const ant = L.cyl(0.014, 0.014, 0.26, 6, darkMat, { x: dx, y: 0.5, z: 0.5, cast: false });
    ant.rotation.x = -0.45; g.add(ant);
    g.add(L.sphere(0.045, 8, tipMat, { x: dx, y: 0.62, z: 0.43, cast: false }));
  });

  // ── SCARF (flowing; scarfTail is the trailing mesh game.js rotates on X) ──
  const scarfMat = L.std({ color: 0xd0473e, roughness: 0.78, side: T.DoubleSide });
  const scarfDark = L.std({ color: 0xab362f, roughness: 0.8, side: T.DoubleSide });
  const wrap = new T.Mesh(new T.TorusGeometry(0.26, 0.07, 8, 18), scarfMat);
  wrap.position.set(0, 0.06, 0.38); wrap.rotation.x = 1.45; g.add(wrap);
  g.add(L.sphere(0.07, 8, scarfMat, { y: 0.0, z: 0.5, cast: false }));
  const scarfTail = new T.Group();
  scarfTail.position.set(-0.14, 0.02, 0.3);
  {
    const seg1 = L.box(0.16, 0.02, 0.42, scarfMat, { z: -0.21, cast: false });
    const seg2 = L.box(0.14, 0.02, 0.34, scarfDark, { y: -0.06, z: -0.55, cast: false });
    seg2.rotation.x = 0.3;
    const seg3 = L.box(0.12, 0.02, 0.26, scarfMat, { y: -0.16, z: -0.82, cast: false });
    seg3.rotation.x = 0.55;
    scarfTail.add(seg1, seg2, seg3);
    for (let i = -1; i <= 1; i++) scarfTail.add(L.box(0.025, 0.02, 0.08, scarfDark, { x: i * 0.04, y: -0.22, z: -0.96, cast: false }));
  }
  g.add(scarfTail);

  // ── MAIL SATCHEL (side bag) ──
  const satMat = L.MAT.wood('#8a5a30');
  const flapMat = L.MAT.flat('#6e441f');
  const sat = new T.Group();
  sat.position.set(0.34, -0.08, 0.0);
  sat.add(L.box(0.3, 0.3, 0.2, satMat));
  sat.add(L.box(0.32, 0.14, 0.22, flapMat, { y: 0.1, cast: false }));
  sat.add(L.box(0.06, 0.06, 0.01, L.MAT.flat('#caa64a'), { y: 0.06, z: 0.115, cast: false }));
  sat.add(L.box(0.16, 0.02, 0.12, L.MAT.flat('#f0e6cc'), { y: 0.16, z: 0.02, cast: false }));
  const satStrap = new T.Mesh(new T.TorusGeometry(0.33, 0.025, 6, 18), flapMat);
  satStrap.position.set(0.16, 0.06, 0.0); satStrap.rotation.z = 0.5; satStrap.scale.set(1, 1, 0.4); g.add(satStrap);
  g.add(sat);

  // ── tiny legs dangling (charm) ──
  const legMat = darkMat;
  [-1, 1].forEach(s => {
    [0.0, 0.18].forEach(zz => {
      const leg = L.cyl(0.018, 0.012, 0.18, 5, legMat, { x: s * 0.22, y: -0.3, z: -0.05 + zz, cast: false });
      leg.rotation.z = s * 0.4; g.add(leg);
    });
  });

  // ── WINGS (translucent membrane + vein lines + a couple of segments) ──
  const wingMat = L.std({ color: 0xeaf4ff, transparent: true, opacity: 0.48, roughness: 0.2, metalness: 0.1, side: T.DoubleSide, emissive: 0x88b0d0, emissiveIntensity: 0.2 });
  const wingMat2 = L.std({ color: 0xdcedff, transparent: true, opacity: 0.36, roughness: 0.25, side: T.DoubleSide, emissive: 0x7aa6cc, emissiveIntensity: 0.16 });
  const veinMat = L.std({ color: 0xbcd0e4, roughness: 0.4, transparent: true, opacity: 0.7, side: T.DoubleSide });
  const sh = new T.Shape();
  sh.moveTo(0, 0);
  sh.quadraticCurveTo(0.55, 0.55, 1.05, 0.2);
  sh.quadraticCurveTo(0.9, -0.06, 0.58, -0.22);
  sh.quadraticCurveTo(0.26, -0.22, 0, 0);
  const wg = new T.ShapeGeometry(sh);
  const sh2 = new T.Shape();
  sh2.moveTo(0, 0);
  sh2.quadraticCurveTo(0.34, 0.2, 0.6, 0.02);
  sh2.quadraticCurveTo(0.46, -0.18, 0.18, -0.2);
  sh2.quadraticCurveTo(0.06, -0.12, 0, 0);
  const wg2 = new T.ShapeGeometry(sh2);

  function buildWing(sign) {
    const wing = new T.Group();
    wing.add(new T.Mesh(wg, wingMat));
    const hind = new T.Mesh(wg2, wingMat2);
    hind.position.set(0.05, -0.16, -0.04);
    wing.add(hind);
    const v1 = L.box(0.92, 0.012, 0.012, veinMat, { x: 0.47, y: 0.18, cast: false }); v1.rotation.z = -0.34;
    const v2 = L.box(0.74, 0.01, 0.01, veinMat, { x: 0.42, y: 0.04, cast: false }); v2.rotation.z = -0.06;
    const v3 = L.box(0.5, 0.009, 0.009, veinMat, { x: 0.3, y: -0.1, cast: false }); v3.rotation.z = 0.18;
    const c1 = L.box(0.012, 0.22, 0.009, veinMat, { x: 0.5, y: 0.06, cast: false });
    const c2 = L.box(0.012, 0.18, 0.009, veinMat, { x: 0.78, y: 0.08, cast: false });
    wing.add(v1, v2, v3, c1, c2);
    wing.scale.x = sign;
    return wing;
  }
  const wingL = buildWing(1);  wingL.position.set(-0.18, 0.32, -0.02); g.add(wingL);
  const wingR = buildWing(-1); wingR.position.set(0.18, 0.32, -0.02); g.add(wingR);

  g.userData = { wingL, wingR, scarfTail };
  return g;
}

/* ════════════════════════════════════════════════════════════════════════
   makeHero — the player courier (young human messenger, abeto.co vibe).
   SAME limb rig as makeNPC so FLY.characters.animateWalk(hero,t,moving) drives it.
     userData.limbs = { legL, legR, armL, armR }   (hip/shoulder pivots)
     userData.torso = THREE.Group                  (bob target)
     userData.gait  = { ... }
     userData.headGrp = THREE.Group                (neck pivot — game.js turns it)
     userData.scarfTail = THREE.Group              (flutter target)
     userData.capMat / userData.scarfMat = own cloned, curved materials (wardrobe)
   Cream hoodie + charcoal trousers + RED messenger pack + RED scarf + RED cap.
   Base y=0, faces +Z, ~1.65m tall.
   ════════════════════════════════════════════════════════════════════════ */
function makeHero() {
  const g = new T.Group();

  // ── deliberate, named hero look (NOT seeded — same every spawn) ──
  const skinHex  = '#e8b489';
  const hoodHex  = '#c9c2b0';        // cream-white hoodie
  const hoodDk   = '#a8a290';
  const pantsHex = '#3a3a42';        // charcoal trousers
  const cuffHex  = '#cf8a3c';
  const capHex   = '#8f231b';        // red cap (wardrobe-recolored)
  const PACK_RED = 0xa52d24;
  const PACK_DK  = 0x872017;
  const EMBLEM   = 0xf4efe6;

  const skMat    = skinMat(skinHex);
  const hoodMat  = cloth(hoodHex);
  const hoodDkMat= cloth(hoodDk);
  const pantsMat = cloth(pantsHex);
  const cuffMat  = cloth(cuffHex);
  // cap material is its OWN clone (wardrobe mutates .color per rank)
  const capMat = cloth(capHex).clone(); L.curve(capMat);
  const hrMat    = hairMat('#221405');
  const packMat  = L.std({ color: PACK_RED, roughness: 0.8 });
  const packDkMat= L.std({ color: PACK_DK, roughness: 0.82 });
  const emblemMat= L.std({ color: EMBLEM, roughness: 0.7 });
  const sneakWhite = L.std({ color: 0xece5d6, roughness: 0.7 });
  const sneakBlue  = L.std({ color: 0x2f4654, roughness: 0.72 });
  const laceMat  = L.std({ color: 0xf0ead8, roughness: 0.7 });

  const build = 1.0;

  // key vertical anchors (mirror makeNPC)
  const hipY = 0.62, shoulderY = 1.16, neckY = 1.30, headY = 1.46;
  const legLen = 0.58, armLen = 0.50;
  const hipDx = 0.115 * build, shDx = 0.235 * build;

  // ── LEGS (pivot at hip; internal shin group + rolled cuff + sneaker) ──
  const legL = new T.Group(), legR = new T.Group();
  legL.position.set(-hipDx, hipY, 0);
  legR.position.set(hipDx, hipY, 0);
  [legL, legR].forEach(lg => {
    lg.add(softLimb(0.112 * build, 0.094 * build, legLen * 0.52, pantsMat, false));   // thigh
    const shin = new T.Group();
    shin.position.y = -legLen * 0.52;
    shin.add(softLimb(0.094 * build, 0.078 * build, legLen * 0.48, pantsMat, false));  // calf
    // rolled-up cuff ring near the ankle
    const cuff = new T.Mesh(new T.TorusGeometry(0.082 * build, 0.026, 6, 12), cuffMat);
    cuff.position.y = -legLen * 0.48 + 0.01; cuff.rotation.x = TAU / 4; cuff.scale.set(1, 1, 0.8);
    shin.add(cuff);
    // chunky two-tone sneaker pointing +Z
    const shoe = new T.Group();
    shoe.position.set(0, -legLen * 0.48 - 0.03, 0.04);
    shoe.add(L.box(0.165 * build, 0.10, 0.30, sneakWhite, { z: 0.02 }));
    shoe.add(L.box(0.155 * build, 0.07, 0.16, sneakBlue, { z: -0.07, cast: false }));
    shoe.add(L.box(0.175 * build, 0.05, 0.32, SOLE, { y: -0.06, z: 0.02, cast: false }));
    shoe.add(L.sphere(0.085 * build, 8, sneakWhite, { y: 0.02, z: 0.15, cast: false }));
    shoe.add(L.box(0.10 * build, 0.018, 0.018, laceMat, { y: 0.05, z: 0.02, cast: false }));
    shoe.add(L.box(0.10 * build, 0.018, 0.018, laceMat, { y: 0.045, z: 0.09, cast: false }));
    shin.add(shoe);
    lg.add(shin);
    lg.userData.shin = shin;
  });
  g.add(legL, legR);

  // ── TORSO (internal group so animateWalk bobs it without moving the world) ──
  const torso = new T.Group();
  g.add(torso);

  const torsoCY = (hipY + shoulderY) / 2 + 0.02;
  const depth = 0.86;
  const waistR = 0.17 * build, chestR = 0.215 * build;

  // rounded pelvis (trouser)
  const pelvis = L.sphere(0.165 * build, 10, pantsMat, { y: hipY - 0.02 });
  pelvis.scale.set(1.06, 0.78, 0.86); torso.add(pelvis);

  // soft rounded hoodie body
  softTorso(torso, hoodMat, { hipY, shoulderY, waistR, chestR, depth });
  // hoodie hem band (slightly darker)
  const hem = L.cyl(waistR * 1.04, waistR * 1.02, 0.1, 12, hoodDkMat, { y: hipY + 0.04, cast: false });
  hem.scale.z = depth + 0.04; torso.add(hem);
  // zipper hint down the front + a pull dot
  torso.add(L.box(0.022, (shoulderY - hipY) * 0.9, 0.01, packDkMat, { y: torsoCY, z: (chestR * depth) + 0.006, cast: false }));
  torso.add(L.sphere(0.016, 6, EYE, { y: torsoCY + 0.16, z: (chestR * depth) + 0.012, cast: false }));
  // kangaroo pocket
  torso.add(L.box(0.2 * build, 0.12, 0.03, hoodDkMat, { y: hipY + 0.16, z: (waistR * depth) + 0.02, cast: false }));
  // rounded shoulder caps (hoodie)
  [-1, 1].forEach(s => { const cap = L.sphere(0.095 * build, 10, hoodMat, { x: s * 0.17 * build, y: shoulderY - 0.02 }); cap.scale.set(1, 0.9, 0.92); torso.add(cap); });
  // hood-down lump at the back of the neck
  const hood = L.sphere(0.16 * build, 12, hoodDkMat, { y: shoulderY - 0.02, z: -0.13 * build, cast: false });
  hood.scale.set(1.1, 0.7, 0.8); torso.add(hood);
  // soft hoodie collar
  const collar = new T.Mesh(new T.TorusGeometry(0.1 * build, 0.04, 6, 14), hoodDkMat);
  collar.position.set(0, neckY - 0.06, 0.01); collar.rotation.x = TAU / 4; collar.scale.set(1, 1, 0.85);
  torso.add(collar);

  // ── RED SCARF — brand accent. Ring at the neck + a tail draping over the shoulder;
  // game.js flutters the tail with run speed. Own clone (BAZAR wardrobe recolors it). ──
  const scarfMat = L.std({ color: 0xb5352a, roughness: 0.85 }).clone(); L.curve(scarfMat);
  const scarfRing = new T.Mesh(new T.TorusGeometry(0.105 * build, 0.048, 8, 14), scarfMat);
  scarfRing.position.set(0, neckY - 0.02, 0.015); scarfRing.rotation.x = TAU / 4; scarfRing.scale.set(1, 1, 0.9);
  torso.add(scarfRing);
  torso.add(L.sphere(0.055, 8, scarfMat, { x: 0.11 * build, y: neckY - 0.03, z: 0.06, cast: false }));   // knot
  // tail: overlapping panels pivoting from the neck, trailing behind & outward
  const scarfTail = new T.Group();
  scarfTail.position.set(0.22 * build, neckY - 0.02, -0.13);
  scarfTail.rotation.set(-0.5, 0, 0.5);
  scarfTail.add(L.box(0.11, 0.32, 0.026, scarfMat, { y: -0.16, cast: false }));
  scarfTail.add(L.box(0.09, 0.18, 0.024, scarfMat, { x: 0.02, y: -0.38, cast: false }));
  torso.add(scarfTail);
  g.userData.scarfTail = scarfTail;

  // neck
  torso.add(L.cyl(0.06, 0.07, 0.13, 8, skMat, { y: neckY - 0.03, cast: false }));

  // ── HEAD PIVOT at the neck (game.js turns it to look around) ──
  const headR = 0.2 * build;
  const H = new T.Group(); H.position.set(0, headY, 0); torso.add(H);
  g.userData.headGrp = H;
  addHumanFace(H, headR, skMat, hrMat, { wideEyes: true });

  // ── HAIR (front fringe + sides peeking under the cap) ──
  const hairCap = L.sphere(headR * 1.04, 12, hrMat, { y: 0.04, cast: false });
  hairCap.scale.set(1.04, 0.86, 1.04); H.add(hairCap);
  for (let i = -1; i <= 1; i++) H.add(L.sphere(0.05, 8, hrMat, { x: i * 0.08, y: 0.1, z: headR * 0.7, cast: false }));
  [-1, 1].forEach(s => H.add(L.box(0.03, 0.1, 0.04, hrMat, { x: s * headR * 0.92, y: -0.02, z: headR * 0.3, cast: false })));

  // ── CAP (red ball-cap with forward bill) — echoes the pack ──
  const dome = L.sphere(headR * 1.05, 12, capMat, { y: 0.07, cast: false });
  dome.scale.set(1.04, 0.66, 1.04); H.add(dome);
  H.add(L.box(0.22, 0.022, 0.16, capMat, { y: 0.09, z: headR * 0.92, cast: false }));   // bill
  H.add(L.sphere(0.02, 6, capMat, { y: 0.2, cast: false }));                            // button
  const capBand = new T.Mesh(new T.TorusGeometry(headR * 1.0, 0.02, 6, 16), L.std({ color: 0xd8cdb2, roughness: 0.8 }));
  capBand.position.y = 0.02; capBand.rotation.x = TAU / 4; H.add(capBand);

  // ── ARMS (pivot at shoulder; internal forearm group + hand) — hoodie sleeves ──
  const armL = new T.Group(), armR = new T.Group();
  armL.position.set(-shDx, shoulderY, 0);
  armR.position.set(shDx, shoulderY, 0);
  [armL, armR].forEach(a2 => {
    a2.add(softLimb(0.08 * build, 0.066 * build, armLen * 0.52, hoodMat, false));   // upper sleeve
    const fore = new T.Group();
    fore.position.y = -armLen * 0.52;
    fore.add(softLimb(0.064 * build, 0.05 * build, armLen * 0.48, hoodMat, false));  // forearm sleeve
    const sc = new T.Mesh(new T.TorusGeometry(0.055, 0.018, 6, 10), hoodDkMat);
    sc.position.y = -armLen * 0.48 + 0.01; sc.rotation.x = TAU / 4; fore.add(sc);
    fore.add(L.sphere(0.062, 8, skMat, { y: -armLen * 0.48 - 0.02, cast: false }));  // hand
    a2.add(fore);
    a2.userData.fore = fore;
  });
  g.add(armL, armR);

  // ── RED MESSENGER PACK on the back (signature silhouette, read from behind) ──
  const packCY = torsoCY + 0.03;
  const packZ  = -0.21 * build;
  torso.add(L.box(0.34 * build, 0.40, 0.20, packMat, { y: packCY, z: packZ }));
  // rounded corner caps → soft messenger bag, not a crate
  [-1, 1].forEach(s => {
    torso.add(L.sphere(0.1, 10, packMat, { x: s * 0.17 * build, y: packCY + 0.16, z: packZ, cast: false }));
    torso.add(L.sphere(0.1, 10, packMat, { x: s * 0.17 * build, y: packCY - 0.16, z: packZ, cast: false }));
  });
  // top lid / flap + rolled top
  torso.add(L.box(0.36 * build, 0.12, 0.22, packDkMat, { y: packCY + 0.20, z: packZ, cast: false }));
  const roll = L.cyl(0.07, 0.07, 0.34 * build, 10, packDkMat, { y: packCY + 0.26, z: packZ, cast: false });
  roll.rotation.z = TAU / 4; torso.add(roll);
  // back pocket panel + buckle hints
  torso.add(L.box(0.24 * build, 0.18, 0.04, packDkMat, { y: packCY - 0.08, z: packZ - 0.1, cast: false }));
  [-1, 1].forEach(s => torso.add(L.box(0.03, 0.05, 0.05, packDkMat, { x: s * 0.1 * build, y: packCY - 0.18, z: packZ - 0.1, cast: false })));
  // cream EMBLEM patch + a tiny red mark
  const emblem = L.cyl(0.075, 0.075, 0.02, 16, emblemMat, { y: packCY + 0.02, z: packZ - 0.115, cast: false });
  emblem.rotation.x = TAU / 4; torso.add(emblem);
  const emblemDot = L.cyl(0.03, 0.03, 0.024, 12, packMat, { y: packCY + 0.02, z: packZ - 0.122, cast: false });
  emblemDot.rotation.x = TAU / 4; torso.add(emblemDot);
  // an envelope peeking out of the top roll
  torso.add(L.box(0.14, 0.1, 0.02, L.std({ color: 0xf0e6cc, roughness: 0.7 }), { y: packCY + 0.30, z: packZ + 0.02, cast: false }));

  // ── SHOULDER STRAPS over the chest (frame the silhouette front & back) ──
  [-1, 1].forEach(s => {
    const strap = L.box(0.05, 0.46, 0.04, packMat, { x: s * 0.12 * build, y: torsoCY + 0.02, z: 0.15 * build });
    strap.rotation.z = s * 0.06; torso.add(strap);
    torso.add(L.box(0.05, 0.05, 0.30, packMat, { x: s * 0.13 * build, y: shoulderY - 0.01, z: -0.02, cast: false }));
    torso.add(L.box(0.024, 0.05, 0.05, packDkMat, { x: s * 0.115 * build, y: torsoCY + 0.06, z: 0.16 * build, cast: false }));
  });
  torso.add(L.box(0.22 * build, 0.03, 0.02, packDkMat, { y: torsoCY + 0.06, z: 0.155 * build, cast: false }));

  // ── finalize: scale so the figure stands ~1.65m, feet at y≈0 ──
  g.scale.setScalar(1.04);

  g.userData.limbs = { legL, legR, armL, armR };
  g.userData.torso = torso;
  g.userData.capMat = capMat;       // wardrobe hook (rank colorways)
  g.userData.scarfMat = scarfMat;   // BAZAR wardrobe hook
  g.userData.gait = {
    stride: 0.52,
    armSwing: 0.78,
    bob: 0.038,
    knee: 0.28,
    elbow: 0.18,
    baseY: torso.position.y,
    baseRX: torso.rotation.x,
    breath: 1.0,
  };
  return g;
}

/* ════════════════════════════════════════════════════════════════════════
   BONUS — tiny ambient creatures (base y=0, facing +Z).
   ════════════════════════════════════════════════════════════════════════ */
function makePigeon() {
  const g = new T.Group();
  const bodyMat = L.std({ color: 0x8a909c, roughness: 0.8 });
  const headMat = L.std({ color: 0x6f7682, roughness: 0.8 });
  const neckMat = L.std({ color: 0x5a8a86, roughness: 0.55, metalness: 0.2 });   // iridescent collar
  const beakMat = L.MAT.flat('#d8a040');
  const footMat = L.MAT.flat('#c86848');
  // plump rounded body
  const body = L.sphere(0.14, 12, bodyMat, { y: 0.14, z: -0.02 });
  body.scale.set(1, 1.0, 1.35); g.add(body);
  // breast
  g.add(L.sphere(0.1, 10, bodyMat, { y: 0.15, z: 0.08, cast: false }));
  // iridescent neck ring
  const ring = new T.Mesh(new T.TorusGeometry(0.075, 0.03, 6, 12), neckMat);
  ring.position.set(0, 0.21, 0.07); ring.rotation.x = 1.1; g.add(ring);
  // cute round head + big friendly eyes
  g.add(L.sphere(0.088, 10, headMat, { y: 0.26, z: 0.12 }));
  const beak = L.cyl(0.004, 0.028, 0.06, 5, beakMat, { y: 0.24, z: 0.2, cast: false }); beak.rotation.x = Math.PI / 2; g.add(beak);
  [-0.032, 0.032].forEach(ex => {
    g.add(L.sphere(0.02, 8, L.std({ color: 0xd88030, roughness: 0.5 }), { x: ex, y: 0.27, z: 0.17, cast: false }));
    g.add(L.sphere(0.012, 6, EYE, { x: ex, y: 0.27, z: 0.185, cast: false }));
  });
  // folded wings — pivoted at the shoulder so world.js can flap them on takeoff
  const wings = [];
  [-1, 1].forEach(s => {
    const wp = new T.Group(); wp.position.set(s * 0.06, 0.16, -0.04);
    const w = L.sphere(0.06, 8, headMat, { x: s * 0.05, y: -0.02, z: -0.01, cast: false });
    w.scale.set(0.6, 1.0, 1.7); wp.add(w);
    wp.userData.side = s; g.add(wp); wings.push(wp);
  });
  g.userData.wings = wings;
  // fanned tail
  const t = L.box(0.11, 0.02, 0.16, bodyMat, { y: 0.11, z: -0.2, cast: false }); t.rotation.x = -0.2; g.add(t);
  // little feet
  [-1, 1].forEach(s => g.add(L.cyl(0.006, 0.006, 0.055, 4, footMat, { x: s * 0.04, y: 0.03, z: 0.03, cast: false })));
  return g;
}

function makeDog() {
  const g = new T.Group();
  const furHex = L.pick(['#8a6038', '#6a4a2e', '#c8b48a', '#3a3030', '#a07848']);
  const furMat = L.std({ color: hx(furHex), roughness: 0.85 });
  const noseMat = L.MAT.flat('#1a1410');
  const collarMat = L.std({ color: hx(L.pick(ACCENT_PAL)), roughness: 0.7 });
  // rounded barrel body
  const body = L.cyl(0.135, 0.12, 0.5, 10, furMat, { y: 0.33, z: -0.02 });
  body.rotation.z = Math.PI / 2; body.rotation.x = Math.PI / 2; g.add(body);
  g.add(L.sphere(0.155, 12, furMat, { y: 0.35, z: -0.06 }));      // haunch
  g.add(L.sphere(0.14, 12, furMat, { y: 0.35, z: 0.16 }));        // chest
  // cute head + rounded snout
  g.add(L.sphere(0.125, 12, furMat, { y: 0.4, z: 0.28 }));
  const snout = L.sphere(0.075, 10, furMat, { y: 0.35, z: 0.4, cast: false }); snout.scale.set(1, 0.85, 1.2); g.add(snout);
  g.add(L.sphere(0.028, 6, noseMat, { y: 0.37, z: 0.46, cast: false }));
  [-0.05, 0.05].forEach(ex => {
    g.add(L.sphere(0.03, 8, WHITE, { x: ex, y: 0.44, z: 0.36, cast: false }));
    g.add(L.sphere(0.02, 6, EYE, { x: ex, y: 0.44, z: 0.375, cast: false }));
  });
  // floppy ears
  [-1, 1].forEach(s => { const ear = L.sphere(0.055, 8, furMat, { x: s * 0.11, y: 0.44, z: 0.24, cast: false }); ear.scale.set(0.5, 1.3, 0.7); ear.rotation.z = s * 0.3; g.add(ear); });
  // collar
  const collar = new T.Mesh(new T.TorusGeometry(0.1, 0.018, 6, 14), collarMat);
  collar.position.set(0, 0.36, 0.2); collar.rotation.x = 1.3; g.add(collar);
  g.add(L.sphere(0.02, 6, L.MAT.flat('#caa64a'), { y: 0.28, z: 0.26, cast: false }));   // tag
  // legs
  [[-0.1, 0.18], [0.1, 0.18], [-0.1, -0.2], [0.1, -0.2]].forEach(([x, z]) => {
    g.add(L.cyl(0.032, 0.028, 0.3, 6, furMat, { x, y: 0.15, z, cast: false }));
    g.add(L.sphere(0.035, 6, furMat, { x, y: 0.02, z: z + 0.02, cast: false }));         // paw
  });
  // wagging-ready curled tail
  const tail = L.cyl(0.032, 0.014, 0.24, 6, furMat, { y: 0.44, z: -0.24, cast: false });
  tail.rotation.x = -0.9; g.add(tail);
  g.add(L.sphere(0.03, 6, furMat, { y: 0.56, z: -0.28, cast: false }));
  return g;
}

/* a small lounging cat — base y=0, facing +Z */
function makeCat() {
  const g = new T.Group();
  const furHex = L.pick(['#3a3330', '#c8a060', '#9a9690', '#5a4838', '#e0dcd4', '#7a6a58']);
  const furMat = L.std({ color: hx(furHex), roughness: 0.8 });
  const noseMat = L.MAT.flat('#d08070');
  // arched loaf body
  const body = L.sphere(0.16, 12, furMat, { y: 0.16, z: -0.04 });
  body.scale.set(1.0, 0.88, 1.5); g.add(body);
  g.add(L.sphere(0.12, 10, furMat, { y: 0.17, z: 0.12 }));       // chest
  // rounder cute head
  g.add(L.sphere(0.115, 12, furMat, { y: 0.28, z: 0.22 }));
  const muzzle = L.sphere(0.055, 8, furMat, { y: 0.23, z: 0.31, cast: false }); muzzle.scale.set(1.1, 0.8, 1); g.add(muzzle);
  g.add(L.sphere(0.02, 6, noseMat, { y: 0.24, z: 0.35, cast: false }));
  // triangular ears
  [-1, 1].forEach(s => g.add(L.cyl(0.001, 0.05, 0.09, 4, furMat, { x: s * 0.07, y: 0.37, z: 0.2, cast: false })));
  // big bright eyes
  [-0.048, 0.048].forEach(ex => {
    g.add(L.sphere(0.026, 8, L.std({ color: 0x8ad07a, roughness: 0.4 }), { x: ex, y: 0.29, z: 0.29, cast: false }));
    g.add(L.sphere(0.012, 6, EYE, { x: ex, y: 0.29, z: 0.305, cast: false }));
  });
  // whiskers
  [-1, 1].forEach(s => { for (let i = 0; i < 2; i++) { const w = L.box(0.12, 0.004, 0.004, WHITE, { x: s * 0.1, y: 0.23 + i * 0.02, z: 0.3, cast: false }); w.rotation.y = s * 0.3; g.add(w); } });
  // tucked front paws
  [-1, 1].forEach(s => g.add(L.sphere(0.045, 8, furMat, { x: s * 0.07, y: 0.05, z: 0.18, cast: false })));
  // curled tail
  const tail = new T.Group();
  tail.position.set(0.0, 0.14, -0.22);
  const t1 = L.cyl(0.032, 0.022, 0.2, 6, furMat, { z: -0.08, cast: false }); t1.rotation.x = -0.6;
  const t2 = L.sphere(0.05, 8, furMat, { y: 0.06, z: -0.18, cast: false });
  tail.add(t1, t2); g.add(tail);
  return g;
}

/* a seated street musician with a guitar — base y=0, facing +Z */
function makeStreetMusician() {
  const g = new T.Group();
  const skHex = L.pick(L.PAL.skin);
  const skMat = skinMat(skHex);
  const shirtMat = cloth(L.pick(L.PAL.cloth));
  const pantsMat = cloth(L.pick(PANTS_PAL));
  const hatMat = cloth(L.pick(['#3a2c1c', '#4a3a22', '#5a3030']));
  const hrMat = hairMat(L.pick(L.PAL.hair));

  // low crate stool
  const crateMat = L.MAT.wood('#7a5a34');
  g.add(L.box(0.42, 0.42, 0.42, crateMat, { y: 0.21 }));

  // seated rounded torso
  const seatY = 0.42;
  const trunk = L.cyl(0.19, 0.16, 0.42, 12, shirtMat, { y: seatY + 0.26 }); trunk.scale.z = 0.85; g.add(trunk);
  g.add(L.sphere(0.19, 12, shirtMat, { y: seatY + 0.44, cast: false }));   // chest/shoulders
  g.add(L.cyl(0.055, 0.062, 0.1, 8, skMat, { y: seatY + 0.5, cast: false }));   // neck

  // head via shared face
  const headY = seatY + 0.64;
  const H = new T.Group(); H.position.set(0, headY, 0); g.add(H);
  addHumanFace(H, 0.17, skMat, hrMat, {});
  // hair peeking + brimmed hat
  const cap = L.sphere(0.18, 12, hrMat, { y: 0.04, cast: false }); cap.scale.set(1.02, 0.72, 1.02); H.add(cap);
  H.add(L.cyl(0.2, 0.22, 0.01, 14, hatMat, { y: 0.15, cast: false }));
  H.add(L.cyl(0.13, 0.135, 0.15, 12, hatMat, { y: 0.22, cast: false }));
  H.add(L.cyl(0.137, 0.137, 0.03, 12, cloth(L.pick(ACCENT_PAL)), { y: 0.16, cast: false }));

  // thighs forward (seated), shins down
  [-1, 1].forEach(s => {
    const thigh = L.cyl(0.088, 0.076, 0.34, 8, pantsMat, { x: s * 0.1, y: seatY + 0.02, z: 0.17 }); thigh.rotation.x = Math.PI / 2; g.add(thigh);
    g.add(L.cyl(0.072, 0.06, 0.34, 8, pantsMat, { x: s * 0.1, y: seatY - 0.16, z: 0.32 }));
    g.add(L.box(0.12, 0.08, 0.22, L.std({ color: 0x1a1410, roughness: 0.8 }), { x: s * 0.1, y: seatY - 0.32, z: 0.42, cast: false }));
    g.add(L.sphere(0.075, 8, L.std({ color: 0x1a1410, roughness: 0.8 }), { x: s * 0.1, y: seatY - 0.3, z: 0.52, cast: false }));   // shoe toe
  });

  // guitar across the lap (angled)
  const guitar = new T.Group();
  guitar.position.set(-0.1, seatY + 0.18, 0.26);
  guitar.rotation.z = 0.5; guitar.rotation.y = -0.3;
  const woodMat = L.MAT.wood('#9a5a28');
  const bodyG = L.sphere(0.16, 12, woodMat, { cast: false }); bodyG.scale.set(1.0, 1.1, 0.32); guitar.add(bodyG);
  guitar.add(L.sphere(0.05, 8, L.MAT.flat('#1a1008'), { z: 0.04, cast: false }));
  guitar.add(L.box(0.07, 0.6, 0.05, woodMat, { y: 0.34, cast: false }));
  guitar.add(L.box(0.09, 0.12, 0.06, L.MAT.flat('#2a1c10'), { y: 0.66, cast: false }));
  g.add(guitar);

  // arms loosely toward the guitar
  const armMat = shirtMat;
  const armR = L.cyl(0.06, 0.05, 0.4, 8, armMat, { x: 0.16, y: seatY + 0.28, z: 0.18 }); armR.rotation.x = 0.8; armR.rotation.z = 0.3; g.add(armR);
  const armL = L.cyl(0.06, 0.05, 0.4, 8, armMat, { x: -0.18, y: seatY + 0.3, z: 0.16 }); armL.rotation.x = 0.5; armL.rotation.z = -0.5; g.add(armL);
  [[0.16, seatY + 0.05, 0.34], [-0.32, seatY + 0.4, 0.18]].forEach(([x, y, z]) => g.add(L.sphere(0.055, 8, skMat, { x, y, z, cast: false })));

  return g;
}

FLY.characters = { makeNPC, animateWalk, makeHero, makeFly, makePigeon, makeDog, makeCat, makeStreetMusician };
})();
