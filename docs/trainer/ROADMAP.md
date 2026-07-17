# The Trainer — roadmap

Prioritized backlog. Pull items into `SPRINT_N.md` at sprint start; don't work
from this file directly.

## Shipped
- v1: intake → follow-up triage → full evidence-based plan → print-to-PDF
- Resilience stack: gunicorn.conf.py (Render ignores Procfile), streaming with
  whitespace keepalives, server-side buffer + JSON validation, retry chain
  flash ×2 → flash-lite ×2, human-readable failure reasons, /api/version
- Accuracy pack: training environment/equipment, sleep + stress volume
  modulation, injury history, current lifts → concrete starting loads,
  food preferences → familiar-food sample day
- Special populations: 50+/60+, very overweight novices, 16–17s, women's
  health (RED-S floor, iron as suggestion), night shift
- Week-4 check-in: measured-trend recalibration with checkin_review verdict

## Sprint 1 (current) — Trust & Stickiness
See SPRINT_1.md.

## Next up (high value, roughly ordered)
- **Workout logger**: in-browser session log (localStorage) matching the plan's
  exercises; feeds the check-in with real numbers instead of memory.
- **Share a plan**: encode plan JSON into a compressed URL fragment (no server
  storage, privacy preserved) so users can send their program to a friend/coach.
- **Third-provider fallback**: Groq/OpenRouter leg for Gemini outages — needs
  the owner to create a free API key and add it to Render env.
- **Plan diffing at check-in**: show old vs new side-by-side (calories, sets).
- **Exercise illustrations**: CC0 line-art or CSS diagrams for the top ~40
  movements (license ledger in ASSETS_CREDITS.md).
- **Progressive Web App**: installable, offline access to the saved plan.
- **Email plan to self**: needs a mail provider decision (cost/keys — owner).

## Deliberately not doing
- Server-side plan storage / accounts — privacy is a feature ("nothing is
  stored" is in the UI copy). Revisit only with explicit owner decision.
- Paid model tiers without owner sign-off (costs money).
- Medical features beyond the disclaimer machinery (scope/liability).
