/* ════════════════════════════════════════════════════════════════════════
   THE FLY — town/game.js
   The playable layer: the Fly courier, flight controls, chase camera, the
   delivery loop (pick up → fly to glowing shop → deliver → score), HUD wiring,
   synth audio + particle FX.
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
  const blob = new T.Mesh(new T.CircleGeometry(0.8, 20), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.26, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; scene.add(blob);

  // carried letter on the fly
  const letterMat = L.std({ color: 0xf4ecd6, roughness: 0.7 });
  const carriedLetter = new T.Group();
  { const env = L.box(0.4, 0.28, 0.05, letterMat, { cast: false });
    env.add(L.box(0.1, 0.1, 0.01, L.std({ color: 0xc0463e, roughness: 0.7 }), { x: 0.12, y: 0.07, z: 0.03, cast: false }));
    carriedLetter.add(env); }
  carriedLetter.visible = false; carriedLetter.position.set(0, 0.45, 0.15); fly.add(carriedLetter);

  /* ── objective markers ── */
  const beam = new T.Mesh(new T.CylinderGeometry(1.1, 1.5, 30, 16, 1, true), new T.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0.26, depthWrite: false, side: T.DoubleSide }));
  scene.add(beam);
  const ring = new T.Mesh(new T.TorusGeometry(1.6, 0.13, 8, 28), new T.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0.85, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; scene.add(ring);
  const objLetter = new T.Group();
  { const env = L.box(0.9, 0.62, 0.1, letterMat);
    env.add(L.box(0.9, 0.34, 0.01, L.std({ color: 0xdcd0b0, roughness: 0.7 }), { y: 0.05, z: 0.052, cast: false }));
    env.add(L.box(0.22, 0.22, 0.01, L.std({ color: 0xc0463e, roughness: 0.7, emissive: 0x802820, emissiveIntensity: 0.2 }), { x: 0.26, y: 0.13, z: 0.053, cast: false }));
    objLetter.add(env); }
  scene.add(objLetter);

  /* ── HUD refs ── */
  const $ = s => document.querySelector(s);
  const elLbl = $('#task .lbl'), elDst = $('#task .dst'), elSub = $('#task .sub');
  const elScore = $('#score .n'), elNeedle = $('#needle'), elDist = $('#dist'), elToast = $('#toast');
  let toastT = 0;
  function toast(txt, col) { elToast.textContent = txt; elToast.style.color = col || '#fff'; elToast.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => elToast.classList.remove('show'), 1100); }

  /* ── game state ── */
  const ADDR = world.addresses;
  const bounds = world.bounds;
  const P = { pos: world.spawn.clone(), yaw: 0, speed: 0, vy: 0, bank: 0, pitch: 0 };
  const MAXF = 19, MAXB = 7, ACCEL = 3.2, YAWRATE = 2.0, CLIMB = 10;
  let carrying = false, pickup = null, dropoff = null, delivered = 0;

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
    carrying = false; carriedLetter.visible = false; setObjective();
  }
  newTask();

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
  function fxBurst(pos) {
    const cols = [0x7fe0a0, 0xffd060, 0xffffff, 0xff9a6a];
    for (let i = 0; i < 18; i++) {
      let p = fxPool.find(x => !x.mesh.visible);
      if (!p) { p = { mesh: new T.Mesh(fxGeo, new T.MeshBasicMaterial({ transparent: true })) }; scene.add(p.mesh); fxPool.push(p); }
      p.mesh.visible = true; p.mesh.material.color.setHex(pick(cols)); p.mesh.material.opacity = 1;
      p.mesh.position.set(pos.x, 2.8, pos.z);
      const a = Math.random() * TAU, up = rand(2, 5), sp = rand(2, 5);
      p.vel = new T.Vector3(Math.cos(a) * sp, up, Math.sin(a) * sp); p.life = 1;
    }
  }
  function updateFX(dt) { for (const p of fxPool) { if (!p.mesh.visible) continue; p.life -= dt * 1.4; if (p.life <= 0) { p.mesh.visible = false; continue; } p.vel.y -= 9 * dt; p.mesh.position.addScaledVector(p.vel, dt); p.mesh.material.opacity = p.life; p.mesh.scale.setScalar(0.5 + p.life * 0.8); } }

  /* ── loop ── */
  const camPos = camera.position.clone().set(0, 14, -18);
  const fwd = new T.Vector3();
  function update(dt, now) {
    let thr = tThrottle, turn = tYaw, vert = tVert;
    if (keys['KeyW'] || keys['ArrowUp']) thr += 1;
    if (keys['KeyS'] || keys['ArrowDown']) thr -= 1;
    if (keys['KeyA'] || keys['ArrowLeft']) turn += 1;
    if (keys['KeyD'] || keys['ArrowRight']) turn -= 1;
    if (keys['Space']) vert += 1;
    if (keys['ShiftLeft'] || keys['ShiftRight']) vert -= 1;
    thr = clamp(thr, -1, 1); turn = clamp(turn, -1, 1); vert = clamp(vert, -1, 1);

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

    const dx = P.pos.x - tg.pos.x, dz = P.pos.z - tg.pos.z, planar = Math.hypot(dx, dz);
    elDist.textContent = planar < 90 ? Math.round(planar) + ' m' : '—';
    const bearing = Math.atan2(tg.pos.x - P.pos.x, tg.pos.z - P.pos.z);
    elNeedle.style.transform = `rotate(${P.yaw - bearing}rad)`;

    if (planar < 4.5) {
      if (!carrying) { carrying = true; carriedLetter.visible = true; toast('✉ Letter picked up', '#ffd27a'); sfxPick(); setObjective(); }
      else { delivered++; elScore.textContent = delivered; toast('★ Delivered! +1', '#7fe0a0'); sfxDeliver(); fxBurst(tg.pos); newTask(); }
    }

    updateFX(dt);
  }

  return { update };
}

FLY.game = { start };
})();
