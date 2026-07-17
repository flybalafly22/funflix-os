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

## Outcome
_(fill at close)_
