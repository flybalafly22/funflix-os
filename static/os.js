/* ════════════════════════════════════════════════════════
   FUNFLIX — shared runtime
   injects the frame (nav, footer) and the ⌘K concierge
   ════════════════════════════════════════════════════════ */
(() => {
  const MODULES = [
    { id: '·',   name: 'Home',        desc: 'the collection', path: '/' },
    { id: 'I',   name: 'Compute',     desc: 'instrument',     path: '/calculator' },
    { id: 'II',  name: 'Synthesis',   desc: 'image atelier',  path: '/meme' },
    { id: 'III', name: 'The Press',   desc: 'ai newsroom',    path: '/journalist' },
    { id: 'IV',  name: 'Flyuserfly',  desc: 'a noir, playable', path: '/game' },
    { id: 'V',   name: 'Costa Vista', desc: 'open world',     path: '/play/city-game' },
    { id: 'VI',  name: 'The Study',   desc: 'bio-analytics',  path: '/study' },
    { id: 'VII', name: 'The Fly',     desc: 'courier over a hand-built town', path: '/play/the-fly' },
    { id: 'VIII', name: 'The Trainer', desc: 'training studio', path: '/trainer', flag: true },
  ];
  const here = location.pathname.replace(/\/+$/, '') || '/';
  const current = MODULES.find(m => m.path === here) || MODULES[0];

  /* ── the frame: top bar ── */
  if (!window.OS_NO_CHROME) {
  const hud = document.createElement('header');
  hud.className = 'hud';
  hud.innerHTML = `
    <div class="hud-inner">
      <a href="/" class="hud-logo" data-nav aria-label="FUNFLIX home"><svg width="73" height="15" viewBox="0 0 486 100" role="img" aria-label="FUNFLIX"><path fill="#111110" d="M0 0 L24 0 L24 100 L0 100 Z M0 0 L60 0 L60 24 L0 24 Z M0 38 L50 38 L50 58 L0 58 Z"></path><path fill="#0C8A4C" transform="translate(74)" d="M0 0 L26 0 L26 55 Q26 74 33 74 Q40 74 40 55 L40 0 L66 0 L66 55 Q66 100 33 100 Q0 100 0 55 Z"></path><path fill="#111110" transform="translate(152)" d="M0 0 L26 0 L44 52 L44 0 L70 0 L70 100 L44 100 L26 48 L26 100 L0 100 Z"></path><g transform="translate(234)" fill="none" stroke="#111110" stroke-width="6"><rect x="3" y="3" width="18" height="94"></rect><rect x="3" y="3" width="54" height="18"></rect><rect x="3" y="40" width="44" height="14"></rect></g><path fill="#111110" transform="translate(308)" d="M0 0 L26 0 L56 76 L56 100 L0 100 Z"></path><rect x="376" width="26" height="100" fill="#0C8A4C"></rect><path fill="#111110" transform="translate(414)" d="M0 0 L26 0 L72 100 L46 100 Z M46 0 L72 0 L26 100 L0 100 Z"></path></svg></a>
      <nav class="hud-links">
        ${MODULES.map(m => `<a href="${m.path}" data-nav class="${m.path === current.path ? 'on' : ''}${m.flag ? ' flag' : ''}">${m.name}${m.flag ? '<i class="nav-flag" aria-hidden="true"></i>' : ''}</a>`).join('')}
      </nav>
      <div class="hud-right">
        <button class="hud-cta" id="hudCta">Enter</button>
        <button class="hud-burger" id="hudBurger" aria-label="Menu">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg>
        </button>
      </div>
      <div class="hud-mobile" id="hudMobile">
        ${MODULES.map(m => `<a href="${m.path}" data-nav class="${m.path === current.path ? 'on' : ''}${m.flag ? ' flag' : ''}">${m.name}${m.flag ? '<i class="nav-flag" aria-hidden="true"></i>' : ''}</a>`).join('')}
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

  const acctCSS = document.createElement('style');
  acctCSS.textContent = `
    .osacct { position: fixed; inset: 0; z-index: 900; background: rgba(17,17,16,.30);
      backdrop-filter: blur(7px); -webkit-backdrop-filter: blur(7px);
      display: flex; align-items: center; justify-content: center; padding: 20px; }
    .osacct[hidden] { display: none; }
    .osacct * { box-sizing: border-box; margin: 0; }
    .osacct .ac-card { position: relative; width: min(480px, 100%); max-height: 88vh; overflow-y: auto;
      background: #FAFAF8; border: 1px solid #E9E9E5; border-radius: 28px; padding: 42px 44px 36px;
      box-shadow: 0 40px 120px rgba(17,17,16,.28); font-family: 'Geist','Inter',system-ui,sans-serif; }
    @media (max-width: 560px) { .osacct .ac-card { padding: 32px 24px 28px; } }
    .osacct .ac-lead { font-family: 'Instrument Serif',Georgia,serif; font-weight: 400;
      font-size: clamp(26px, 4.5vw, 32px); line-height: 1.15; color: #111110; }
    .osacct .ac-lead em { color: #0C8A4C; }
    .osacct .ac-sub { margin-top: 10px; font-size: 13.5px; line-height: 1.65; color: #63635E; }
    .osacct .ac-close { position: absolute; top: 14px; right: 14px; background: transparent;
      border: 1px solid #DDDDD8; border-radius: 999px; padding: 8px 18px; font-size: 12.5px;
      font-weight: 600; color: #63635E; cursor: pointer; font-family: inherit; }
    .osacct .ac-close:hover { border-color: #111110; color: #111110; }
    .osacct .ac-field { margin-top: 18px; }
    .osacct label { display: block; font-family: 'Geist Mono',monospace; font-size: 10px;
      letter-spacing: .2em; text-transform: uppercase; color: #6D6D66; margin-bottom: 8px; }
    .osacct input { width: 100%; background: transparent; border: none; border-bottom: 1px solid #DDDDD8;
      padding: 10px 2px; font-family: inherit; font-size: 15px; color: #111110; outline: none; }
    .osacct input:focus { border-bottom-color: #0C8A4C; }
    .osacct .ac-hint { margin-top: 7px; font-size: 11.5px; color: #6D6D66; }
    .osacct .ac-link { background: none; border: none; padding: 0; font: inherit; font-size: 11.5px;
      color: #0C8A4C; cursor: pointer; text-decoration: underline; text-underline-offset: 2px; }
    .osacct .ac-link:hover { color: #0a6f3d; }
    .osacct .ac-err { margin-top: 12px; font-size: 13px; color: #A03428; }
    .osacct .ac-btns { display: flex; gap: 10px; margin-top: 26px; align-items: center; }
    /* the display:flex above outranks the UA [hidden] rule, so hidden button rows
       (OTP / reset steps) would otherwise all show at once — re-hide them */
    .osacct .ac-btns[hidden] { display: none; }
    .osacct .ac-primary { flex: 1; background: #111110; color: #fff; border: none; border-radius: 999px;
      font-family: inherit; font-size: 14px; font-weight: 600; padding: 14px 26px; cursor: pointer;
      box-shadow: 0 10px 30px rgba(17,17,16,.20); transition: transform .2s; }
    .osacct .ac-primary:hover { transform: translateY(-1px); }
    .osacct .ac-ghost { background: transparent; border: 1px solid #DDDDD8; border-radius: 999px;
      padding: 12px 22px; font-family: inherit; font-size: 13px; font-weight: 500; color: #63635E; cursor: pointer; }
    .osacct .ac-ghost:hover { border-color: #111110; color: #111110; }
    .osacct .ac-who { margin-top: 3px; font-family: 'Geist Mono',monospace; font-size: 11.5px;
      letter-spacing: .05em; color: #0C8A4C; overflow: hidden; text-overflow: ellipsis; }
    .osacct .ac-prof { display: flex; gap: 16px; align-items: center; min-width: 0; }
    .osacct .ac-prof > div:last-child { min-width: 0; }
    .osacct .ac-ava { width: 56px; height: 56px; border-radius: 999px; flex: none; display: flex;
      align-items: center; justify-content: center; font-family: 'Instrument Serif',Georgia,serif;
      font-size: 27px; color: #0C8A4C; background: #EFF4EE; border: 1px solid #CFE0D2;
      box-shadow: inset 0 0 0 4px #FAFAF8; text-transform: uppercase; }
    .osacct .ac-name { font-family: 'Instrument Serif',Georgia,serif; font-weight: 400;
      font-size: clamp(24px, 4vw, 29px); line-height: 1.1; color: #111110; text-transform: capitalize;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .osacct .ac-since { margin-top: 4px; font-size: 11.5px; color: #6D6D66; }
    .osacct .ac-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px;
      background: #E9E9E5; border: 1px solid #E9E9E5; border-radius: 16px; overflow: hidden; margin-top: 22px; }
    .osacct .ac-stat { background: #FFFFFE; padding: 13px 8px 11px; text-align: center; }
    .osacct .ac-stat b { display: block; font-family: 'Instrument Serif',Georgia,serif; font-weight: 400;
      font-size: 21px; color: #111110; }
    .osacct .ac-stat span { display: block; margin-top: 4px; font-family: 'Geist Mono',monospace;
      font-size: 8.5px; letter-spacing: .14em; text-transform: uppercase; color: #6D6D66; }
    .osacct .ac-ok { margin-top: 12px; font-size: 13px; color: #0C8A4C; }
    .osacct a.ac-ghost { text-decoration: none; display: inline-block; text-align: center; }
    .osacct .ac-danger { margin-top: 26px; padding-top: 16px; border-top: 1px dashed #E2E2DD; }
    .osacct .ac-del-link { background: none; border: none; padding: 0; font-family: inherit;
      font-size: 12px; color: #9A9A93; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
    .osacct .ac-del-link:hover { color: #A03428; }
    .osacct .ac-danger-btn { background: #A03428; box-shadow: 0 10px 30px rgba(160,52,40,.25); }
    .osacct .ac-status { margin-top: 10px; font-size: 13.5px; line-height: 1.65; color: #63635E; }
    .osacct .ac-hist-head { margin-top: 26px; font-family: 'Geist Mono',monospace; font-size: 10px;
      letter-spacing: .22em; text-transform: uppercase; color: #0C8A4C; }
    .osacct .ac-hrow { display: flex; align-items: baseline; gap: 12px; padding: 12px 0;
      border-bottom: 1px solid #ECECEA; cursor: pointer; }
    .osacct .ac-hrow:last-child { border-bottom: none; }
    .osacct .ac-hrow .hd { font-family: 'Geist Mono',monospace; font-size: 10.5px; color: #6D6D66; white-space: nowrap; }
    .osacct .ac-hrow .hg { flex: 1; font-size: 13.5px; font-weight: 600; color: #111110;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .osacct .ac-hrow:hover .hg { color: #0C8A4C; }
    .osacct .ac-hrow .hk { font-family: 'Geist Mono',monospace; font-size: 10.5px; color: #6D6D66; white-space: nowrap; }
    .osacct .ac-next { display: inline-block; margin-top: 14px; font-size: 13px; font-weight: 600;
      color: #0C8A4C; text-decoration: none; }
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
  acctEl.innerHTML = `
    <div class="ac-card">
      <button class="ac-close" id="acClose" type="button">Close</button>
      <div id="acOut">
        <div class="ac-lead">Your training, <em>on every device</em></div>
        <div class="ac-sub">One free account keeps your program, workout logs and check-ins in sync
          between this browser and your phone. Without one, everything stays on this device &mdash;
          that promise doesn't change.</div>
        <div id="acForm">
          <div class="ac-field"><label for="acEmail">Email</label>
            <input id="acEmail" type="email" autocomplete="email"></div>
          <div class="ac-field"><label for="acPw">Password &mdash; 8+ characters</label>
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
          <div class="ac-field"><label for="acRsPw">New password &mdash; 8+ characters</label>
            <input id="acRsPw" type="password" autocomplete="new-password"></div>
        </div>
        <div class="ac-err" id="acErr"></div>
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
          <div class="ac-stat"><b id="acStPlan">&mdash;</b><span>plan synced</span></div>
          <div class="ac-stat"><b id="acStLogs">0</b><span>sessions logged</span></div>
          <div class="ac-stat"><b id="acStHist">0</b><span>archived plans</span></div>
        </div>
        <div class="ac-status">Your plan and logs follow you &mdash; phone at the gym, laptop at home.
          Everything still works offline; changes sync when you're back.</div>
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
              server &mdash; plan, logs, archived plans. Data saved on this device stays yours.
              Export first if you want a copy. Type your password to confirm.</div>
            <div class="ac-field"><label for="acDelPw">Password</label>
              <input id="acDelPw" type="password" autocomplete="current-password"></div>
            <div class="ac-err" id="acDelErr"></div>
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
      $a('acStPlan').textContent = d.plan_at ? dd(d.plan_at) : '—';
      $a('acStLogs').textContent = d.logs_n || 0;
      $a('acStHist').textContent = d.history_n || 0;
      if (d.since) $a('acSince').textContent = 'Member since ' +
        new Date(d.since).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      $a('acStats').hidden = false;
    } catch (e) {}
  }
  function acctOpen() { $a('acNote').textContent = ''; acctPanels(); acctHistory(); acctProfile(); acctEl.hidden = false; }
  function acctClose() { acctEl.hidden = true; }
  function refreshCtas() {
    const cta = document.getElementById('hudCta');
    if (cta && ACCT.enabled) {
      cta.textContent = ACCT.user ? '● ' + ACCT.user.split('@')[0] : 'Create account';
      cta.title = ACCT.user
        ? 'Your account — training synced on every device'
        : 'Free account: your training plan, workout log and check-ins on every device';
    }
    const ffx = document.getElementById('ffxAcct');
    if (ffx && ACCT.enabled && ACCT.user) {
      ffx.textContent = '● ' + ACCT.user.split('@')[0];
      ffx.title = 'Your account — training synced on every device';
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
    $a('acOtpMsg').innerHTML = 'Enter the 6-digit code we emailed to <b>' + (email || 'your inbox') +
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
    $a('acRsMsg').innerHTML = 'If <b>' + (email || 'that address') + '</b> has an account, we emailed ' +
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
      acctPanels(); refreshCtas(); ACCT._emit('logout');
      $a('acNote').textContent = 'Account deleted — every record on our server is gone. Anything saved on this device is still yours.';
    } catch (e) { $a('acDelErr').textContent = 'Could not reach the server.'; }
  });

  const hudCtaEl = document.getElementById('hudCta');
  if (hudCtaEl) hudCtaEl.addEventListener('click', () => {
    // before /api/auth/me resolves, assume accounts exist — the modal is honest
    // about failures; silently dumping the user to the homepage is not
    if (ACCT.enabled || !ACCT.ready) { acctOpen(); return; }
    if (typeof window.openAccess === 'function') window.openAccess();
    else nav('/');
  });
  const ffxAcctEl = document.getElementById('ffxAcct');
  if (ffxAcctEl) ffxAcctEl.addEventListener('click', e => {
    if (ACCT.enabled || !ACCT.ready) { e.preventDefault(); acctOpen(); }
  });

  // any state change — including ones raised by page engines (e.g. the
  // trainer detecting a dead session) — refreshes every chrome surface
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
  // auth can change in another tab or before a bfcache restore — re-check
  window.addEventListener('pageshow', e => { if (e.persisted) refreshMe(false); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshMe(false); });

  const OS = window.OS = { paletteOpen: false };
  if (!window.OS_NO_CHROME) {
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
      label: m.path === '/' ? 'Return home' : `Visit ${m.name}`,
      hint: m.path === '/' ? 'the collection' : `No. ${m.id} — ${m.desc}`,
      run: () => nav(m.path),
      disabled: m.path === current.path,
    })).filter(i => !i.disabled);
    if (ACCT.enabled) {
      items.unshift(ACCT.user
        ? { id: '&#9679;', label: 'Your account — ' + ACCT.user, hint: 'training synced on every device', run: acctGo }
        : { id: '&#9679;', label: 'Create your FUNFLIX account', hint: 'free — your training, on every device', run: acctGo });
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
      ? palItems.map((i, n) => `<div class="pal-item ${n === palSel ? 'sel' : ''}" data-n="${n}"><span class="pi">${i.id}</span><span>${i.label}</span><span class="ph">${i.hint || ''}</span></div>`).join('')
      : '<div class="pal-empty">Regrettably, nothing matches. Try another word.</div>';
  }

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
