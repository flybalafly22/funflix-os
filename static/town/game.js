/* ════════════════════════════════════════════════════════════════════════
   THE FLY — town/game.js
   The playable layer: the Fly courier, flight controls, chase camera, the
   delivery loop (pick up → fly to glowing shop → deliver → score), HUD wiring,
   synth audio + particle FX.
   Now a real game: per-job timer, speed/combo scoring, decaying combo multiplier,
   minimap, contextual tips + persisted bests, and gentle drifting hazards to dodge.
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

  /* ── player ── */
  const fly = C.makeFly(); scene.add(fly);
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
  carriedLetter.visible = false; carriedLetter.position.set(0, 0.45, 0.15); fly.add(carriedLetter); toFx(carriedLetter);

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

  /* ── game state ── */
  const ADDR = world.addresses;
  const bounds = world.bounds;
  const P = { pos: world.spawn.clone(), yaw: 0, speed: 0, vy: 0, bank: 0, pitch: 0 };
  const MAXF = 19, MAXB = 7, ACCEL = 3.2, YAWRATE = 2.0, CLIMB = 10;
  let carrying = false, pickup = null, dropoff = null, delivered = 0;
  let score = 0;

  // scoring / timer / combo
  let jobBudget = 0;       // soft seconds allotted for the active job
  let jobLeft = 0;         // seconds remaining
  let jobActive = false;
  let combo = 1;           // current multiplier
  let comboTimer = 0;      // seconds left before combo decays
  const COMBO_WINDOW = 14; // grace window after a delivery to keep the streak
  let streak = 0;          // consecutive on-time deliveries
  let stun = 0;            // hazard stun timer (seconds)

  // persisted bests
  const LS = { score: 'fly_best_score', streak: 'fly_best_streak' };
  function lsGet(k) { try { return parseInt(localStorage.getItem(k) || '0', 10) || 0; } catch (e) { return 0; } }
  function lsSet(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) {} }
  let bestScore = lsGet(LS.score), bestStreak = lsGet(LS.streak);
  function renderBest() { bestEl.innerHTML = 'Best score <b>' + bestScore + '</b><br>Best streak <b>x' + bestStreak + '</b>'; }
  renderBest();
  if (elScoreL) elScoreL.textContent = 'score';

  function planar(a, b) { const dx = a.x - b.x, dz = a.z - b.z; return Math.hypot(dx, dz); }

  function setObjective() {
    const tg = carrying ? dropoff : pickup;
    const col = carrying ? 0x7fe0a0 : 0xffd060;
    beam.material.color.setHex(col); ring.material.color.setHex(col);
    beam.position.set(tg.pos.x, 15, tg.pos.z);
    ring.position.set(tg.pos.x, 0.3, tg.pos.z);
    objLetter.position.set(tg.pos.x, 3.6, tg.pos.z); objLetter.visible = !carrying;
    elLbl.textContent = carrying ? 'Deliver to' : 'Pick up at';
    elDst.textContent = tg.name;
    elSub.textContent = carrying ? 'fly to the green-lit shop' : 'grab the floating letter';
  }
  function newTask() {
    pickup = pick(ADDR);
    do { dropoff = pick(ADDR); } while (dropoff === pickup);
    carrying = false; carriedLetter.visible = false;
    // soft time budget scaled by total route length (pick-up + delivery legs)
    const route = planar(P.pos, pickup.pos) + planar(pickup.pos, dropoff.pos);
    jobBudget = clamp(10 + route * 0.42, 14, 46);
    jobLeft = jobBudget; jobActive = true;
    setObjective();
    toast('New job · ' + Math.round(jobBudget) + 's', '#9fd0ff');
  }

  /* ── audio (lazy, synth) ── */
  let AC = null, wind = null, windGain = null;
  function initAudio() {
    if (AC) return; try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    wind = AC.createBufferSource();
    const buf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
    wind.buffer = buf; wind.loop = true;
    const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 480;
    windGain = AC.createGain(); windGain.gain.value = 0.0;
    wind.connect(lp).connect(windGain).connect(AC.destination); wind.start();
  }
  function blip(freq, dur, type, vol) {
    if (!AC) return; const o = AC.createOscillator(), g = AC.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, AC.currentTime); g.gain.exponentialRampToValueAtTime(vol || 0.18, AC.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + (dur || 0.18));
    o.connect(g).connect(AC.destination); o.start(); o.stop(AC.currentTime + (dur || 0.18) + 0.02);
  }
  const sfxPick = () => { blip(540, 0.12, 'triangle', 0.16); setTimeout(() => blip(740, 0.14, 'triangle', 0.14), 70); };
  const sfxDeliver = () => { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.16, 'triangle', 0.16), i * 70)); };
  const sfxBonus = () => { [784, 988, 1318].forEach((f, i) => setTimeout(() => blip(f, 0.12, 'square', 0.1), i * 55)); };
  const sfxHazard = () => { blip(150, 0.22, 'sawtooth', 0.18); setTimeout(() => blip(96, 0.28, 'sawtooth', 0.16), 80); };

  /* ── input ── */
  const keys = {};
  addEventListener('keydown', e => { keys[e.code] = true; initAudio(); if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault(); });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('pointerdown', initAudio, { once: true });

  let tThrottle = 0, tYaw = 0, tVert = 0;
  const stick = document.getElementById('stick'), knob = document.getElementById('knob');
  let sid = null, scx = 0, scy = 0;
  if (stick) {
    stick.addEventListener('pointerdown', e => { sid = e.pointerId; const r = stick.getBoundingClientRect(); scx = r.left + r.width / 2; scy = r.top + r.height / 2; stick.setPointerCapture(e.pointerId); initAudio(); });
    stick.addEventListener('pointermove', e => { if (e.pointerId !== sid) return; let dx = e.clientX - scx, dy = e.clientY - scy; const R = 50, len = Math.hypot(dx, dy); if (len > R) { dx *= R / len; dy *= R / len; } knob.style.transform = `translate(${dx}px,${dy}px)`; tYaw = -dx / R; tThrottle = -dy / R; });
    const end = e => { if (e.pointerId !== sid) return; sid = null; tYaw = tThrottle = 0; knob.style.transform = 'translate(0,0)'; };
    stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
  }
  const bindBtn = (id, v) => { const el = document.getElementById(id); if (!el) return; el.addEventListener('pointerdown', e => { e.preventDefault(); tVert = v; initAudio(); }); el.addEventListener('pointerup', () => tVert = 0); el.addEventListener('pointercancel', () => tVert = 0); };
  bindBtn('btnUp', 1); bindBtn('btnDn', -1);

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

  /* ── HAZARDS: drifting balloons to dodge (self-contained, own meshes) ── */
  const hazards = [];
  const HAZ_COLS = [0xff6b6b, 0xffd166, 0x6bc1ff, 0xff8fd0, 0x9be36b, 0xc08bff];
  const balloonGeo = new T.SphereGeometry(0.95, 12, 10);
  function makeBalloon() {
    const g = new T.Group();
    const col = pick(HAZ_COLS);
    const body = new T.Mesh(balloonGeo, L.std({ color: col, roughness: 0.45, metalness: 0.0, emissive: col, emissiveIntensity: 0.12 }));
    body.scale.y = 1.22; body.castShadow = false; g.add(body);
    // little knot + string
    g.add(L.box(0.18, 0.18, 0.18, L.std({ color: col, roughness: 0.6 }), { y: -1.1, cast: false }));
    const str = L.box(0.03, 1.6, 0.03, L.std({ color: 0x2a2620, roughness: 0.9 }), { y: -1.95, cast: false });
    g.add(str);
    g.userData = { body, r: 1.15, drift: new T.Vector3(rand(-1, 1), 0, rand(-1, 1)).normalize().multiplyScalar(rand(1.2, 3.0)), phase: rand(0, TAU), spin: rand(-0.6, 0.6) };
    scene.add(g); hazards.push(g);
    return g;
  }
  function placeBalloon(g) {
    g.position.set(rand(bounds.minX + 6, bounds.maxX - 6), rand(6, Math.min(26, bounds.maxY - 4)), rand(bounds.minZ + 6, bounds.maxZ - 6));
  }
  const HAZ_N = 7;
  for (let i = 0; i < HAZ_N; i++) { const b = makeBalloon(); placeBalloon(b); }

  function updateHazards(dt, now) {
    for (const h of hazards) {
      const u = h.userData;
      h.position.x += u.drift.x * dt;
      h.position.z += u.drift.z * dt;
      h.position.y += Math.sin(now * 0.0012 + u.phase) * dt * 0.6;
      h.rotation.y += u.spin * dt;
      // bob the body for a buoyant feel
      u.body.position.y = Math.sin(now * 0.003 + u.phase) * 0.12;
      // wrap / re-seed when it drifts off the play area
      if (h.position.x < bounds.minX + 2 || h.position.x > bounds.maxX - 2) u.drift.x = -u.drift.x;
      if (h.position.z < bounds.minZ + 2 || h.position.z > bounds.maxZ - 2) u.drift.z = -u.drift.z;
      h.position.y = clamp(h.position.y, 4, bounds.maxY - 3);
    }
  }
  function checkHazards() {
    if (stun > 0) return;
    for (const h of hazards) {
      const dx = h.position.x - P.pos.x, dy = h.position.y - P.pos.y, dz = h.position.z - P.pos.z;
      const rr = h.userData.r + 0.9;
      if (dx * dx + dy * dy + dz * dz < rr * rr) {
        hitHazard(h);
        break;
      }
    }
  }
  function hitHazard(h) {
    stun = 0.7;
    P.speed *= -0.25; P.vy *= -0.3;
    // knock the balloon away so you don't re-trigger instantly
    const away = new T.Vector3(h.position.x - P.pos.x, 0, h.position.z - P.pos.z);
    if (away.lengthSq() < 0.001) away.set(1, 0, 0);
    away.normalize();
    h.userData.drift.copy(away).multiplyScalar(rand(2.5, 4));
    h.position.addScaledVector(away, 1.5);
    fxBurst(P.pos, [0xff6b6b, 0xffd166, 0xffffff], 14, P.pos.y);
    sfxHazard();
    // break combo, lose a little time
    breakCombo('Ouch! popped a balloon');
    jobLeft = Math.max(2, jobLeft - 3);
  }

  /* ── combo helpers ── */
  function breakCombo(msg) {
    if (combo > 1 || streak > 0) toast(msg || 'Combo lost', '#ff9a8a');
    combo = 1; comboTimer = 0; streak = 0;
  }

  /* ── loop ── */
  const camPos = camera.position.clone().set(0, 14, -18);
  const fwd = new T.Vector3();
  let mapAcc = 0;
  newTask();

  function update(dt, now) {
    // stun briefly disables steering input (player got bumped)
    const stunned = stun > 0;
    if (stunned) stun -= dt;

    let thr = tThrottle, turn = tYaw, vert = tVert;
    if (keys['KeyW'] || keys['ArrowUp']) thr += 1;
    if (keys['KeyS'] || keys['ArrowDown']) thr -= 1;
    if (keys['KeyA'] || keys['ArrowLeft']) turn += 1;
    if (keys['KeyD'] || keys['ArrowRight']) turn -= 1;
    if (keys['Space']) vert += 1;
    if (keys['ShiftLeft'] || keys['ShiftRight']) vert -= 1;
    thr = clamp(thr, -1, 1); turn = clamp(turn, -1, 1); vert = clamp(vert, -1, 1);
    if (stunned) { thr *= 0.1; turn = 0; vert = 0; }

    const targetSpeed = thr >= 0 ? thr * MAXF : thr * MAXB;
    P.speed = lerp(P.speed, targetSpeed, L.dampT(dt, ACCEL));
    P.yaw += turn * YAWRATE * dt * (0.45 + 0.55 * Math.min(1, Math.abs(P.speed) / MAXF));
    fwd.set(Math.sin(P.yaw), 0, Math.cos(P.yaw));
    P.pos.x += fwd.x * P.speed * dt; P.pos.z += fwd.z * P.speed * dt;
    P.vy = lerp(P.vy, vert * CLIMB, L.dampT(dt, 6)); P.pos.y += P.vy * dt;
    P.pos.x = clamp(P.pos.x, bounds.minX, bounds.maxX);
    P.pos.z = clamp(P.pos.z, bounds.minZ, bounds.maxZ);
    P.pos.y = clamp(P.pos.y, bounds.minY, bounds.maxY);
    P.bank = lerp(P.bank, -turn * 0.5, L.dampT(dt, 8));
    P.pitch = lerp(P.pitch, -P.speed / MAXF * 0.18 - P.vy * 0.02, L.dampT(dt, 6));

    fly.position.copy(P.pos); player.pos.copy(P.pos);
    fly.rotation.set(0, 0, 0); fly.rotateY(P.yaw); fly.rotateX(P.pitch); fly.rotateZ(P.bank);
    // when stunned, give a little dizzy wobble
    if (stunned) fly.rotateZ(Math.sin(now * 0.05) * 0.5 * (stun / 0.7));
    const flap = Math.sin(now * 0.03) * (0.5 + Math.min(1, Math.abs(P.speed) / MAXF) * 0.6);
    fly.userData.wingL.rotation.z = 0.3 + flap; fly.userData.wingR.rotation.z = -0.3 - flap;
    fly.userData.scarfTail.rotation.x = 0.3 + Math.sin(now * 0.012) * 0.25 + Math.min(1, Math.abs(P.speed) / MAXF) * 0.5;

    blob.position.set(P.pos.x, 0.04, P.pos.z);
    const hgt = clamp((P.pos.y - 1) / 30, 0, 1);
    blob.scale.setScalar(1 + hgt * 1.5); blob.material.opacity = 0.28 * (1 - hgt * 0.55);

    // camera chase
    const desired = camPos.set(P.pos.x - fwd.x * 13, P.pos.y + 5.5, P.pos.z - fwd.z * 13);
    camera.position.lerp(desired, L.dampT(dt, 5));
    camera.lookAt(P.pos.x + fwd.x * 5, P.pos.y + 0.5, P.pos.z + fwd.z * 5);

    // wind volume tracks speed
    if (windGain) windGain.gain.value = lerp(windGain.gain.value, 0.02 + Math.abs(P.speed) / MAXF * 0.06, L.dampT(dt, 3));

    // markers
    const tg = carrying ? dropoff : pickup;
    beam.rotation.y += dt * 0.4; ring.scale.setScalar(1 + Math.sin(now * 0.004) * 0.08);
    objLetter.rotation.y += dt * 1.5; objLetter.position.y = 3.6 + Math.sin(now * 0.003) * 0.25;

    const dx = P.pos.x - tg.pos.x, dz = P.pos.z - tg.pos.z, dPlanar = Math.hypot(dx, dz);
    elDist.textContent = dPlanar < 90 ? Math.round(dPlanar) + ' m' : '—';
    const bearing = Math.atan2(tg.pos.x - P.pos.x, tg.pos.z - P.pos.z);
    elNeedle.style.transform = `rotate(${P.yaw - bearing}rad)`;

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
    if (dPlanar < 4.5) {
      if (!carrying) {
        carrying = true; carriedLetter.visible = true; toast('✉ Letter picked up', '#ffd27a'); sfxPick(); setObjective();
      } else {
        deliver(tg);
      }
    }

    updateHazards(dt, now);
    checkHazards();
    updateFX(dt);

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
    const gained = Math.round((base + timeBonus) * combo);
    score += gained;
    elScore.textContent = score;

    sfxDeliver();
    fxBurst(tg.pos);
    if (combo > 1) { fxBurst(tg.pos, [0xffd060, 0xffffff, 0xff9a6a], 12, 3.6); sfxBonus(); }

    const tip = combo > 1
      ? '★ Delivered! +' + gained + '  (x' + combo + ')'
      : '★ Delivered! +' + gained;
    toast(tip, combo > 2 ? '#ffd27a' : '#7fe0a0');

    // contextual feedback for fast / milestone runs
    if (speedy && timeFrac > 0.78) setTimeout(() => toast('⚡ Express run!', '#9fd0ff'), 700);
    else if (combo >= 4) setTimeout(() => toast('🔥 On fire — x' + combo + '!', '#ff9a6a'), 700);

    // persist bests
    let dirty = false;
    if (score > bestScore) { bestScore = score; lsSet(LS.score, bestScore); dirty = true; }
    if (streak > bestStreak) { bestStreak = streak; lsSet(LS.streak, bestStreak); dirty = true; }
    if (dirty) renderBest();

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
  function drawMap() {
    const g = mctx;
    g.clearRect(0, 0, MAPRES, MAPRES);
    // town footprint
    const [bx0, by0] = mapXY(bounds.minX, bounds.minZ);
    const [bx1, by1] = mapXY(bounds.maxX, bounds.maxZ);
    g.fillStyle = 'rgba(46,40,28,0.55)';
    g.fillRect(bx0, by0, bx1 - bx0, by1 - by0);
    // central avenue band (z≈0 runs across the map) — abstract street
    const [, ay] = mapXY(0, 0);
    g.fillStyle = 'rgba(120,120,130,0.5)';
    g.fillRect(bx0, ay - 8, bx1 - bx0, 16);
    g.strokeStyle = 'rgba(255,255,255,0.18)';
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(bx0, ay); g.lineTo(bx1, ay); g.stroke();
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
    // map yaw: world +Z is "down" on canvas; heading triangle points along fwd
    g.rotate(Math.atan2(fwd.x, fwd.z));
    g.fillStyle = stun > 0 ? '#ff7a7a' : '#9fd0ff';
    g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(-5, 6); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1.2; g.stroke();
    g.restore();
  }

  return { update };
}

FLY.game = { start };
})();
