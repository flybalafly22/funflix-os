/* ════════════════════════════════════════════════════════
   FUNFLIX — MAISON · shared runtime
   injects the frame (nav, footer), gold-dust field,
   jewel cursor, and the ⌘K concierge
   ════════════════════════════════════════════════════════ */
(() => {
  const MODULES = [
    { id: '·',   name: 'MAISON',      desc: 'the collection',      path: '/' },
    { id: 'I',   name: 'COMPUTE',     desc: 'instrument',          path: '/calculator' },
    { id: 'II',  name: 'SYNTHESIS',   desc: 'image atelier',       path: '/meme' },
    { id: 'III', name: 'THE PRESS',   desc: 'ai newsroom',         path: '/journalist' },
    { id: 'IV',  name: 'FLYUSERFLY',  desc: 'a noir, playable',    path: '/game' },
    { id: 'V',   name: 'COSTA VISTA', desc: 'open world',          path: '/play/city-game' },
  ];
  const here = location.pathname.replace(/\/+$/, '') || '/';
  const current = MODULES.find(m => m.path === here) || MODULES[0];

  /* ── gold dust field (skipped on pages that render their own scene) ── */
  const FX = document.body.dataset.nofx === undefined;
  const mouse = { x: -9999, y: -9999 };
  const cv = document.createElement('canvas');
  cv.id = 'fxCanvas';
  if (FX) document.body.prepend(cv);
  const cx = cv.getContext('2d');
  let W, H, DPR, motes = [];

  function sizeCanvas() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * DPR; cv.height = H * DPR;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    cx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  if (FX) {
    sizeCanvas();
    window.addEventListener('resize', sizeCanvas);
  }

  const N = FX ? Math.min(70, Math.floor(window.innerWidth / 22)) : 0;
  for (let i = 0; i < N; i++) {
    const big = Math.random() < 0.12;
    motes.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: big ? 2.2 + Math.random() * 2.6 : 0.6 + Math.random() * 1.1,
      vy: -(0.08 + Math.random() * 0.22),
      sway: Math.random() * Math.PI * 2,
      swayV: 0.002 + Math.random() * 0.006,
      tw: Math.random() * Math.PI * 2,
      twV: 0.008 + Math.random() * 0.02,
      big,
    });
  }

  function tickField() {
    cx.clearRect(0, 0, W, H);
    for (const m of motes) {
      m.y += m.vy;
      m.sway += m.swayV;
      m.tw += m.twV;
      m.x += Math.sin(m.sway) * 0.18;
      const dx = m.x - mouse.x, dy = m.y - mouse.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 14400) { // a gentle breath away from the cursor
        const d = Math.sqrt(d2) || 1;
        m.x += (dx / d) * 0.35; m.y += (dy / d) * 0.35;
      }
      if (m.y < -10) { m.y = H + 10; m.x = Math.random() * W; }
      if (m.x < -10) m.x = W + 10;
      if (m.x > W + 10) m.x = -10;
      const a = (0.18 + Math.sin(m.tw) * 0.14) * (m.big ? 0.5 : 1);
      if (m.big) {
        const g = cx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 3);
        g.addColorStop(0, `rgba(200,164,93,${a})`);
        g.addColorStop(1, 'rgba(200,164,93,0)');
        cx.fillStyle = g;
        cx.beginPath(); cx.arc(m.x, m.y, m.r * 3, 0, 7); cx.fill();
      } else {
        cx.fillStyle = `rgba(226,200,144,${a + 0.1})`;
        cx.beginPath(); cx.arc(m.x, m.y, m.r, 0, 7); cx.fill();
      }
    }
    requestAnimationFrame(tickField);
  }
  if (FX) requestAnimationFrame(tickField);

  /* ── the frame: top bar (pages with data-nohud build their own) ── */
  const NOHUD = document.body.dataset.nohud !== undefined;
  const hud = document.createElement('header');
  hud.className = 'hud';
  hud.innerHTML = `
    <a href="/" class="hud-logo" data-nav>FUNFLIX<span class="reg">&reg;</span></a>
    <div class="hud-mid">Made by you &middot; Made for you</div>
    <div class="hud-right">
      <div class="os-menu" id="osMenu">
        <button class="os-menu-btn" id="osMenuBtn">Collection</button>
        <nav class="os-menu-list">
          ${MODULES.map(m => `<a href="${m.path}" data-nav class="${m.path === current.path ? 'on' : ''}"><span class="mi">${m.id === '·' ? '&middot;' : 'No. ' + m.id}</span><span>${m.name}</span><span class="md">${m.desc}</span></a>`).join('')}
        </nav>
      </div>
      ${document.body.dataset.access !== undefined ? '<button class="os-access-btn" id="osAccessBtn">Enter</button>' : ''}
    </div>`;
  if (!NOHUD) document.body.prepend(hud);

  /* ── the footer line ── */
  const sb = document.createElement('footer');
  sb.className = 'statusbar';
  sb.innerHTML = `
    <div>FUNFLIX &mdash; <span class="hl">MMXXVI</span></div>
    <div class="sb-mid">${current.path === '/' ? 'A private collection of digital instruments' : 'No. ' + current.id + ' &mdash; ' + current.name}</div>
    <div><span class="kbd">&#8984;K</span> Concierge &nbsp; <span class="hl" id="osClock">--:--</span></div>`;
  document.body.append(sb);

  setInterval(() => {
    const c = document.getElementById('osClock');
    if (c) {
      const d = new Date();
      c.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
  }, 1000);

  /* ── dropdown ── */
  const menu = document.getElementById('osMenu');
  if (menu) {
    document.getElementById('osMenuBtn').addEventListener('click', e => {
      e.stopPropagation();
      menu.classList.toggle('open');
    });
    document.addEventListener('click', e => {
      if (!e.target.closest('#osMenu')) menu.classList.remove('open');
    });
  }

  /* ── page-fade navigation ── */
  function nav(href) {
    document.body.classList.add('fade-out');
    setTimeout(() => { location.href = href; }, 240);
  }
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-nav]');
    if (a && a.href) { e.preventDefault(); nav(a.getAttribute('href')); }
  });

  /* ── jewel cursor ── */
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
      rx += (mouse.x - rx) * 0.14; ry += (mouse.y - ry) * 0.14;
      ring.style.left = rx + 'px'; ring.style.top = ry + 'px';
      requestAnimationFrame(lerpRing);
    })();
  } else {
    document.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
  }

  /* ── the concierge (⌘K) ── */
  const pal = document.createElement('div');
  pal.className = 'palette';
  pal.innerHTML = `
    <div class="pal-box">
      <div class="pal-head">
        <span class="pp">&#10022;</span>
        <input id="palInput" placeholder="How may we serve you&hellip;" autocomplete="off" spellcheck="false"/>
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
      id: m.id === '·' ? '&middot;' : m.id,
      label: m.path === '/' ? 'Return to the Maison' : `Visit ${m.name.charAt(0) + m.name.slice(1).toLowerCase()}`,
      hint: m.path === '/' ? 'the collection' : `No. ${m.id} — ${m.desc}`,
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
      : '<div class="pal-empty">Regrettably, nothing matches. Try another word.</div>';
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

  /* ── text decode (the games still perform it) ── */
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

  /* ── 3D tilt (kept for any page that requests it) ── */
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

  window.addEventListener('load', () => {
    document.querySelectorAll('.decode').forEach((el, i) =>
      setTimeout(() => OS.decode(el), 150 + i * 120));
    document.querySelectorAll('.tilt').forEach(el => OS.tilt(el));
  });
})();
