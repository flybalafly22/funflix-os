/* ════════════════════════════════════════════════════════
   THE TRAINER (by Funflix): shared runtime
   injects the frame (nav, Apps menu, footer), the one account door,
   the light/dark switch on pages that opt in, and the ⌘K concierge
   ════════════════════════════════════════════════════════ */
(() => {
  // The Trainer is the flagship; the rest of the house stays one tap away.
  const MODULES = [
    { id: '·',    name: 'Home',        desc: 'the front door',                     path: '/' },
    { id: 'VIII', name: 'The Trainer', desc: 'your program, your log, your coach', path: '/trainer', flag: true },
    { id: 'VI',   name: 'The Study',   desc: 'a data demo on simulated supplements', path: '/study' },
    { id: 'I',    name: 'Compute',     desc: 'a precise scientific calculator',    path: '/calculator' },
    { id: 'III',  name: 'The Press',   desc: 'a newsroom run by one machine',      path: '/journalist' },
    { id: 'II',   name: 'Synthesis',   desc: 'a studio for making jokes',          path: '/meme' },
    { id: 'IV',   name: 'Flyuserfly',  desc: 'a noir mystery you play',            path: '/game' },
    { id: 'VII',  name: 'The Fly',     desc: 'deliveries over a hand-built town',  path: '/play/the-fly' },
    { id: 'V',    name: 'Costa Vista', desc: 'an open city at golden hour',        path: '/play/city-game' },
  ];
  const here = location.pathname.replace(/\/+$/, '') || '/';
  const current = MODULES.find(m => m.path === here) || MODULES[0];

  /* ── the frame: top bar ── */
  if (!window.OS_NO_CHROME) {
  const hud = document.createElement('header');
  hud.className = 'hud';
  const themeable = document.documentElement.hasAttribute('data-themeable');
  const THEME_ICONS = '<svg class="ic-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.4"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></svg>' +
    '<svg class="ic-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4 6.2 6.2 0 0 0 20 14.5z"/></svg>';
  hud.innerHTML = `
    <div class="hud-inner">
      <a href="/" class="hud-logo" data-nav aria-label="The Trainer, home"><b>THE&nbsp;TRAINER</b><span>by Funflix</span></a>
      <nav class="hud-links" aria-label="Main">
        <a href="/trainer" data-nav class="flag${current.path === '/trainer' ? ' on' : ''}">The Trainer<i class="nav-flag" aria-hidden="true"></i></a>
      </nav>
      <button class="hud-apps" id="hudBurger" type="button" aria-haspopup="true" aria-expanded="false" aria-controls="hudMobile" aria-label="Apps"><span class="apps-label">Apps</span>
        <svg class="apps-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
        <svg class="apps-grid" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="6" cy="6" r="2"/><circle cx="12" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="12" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="12" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg></button>
      ${themeable ? '<button class="hud-theme" id="hudTheme" type="button" aria-label="Switch between light and dark">' + THEME_ICONS + '</button>' : ''}
      <button class="hud-cta" id="hudCta" type="button">Sign in</button>
      <div class="hud-mobile" id="hudMobile">
        <div class="hm-k">The house</div>
        ${MODULES.map(m => `<a href="${m.path}" data-nav class="${m.path === current.path ? 'on' : ''}${m.flag ? ' flag' : ''}">${m.name}<small>${m.desc}</small></a>`).join('')}
      </div>
    </div>`;
  document.body.prepend(hud);

  /* ── the footer line ── */
  const sb = document.createElement('footer');
  sb.className = 'statusbar';
  sb.innerHTML = `
    <div><a href="/" data-nav>The Trainer</a> by Funflix &middot; <span class="hl">MMXXVI</span></div>
    <div class="sb-mid">${current.path === '/' ? 'In your corner' : 'No. ' + current.id + ' &middot; ' + current.name}</div>
    <div><span class="kbd">&#8984;K</span> Concierge &nbsp; <span class="hl" id="osClock">--:--</span></div>`;
  document.body.append(sb);

  setInterval(() => {
    const c = document.getElementById('osClock');
    if (c) {
      const d = new Date();
      c.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
  }, 1000);
  }

  /* ── nav behaviors ── */
  function nav(href) {
    document.body.classList.add('fade-out');
    setTimeout(() => { location.href = href; }, 210);
  }
  document.addEventListener('click', e => {
    // respect open-in-new-tab (cmd/ctrl/shift/middle-click)
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    const a = e.target.closest('[data-nav]');
    if (a && a.href) { e.preventDefault(); nav(a.getAttribute('href')); }
  });
  // Clear the page-transition fade on load AND on back/forward-cache restore.
  // Without this, hitting the browser Back button restores the page from bfcache
  // with body.fade-out still applied (opacity:0) → the page looks blank / "doesn't load".
  window.addEventListener('pageshow', () => { document.body.classList.remove('fade-out'); });

  /* ══════════ the account: one identity, one door, every page ══════════
     Self-contained (own styles, no os.css dependency) so it also runs on
     bespoke pages like the homepage via window.OS_NO_CHROME. */
  const ACCT = window.OS_ACCT = {
    enabled: false, user: null, _subs: [],
    on(fn) { this._subs.push(fn); },
    _emit(event) { this._subs.forEach(fn => { try { fn({ enabled: this.enabled, user: this.user, event }); } catch (e) {} }); },
    open() { acctOpen(); },
    close() { acctClose(); },
  };
  function acctGo() { acctOpen(); }

  /* Everything The Trainer keeps in this browser is under a "trainer" key (the theme
     choice excepted). Signing out ON ANY PAGE removes all of it, plus the home page's
     handoff, so the next person on a shared device starts clean. */
  function wipeTrainerDevice() {
    try {
      Object.keys(localStorage).forEach(k => {
        if (k.indexOf('trainer') === 0 && k !== 'trainerTheme') localStorage.removeItem(k);
      });
    } catch (e) {}
    try { sessionStorage.removeItem('trainerHandoff'); } catch (e) {}
  }
  ACCT.wipeDevice = wipeTrainerDevice;

  const acctCSS = document.createElement('style');
  acctCSS.textContent = `
    .osacct { --ac-bg: #FFFFFF; --ac-ink: #0B0F2E; --ac-2: #474B66; --ac-3: #5B5F7B; --ac-line: #D0D5E5;
      --ac-line-2: #E3E6F0; --ac-acc: #2B3BFF; --ac-on-acc: #FFFFFF; --ac-soft: #EEF0FF; --ac-err: #A8321F;
      --ac-scrim: rgba(11,15,46,.40);
      position: fixed; inset: 0; z-index: 900; background: var(--ac-scrim);
      display: flex; align-items: center; justify-content: center; padding: 20px; }
    :root[data-theme="dark"] .osacct { --ac-bg: #10153A; --ac-ink: #EEF1FF; --ac-2: #B3B8D8; --ac-3: #979DC0;
      --ac-line: #2A3163; --ac-line-2: #1B2146; --ac-acc: #8C9BFF; --ac-on-acc: #070A1A; --ac-soft: #1A2050;
      --ac-err: #FF8E7E; --ac-scrim: rgba(0,0,0,.55); color-scheme: dark; }
    .osacct[hidden] { display: none; }
    .osacct * { box-sizing: border-box; margin: 0; }
    .osacct .ac-card { position: relative; width: min(480px, 100%); max-height: 88vh; overflow-y: auto;
      background: var(--ac-bg); color: var(--ac-ink); border: 1px solid var(--ac-line); border-radius: 26px; padding: 40px 42px 34px;
      box-shadow: 0 40px 120px rgba(7,10,26,.35); font-family: 'Geist',system-ui,sans-serif; }
    @media (max-width: 560px) { .osacct .ac-card { padding: 30px 22px 26px; } }
    .osacct .ac-lead { font-family: 'Bricolage Grotesque','Geist',system-ui,sans-serif; font-weight: 800;
      font-size: clamp(26px, 4.5vw, 32px); line-height: 1.08; letter-spacing: -0.02em; color: var(--ac-ink); padding-right: 70px; }
    .osacct .ac-lead em { font-style: normal; color: var(--ac-acc); }
    .osacct .ac-sub { margin-top: 12px; font-size: 14px; line-height: 1.6; color: var(--ac-2); }
    .osacct .ac-close { position: absolute; top: 14px; right: 14px; background: transparent;
      border: 1px solid var(--ac-line); border-radius: 999px; padding: 0 16px; min-height: 38px; font-size: 13px;
      font-weight: 600; color: var(--ac-2); cursor: pointer; font-family: inherit; }
    .osacct .ac-close:hover { border-color: var(--ac-ink); color: var(--ac-ink); }
    .osacct .ac-field { margin-top: 20px; }
    .osacct label { display: block; font-family: 'Geist Mono',monospace; font-size: 11px;
      letter-spacing: .14em; text-transform: uppercase; color: var(--ac-3); margin-bottom: 8px; }
    .osacct input { width: 100%; background: transparent; border: none; border-bottom: 1.5px solid var(--ac-line);
      border-radius: 0; padding: 10px 2px; font-family: inherit; font-size: 16px; font-weight: 500; color: var(--ac-ink); outline: none; }
    .osacct input:focus { border-bottom-color: var(--ac-acc); }
    .osacct input::placeholder { color: var(--ac-3); }
    .osacct button:focus-visible, .osacct a:focus-visible, .osacct input:focus-visible { outline: 2px solid var(--ac-acc); outline-offset: 3px; }
    .osacct .ac-hint { margin-top: 8px; font-size: 12px; color: var(--ac-3); }
    .osacct .ac-link { background: none; border: none; padding: 0; font: inherit; font-size: 12.5px; font-weight: 600;
      color: var(--ac-acc); cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
    .osacct .ac-err { margin-top: 12px; font-size: 13.5px; color: var(--ac-err); }
    .osacct .ac-err:empty, .osacct .ac-ok:empty { display: none; }
    .osacct .ac-btns { display: flex; gap: 10px; margin-top: 26px; align-items: center; flex-wrap: wrap; }
    /* the display:flex above outranks the UA [hidden] rule, so hidden button rows
       (OTP / reset steps) would otherwise all show at once, so re-hide them */
    .osacct .ac-btns[hidden] { display: none; }
    .osacct .ac-primary { flex: 1; background: var(--ac-acc); color: var(--ac-on-acc); border: none; border-radius: 999px;
      font-family: inherit; font-size: 15px; font-weight: 600; padding: 0 26px; min-height: 50px; cursor: pointer;
      transition: transform .2s; }
    .osacct .ac-primary:hover { transform: translateY(-1px); }
    .osacct .ac-ghost { background: transparent; border: 1px solid var(--ac-line); border-radius: 999px;
      padding: 0 22px; min-height: 50px; font-family: inherit; font-size: 14px; font-weight: 600; color: var(--ac-ink); cursor: pointer; }
    .osacct .ac-ghost:hover { border-color: var(--ac-ink); }
    .osacct .ac-who { margin-top: 3px; font-family: 'Geist Mono',monospace; font-size: 12px;
      letter-spacing: .03em; color: var(--ac-acc); overflow: hidden; text-overflow: ellipsis; }
    .osacct .ac-prof { display: flex; gap: 16px; align-items: center; min-width: 0; padding-right: 70px; }
    .osacct .ac-prof > div:last-child { min-width: 0; }
    .osacct .ac-ava { width: 56px; height: 56px; border-radius: 999px; flex: none; display: flex;
      align-items: center; justify-content: center; font-family: 'Bricolage Grotesque','Geist',sans-serif; font-weight: 800;
      font-size: 24px; color: var(--ac-on-acc); background: var(--ac-acc); text-transform: uppercase; }
    .osacct .ac-name { font-family: 'Bricolage Grotesque','Geist',sans-serif; font-weight: 800;
      font-size: clamp(22px, 4vw, 27px); line-height: 1.1; letter-spacing: -0.02em; color: var(--ac-ink); text-transform: capitalize;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .osacct .ac-since { margin-top: 4px; font-size: 12px; color: var(--ac-3); }
    .osacct .ac-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px;
      background: var(--ac-line-2); border: 1px solid var(--ac-line-2); border-radius: 16px; overflow: hidden; margin-top: 22px; }
    .osacct .ac-stat { background: var(--ac-bg); padding: 13px 8px 11px; text-align: center; }
    .osacct .ac-stat b { display: block; font-family: 'Bricolage Grotesque','Geist',sans-serif; font-weight: 700;
      font-size: 21px; color: var(--ac-ink); font-variant-numeric: tabular-nums; }
    .osacct .ac-stat span { display: block; margin-top: 4px; font-family: 'Geist Mono',monospace;
      font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: var(--ac-3); }
    .osacct .ac-ok { margin-top: 12px; font-size: 13.5px; color: var(--ac-acc); }
    .osacct a.ac-ghost { text-decoration: none; display: inline-flex; align-items: center; justify-content: center; }
    .osacct .ac-danger { margin-top: 26px; padding-top: 16px; border-top: 1px dashed var(--ac-line); }
    .osacct .ac-del-link { background: none; border: none; padding: 0; font-family: inherit;
      font-size: 12.5px; color: var(--ac-3); cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
    .osacct .ac-del-link:hover { color: var(--ac-err); }
    .osacct .ac-danger-btn { background: var(--ac-err); color: #fff; }
    :root[data-theme="dark"] .osacct .ac-danger-btn { color: #070A1A; }
    .osacct .ac-status { margin-top: 14px; font-size: 14px; line-height: 1.6; color: var(--ac-2); }
    .osacct .ac-hist-head { margin-top: 26px; font-family: 'Geist Mono',monospace; font-size: 11px;
      letter-spacing: .14em; text-transform: uppercase; color: var(--ac-acc); }
    .osacct .ac-hrow { display: flex; align-items: baseline; gap: 12px; padding: 12px 0;
      border-bottom: 1px solid var(--ac-line-2); cursor: pointer; }
    .osacct .ac-hrow:last-child { border-bottom: none; }
    .osacct .ac-hrow .hd { font-family: 'Geist Mono',monospace; font-size: 11px; color: var(--ac-3); white-space: nowrap; }
    .osacct .ac-hrow .hg { flex: 1; font-size: 14px; font-weight: 600; color: var(--ac-ink);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .osacct .ac-hrow:hover .hg { color: var(--ac-acc); }
    .osacct .ac-hrow .hk { font-family: 'Geist Mono',monospace; font-size: 11px; color: var(--ac-3); white-space: nowrap; }
    .osacct .ac-next { display: inline-block; margin-top: 14px; font-size: 14px; font-weight: 600;
      color: var(--ac-acc); text-decoration: none; }
    .osacct .ac-next:hover { text-decoration: underline; }
    @keyframes osacctIn { from { opacity: 0; transform: translateY(10px) scale(.985); } to { opacity: 1; transform: none; } }
    .osacct .ac-card { animation: osacctIn .28s cubic-bezier(.2,.7,.2,1); }
    @media (prefers-reduced-motion: reduce) { .osacct .ac-card { animation: none; } }
    @media print { .osacct { display: none !important; } }`;
  document.head.appendChild(acctCSS);

  const acctEl = document.createElement('div');
  acctEl.className = 'osacct';
  acctEl.id = 'acct';
  acctEl.hidden = true;
  acctEl.setAttribute('role', 'dialog');
  acctEl.setAttribute('aria-modal', 'true');
  acctEl.setAttribute('aria-label', 'Your account');
  acctEl.innerHTML = `
    <div class="ac-card">
      <button class="ac-close" id="acClose" type="button">Close</button>
      <div id="acOut">
        <div class="ac-lead">Your training, <em>on every device</em></div>
        <div class="ac-sub">One free account keeps your program, workout logs and check-ins in sync
          between this browser and your phone. Without one, your plan and logs are stored only in this
          browser. Either way, building a plan, asking a question or checking in sends your answers to
          our AI provider (Google Gemini) to write the reply; nothing is stored on our server.</div>
        <div id="acForm">
          <div class="ac-field"><label for="acEmail">Email</label>
            <input id="acEmail" type="email" autocomplete="email"></div>
          <div class="ac-field"><label for="acPw">Password (8+ characters)</label>
            <input id="acPw" type="password" autocomplete="current-password">
            <div class="ac-hint"><button type="button" class="ac-link" id="acForgot">Forgot your password?</button></div></div>
        </div>
        <div id="acOtp" hidden>
          <div class="ac-sub" id="acOtpMsg"></div>
          <div class="ac-field"><label for="acCode">6-digit code</label>
            <input id="acCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000"></div>
        </div>
        <div id="acReset" hidden>
          <div class="ac-sub" id="acRsMsg"></div>
          <div class="ac-field"><label for="acRsCode">6-digit code</label>
            <input id="acRsCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000"></div>
          <div class="ac-field"><label for="acRsPw">New password (8+ characters)</label>
            <input id="acRsPw" type="password" autocomplete="new-password"></div>
        </div>
        <div class="ac-err" id="acErr" role="alert"></div>
        <div class="ac-ok" id="acNote"></div>
        <div class="ac-btns" id="acFormBtns">
          <button class="ac-primary" id="acRegister" type="button">Create account</button>
          <button class="ac-ghost" id="acLogin" type="button">Sign in</button>
        </div>
        <div class="ac-btns" id="acOtpBtns" hidden>
          <button class="ac-primary" id="acVerify" type="button">Verify &amp; create account</button>
          <button class="ac-ghost" id="acOtpBack" type="button">Back</button>
        </div>
        <div class="ac-btns" id="acRsBtns" hidden>
          <button class="ac-primary" id="acRsVerify" type="button">Set new password</button>
          <button class="ac-ghost" id="acRsBack" type="button">Back</button>
        </div>
      </div>
      <div id="acIn" hidden>
        <div class="ac-prof">
          <div class="ac-ava" id="acAva"></div>
          <div>
            <div class="ac-name" id="acName"></div>
            <div class="ac-who" id="acWho"></div>
            <div class="ac-since" id="acSince"></div>
          </div>
        </div>
        <div class="ac-stats" id="acStats" hidden>
          <div class="ac-stat"><b id="acStPlan">&middot;</b><span>plan synced</span></div>
          <div class="ac-stat"><b id="acStLogs">0</b><span>sessions logged</span></div>
          <div class="ac-stat"><b id="acStHist">0</b><span>archived plans</span></div>
        </div>
        <div class="ac-status">Your plan and logs follow you: phone at the gym, laptop at home.
          Everything still works offline, and changes sync when you're back.</div>
        <a class="ac-next" id="acGoTrainer" href="/trainer" style="display:none">Open The Trainer &rarr;</a>
        <div class="ac-hist-head" id="acHistHead" hidden>Plan history</div>
        <div id="acHist"></div>
        <div class="ac-btns">
          <a class="ac-ghost" id="acExport" href="/api/export" download="the-trainer-export.json">Export my data</a>
          <button class="ac-ghost" id="acLogout" type="button">Sign out</button>
        </div>
        <div class="ac-danger">
          <button class="ac-del-link" id="acDelOpen" type="button">Delete my account&hellip;</button>
          <div id="acDelBox" hidden>
            <div class="ac-sub">This permanently wipes your account and every synced record from our
              server: plan, logs and archived plans. Data saved on this device stays yours.
              Export first if you want a copy. Type your password to confirm.</div>
            <div class="ac-field"><label for="acDelPw">Password</label>
              <input id="acDelPw" type="password" autocomplete="current-password"></div>
            <div class="ac-err" id="acDelErr" role="alert"></div>
            <div class="ac-btns">
              <button class="ac-primary ac-danger-btn" id="acDelGo" type="button">Delete forever</button>
              <button class="ac-ghost" id="acDelCancel" type="button">Keep my account</button>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(acctEl);
  const $a = id => acctEl.querySelector('#' + id);
  const escA = s => { const d = document.createElement('div'); d.textContent = String(s == null ? '' : s); return d.innerHTML; };

  function acctPanels() {
    $a('acOut').hidden = !!ACCT.user;
    $a('acIn').hidden = !ACCT.user;
    if (ACCT.user) {
      $a('acWho').textContent = ACCT.user;
      $a('acName').textContent = ACCT.user.split('@')[0].replace(/[._-]+/g, ' ');
      $a('acAva').textContent = ACCT.user.charAt(0);
    } else {
      $a('acSince').textContent = '';
      $a('acStats').hidden = true;
      $a('acDelBox').hidden = true;
      $a('acDelPw').value = '';
      $a('acDelErr').textContent = '';
    }
    $a('acGoTrainer').style.display =
      (ACCT.user && location.pathname.indexOf('/trainer') !== 0) ? '' : 'none';
  }
  async function acctProfile() {
    if (!ACCT.user) return;
    try {
      const d = await (await fetch('/api/profile')).json();
      if (!d.user || d.user !== ACCT.user) return;
      const dd = ms => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      $a('acStPlan').textContent = d.plan_at ? dd(d.plan_at) : '·';
      $a('acStLogs').textContent = d.logs_n || 0;
      $a('acStHist').textContent = d.history_n || 0;
      if (d.since) $a('acSince').textContent = 'Member since ' +
        new Date(d.since).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      $a('acStats').hidden = false;
    } catch (e) {}
  }
  let acctReturn = null;
  function acctFocusables() {
    return Array.prototype.filter.call(acctEl.querySelectorAll('button, a[href], input'),
      el => !el.disabled && el.offsetParent !== null);
  }
  function acctOpen() {
    acctReturn = document.activeElement;
    $a('acNote').textContent = ''; acctPanels(); acctHistory(); acctProfile(); acctEl.hidden = false;
    setTimeout(() => { const f = ACCT.user ? $a('acClose') : $a('acEmail'); if (f) f.focus(); }, 30);
  }
  function acctClose() {
    acctEl.hidden = true;
    if (acctReturn && acctReturn.focus && document.contains(acctReturn)) acctReturn.focus();
    acctReturn = null;
  }
  acctEl.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); hideOtpStep(); hideResetStep(); acctClose(); return; }
    if (e.key !== 'Tab') return;
    const f = acctFocusables(); if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  function refreshCtas() {
    const cta = document.getElementById('hudCta');
    if (cta) {
      // accounts need the server's database; without it there is no door to show
      cta.hidden = ACCT.ready && !ACCT.enabled;
      const who = ACCT.user ? ACCT.user.split('@')[0] : '';
      cta.classList.toggle('is-user', !!who);
      cta.innerHTML = who
        ? '<span class="cta-full">' + escA(who) + '</span><span class="cta-init" aria-hidden="true">' + escA(who.charAt(0)) + '</span>'
        : 'Sign in';
      cta.setAttribute('aria-label', who ? 'Your account: ' + who : 'Sign in or create a free account');
      cta.title = ACCT.user
        ? 'Your account: training synced on every device'
        : 'Free account: your plan, workout log and check-ins on every device';
    }
  }
  async function acctHistory() {
    $a('acHistHead').hidden = true;
    $a('acHist').innerHTML = '';
    if (!ACCT.user) return;
    try {
      const d = await (await fetch('/api/history')).json();
      const h = d.history || [];
      if (!h.length) return;
      $a('acHistHead').hidden = false;
      $a('acHist').innerHTML = h.map(x => '<div class="ac-hrow" data-id="' + x.id + '">' +
        '<span class="hd">' + new Date(x.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + '</span>' +
        '<span class="hg">' + escA(x.goal) + '</span>' +
        '<span class="hk">' + (x.kcal ? escA(x.kcal) + ' kcal · ' : '') + escA(x.days) + ' days/wk</span></div>').join('');
    } catch (e) {}
  }
  $a('acHist').addEventListener('click', e => {
    const row = e.target.closest('.ac-hrow');
    if (!row) return;
    acctClose();
    if (typeof window.TRAINER_VIEW_HISTORY === 'function') window.TRAINER_VIEW_HISTORY(row.dataset.id);
    else nav('/trainer#history=' + row.dataset.id);
  });
  function finishLogin(d) {
    ACCT.user = d.user;
    $a('acPw').value = '';
    if ($a('acCode')) $a('acCode').value = '';
    if ($a('acRsCode')) $a('acRsCode').value = '';
    if ($a('acRsPw')) $a('acRsPw').value = '';
    hideOtpStep(); hideResetStep();
    acctPanels(); acctHistory(); acctProfile(); refreshCtas(); ACCT._emit('login');
  }
  function showOtpStep(email) {
    $a('acErr').textContent = '';
    $a('acForm').hidden = true; $a('acFormBtns').hidden = true;
    $a('acOtp').hidden = false; $a('acOtpBtns').hidden = false;
    $a('acOtpMsg').innerHTML = 'Enter the 6-digit code we emailed to <b>' + escA(email || 'your inbox') +
      '</b>. Your account is created only once the code is verified.';
    $a('acCode').focus();
  }
  function hideOtpStep() {
    if (!$a('acOtp')) return;
    $a('acOtp').hidden = true; $a('acOtpBtns').hidden = true;
    $a('acForm').hidden = false; $a('acFormBtns').hidden = false;
  }
  function showResetStep(email) {
    $a('acErr').textContent = '';
    $a('acForm').hidden = true; $a('acFormBtns').hidden = true;
    $a('acReset').hidden = false; $a('acRsBtns').hidden = false;
    $a('acRsMsg').innerHTML = 'If <b>' + escA(email || 'that address') + '</b> has an account, we emailed ' +
      'it a 6-digit code. Enter it with a new password to sign back in.';
    $a('acRsCode').focus();
  }
  function hideResetStep() {
    if (!$a('acReset')) return;
    $a('acReset').hidden = true; $a('acRsBtns').hidden = true;
    $a('acForm').hidden = false; $a('acFormBtns').hidden = false;
  }
  async function acctPost(path, body) {
    $a('acErr').textContent = '';
    try {
      const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok || d.error) { $a('acErr').textContent = d.error || 'Something went wrong.'; return null; }
      return d;
    } catch (e) { $a('acErr').textContent = 'Could not reach the server.'; return null; }
  }
  async function acctCall(path) {   // sign in
    const d = await acctPost(path, { email: $a('acEmail').value, password: $a('acPw').value });
    if (d) finishLogin(d);
  }
  async function registerStart() {
    const d = await acctPost('/api/auth/register/start',
      { email: $a('acEmail').value, password: $a('acPw').value });
    if (!d) return;
    if (d.otp) showOtpStep(d.email); else finishLogin(d);   // OTP required, or direct-signup fallback
  }
  async function verifyOtp() {
    const d = await acctPost('/api/auth/register/verify', { code: $a('acCode').value });
    if (d) finishLogin(d);
  }
  async function resetStart() {
    const email = ($a('acEmail').value || '').trim();
    if (!email) { $a('acErr').textContent = 'Enter your email first, then tap “Forgot your password?”.'; return; }
    const d = await acctPost('/api/auth/reset/start', { email: email });
    if (d) showResetStep(email);   // same step whether or not the address has an account
  }
  async function resetVerify() {
    const d = await acctPost('/api/auth/reset/verify',
      { code: $a('acRsCode').value, password: $a('acRsPw').value });
    if (d) finishLogin(d);
  }
  $a('acClose').addEventListener('click', () => { hideOtpStep(); hideResetStep(); acctClose(); });
  acctEl.addEventListener('click', e => { if (e.target === acctEl) { hideOtpStep(); hideResetStep(); acctClose(); } });
  $a('acRegister').addEventListener('click', registerStart);
  $a('acLogin').addEventListener('click', () => acctCall('/api/auth/login'));
  $a('acVerify').addEventListener('click', verifyOtp);
  $a('acOtpBack').addEventListener('click', () => { hideOtpStep(); $a('acErr').textContent = ''; });
  $a('acForgot').addEventListener('click', resetStart);
  $a('acRsVerify').addEventListener('click', resetVerify);
  $a('acRsBack').addEventListener('click', () => { hideResetStep(); $a('acErr').textContent = ''; });
  $a('acLogout').addEventListener('click', async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch (e) {}
    ACCT.user = null;
    wipeTrainerDevice();        // on whichever page the sign-out happens
    acctPanels(); refreshCtas(); acctClose(); ACCT._emit('logout');
  });
  $a('acDelOpen').addEventListener('click', () => {
    const box = $a('acDelBox');
    box.hidden = !box.hidden;
    if (!box.hidden) $a('acDelPw').focus();
  });
  $a('acDelCancel').addEventListener('click', () => { $a('acDelBox').hidden = true; $a('acDelErr').textContent = ''; });
  $a('acDelGo').addEventListener('click', async () => {
    $a('acDelErr').textContent = '';
    try {
      const r = await fetch('/api/auth/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: $a('acDelPw').value }) });
      const d = await r.json();
      if (!r.ok || d.error) { $a('acDelErr').textContent = d.error || 'Something went wrong.'; return; }
      ACCT.user = null;
      try { localStorage.removeItem('trainerOwner'); } catch (e) {}   // the copy here is now plain guest data
      acctPanels(); refreshCtas(); ACCT._emit('deleted');
      $a('acNote').textContent = 'Account deleted. Every record on our server is gone. Your plan and logs are still in this browser; “Clear this data” on the Trainer removes them too.';
    } catch (e) { $a('acDelErr').textContent = 'Could not reach the server.'; }
  });

  const hudCtaEl = document.getElementById('hudCta');
  if (hudCtaEl) hudCtaEl.addEventListener('click', () => {
    // before /api/auth/me resolves, assume accounts exist: the modal is honest
    // about failures; silently dumping the user to the homepage is not
    if (ACCT.enabled || !ACCT.ready) { acctOpen(); return; }
    if (typeof window.openAccess === 'function') window.openAccess();
    else nav('/');
  });

  // any state change (including ones raised by page engines, e.g. the
  // trainer detecting a dead session) refreshes every chrome surface
  ACCT.on(() => { refreshCtas(); acctPanels(); });

  ACCT.ready = false;
  async function refreshMe(first) {
    try {
      const d = await (await fetch('/api/auth/me')).json();
      const changed = ACCT.user !== (d.user || null) || ACCT.enabled !== !!d.enabled;
      ACCT.enabled = !!d.enabled;
      ACCT.user = d.user || null;
      ACCT.ready = true;
      refreshCtas();
      if (first || changed) {
        acctPanels();
        ACCT._emit('me');
      }
      if (first && ACCT.enabled && location.hash === '#account') {
        history.replaceState(null, '', location.pathname + location.search);
        acctOpen();
      }
    } catch (e) {}
  }
  refreshMe(true);
  // auth can change in another tab or before a bfcache restore, so re-check
  window.addEventListener('pageshow', e => { if (e.persisted) refreshMe(false); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshMe(false); });

  const OS = window.OS = { paletteOpen: false };
  if (!window.OS_NO_CHROME) {
  const mob = document.getElementById('hudMobile');
  const appsBtn = document.getElementById('hudBurger');
  function setApps(open) {
    mob.classList.toggle('open', open);
    appsBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  appsBtn.addEventListener('click', e => {
    e.stopPropagation();
    setApps(!mob.classList.contains('open'));
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('#hudMobile, #hudBurger')) setApps(false);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && mob.classList.contains('open')) { setApps(false); appsBtn.focus(); }
  });

  /* the light/dark switch (pages that opt in with html[data-themeable]); the same
     preference and the same circle reveal as the home page */
  const themeBtn = document.getElementById('hudTheme');
  if (themeBtn) themeBtn.addEventListener('click', e => {
    const root = document.documentElement;
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    const apply = () => {
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('trainerTheme', next); } catch (err) {}
      const tc = document.querySelector('meta[name="theme-color"]');
      if (tc) tc.setAttribute('content', next === 'dark' ? '#070A1A' : '#F6F7FB');
      try { window.dispatchEvent(new Event('themechange')); } catch (err) {}
    };
    root.style.setProperty('--vt-x', (e.clientX || innerWidth - 60) + 'px');
    root.style.setProperty('--vt-y', (e.clientY || 30) + 'px');
    if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.startViewTransition(apply);
    } else apply();
  });

  /* ── the concierge (⌘K) ── */
  const pal = document.createElement('div');
  pal.className = 'palette';
  pal.setAttribute('role', 'dialog');
  pal.setAttribute('aria-modal', 'true');
  pal.setAttribute('aria-label', 'Go to an app or your account');
  pal.innerHTML = `
    <div class="pal-box">
      <div class="pal-head">
        <span class="pp">&#10022;</span>
        <input id="palInput" placeholder="Where to? Try trainer, study or account" autocomplete="off" spellcheck="false" aria-label="Search apps and actions" role="combobox" aria-expanded="true" aria-controls="palList" aria-autocomplete="list"/>
        <span class="pal-esc">ESC</span>
      </div>
      <div class="pal-list" id="palList" role="listbox" aria-label="Results"></div>
    </div>`;
  document.body.append(pal);
  const palInput = pal.querySelector('#palInput');
  const palList = pal.querySelector('#palList');
  let palItems = [], palSel = 0;

  function buildItems() {
    const items = MODULES.map(m => ({
      id: m.id === '·' ? '&middot;' : m.id,
      label: m.path === '/' ? 'Return home' : `Open ${m.name}`,
      hint: m.path === '/' ? 'the front door' : `No. ${m.id} · ${m.desc}`,
      run: () => nav(m.path),
      disabled: m.path === current.path,
    })).filter(i => !i.disabled);
    if (ACCT.enabled) {
      items.unshift(ACCT.user
        ? { id: '&#9679;', label: 'Your account · ' + escA(ACCT.user), hint: 'synced on every device', run: acctGo }
        : { id: '&#9679;', label: 'Sign in or create a free account', hint: 'your training on every device', run: acctGo });
    }
    if (window.OS_PALETTE_EXTRA) items.push(...window.OS_PALETTE_EXTRA);
    return items;
  }

  function renderPal() {
    const q = palInput.value.trim().toLowerCase();
    palItems = buildItems().filter(i =>
      !q || i.label.toLowerCase().includes(q) || (i.hint || '').toLowerCase().includes(q));
    palSel = Math.min(palSel, Math.max(0, palItems.length - 1));
    palList.innerHTML = palItems.length
      ? palItems.map((i, n) => `<div class="pal-item ${n === palSel ? 'sel' : ''}" data-n="${n}" id="palOpt${n}" role="option" aria-selected="${n === palSel}"><span class="pi" aria-hidden="true">${i.id}</span><span>${i.label}</span><span class="ph">${i.hint || ''}</span></div>`).join('')
      : '<div class="pal-empty" role="status">Nothing matches. Try another word.</div>';
    if (palItems.length) palInput.setAttribute('aria-activedescendant', 'palOpt' + palSel);
    else palInput.removeAttribute('aria-activedescendant');
  }

  let palReturn = null;
  function openPal() {
    palReturn = document.activeElement;
    OS.paletteOpen = true;
    pal.classList.add('open');
    palInput.value = ''; palSel = 0;
    renderPal();
    setTimeout(() => palInput.focus(), 30);
  }
  function closePal() {
    OS.paletteOpen = false;
    pal.classList.remove('open');
    if (palReturn && palReturn.focus && document.contains(palReturn)) palReturn.focus();
    palReturn = null;
  }

  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      OS.paletteOpen ? closePal() : openPal();
      return;
    }
    if (!OS.paletteOpen) return;
    if (e.key === 'Tab') { e.preventDefault(); palInput.focus(); return; }   // the dialog keeps focus
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
  }

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

  // ── scroll-reveal for .rv elements (UI overhaul foundation) ──
  // adds .in as an element scrolls into view; under reduced-motion (or no
  // IntersectionObserver) everything is shown immediately.
  OS.reveal = function (root) {
    const els = (root || document).querySelectorAll('.rv:not(.in)');
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !('IntersectionObserver' in window)) {
      els.forEach(el => el.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    els.forEach(el => io.observe(el));
  };

  window.addEventListener('load', () => {
    document.querySelectorAll('.decode').forEach((el, i) =>
      setTimeout(() => OS.decode(el), 150 + i * 120));
    document.querySelectorAll('.tilt').forEach(el => OS.tilt(el));
    OS.reveal();
  });
})();
