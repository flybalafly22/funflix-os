# The Trainer — standing teams

Each "team" is a durable function embodied in repo infrastructure, so the project
maintains itself regardless of who (human or agent) is working on it. Any session
picking up this project starts here.

## QA — quality analysis & assessment
**Lives in:** `tests/` (pytest, no network, mocked Gemini) + `qa/site_qa.py`
(Playwright smoke against a running server).
**Rule:** every behavior fix or feature lands with a test. Red suite blocks merge.
**Run:** `python3 -m pytest tests/ -q` · `python3 qa/site_qa.py [base_url]`

## CI/CD
**Lives in:** `.github/workflows/ci.yml`.
**What it does:** every push runs the pytest suite; every push to `main`
additionally waits for the Render deploy and verifies the LIVE site serves the
new commit and a working plan (`scripts/verify_live.py`).
**Rule:** never trust a deploy you didn't verify — Render ignores the Procfile
(server config is `gunicorn.conf.py`), and `/api/version` exposes the live commit.

## Automation
**Lives in:** `scripts/`.
- `scripts/verify_live.py --wait-for <sha>` — poll `/api/version`, then smoke
  the live site (used by CI and by hand after any deploy).
**Rule:** anything done manually twice gets a script.

## Project management
**Lives in:** `docs/trainer/ROADMAP.md` (prioritized backlog),
`docs/trainer/SPRINT_N.md` (per-sprint agenda, scope, acceptance criteria,
outcome log — written at sprint start, closed with results).
**Cadence:** a sprint = one focused working session. Close the sprint doc with
what shipped and what rolled over before starting the next.

## R&D LAB — output quality & new ideas
**Lives in:** `docs/trainer/RND_LAB.md` (findings ledger, refreshed by study runs).
**What it does:** studies the levers on generated-output quality (system prompts,
validators, coaching heuristics, demo plan), proposes concrete improvements and
genuinely new quality ideas — all under the $0 constraint.
**Rule:** every finding cites file:line and ships with the exact fix (for prompt
work: the actual sentences to add). Findings feed the ROADMAP, not the code
directly — the Producer pulls them into sprints.

## SIMULATION — longitudinal user studies
**Lives in:** `docs/trainer/SIM_STUDY.md`.
**What it does:** desk-simulates realistic subjects using THE TRAINER over long
horizons (first study: 3 subjects × 12 months) against established
exercise-science expectations; divergences between what the app WOULD do and
what SHOULD happen are findings, tagged [accuracy]/[user-friendliness]/[reliability].
**Rule:** simulations are honest about being simulations; every finding names the
simulated moment that exposed it and a $0 fix. Re-run after major coaching-logic
changes. **Every sprint** it also runs a thorough end-to-end pass across ALL
live systems (intake → plan → check-in → coach → log → deload/stall →
accounts/sync/isolation → export/delete → PWA/share/profile) hunting for
discrepancies, so the base stays solid as features accrete.

## RED TEAM — adversarial bug hunting
**Lives in:** `docs/trainer/REDTEAM.md` (a running, severity-ranked bug ledger).
**What it does:** every sprint, actively tries to BREAK the app rather than use
it — malformed/hostile inputs and fuzzing, endpoint abuse, auth + cross-account
isolation attacks, injection/XSS/HTML in user-controlled strings, rate-limit
bypass, oversized/edge payloads, concurrency/races on sync, client-state
(localStorage) tampering, offline/PWA and bfcache edge cases, error-path and
soft-serve behaviour. Authorized security testing of our OWN app.
**Rule:** every bug is a concrete, reproducible finding (exact steps/inputs →
wrong result) ranked by severity; verified findings are fixed this sprint or
queued in ROADMAP with a reason. Never run destructive load/DoS against
production and never damage real data — probe locally or with throwaway
accounts. It hunts bugs; the Producer schedules the fixes.

## Operational facts every team needs
- Live site: `https://funflix-os.onrender.com` (Render auto-deploys `main`).
- Live commit check: `GET /api/version`.
- Model chain: gemini-2.5-flash ×2 → gemini-2.5-flash-lite ×2 → Groq
  Llama 3.3 70B last resort (only if GROQ_API_KEY is set; uses
  data/trainer_system_compact.txt because Groq's free tier caps
  prompt+completion ~12k tokens/min; needs a User-Agent header or
  Cloudflare 403s). Server-side buffering + JSON validation + retries;
  keepalive whitespace every 10 s.
- Keyless testing: `POST /api/trainer {"demo":1}` (JSON) or `{"demo":"stream"}`
  (streamed text) — no GEMINI_API_KEY needed.
- Real-API tests cost quota; use one targeted request, not loops.
