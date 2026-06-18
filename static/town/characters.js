/* ════════════════════════════════════════════════════════════════════════
   THE FLY — town/characters.js   (BASELINE — agents enrich this)
   FLY.characters.makeNPC(opts) -> THREE.Group  (base y=0, facing +Z)
       group.userData.limbs = { legL, legR, armL, armR }  for walk animation
   FLY.characters.animateWalk(group, t, moving)  -> poses limbs
   FLY.characters.makeFly() -> THREE.Group (the courier)
       group.userData = { wingL, wingR, scarfTail }   for game.js to animate
   ════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
const L = FLY.lib, T = L.T, TAU = L.TAU;
const hx = s => parseInt(s.replace('#', '0x'));

function makeNPC(opts) {
  opts = opts || {};
  const g = new T.Group();
  const shirt = opts.shirt || L.pick(L.PAL.cloth);
  const pants = opts.pants || L.pick(['#394050', '#5a4830', '#3a4868', '#282828', '#484840', '#3a3838']);
  const skin = opts.skin || L.pick(L.PAL.skin);
  const hair = opts.hair || L.pick(L.PAL.hair);
  const shirtMat = L.std({ color: hx(shirt), roughness: 0.85 });
  const pantsMat = L.std({ color: hx(pants), roughness: 0.9 });

  // legs (pivot at hip ~0.55)
  const legL = new T.Group(), legR = new T.Group();
  legL.position.set(-0.12, 0.55, 0); legR.position.set(0.12, 0.55, 0);
  [legL, legR].forEach(lg => {
    const limb = L.box(0.19, 0.52, 0.2, pantsMat, { y: -0.26 }); lg.add(limb);
    lg.add(L.box(0.2, 0.1, 0.28, L.std({ color: 0x1a1410, roughness: 0.9 }), { y: -0.5, z: 0.05, cast: false }));
  });
  g.add(legL, legR);

  // torso + head
  g.add(L.box(0.42, 0.55, 0.28, shirtMat, { y: 0.83 }));
  g.add(L.box(0.34, 0.36, 0.32, L.std({ color: hx(skin), roughness: 0.7 }), { y: 1.32 }));
  g.add(L.box(0.37, 0.2, 0.35, L.std({ color: hx(hair), roughness: 0.9 }), { y: 1.46, cast: false }));
  // eyes
  [-0.1, 0.1].forEach(ex => g.add(L.sphere(0.04, 6, L.std({ color: 0x101010, roughness: 0.5 }), { x: ex, y: 1.33, z: 0.17, cast: false })));

  // arms (pivot at shoulder ~1.05)
  const armL = new T.Group(), armR = new T.Group();
  armL.position.set(-0.27, 1.05, 0); armR.position.set(0.27, 1.05, 0);
  [armL, armR].forEach(ar => ar.add(L.box(0.14, 0.46, 0.16, shirtMat, { y: -0.23 })));
  g.add(armL, armR);

  g.userData.limbs = { legL, legR, armL, armR };
  return g;
}

function animateWalk(group, t, moving) {
  const lm = group.userData.limbs; if (!lm) return;
  const sp = moving ? Math.sin(t) * 0.5 : Math.sin(t * 0.4) * 0.04;
  lm.legL.rotation.x = sp; lm.legR.rotation.x = -sp;
  lm.armL.rotation.x = -sp * 0.7; lm.armR.rotation.x = sp * 0.7;
}

function makeFly() {
  const g = new T.Group();
  const bodyMat = L.std({ color: 0x2b2f38, roughness: 0.55, metalness: 0.15 });
  const body = L.sphere(0.42, 18, bodyMat, { y: 0 }); body.scale.set(1, 0.86, 1.35); g.add(body);
  const belly = L.sphere(0.43, 16, L.std({ color: 0xe0b558, roughness: 0.6 }), { y: -0.16, z: 0.1, cast: false }); belly.scale.set(0.7, 0.55, 1.0); g.add(belly);
  g.add(L.sphere(0.3, 16, bodyMat, { y: 0.18, z: 0.5 }));
  // goggles
  const goggMat = L.std({ color: 0x4a3320, roughness: 0.5 });
  const lensMat = L.std({ color: 0x9fe8ff, emissive: 0x2a90b0, emissiveIntensity: 0.5, roughness: 0.2, metalness: 0.4 });
  [-0.13, 0.13].forEach(dx => {
    const ring = new T.Mesh(new T.TorusGeometry(0.1, 0.035, 8, 14), goggMat); ring.position.set(dx, 0.22, 0.72); g.add(ring);
    const lens = new T.Mesh(new T.CircleGeometry(0.09, 14), lensMat); lens.position.set(dx, 0.22, 0.735); g.add(lens);
  });
  const strap = new T.Mesh(new T.TorusGeometry(0.28, 0.03, 6, 18), goggMat); strap.position.set(0, 0.22, 0.5); strap.rotation.y = Math.PI / 2; g.add(strap);
  // antennae
  [-0.1, 0.1].forEach(dx => {
    const ant = L.cyl(0.012, 0.012, 0.22, 5, bodyMat, { x: dx, y: 0.42, z: 0.55, cast: false }); ant.rotation.x = -0.4; g.add(ant);
    g.add(L.sphere(0.04, 8, L.MAT.emissive('#ffb020', 0.8), { x: dx, y: 0.53, z: 0.49, cast: false }));
  });
  // scarf
  const scarfMat = L.std({ color: 0xd0473e, roughness: 0.8, side: T.DoubleSide });
  const scarf = new T.Mesh(new T.TorusGeometry(0.24, 0.07, 6, 16), scarfMat); scarf.position.set(0, 0.02, 0.34); scarf.rotation.x = 1.4; g.add(scarf);
  const tail = new T.Mesh(new T.PlaneGeometry(0.18, 0.6), scarfMat); tail.position.set(-0.18, -0.05, 0.15); tail.rotation.set(0.3, 0.4, 0.3); g.add(tail);
  // satchel
  g.add(L.box(0.34, 0.3, 0.18, L.MAT.wood('#8a5a30'), { x: 0.32, y: -0.1, z: -0.05 }));
  g.add(L.box(0.36, 0.16, 0.2, L.MAT.flat('#6e441f'), { x: 0.32, y: 0.04, z: -0.05, cast: false }));
  // wings
  const wingMat = L.std({ color: 0xeaf4ff, transparent: true, opacity: 0.5, roughness: 0.2, metalness: 0.1, side: T.DoubleSide, emissive: 0x88b0d0, emissiveIntensity: 0.15 });
  const sh = new T.Shape(); sh.moveTo(0, 0); sh.quadraticCurveTo(0.5, 0.5, 1.0, 0.18); sh.quadraticCurveTo(0.85, -0.05, 0.55, -0.2); sh.quadraticCurveTo(0.25, -0.2, 0, 0);
  const wg = new T.ShapeGeometry(sh);
  const wingL = new T.Mesh(wg, wingMat); wingL.position.set(-0.18, 0.25, -0.05); g.add(wingL);
  const wingR = new T.Mesh(wg, wingMat); wingR.position.set(0.18, 0.25, -0.05); wingR.scale.x = -1; g.add(wingR);
  g.userData = { wingL, wingR, scarfTail: tail };
  return g;
}

FLY.characters = { makeNPC, animateWalk, makeFly };
})();
