# Sprint 1 — Trust & Stickiness

**Goal:** the project maintains itself (tests, CI, live verification), defends
itself (rate limiting), and keeps what users build (plan persistence).

## Scope & acceptance criteria

### 1. QA foundation
- `tests/` pytest suite: routes, demo paths, validation, mocked model chain
  (fallback, retry-on-truncation, total outage), check-in mode, demo-plan
  integrity (macro math, schema keys). **Accept:** `pytest -q` green < 30 s,
  no network.
- `qa/site_qa.py` Playwright smoke: homepage + trainer, both tabs, demo flow,
  mobile overflow. **Accept:** exit 0 against a running server, report JSON.

### 2. CI/CD
- `.github/workflows/ci.yml`: pytest on every push/PR; on `main`, wait for the
  Render deploy and verify the live site (version match + working demo plan).
  **Accept:** green check on the sprint's final commit, including live job.

### 3. Automation
- `scripts/verify_live.py`: poll `/api/version` for an expected commit, then
  smoke `/`, `/trainer`, demo plan validity. **Accept:** exits 0 against prod.

### 4. Rate limiting (protect the Gemini quota)
- Per-IP sliding window on real `/api/trainer` calls (demo exempt):
  6 plans/hour, honest 429 message. X-Forwarded-For aware; localhost exempt
  (keeps dev/tests unlimited). **Accept:** unit-tested via header spoof.

### 5. Plan persistence — "Restore last plan"
- Successful plans saved to localStorage (device-only, privacy intact). On
  revisit, a "Restore last plan · <date>" button appears by the tabs; click
  re-renders instantly. **Accept:** survives reload; cleared by Start over?
  No — kept until overwritten by the next plan.

### 6. Exercise form links
- Each exercise name gets a small "form ↗" link → YouTube search for
  "<exercise> form" in a new tab. Hidden in print/PDF. **Accept:** visible
  on screen, absent in print emulation, zero layout shift.

## Out of scope (rolled to roadmap)
Workout logger, share links, third-provider fallback, PWA.

## Outcome — CLOSED 2026-07-17, all scope shipped

- QA: 32 pytest tests green in ~0.5 s; `qa/site_qa.py` 13/13 checks, report +
  screenshots committed. Authored by a parallel QA agent; integrated cleanly.
- CI/CD: first GitHub Actions run on `dbea5c9` — **both jobs passed**,
  including live-verify (waited for the Render deploy, confirmed the live
  commit and a working demo plan).
- Automation: `scripts/verify_live.py` works from CI and by hand
  (fix during close: use certifi CAs — macOS system Python lacks root certs).
- Features verified: rate limit 6/hr (429 on 7th spoofed-IP call; localhost +
  demo exempt), Restore-last-plan pill survives reload and re-renders
  instantly, 26 form-video links visible on screen and absent in print.
- Rolled over: nothing. Next sprint candidates: workout logger, share-a-plan.
