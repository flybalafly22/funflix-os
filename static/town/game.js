/* ════════════════════════════════════════════════════════════════════════
   THE FLY — town/game.js
   The playable layer: the Fly courier, flight controls, chase camera, the
   delivery loop (pick up → fly to glowing shop → deliver → score), HUD wiring,
   synth audio + particle FX.
   Now a real game: start card, camera-relative movement, solid-world collision,
   per-job timer, speed/combo scoring, express jobs, traffic to respect,
   a real street-grid minimap, and persisted bests.
   FLY.game.start(ctx, world) -> { update(dt, now) }
   ════════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';

function start(ctx, world) {
  const { scene, camera, lib } = ctx;
  const L = lib, T = L.T, TAU = L.TAU;
  ctx.player = ctx.player || { pos: new T.Vector3() };
  const player = ctx.player;
  const C = FLY.characters;
  const clamp = L.clamp, lerp = L.lerp, pick = L.pick, rand = L.rand;
  // lost-letter persistence lives at the VERY top: renderLog is called during
  // init long before the game-state section, and `let` doesn't hoist
  function lsGet0(k) { try { return parseInt(localStorage.getItem(k) || '0', 10) || 0; } catch (e) { return 0; } }
  let lostMask = lsGet0('fly_lost_mask');
  function lostCount() { let n = 0; for (let i = 0; i < 10; i++) if (lostMask & (1 << i)) n++; return n; }

  /* ── player (walking human courier) ── */
  const hero = (C.makeHero ? C.makeHero() : C.makeFly()); scene.add(hero);

  /* ── PACO, the rival courier — a second hero on a bike who races you.
     He moves toward the dropoff along a simple steer-and-avoid, on his own
     bike, and trades quips. Beat him for coins; lose and he gloats. ── */
  const rival = (C.makeHero ? C.makeHero() : C.makeFly());
  // repaint the rival so he's unmistakable: green pack, blue cap
  rival.traverse(o => {
    if (o.material && o.material.color) {
      const h = o.material.color.getHex();
      if (h === 0xa52d24 || h === 0x8f231b || h === 0x872017) o.material = o.material.clone(), o.material.color.setHex(0x2f6b4a);
    }
  });
  const rivalBike = FLY.props.makeBicycle(); rival.add(rivalBike); rivalBike.position.set(0, 0, 0.06);
  rival.visible = false; scene.add(rival);
  const R = { pos: new T.Vector3(), yaw: 0, active: false, target: null, progress: 0, done: false, phase: 0 };
  const RIVAL_QUIPS = ['¡El último paga las cañas!', '¡Muy lento, novato!', '¡Te huelo el polvo!', '¡A que llego yo antes!'];
  function startRace(target) {
    R.active = true; R.done = false; R.target = target;
    // he starts a bit behind the player, on the street
    R.pos.set(P.pos.x - Math.cos(P.yaw) * 4, groundAt(P.pos.x, P.pos.z), P.pos.z + Math.sin(P.yaw) * 4);
    rival.visible = true;
    toast('🏁 ¡Paco te reta a una carrera!', '#c04434');
    bubble(R.pos.x, R.pos.y + 2.2, R.pos.z, pick(RIVAL_QUIPS), 3);
    blip(660, 0.1, 'square', 0.08); setTimeout(() => blip(880, 0.14, 'square', 0.08), 160);
  }
  function endRace(playerWon) {
    R.active = false;
    if (playerWon) {
      const prize = 60;
      coins += prize; lsSet('fly_coins', coins); renderBest();
      toast('🏁 ¡Ganaste a Paco! +' + prize + ' 🪙', '#4d8a52'); sfxBonus();
    } else {
      toast('🏁 Paco llegó primero…', '#c04434');
      bubble(R.pos.x, R.pos.y + 2.2, R.pos.z, '¡Te lo dije!', 2.5);
    }
    setTimeout(() => { rival.visible = false; }, 2500);
  }
  const _rv = new T.Vector3();
  function updateRival(dt, now) {
    if (!R.active || !R.target) return;
    const tx = R.target.pos.x, tz = R.target.pos.z;
    _rv.set(tx - R.pos.x, 0, tz - R.pos.z);
    const dist = _rv.length();
    if (dist < 4) { if (!R.done) { R.done = true; endRace(false); } return; }
    _rv.normalize();
    // desired yaw toward target, eased
    let wy = Math.atan2(_rv.x, _rv.z);
    let dy = wy - R.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    R.yaw += dy * L.dampT(dt, 3.2);
    // rival speed scales so he's a real but beatable threat
    const rsp = 7.6;
    R.pos.x += Math.sin(R.yaw) * rsp * dt;
    R.pos.z += Math.cos(R.yaw) * rsp * dt;
    R.pos.y = lerp(R.pos.y, groundAt(R.pos.x, R.pos.z), L.dampT(dt, 10));
    rival.position.set(R.pos.x, R.pos.y + 0.24, R.pos.z);
    rival.rotation.set(0, R.yaw, 0);
    R.phase += dt;
    if (R.phase > 4) { R.phase = 0; bubble(R.pos.x, R.pos.y + 2.2, R.pos.z, pick(RIVAL_QUIPS), 2.2); }
  }

  /* ── LA BICI — the courier's bike, parked where you leave it ── */
  let onBike = false;
  const bike = FLY.props.makeBicycle();
  bike.position.set(2.2, 0, -7); bike.rotation.y = 0.4;
  scene.add(bike);
  function mountBike() {
    onBike = true;
    scene.remove(bike); hero.add(bike);
    bike.position.set(0, 0, 0.06); bike.rotation.set(0, 0, 0);
    toast('🚲 ¡A pedalear!', '#3a7d99');
    blip(1560, 0.09, 'square', 0.07); setTimeout(() => blip(1560, 0.12, 'square', 0.07), 130);
  }
  function dismountBike() {
    onBike = false;
    hero.remove(bike); scene.add(bike);
    bike.position.set(P.pos.x + Math.cos(P.yaw) * 0.7, P.pos.y, P.pos.z - Math.sin(P.yaw) * 0.7);
    bike.rotation.set(0, P.yaw, 0.16);
    toast('🚲 aparcada', '#3a7d99');
  }
  // FX / HUD markers live on layer 1 so the ink-outline normal pass skips them
  const toFx = obj => obj.traverse(c => c.layers.set(1));
  const blob = new T.Mesh(new T.CircleGeometry(0.8, 20), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.26, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; scene.add(blob); toFx(blob);

  // carried parcel — hand-built items; the job picks which one shows
  const letterMat = L.std({ color: 0xf4ecd6, roughness: 0.7 });
  function makeCarry(type) {
    const g2 = new T.Group();
    if (type === 'cake') {
      g2.add(L.box(0.34, 0.26, 0.34, L.std({ color: 0xf2ece0, roughness: 0.7 }), { cast: false }));
      g2.add(L.box(0.36, 0.05, 0.08, L.std({ color: 0xc85a7a, roughness: 0.6 }), { y: 0.02, cast: false }));
      g2.add(L.box(0.08, 0.05, 0.36, L.std({ color: 0xc85a7a, roughness: 0.6 }), { y: 0.02, cast: false }));
      g2.add(L.sphere(0.05, 6, L.std({ color: 0xc85a7a, roughness: 0.6 }), { y: 0.16, cast: false }));
    } else if (type === 'bouquet') {
      g2.add(L.cyl(0.05, 0.09, 0.28, 7, L.std({ color: 0xe8ddc0, roughness: 0.8 }), { cast: false }));
      const bloom = ['#c85a5a', '#d8a63c', '#c86a9a', '#e0d050'];
      for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; g2.add(L.sphere(0.06, 6, L.std({ color: parseInt(bloom[k % 4].replace('#','0x')), roughness: 0.7 }), { x: Math.cos(a) * 0.09, y: 0.2, z: Math.sin(a) * 0.09, cast: false })); }
      g2.add(L.sphere(0.06, 6, L.std({ color: 0xe8d84a, roughness: 0.7 }), { y: 0.24, cast: false }));
    } else if (type === 'parcel') {
      g2.add(L.box(0.32, 0.26, 0.28, L.std({ color: 0xb08a5a, roughness: 0.85 }), { cast: false }));
      g2.add(L.box(0.34, 0.03, 0.06, L.std({ color: 0x6a5236, roughness: 0.8 }), { y: 0.01, cast: false }));
      g2.add(L.box(0.06, 0.03, 0.3, L.std({ color: 0x6a5236, roughness: 0.8 }), { y: 0.01, cast: false }));
      g2.add(L.box(0.12, 0.09, 0.01, letterMat, { x: 0.06, y: 0.06, z: 0.145, cast: false }));
    } else if (type === 'postcard') {
      const pc = L.box(0.42, 0.28, 0.02, letterMat, { cast: false });
      pc.add(L.box(0.34, 0.14, 0.005, L.std({ color: 0x7cc8ba, roughness: 0.7 }), { y: 0.05, z: 0.012, cast: false }));
      pc.add(L.box(0.34, 0.08, 0.005, L.std({ color: 0xd8c48a, roughness: 0.7 }), { y: -0.06, z: 0.012, cast: false }));
      g2.add(pc);
    } else {
      const env = L.box(0.4, 0.28, 0.05, letterMat, { cast: false });
      env.add(L.box(0.1, 0.1, 0.01, L.std({ color: 0xc0463e, roughness: 0.7 }), { x: 0.12, y: 0.07, z: 0.03, cast: false }));
      g2.add(env);
    }
    return g2;
  }
  function carryType() {
    if (fragile) return 'cake';
    const pl = (payload || '').toLowerCase();
    if (pl.includes('flor')) return 'bouquet';
    if (pl.includes('postal')) return 'postcard';
    if (pl.includes('caja') || pl.includes('llav') || pl.includes('libro') || pl.includes('recambio') || pl.includes('lata')) return 'parcel';
    return 'envelope';
  }
  const carries = {};
  ['envelope', 'cake', 'bouquet', 'parcel', 'postcard'].forEach(t => {
    const m = makeCarry(t); m.visible = false; m.position.set(0.34, 1.05, 0.3); hero.add(m); toFx(m); carries[t] = m;
  });
  let carriedLetter = carries.envelope;
  function setCarryItem() {
    for (const t in carries) carries[t].visible = false;
    carriedLetter = carries[carryType()];
    setObjMarker();
  }

  /* ── objective markers ── */
  const beam = new T.Mesh(new T.CylinderGeometry(1.1, 1.5, 30, 16, 1, true), new T.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0.26, depthWrite: false, side: T.DoubleSide }));
  scene.add(beam); toFx(beam); L.curve(beam.material);
  const ring = new T.Mesh(new T.TorusGeometry(1.6, 0.13, 8, 28), new T.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0.85, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; scene.add(ring); toFx(ring); L.curve(ring.material);
  const objLetter = new T.Group();
  const objEnv = new T.Group();
  { const env = L.box(0.9, 0.62, 0.1, letterMat);
    env.add(L.box(0.9, 0.34, 0.01, L.std({ color: 0xdcd0b0, roughness: 0.7 }), { y: 0.05, z: 0.052, cast: false }));
    env.add(L.box(0.22, 0.22, 0.01, L.std({ color: 0xc0463e, roughness: 0.7, emissive: 0x802820, emissiveIntensity: 0.2 }), { x: 0.26, y: 0.13, z: 0.053, cast: false }));
    objEnv.add(env); }
  objLetter.add(objEnv);
  scene.add(objLetter); toFx(objLetter);
  // scaled-up parcel markers (built after makeCarry is defined, below)
  let objMarkers = null;
  function buildObjMarkers() {
    objMarkers = {};
    ['cake', 'bouquet', 'parcel', 'postcard'].forEach(t => {
      const m = makeCarry(t); m.scale.setScalar(2.2); m.visible = false; objLetter.add(m); toFx(m); objMarkers[t] = m;
    });
  }
  function setObjMarker() {
    if (!objMarkers) return;
    const t = carryType();
    objEnv.visible = (t === 'envelope' || t === 'postcard' ? t === 'envelope' : false) || t === 'envelope';
    for (const k in objMarkers) objMarkers[k].visible = false;
    if (t !== 'envelope' && objMarkers[t]) { objMarkers[t].visible = true; objEnv.visible = false; }
    else objEnv.visible = true;
  }
  buildObjMarkers();

  /* ── HUD refs (existing ids) ── */
  const $ = s => document.querySelector(s);
  const elLbl = $('#task .lbl'), elDst = $('#task .dst'), elSub = $('#task .sub');
  const elScore = $('#score .n'), elScoreL = $('#score .l'), elNeedle = $('#needle'), elDist = $('#dist'), elToast = $('#toast');
  const hud = $('#hud') || document.body;
  let toastT = 0;
  function toast(txt, col) { elToast.textContent = txt; elToast.style.color = col || '#2c261c'; elToast.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => elToast.classList.remove('show'), 1100); }

  /* ── injected CSS + new HUD elements (town.html stays untouched) ── */
  const css = document.createElement('style');
  css.textContent = `
    .fpaper { background:rgba(250,247,238,.95); color:#2c261c; border:2px solid #2c261c;
      box-shadow:0 3px 0 rgba(44,38,28,.22); }
    #hud.photo > :not(#toast) { visibility:hidden; }
    #flyTimerWrap { position:absolute; left:16px; top:96px; width:220px;
      background:rgba(250,247,238,.95); color:#2c261c; border:2px solid #2c261c;
      box-shadow:0 3px 0 rgba(44,38,28,.22); border-radius:11px 13px 12px 11px;
      padding:6px 12px; transform:rotate(-.3deg); }
    #flyTimerWrap .row { display:flex; justify-content:space-between; align-items:baseline; }
    #flyTimerWrap .lbl { font-size:12px; letter-spacing:.1em; text-transform:uppercase; color:#3a7d99; }
    #flyTimerWrap .t { font-size:17px; font-variant-numeric:tabular-nums; }
    #flyTimerBar { margin-top:4px; height:6px; border-radius:4px; background:rgba(44,38,28,.14); overflow:hidden; }
    #flyTimerBar i { display:block; height:100%; width:100%; border-radius:4px;
      background:#4d8a52; transition:width .12s linear, background .3s; }
    #flyCombo { position:absolute; right:16px; top:82px; text-align:right;
      background:rgba(250,247,238,.95); color:#2c261c; border:2px solid #2c261c;
      box-shadow:0 3px 0 rgba(44,38,28,.22); border-radius:12px 11px 13px 11px; padding:6px 14px;
      opacity:0; transition:opacity .25s, transform .25s; transform:translateY(-6px) rotate(.5deg); }
    #flyCombo.on { opacity:1; transform:translateY(0) rotate(.5deg); }
    #flyCombo .m { font-size:22px; line-height:1; color:#c8862a; }
    #flyCombo .l { font-size:11px; letter-spacing:.1em; text-transform:uppercase; opacity:.65; margin-top:1px; }
    #flyComboBar { margin-top:4px; height:4px; border-radius:3px; background:rgba(44,38,28,.14); overflow:hidden; }
    #flyComboBar i { display:block; height:100%; width:100%; background:#c8862a; }
    #flyBest { position:absolute; right:16px; top:156px; text-align:right; font-size:12px;
      line-height:1.45; background:rgba(250,247,238,.9); color:#2c261c;
      border:2px solid #2c261c; box-shadow:0 3px 0 rgba(44,38,28,.22);
      padding:5px 12px; border-radius:10px 12px 10px 11px; transform:rotate(.3deg); }
    #flyBest b { color:#4d8a52; }
    #flyMap { position:absolute; right:16px; bottom:16px; width:150px; height:150px;
      border-radius:12px 14px 12px 13px; background:#f2ecdc; border:2px solid #2c261c;
      box-shadow:0 3px 0 rgba(44,38,28,.22); }
    #flyLogBtn { position:absolute; right:16px; top:224px; width:40px; height:40px;
      display:grid; place-items:center; font-size:20px; cursor:pointer; pointer-events:auto;
      background:rgba(250,247,238,.95); color:#2c261c; border:2px solid #2c261c;
      box-shadow:0 3px 0 rgba(44,38,28,.22); border-radius:11px 13px 11px 12px; }
    #flyLog { position:absolute; right:64px; top:224px; min-width:240px; display:none;
      background:rgba(250,247,238,.97); color:#2c261c; border:2px solid #2c261c;
      box-shadow:0 3px 0 rgba(44,38,28,.22); border-radius:13px 11px 14px 12px;
      padding:10px 14px; transform:rotate(-.4deg); pointer-events:auto; }
    #flyLog.open { display:block; }
    #flyLog .h { font-size:15px; letter-spacing:.08em; text-transform:uppercase; border-bottom:2px solid rgba(44,38,28,.25); padding-bottom:4px; margin-bottom:6px; }
    #flyLog .q { font-size:14px; line-height:1.7; }
    #flyLog .q.done { text-decoration:line-through; opacity:.55; }
    #flyLog .q .n { opacity:.6; }
    #flyShop { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%) rotate(.4deg);
      min-width:300px; background:rgba(250,247,238,.98); color:#2c261c;
      border:2.5px solid #2c261c; border-radius:15px 17px 14px 16px;
      box-shadow:0 6px 0 rgba(44,38,28,.28); padding:16px 22px 14px; display:none;
      pointer-events:auto; z-index:22; }
    #flyShop.on { display:block; }
    #flyShop .h { font-size:20px; letter-spacing:.1em; text-align:center; border-bottom:2px solid rgba(44,38,28,.25); padding-bottom:5px; }
    #flyShop .coins { text-align:center; font-size:14px; color:#c8862a; margin-top:3px; }
    #flyShop .it { display:flex; justify-content:space-between; gap:14px; font-size:16px;
      line-height:2.0; cursor:pointer; padding:0 6px; border-radius:8px; }
    #flyShop .it:hover { background:rgba(44,38,28,.08); }
    #flyShop .it .sw { display:inline-block; width:14px; height:14px; border-radius:4px;
      border:1.5px solid #2c261c; margin-right:8px; vertical-align:-2px; }
    #flyShop .it .pr { color:#c8862a; }
    #flyShop .it.owned .pr { color:#4d8a52; }
    #flyShop .it.worn .pr::after { content:' ✓'; }
    #flyShop .bye { text-align:center; margin-top:10px; font-size:13px; opacity:.6; }
    #flyReport { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%) rotate(-.5deg);
      min-width:320px; background:rgba(250,247,238,.98); color:#2c261c;
      border:2.5px solid #2c261c; border-radius:16px 18px 15px 17px;
      box-shadow:0 6px 0 rgba(44,38,28,.28); padding:18px 26px 16px; display:none;
      pointer-events:auto; z-index:22; text-align:center; }
    #flyReport.on { display:block; }
    #flyReport .h { font-size:24px; letter-spacing:.1em; border-bottom:2px solid rgba(44,38,28,.25); padding-bottom:6px; }
    #flyReport .r { font-size:16px; line-height:1.9; text-align:left; margin-top:8px; }
    #flyReport .r b { float:right; color:#4d8a52; }
    #flyReport .go { margin-top:12px; font-size:15px; letter-spacing:.1em; text-transform:uppercase;
      color:#c04434; cursor:pointer; animation:flyGo 1.6s ease-in-out infinite; }
    #flyDlg { position:absolute; left:50%; bottom:148px; transform:translateX(-50%) rotate(-.3deg);
      width:min(560px, 84vw); background:rgba(250,247,238,.97); color:#2c261c;
      border:2.5px solid #2c261c; border-radius:14px 16px 13px 15px;
      box-shadow:0 4px 0 rgba(44,38,28,.25); padding:12px 18px 12px; display:none;
      pointer-events:auto; cursor:pointer; }
    #flyDlg.on { display:block; }
    #flyDlg .who { position:absolute; top:-14px; left:14px; background:#3a7d99; color:#faf7ee;
      font-size:13px; letter-spacing:.08em; padding:1px 12px; border:2px solid #2c261c;
      border-radius:9px 11px 9px 10px; text-transform:uppercase; }
    #flyDlg .tx { font-size:17px; line-height:1.45; min-height:24px; }
    #flyDlg .adv { position:absolute; right:12px; bottom:4px; font-size:14px; color:#3a7d99;
      animation:flyGo 1.4s ease-in-out infinite; }
    @media (max-width: 560px) { #flyMap { width:118px; height:118px; bottom:96px; } #flyBest{ top:138px; } }
    #flyBigMap { position:absolute; inset:0; z-index:21; display:none; place-items:center;
      background:rgba(44,38,28,.34); pointer-events:auto; }
    #flyBigMap.on { display:grid; }
    #flyBigMap .frame { position:relative; background:#f4ecd6; border:3px solid #2c261c;
      border-radius:8px; box-shadow:0 8px 0 rgba(44,38,28,.3); padding:10px; transform:rotate(-.4deg); }
    #flyBigMap canvas { display:block; border-radius:4px; }
    #flyBigMap .ttl { position:absolute; top:-16px; left:50%; transform:translateX(-50%);
      background:#f4ecd6; padding:0 14px; font-size:22px; letter-spacing:.14em; color:#2c261c; }
    #flyBigMap .tip { position:absolute; bottom:-24px; left:50%; transform:translateX(-50%);
      font-size:13px; color:#faf7ee; opacity:.85; }
    #flyStart { position:absolute; inset:0; z-index:20; display:grid; place-items:center;
      background:rgba(44,38,28,.18); pointer-events:auto; transition:opacity .6s; }
    #flyStart.gone { opacity:0; pointer-events:none; }
    #flyStart .card { text-align:center; padding:24px 44px; border-radius:16px 19px 15px 18px;
      background:rgba(250,247,238,.97); color:#2c261c; border:2.5px solid #2c261c;
      box-shadow:0 5px 0 rgba(44,38,28,.25); transform:rotate(-.6deg); }
    #flyStart .t { font-size:44px; letter-spacing:.06em; }
    #flyStart .s { margin-top:0; font-size:15px; opacity:.7; font-style:italic; }
    #flyStart .stand { margin-top:12px; font-size:14px; line-height:1.7; color:#c8862a;
      border-top:2px solid rgba(44,38,28,.18); border-bottom:2px solid rgba(44,38,28,.18); padding:8px 0; }
    #flyStart .c { margin-top:14px; font-size:15px; line-height:1.7; opacity:.85; }
    #flyStart .go { margin-top:14px; font-size:14px; letter-spacing:.14em;
      text-transform:uppercase; color:#c04434; animation:flyGo 1.6s ease-in-out infinite; }
    @keyframes flyGo { 50% { opacity:.45; } }
    .flyBub { position:absolute; transform:translate(-50%,-115%) rotate(-.5deg); max-width:230px;
      background:rgba(250,247,238,.97); color:#2c261c; font-size:15px;
      border:2px solid #2c261c; padding:4px 11px; border-radius:11px 13px 11px 12px;
      opacity:0; transition:opacity .15s; pointer-events:none; white-space:nowrap;
      box-shadow:0 3px 0 rgba(44,38,28,.2); }
    .flyBub::after { content:''; position:absolute; left:50%; bottom:-7px; margin-left:-6px;
      border:7px solid transparent; border-top-color:#2c261c; border-bottom:0; }
    #flyOffer { position:absolute; left:50%; bottom:74px; transform:translateX(-50%);
      display:flex; gap:12px; pointer-events:auto; }
    #flyOffer .card { width:212px; padding:10px 14px 9px; cursor:pointer;
      background:rgba(250,247,238,.97); color:#2c261c; border:2px solid #2c261c;
      box-shadow:0 4px 0 rgba(44,38,28,.22); border-radius:12px 14px 11px 13px;
      transition:transform .12s; }
    #flyOffer .card:first-child { transform:rotate(-.7deg); }
    #flyOffer .card:last-child { transform:rotate(.6deg); }
    #flyOffer .card:hover { transform:translateY(-3px); }
    #flyOffer .card .key { font-size:11px; letter-spacing:.12em; color:#3a7d99; text-transform:uppercase; }
    #flyOffer .card.ex .key { color:#c8862a; }
    #flyOffer .card .route { font-size:15px; margin-top:2px; line-height:1.2; }
    #flyOffer .card .pay { font-size:13px; opacity:.7; margin-top:2px; font-style:italic; }
    #flyOffer .card .meta { font-size:12px; margin-top:4px; color:#4d8a52; }
    #flyOffer .card.ex .meta { color:#c8862a; }
    #flyOfferBar { position:absolute; left:50%; bottom:64px; transform:translateX(-50%);
      width:160px; height:5px; border-radius:3px; background:rgba(250,247,238,.6); border:1px solid rgba(44,38,28,.4); overflow:hidden; }
    #flyOfferBar i { display:block; height:100%; background:#3a7d99; }
  `;
  document.head.appendChild(css);

  // per-job timer panel
  const timerWrap = document.createElement('div'); timerWrap.id = 'flyTimerWrap';
  timerWrap.innerHTML = '<div class="row"><span class="lbl">Time</span><span class="t" id="flyTimerT">--</span></div><div id="flyTimerBar"><i></i></div>';
  hud.appendChild(timerWrap);
  const elTimerT = $('#flyTimerT'), elTimerBar = timerWrap.querySelector('#flyTimerBar i');

  // combo readout
  const comboEl = document.createElement('div'); comboEl.id = 'flyCombo';
  comboEl.innerHTML = '<div class="m" id="flyComboM">x2</div><div class="l">combo</div><div id="flyComboBar"><i></i></div>';
  hud.appendChild(comboEl);
  const elComboM = $('#flyComboM'), elComboBar = comboEl.querySelector('#flyComboBar i');

  // best-streak / best-score readout
  const bestEl = document.createElement('div'); bestEl.id = 'flyBest';
  hud.appendChild(bestEl);

  // minimap canvas
  const map = document.createElement('canvas'); map.id = 'flyMap';
  const MAPRES = 300; map.width = MAPRES; map.height = MAPRES;
  hud.appendChild(map);
  const mctx = map.getContext('2d');

  /* ── SPEECH BUBBLES — a small pool of HTML bubbles projected from 3D ── */
  const BUBBLES = [];
  for (let i = 0; i < 3; i++) {
    const el = document.createElement('div'); el.className = 'flyBub';
    hud.appendChild(el); BUBBLES.push({ el, t: 0, pos: new T.Vector3() });
  }
  function bubble(x, y, z, txt, dur) {
    const b = BUBBLES.find(b => b.t <= 0) || BUBBLES[0];
    b.pos.set(x, y, z); b.el.textContent = txt; b.t = dur || 2.6;
  }
  const _bp = new T.Vector3();
  function updateBubbles(dt) {
    for (const b of BUBBLES) {
      if (b.t <= 0) { b.el.style.opacity = 0; continue; }
      b.t -= dt;
      _bp.copy(b.pos).project(camera);
      if (_bp.z > 1 || _bp.z < -1) { b.el.style.opacity = 0; continue; }
      b.el.style.opacity = Math.min(1, b.t / 0.35, (2.6 - b.t + 0.3) * 3);
      b.el.style.left = ((_bp.x * 0.5 + 0.5) * hud.clientWidth) + 'px';
      b.el.style.top = ((-_bp.y * 0.5 + 0.5) * hud.clientHeight) + 'px';
    }
  }
  const QUIPS_STREET = ['Bonito día, ¿no?', 'El pan huele genial hoy', '¿Has visto al gato?', '¡Hola, mensajero!', '¿Algo para mí?', '¡Qué prisa llevas!', 'Las palomas otra vez…', 'Saludos a la Sra. Ibáñez'];
  const PERSONA = {
    'DOÑA REMEDIOS': ['Estas palomas me arruinan.', 'De joven yo también corría así.', '¿Le llevas algo al alcalde? Dile que me debe una silla.'],
    'SR. BIGOTES': ['El gato manda aquí, yo solo obedezco.', 'Ocho sardinas al día. Ni una menos.', 'Hoy casi maúlla mi nombre.'],
    'TEO': ['¡Enséñame a correr así!', '¿Puedo ver la carta? ¿No? Vale…', 'Cuando sea grande seré mensajero.'],
    'MARISOL': ['El mar está de buen humor hoy.', 'Si ves al ermitaño, dile que bajé el precio.', 'Las gaviotas me roban más que los impuestos.'],
    'CHUS': ['Esta moto me va a matar.', 'Le falta una pieza. ¿Cuál? Buena pregunta.', 'Ayer funcionaba. AYER.'],
    'EL VIEJO TOMÁS': ['Hoy pican. Mañana quién sabe.', 'El mar y yo tenemos un acuerdo.', 'Shhh. Los peces oyen todo.'],
    'PILAR': ['La luz de hoy no se repite.', 'El estanque nunca posa quieto.', '¿Te pinto? Quédate quieto tres horas.'],
    'RAMÓN': ['Medir dos veces, cortar una.', 'Esto era un armario. Ahora es… otra cosa.', 'El buen pino canta al serrarlo.'],
  };
  const QUIPS_PICKUP = ['¡Cuídalo bien!', '¡Es urgente!', 'Gracias, mensajero', 'Con cariño, por favor', 'Ni una arruga, ¿eh?'];
  const QUIPS_DELIVER = ['¡Gracias!', '¡Justo a tiempo!', '¡Eres un sol!', '¡Qué rápido!', '¡Mil gracias!'];
  const NPCS = world.npcs || [];
  let quipCd = 5;

  /* ── ONBOARDING — one-time contextual tips (persisted), so the new verbs
     (bike, tram, shop) are discoverable without nagging. ── */
  let tipsSeen = lsGet('fly_tips');
  const TIP_BITS = { bike: 1, tram: 2, shop: 4, letter: 8, day: 16 };
  let tipCd = 0;
  function tipOnce(key, text) {
    const bit = TIP_BITS[key];
    if (tipsSeen & bit) return false;
    if (tipCd > 0) return false;                 // don't stack tips
    tipsSeen |= bit; lsSet('fly_tips', tipsSeen);
    toast(text, '#3a7d99'); tipCd = 4;
    blip(720, 0.08, 'triangle', 0.05);
    return true;
  }
  function updateTips(dt) {
    tipCd = Math.max(0, tipCd - dt);
    if (!begun || onBike || ridingTram || offer || reporting) return;
    if (!(tipsSeen & TIP_BITS.bike) && Math.hypot(bike.position.x - P.pos.x, bike.position.z - P.pos.z) < 3.2)
      tipOnce('bike', 'E — súbete a la bici 🚲');
    else if (!(tipsSeen & TIP_BITS.shop) && bazarAddr && coins >= 120 && Math.hypot(bazarAddr.pos.x - P.pos.x, bazarAddr.pos.z - P.pos.z) < 8)
      tipOnce('shop', 'E — entra al Bazar por una bufanda 🧣');
  }

  /* ── STORY CHAINS — small multi-step delivery tales with a paper checklist.
     Steps arrive through the normal job flow (tagged 📜); finishing a chain
     pays a bonus and strikes it through in the log. Progress persists. ── */
  const CHAINS = [
    { id: 'boda', name: 'La boda en la plaza', steps: 3, from: 'FLORERÍA', to: 'AYUNTAMIENTO', payload: 'flores para la boda',
      pick: '¡Las flores de la boda! Que lleguen frescas, por favor.',
      drops: ['La primera de tres… ¡gracias, mensajero!', 'Ya casi está todo listo para la ceremonia…', '¡La boda puede empezar! Eres un sol.'] },
    { id: 'faro', name: 'El crucigrama del farero', steps: 2, from: 'LA PRENSA', to: 'EL FARO', payload: 'el crucigrama del día',
      pick: 'El farero no puede vivir sin su crucigrama.',
      drops: ['Dice que el siete vertical era «faro». Cómo no.', '¡Completado! El farero te saluda desde la torre.'] },
    { id: 'postal', name: 'Postales de la costa', steps: 3, from: 'EL CORREO', to: 'GALERÍA', payload: 'una postal de la costa',
      pick: 'Una postal de la costa — con arena y todo.',
      drops: ['La galería la enmarcará esta tarde.', 'Otra más para la colección…', '¡La exposición está completa! Ven a verla.'] },
    { id: 'carta', name: 'La carta del pescador', steps: 2, from: 'EL PESQUERO', to: 'LA ERMITA', payload: 'la carta del pescador',
      pick: 'Del muelle a la colina. El ermitaño espera noticias del mar.',
      drops: ['El ermitaño sonríe: «el mar sigue ahí», dice.', 'Y esta vez… ¡una lata de sardinas de regalo!'] },
  ];
  let chainProg = {};
  try { chainProg = JSON.parse(localStorage.getItem('fly_chains') || '{}'); } catch (e) {}
  const saveChains = () => { try { localStorage.setItem('fly_chains', JSON.stringify(chainProg)); } catch (e) {} };
  const chainDone = c => (chainProg[c.id] || 0) >= c.steps;
  const findAddr = nm => ADDR.find(a => a.name === nm);
  const logBtn = document.createElement('div'); logBtn.id = 'flyLogBtn'; logBtn.textContent = '☰';
  const logEl = document.createElement('div'); logEl.id = 'flyLog';
  hud.appendChild(logBtn); hud.appendChild(logEl);
  function renderLog() {
    logEl.innerHTML = '<div class="h">Recados del pueblo</div>'
      + '<div class="q">✉ Cartas perdidas <span class="n">(' + lostCount() + '/10)</span></div>'
      + CHAINS.map(c => {
      const n = Math.min(chainProg[c.id] || 0, c.steps);
      const boxes = '◼'.repeat(n) + '◻'.repeat(c.steps - n);
      return '<div class="q' + (chainDone(c) ? ' done' : '') + '">' + boxes + ' ' + c.name + ' <span class="n">(' + n + '/' + c.steps + ')</span></div>';
    }).join('');
  }
  renderLog();
  logBtn.addEventListener('pointerdown', e => { e.preventDefault(); logEl.classList.toggle('open'); });
  addEventListener('keydown', e => { if (e.code === 'KeyL' && begun) logEl.classList.toggle('open'); });

  /* ── TYPEWRITER DIALOGUE — paper card, name chip, letter-by-letter (story beats) ── */
  const dlgEl = document.createElement('div'); dlgEl.id = 'flyDlg';
  dlgEl.innerHTML = '<div class="who"></div><div class="tx"></div><div class="adv">▶</div>';
  hud.appendChild(dlgEl);
  const dlgWho = dlgEl.querySelector('.who'), dlgTx = dlgEl.querySelector('.tx');
  let dlgFull = '', dlgShown = 0, dlgHold = 0;
  function say(name, text) {
    dlgWho.textContent = name; dlgFull = text; dlgShown = 0; dlgHold = 0;
    dlgTx.textContent = ''; dlgEl.classList.add('on');
    blip(840, 0.05, 'triangle', 0.05);
  }
  function updateDlg(dt) {
    if (!dlgEl.classList.contains('on')) return;
    if (dlgShown < dlgFull.length) {
      const prev = dlgShown | 0;
      dlgShown = Math.min(dlgFull.length, dlgShown + dt * 32);
      if ((dlgShown | 0) > prev) dlgTx.textContent = dlgFull.slice(0, dlgShown | 0);
      if (dlgShown >= dlgFull.length) dlgTx.textContent = dlgFull;
    } else {
      dlgHold += dt;
      if (dlgHold > 2.6) dlgEl.classList.remove('on');
    }
  }
  dlgEl.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (dlgShown < dlgFull.length) { dlgShown = dlgFull.length; dlgTx.textContent = dlgFull; }
    else dlgEl.classList.remove('on');
  });

  /* ── LOST LETTERS — ten golden envelopes hidden across every district.
     A reason to wander off-route; persistence via a bitmask. ── */
  const LOST_SPOTS = [
    [-146, 12.5, 0], [34, -37, 0], [6.5, 20.5, 0.25], [-70, -49.8, 5.74], [164.5, 20, 0.28],
    [-87, -21, 0.25], [-38, 52, 0.25], [86, 71, 0], [47.5, 13.4, 0.25], [-49.6, -40, 0.25],
  ];
  const lostMeshes = [];
  LOST_SPOTS.forEach(([x, z, gy], i) => {
    if (lostMask & (1 << i)) { lostMeshes.push(null); return; }
    const gl = new T.Group();
    const env = L.box(0.34, 0.24, 0.04, L.std({ colorHex: '#c8a648', roughness: 0.4, emissive: 0xc8a648, emissiveIntensity: 0.35 }));
    env.add(L.box(0.09, 0.09, 0.01, L.std({ colorHex: '#a8352c', roughness: 0.6 }), { z: 0.026, cast: false }));
    gl.add(env); gl.position.set(x, gy + 1.05, z);
    scene.add(gl); toFx(gl); lostMeshes.push(gl);
  });
  let heroDone = lsGet('fly_hero'), festival = 0;
  function allChainsDone() { return CHAINS.every(c => chainDone(c)); }
  function checkCompletion() {
    if (heroDone) return;
    if (lostCount() >= 10 && allChainsDone()) {
      heroDone = 1; lsSet('fly_hero', 1); festival = 22;
      toast('🎆 ¡Héroe de Villa Mott! ¡Fiesta en la plaza!', '#c8862a');
      setTimeout(() => say('El Pueblo', '¡Gracias por todo, mensajero! El pueblo entero te lo agradece.'), 1500);
    }
  }
  const _plazaC = new T.Vector3(0, 0, 14);
  function updateFestival(dt, now) {
    if (festival <= 0) return;
    festival -= dt;
    // fireworks over the plaza on a loop
    if (Math.random() < dt * (reducedMotion ? 0.8 : 2.5)) {
      const fx = _plazaC.x + rand(-14, 14), fz = _plazaC.z + rand(-6, 10);
      fxBurst({ x: fx, y: 0, z: fz }, [0xffd27a, 0xff8f8f, 0x9fd0ff, 0x7fe0a0, 0xffffff], 22, rand(9, 15));
      if (AC) blip(rand(400, 900), 0.18, 'triangle', 0.06);
    }
    if (festival <= 0) toast('✨ Villa Mott te recordará', '#c8862a');
  }

  function updateLost(dt, now) {
    for (let i = 0; i < lostMeshes.length; i++) {
      const gl = lostMeshes[i]; if (!gl) continue;
      gl.rotation.y += dt * 1.8;
      gl.position.y = LOST_SPOTS[i][2] + 1.05 + Math.sin(now * 0.003 + i) * 0.12;
      const dx3 = gl.position.x - P.pos.x, dz3 = gl.position.z - P.pos.z;
      if (dx3 * dx3 + dz3 * dz3 < 2.9) {
        lostMask |= (1 << i); lsSet('fly_lost_mask', lostMask);
        scene.remove(gl); lostMeshes[i] = null;
        score += 150; elScore.textContent = score; dayLetters++;
        fxBurst(gl.position, [0xc8a648, 0xffffff, 0xa8352c], 16, gl.position.y);
        sfxBonus(); renderLog();
        const n = lostCount();
        if (n >= 10) { score += 1000; elScore.textContent = score; setTimeout(() => { toast('✉ ¡Las diez cartas! +1000', '#c8862a'); sfxDeliver(); }, 700); }
        else { toast('✉ Carta perdida ' + n + '/10  +150', '#c8862a');
          if (n === 1) setTimeout(() => tipOnce('letter', 'Hay 10 cartas perdidas escondidas por el pueblo ✉'), 1400); }
        checkCompletion();
      }
    }
  }

  /* ── THE TRAM — hop on as it passes, ride the avenue, hop off anywhere ── */
  let ridingTram = null, tramSide = 1;
  function nearestTram() {
    for (const car of TRAFFIC) {
      const d = car.userData.drive;
      if (!d || !(d.hl > 4)) continue;
      if (Math.hypot(car.position.x - P.pos.x, car.position.z - P.pos.z) < 3.4) return car;
    }
    return null;
  }
  function hopOnTram(tram) {
    ridingTram = tram;
    tramSide = P.pos.z >= tram.position.z ? 1 : -1;
    toast('🚋 ¡Al tranvía!', '#3a7d99');
    blip(988, 0.15, 'square', 0.08); setTimeout(() => blip(988, 0.2, 'square', 0.07), 170);
  }
  function hopOffTram() {
    const t = ridingTram; ridingTram = null;
    if (t) { P.pos.x = t.position.x; P.pos.z = t.position.z + tramSide * 2.4; }
    toast('🚋 ¡Hasta luego!', '#3a7d99');
  }

  /* ── EL BAZAR — spend coins on scarf colorways (E near the shop) ── */
  const SCARVES = [
    ['#b5352a', 'Roja de siempre', 0], ['#a06414', 'Azafrán', 120], ['#1e5a52', 'Verde mar', 160],
    ['#c9c2b0', 'Blanca de lino', 220], ['#a04868', 'Rosa vieja', 280], ['#2e2a26', 'Negra elegante', 400],
  ];
  let scarfMask = lsGet('fly_scarf_mask') | 1;   // the red one is yours already
  let scarfSel = lsGet('fly_scarf_sel');
  function applyScarf() {
    const sm = hero.userData.scarfMat;
    if (sm) sm.color.setHex(parseInt(SCARVES[scarfSel][0].replace('#', '0x')));
  }
  applyScarf();
  const shopEl = document.createElement('div'); shopEl.id = 'flyShop';
  hud.appendChild(shopEl);
  let shopOpen = false;
  const bazarAddr = world.addresses.find(a => a.name === 'BAZAR');
  function renderShop() {
    shopEl.innerHTML = '<div class="h">EL BAZAR</div><div class="coins">🪙 ' + coins + '</div>'
      + SCARVES.map(([hex, nm, price], i) => {
        const owned = !!(scarfMask & (1 << i));
        return '<div class="it' + (owned ? ' owned' : '') + (i === scarfSel ? ' worn' : '') + '" data-i="' + i + '">'
          + '<span><span class="sw" style="background:' + hex + '"></span>Bufanda ' + nm + '</span>'
          + '<span class="pr">' + (owned ? (i === scarfSel ? 'puesta' : 'tuya') : price + ' 🪙') + '</span></div>';
      }).join('')
      + '<div class="bye">E para salir</div>';
    shopEl.querySelectorAll('.it').forEach(el => el.addEventListener('pointerdown', e => {
      e.preventDefault();
      const i = +el.dataset.i, [hex, nm, price] = SCARVES[i];
      if (scarfMask & (1 << i)) { scarfSel = i; lsSet('fly_scarf_sel', scarfSel); applyScarf(); sfxPick(); }
      else if (coins >= price) {
        coins -= price; lsSet('fly_coins', coins);
        scarfMask |= (1 << i); lsSet('fly_scarf_mask', scarfMask);
        scarfSel = i; lsSet('fly_scarf_sel', scarfSel); applyScarf();
        sfxBonus(); toast('🧣 ' + nm + ' — ¡preciosa!', '#c8862a'); renderBest();
      } else { blip(160, 0.2, 'sawtooth', 0.08); toast('🪙 Te faltan ' + (price - coins), '#c04434'); }
      renderShop();
    }));
  }
  function toggleShop(force) {
    shopOpen = force != null ? force : !shopOpen;
    if (shopOpen) renderShop();
    shopEl.classList.toggle('on', shopOpen);
  }

  /* ── the END-OF-DAY report card ── */
  const repEl = document.createElement('div'); repEl.id = 'flyReport';
  hud.appendChild(repEl);
  function showReport() {
    reporting = true;
    beam.visible = ring.visible = objLetter.visible = false;
    const nx = nextRank(totalDeliv);
    repEl.innerHTML = '<div class="h">☀ DÍA ' + dayNum + ' — INFORME</div><div class="r">'
      + 'Entregas <b>' + dayDeliv + '</b><br>'
      + 'Puntos del día <b>' + dayScore + '</b><br>'
      + 'Mejor combo <b>x' + dayBestCombo + '</b><br>'
      + 'Monedas <b>+' + dayCoins + ' 🪙</b><br>'
      + (dayLetters ? 'Cartas perdidas halladas <b>' + dayLetters + '</b><br>' : '')
      + (dayStories ? 'Historias avanzadas <b>' + dayStories + '</b><br>' : '')
      + 'Rango <b>' + rankName(totalDeliv) + '</b><br>'
      + 'Dificultad <b>' + ['tranquila','animada','ajetreada','frenética','legendaria'][Math.min(4, Math.floor(dayDiff() * 4.9))] + '</b>'
      + (nx ? '<br><span style="opacity:.65">' + (nx[0] - totalDeliv) + ' entregas para ' + nx[1] + '</span>' : '')
      + '</div><div class="go">Comenzar el día ' + (dayNum + 1) + ' ▶</div>';
    repEl.classList.add('on');
    sfxDeliver();
  }
  function closeReport() {
    if (!reporting) return;
    reporting = false; repEl.classList.remove('on');
    dayNum++; lsSet('fly_day', dayNum);
    dayDeliv = 0; dayScore = 0; dayBestCombo = 1; dayStories = 0; dayLetters = 0; dayCoins = 0;
    tod = 0; applyTOD(0);
    toast('☀ Día ' + dayNum + ' — amanece', '#c8862a');
    newTask();
  }
  repEl.addEventListener('pointerdown', e => { e.preventDefault(); closeReport(); });
  addEventListener('keydown', e => { if (reporting && (e.code === 'Enter' || e.code === 'Space')) closeReport(); });

  /* ── game state ── */
  const ADDR = world.addresses;
  const bounds = world.bounds;
  const P = { pos: world.spawn.clone(), yaw: 0, speed: 0 };
  P.pos.y = 0;                                  // walking: feet glued to the ground (no flight)
  const WALK = 3.4, RUN = 6.6, ACCEL = 9;
  let camYaw = 0;                               // camera heading — input is camera-relative
  let begun = false;                            // gated behind the start card
  let carrying = false, pickup = null, dropoff = null, delivered = 0;
  let score = 0;
  const IS_TOUCH = window.matchMedia && matchMedia('(hover: none), (pointer: coarse)').matches;
  // accessibility: honor the OS reduced-motion preference, plus a manual toggle (O)
  let reducedMotion = (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) ? 1 : lsGet0('fly_reduced');
  if (localStorage.getItem('fly_reduced') != null) reducedMotion = lsGet0('fly_reduced');
  /* ── TIME OF DAY — dawns bright, slides to a golden dusk across the day's 8
     deliveries; the report is at last light. Interpolates the whole rig. ── */
  const _sun = ctx.sun, _hemi = ctx.hemi, _sky = ctx.skyMat, _rend = ctx.renderer;
  const _sunDay = new T.Color(0xfff2dc), _sunDusk = new T.Color(0xffb066);
  const _hemiSkyDay = new T.Color(0xd6e8e2), _hemiSkyDusk = new T.Color(0xbcd0d8);
  const _hemiGrDay = new T.Color(0x9a9484), _hemiGrDusk = new T.Color(0x6a5236);
  const _fogDay = new T.Color(0xa8dcd4), _fogDusk = new T.Color(0xe8c49a);
  const _skyTopDay = new T.Color(0x53bcae), _skyTopDusk = new T.Color(0x4a86b0);
  const _skyHorDay = new T.Color(0x6cc8ba), _skyHorDusk = new T.Color(0xf0b878);
  const _cloudDay = new T.Color(0xbfe8dc), _cloudDusk = new T.Color(0xf2d0a8);
  let tod = 0;
  function applyTOD(t) {
    const k = t * t;
    _sun.color.copy(_sunDay).lerp(_sunDusk, k); _sun.intensity = 0.6 - k * 0.28;
    _hemi.color.copy(_hemiSkyDay).lerp(_hemiSkyDusk, k);
    _hemi.groundColor.copy(_hemiGrDay).lerp(_hemiGrDusk, k);
    _hemi.intensity = 1.32 - k * 0.34;
    if (ctx.fog) ctx.fog.color.copy(_fogDay).lerp(_fogDusk, k);
    if (_sky) {
      _sky.uniforms.uTop.value.copy(_skyTopDay).lerp(_skyTopDusk, k);
      _sky.uniforms.uHorz.value.copy(_skyHorDay).lerp(_skyHorDusk, k);
      _sky.uniforms.uCloud.value.copy(_cloudDay).lerp(_cloudDusk, k);
    }
    _rend.toneMappingExposure = 0.92 + k * 0.06;
    if (gradeU) {
      gradeU.uGain.value.set(1.02 + k * 0.10, 1.01, 0.985 - k * 0.06);
      gradeU.uLift.value.set(0.030 + k * 0.02, 0.030, 0.026 - k * 0.01);
    }
    // evening: bloom swells so every lamp, lit window and festoon bulb glows
    if (bloomPass) bloomPass.strength = bloomBase + k * 0.5;
  }

  // reach the color-grade pass so rain can desaturate the world
  let gradeU = null, gradeBlend = 0, gradeSatBase = 1.06, gradeVigBase = 0.10;
  let bloomPass = null, bloomBase = 0.14;
  if (ctx.composer && ctx.composer.passes) {
    for (const pz of ctx.composer.passes) {
      if (pz.uniforms && pz.uniforms.uSat && pz.uniforms.uHatch) { gradeU = pz.uniforms; gradeSatBase = pz.uniforms.uSat.value; gradeVigBase = pz.uniforms.uVig.value; }
      if (pz.strength !== undefined && pz.radius !== undefined) { bloomPass = pz; bloomBase = pz.strength; }
    }
  }

  /* ── STATIC COLLISION (grid-bucketed circle-vs-shape resolve) ──
     world.js exports axis-aligned boxes (buildings, parked cars, hedges) and
     circles (trees, lamps, fountains…). The courier is a 0.55m circle. */
  const PR = 0.55;
  const COLS = world.colliders || [];
  const CG = 8, cmap = new Map();
  const ck = (gx, gz) => gx + ',' + gz;
  for (const c of COLS) {
    const hw = c.t === 'b' ? c.hw : c.r, hd = c.t === 'b' ? c.hd : c.r;
    const x0 = Math.floor((c.x - hw - 0.8) / CG), x1 = Math.floor((c.x + hw + 0.8) / CG);
    const z0 = Math.floor((c.z - hd - 0.8) / CG), z1 = Math.floor((c.z + hd + 0.8) / CG);
    for (let gx = x0; gx <= x1; gx++) for (let gz = z0; gz <= z1; gz++) {
      const k = ck(gx, gz); let a = cmap.get(k); if (!a) { a = []; cmap.set(k, a); } a.push(c);
    }
  }
  function resolveCircle(p, R) {
    const cell = cmap.get(ck(Math.floor(p.x / CG), Math.floor(p.z / CG)));
    if (!cell) return;
    for (let pass = 0; pass < 2; pass++) {
      for (const c of cell) {
        if (c.t === 'b') {
          const nx = clamp(p.x, c.x - c.hw, c.x + c.hw), nz = clamp(p.z, c.z - c.hd, c.z + c.hd);
          const dx = p.x - nx, dz = p.z - nz, d2 = dx * dx + dz * dz;
          if (d2 === 0) {          // center inside the box: exit along the shallow axis
            const px = (c.hw + R) - Math.abs(p.x - c.x), pz = (c.hd + R) - Math.abs(p.z - c.z);
            if (px < pz) p.x += (p.x >= c.x ? 1 : -1) * px;
            else p.z += (p.z >= c.z ? 1 : -1) * pz;
          } else if (d2 < R * R) {
            const d = Math.sqrt(d2), push = (R - d) / d;
            p.x += dx * push; p.z += dz * push;
          }
        } else {
          const dx = p.x - c.x, dz = p.z - c.z, rr = c.r + R, d2 = dx * dx + dz * dz;
          if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2), push = (rr - d) / d; p.x += dx * push; p.z += dz * push; }
        }
      }
    }
  }
  function resolveStatic() { resolveCircle(P.pos, PR); }

  /* camera occlusion set: only solids tall/wide enough to actually block the view
     (buildings, fountain, cafés, stalls…) — thin lamps and low cars are ignored */
  const OCC = COLS.filter(c => c.t === 'b' ? Math.min(c.hw, c.hd) >= 2.0 : c.r >= 1.9);
  function occluded(x, z) {
    for (const c of OCC) {
      if (c.t === 'b') { if (Math.abs(x - c.x) < c.hw + 0.2 && Math.abs(z - c.z) < c.hd + 0.2) return true; }
      else { const dx = x - c.x, dz = z - c.z; if (dx * dx + dz * dz < (c.r + 0.2) * (c.r + 0.2)) return true; }
    }
    return false;
  }

  /* walkable surface height (sidewalks/plaza/park slabs) so feet ride on top */
  const FLOORS = world.floors || [];
  function groundAt(x, z) {
    let h = 0;
    for (const f of FLOORS) if (Math.abs(x - f.x) <= f.hw + 0.05 && Math.abs(z - f.z) <= f.hd + 0.05 && f.h > h) h = f.h;
    return h;
  }

  // scoring / timer / combo
  let jobBudget = 0;       // soft seconds allotted for the active job
  let jobLeft = 0;         // seconds remaining
  let jobActive = false;
  let combo = 1;           // current multiplier
  let comboTimer = 0;      // seconds left before combo decays
  const COMBO_WINDOW = 14; // grace window after a delivery to keep the streak
  let streak = 0;          // consecutive on-time deliveries
  let stun = 0;            // hazard stun timer (seconds)

  // persisted bests + lifetime rank
  const LS = { score: 'fly_best_score', streak: 'fly_best_streak', total: 'fly_total_deliv' };
  function lsGet(k) { try { return parseInt(localStorage.getItem(k) || '0', 10) || 0; } catch (e) { return 0; } }
  function lsSet(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) {} }
  let bestScore = lsGet(LS.score), bestStreak = lsGet(LS.streak), totalDeliv = lsGet(LS.total);
  /* the day: 8 deliveries, then the paper report and a fresh morning */
  const DAY_LEN = 8;
  let dayNum = lsGet('fly_day') || 1, dayDeliv = 0, dayScore = 0, dayBestCombo = 1, dayStories = 0, dayLetters = 0;
  let coins = lsGet('fly_coins'), dayCoins = 0;
  let reporting = false;
  const RANKS = [[0, 'Recadero'], [5, 'Mensajero'], [15, 'Cartero de Barrio'], [30, 'Correo Exprés'], [60, 'Leyenda de Villa Mott']];
  function rankName(n) { let r = RANKS[0][1]; for (const [t, nm] of RANKS) if (n >= t) r = nm; return r; }
  function nextRank(n) { for (const [t, nm] of RANKS) if (n < t) return [t, nm]; return null; }
  function rankIdx(n) { let i = 0; RANKS.forEach(([t], k) => { if (n >= t) i = k; }); return i; }

  /* ── WARDROBE: one cap colorway unlocked per rank; C cycles the unlocked set.
     Hexes authored dark for the hot ACES rig (same trick as the hair palette). */
  const CAPS = [['#8f231b', 'Roja'], ['#a06414', 'Azafrán'], ['#1e5a52', 'Verde Mar'], ['#58245c', 'Ciruela'], ['#a89858', 'Dorada']];
  let capSel = Math.min(lsGet('fly_cap_sel'), rankIdx(lsGet(LS.total)), CAPS.length - 1);
  function applyCap() {
    const cm = hero.userData.capMat;
    if (cm) cm.color.setHex(parseInt(CAPS[capSel][0].replace('#', '0x')));
  }
  applyCap();
  addEventListener('keydown', e => {
    if (e.code !== 'KeyC' || !begun) return;
    const unlocked = Math.min(rankIdx(totalDeliv) + 1, CAPS.length);
    capSel = (capSel + 1) % unlocked;
    lsSet('fly_cap_sel', capSel); applyCap();
    toast('🧢 Gorra ' + CAPS[capSel][1] + (unlocked < CAPS.length ? '  (' + unlocked + '/' + CAPS.length + ')' : ''), '#9fd0ff');
  });
  function renderBest() {
    const nx = nextRank(totalDeliv);
    bestEl.innerHTML = '<span style="color:#c8862a">✦ ' + rankName(totalDeliv) + '</span><br>'
      + '<span style="color:#c8862a">🪙 ' + coins + '</span><br>'
      + 'Best score <b>' + bestScore + '</b><br>Best streak <b>x' + bestStreak + '</b>'
      + (nx ? '<br><span style="opacity:.65">' + (nx[0] - totalDeliv) + ' more → ' + nx[1] + '</span>' : '');
  }
  renderBest();
  if (elScoreL) elScoreL.textContent = 'score';

  function planar(a, b) { const dx = a.x - b.x, dz = a.z - b.z; return Math.hypot(dx, dz); }

  /* what's inside the envelope — pure flavor, big charm-per-byte */
  const PAYLOADS = [
    'a love letter', 'a birthday card', 'sheet music for the band', 'a recipe, still warm',
    'a set of spare keys', 'a postcard from the coast', 'an overdue library book',
    'a pressed flower', 'a thank-you note', "yesterday's crossword, solved",
    'a wedding invitation', 'a small tin of saffron', 'a secret, sealed twice',
  ];
  let payload = '', express = false, fragile = false;
  let squash = 0;   // brief squash-and-stretch impulse (pickup/deliver juice)
  /* the wind: sometimes it rips the letter out of your hands mid-run */
  let gustPending = false, gustAt = 0, gustLoose = false, gustT = 0;
  const gustPos = new T.Vector3(), gustFrom = new T.Vector3();
  let gustGy = 0;
  function triggerGust(now) {
    gustPending = false; gustLoose = true; gustT = 0;
    // the wind is mischievous, not cruel: reject landing spots inside solid
    // masses so the letter is always catchable
    let gx2 = P.pos.x + 6, gz2 = P.pos.z;
    for (let tries = 0; tries < 14; tries++) {
      const a = rand(0, TAU), r = rand(8, 14);
      const cx3 = clamp(P.pos.x + Math.cos(a) * r, bounds.minX + 3, bounds.maxX - 3);
      const cz3 = clamp(P.pos.z + Math.sin(a) * r, bounds.minZ + 3, bounds.maxZ - 3);
      if (!occluded(cx3, cz3)) { gx2 = cx3; gz2 = cz3; break; }
    }
    gustPos.set(gx2, 0, gz2);
    gustGy = groundAt(gustPos.x, gustPos.z);
    gustFrom.copy(P.pos); gustFrom.y = 1.2;
    carriedLetter.visible = false;
    objLetter.visible = true;
    beam.material.color.setHex(0x3ab0c8); ring.material.color.setHex(0x3ab0c8);
    beam.position.set(gustPos.x, gustGy + 15, gustPos.z);
    ring.position.set(gustPos.x, gustGy + 0.3, gustPos.z);
    elLbl.textContent = '💨 ¡El viento!'; elDst.textContent = '¡Atrapa la carta!'; elSub.textContent = payload;
    toast('💨 ¡El viento se llevó la carta!', '#3a7d99');
    blip(220, 0.5, 'sawtooth', 0.05);
  }

  function setObjective() {
    const tg = carrying ? dropoff : pickup;
    const col = carrying ? 0x7fe0a0 : 0xffd060;
    beam.material.color.setHex(col); ring.material.color.setHex(col);
    const gy = tg.gy || 0;               // hilltop addresses sit on raised ground
    beam.position.set(tg.pos.x, gy + 15, tg.pos.z);
    ring.position.set(tg.pos.x, gy + 0.3, tg.pos.z);
    beam.visible = ring.visible = true;
    objLetter.position.set(tg.pos.x, gy + 3.6, tg.pos.z); objLetter.visible = !carrying;
    elLbl.textContent = (express ? '⚡ ' : '') + (fragile ? '🎂 ' : '') + (carrying ? 'Deliver to' : 'Pick up at');
    elLbl.style.color = express ? '#ffd27a' : '#ffd27a';
    elDst.textContent = tg.name;
    elSub.textContent = carrying ? (payload + ' → the green-lit shop') : (payload + ' — grab the floating letter');
  }
  /* ── JOBS: after onboarding the courier CHOOSES between two offers ── */
  let offer = null;   // { jobs: [a, b], t: seconds left to decide }
  // difficulty ramps with the day number (gentle days 1-3, demanding by ~day 10)
  function dayDiff() { return clamp((dayNum - 1) / 9, 0, 1); }
  function makeJob(noStory) {
    // sometimes the next step of an open story chain arrives instead
    const open = CHAINS.filter(c => !chainDone(c) && findAddr(c.from) && findAddr(c.to));
    if (!noStory && open.length && delivered >= 1 && L.chance(0.35)) {
      const c = pick(open);
      const pu = findAddr(c.from), dr = findAddr(c.to);
      const route = planar(P.pos, pu.pos) + planar(pu.pos, dr.pos);
      return { pickup: pu, dropoff: dr, payload: c.payload, express: false, budget: clamp(12 + route * 0.45, 16, 48), route, story: c };
    }
    const pu = pick(ADDR);
    let dr; do { dr = pick(ADDR); } while (dr === pu);
    const dd = dayDiff();
    const ex = delivered >= 2 && L.chance(0.3 + dd * 0.18);
    const route = planar(P.pos, pu.pos) + planar(pu.pos, dr.pos);
    let budget = clamp(10 + route * 0.42, 14, 46) * (ex ? 0.66 : 1) * (1 - dd * 0.18);   // clocks tighten
    if (delivered === 0) budget *= 1.6;           // warm-up welcome job
    // sweet shops sometimes hand you something breakable: double pay, but a
    // traffic bump ruins it and sends you back for another
    const FRAG_FROM = ['CONFITERÍA', 'HELADOS', 'PANADERÍA', 'DULCES', 'QUESERÍA', 'EL HORNO'];
    const fr = !ex && delivered >= 2 && FRAG_FROM.includes(pu.name) && L.chance(0.55);
    const pay2 = fr ? pick(['una tarta de tres pisos', 'helado de limón (se derrite)', 'una caja de merengues', 'flan de la abuela']) : pick(PAYLOADS);
    return { pickup: pu, dropoff: dr, payload: pay2, express: ex, fragile: fr, budget, route };
  }
  let curStory = null;
  function startJob(j) {
    gustPending = false; gustLoose = false;
    if (R.active) { R.active = false; rival.visible = false; }
    pickup = j.pickup; dropoff = j.dropoff; payload = j.payload; express = j.express;
    fragile = !!j.fragile;
    curStory = j.story || null;
    setCarryItem();
    carrying = false; carriedLetter.visible = false;
    jobBudget = j.budget; jobLeft = jobBudget; jobActive = true;
    setObjective();
    if (curStory) toast('📜 ' + curStory.name, '#c8862a');
    else if (fragile) toast('🎂 Frágil — ¡ni un golpe! ×2', '#c04434');
    else toast(express ? '⚡ Express — double pay! ' + Math.round(jobBudget) + 's' : 'New job · ' + Math.round(jobBudget) + 's', express ? '#c8862a' : '#3a7d99');
  }
  const offerEl = document.createElement('div'); offerEl.id = 'flyOffer'; offerEl.style.display = 'none';
  const offerBar = document.createElement('div'); offerBar.id = 'flyOfferBar'; offerBar.style.display = 'none';
  offerBar.innerHTML = '<i></i>';
  hud.appendChild(offerEl); hud.appendChild(offerBar);
  function estPts(j) { return Math.round((100 + 75) * (j.express ? 2 : 1)); }
  function chooseJob(i) {
    if (!offer) return;
    const j = offer.jobs[i] || offer.jobs[0];
    offer = null; offerEl.style.display = 'none'; offerBar.style.display = 'none';
    startJob(j);
  }
  function newTask() {
    if (delivered < 2) { startJob(makeJob()); return; }    // onboarding: no decisions yet
    const a = makeJob(); let b = makeJob(!!a.story);
    for (let k = 0; k < 4 && b.pickup === a.pickup && b.dropoff === a.dropoff; k++) b = makeJob(!!a.story);
    offer = { jobs: [a, b], t: 9 };
    beam.visible = ring.visible = objLetter.visible = false;
    elLbl.textContent = 'Encargos'; elDst.textContent = 'Choose a job'; elSub.textContent = 'press 1 / 2 — or tap a card';
    elTimerT.textContent = '--'; elTimerBar.style.width = '100%';
    offerEl.innerHTML = offer.jobs.map((j, i) =>
      '<div class="card' + (j.express ? ' ex' : '') + '" data-i="' + i + '">'
      + '<div class="key">' + (i + 1) + (j.express ? ' · ⚡ express' : '') + (j.fragile ? ' · 🎂 frágil ×2' : '') + (j.story ? ' · 📜 historia' : '') + '</div>'
      + '<div class="route">' + j.pickup.name + ' → ' + j.dropoff.name + '</div>'
      + '<div class="pay">' + j.payload + '</div>'
      + '<div class="meta">~' + Math.round(j.route) + 'm · ' + Math.round(j.budget) + 's · ~' + estPts(j) + ' pts</div>'
      + '</div>').join('');
    offerEl.querySelectorAll('.card').forEach(c => c.addEventListener('pointerdown', e => { e.preventDefault(); chooseJob(+c.dataset.i); }));
    offerEl.style.display = 'flex'; offerBar.style.display = 'block';
    blip(720, 0.1, 'triangle', 0.08);
  }
  addEventListener('keydown', e => {
    if (offer && (e.code === 'Digit1' || e.code === 'Digit2')) chooseJob(e.code === 'Digit2' ? 1 : 0);
  });

  /* ── audio (lazy, synth) — everything through one master bus for mute ── */
  let AC = null, wind = null, windGain = null, master = null, muted = false, fountainGain = null, seaGain = null, musicBus = null;
  function initAudio() {
    if (AC) return; try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = AC.createGain(); master.gain.value = muted ? 0 : 1; master.connect(AC.destination);
    wind = AC.createBufferSource();
    const buf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
    wind.buffer = buf; wind.loop = true;
    const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 480;
    windGain = AC.createGain(); windGain.gain.value = 0.0;
    wind.connect(lp).connect(windGain).connect(master); wind.start();

    // fountain water: the same noise buffer through a high bandpass, gain by distance
    const fs = AC.createBufferSource(); fs.buffer = buf; fs.loop = true;
    const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 0.9;
    fountainGain = AC.createGain(); fountainGain.gain.value = 0.0;
    fs.connect(bp).connect(fountainGain).connect(master); fs.start();
    // the sea: low broad wash that swells near the quay
    const ss = AC.createBufferSource(); ss.buffer = buf; ss.loop = true;
    const sbp = AC.createBiquadFilter(); sbp.type = 'bandpass'; sbp.frequency.value = 640; sbp.Q.value = 0.5;
    seaGain = AC.createGain(); seaGain.gain.value = 0.0;
    ss.connect(sbp).connect(seaGain).connect(master); ss.start();

    // cozy ambient pad — a soft warm chord (A major) through a lowpass, gently swelling
    const pad = AC.createGain(); pad.gain.value = 0.0001;
    const padLP = AC.createBiquadFilter(); padLP.type = 'lowpass'; padLP.frequency.value = 900;
    pad.connect(padLP).connect(master);
    [110, 164.81, 220, 277.18].forEach((f, i) => {           // A2 · E3 · A3 · C#4
      const o = AC.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.detune.value = (i - 1.5) * 4;
      const g = AC.createGain(); g.gain.value = [0.5, 0.34, 0.30, 0.22][i];
      o.connect(g).connect(pad); o.start();
    });
    const lfo = AC.createOscillator(); lfo.frequency.value = 0.06;   // ~16s swell
    const lfoG = AC.createGain(); lfoG.gain.value = 0.012;
    lfo.connect(lfoG).connect(pad.gain); lfo.start();
    pad.gain.setValueAtTime(0.0001, AC.currentTime);
    pad.gain.linearRampToValueAtTime(0.03, AC.currentTime + 5);       // fade in gently

    // ── a gentle generative melody: soft plucked pentatonic notes over the pad,
    // sparse and unhurried, through a warm lowpass + a touch of delay ──
    musicBus = AC.createGain(); musicBus.gain.value = 0.0;
    const mLP = AC.createBiquadFilter(); mLP.type = 'lowpass'; mLP.frequency.value = 2200;
    const delay = AC.createDelay(); delay.delayTime.value = 0.34;
    const fb = AC.createGain(); fb.gain.value = 0.28;
    musicBus.connect(mLP); mLP.connect(master);
    mLP.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(master);
    musicBus.gain.linearRampToValueAtTime(0.5, AC.currentTime + 8);
  }
  // A-major pentatonic across two octaves (Hz): A C# E F# A ...
  const _scale = [220, 277.2, 329.6, 370, 440, 554.4, 659.3, 740, 880];
  let _lastNote = 4, _melodyNext = 0;
  function pluck(freq, when, vol) {
    if (!AC || !musicBus) return;
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = 'triangle'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 1.1);
    o.connect(g).connect(musicBus); o.start(when); o.stop(when + 1.2);
  }
  function updateMusic(now, duskK) {
    if (!AC || !musicBus) return;
    if (now < _melodyNext) return;
    // step mostly by small intervals for a singable line; rest sometimes
    if (Math.random() < 0.24) { _melodyNext = now + rand(900, 2200); return; }
    let step = pick([-2, -1, -1, 1, 1, 2, 0]);
    _lastNote = clamp(_lastNote + step, 0, _scale.length - 1);
    const vol = 0.05 + duskK * 0.05;
    pluck(_scale[_lastNote], AC.currentTime, vol);
    // evenings get a soft harmony a third below
    if (duskK > 0.4 && Math.random() < 0.5) pluck(_scale[Math.max(0, _lastNote - 2)], AC.currentTime + 0.02, vol * 0.6);
    _melodyNext = now + rand(560, 1500) * (1 - duskK * 0.2);
  }
  function blip(freq, dur, type, vol) {
    if (!AC) return; const o = AC.createOscillator(), g = AC.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, AC.currentTime); g.gain.exponentialRampToValueAtTime(vol || 0.18, AC.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + (dur || 0.18));
    o.connect(g).connect(master || AC.destination); o.start(); o.stop(AC.currentTime + (dur || 0.18) + 0.02);
  }
  function toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 1;
    toast(muted ? '🔇 Muted' : '🔊 Sound on', '#9fd0ff');
  }
  const sfxPick = () => { blip(540, 0.12, 'triangle', 0.16); setTimeout(() => blip(740, 0.14, 'triangle', 0.14), 70); };
  const sfxDeliver = () => { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.16, 'triangle', 0.16), i * 70)); };
  const sfxBonus = () => { [784, 988, 1318].forEach((f, i) => setTimeout(() => blip(f, 0.12, 'square', 0.1), i * 55)); };
  const sfxHazard = () => { blip(150, 0.22, 'sawtooth', 0.18); setTimeout(() => blip(96, 0.28, 'sawtooth', 0.16), 80); };
  const sfxCoin = () => { blip(1320, 0.06, 'square', 0.06); setTimeout(() => blip(1760, 0.09, 'square', 0.05), 55); };
  const sfxTick = () => blip(880, 0.03, 'triangle', 0.04);
  const sfxStep = () => {                    // surface-aware footsteps
    const ly = world.layout;
    let surf = P.pos.y > 0.1 ? 'stone' : 'asphalt';
    if (ly && ((Math.abs(P.pos.x - ly.park.x) < ly.park.hw && Math.abs(P.pos.z - ly.park.z) < ly.park.hd) ||
               (Math.abs(P.pos.x - ly.green.x) < ly.green.hw && Math.abs(P.pos.z - ly.green.z) < ly.green.hd))) surf = 'grass';
    if (surf === 'grass') blip(rand(85, 115), 0.075, 'triangle', 0.032);
    else if (surf === 'stone') blip(rand(215, 255), 0.04, 'sine', 0.05);
    else blip(rand(150, 195), 0.05, 'sine', 0.045);
  };

  /* ── input — camera-relative: push a direction on screen, walk that way ── */
  const keys = {};
  addEventListener('keydown', e => {
    keys[e.code] = true; initAudio();
    if (e.code === 'KeyM') toggleMute();
    if (e.code === 'KeyO' && begun) { reducedMotion = reducedMotion ? 0 : 1; lsSet('fly_reduced', reducedMotion);
      toast(reducedMotion ? '♿ Movimiento reducido' : 'Movimiento normal', '#3a7d99'); }
    if (e.code === 'KeyE' && begun && !offer) {
      if (shopOpen) toggleShop(false);
      else if (ridingTram) hopOffTram();
      else if (bazarAddr && !onBike && Math.hypot(bazarAddr.pos.x - P.pos.x, bazarAddr.pos.z - P.pos.z) < 6) toggleShop(true);
      else if (!onBike && nearestTram() ) hopOnTram(nearestTram());
      else if (onBike) dismountBike();
      else if (Math.hypot(bike.position.x - P.pos.x, bike.position.z - P.pos.z) < 2.4) mountBike();
    }
    if (e.code === 'KeyB' && onBike) { blip(1560, 0.09, 'square', 0.09); setTimeout(() => blip(1560, 0.13, 'square', 0.08), 140); }
    if (e.code === 'KeyP' && begun) {
      const on = hud.classList.toggle('photo');
      if (!on) toast('📷', '#3a7d99');
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('pointerdown', initAudio, { once: true });

  let tSX = 0, tSY = 0, tRun = 0;     // touch stick vector (screen space) + run button
  const stick = document.getElementById('stick'), knob = document.getElementById('knob');
  let sid = null, scx = 0, scy = 0;
  if (stick) {
    stick.addEventListener('pointerdown', e => { sid = e.pointerId; const r = stick.getBoundingClientRect(); scx = r.left + r.width / 2; scy = r.top + r.height / 2; stick.setPointerCapture(e.pointerId); initAudio(); });
    stick.addEventListener('pointermove', e => { if (e.pointerId !== sid) return; let dx = e.clientX - scx, dy = e.clientY - scy; const R = 50, len = Math.hypot(dx, dy); if (len > R) { dx *= R / len; dy *= R / len; } knob.style.transform = `translate(${dx}px,${dy}px)`; tSX = dx / R; tSY = -dy / R; });
    const end = e => { if (e.pointerId !== sid) return; sid = null; tSX = tSY = 0; knob.style.transform = 'translate(0,0)'; };
    stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
  }
  // the old ascend/descend flight buttons: ▲ becomes RUN, ▼ is retired
  const btnRun = document.getElementById('btnUp'), btnDn = document.getElementById('btnDn');
  if (btnDn) btnDn.style.display = 'none';
  if (btnRun) {
    btnRun.textContent = '⚡'; btnRun.style.bottom = '40px';
    btnRun.addEventListener('pointerdown', e => { e.preventDefault(); tRun = 1; initAudio(); });
    btnRun.addEventListener('pointerup', () => tRun = 0); btnRun.addEventListener('pointercancel', () => tRun = 0);
  }

  /* ── WEATHER: a passing drizzle every few days; umbrellas pop, streets darken ── */
  let raining = false, rainT = 0, rainNext = rand(50, 110);
  const rainGroup = new T.Group(); rainGroup.visible = false; scene.add(rainGroup);
  { rainGroup.traverse(o => o.layers && o.layers.set(1)); rainGroup.layers.set(1); }
  const RAIN_N = 260;
  const rainDrops = [];
  const dropGeo = new T.CylinderGeometry(0.02, 0.02, 1.1, 3);
  const dropMat = new T.MeshBasicMaterial({ color: 0x9fccd6, transparent: true, opacity: 0.7 });
  const RAIN_R = 11;                        // concentrate the volume so it reads
  for (let i = 0; i < RAIN_N; i++) {
    const m = new T.Mesh(dropGeo, dropMat); m.layers.set(1);
    m.rotation.z = 0.16;                    // wind slant
    m.position.set(rand(-RAIN_R, RAIN_R), rand(0, 13), rand(-RAIN_R, RAIN_R));
    rainGroup.add(m); rainDrops.push(m);
  }
  function startRain() {
    raining = true; rainT = 0; rainGroup.visible = true;
    toast('🌧 Empieza a llover…', '#3a7d99');
    if (windGain) {}   // (wind bed already tracks)
  }
  function stopRain() {
    raining = false; rainGroup.visible = false;
    toast('🌤 Escampó', '#c8862a');
  }
  function updateWeather(dt, now) {
    if (!raining) {
      rainNext -= dt;
      if (rainNext <= 0) { startRain(); rainNext = rand(90, 180); }
    } else {
      rainT += dt;
      if (rainT > rand(35, 55) || rainT > 55) stopRain();
      rainGroup.position.set(P.pos.x, 0, P.pos.z);
      for (let ri = 0; ri < rainDrops.length; ri++) {
        const m = rainDrops[ri];
        m.visible = !(reducedMotion && (ri & 1));      // half the drops in reduced mode
        m.position.y -= 20 * dt;
        m.position.x += 3.2 * dt;               // wind-blown slant
        if (m.position.y < -0.5) { m.position.set(rand(-RAIN_R, RAIN_R), rand(9, 13), rand(-RAIN_R, RAIN_R)); }
      }
    }
    // grade responds: overcast pulls saturation/exposure down a touch
    if (ctx.composer && gradeU) {
      const t = raining ? Math.min(1, rainT / 3) : Math.max(0, 1 - (now - 0) * 0);
      const target = raining ? 1 : 0;
      gradeBlend += (target - gradeBlend) * L.dampT(dt, 1.5);
    }
  }

  /* ── FX ── */
  const fxPool = []; const fxGeo = new T.SphereGeometry(0.12, 6, 5);
  function fxBurst(pos, cols, n, h) {
    cols = cols || [0x7fe0a0, 0xffd060, 0xffffff, 0xff9a6a];
    const cnt = n || 18, yy = h == null ? 2.8 : h;
    for (let i = 0; i < cnt; i++) {
      let p = fxPool.find(x => !x.mesh.visible);
      if (!p) { p = { mesh: new T.Mesh(fxGeo, new T.MeshBasicMaterial({ transparent: true })) }; p.mesh.layers.set(1); L.curve(p.mesh.material); scene.add(p.mesh); fxPool.push(p); }
      p.mesh.visible = true; p.mesh.material.color.setHex(pick(cols)); p.mesh.material.opacity = 1;
      p.mesh.position.set(pos.x, yy, pos.z);
      const a = Math.random() * TAU, up = rand(2, 5), sp = rand(2, 5);
      p.vel = new T.Vector3(Math.cos(a) * sp, up, Math.sin(a) * sp); p.life = 1;
    }
  }
  function updateFX(dt) { for (const p of fxPool) { if (!p.mesh.visible) continue; p.life -= dt * 1.4; if (p.life <= 0) { p.mesh.visible = false; continue; } p.vel.y -= 9 * dt; p.mesh.position.addScaledVector(p.vel, dt); p.mesh.material.opacity = p.life; p.mesh.scale.setScalar(0.5 + p.life * 0.8); } }

  /* ── HAZARD: moving traffic. Crossing the street carelessly gets you bumped —
     brief stun, shoved out of the lane, combo broken, a little time lost.
     (Replaces the old airborne-balloon system left over from the flying build,
     which could never reach a walking courier.) ── */
  const TRAFFIC = world.traffic || [];
  function checkTraffic() {
    if (stun > 0 || ridingTram) return;
    for (const car of TRAFFIC) {
      const d = car.userData.drive; if (!d || !d.hl) continue;
      const hx = (d.axis === 'x' ? d.hl : d.hw) + 0.45, hz = (d.axis === 'x' ? d.hw : d.hl) + 0.45;
      const dx = P.pos.x - car.position.x, dz = P.pos.z - car.position.z;
      if (Math.abs(dx) < hx && Math.abs(dz) < hz) {
        stun = 0.9; P.speed = 0;
        // shove the courier out of the lane, perpendicular to travel
        if (d.axis === 'x') P.pos.z = car.position.z + (dz >= 0 ? 1 : -1) * (hz + 1.0);
        else P.pos.x = car.position.x + (dx >= 0 ? 1 : -1) * (hx + 1.0);
        fxBurst(P.pos, [0xff6b6b, 0xffd166, 0xffffff], 14, 1.2);
        sfxHazard(); blip(392, 0.25, 'square', 0.12);   // honk
        if (carrying && fragile && !gustLoose) {
          carrying = false; carriedLetter.visible = false; setObjective();
          elSub.textContent = '💥 se rompió — vuelve a por otra';
          setTimeout(() => toast('💥 ¡La tarta! Vuelve a por otra…', '#c04434'), 500);
        }
        breakCombo('🚗 Bumped by traffic!');
        if (jobActive) jobLeft = Math.max(2, jobLeft - 4);
        break;
      }
    }
  }

  /* ── combo helpers ── */
  function breakCombo(msg) {
    if (combo > 1 || streak > 0) toast(msg || 'Combo lost', '#ff9a8a');
    combo = 1; comboTimer = 0; streak = 0;
  }

  /* ── loop ── */
  const camPos = camera.position.clone().set(0, 6, -10);
  const fwd = new T.Vector3(), camF = new T.Vector3();
  let mapAcc = 0, walkPhase = 0, lastStep = -1;
  let chimeIn = 35, lastTramBell = -1e9;   // ambience timers (clock bell / tram ding)
  let mapAcc2 = 0;
  const baseFov = camera.fov;
  const hintEl = document.querySelector('#hint');
  if (hintEl) hintEl.textContent = IS_TOUCH ? 'drag to walk · hold ⚡ to run' : 'WASD walk · Shift run · E bici · Tab mapa · L recados · P foto · M mute · O accesib.';

  /* ── start card — the town idles behind it; first input begins the shift ── */
  beam.visible = ring.visible = objLetter.visible = false;
  elLbl.textContent = 'Welcome to'; elDst.textContent = 'Villa Mott'; elSub.textContent = 'the town is waking up…';
  const startEl = document.createElement('div'); startEl.id = 'flyStart';
  const returning = totalDeliv > 0;
  const standing = returning
    ? '<div class="stand">✦ ' + rankName(totalDeliv) + '  ·  Día ' + dayNum + '<br>'
      + '🪙 ' + coins + '  ·  ✉ ' + lostCount() + '/10  ·  📜 ' + CHAINS.filter(c => chainDone(c)).length + '/' + CHAINS.length
      + (heroDone ? '<br>🎖 Héroe de Villa Mott' : '') + '</div>'
    : '';
  startEl.innerHTML = '<div class="card"><div class="t">THE FLY</div><div class="s">' + (returning ? 'bienvenido de vuelta a Villa Mott' : 'a tiny courier tale') + '</div>'
    + standing
    + '<div class="c">' + (IS_TOUCH ? 'drag to walk · hold ⚡ to run' : 'WASD walk · SHIFT run · E bici · Tab mapa') + '</div>'
    + '<div class="go">' + (IS_TOUCH ? (returning ? 'toca para continuar' : 'toca para empezar') : (returning ? 'pulsa para continuar el día ' + dayNum : 'press any key to start')) + '</div></div>';
  hud.appendChild(startEl);
  function begin() {
    if (begun) return; begun = true;
    startEl.classList.add('gone'); setTimeout(() => startEl.remove(), 700);
    initAudio(); newTask();
  }
  addEventListener('keydown', begin);
  startEl.addEventListener('pointerdown', e => { e.preventDefault(); begin(); });

  function update(dt, now) {
    // stun briefly disables steering input (player got bumped)
    const stunned = stun > 0;
    if (stunned) stun -= dt;

    /* camera-relative input: the pushed direction is where the courier goes */
    let ix = tSX, iy = tSY;
    if (keys['KeyW'] || keys['ArrowUp']) iy += 1;
    if (keys['KeyS'] || keys['ArrowDown']) iy -= 1;
    if (keys['KeyA'] || keys['ArrowLeft']) ix -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) ix += 1;
    let mag = Math.hypot(ix, iy);
    if (mag > 1) { ix /= mag; iy /= mag; mag = 1; }
    const running = keys['ShiftLeft'] || keys['ShiftRight'] || tRun > 0;
    if (stunned || !begun || reporting || shopOpen || bigOpen) mag = 0;
    if (bigOpen && mapAcc2 > 0.2) { mapAcc2 = 0; drawBigMap(); } mapAcc2 += dt;

    if (mag > 0.05) {
      // screen-up = camera-forward; screen-right for heading θ is (-cosθ, 0, sinθ)
      // in this right-handed Y-up world, so the X input must be NEGATED here —
      // atan2(+ix, iy) mirrors left/right.
      const wishYaw = camYaw + Math.atan2(-ix, iy);
      let dy = wishYaw - P.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      P.yaw += dy * L.dampT(dt, onBike ? 5.5 : 11);           // bikes carve wide arcs
      // camera settles behind scaled by alignment (cos dc): full chase when
      // running away from it, none on a pure strafe or reversal — otherwise the
      // chase rotates the input frame and straight lines become circles
      let dc = P.yaw - camYaw; dc = Math.atan2(Math.sin(dc), Math.cos(dc));
      camYaw += dc * L.dampT(dt, 2.6) * Math.max(0, Math.cos(dc));
    }
    const maxSpd = onBike ? 8.8 : (running ? RUN : WALK);
    P.speed = lerp(P.speed, mag * maxSpd, L.dampT(dt, onBike ? 4.5 : ACCEL));
    fwd.set(Math.sin(P.yaw), 0, Math.cos(P.yaw));
    P.pos.x += fwd.x * P.speed * dt; P.pos.z += fwd.z * P.speed * dt;
    if (ridingTram) {
      // hanging off the running board: the tram does the work
      const d3 = ridingTram.userData.drive;
      P.pos.x = ridingTram.position.x - (d3.dir > 0 ? 2.2 : -2.2);
      P.pos.z = ridingTram.position.z + tramSide * 1.55;
      P.yaw = d3.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      P.speed = 0;
      if (mag > 0.4) hopOffTram();                            // push any direction to drop off
    }
    P.pos.x = clamp(P.pos.x, bounds.minX, bounds.maxX);
    P.pos.z = clamp(P.pos.z, bounds.minZ, bounds.maxZ);
    if (!ridingTram) resolveStatic();                         // solid town
    // townsfolk are soft: brushing past nudges both of you apart (no hard walls)
    for (const n of NPCS) {
      const u = n.userData.npc;
      if (u && (u.kind === 'seated' || u.kind === 'vendor' || u.kind === 'posed')) continue;
      const ndx = n.position.x - P.pos.x, ndz = n.position.z - P.pos.z;
      const nd2 = ndx * ndx + ndz * ndz;
      if (nd2 < 0.81 && nd2 > 1e-4) {
        const nd = Math.sqrt(nd2), push = (0.9 - nd) * 0.5, ux = ndx / nd, uz = ndz / nd;
        n.position.x += ux * push; n.position.z += uz * push;
        P.pos.x -= ux * push * 0.4; P.pos.z -= uz * push * 0.4;
      }
    }
    const gy = groundAt(P.pos.x, P.pos.z);                    // ride on sidewalks/plaza
    P.pos.y = lerp(P.pos.y, gy, L.dampT(dt, 14));
    const spd01 = Math.min(1, Math.abs(P.speed) / RUN);
    const moving = Math.abs(P.speed) > 0.2;

    // place + animate the human (true pos drives world reactions: NPC waves, pigeon scatter)
    player.pos.copy(P.pos);
    hero.position.set(P.pos.x, P.pos.y, P.pos.z);   // (y adjusted below when riding)
    hero.rotation.set(0, 0, 0); hero.rotateY(P.yaw);
    if (stunned) hero.rotateZ(Math.sin(now * 0.04) * 0.2);
    walkPhase += dt * (moving && !onBike ? (5 + spd01 * 7) : 0);
    C.animateWalk(hero, walkPhase, moving && !onBike);
    if (moving && !onBike) { const fp = Math.floor(walkPhase / Math.PI); if (fp !== lastStep) { lastStep = fp; sfxStep(); } }
    else if (moving && onBike && Math.random() < dt * 2.2 * spd01) blip(1150, 0.02, 'square', 0.014);   // chain tick
    hero.position.y = P.pos.y + (onBike ? 0.24 : 0);           // perched on the saddle
    if (onBike) bike.position.y = -0.24;
    // scarf tail trails and flutters with speed (the brand accent in motion)
    const st = hero.userData.scarfTail;
    if (st) st.rotation.x = -(0.45 + spd01 * 0.9 + Math.sin(now * 0.02) * (0.05 + spd01 * 0.14));
    // secondary motion: lean into the run (the pack and hood ride the torso)
    const tor = hero.userData.torso, ga = hero.userData.gait;
    if (tor && ga) tor.rotation.x = ga.baseRX + spd01 * 0.16;
    // HEAD-TURN: glance toward the current objective (or the loose letter), clamped
    const hg = hero.userData.headGrp;
    if (hg) {
      const _lt = carrying ? dropoff : pickup;
      const look = gustLoose ? gustPos : (_lt && _lt.pos ? _lt.pos : null);
      let wantYaw = 0, wantPitch = 0;
      if (look && !reporting) {
        const bearing = Math.atan2(look.x - P.pos.x, look.z - P.pos.z);
        let rel = bearing - P.yaw; rel = Math.atan2(Math.sin(rel), Math.cos(rel));
        wantYaw = clamp(rel, -0.7, 0.7);                       // don't crank the neck past a glance
        const d2t = Math.hypot(look.x - P.pos.x, look.z - P.pos.z);
        if (d2t < 6) wantPitch = clamp(((look.y || 0) + 1.4 - (P.pos.y + 1.5)) / Math.max(2, d2t), -0.35, 0.4);
      }
      hg.rotation.y = lerp(hg.rotation.y, wantYaw, L.dampT(dt, 6));
      hg.rotation.x = lerp(hg.rotation.x, wantPitch + Math.sin(now * 0.0013) * 0.03, L.dampT(dt, 5));
    }
    // SQUASH-AND-STRETCH: a springy pop on pickup/deliver
    if (squash > 0) {
      squash = Math.max(0, squash - dt * 3.4);
      const s = Math.sin(squash * Math.PI);        // 0→peak→0
      hero.scale.set(1 - s * 0.14, 1 + s * 0.2, 1 - s * 0.14);
    } else if (hero.scale.y !== 1) hero.scale.set(1, 1, 1);
    // one shared breeze clock for every leaf in town
    L.windUniform.value = now * 0.0011;

    // contact shadow under the feet
    blob.position.set(P.pos.x, P.pos.y + 0.05, P.pos.z); blob.scale.setScalar(0.7); blob.material.opacity = 0.3;

    // third-person follow camera — tracks the smoothed camera yaw, not the hero,
    // so quick turns read as the character turning inside the frame
    camF.set(Math.sin(camYaw), 0, Math.cos(camYaw));
    const camDist = 5.4 + spd01 * 1.2, camH = 2.9, lead = 3.2;
    const desired = camPos.set(P.pos.x - camF.x * camDist, P.pos.y + camH, P.pos.z - camF.z * camDist);
    // line-of-sight: if a big solid sits between courier and camera, pull the camera in
    let tC = 1;
    for (let t = 0.3; t <= 1.001; t += 0.1) {
      if (occluded(P.pos.x + (desired.x - P.pos.x) * t, P.pos.z + (desired.z - P.pos.z) * t)) { tC = Math.max(0.25, t - 0.1); break; }
    }
    if (tC < 1) desired.set(P.pos.x + (desired.x - P.pos.x) * tC, desired.y - (1 - tC) * 0.6, P.pos.z + (desired.z - P.pos.z) * tC);
    resolveCircle(desired, 0.4);   // and never wedge inside geometry
    camera.position.lerp(desired, L.dampT(dt, 6));
    camera.lookAt(P.pos.x + camF.x * lead, P.pos.y + 1.3, P.pos.z + camF.z * lead);
    const wantFov = baseFov + (running ? spd01 * 4 : 0);
    if (Math.abs(camera.fov - wantFov) > 0.05) { camera.fov = lerp(camera.fov, wantFov, L.dampT(dt, 3)); camera.updateProjectionMatrix(); }

    // wind volume tracks speed
    if (windGain) windGain.gain.value = lerp(windGain.gain.value, 0.006 + Math.abs(P.speed) / RUN * 0.02, L.dampT(dt, 3));

    /* ── place-based ambience ── */
    // fountain splash swells as you approach the plaza heart (fountain at 0,14)
    if (fountainGain) {
      const dF = Math.hypot(P.pos.x, P.pos.z - 14);
      const want = Math.pow(clamp(1 - dF / 26, 0, 1), 1.5) * 0.05;
      fountainGain.gain.value = lerp(fountainGain.gain.value, want, L.dampT(dt, 4));
    }
    // the sea washes in from the east, swelling and receding
    if (seaGain) {
      const wantSea = Math.pow(clamp((P.pos.x - 118) / 46, 0, 1), 1.4) * 0.045 * (0.7 + 0.3 * Math.sin(now * 0.0008));
      seaGain.gain.value = lerp(seaGain.gain.value, wantSea, L.dampT(dt, 3));
    }
    // clock tower marks time — two soft bells if you're near enough to hear
    chimeIn -= dt;
    if (chimeIn <= 0) {
      chimeIn = 90;
      if (AC && Math.hypot(P.pos.x, P.pos.z - 41) < 75) {
        blip(587, 1.1, 'sine', 0.07);
        setTimeout(() => blip(494, 1.6, 'sine', 0.06), 950);
      }
    }
    // tram dings its bell as it passes close
    if (AC && now - lastTramBell > 7000) {
      for (const car of TRAFFIC) {
        const dr = car.userData.drive;
        if (!dr || !(dr.hl > 4)) continue;   // trams only
        if (Math.hypot(car.position.x - P.pos.x, car.position.z - P.pos.z) < 14) {
          lastTramBell = now;
          blip(988, 0.16, 'square', 0.055); setTimeout(() => blip(988, 0.22, 'square', 0.05), 190);
          break;
        }
      }
    }

    if (!begun) { mapAcc += dt; if (mapAcc > 0.08) { mapAcc = 0; drawMap(); } updateFX(dt); return; }

    // job-offer countdown (auto-picks the first card so the flow never stalls)
    if (offer) {
      offer.t -= dt;
      offerBar.firstElementChild.style.width = (clamp(offer.t / 9, 0, 1) * 100).toFixed(1) + '%';
      if (offer && offer.t <= 0) chooseJob(0);
    }
    const choosing = !!offer;

    /* the loose letter: flies out on the gust arc, then flutters until caught */
    if (gustPending && carrying && !choosing && now > gustAt) triggerGust(now);
    if (gustLoose) {
      gustT = Math.min(1, gustT + dt * 0.9);
      const gx = gustFrom.x + (gustPos.x - gustFrom.x) * gustT;
      const gz = gustFrom.z + (gustPos.z - gustFrom.z) * gustT;
      const gy2 = gustGy + 1.1 + Math.sin(gustT * Math.PI) * 2.2 + (gustT >= 1 ? Math.sin(now * 0.004) * 0.18 : 0);
      objLetter.position.set(gx, gy2, gz);
      objLetter.rotation.y += dt * 6; objLetter.rotation.z = Math.sin(now * 0.006) * 0.4;
      const rdx = P.pos.x - gustPos.x, rdz = P.pos.z - gustPos.z;
      if (gustT >= 1 && rdx * rdx + rdz * rdz < 3.2) {
        gustLoose = false; objLetter.rotation.z = 0;
        carriedLetter.visible = true; setObjective();
        toast('✉ ¡Recuperada!', '#4d8a52'); sfxPick();
      }
    }

    // markers
    const tg = gustLoose ? { pos: gustPos, gy: gustGy } : (carrying ? dropoff : pickup);
    beam.rotation.y += dt * 0.4; ring.scale.setScalar(1 + Math.sin(now * 0.004) * 0.08);
    if (!gustLoose) { objLetter.rotation.y += dt * 1.5; objLetter.position.y = (tg && tg.gy || 0) + 3.6 + Math.sin(now * 0.003) * 0.25; }

    const dx = P.pos.x - tg.pos.x, dz = P.pos.z - tg.pos.z, dPlanar = Math.hypot(dx, dz);
    elDist.textContent = (!choosing && dPlanar < 90) ? Math.round(dPlanar) + ' m' : '—';
    // needle is relative to the CAMERA (what the player sees), not the hero's body
    const bearing = Math.atan2(tg.pos.x - P.pos.x, tg.pos.z - P.pos.z);
    if (!choosing) elNeedle.style.transform = `rotate(${camYaw - bearing}rad)`;

    /* ── timer + combo decay ── */
    if (jobActive) {
      jobLeft -= dt;
      const frac = clamp(jobLeft / jobBudget, 0, 1);
      elTimerT.textContent = Math.max(0, jobLeft).toFixed(1) + 's';
      elTimerBar.style.width = (frac * 100).toFixed(1) + '%';
      const low = jobLeft < 5;
      elTimerT.style.color = low ? '#c04434' : '#2c261c';
      elTimerBar.style.background = low ? '#c04434' : (frac > 0.5 ? '#4d8a52' : '#c8862a');
      if (low && Math.floor(jobLeft + dt) !== Math.floor(jobLeft) && jobLeft > 0) blip(660, 0.06, 'square', 0.08);
      if (jobLeft <= 0) {
        // ran out of time: no points, combo broken, fresh job
        jobActive = false;
        breakCombo('⏱ Out of time');
        sfxHazard();
        newTask();
      }
    }
    if (comboTimer > 0) {
      comboTimer -= dt;
      elComboBar.style.width = (clamp(comboTimer / COMBO_WINDOW, 0, 1) * 100).toFixed(1) + '%';
      if (comboTimer <= 0 && combo > 1) breakCombo('Combo cooled off');
    }
    // combo HUD
    if (combo > 1) { comboEl.classList.add('on'); elComboM.textContent = 'x' + combo; }
    else comboEl.classList.remove('on');

    /* ── pick-up / deliver ── */
    if (!choosing && dPlanar < 4.5) {
      if (!carrying) {
        carrying = true; carriedLetter.visible = true; squash = 1; toast('✉ Letter picked up', '#c8862a'); sfxPick(); setObjective();
        if (!curStory && !fragile && jobBudget > 18 && L.chance(0.3 + dayDiff() * 0.12)) { gustPending = true; gustAt = now + rand(3500, 8500); }
        else if (!curStory && !fragile && !gustPending && delivered >= 4 && L.chance(0.28 + dayDiff() * 0.12)) startRace(dropoff);
        if (curStory) say(pickup.name, curStory.pick);
        else bubble(tg.pos.x, (tg.gy || 0) + 3.4, tg.pos.z, pick(QUIPS_PICKUP));
      } else if (!gustLoose) {
        if (R.active && !R.done) { R.done = true; endRace(true); }
        if (curStory) say(dropoff.name, curStory.drops[Math.min(chainProg[curStory.id] || 0, curStory.drops.length - 1)]);
        else bubble(tg.pos.x, (tg.gy || 0) + 3.4, tg.pos.z, pick(QUIPS_DELIVER));
        deliver(tg);
      }
    }

    // discoverability: a whisper when a ride is available
    if (!ridingTram && !onBike && nearestTram()) {
      if (!(tipsSeen & TIP_BITS.tram)) tipOnce('tram', '🚋 E — engánchate al tranvía (¡gratis!)');
      else if (now % 4000 < 20) toast('🚋 E', '#3a7d99');
    }

    /* idle townsfolk quips — someone nearby says something small */
    quipCd -= dt;
    if (quipCd <= 0) {
      quipCd = 0.6;
      for (const n of NPCS) {
        const u = n.userData.npc;
        if (!u || u.kind === 'seated') continue;
        const dx2 = n.position.x - P.pos.x, dz2 = n.position.z - P.pos.z;
        if (dx2 * dx2 + dz2 * dz2 < 12) {
          const line = u.name ? (u.name + ': ' + pick(PERSONA[u.name] || QUIPS_STREET)) : pick(QUIPS_STREET);
          bubble(n.position.x, n.position.y + 2.05, n.position.z, line, u.name ? 3.0 : 2.4);
          quipCd = rand(7, 12); break;
        }
      }
    }

    checkTraffic();
    updateFX(dt);
    updateBubbles(dt);
    updateDlg(dt);
    updateLost(dt, now);
    updateFestival(dt, now);
    updateWeather(dt, now);
    updateRival(dt, now);
    if (R.active) C.animateWalk(rival, now * 0.012, true);
    const dayFrac = clamp((dayDeliv + (jobActive ? (1 - clamp(jobLeft / Math.max(1, jobBudget), 0, 1)) * 0.5 : 0)) / DAY_LEN, 0, 1);
    tod += (dayFrac - tod) * L.dampT(dt, 0.5);
    applyTOD(reporting ? 1 : tod);
    updateMusic(now, tod);
    updateTips(dt);
    if (gradeU) {
      gradeU.uSat.value = gradeSatBase * (1 - gradeBlend * 0.28);
      gradeU.uVig.value = gradeVigBase + gradeBlend * 0.14 + tod * 0.06;
      // speed lines: ramp in above ~65% top speed; go gold when the combo's hot
      const fast = reducedMotion ? 0 : clamp((spd01 - 0.62) / 0.38, 0, 1) * (onBike ? 1 : 0.85);
      gradeU.uSpeed.value = lerp(gradeU.uSpeed.value, fast * 0.5, L.dampT(dt, 8));
      gradeU.uSpeedCol.value.setHex(combo >= 3 ? 0xffe4a0 : 0xffffff);
    }

    // minimap (throttled ~12fps)
    mapAcc += dt;
    if (mapAcc > 0.08) { mapAcc = 0; drawMap(); }
  }

  function deliver(tg) {
    delivered++; squash = 1;
    jobActive = false;
    // speed/time bonus: more left on the clock = more points
    const timeFrac = clamp(jobLeft / jobBudget, 0, 1);
    const speedy = timeFrac > 0.55;
    const base = 100;
    const timeBonus = Math.round(timeFrac * 150);
    // combo: a quick delivery (with time to spare) builds the streak
    if (speedy) {
      streak++; const prevCombo = combo; combo = clamp(combo + 1, 1, 8); comboTimer = COMBO_WINDOW;
      if (combo > prevCombo && combo >= 3) { fxBurst(P.pos, [0xffe4a0, 0xffffff, 0xffd27a], 10 + combo * 2, P.pos.y + 1.6); }
    }
    else { comboTimer = COMBO_WINDOW * 0.6; } // keep current combo alive briefly even on a slow drop
    const gained = Math.round((base + timeBonus) * combo * ((express || fragile) ? 2 : 1));
    score += gained;
    elScore.textContent = score;

    sfxDeliver();
    fxBurst(tg.pos, null, 18, (tg.gy || 0) + 2.8);
    if (combo > 1) { fxBurst(tg.pos, [0xffd060, 0xffffff, 0xff9a6a], 12, 3.6); sfxBonus(); }

    const tip = (express ? '⚡ ' : '') + (combo > 1
      ? '★ Delivered! +' + gained + '  (x' + combo + ')'
      : '★ Delivered! +' + gained);
    toast(tip, combo > 2 ? '#ffd27a' : '#7fe0a0');

    // contextual feedback for fast / milestone runs
    if (speedy && timeFrac > 0.78) setTimeout(() => toast('⚡ Express run!', '#9fd0ff'), 700);
    else if (combo >= 4) setTimeout(() => toast('🔥 On fire — x' + combo + '!', '#ff9a6a'), 700);

    // story-chain progress (capture the ref: curStory is nulled below, before
    // the delayed toast closure fires)
    if (curStory) {
      const cs = curStory;
      chainProg[cs.id] = Math.min((chainProg[cs.id] || 0) + 1, cs.steps);
      dayStories++;
      saveChains(); renderLog();
      if (chainDone(cs)) {
        score += 400; elScore.textContent = score;
        setTimeout(() => { toast('📜 ¡Historia completada! +400', '#c8862a'); sfxBonus(); checkCompletion(); }, 800);
      } else {
        setTimeout(() => toast('📜 ' + cs.name + ' (' + chainProg[cs.id] + '/' + cs.steps + ')', '#c8862a'), 800);
      }
      curStory = null;
    }

    // persist bests + lifetime rank (with a little ceremony on promotion)
    const prevRank = rankName(totalDeliv);
    totalDeliv++; lsSet(LS.total, totalDeliv);
    const nowRank = rankName(totalDeliv);
    if (nowRank !== prevRank) {
      setTimeout(() => { toast('✦ ¡Ascenso! — ' + nowRank, '#ffd27a'); sfxBonus(); fxBurst(P.pos, [0xffd060, 0xffffff, 0xff9a6a], 26, 1.6); }, 1200);
      const ni = rankIdx(totalDeliv);
      if (ni < CAPS.length) {
        capSel = ni; lsSet('fly_cap_sel', capSel); applyCap();
        setTimeout(() => toast('🧢 Nueva gorra: ' + CAPS[ni][1] + ' — press C to swap', '#9fd0ff'), 2500);
      }
    }
    if (score > bestScore) { bestScore = score; lsSet(LS.score, bestScore); }
    if (streak > bestStreak) { bestStreak = streak; lsSet(LS.streak, bestStreak); }
    renderBest();

    const coinGain = Math.max(5, Math.round(gained / 10 * (1 + dayDiff() * 0.6)));
    coins += coinGain; dayCoins += coinGain; lsSet('fly_coins', coins);
    setTimeout(sfxCoin, 180);
    dayScore += gained; dayBestCombo = Math.max(dayBestCombo, combo); dayDeliv++;
    renderBest();
    if (dayDeliv >= DAY_LEN) showReport();
    else newTask();
  }

  /* ── MINIMAP rendering ── */
  /* ── FULL TOWN MAP (Tab) — a hand-drawn chart of the whole place ── */
  const bigWrap = document.createElement('div'); bigWrap.id = 'flyBigMap';
  const BIG = 560;
  bigWrap.innerHTML = '<div class="frame"><div class="ttl">VILLA MOTT</div><canvas width="' + BIG + '" height="' + BIG + '"></canvas><div class="tip">Tab / Esc — cerrar</div></div>';
  hud.appendChild(bigWrap);
  const bigCanvas = bigWrap.querySelector('canvas'), bctx = bigCanvas.getContext('2d');
  let bigOpen = false;
  const BPAD = 26;
  function bmapXY(x, z) {
    const u = (x - bounds.minX) / ((bounds.maxX - bounds.minX) || 1);
    const vv = (z - bounds.minZ) / ((bounds.maxZ - bounds.minZ) || 1);
    return [BPAD + u * (BIG - BPAD * 2), BPAD + vv * (BIG - BPAD * 2)];
  }
  function brect(x0w, z0w, x1w, z1w, col) {
    const [ax, ay] = bmapXY(x0w, z0w), [bx, by] = bmapXY(x1w, z1w);
    bctx.fillStyle = col; bctx.fillRect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay));
  }
  function drawBigMap() {
    const g = bctx; g.clearRect(0, 0, BIG, BIG);
    g.fillStyle = '#f4ecd6'; g.fillRect(0, 0, BIG, BIG);
    if (LY) {
      const ROAD = '#d2c6ac';
      brect(-LY.AVX, -LY.SW, LY.AVX, LY.SW, ROAD);
      brect(-LY.AV2X, LY.AV2Z - LY.SW, LY.AV2X, LY.AV2Z + LY.SW, ROAD);
      [LY.CROSSX, LY.CROSSX2].forEach(cx => brect(cx - LY.SW, LY.CROSSZ0, cx + LY.SW, LY.CROSSZ1, ROAD));
      const pk = LY.park, pz = LY.plaza, gr = LY.green;
      brect(pk.x - pk.hw, pk.z - pk.hd, pk.x + pk.hw, pk.z + pk.hd, '#a8c890');
      brect(gr.x - gr.hw, gr.z - gr.hd, gr.x + gr.hw, gr.z + gr.hd, '#a8c890');
      brect(pz.x - pz.hw, pz.z - pz.hd, pz.x + pz.hw, pz.z + pz.hd, '#e2d4b0');
      (LY.hill || []).forEach(h => brect(h.x - h.hw, h.z - h.hd, h.x + h.hw, h.z + h.hd, '#cdbf9a'));
      if (LY.harbor) { brect(LY.harbor.x + LY.harbor.hw, bounds.minZ, bounds.maxX + 30, bounds.maxZ, '#9ed2c6');
        brect(LY.harbor.x - LY.harbor.hw, LY.harbor.z - LY.harbor.hd, LY.harbor.x + LY.harbor.hw, LY.harbor.z + LY.harbor.hd, '#cbb891'); }
    }
    // building footprints
    g.fillStyle = 'rgba(120,110,90,0.5)';
    for (const a of ADDR) { const [px, py] = bmapXY(a.pos.x, a.pos.z); g.fillRect(px - 2, py - 2, 4, 4); }
    // district labels
    g.fillStyle = '#2c261c'; g.textAlign = 'center'; g.font = '15px "Patrick Hand", cursive';
    const labels = [['La Plaza', 0, 26], ['El Parque', -78, -18], ['El Mirador', -78, -50],
                    ['El Puerto', 158, 0], ['2ª Avenida', -30, 64], ['Villa alta', -86, 20]];
    labels.forEach(([nm, x, z]) => { const [px, py] = bmapXY(x, z); g.fillText(nm, px, py); });
    // lost letters (found = gold dot, missing = faint ring)
    LOST_SPOTS.forEach(([x, z], i) => { const [px, py] = bmapXY(x, z);
      if (lostMask & (1 << i)) { g.fillStyle = '#c8a648'; g.beginPath(); g.arc(px, py, 4, 0, TAU); g.fill(); }
      else { g.strokeStyle = 'rgba(180,140,60,.5)'; g.lineWidth = 1.5; g.beginPath(); g.arc(px, py, 4, 0, TAU); g.stroke(); }
    });
    // objective
    const tg = carrying ? dropoff : pickup;
    if (tg && !offer) { const [ox, oy] = bmapXY(tg.pos.x, tg.pos.z);
      g.fillStyle = carrying ? '#4d8a52' : '#c8862a'; g.beginPath(); g.arc(ox, oy, 6, 0, TAU); g.fill();
      g.strokeStyle = '#2c261c'; g.lineWidth = 1.5; g.stroke(); }
    // player
    const [px, py] = bmapXY(P.pos.x, P.pos.z);
    g.save(); g.translate(px, py); g.rotate(Math.atan2(fwd.x, -fwd.z));
    g.fillStyle = '#c04434'; g.beginPath(); g.moveTo(0, -9); g.lineTo(6, 7); g.lineTo(-6, 7); g.closePath(); g.fill();
    g.strokeStyle = '#2c261c'; g.lineWidth = 1.5; g.stroke(); g.restore();
  }
  function toggleBigMap(force) {
    bigOpen = force != null ? force : !bigOpen;
    if (bigOpen) { drawBigMap(); sfxTick(); }
    bigWrap.classList.toggle('on', bigOpen);
  }
  addEventListener('keydown', e => {
    if (e.code === 'Tab' && begun && !shopOpen && !reporting) { e.preventDefault(); toggleBigMap(); }
    else if (e.code === 'Escape' && bigOpen) toggleBigMap(false);
  });

  const spanX = (bounds.maxX - bounds.minX) || 1;
  const spanZ = (bounds.maxZ - bounds.minZ) || 1;
  const PAD = 14;
  function mapXY(x, z) {
    const u = (x - bounds.minX) / spanX, v = (z - bounds.minZ) / spanZ;
    return [PAD + u * (MAPRES - PAD * 2), PAD + v * (MAPRES - PAD * 2)];
  }
  const LY = world.layout;
  function rectWorld(g, x0w, z0w, x1w, z1w, col) {
    const [ax, ay] = mapXY(x0w, z0w), [bx, by] = mapXY(x1w, z1w);
    g.fillStyle = col; g.fillRect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay));
  }
  function drawMap() {
    const g = mctx;
    g.clearRect(0, 0, MAPRES, MAPRES);
    // town footprint
    const [bx0, by0] = mapXY(bounds.minX, bounds.minZ);
    const [bx1, by1] = mapXY(bounds.maxX, bounds.maxZ);
    g.fillStyle = '#eee7d4';
    g.fillRect(bx0, by0, bx1 - bx0, by1 - by0);
    if (LY) {
      const ROAD = '#d2cab6';
      // the real street grid: two avenues + two cross-streets
      rectWorld(g, -LY.AVX, -LY.SW, LY.AVX, LY.SW, ROAD);
      rectWorld(g, -LY.AV2X, LY.AV2Z - LY.SW, LY.AV2X, LY.AV2Z + LY.SW, ROAD);
      [LY.CROSSX, LY.CROSSX2].forEach(cx => rectWorld(g, cx - LY.SW, LY.CROSSZ0, cx + LY.SW, LY.CROSSZ1, ROAD));
      // green spaces + plaza
      const pk = LY.park, pz = LY.plaza, gr = LY.green;
      rectWorld(g, pk.x - pk.hw, pk.z - pk.hd, pk.x + pk.hw, pk.z + pk.hd, '#a4c48c');
      rectWorld(g, gr.x - gr.hw, gr.z - gr.hd, gr.x + gr.hw, gr.z + gr.hd, '#a4c48c');
      rectWorld(g, pz.x - pz.hw, pz.z - pz.hd, pz.x + pz.hw, pz.z + pz.hd, '#e0d4b4');
      (LY.hill || []).forEach(h => rectWorld(g, h.x - h.hw, h.z - h.hd, h.x + h.hw, h.z + h.hd, '#d8cba8'));
      if (LY.harbor) {
        rectWorld(g, LY.harbor.x + LY.harbor.hw, bounds.minZ, bounds.maxX + 30, bounds.maxZ, '#9ed2c6');
        rectWorld(g, LY.harbor.x - LY.harbor.hw, LY.harbor.z - LY.harbor.hd, LY.harbor.x + LY.harbor.hw, LY.harbor.z + LY.harbor.hd, '#cbb891');
      }
    }
    // address dots (the building footprints, abstractly)
    g.fillStyle = 'rgba(120,110,90,0.5)';
    for (const a of ADDR) {
      const [px, py] = mapXY(a.pos.x, a.pos.z);
      g.fillRect(px - 1.4, py - 1.4, 2.8, 2.8);
    }
    // current objective (pulsing)
    const tg = carrying ? dropoff : pickup;
    if (tg) {
      const [ox, oy] = mapXY(tg.pos.x, tg.pos.z);
      const pulse = 5 + Math.sin(performance.now() * 0.006) * 2.5;
      g.fillStyle = carrying ? '#4d8a52' : '#c8862a';
      g.beginPath(); g.arc(ox, oy, pulse, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 1.5; g.stroke();
    }
    // parked bike
    if (!onBike) {
      const [bx2, by2] = mapXY(bike.position.x, bike.position.z);
      g.fillStyle = '#3a7d99'; g.beginPath(); g.arc(bx2, by2, 3, 0, TAU); g.fill();
    }
    // rival during a race
    if (R.active) {
      const [rx, ry2] = mapXY(R.pos.x, R.pos.z);
      g.fillStyle = '#2f6b4a'; g.beginPath(); g.arc(rx, ry2, 3.5, 0, TAU); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 1; g.stroke();
    }
    // player + heading
    const [px, py] = mapXY(P.pos.x, P.pos.z);
    g.save();
    g.translate(px, py);
    // map yaw: canvas +y draws world +Z, so the "up"-pointing triangle needs
    // atan2(x, -z) to aim along the true heading
    g.rotate(Math.atan2(fwd.x, -fwd.z));
    g.fillStyle = stun > 0 ? '#c04434' : '#3a7d99';
    g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(-5, 6); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(44,38,28,0.8)'; g.lineWidth = 1.2; g.stroke();
    g.restore();
  }

  return { update, debug: {
    P,
    get pickup() { return pickup; }, get dropoff() { return dropoff; },
    get carrying() { return carrying; }, get score() { return score; },
    get stun() { return stun; }, get express() { return express; },
    get offer() { return offer; }, chooseJob,
    get capSel() { return capSel; }, get totalDeliv() { return totalDeliv; },
    get camYaw() { return camYaw; }, set camYaw(v) { camYaw = v; },
    get onBike() { return onBike; }, get bikePos() { return bike.position; },
    get gustLoose() { return gustLoose; }, get gustPos() { return gustPos; },
    forceGust() { if (carrying) triggerGust(performance.now()); },
    get dayDeliv() { return dayDeliv; }, set dayDeliv(v) { dayDeliv = v; },
    get dayNum() { return dayNum; }, get reporting() { return reporting; },
    lostCount, get fragile() { return fragile; },
    get raining() { return raining; }, forceRain() { startRain(); },
    get heroDone() { return heroDone; }, forceFinale() { heroDone = 0; lsSet('fly_hero', 0); for (const c of CHAINS) chainProg[c.id] = c.steps; lostMask = 1023; checkCompletion(); },
    get festival() { return festival > 0; },
    get racing() { return R.active; }, forceRace() { startRace(dropoff); }, get rivalPos() { return R.pos; },
    get coins() { return coins; }, set coins(v) { coins = v; },
    get ridingTram() { return !!ridingTram; }, get shopOpen() { return shopOpen; },
    nearestTram: () => !!nearestTram(),
    begin,
  } };
}

FLY.game = { start };
})();
