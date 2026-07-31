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

## THE REFINERS — competitive benchmarking & craft
**Lives in:** `docs/trainer/REFINERS.md` (a running competitive-analysis +
improvement ledger).
**What it does:** every sprint, studies the best fitness/training apps in the
world — their onboarding, workflow, coaching mechanics, progression models,
logging UX, nutrition tooling, retention loops, monetisation, visual craft.
It doesn't just catalogue features: it asks WHY each app made a choice (what
problem it solves, what it trades away), where those apps themselves fall
short, and then compares against The Trainer to surface discrepancies,
loopholes, errors, minor mistakes, and concrete improvement opportunities.
**Rule:** every finding names the app + the specific choice, the WHY behind it,
whether it beats or loses to us, and a concrete $0 change for The Trainer (or a
reason to deliberately differ). No copying UI/branding/assets (licensing);
learn the mechanism, not the pixels. Findings feed ROADMAP via the Producer.

## THE GUARDIANS — data privacy & trust
**Lives in:** `docs/trainer/PRIVACY.md` (charter, per-sprint audit log, retros).
**Why hired (2026-07-31):** a user found a signed-out visitor being shown
"Restore last plan" — a peeked sample masquerading as their own saved data —
and **every existing team had missed it**. See the retro in PRIVACY.md.
**What it does:** every sprint, audits The Trainer from the **logged-out,
shared-device** perspective first — what persists to `localStorage` and whether
it should, what a not-logged-in visitor sees, whether any affordance implies
ownership/safety it lacks — and proves **server-side per-user isolation** with
tests (sync / history / export / profile). Owns the promise "your data is yours
alone," made literally and visibly true.
**Rule:** open it cold and signed out before anything else; every finding ships
with a privacy/isolation regression test so the class of bug can't recur.

## Cross-team communication — the round table
**Lives in:** `docs/trainer/ROUNDTABLE.md` (standing cross-team thread log).
Teams must talk to each other, not work in silos. The protocol, every sprint:
- **Read receipts:** each team opens its deliverable by noting what it read in
  the other teams' latest docs (RND_LAB / SIM_STUDY / REDTEAM / REFINERS) and
  where it agrees, disagrees, or overlaps.
- **Directed questions & handoffs:** a team posts open questions to a specific
  team in ROUNDTABLE.md (e.g. "@RED TEAM: is the soft-serve path exploitable?"
  "@REFINERS: how does app X gate its check-in?"); the addressed team answers
  in the same thread next time it runs.
- **The Producer facilitates:** synthesises the threads each sprint, resolves
  or escalates open questions, and turns cross-team agreement into ROADMAP
  items. A finding corroborated by two teams is ranked higher.
Rule: threads are concrete and closed when resolved; the goal is shared
objectives and plans that ultimately benefit The Trainer.

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
