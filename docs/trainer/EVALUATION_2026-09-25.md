# Whole-site evaluation, 2026-09-25

The owner asked for a team to investigate the whole website after the Voice merge
(`7216306`), run simulations and find the discrepancies. Five specialists audited the
live build (`183f847`), each on a local copy with its own server. Every finding was
reproduced or read from code before it was reported. Fixes shipped in nine batches,
each gated and verified on the live site.

## Who looked, and what they found

| Team | Scope | Critical | High | Medium | Low | Total |
|---|---|---|---|---|---|---|
| THE GUARDIANS | privacy on a shared device, what the copy promises about data | 4 | 4 | 5 | 4 | 17 |
| SIMULATION | month-long replays of real users through the Log, Coach Mode and check-ins | 3 | 4 | 13 | 5 | 25 |
| CONTENT | evidence behind every claim, the engine's rulebook, both sample plans, the copy | 2 | 11 | 14 | 7 | 34 |
| QA + RED TEAM | security, malformed input, every feature end to end | 1 | 0 | 5 | 4 | 10 |
| CADENCE | design, accessibility and performance at 320 to 1440 px, both themes | 0 | 6 | 14 | 8 | 28 |
| **All** | | **10** | **25** | **51** | **28** | **114** |

Simulation also noted three inferred low-severity items, not counted above.

**Result:** all 10 critical and all 25 high findings are fixed and live. Most mediums
and lows are fixed too. The few that are not are listed under "Still open" below.

## The worst of it (all fixed)

- **Remote code execution.** `/calculate` ran user input through a Python `eval`
  that could be escaped to run shell commands. It now uses an AST calculator that
  only accepts numbers, operators and a fixed list of maths functions.
- **Shared devices.** Signing out anywhere except `/trainer` left the previous
  person's plan, log and weigh-ins in the browser. A new account also absorbed a
  stranger's guest data without asking.
- **Promises about data.** The copy said "everything stays on this device", but
  plans, check-ins and questions go to Google Gemini's free tier.
- **Minors.** The under-16 cutoff was only one question deep, and 16 and 17 year
  olds got plans. The Gemini API terms exclude services likely to be used by
  under-18s. The Trainer is now adults only, and this is enforced before the
  model is called.
- **The coaching logic contradicted its own rulebook.** Correct load jumps counted
  as stalls, the nutrition tune-up steered dieters to eat more, and the Log and
  Coach Mode gave different instructions for the same lift.
- **Evidence.** The Study was presented as "the raw evidence" but is a simulated
  practice data set. The fat-loss sample was hand-written and broke the rules it
  advertised.

## What shipped

| Commit | Batch |
|---|---|
| `4a5b613` | Security: the `/calculate` RCE fix |
| `4c007cb` | Server hardening (security headers, account data never cached, malformed JSON gets a 400 not a 500), adults only, allergen families that are never soft-served |
| `c900493` | Shared-device privacy (one wipe on sign-out from any page, consent before adopting guest data, samples send nothing personal, share links warn and drop the name), honest data copy that names Google Gemini, `qa/privacy_qa.py` in CI |
| `7c96ef2` | Coaching logic follows the rulebook: stall watch, nutrition bands on a two-week cadence, layoff and implement-aware increments, deload timing, least-squares trend, month review, intake checks |
| `1c335a5` | The engine, the facts and the house tell the truth: gain bands, eating-disorder and underweight triage, facts rewritten with sources, an honest landing draft, The Study labelled as simulated, utility apps off Google Fonts |
| `6002126` | Reliability: a retired Gemini model no longer breaks the AI chain, and people never see raw provider errors |
| `dac09b8` | Honest samples: the fat-loss sample is now a plan the real engine wrote, checked against the rulebook |
| `a22a12c` | Design and accessibility: Coach Mode is a real dialog (and no longer logs a finished session twice), landmarks, skip links, h2/h3 structure, 44 px targets, no synthesized italics, phone layout fixes, The Study's charts on the house palette, `qa/a11y_qa.py` in CI |
| next | Privacy: the plan and check-in copy names the backup provider, Groq, whenever that backup is switched on |

## Gates that now hold these fixed

- `tests/` (pytest, 169): calculator safety, server hardening, adults only,
  allergen families, the model chain and retired models, content truth, the
  Groq disclosure.
- `qa/privacy_qa.py`: 18 shared-device checks, self-contained, runs in CI.
- `qa/a11y_qa.py`: 20 dialog, landmark, target and layout checks,
  self-contained, runs in CI.
- `qa/site_qa.py` (33), `qa/voice_qa.py`, `qa/trainer_bench.py` (59) and the
  seven `qa/qa_*.py` Trainer feature scripts.

## Still open

**Needs the owner**
- Set `GMAIL_USER` and `GMAIL_APP_PASSWORD` on Render so sign-up codes and
  password resets arrive by email.
- Decide the Gemini tier. On the free tier Google may keep prompts and use them
  to improve its models. The copy says so plainly, but a paid tier would remove
  the caveat.
- Check whether `GROQ_API_KEY` is set on Render. If it is, the copy now names
  Groq automatically.
- Say how long Neon keeps backups after "Delete forever", so the copy can state
  it.

**Deferred to their own tracks**
- About 550 em-dashes in the games' narrative copy (THE FLY runs its own overhaul).
- The Fly has no way back to the rest of the house. Adding the shared chrome to a
  WebGL game is THE FLY track's call.

**Accepted or still to do**
- Home loads with an LCP of about 3.0 s on a first visit because of the intro.
  Subsetting Bricolage and fingerprinting static files would also help. Only the
  Geist Mono preload is done.
- The Press says its articles are AI-written but does not show sources yet.
- A downloaded copy cannot be loaded back in (no import).
- The allergen check covers the common food families. No synonym list is ever
  complete, so the rulebook's own allergy rules remain the first line of defence.
- Synthesis sends meme text to memegen, and the games load from jsDelivr and
  Google Fonts, without a notice.
- The coach island can briefly cover the bottom row of the draft card while it
  is out. Nothing becomes unreachable, so this is accepted.

## What the evaluation could not cover

- No real screen reader: the accessibility tree was checked through Chromium only.
  Safari and Firefox were not tested, and neither were iOS home-screen storage
  limits.
- No model key locally, so the harness covers only the samples and the error
  paths. Real plans were spot-checked on production (the fat-loss sample is one).
  Recalibrations and Ask answers were not re-checked.
- Email flows could not be run end to end without a mail provider.
- The games were checked for a clean boot only, not for gameplay.
