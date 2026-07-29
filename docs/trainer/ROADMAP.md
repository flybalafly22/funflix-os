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
- Sprint 12 — The Trainer Remembers (SPRINT_12.md): stateful check-in
  (prev-plan + log digests into the recalibration), plan validator gate,
  muscle-gain-rate reconciliation, Groq compact-prompt parity
- Sprint 13 — Deload Autopilot & Honest Progress (SPRINT_13.md): deload
  autopilot card + coach halving, e1RM stall watch with escalation,
  Coach Mode progression cues + mid-session ramps + RIR-today override
- Sprint 14 — Your Data, Only Yours (SPRINT_14.md): audit + fix of a
  shared-browser cross-account bleed (owner-stamped device storage);
  multi-user isolation now a permanent server+browser test dimension
- Sprint 15 — the eval bench + hardening + the "run the loop" build:
  golden-intake eval bench (CI-gated) + 3 bench-gated prompt passes;
  bodyweight quick-log; RED TEAM security hardening (RT-1..7); allergen
  defence in check-ins + supplements; sample-plan-never-syncs; and the
  REFINERS-driven coaching loop — **fatigue-triggered deload** (≥2 lifts
  stalled in 7d → deload now, three-team corroborated), **inline
  previous-performance on the Log form** (Strong mechanic), and **volume
  autoregulation** (per-muscle direct sets vs MEV→MRV band + recovery signals
  + one-tap feel → ±1–2 sets, all deterministic $0). THE REFINERS chartered;
  cross-team ROUNDTABLE protocol live.
- Sprint 16 — Eat to the Plan (nutrition sprint): the REFINERS' top-two nutrition
  ideas, both deterministic client-side & $0, owner-isolated, demo-hidden.
  **Nutrition tune-up** — MacroFactor's adaptive-TDEE mechanism adapted to a
  prescription: estimate real maintenance from the logged scale trend (assuming
  the prescribed intake), then steer the calorie target onto the plan's own
  intended rate (delta capped to ±min(400, 20%), 25-rounded, BMR/1200-floored);
  on-track "hold" inside tolerance; a "gathering" teaser until ≥4 weigh-ins over
  ≥10 days. **Meal-adherence checklist** — tick the plan's sample day (per-day
  reset, 14-day adherence %), fed into the coach/check-in log digest so the model
  can explain a slow trend with real adherence, not a guess.
- Sprint 17 — What's Next & a Safer Front Door (retention + hardening): the
  **"What's next" daily hub** (zero-permission coaching cue — next session by
  rotation, week progress, weigh-in due, "logged today" state) atop the Log tab,
  with an **opt-in on-device reminder** (Notification Triggers where supported +
  a guaranteed on-open nudge, once/day; no push server, nothing leaves the
  device — retention that *strengthens* the privacy promise). Owner-isolated,
  demo-hidden. Plus **RED TEAM RT-6 closed**: the `#p=` share fragment is now
  capped at 256 KB encoded and streamed with a 1 MB inflation ceiling, killing
  the decompression-bomb tab-crash (verified: 8 MB bomb rejected, page alive).
- Sprint 18 — Month in Review & Debug Off (reflection + hardening): the
  **month-in-review recap** completes the REFINERS' #5 (we shipped the daily
  "what's next" half Sprint 17) — a look-back card over the trailing 30 days
  (sessions/wk vs target, PRs by e1RM-vs-prior-best, bodyweight Δ, meal
  adherence, sets logged, warm honest headline), computed entirely from
  on-device data, demo-hidden, shown once there's a month-ish of history. Plus
  **RED TEAM RT-8 closed**: `app.run(debug=…)` now gates on `FLASK_DEBUG`
  (default OFF) so the Werkzeug debugger/reloader can never ship by accident.
- Sprint 19 — On Your Calendar (feature + RED TEAM round 2): **Add to calendar**
  — a client-side `.ics` of the week's training days (weekday-named split, rest
  days skipped, weekly RRULE, uses the reminder time + workout-day durations),
  built and downloaded entirely on-device, nothing sent anywhere. Pairs with the
  Sprint-17 reminders. Plus **RED TEAM RT-9**: the `.ics` is a new injection
  surface (model `focus` text → calendar/CRLF injection) — defended at ship with
  RFC5545 escaping + control-char strip + line folding (verified: a CRLF payload
  makes no extra VEVENT), and `estimated_duration_minutes` coerced against NaN.
- Sprint 20 — First Run (conversion funnel): closes the show-don't-tell loop on
  the already-stepped intake + sample hero. The welcome hero gains a dual CTA
  ("See a sample" / "or build mine now") and an expectations line (~2 min · 3
  steps · no account); the sample peek now carries a prominent **"Build my own
  program →"** CTA that returns to a fresh, focused intake — so a curious visitor
  can see the output quality first, then convert. The intake form stays visible
  throughout (site_qa contract), and a real saved plan shows neither hero nor
  build-own CTA.
- Sprint 21 — Honest at the Edges (SIMULATION correctness cluster): **F6** the
  Log-tab stall banner is now deficit-aware — a cutter holding strength is told
  it's a win (keeping muscle), never "reduce 10%", and a genuine strength drop
  suggests a diet break. **F7** a goal-reached / already-lean cutter gets a
  **maintenance off-ramp** in the nutrition tune-up (optional goal-weight field +
  BMI≤21.5-and-flat detection) instead of "cut deeper" forever. **S5** confirmed
  already handled (coach eases in and no deload fires after a >14-day layoff) and
  locked with a regression test.
- Sprint 22 — Durable Data (SIMULATION F5): the on-device session cap is raised
  from 200 → **400** across all three write paths (log form, Coach Mode, sync
  merge — the merge path was silently truncating synced history at 200); a **90%
  cap warning** ("N of 400 saved sessions — export/sync so the oldest aren't
  dropped"); and a **post-session-5 guest nudge** to create a free account or
  export a backup (dismissible, auto-hides on sign-in). Zero server.

## Solid-base backlog (groomed from the RED TEAM + SIMULATION e2e sweep,
## 2026-07-19; full detail in REDTEAM.md + SIM_STUDY.md "End-to-end sweep")

**Shipped this sprint (hardening pass):** RT-1 rate-limit exemption gated on the
real peer (X-Forwarded-For spoof no longer disables limits); RT-2 malformed
input 4xx-not-500 (intake/payload/messages/follow-ups); RT-3 3 MB body cap;
RT-4/RT-5 sync timestamp coerced + clamped (no permanent freeze, no 500 on
non-numeric); RT-7 esc() escapes quotes (attribute-breakout XSS); plus the
bodyweight cWeightStart plan-anchoring fix the sweep caught.

**Security/robustness still open (RED TEAM):**
- ~~RT-6 decompression bomb via `#p=` share fragment~~ — SHIPPED Sprint 17:
  256 KB encoded cap + streamed 1 MB inflation ceiling in `decompressFromB64`.
- ~~RT-8 `app.run(debug=True)`~~ — SHIPPED Sprint 18: `_debug_enabled()` gates it
  on `FLASK_DEBUG` (default OFF); regression test in `tests/test_hardening.py`.
- Watch-list: unbounded `_trainer_hits` growth; XFF IP-rotation evading the
  quota key (per-account auth limit would help); unbounded password length.

**Correctness/data still open (SIMULATION e2e):**
- **Allergen defence-in-depth gaps** (highest): check-in mode carries no
  `allergies`, so the validator's allergen scan is skipped on every check-in;
  and the scan never covers `supplements[]` (whey/dairy, fish-oil slips).
- **Sample program seeds a real saved plan** (`?sample`/peek writes PLAN_KEY
  with no demo marker) → can be pushed into a fresh account; verify + gate.
- **Guest data adopts up into an empty account** on a shared browser (known
  owner-stamp residual) — only adopt on register, or confirm.
- **Manual (Log-form) deload isn't tagged** → double-deload / false deeper
  stall; add a deload checkbox + shared clock with Coach Mode.
- **Check-in tab isn't gated on a saved plan** → a no-plan "recalibration" is
  a stateless from-scratch plan with no diff.
- **age_years frozen/blanked after the first check-in**; persist original
  intake (age, injuries, equipment) so special-population rules survive.
- Aggregate "≥2 lifts stalled → deload now" trigger; weeks-since-deload into
  the check-in payload; deficit-blind fat-loss stall copy; same-day backdated
  log collision on sync; brittle deload-cadence regex; hardcoded 20 kg bar.

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
- ~~**Adherence pulse + calendar**~~ — the "what's next" strip shipped Sprint 17
  and the `.ics` download of training days shipped Sprint 19. Zero server.
- ~~**Trend-fed check-in**~~ — SHIPPED Sprint 23: the payload already carried the
  trend (bodyweight + best-sets digest); the check-in tab now *shows* it — a
  "Your measured trend" panel with a bodyweight sparkline and the top-logged
  lift's e1RM sparkline, so the user sees exactly what the recalibration reads.
- ~~**Plan history for synced accounts**~~ — SHIPPED: server keeps the last 10
  (`trainer_plan_history`), the account modal browses them, and Sprint 24 added
  **compare any two** — a "Compare with" selector in the archived-plan view diffs
  the viewed plan against your current plan or any other archived one (macros,
  steps, training days, weekly sets).
- ~~**First-run experience**~~ — SHIPPED across sprints: 3-step stepper + hero
  sample CTA (earlier), then Sprint 20 added the dual CTA, expectations line and
  the sample-peek → "Build my own" conversion loop.
- **Homepage → trainer conversion**: the Trainer card deep-links into the
  sample-program peek, not the blank form. (Still open — needs `?sample` to
  defer to a restored plan for returning users before the card can point at it.)
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
