/* ════════════════════════════════════════════════════════
   FUNFLIX://OS — shared runtime
   injects HUD, statusbar, particle field, cursor, ⌘K palette
   ════════════════════════════════════════════════════════ */
(() => {
  const MODULES = [
    { id: '00', name: 'INDEX',   desc: 'module select',         path: '/' },
    { id: '01', name: 'COMPUTE', desc: 'scientific calculator', path: '/calculator' },
    { id: '02', name: 'SYNTH',   desc: 'meme generator',        path: '/meme' },
    { id: '03', name: 'PRESS',   desc: 'ai journalist',         path: '/journalist' },
  ];
  const here = location.pathname.replace(/\/+$/, '') || '/';
  const current = MODULES.find(m => m.path === here) || MODULES[0];
  const CHEV = '<svg width="9" height="6" viewBox="0 0 9 6" fill="none"><path d="M1 1l3.5 3.5L8 1" stroke="currentColor" stroke-width="1.2"/></svg>';

  /* ── particle canvas ── */
  const cv = document.createElement('canvas');
  cv.id = 'fxCanvas';
  document.body.prepend(cv);
  const cx = cv.getContext('2d');
  let W, H, DPR, nodes = [];
  const mouse = { x: -9999, y: -9999 };

  function sizeCanvas() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * DPR; cv.height = H * DPR;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    cx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  sizeCanvas();
  window.addEventListener('resize', sizeCanvas);

  const N = Math.min(90, Math.floor(window.innerWidth / 16));
  for (let i = 0; i < N; i++) {
    nodes.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      r: Math.random() < 0.12 ? 1.8 : 1.1,
      red: Math.random() < 0.14,
    });
  }

  function tickField() {
    cx.clearRect(0, 0, W, H);
    for (const n of nodes) {
      n.x += n.vx; n.y += n.vy;
      const dx = n.x - mouse.x, dy = n.y - mouse.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 22500) { // 150px — gentle push away from cursor
        const d = Math.sqrt(d2) || 1;
        n.x += (dx / d) * 0.6; n.y += (dy / d) * 0.6;
      }
      if (n.x < -20) n.x = W + 20; if (n.x > W + 20) n.x = -20;
      if (n.y < -20) n.y = H + 20; if (n.y > H + 20) n.y = -20;
    }
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 16900) { // 130px
          const t = 1 - Math.sqrt(d2) / 130;
          cx.strokeStyle = (a.red || b.red)
            ? `rgba(255,30,45,${0.10 * t})`
            : `rgba(255,255,255,${0.05 * t})`;
          cx.lineWidth = 1;
          cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.stroke();
        }
      }
    }
    for (const n of nodes) {
      cx.fillStyle = n.red ? 'rgba(255,30,45,0.6)' : 'rgba(255,255,255,0.35)';
      cx.beginPath(); cx.arc(n.x, n.y, n.r, 0, 7); cx.fill();
    }
    requestAnimationFrame(tickField);
  }
  requestAnimationFrame(tickField);

  /* ── HUD ── */
  const hud = document.createElement('header');
  hud.className = 'hud';
  hud.innerHTML = `
    <a href="/" class="hud-logo" data-nav>FUNFLIX<span>://OS</span></a>
    <div class="hud-mid">
      <span class="pulse-dot"></span>
      <span>SYS.NOMINAL</span>
      <span class="hud-dim">|</span>
      <span id="osClock">--:--:--</span>
      <span class="hud-dim">UTC</span>
    </div>
    <div class="hud-right">
      <div class="os-menu" id="osMenu">
        <button class="os-menu-btn" id="osMenuBtn">${current.id} / ${current.name} ${CHEV}</button>
        <nav class="os-menu-list">
          ${MODULES.map(m => `<a href="${m.path}" data-nav class="${m.path === current.path ? 'on' : ''}"><span class="mi">${m.id}</span><span>${m.name}</span><span class="md">${m.desc}</span></a>`).join('')}
        </nav>
      </div>
      ${document.body.dataset.access !== undefined ? '<button class="os-access-btn" id="osAccessBtn">ACCESS</button>' : ''}
    </div>`;
  document.body.prepend(hud);

  /* ── statusbar ── */
  const sb = document.createElement('footer');
  sb.className = 'statusbar';
  sb.innerHTML = `
    <div>FUNFLIX_OS <span class="hl">v2.077</span> &mdash; <span class="hl">${current.name}</span></div>
    <div class="sb-mid">MADE BY YOU &middot; MADE FOR YOU</div>
    <div><span class="kbd">&#8984;K</span> COMMAND &nbsp; <span class="hl" id="sbUp">T+00:00</span></div>`;
  document.body.append(sb);

  const t0 = Date.now();
  setInterval(() => {
    const c = document.getElementById('osClock');
    if (c) c.textContent = new Date().toISOString().slice(11, 19);
    const up = Math.floor((Date.now() - t0) / 1000);
    const u = document.getElementById('sbUp');
    if (u) u.textContent = `T+${String(Math.floor(up / 60)).padStart(2, '0')}:${String(up % 60).padStart(2, '0')}`;
  }, 1000);

  /* ── dropdown ── */
  const menu = document.getElementById('osMenu');
  document.getElementById('osMenuBtn').addEventListener('click', e => {
    e.stopPropagation();
    menu.classList.toggle('open');
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('#osMenu')) menu.classList.remove('open');
  });

  /* ── page-fade navigation ── */
  function nav(href) {
    document.body.classList.add('fade-out');
    setTimeout(() => { location.href = href; }, 170);
  }
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-nav]');
    if (a && a.href) { e.preventDefault(); nav(a.getAttribute('href')); }
  });

  /* ── custom cursor ── */
  if (matchMedia('(pointer: fine)').matches) {
    document.body.classList.add('os-cursor');
    const dot = document.createElement('div'); dot.id = 'curDot';
    const ring = document.createElement('div'); ring.id = 'curRing';
    document.body.append(dot, ring);
    let rx = -50, ry = -50;
    document.addEventListener('mousemove', e => {
      mouse.x = e.clientX; mouse.y = e.clientY;
      dot.style.left = e.clientX + 'px'; dot.style.top = e.clientY + 'px';
      const hot = e.target.closest('a, button, select, input, textarea, [data-hover]');
      ring.classList.toggle('hot', !!hot);
    });
    (function lerpRing() {
      rx += (mouse.x - rx) * 0.16; ry += (mouse.y - ry) * 0.16;
      ring.style.left = rx + 'px'; ring.style.top = ry + 'px';
      requestAnimationFrame(lerpRing);
    })();
  } else {
    document.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
  }

  /* ── command palette ── */
  const pal = document.createElement('div');
  pal.className = 'palette';
  pal.innerHTML = `
    <div class="pal-box">
      <div class="pal-head">
        <span class="pp">&gt;_</span>
        <input id="palInput" placeholder="type a command or destination&hellip;" autocomplete="off" spellcheck="false"/>
        <span class="pal-esc">ESC</span>
      </div>
      <div class="pal-list" id="palList"></div>
    </div>`;
  document.body.append(pal);
  const palInput = pal.querySelector('#palInput');
  const palList = pal.querySelector('#palList');
  let palItems = [], palSel = 0;

  function buildItems() {
    const items = MODULES.map(m => ({
      id: m.id, label: `GOTO ${m.name}`, hint: m.desc,
      run: () => nav(m.path),
      disabled: m.path === current.path,
    })).filter(i => !i.disabled);
    if (window.OS_PALETTE_EXTRA) items.push(...window.OS_PALETTE_EXTRA);
    return items;
  }

  function renderPal() {
    const q = palInput.value.trim().toLowerCase();
    palItems = buildItems().filter(i =>
      !q || i.label.toLowerCase().includes(q) || (i.hint || '').toLowerCase().includes(q));
    palSel = Math.min(palSel, Math.max(0, palItems.length - 1));
    palList.innerHTML = palItems.length
      ? palItems.map((i, n) => `<div class="pal-item ${n === palSel ? 'sel' : ''}" data-n="${n}"><span class="pi">${i.id}</span><span>${i.label}</span><span class="ph">${i.hint || ''}</span></div>`).join('')
      : '<div class="pal-empty">NO MATCHING COMMAND</div>';
  }

  const OS = window.OS = { paletteOpen: false };
  function openPal() {
    OS.paletteOpen = true;
    pal.classList.add('open');
    palInput.value = ''; palSel = 0;
    renderPal();
    setTimeout(() => palInput.focus(), 30);
  }
  function closePal() {
    OS.paletteOpen = false;
    pal.classList.remove('open');
  }

  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      OS.paletteOpen ? closePal() : openPal();
      return;
    }
    if (!OS.paletteOpen) return;
    if (e.key === 'Escape') { closePal(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); palSel = (palSel + 1) % palItems.length; renderPal(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); palSel = (palSel - 1 + palItems.length) % palItems.length; renderPal(); }
    else if (e.key === 'Enter' && palItems[palSel]) { closePal(); palItems[palSel].run(); }
  });
  palInput.addEventListener('input', () => { palSel = 0; renderPal(); });
  palList.addEventListener('click', e => {
    const it = e.target.closest('.pal-item');
    if (it) { closePal(); palItems[+it.dataset.n].run(); }
  });
  pal.addEventListener('click', e => { if (e.target === pal) closePal(); });

  /* ── text decode effect ── */
  const GLYPHS = '!<>-_\\/[]{}=+*^?#@%&';
  OS.decode = (el, duration = 900) => {
    const target = el.dataset.text ?? el.textContent;
    el.dataset.text = target;
    const start = performance.now();
    (function frame(now) {
      const p = Math.min(1, (now - start) / duration);
      const settled = Math.floor(target.length * p);
      let out = target.slice(0, settled);
      for (let i = settled; i < target.length; i++) {
        out += target[i] === ' ' ? ' ' : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }
      el.textContent = out;
      if (p < 1) requestAnimationFrame(frame);
    })(start);
  };

  /* ── 3D tilt ── */
  OS.tilt = (el, max = 7) => {
    el.style.transformStyle = 'preserve-3d';
    el.addEventListener('mousemove', e => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(800px) rotateY(${px * max}deg) rotateX(${-py * max}deg) translateZ(0)`;
      el.style.setProperty('--gx', `${(px + 0.5) * 100}%`);
      el.style.setProperty('--gy', `${(py + 0.5) * 100}%`);
    });
    el.addEventListener('mouseleave', () => {
      el.style.transition = 'transform 0.4s cubic-bezier(0.22,1,0.36,1)';
      el.style.transform = 'perspective(800px)';
      setTimeout(() => el.style.transition = '', 400);
    });
  };

  /* auto-init */
  window.addEventListener('load', () => {
    document.querySelectorAll('.decode').forEach((el, i) =>
      setTimeout(() => OS.decode(el), 150 + i * 120));
    document.querySelectorAll('.tilt').forEach(el => OS.tilt(el));
  });
})();
