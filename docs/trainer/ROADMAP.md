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
- Sprint 5 — Coach Mode (SPRINT_5.md): live session runner with prescribed
  rest timers, plate math + ramps, readiness compression, stall watch,
  luxury UI pass
- Sprint 6 — The Studio Remembers (SPRINT_6.md): plan-grounded Ask-the-
  Trainer chat; accounts & cross-device sync on Neon Postgres (opt-in,
  privacy promise intact)
- Sprint 11 — Yours, Visibly (SPRINT_11.md): R&D LAB + SIMULATION teams
  hired (first studies in RND_LAB.md / SIM_STUDY.md); export & erase
  (/api/export, password-confirmed /api/auth/delete); site-wide profile
  view in the account modal (/api/profile: member-since + live counts)

## Next up (high value, roughly ordered — groomed from the R&D LAB and
## SIMULATION studies, 2026-07-19; details in RND_LAB.md + SIM_STUDY.md)
- **Stateful check-in** (both teams' #1): the recalibration request must carry
  the saved plan digest + original intake (injuries/equipment/allergies) +
  qaLogDigest — today it regenerates from 13 form fields and forgets the
  client. Also: compute elapsed weeks from savedPlan().at (cWeeks cap distorts
  trends) and add a travel/illness flag.
- **Plan validator**: pure-Python _validate_plan() (required keys, macro
  arithmetic ±3%, allergen scan, no-newline strings) wired into the retry
  chain — today only `type` is checked and skeleton plans ship.
- ~~Deload awareness~~ — SHIPPED Sprint 13 (autopilot card + coach halving +
  e1RM stall watch with escalation + progression cues + mid-session ramps +
  RIR-today override). Still open from the cluster: deload checkbox on the
  check-in form + stall-history in the check-in payload.
- **Groq parity patch**: apply RND_LAB's ~330-token compact-prompt additions
  (stall rule, special populations, consistent surplus numbers) so fallback
  plans stop being second-class.
- **Prompt consistency + demo upgrade**: reconcile the muscle-gain-rate
  contradiction (section 4 vs check-in bands); give trainer_demo.json
  current_lifts (shows off starting-loads) and fix its volume_analysis claim.
- **Bodyweight log + retention safety**: somewhere to log weight (check-in
  asks for 7-day averages it never collects); raise/trim the 200-session log
  cap with a warning; nudge sync/export after the fifth logged session.
- **Adherence pulse + calendar**: locally computed week strip ("3 of 4
  sessions · next: Upper A") + .ics download of training days. Zero server.
- **Trend-fed check-in**: bodyweight/top-set sparklines from logs shown at
  check-in and passed into the recalibration payload.
- **Plan history for synced accounts**: keep last N plans server-side; browse
  and diff any two — makes Sync materially more valuable than localStorage.
- **First-run experience**: hero-level sample-program CTA + progressive
  disclosure of the 20-field intake into ~3 steps.
- **Homepage → trainer conversion**: the Trainer card deep-links into the
  sample-program peek, not the blank form.
- **Password reset via emailed one-time code** — blocked on owner
  mail-provider key (interim honesty line shipped Sprint 7).
- **Performance pass**: Lighthouse mobile on /trainer; split the inline
  template's CSS/JS only if it moves the score.
- **Play Store listing (TWA)**: everything is prepared; needs owner's Google
  Play account ($25 one-time) + PWABuilder clicks — see MOBILE_APP.md.
- **Server-sent email**: only if the share sheet proves insufficient; needs
  an owner mail-provider key (Resend/SendGrid free tier).

## Deliberately not doing
- Forced accounts — sync stays opt-in; the no-account "nothing leaves your
  device" path is a feature (owner approved server-side sync Sprint 6).
- Paid model tiers without owner sign-off (costs money).
- Medical features beyond the disclaimer machinery (scope/liability).
