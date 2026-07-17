# Sprint 3 — In Your Pocket

**Goal:** the plan lives where training happens. Check-ins show exactly what
changed from the old program, and The Trainer installs to the phone with the
saved plan and logs readable offline at the gym.

## Scope & acceptance criteria

### 1. Plan diff at check-in
- When a check-in returns a revised plan and a previous plan exists on the
  device, the Check-in Verdict section ends with an "Old plan → new plan"
  block: calories, protein/carbs/fat, daily step target, training days,
  weekly hard sets — old → new with signed deltas.
- Included in the printed PDF (it is part of the document).
- **Accept:** stubbed check-in over a saved demo plan renders correct deltas.

### 2. Progressive Web App
- Installable: manifest (name, icons 192/512 incl. maskable, standalone,
  start_url /trainer) + theme meta + apple-touch-icon.
- Offline: service worker at /trainer-sw.js (root-served for scope), shell
  precache (/trainer + os.css/os.js), network-first navigations (fresh when
  online, cached shell offline), stale-while-revalidate statics, /api/ never
  touched. Restore-last-plan and the workout logger work offline via
  localStorage.
- **Accept:** icons/manifest/sw all served 200 with sane types; page offline
  after first visit still renders with the saved plan restorable.

### 3. QA
- pytest: sw route, manifest validity, icon PNGs, registration markup.
- site_qa.py: PWA asset checks on /trainer.
- **Accept:** suite green; CI incl. live-verify green on the sprint commit.

## Out of scope (roadmap)
Exercise illustrations (CC0 sourcing + license ledger), email-plan-to-self.

## Outcome — CLOSED 2026-07-17, all scope shipped

- Diff verified with a stubbed check-in over a saved demo plan: 7 rows,
  calories 3000 → 3200 (+200), steps 7500 → 8000, weekly sets 85 → 86;
  prints with the document; skipped cleanly when no previous plan exists.
- PWA verified end to end in headless Chromium: SW registers with /trainer
  scope (root-served /trainer-sw.js), and with the network fully offline the
  page reloads from cache, the Restore pill appears, and the full 10-section
  plan renders. Icons generated in-house (serif T + acid underline, 192/512,
  maskable-safe). /api/ is never intercepted, navigations are network-first
  so deploys never serve stale HTML to online users.
- QA: pytest 41/41 (4 new PWA tests); site_qa 21/21 with a PWA asset check.
- Rolled over: nothing.
