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

  /* ── player (walking human courier) ── */
  const hero = (C.makeHero ? C.makeHero() : C.makeFly()); scene.add(hero);
  // FX / HUD markers live on layer 1 so the ink-outline normal pass skips them
  const toFx = obj => obj.traverse(c => c.layers.set(1));
  const blob = new T.Mesh(new T.CircleGeometry(0.8, 20), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.26, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; scene.add(blob); toFx(blob);

  // carried letter on the fly
  const letterMat = L.std({ color: 0xf4ecd6, roughness: 0.7 });
  const carriedLetter = new T.Group();
  { const env = L.box(0.4, 0.28, 0.05, letterMat, { cast: false });
    env.add(L.box(0.1, 0.1, 0.01, L.std({ color: 0xc0463e, roughness: 0.7 }), { x: 0.12, y: 0.07, z: 0.03, cast: false }));
    carriedLetter.add(env); }
  carriedLetter.visible = false; carriedLetter.position.set(0.34, 1.05, 0.3); hero.add(carriedLetter); toFx(carriedLetter);

  /* ── objective markers ── */
  const beam = new T.Mesh(new T.CylinderGeometry(1.1, 1.5, 30, 16, 1, true), new T.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0.26, depthWrite: false, side: T.DoubleSide }));
  scene.add(beam); toFx(beam); L.curve(beam.material);
  const ring = new T.Mesh(new T.TorusGeometry(1.6, 0.13, 8, 28), new T.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0.85, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; scene.add(ring); toFx(ring); L.curve(ring.material);
  const objLetter = new T.Group();
  { const env = L.box(0.9, 0.62, 0.1, letterMat);
    env.add(L.box(0.9, 0.34, 0.01, L.std({ color: 0xdcd0b0, roughness: 0.7 }), { y: 0.05, z: 0.052, cast: false }));
    env.add(L.box(0.22, 0.22, 0.01, L.std({ color: 0xc0463e, roughness: 0.7, emissive: 0x802820, emissiveIntensity: 0.2 }), { x: 0.26, y: 0.13, z: 0.053, cast: false }));
    objLetter.add(env); }
  scene.add(objLetter); toFx(objLetter);

  /* ── HUD refs (existing ids) ── */
  const $ = s => document.querySelector(s);
  const elLbl = $('#task .lbl'), elDst = $('#task .dst'), elSub = $('#task .sub');
  const elScore = $('#score .n'), elScoreL = $('#score .l'), elNeedle = $('#needle'), elDist = $('#dist'), elToast = $('#toast');
  const hud = $('#hud') || document.body;
  let toastT = 0;
  function toast(txt, col) { elToast.textContent = txt; elToast.style.color = col || '#fff'; elToast.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => elToast.classList.remove('show'), 1100); }

  /* ── injected CSS + new HUD elements (town.html stays untouched) ── */
  const css = document.createElement('style');
  css.textContent = `
    #flyTimerWrap { position:absolute; left:16px; top:96px; width:220px;
      background:rgba(28,22,16,.6); backdrop-filter:blur(10px);
      border:1px solid rgba(255,255,255,.14); border-radius:12px; padding:8px 12px;
      box-shadow:0 8px 28px rgba(0,0,0,.28); }
    #flyTimerWrap .row { display:flex; justify-content:space-between; align-items:baseline; }
    #flyTimerWrap .lbl { font-size:10px; letter-spacing:.14em; text-transform:uppercase; color:#9fd0ff; font-weight:800; }
    #flyTimerWrap .t { font-size:16px; font-weight:800; font-variant-numeric:tabular-nums; }
    #flyTimerBar { margin-top:6px; height:6px; border-radius:4px; background:rgba(255,255,255,.16); overflow:hidden; }
    #flyTimerBar i { display:block; height:100%; width:100%; border-radius:4px;
      background:linear-gradient(90deg,#7fe0a0,#ffd27a); transition:width .12s linear, background .3s; }
    #flyCombo { position:absolute; right:16px; top:78px; text-align:right;
      background:rgba(28,22,16,.6); backdrop-filter:blur(10px);
      border:1px solid rgba(255,255,255,.14); border-radius:12px; padding:8px 16px;
      box-shadow:0 8px 28px rgba(0,0,0,.28); opacity:0; transition:opacity .25s, transform .25s;
      transform:translateY(-6px); }
    #flyCombo.on { opacity:1; transform:translateY(0); }
    #flyCombo .m { font-size:22px; font-weight:900; line-height:1; color:#ffd27a; text-shadow:0 0 10px rgba(255,200,90,.5); }
    #flyCombo .l { font-size:9px; letter-spacing:.12em; text-transform:uppercase; opacity:.7; margin-top:3px; }
    #flyComboBar { margin-top:5px; height:4px; border-radius:3px; background:rgba(255,255,255,.16); overflow:hidden; }
    #flyComboBar i { display:block; height:100%; width:100%; background:#ffd27a; }
    #flyBest { position:absolute; right:16px; top:150px; text-align:right; font-size:10px;
      letter-spacing:.06em; line-height:1.5; opacity:.78; background:rgba(28,22,16,.42);
      padding:6px 12px; border-radius:10px; backdrop-filter:blur(6px); }
    #flyBest b { color:#7fe0a0; font-weight:800; }
    #flyMap { position:absolute; right:16px; bottom:16px; width:150px; height:150px;
      border-radius:14px; background:rgba(10,14,22,.55); border:1px solid rgba(255,255,255,.18);
      box-shadow:0 8px 28px rgba(0,0,0,.3); backdrop-filter:blur(6px); }
    @media (max-width: 560px) { #flyMap { width:118px; height:118px; bottom:96px; } #flyBest{ top:138px; } }
    #flyStart { position:absolute; inset:0; z-index:20; display:grid; place-items:center;
      background:radial-gradient(120% 120% at 50% 32%, rgba(58,44,30,.30), rgba(21,16,10,.62));
      pointer-events:auto; transition:opacity .6s; }
    #flyStart.gone { opacity:0; pointer-events:none; }
    #flyStart .card { text-align:center; padding:26px 42px; border-radius:18px;
      background:rgba(28,22,16,.66); border:1px solid rgba(255,244,222,.16);
      backdrop-filter:blur(10px); box-shadow:0 14px 44px rgba(20,12,4,.4); }
    #flyStart .t { font-size:40px; font-weight:900; letter-spacing:.05em; color:#fff5e9; }
    #flyStart .s { margin-top:4px; font-size:13px; opacity:.75; font-style:italic; }
    #flyStart .c { margin-top:16px; font:600 12px ui-monospace, Menlo, monospace; line-height:1.8; opacity:.85; }
    #flyStart .go { margin-top:16px; font-size:12px; font-weight:800; letter-spacing:.14em;
      text-transform:uppercase; color:#ffd27a; animation:flyGo 1.6s ease-in-out infinite; }
    @keyframes flyGo { 50% { opacity:.45; } }
    .flyBub { position:absolute; transform:translate(-50%,-115%); max-width:220px;
      background:rgba(255,248,236,.96); color:#3a2c1c; font-weight:700; font-size:12px;
      padding:6px 11px; border-radius:12px; opacity:0; transition:opacity .15s;
      pointer-events:none; white-space:nowrap; box-shadow:0 4px 14px rgba(40,24,8,.28); }
    .flyBub::after { content:''; position:absolute; left:50%; bottom:-6px; margin-left:-6px;
      border:6px solid transparent; border-top-color:rgba(255,248,236,.96); border-bottom:0; }
    #flyOffer { position:absolute; left:50%; bottom:74px; transform:translateX(-50%);
      display:flex; gap:12px; pointer-events:auto; }
    #flyOffer .card { width:210px; padding:12px 14px 10px; border-radius:14px; cursor:pointer;
      background:rgba(28,22,16,.72); border:1px solid rgba(255,244,222,.18);
      backdrop-filter:blur(10px); box-shadow:0 10px 30px rgba(20,12,4,.35);
      transition:transform .12s, border-color .12s; }
    #flyOffer .card:hover { transform:translateY(-3px); border-color:#ffd27a; }
    #flyOffer .card .key { font-size:9px; letter-spacing:.12em; color:#9fd0ff; font-weight:800; text-transform:uppercase; }
    #flyOffer .card.ex .key { color:#ffd27a; }
    #flyOffer .card .route { font-size:14px; font-weight:800; margin-top:3px; line-height:1.25; }
    #flyOffer .card .pay { font-size:11px; opacity:.75; margin-top:3px; font-style:italic; }
    #flyOffer .card .meta { font-size:10px; margin-top:6px; opacity:.85; font-weight:700; color:#7fe0a0; }
    #flyOffer .card.ex .meta { color:#ffd27a; }
    #flyOfferBar { position:absolute; left:50%; bottom:64px; transform:translateX(-50%);
      width:160px; height:4px; border-radius:3px; background:rgba(255,255,255,.15); overflow:hidden; }
    #flyOfferBar i { display:block; height:100%; background:#9fd0ff; }
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
  const QUIPS_PICKUP = ['¡Cuídalo bien!', '¡Es urgente!', 'Gracias, mensajero', 'Con cariño, por favor', 'Ni una arruga, ¿eh?'];
  const QUIPS_DELIVER = ['¡Gracias!', '¡Justo a tiempo!', '¡Eres un sol!', '¡Qué rápido!', '¡Mil gracias!'];
  const NPCS = world.npcs || [];
  let quipCd = 5;

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
    bestEl.innerHTML = '<span style="color:#ffd27a">✦ ' + rankName(totalDeliv) + '</span><br>'
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
  let payload = '', express = false;

  function setObjective() {
    const tg = carrying ? dropoff : pickup;
    const col = carrying ? 0x7fe0a0 : 0xffd060;
    beam.material.color.setHex(col); ring.material.color.setHex(col);
    beam.position.set(tg.pos.x, 15, tg.pos.z);
    ring.position.set(tg.pos.x, 0.3, tg.pos.z);
    beam.visible = ring.visible = true;
    objLetter.position.set(tg.pos.x, 3.6, tg.pos.z); objLetter.visible = !carrying;
    elLbl.textContent = (express ? '⚡ ' : '') + (carrying ? 'Deliver to' : 'Pick up at');
    elLbl.style.color = express ? '#ffd27a' : '#ffd27a';
    elDst.textContent = tg.name;
    elSub.textContent = carrying ? (payload + ' → the green-lit shop') : (payload + ' — grab the floating letter');
  }
  /* ── JOBS: after onboarding the courier CHOOSES between two offers ── */
  let offer = null;   // { jobs: [a, b], t: seconds left to decide }
  function makeJob() {
    const pu = pick(ADDR);
    let dr; do { dr = pick(ADDR); } while (dr === pu);
    const ex = delivered >= 2 && L.chance(0.3);
    const route = planar(P.pos, pu.pos) + planar(pu.pos, dr.pos);
    let budget = clamp(10 + route * 0.42, 14, 46) * (ex ? 0.66 : 1);
    if (delivered === 0) budget *= 1.6;           // warm-up welcome job
    return { pickup: pu, dropoff: dr, payload: pick(PAYLOADS), express: ex, budget, route };
  }
  function startJob(j) {
    pickup = j.pickup; dropoff = j.dropoff; payload = j.payload; express = j.express;
    carrying = false; carriedLetter.visible = false;
    jobBudget = j.budget; jobLeft = jobBudget; jobActive = true;
    setObjective();
    toast(express ? '⚡ Express — double pay! ' + Math.round(jobBudget) + 's' : 'New job · ' + Math.round(jobBudget) + 's', express ? '#ffd27a' : '#9fd0ff');
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
    const a = makeJob(); let b = makeJob();
    for (let k = 0; k < 4 && b.pickup === a.pickup && b.dropoff === a.dropoff; k++) b = makeJob();
    offer = { jobs: [a, b], t: 9 };
    beam.visible = ring.visible = objLetter.visible = false;
    elLbl.textContent = 'Encargos'; elDst.textContent = 'Choose a job'; elSub.textContent = 'press 1 / 2 — or tap a card';
    elTimerT.textContent = '--'; elTimerBar.style.width = '100%';
    offerEl.innerHTML = offer.jobs.map((j, i) =>
      '<div class="card' + (j.express ? ' ex' : '') + '" data-i="' + i + '">'
      + '<div class="key">' + (i + 1) + (j.express ? ' · ⚡ express' : '') + '</div>'
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
  let AC = null, wind = null, windGain = null, master = null, muted = false, fountainGain = null;
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
    if (stun > 0) return;
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
  const baseFov = camera.fov;
  const hintEl = document.querySelector('#hint');
  if (hintEl) hintEl.textContent = IS_TOUCH ? 'drag to walk · hold ⚡ to run' : 'WASD to walk · Shift to run · M to mute';

  /* ── start card — the town idles behind it; first input begins the shift ── */
  beam.visible = ring.visible = objLetter.visible = false;
  elLbl.textContent = 'Welcome to'; elDst.textContent = 'Villa Mott'; elSub.textContent = 'the town is waking up…';
  const startEl = document.createElement('div'); startEl.id = 'flyStart';
  startEl.innerHTML = '<div class="card"><div class="t">THE FLY</div><div class="s">a tiny courier tale</div>'
    + '<div class="c">' + (IS_TOUCH ? 'drag the stick to walk<br>hold ⚡ to run' : 'WASD to walk &nbsp;·&nbsp; SHIFT to run<br>M to mute') + '</div>'
    + '<div class="go">' + (IS_TOUCH ? 'tap to start' : 'press any key to start') + '</div></div>';
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
    if (stunned || !begun) mag = 0;

    if (mag > 0.05) {
      // screen-up = camera-forward; screen-right for heading θ is (-cosθ, 0, sinθ)
      // in this right-handed Y-up world, so the X input must be NEGATED here —
      // atan2(+ix, iy) mirrors left/right.
      const wishYaw = camYaw + Math.atan2(-ix, iy);
      let dy = wishYaw - P.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      P.yaw += dy * L.dampT(dt, 11);                          // quick, smooth turn-in
      // camera settles behind scaled by alignment (cos dc): full chase when
      // running away from it, none on a pure strafe or reversal — otherwise the
      // chase rotates the input frame and straight lines become circles
      let dc = P.yaw - camYaw; dc = Math.atan2(Math.sin(dc), Math.cos(dc));
      camYaw += dc * L.dampT(dt, 2.6) * Math.max(0, Math.cos(dc));
    }
    P.speed = lerp(P.speed, mag * (running ? RUN : WALK), L.dampT(dt, ACCEL));
    fwd.set(Math.sin(P.yaw), 0, Math.cos(P.yaw));
    P.pos.x += fwd.x * P.speed * dt; P.pos.z += fwd.z * P.speed * dt;
    P.pos.x = clamp(P.pos.x, bounds.minX, bounds.maxX);
    P.pos.z = clamp(P.pos.z, bounds.minZ, bounds.maxZ);
    resolveStatic();                                          // solid town
    // townsfolk are soft: brushing past nudges both of you apart (no hard walls)
    for (const n of NPCS) {
      const u = n.userData.npc;
      if (u && (u.kind === 'seated' || u.kind === 'vendor')) continue;
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
    hero.position.set(P.pos.x, P.pos.y, P.pos.z);
    hero.rotation.set(0, 0, 0); hero.rotateY(P.yaw);
    if (stunned) hero.rotateZ(Math.sin(now * 0.04) * 0.2);
    walkPhase += dt * (moving ? (5 + spd01 * 7) : 0);
    C.animateWalk(hero, walkPhase, moving);
    if (moving) { const fp = Math.floor(walkPhase / Math.PI); if (fp !== lastStep) { lastStep = fp; sfxStep(); } }
    // scarf tail trails and flutters with speed (the brand accent in motion)
    const st = hero.userData.scarfTail;
    if (st) st.rotation.x = -(0.45 + spd01 * 0.9 + Math.sin(now * 0.02) * (0.05 + spd01 * 0.14));

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

    // markers
    const tg = carrying ? dropoff : pickup;
    beam.rotation.y += dt * 0.4; ring.scale.setScalar(1 + Math.sin(now * 0.004) * 0.08);
    objLetter.rotation.y += dt * 1.5; objLetter.position.y = 3.6 + Math.sin(now * 0.003) * 0.25;

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
      elTimerT.style.color = low ? '#ff8f8f' : '#fff';
      elTimerBar.style.background = low ? '#ff6b6b' : (frac > 0.5 ? 'linear-gradient(90deg,#7fe0a0,#ffd27a)' : 'linear-gradient(90deg,#ffd27a,#ff9a6a)');
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
        carrying = true; carriedLetter.visible = true; toast('✉ Letter picked up', '#ffd27a'); sfxPick(); setObjective();
        bubble(tg.pos.x, 3.4, tg.pos.z, pick(QUIPS_PICKUP));
      } else {
        bubble(tg.pos.x, 3.4, tg.pos.z, pick(QUIPS_DELIVER));
        deliver(tg);
      }
    }

    /* idle townsfolk quips — someone nearby says something small */
    quipCd -= dt;
    if (quipCd <= 0) {
      quipCd = 0.6;
      for (const n of NPCS) {
        const u = n.userData.npc;
        if (!u || u.kind === 'seated') continue;
        const dx2 = n.position.x - P.pos.x, dz2 = n.position.z - P.pos.z;
        if (dx2 * dx2 + dz2 * dz2 < 12) { bubble(n.position.x, n.position.y + 2.05, n.position.z, pick(QUIPS_STREET), 2.4); quipCd = rand(7, 12); break; }
      }
    }

    checkTraffic();
    updateFX(dt);
    updateBubbles(dt);

    // minimap (throttled ~12fps)
    mapAcc += dt;
    if (mapAcc > 0.08) { mapAcc = 0; drawMap(); }
  }

  function deliver(tg) {
    delivered++;
    jobActive = false;
    // speed/time bonus: more left on the clock = more points
    const timeFrac = clamp(jobLeft / jobBudget, 0, 1);
    const speedy = timeFrac > 0.55;
    const base = 100;
    const timeBonus = Math.round(timeFrac * 150);
    // combo: a quick delivery (with time to spare) builds the streak
    if (speedy) { streak++; combo = clamp(combo + 1, 1, 8); comboTimer = COMBO_WINDOW; }
    else { comboTimer = COMBO_WINDOW * 0.6; } // keep current combo alive briefly even on a slow drop
    const gained = Math.round((base + timeBonus) * combo * (express ? 2 : 1));
    score += gained;
    elScore.textContent = score;

    sfxDeliver();
    fxBurst(tg.pos);
    if (combo > 1) { fxBurst(tg.pos, [0xffd060, 0xffffff, 0xff9a6a], 12, 3.6); sfxBonus(); }

    const tip = (express ? '⚡ ' : '') + (combo > 1
      ? '★ Delivered! +' + gained + '  (x' + combo + ')'
      : '★ Delivered! +' + gained);
    toast(tip, combo > 2 ? '#ffd27a' : '#7fe0a0');

    // contextual feedback for fast / milestone runs
    if (speedy && timeFrac > 0.78) setTimeout(() => toast('⚡ Express run!', '#9fd0ff'), 700);
    else if (combo >= 4) setTimeout(() => toast('🔥 On fire — x' + combo + '!', '#ff9a6a'), 700);

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

    newTask();
  }

  /* ── MINIMAP rendering ── */
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
    g.fillStyle = 'rgba(46,40,28,0.55)';
    g.fillRect(bx0, by0, bx1 - bx0, by1 - by0);
    if (LY) {
      const ROAD = 'rgba(172,160,138,0.55)';
      // the real street grid: two avenues + two cross-streets
      rectWorld(g, -LY.AVX, -LY.SW, LY.AVX, LY.SW, ROAD);
      rectWorld(g, -LY.AV2X, LY.AV2Z - LY.SW, LY.AV2X, LY.AV2Z + LY.SW, ROAD);
      [LY.CROSSX, LY.CROSSX2].forEach(cx => rectWorld(g, cx - LY.SW, LY.CROSSZ0, cx + LY.SW, LY.CROSSZ1, ROAD));
      // green spaces + plaza
      const pk = LY.park, pz = LY.plaza, gr = LY.green;
      rectWorld(g, pk.x - pk.hw, pk.z - pk.hd, pk.x + pk.hw, pk.z + pk.hd, 'rgba(104,150,86,0.65)');
      rectWorld(g, gr.x - gr.hw, gr.z - gr.hd, gr.x + gr.hw, gr.z + gr.hd, 'rgba(104,150,86,0.6)');
      rectWorld(g, pz.x - pz.hw, pz.z - pz.hd, pz.x + pz.hw, pz.z + pz.hd, 'rgba(202,185,150,0.6)');
    }
    // address dots (the building footprints, abstractly)
    g.fillStyle = 'rgba(220,210,180,0.55)';
    for (const a of ADDR) {
      const [px, py] = mapXY(a.pos.x, a.pos.z);
      g.fillRect(px - 1.4, py - 1.4, 2.8, 2.8);
    }
    // current objective (pulsing)
    const tg = carrying ? dropoff : pickup;
    if (tg) {
      const [ox, oy] = mapXY(tg.pos.x, tg.pos.z);
      const pulse = 5 + Math.sin(performance.now() * 0.006) * 2.5;
      g.fillStyle = carrying ? '#7fe0a0' : '#ffd060';
      g.beginPath(); g.arc(ox, oy, pulse, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 1.5; g.stroke();
    }
    // player + heading
    const [px, py] = mapXY(P.pos.x, P.pos.z);
    g.save();
    g.translate(px, py);
    // map yaw: canvas +y draws world +Z, so the "up"-pointing triangle needs
    // atan2(x, -z) to aim along the true heading
    g.rotate(Math.atan2(fwd.x, -fwd.z));
    g.fillStyle = stun > 0 ? '#ff7a7a' : '#9fd0ff';
    g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(-5, 6); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1.2; g.stroke();
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
    begin,
  } };
}

FLY.game = { start };
})();
