/* ════════════════════════════════════════════════════════
   FUNFLIX — shared runtime
   injects the frame (nav, footer) and the ⌘K concierge
   ════════════════════════════════════════════════════════ */
(() => {
  const MODULES = [
    { id: '·',   name: 'Maison',      desc: 'the collection', path: '/' },
    { id: 'I',   name: 'Compute',     desc: 'instrument',     path: '/calculator' },
    { id: 'II',  name: 'Synthesis',   desc: 'image atelier',  path: '/meme' },
    { id: 'III', name: 'The Press',   desc: 'ai newsroom',    path: '/journalist' },
    { id: 'IV',  name: 'Flyuserfly',  desc: 'a noir, playable', path: '/game' },
    { id: 'V',   name: 'Costa Vista', desc: 'open world',     path: '/play/city-game' },
  ];
  const here = location.pathname.replace(/\/+$/, '') || '/';
  const current = MODULES.find(m => m.path === here) || MODULES[0];

  /* ── the frame: top bar ── */
  const hud = document.createElement('header');
  hud.className = 'hud';
  hud.innerHTML = `
    <div class="hud-inner">
      <a href="/" class="hud-logo" data-nav>Funflix<sup>&reg;</sup></a>
      <nav class="hud-links">
        ${MODULES.map(m => `<a href="${m.path}" data-nav class="${m.path === current.path ? 'on' : ''}">${m.name}</a>`).join('')}
      </nav>
      <div class="hud-right">
        <button class="hud-cta" id="hudCta">Enter</button>
        <button class="hud-burger" id="hudBurger" aria-label="Menu">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg>
        </button>
      </div>
      <div class="hud-mobile" id="hudMobile">
        ${MODULES.map(m => `<a href="${m.path}" data-nav class="${m.path === current.path ? 'on' : ''}">${m.name}</a>`).join('')}
      </div>
    </div>`;
  document.body.prepend(hud);

  /* ── the footer line ── */
  const sb = document.createElement('footer');
  sb.className = 'statusbar';
  sb.innerHTML = `
    <div>Funflix &mdash; <span class="hl">MMXXVI</span></div>
    <div class="sb-mid">${current.path === '/' ? 'Made by you &middot; Made for you' : 'No. ' + current.id + ' &mdash; ' + current.name}</div>
    <div><span class="kbd">&#8984;K</span> Concierge &nbsp; <span class="hl" id="osClock">--:--</span></div>`;
  document.body.append(sb);

  setInterval(() => {
    const c = document.getElementById('osClock');
    if (c) {
      const d = new Date();
      c.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
  }, 1000);

  /* ── nav behaviors ── */
  function nav(href) {
    document.body.classList.add('fade-out');
    setTimeout(() => { location.href = href; }, 210);
  }
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-nav]');
    if (a && a.href) { e.preventDefault(); nav(a.getAttribute('href')); }
  });

  document.getElementById('hudCta').addEventListener('click', () => {
    if (typeof window.openAccess === 'function') window.openAccess();
    else nav('/');
  });

  const mob = document.getElementById('hudMobile');
  document.getElementById('hudBurger').addEventListener('click', e => {
    e.stopPropagation();
    mob.classList.toggle('open');
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('#hudMobile, #hudBurger')) mob.classList.remove('open');
  });

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
      label: m.path === '/' ? 'Return to the Maison' : `Visit ${m.name}`,
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
