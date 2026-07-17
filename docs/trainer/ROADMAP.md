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

- Sprint 1 — Trust & Stickiness (SPRINT_1.md): tests/CI/live-verify, rate
  limit, Restore last plan, exercise form links
- Sprint 2 — Close the Loop (SPRINT_2.md): workout logger + check-in autofill
  from logged sessions, share-a-plan via compressed URL fragment

- Third-provider fallback: Groq Llama 3.3 70B leg after the full Gemini chain
  fails (compact prompt for the 12k TPM free tier; ~7 s emergency plans).
  Activates when GROQ_API_KEY is set in the Render environment.

- Sprint 3 — In Your Pocket (SPRINT_3.md): check-in plan diff (old → new with
  deltas), installable PWA with offline saved-plan + logs
- Sprint 4 — Signature (SPRINT_4.md): self-authored movement pictograms in
  the plan + PDF, native share sheet (covers email-to-self), MOBILE_APP.md
  strategy + iOS standalone metas

## Next up (high value, roughly ordered)
- **Play Store listing (TWA)**: everything is prepared; needs owner's Google
  Play account ($25 one-time) + PWABuilder clicks — see MOBILE_APP.md.
- **Server-sent email**: only if the share sheet proves insufficient; needs
  an owner mail-provider key (Resend/SendGrid free tier).

## Deliberately not doing
- Server-side plan storage / accounts — privacy is a feature ("nothing is
  stored" is in the UI copy). Revisit only with explicit owner decision.
- Paid model tiers without owner sign-off (costs money).
- Medical features beyond the disclaimer machinery (scope/liability).
