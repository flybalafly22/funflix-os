/* ════════════════════════════════════════════════════════════════════════
   THE FLY — town/characters.js   (charming, lively townsfolk + the hero courier)
   FLY.characters.makeNPC(opts) -> THREE.Group  (base y=0, facing +Z)
       group.userData.limbs = { legL, legR, armL, armR }  for walk animation
       group.userData.torso = THREE.Group           (internal bob target)
   FLY.characters.animateWalk(group, t, moving)  -> poses limbs (no world move)
   FLY.characters.makeFly() -> THREE.Group (the courier)
       group.userData = { wingL, wingR, scarfTail }   for game.js to animate
   BONUS: makePigeon(), makeDog(), makeCat(), makeStreetMusician()
   ════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
const L = FLY.lib, T = L.T, TAU = L.TAU;
const hx = s => parseInt(s.replace('#', '0x'));

/* ── small shared material helpers (all cached via L.std) ── */
const cloth = hex => L.std({ color: hx(hex), roughness: 0.86 });
const skinMat = hex => L.std({ color: hx(hex), roughness: 0.66 });
const hairMat = hex => L.std({ color: hx(hex), roughness: 0.92 });
const EYE = L.std({ color: 0x161318, roughness: 0.42 });
const WHITE = L.std({ color: 0xf4efe6, roughness: 0.6 });
const MOUTH = L.std({ color: 0x8a4a44, roughness: 0.7 });
const SOLE = L.std({ color: 0x14110d, roughness: 0.9 });
const GLASS_FRAME = L.std({ color: 0x2a2622, roughness: 0.5, metalness: 0.3 });
const GLASS_LENS = L.std({ color: 0xbfe6ef, roughness: 0.2, metalness: 0.2, transparent: true, opacity: 0.55 });
const GREY_HAIR = L.std({ color: 0xc8c4bc, roughness: 0.92 });

const PANTS_PAL = ['#394050', '#5a4830', '#3a4868', '#282828', '#484840', '#3a3838', '#6a4a2e', '#2e3a44', '#5a3a4a'];
const SHOE_PAL  = ['#1a1410', '#2a1c12', '#33240f', '#15151a', '#3a2418', '#222'];
const ACCENT_PAL = ['#d8c84a', '#c84040', '#3a7a90', '#e0a040', '#8060b0', '#d0473e', '#40906a'];
const COAT_PAL = ['#3a4458', '#5a4030', '#384038', '#52384a', '#2e3848', '#4a3a2a', '#36504a'];
const BAG_PAL = ['#6a4a2e', '#3a4458', '#5a3030', '#384038', '#52423a'];
const PACK_PAL = ['#3a5a4a', '#4a3a5a', '#5a4030', '#2e3848', '#7a4a3a'];
const APRON_PAL = ['#7a4a2e', '#3a5a4a', '#5a3a4a', '#8a6a3a', '#444a52'];

/* a soft rounded "limb": a tapered cylinder with sphere caps, grown DOWN from y=0.
   returns a Group so the caller can drop it into a pivot group cleanly. */
function softLimb(rTop, rBot, len, mat, capBot) {
  const grp = new T.Group();
  const shaft = L.cyl(rTop, rBot, len, 8, mat, { y: -len / 2, cast: true });
  grp.add(shaft);
  grp.add(L.sphere(rTop, 8, mat, { y: 0, cast: false }));
  if (capBot !== false) grp.add(L.sphere(rBot, 8, mat, { y: -len, cast: false }));
  return grp;
}

/* ════════════════════════════════════════════════════════════════════════
   NPC — townsfolk with proportion + accessory variety + body archetypes.
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
               : L.rand(0.92, 1.1);                                   // overall height
  const build = isKid ? L.rand(0.82, 1.0)
              : isElder ? L.rand(0.94, 1.22)
              : L.rand(0.86, 1.18);                                   // girth
  const stoop = isElder ? L.rand(0.06, 0.14) : 0;                     // elders lean forward
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

  // key vertical anchors (pre-scale; we scale the whole group at the end)
  const hipY = 0.62, shoulderY = 1.16, neckY = 1.30, headY = 1.46;
  const legLen = 0.58, armLen = 0.50;
  const hipDx = 0.115 * build, shDx = 0.235 * build;

  // ── LEGS (pivot at hip) — each holds an internal "shin" group for a knee bend feel ──
  const legL = new T.Group(), legR = new T.Group();
  legL.position.set(-hipDx, hipY, 0);
  legR.position.set(hipDx, hipY, 0);
  [legL, legR].forEach(lg => {
    // thigh
    const thigh = softLimb(0.108 * build, 0.092 * build, legLen * 0.52, pantsMat, false);
    lg.add(thigh);
    // shin pivots from the knee so the gait can bend it (kept subtle in animateWalk)
    const shin = new T.Group();
    shin.position.y = -legLen * 0.52;
    shin.add(softLimb(0.092 * build, 0.078 * build, legLen * 0.48, pantsMat, false));
    // shoe: a little rounded boot pointing +Z
    const shoe = L.box(0.16 * build, 0.1, 0.26, shoeMat, { y: -legLen * 0.48 - 0.02, z: 0.05 });
    shoe.add(L.box(0.165 * build, 0.04, 0.27, SOLE, { y: -0.05, cast: false }));
    shin.add(shoe);
    lg.add(shin);
    lg.userData.shin = shin;
  });
  g.add(legL, legR);

  // ── TORSO (internal group so animateWalk can bob it without moving the world) ──
  const torso = new T.Group();
  if (stoop) torso.rotation.x = stoop;
  g.add(torso);

  // hips/pelvis fill
  torso.add(L.box(0.30 * build, 0.18, 0.22 * build, pantsMat, { y: hipY - 0.02, cast: true }));

  // body type: tee, coat, tunic, or apron-wearing worker
  const bodyType = L.pick(['tee', 'tee', 'coat', 'tunic', 'apron']);
  const torsoH = shoulderY - hipY + 0.16;
  const torsoCY = (hipY + shoulderY) / 2 + 0.02;
  const chest = L.box(0.40 * build, torsoH, 0.24 * build, shirtMat, { y: torsoCY });
  torso.add(chest);
  // collar / neckline accent
  torso.add(L.box(0.30 * build, 0.07, 0.245 * build, L.std({ color: hx(L.pick(L.PAL.trims)), roughness: 0.8 }), { y: shoulderY - 0.02, cast: false }));

  let sleeveMat = shirtMat;
  if (bodyType === 'coat') {
    const coatMat = cloth(L.pick(COAT_PAL));
    sleeveMat = coatMat;
    torso.add(L.box(0.44 * build, torsoH * 0.74, 0.27 * build, coatMat, { y: hipY + torsoH * 0.30 }));
    // open-front strip of inner shirt
    torso.add(L.box(0.1, torsoH * 0.7, 0.005, shirtMat, { y: torsoCY, z: 0.138 * build, cast: false }));
    // buttons
    for (let i = 0; i < 3; i++) torso.add(L.sphere(0.018, 6, EYE, { x: 0.075 * build, y: shoulderY - 0.14 - i * 0.14, z: 0.142 * build, cast: false }));
  } else if (bodyType === 'tunic') {
    // a skirted lower body
    torso.add(L.cyl(0.21 * build, 0.30 * build, 0.34, 10, shirtMat, { y: hipY - 0.06 }));
  } else if (bodyType === 'apron') {
    // worker apron over the chest
    const apronMat = cloth(L.pick(APRON_PAL));
    torso.add(L.box(0.26 * build, torsoH * 0.86, 0.012, apronMat, { y: torsoCY - 0.02, z: 0.128 * build, cast: false }));
    // apron neck strap
    torso.add(L.box(0.04, 0.2, 0.012, apronMat, { x: 0.07 * build, y: shoulderY - 0.04, z: 0.13 * build, cast: false }));
    // small apron pocket
    torso.add(L.box(0.14 * build, 0.08, 0.014, cloth(L.pick(APRON_PAL)), { y: hipY + 0.16, z: 0.132 * build, cast: false }));
  }

  // neck
  torso.add(L.cyl(0.06, 0.07, 0.12, 8, skMat, { y: neckY - 0.03, cast: false }));

  // ── HEAD ──
  const headR = 0.185 * (isKid ? 1.1 : (isElder ? 0.98 : 1.0));
  const head = L.sphere(headR, 14, skMat, { y: headY });
  head.scale.set(0.96, 1.04, 0.98);
  torso.add(head);
  // ears
  [-1, 1].forEach(s => torso.add(L.sphere(0.045, 6, skMat, { x: s * headR * 0.95, y: headY, z: -0.01, cast: false })));
  // nose
  torso.add(L.sphere(0.034, 6, skMat, { y: headY - 0.012, z: headR * 0.97, cast: false }));
  // eyes (white + pupil)
  [-0.07, 0.07].forEach(ex => {
    torso.add(L.sphere(0.038, 8, WHITE, { x: ex, y: headY + 0.03, z: headR * 0.86, cast: false }));
    torso.add(L.sphere(0.020, 6, EYE, { x: ex, y: headY + 0.03, z: headR * 0.92, cast: false }));
  });
  // a small readable mouth
  torso.add(L.box(0.06, 0.014, 0.01, MOUTH, { y: headY - 0.075, z: headR * 0.92, cast: false }));
  // subtle brows
  [-0.07, 0.07].forEach(ex => torso.add(L.box(0.055, 0.012, 0.01, hrMat, { x: ex, y: headY + 0.085, z: headR * 0.9, cast: false })));
  // elder: rosy cheeks + maybe a little beard/moustache
  if (isElder) {
    [-1, 1].forEach(s => torso.add(L.sphere(0.03, 6, L.std({ color: 0xd89880, roughness: 0.7 }), { x: s * 0.085, y: headY - 0.02, z: headR * 0.88, cast: false })));
    if (L.chance(0.5)) {
      const beardMat = GREY_HAIR;
      const beard = L.sphere(headR * 0.78, 10, beardMat, { y: headY - 0.11, z: headR * 0.62, cast: false });
      beard.scale.set(1.0, 0.7, 0.7); torso.add(beard);
    }
  }

  // ── HAIR (style by seed; richer set) ──
  const hairStyle = isElder
    ? L.pick(['bald', 'bald', 'short', 'short', 'bun'])
    : L.pick(['short', 'short', 'bun', 'long', 'bald', 'mohawk', 'ponytail', 'curly', 'pigtails']);
  if (hairStyle !== 'bald') {
    if (hairStyle === 'short') {
      const cap = L.sphere(headR * 1.06, 12, hrMat, { y: headY + 0.06, cast: false });
      cap.scale.set(1.02, 0.78, 1.02); torso.add(cap);
    } else if (hairStyle === 'bun') {
      const cap = L.sphere(headR * 1.05, 12, hrMat, { y: headY + 0.05, cast: false });
      cap.scale.set(1.02, 0.85, 1.02); torso.add(cap);
      torso.add(L.sphere(0.09, 8, hrMat, { y: headY + 0.18, z: -0.06, cast: false }));
    } else if (hairStyle === 'long') {
      const cap = L.sphere(headR * 1.06, 12, hrMat, { y: headY + 0.05, cast: false });
      cap.scale.set(1.04, 0.9, 1.04); torso.add(cap);
      const back = L.box(0.30, 0.30, 0.1, hrMat, { y: headY - 0.12, z: -headR * 0.85, cast: false });
      torso.add(back);
    } else if (hairStyle === 'mohawk') {
      const cap = L.sphere(headR * 1.04, 12, hrMat, { y: headY + 0.04, cast: false });
      cap.scale.set(1.0, 0.6, 1.0); torso.add(cap);
      torso.add(L.box(0.05, 0.16, 0.26, hrMat, { y: headY + 0.16, cast: false }));
    } else if (hairStyle === 'ponytail') {
      const cap = L.sphere(headR * 1.05, 12, hrMat, { y: headY + 0.05, cast: false });
      cap.scale.set(1.02, 0.82, 1.02); torso.add(cap);
      const tail = L.cyl(0.05, 0.03, 0.26, 8, hrMat, { y: headY - 0.04, z: -headR * 0.95, cast: false });
      tail.rotation.x = -0.5; torso.add(tail);
    } else if (hairStyle === 'curly') {
      const cap = L.sphere(headR * 1.1, 12, hrMat, { y: headY + 0.07, cast: false });
      cap.scale.set(1.08, 0.9, 1.08); torso.add(cap);
      // a few curl bumps
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU;
        torso.add(L.sphere(0.055, 6, hrMat, { x: Math.cos(a) * headR * 0.9, y: headY + 0.12, z: Math.sin(a) * headR * 0.7 - 0.02, cast: false }));
      }
    } else if (hairStyle === 'pigtails') {
      const cap = L.sphere(headR * 1.05, 12, hrMat, { y: headY + 0.05, cast: false });
      cap.scale.set(1.02, 0.82, 1.02); torso.add(cap);
      [-1, 1].forEach(s => torso.add(L.sphere(0.06, 8, hrMat, { x: s * headR * 1.05, y: headY + 0.02, z: -0.02, cast: false })));
    }
  }

  // ── ARMS (pivot at shoulder; internal forearm group for an elbow feel) ──
  const armL = new T.Group(), armR = new T.Group();
  armL.position.set(-shDx, shoulderY, 0);
  armR.position.set(shDx, shoulderY, 0);
  [armL, armR].forEach(ar2 => {
    // upper arm
    ar2.add(softLimb(0.077 * build, 0.064 * build, armLen * 0.52, sleeveMat, false));
    // forearm pivots at the elbow
    const fore = new T.Group();
    fore.position.y = -armLen * 0.52;
    fore.add(softLimb(0.062 * build, 0.05 * build, armLen * 0.48, sleeveMat, false));
    // hand
    fore.add(L.sphere(0.06, 8, skMat, { y: -armLen * 0.48 - 0.01, cast: false }));
    ar2.add(fore);
    ar2.userData.fore = fore;
  });
  g.add(armL, armR);

  // ── ACCESSORIES (seeded variety on SOME npcs) ──
  // glasses
  if (L.chance(isElder ? 0.5 : 0.22)) {
    [-0.07, 0.07].forEach(ex => {
      const rim = new T.Mesh(new T.TorusGeometry(0.045, 0.008, 6, 12), GLASS_FRAME);
      rim.position.set(ex, headY + 0.03, headR * 0.9); torso.add(rim);
      torso.add(L.sphere(0.038, 8, GLASS_LENS, { x: ex, y: headY + 0.03, z: headR * 0.88, cast: false }));
    });
    torso.add(L.box(0.06, 0.008, 0.008, GLASS_FRAME, { y: headY + 0.03, z: headR * 0.92, cast: false }));
  }

  // hat or cap (skip if a tall hairstyle would clip)
  const hatRoll = L.rand(0, 1);
  if (hatRoll < 0.13) {
    // brimmed hat
    const hatMat = cloth(L.pick(['#3a2c1c', '#4a3a22', '#2a2a30', '#5a3030']));
    torso.add(L.cyl(0.20, 0.22, 0.01, 14, hatMat, { y: headY + 0.16, cast: false }));
    torso.add(L.cyl(0.135, 0.14, 0.16, 12, hatMat, { y: headY + 0.24, cast: false }));
    // hat band
    torso.add(new T.Mesh(new T.TorusGeometry(0.137, 0.018, 6, 14), cloth(L.pick(ACCENT_PAL))).translateY ? L.cyl(0.142, 0.142, 0.04, 12, cloth(L.pick(ACCENT_PAL)), { y: headY + 0.18, cast: false }) : L.cyl(0.142, 0.142, 0.04, 12, hatMat, { y: headY + 0.18, cast: false }));
  } else if (hatRoll < 0.24) {
    // ball cap with bill
    const capMat = cloth(L.pick(ACCENT_PAL));
    const dome = L.sphere(headR * 1.02, 12, capMat, { y: headY + 0.06, cast: false });
    dome.scale.set(1.04, 0.62, 1.04); torso.add(dome);
    torso.add(L.box(0.18, 0.02, 0.14, capMat, { y: headY + 0.08, z: headR * 1.0, cast: false }));
  } else if (hatRoll < 0.30) {
    // knit beanie
    const beanieMat = cloth(L.pick(ACCENT_PAL));
    const dome = L.sphere(headR * 1.06, 12, beanieMat, { y: headY + 0.07, cast: false });
    dome.scale.set(1.05, 0.7, 1.05); torso.add(dome);
    torso.add(L.cyl(headR * 1.05, headR * 1.05, 0.05, 12, beanieMat, { y: headY + 0.085, cast: false }));
    torso.add(L.sphere(0.04, 6, beanieMat, { y: headY + 0.2, cast: false }));
  }

  // scarf
  if (L.chance(isElder ? 0.3 : 0.16)) {
    const scarfMat = L.std({ color: hx(L.pick(ACCENT_PAL)), roughness: 0.85 });
    const ring = new T.Mesh(new T.TorusGeometry(0.12 * build, 0.045, 6, 14), scarfMat);
    ring.position.set(0, neckY - 0.02, 0); ring.rotation.x = Math.PI / 2; torso.add(ring);
    torso.add(L.box(0.1, 0.26, 0.05, scarfMat, { y: neckY - 0.20, z: 0.12, cast: false }));
  }

  // bag: shoulder bag or backpack
  const bagRoll = L.rand(0, 1);
  if (bagRoll < 0.18) {
    // shoulder/messenger bag (across the chest, hangs at hip)
    const bagMat = L.std({ color: hx(L.pick(BAG_PAL)), roughness: 0.8 });
    torso.add(L.box(0.22, 0.2, 0.1, bagMat, { x: 0.22 * build, y: hipY + 0.06, z: 0.08 }));
    // strap
    const strap = L.box(0.04, 0.5, 0.02, bagMat, { x: 0.02, y: shoulderY - 0.18, z: 0.13, cast: false });
    strap.rotation.z = 0.5; torso.add(strap);
  } else if (bagRoll < 0.34) {
    // backpack
    const packMat = L.std({ color: hx(L.pick(PACK_PAL)), roughness: 0.82 });
    torso.add(L.box(0.3 * build, 0.34, 0.16, packMat, { y: torsoCY + 0.02, z: -0.18 * build }));
    [-1, 1].forEach(s => { const st = L.box(0.04, 0.34, 0.02, packMat, { x: s * 0.12 * build, y: torsoCY + 0.04, z: 0.1, cast: false }); st.rotation.x = 0.05; torso.add(st); });
  }

  // elder: a walking cane in the right hand (parented to forearm so it stays in hand)
  if (isElder && L.chance(0.55)) {
    const caneMat = L.MAT.wood('#6a4a2e');
    const fore = armR.userData.fore;
    const cane = L.cyl(0.018, 0.022, 0.62, 6, caneMat, { y: -armLen * 0.48 - 0.32, z: 0.06, cast: false });
    fore.add(cane);
    fore.add(L.sphere(0.04, 6, caneMat, { y: -armLen * 0.48 - 0.02, z: 0.06, cast: false }));
  }

  // ── finalize: scale whole figure (near-uniform so footprint stays sane) ──
  g.scale.set(scaleH * (0.9 + build * 0.1), scaleH, scaleH * (0.9 + build * 0.1));

  // per-NPC gait personality
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
   animateWalk — cheap, natural gait. Rotates limbs + bobs internal torso only.
   Backward compatible: works even if an NPC lacks shin/forearm/torso refs.
   ════════════════════════════════════════════════════════════════════════ */
function animateWalk(group, t, moving) {
  const lm = group.userData.limbs; if (!lm) return;
  const ga = group.userData.gait;
  const stride = ga ? ga.stride : 0.5;
  const armSwing = ga ? ga.armSwing : 0.7;
  const bobAmt = ga ? ga.bob : 0.03;
  const kneeAmt = ga ? ga.knee : 0.24;
  const elbowAmt = ga ? ga.elbow : 0.16;
  const torso = group.userData.torso;

  if (moving) {
    const s = Math.sin(t);
    const c = Math.cos(t);
    // opposing leg swing (thigh from hip)
    lm.legL.rotation.x = s * stride;
    lm.legR.rotation.x = -s * stride;
    // knee bend: shin tucks under as the leg swings back (cheap, only when refs exist)
    const shL = lm.legL.userData && lm.legL.userData.shin;
    const shR = lm.legR.userData && lm.legR.userData.shin;
    if (shL) shL.rotation.x = Math.max(0, -s) * kneeAmt + kneeAmt * 0.25;
    if (shR) shR.rotation.x = Math.max(0, s) * kneeAmt + kneeAmt * 0.25;
    // opposing arm swing
    lm.armL.rotation.x = -s * stride * armSwing;
    lm.armR.rotation.x = s * stride * armSwing;
    // slight outward arm splay so they don't clip the torso
    lm.armL.rotation.z = 0.06;
    lm.armR.rotation.z = -0.06;
    // elbow bend follows the forward arm swing
    const foL = lm.armL.userData && lm.armL.userData.fore;
    const foR = lm.armR.userData && lm.armR.userData.fore;
    if (foL) foL.rotation.x = -(Math.max(0, -s) * elbowAmt + elbowAmt * 0.4);
    if (foR) foR.rotation.x = -(Math.max(0, s) * elbowAmt + elbowAmt * 0.4);
    // torso: vertical bob twice per stride + a subtle counter-sway and lean
    if (torso && ga) {
      torso.position.y = ga.baseY + Math.abs(c) * bobAmt;
      torso.rotation.y = s * 0.05;
      torso.rotation.z = -s * 0.025;
      torso.rotation.x = ga.baseRX;
    }
  } else {
    // gentle idle: breathing + slow weight-shift, limbs ease toward neutral
    const b = ga ? ga.breath : 1;
    const breath = Math.sin(t * 0.9 * b);
    const shift = Math.sin(t * 0.4);
    lm.legL.rotation.x = shift * 0.03; lm.legR.rotation.x = -shift * 0.03;
    const shL = lm.legL.userData && lm.legL.userData.shin;
    const shR = lm.legR.userData && lm.legR.userData.shin;
    if (shL) shL.rotation.x = 0.02; if (shR) shR.rotation.x = 0.02;
    lm.armL.rotation.x = breath * 0.04; lm.armR.rotation.x = breath * 0.04;
    lm.armL.rotation.z = 0.07 + shift * 0.02; lm.armR.rotation.z = -0.07 - shift * 0.02;
    const foL = lm.armL.userData && lm.armL.userData.fore;
    const foR = lm.armR.userData && lm.armR.userData.fore;
    if (foL) foL.rotation.x = -0.12; if (foR) foR.rotation.x = -0.12;
    if (torso && ga) {
      torso.position.y = ga.baseY + (breath * 0.5 + 0.5) * 0.012;   // chest rise
      torso.rotation.y = shift * 0.06;                              // weight shift
      torso.rotation.z = shift * 0.02;
      torso.rotation.x = ga.baseRX;
    }
  }
}

/* ════════════════════════════════════════════════════════════════════════
   makeFly — the hero courier. Rounded, friendly, readable from ~13u back.
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
  // soft warm belly underside
  const belly = L.sphere(0.42, 16, bellyMat, { y: -0.16, z: 0.04, cast: false });
  belly.scale.set(0.74, 0.6, 1.05); g.add(belly);
  // body segment bands for charm (clearer striping)
  [0.04, -0.16, -0.34].forEach((bz, i) => {
    const band = new T.Mesh(new T.TorusGeometry(0.4 - i * 0.05, 0.032, 8, 18), darkMat);
    band.position.set(0, -0.02, bz); band.rotation.x = Math.PI / 2; band.scale.set(1, 0.66, 1); g.add(band);
  });
  // a little pointed tail tip
  const tail = L.sphere(0.12, 10, bodyDeep, { y: -0.04, z: -0.5, cast: false });
  tail.scale.set(0.9, 0.8, 1.2); g.add(tail);

  // ── thorax + HEAD (forward, +Z) ──
  const thorax = L.sphere(0.31, 16, bodyDeep, { y: 0.1, z: 0.34 });
  thorax.scale.set(1.05, 1.0, 1.0); g.add(thorax);
  // fuzzy thorax collar (charm)
  const ruff = new T.Mesh(new T.TorusGeometry(0.27, 0.06, 8, 18), bodyMat);
  ruff.position.set(0, 0.12, 0.48); ruff.rotation.x = 1.5; ruff.scale.set(1, 1, 0.7); g.add(ruff);
  const head = L.sphere(0.28, 16, bodyMat, { y: 0.2, z: 0.6 });
  head.scale.set(1.05, 1.0, 0.95); g.add(head);
  // cheeks (friendly)
  [-1, 1].forEach(s => g.add(L.sphere(0.06, 8, bellyMat, { x: s * 0.16, y: 0.12, z: 0.7, cast: false })));
  // little smile mouth
  const smile = new T.Mesh(new T.TorusGeometry(0.07, 0.016, 6, 12, Math.PI), darkMat);
  smile.position.set(0, 0.1, 0.78); smile.rotation.z = Math.PI; g.add(smile);

  // ── GOGGLES (expressive emissive lenses + glints) ──
  const goggMat = L.std({ color: 0x4a3320, roughness: 0.45, metalness: 0.2 });
  const lensMat = L.std({ color: 0x9fe8ff, emissive: 0x2a90b0, emissiveIntensity: 0.7, roughness: 0.18, metalness: 0.4 });
  const lensHighlight = L.std({ color: 0xffffff, emissive: 0xeaffff, emissiveIntensity: 0.6, roughness: 0.2 });
  [-0.13, 0.13].forEach(dx => {
    const ring = new T.Mesh(new T.TorusGeometry(0.105, 0.04, 8, 16), goggMat);
    ring.position.set(dx, 0.27, 0.74); g.add(ring);
    const lens = new T.Mesh(new T.CircleGeometry(0.095, 16), lensMat);
    lens.position.set(dx, 0.27, 0.755); g.add(lens);
    // big glint + a small secondary glint
    g.add(L.sphere(0.024, 6, lensHighlight, { x: dx - 0.03, y: 0.315, z: 0.772, cast: false }));
    g.add(L.sphere(0.012, 6, lensHighlight, { x: dx + 0.035, y: 0.245, z: 0.772, cast: false }));
  });
  // goggle bridge + strap around the head
  g.add(L.box(0.06, 0.02, 0.02, goggMat, { y: 0.27, z: 0.755, cast: false }));
  const strap = new T.Mesh(new T.TorusGeometry(0.29, 0.032, 6, 20), goggMat);
  strap.position.set(0, 0.27, 0.5); strap.rotation.y = Math.PI / 2; strap.scale.set(1, 1, 0.9); g.add(strap);

  // ── ANTENNAE (curved up, glowing tips) ──
  const tipMat = L.MAT.emissive('#ffb020', 0.9);
  [-0.1, 0.1].forEach(dx => {
    const ant = L.cyl(0.014, 0.014, 0.26, 6, darkMat, { x: dx, y: 0.5, z: 0.5, cast: false });
    ant.rotation.x = -0.45; g.add(ant);
    g.add(L.sphere(0.045, 8, tipMat, { x: dx, y: 0.62, z: 0.43, cast: false }));
  });

  // ── SCARF (flowing; scarfTail is the trailing mesh game.js rotates on X) ──
  const scarfMat = L.std({ color: 0xd0473e, roughness: 0.78, side: T.DoubleSide });
  const scarfDark = L.std({ color: 0xab362f, roughness: 0.8, side: T.DoubleSide });
  // wrap around the neck/thorax
  const wrap = new T.Mesh(new T.TorusGeometry(0.26, 0.07, 8, 18), scarfMat);
  wrap.position.set(0, 0.06, 0.38); wrap.rotation.x = 1.45; g.add(wrap);
  // a little knot at the front
  g.add(L.sphere(0.07, 8, scarfMat, { y: 0.0, z: 0.5, cast: false }));
  // tail: a flowing strip trailing back & down. Pivot near the neck so X-rotation flutters it.
  const scarfTail = new T.Group();
  scarfTail.position.set(-0.14, 0.02, 0.3);
  {
    const seg1 = L.box(0.16, 0.02, 0.42, scarfMat, { z: -0.21, cast: false });
    const seg2 = L.box(0.14, 0.02, 0.34, scarfDark, { y: -0.06, z: -0.55, cast: false });
    seg2.rotation.x = 0.3;
    const seg3 = L.box(0.12, 0.02, 0.26, scarfMat, { y: -0.16, z: -0.82, cast: false });
    seg3.rotation.x = 0.55;
    scarfTail.add(seg1, seg2, seg3);
    // little fringe
    for (let i = -1; i <= 1; i++) scarfTail.add(L.box(0.025, 0.02, 0.08, scarfDark, { x: i * 0.04, y: -0.22, z: -0.96, cast: false }));
  }
  g.add(scarfTail);

  // ── MAIL SATCHEL (side bag) ──
  const satMat = L.MAT.wood('#8a5a30');
  const flapMat = L.MAT.flat('#6e441f');
  const sat = new T.Group();
  sat.position.set(0.34, -0.08, 0.0);
  sat.add(L.box(0.3, 0.3, 0.2, satMat));
  sat.add(L.box(0.32, 0.14, 0.22, flapMat, { y: 0.1, cast: false }));        // flap
  sat.add(L.box(0.06, 0.06, 0.01, L.MAT.flat('#caa64a'), { y: 0.06, z: 0.115, cast: false })); // buckle
  // a little envelope peeking out of the satchel
  sat.add(L.box(0.16, 0.02, 0.12, L.MAT.flat('#f0e6cc'), { y: 0.16, z: 0.02, cast: false }));
  // strap across body
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
  // main blade shape
  const sh = new T.Shape();
  sh.moveTo(0, 0);
  sh.quadraticCurveTo(0.55, 0.55, 1.05, 0.2);
  sh.quadraticCurveTo(0.9, -0.06, 0.58, -0.22);
  sh.quadraticCurveTo(0.26, -0.22, 0, 0);
  const wg = new T.ShapeGeometry(sh);
  // smaller rear hindwing segment
  const sh2 = new T.Shape();
  sh2.moveTo(0, 0);
  sh2.quadraticCurveTo(0.34, 0.2, 0.6, 0.02);
  sh2.quadraticCurveTo(0.46, -0.18, 0.18, -0.2);
  sh2.quadraticCurveTo(0.06, -0.12, 0, 0);
  const wg2 = new T.ShapeGeometry(sh2);

  function buildWing(sign) {
    const wing = new T.Group();
    const blade = new T.Mesh(wg, wingMat);
    wing.add(blade);
    // rear hindwing segment, slightly below & behind
    const hind = new T.Mesh(wg2, wingMat2);
    hind.position.set(0.05, -0.16, -0.04);
    wing.add(hind);
    // vein lines (thin boxes laid along the blade)
    const v1 = L.box(0.92, 0.012, 0.012, veinMat, { x: 0.47, y: 0.18, cast: false });
    v1.rotation.z = -0.34;
    const v2 = L.box(0.74, 0.01, 0.01, veinMat, { x: 0.42, y: 0.04, cast: false });
    v2.rotation.z = -0.06;
    const v3 = L.box(0.5, 0.009, 0.009, veinMat, { x: 0.3, y: -0.1, cast: false });
    v3.rotation.z = 0.18;
    // a couple of cross-veins
    const c1 = L.box(0.012, 0.22, 0.009, veinMat, { x: 0.5, y: 0.06, cast: false });
    const c2 = L.box(0.012, 0.18, 0.009, veinMat, { x: 0.78, y: 0.08, cast: false });
    wing.add(v1, v2, v3, c1, c2);
    wing.scale.x = sign;             // mirror right wing
    return wing;
  }
  const wingL = buildWing(1);  wingL.position.set(-0.18, 0.32, -0.02); g.add(wingL);
  const wingR = buildWing(-1); wingR.position.set(0.18, 0.32, -0.02); g.add(wingR);

  g.userData = { wingL, wingR, scarfTail };
  return g;
}

/* ════════════════════════════════════════════════════════════════════════
   BONUS — tiny ambient creatures (base y=0, facing +Z).
   ════════════════════════════════════════════════════════════════════════ */
function makePigeon() {
  const g = new T.Group();
  const bodyMat = L.std({ color: 0x8a909c, roughness: 0.8 });
  const headMat = L.std({ color: 0x6f7682, roughness: 0.8 });
  const beakMat = L.MAT.flat('#d8a040');
  const footMat = L.MAT.flat('#c86848');
  const body = L.sphere(0.13, 12, bodyMat, { y: 0.13, z: -0.02 });
  body.scale.set(1, 0.95, 1.3); g.add(body);
  g.add(L.sphere(0.085, 10, headMat, { y: 0.24, z: 0.12 }));
  const beak = L.cyl(0.005, 0.03, 0.07, 5, beakMat, { y: 0.23, z: 0.2, cast: false }); beak.rotation.x = Math.PI / 2; g.add(beak);
  [-0.03, 0.03].forEach(ex => g.add(L.sphere(0.015, 6, EYE, { x: ex, y: 0.26, z: 0.18, cast: false })));
  // folded wings
  [-1, 1].forEach(s => { const w = L.box(0.04, 0.08, 0.18, headMat, { x: s * 0.1, y: 0.13, z: -0.04, cast: false }); g.add(w); });
  // tail
  g.add(L.box(0.1, 0.02, 0.14, bodyMat, { y: 0.1, z: -0.18, cast: false }));
  // feet
  [-1, 1].forEach(s => g.add(L.cyl(0.006, 0.006, 0.06, 4, footMat, { x: s * 0.04, y: 0.03, z: 0.02, cast: false })));
  return g;
}

function makeDog() {
  const g = new T.Group();
  const furHex = L.pick(['#8a6038', '#6a4a2e', '#c8b48a', '#3a3030', '#a07848']);
  const furMat = L.std({ color: hx(furHex), roughness: 0.85 });
  const dkMat = L.std({ color: hx(furHex), roughness: 0.85 });
  const noseMat = L.MAT.flat('#1a1410');
  // body
  const body = L.cyl(0.13, 0.13, 0.5, 10, furMat, { y: 0.32, z: -0.02 });
  body.rotation.z = Math.PI / 2; body.rotation.x = Math.PI / 2; g.add(body);
  g.add(L.sphere(0.15, 12, furMat, { y: 0.34, z: -0.05 }));
  // head
  g.add(L.sphere(0.12, 12, furMat, { y: 0.38, z: 0.26 }));
  g.add(L.box(0.1, 0.08, 0.12, furMat, { y: 0.33, z: 0.36, cast: false }));     // snout
  g.add(L.sphere(0.03, 6, noseMat, { y: 0.35, z: 0.43, cast: false }));
  [-0.05, 0.05].forEach(ex => g.add(L.sphere(0.022, 6, EYE, { x: ex, y: 0.42, z: 0.34, cast: false })));
  // ears
  [-1, 1].forEach(s => { const ear = L.box(0.05, 0.1, 0.02, dkMat, { x: s * 0.08, y: 0.47, z: 0.22, cast: false }); ear.rotation.z = s * 0.3; g.add(ear); });
  // legs
  [[-0.1, 0.18], [0.1, 0.18], [-0.1, -0.2], [0.1, -0.2]].forEach(([x, z]) => g.add(L.cyl(0.03, 0.025, 0.3, 6, furMat, { x, y: 0.15, z, cast: false })));
  // tail
  const tail = L.cyl(0.03, 0.012, 0.22, 6, furMat, { y: 0.42, z: -0.24, cast: false });
  tail.rotation.x = -0.7; g.add(tail);
  return g;
}

/* a small lounging cat — base y=0, facing +Z */
function makeCat() {
  const g = new T.Group();
  const furHex = L.pick(['#3a3330', '#c8a060', '#9a9690', '#5a4838', '#e0dcd4', '#7a6a58']);
  const furMat = L.std({ color: hx(furHex), roughness: 0.8 });
  const noseMat = L.MAT.flat('#d08070');
  // body (an arched loaf)
  const body = L.sphere(0.16, 12, furMat, { y: 0.16, z: -0.04 });
  body.scale.set(1.0, 0.85, 1.5); g.add(body);
  // chest/front
  g.add(L.sphere(0.12, 10, furMat, { y: 0.16, z: 0.12 }));
  // head
  g.add(L.sphere(0.11, 12, furMat, { y: 0.26, z: 0.22 }));
  // muzzle
  g.add(L.sphere(0.05, 8, furMat, { y: 0.21, z: 0.3, cast: false }));
  g.add(L.sphere(0.02, 6, noseMat, { y: 0.22, z: 0.34, cast: false }));
  // ears (triangular cones)
  [-1, 1].forEach(s => { const ear = L.cyl(0.001, 0.05, 0.09, 4, furMat, { x: s * 0.07, y: 0.35, z: 0.2, cast: false }); g.add(ear); });
  // eyes
  [-0.045, 0.045].forEach(ex => g.add(L.sphere(0.018, 6, L.std({ color: 0x7ac86a, roughness: 0.4 }), { x: ex, y: 0.28, z: 0.3, cast: false })));
  // whiskers (thin boxes)
  [-1, 1].forEach(s => { for (let i = 0; i < 2; i++) { const w = L.box(0.12, 0.004, 0.004, L.std({ color: 0xf4efe6, roughness: 0.6 }), { x: s * 0.1, y: 0.21 + i * 0.02, z: 0.3, cast: false }); w.rotation.y = s * 0.3; g.add(w); } });
  // front paws tucked
  [-1, 1].forEach(s => g.add(L.sphere(0.045, 8, furMat, { x: s * 0.07, y: 0.05, z: 0.18, cast: false })));
  // curled tail
  const tail = new T.Group();
  tail.position.set(0.0, 0.14, -0.22);
  const t1 = L.cyl(0.03, 0.022, 0.2, 6, furMat, { z: -0.08, cast: false }); t1.rotation.x = -0.6;
  const t2 = L.sphere(0.05, 8, furMat, { y: 0.06, z: -0.18, cast: false });
  tail.add(t1, t2); g.add(tail);
  g.scale.setScalar(1.0);
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

  // a low crate stool
  const crateMat = L.MAT.wood('#7a5a34');
  g.add(L.box(0.42, 0.42, 0.42, crateMat, { y: 0.21 }));

  // seated torso (sits atop the crate)
  const seatY = 0.42;
  g.add(L.box(0.34, 0.42, 0.24, shirtMat, { y: seatY + 0.26 }));            // chest
  g.add(L.cyl(0.055, 0.06, 0.1, 8, skMat, { y: seatY + 0.5, cast: false })); // neck
  // head
  const headY = seatY + 0.62;
  const head = L.sphere(0.17, 14, skMat, { y: headY }); head.scale.set(0.96, 1.04, 0.98); g.add(head);
  [-0.06, 0.06].forEach(ex => { g.add(L.sphere(0.032, 8, WHITE, { x: ex, y: headY + 0.02, z: 0.15, cast: false })); g.add(L.sphere(0.017, 6, EYE, { x: ex, y: headY + 0.02, z: 0.16, cast: false })); });
  g.add(L.box(0.05, 0.012, 0.01, MOUTH, { y: headY - 0.07, z: 0.16, cast: false }));
  // brimmed hat
  g.add(L.cyl(0.2, 0.22, 0.01, 14, hatMat, { y: headY + 0.14, cast: false }));
  g.add(L.cyl(0.13, 0.135, 0.15, 12, hatMat, { y: headY + 0.21, cast: false }));
  // hair peeking
  const cap = L.sphere(0.18, 12, hrMat, { y: headY + 0.04, cast: false }); cap.scale.set(1.02, 0.7, 1.02); g.add(cap);

  // thighs forward (seated), shins down
  [-1, 1].forEach(s => {
    const thigh = L.cyl(0.085, 0.075, 0.34, 8, pantsMat, { x: s * 0.1, y: seatY + 0.02, z: 0.17 }); thigh.rotation.x = Math.PI / 2; g.add(thigh);
    g.add(L.cyl(0.07, 0.06, 0.34, 8, pantsMat, { x: s * 0.1, y: seatY - 0.16, z: 0.32 }));
    g.add(L.box(0.12, 0.08, 0.2, L.std({ color: 0x1a1410, roughness: 0.8 }), { x: s * 0.1, y: seatY - 0.32, z: 0.4, cast: false }));
  });

  // guitar across the lap (angled)
  const guitar = new T.Group();
  guitar.position.set(-0.1, seatY + 0.18, 0.26);
  guitar.rotation.z = 0.5; guitar.rotation.y = -0.3;
  const woodMat = L.MAT.wood('#9a5a28');
  const bodyG = L.sphere(0.16, 12, woodMat, { cast: false }); bodyG.scale.set(1.0, 1.1, 0.32); guitar.add(bodyG);
  guitar.add(L.sphere(0.05, 8, L.MAT.flat('#1a1008'), { z: 0.04, cast: false }));   // sound hole
  guitar.add(L.box(0.07, 0.6, 0.05, woodMat, { y: 0.34, cast: false }));            // neck
  guitar.add(L.box(0.09, 0.12, 0.06, L.MAT.flat('#2a1c10'), { y: 0.66, cast: false })); // headstock
  g.add(guitar);

  // arms loosely toward the guitar (simple, static)
  const armMat = shirtMat;
  const armR = L.cyl(0.06, 0.05, 0.4, 8, armMat, { x: 0.16, y: seatY + 0.28, z: 0.18 }); armR.rotation.x = 0.8; armR.rotation.z = 0.3; g.add(armR);
  const armL = L.cyl(0.06, 0.05, 0.4, 8, armMat, { x: -0.18, y: seatY + 0.3, z: 0.16 }); armL.rotation.x = 0.5; armL.rotation.z = -0.5; g.add(armL);
  [[0.16, seatY + 0.05, 0.34], [-0.32, seatY + 0.4, 0.18]].forEach(([x, y, z]) => g.add(L.sphere(0.055, 8, skMat, { x, y, z, cast: false })));

  return g;
}

FLY.characters = { makeNPC, animateWalk, makeFly, makePigeon, makeDog, makeCat, makeStreetMusician };
})();
