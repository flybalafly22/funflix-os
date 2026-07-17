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

## Operational facts every team needs
- Live site: `https://funflix-os.onrender.com` (Render auto-deploys `main`).
- Live commit check: `GET /api/version`.
- Model chain: gemini-2.5-flash ×2 → gemini-2.5-flash-lite ×2, server-side
  buffering + JSON validation + retries; keepalive whitespace every 10 s.
- Keyless testing: `POST /api/trainer {"demo":1}` (JSON) or `{"demo":"stream"}`
  (streamed text) — no GEMINI_API_KEY needed.
- Real-API tests cost quota; use one targeted request, not loops.
