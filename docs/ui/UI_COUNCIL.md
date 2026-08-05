# The UI Council — whole-site craft overhaul (2026-08-03)

> Owner ask: **make The Trainer the flagship (MSP) of FUNFLIX**, and lift the UI of
> the whole website (homepage + every sub-page). Every standing team was asked how
> to improve the site's UI; the strongest, on-brand ideas are below and scheduled
> across Sprints 39–45. **Taste guardrail (owner):** clean premium minimalism, no
> dev-terminal gimmicks — "crazy" means a *bold, tasteful* signature moment, not
> clutter.

## Where we start (honest read)
The site is already high-craft: a cinematic dark scroll-canvas intro, a light
editorial homepage with a live app-grid mock + "under the hood" live demos, a
refined design system (`os.css`: paper/ink, Geist + Instrument Serif, an acid-green
accent trio, ⌘K palette, fade-rise motion), and a genuinely premium Trainer landing
("Instrument No. VIII"). So this is **elevation, not rescue** — and the one real gap
is that **The Trainer reads as 1-of-8, not the flagship.**

## Each team's UI input (asked, synthesised)

**THE REFINERS (competitive craft).** The best product sites earn a *flagship
moment* — one hero product the whole page orbits (Linear's editorial hero, Stripe's
motion, Arc's product-forward story). FUNFLIX democratises 8 apps equally; the
Trainer deserves a dedicated feature band with a *live* preview (a plan writing
itself, a set being logged) — show, don't tell. Verdict: **build the Trainer
flagship band (S40)** and a best-in-class Trainer front door (S41).

**R&D LAB (bold ideas).** Signature, tasteful motion: the intro's floating app
windows can let *The Trainer's* window settle forward as the hero; a scroll-choreo
"the one you'll come back to" band; a cursor/scroll-reactive plan card. Every idea
must respect `prefers-reduced-motion`. Verdict: **one signature Trainer moment
(S40) + a site-wide motion system (S44)**, never gratuitous.

**SIMULATION (user journeys).** A first-time visitor should understand *what the
Trainer is* and reach a sample in one scroll; the cross-device promise is the
retention hook and must be visible. Sub-pages must not feel like a downgrade from
the homepage. Verdict: **conversion-first Trainer front door (S41)** + **sub-page
consistency (S43)**.

**RED TEAM (adversarial / perf).** Motion is a perf and accessibility risk: keep
the 0.4s-load promise honest (no heavy new assets, inline SVG only, respect the
CSP), guarantee `prefers-reduced-motion`, no layout shift, no horizontal overflow at
any width, visible focus everywhere, AA contrast. Verdict: **owns the perf +
a11y gate (S44)**; every sprint keeps `site_qa` green (console-clean, no h-overflow).

**THE GUARDIANS (trust).** The UI must stay honest: no fake urgency, no dark
patterns, the "$0 / no-account / your-data-stays" promises stated plainly and kept
literally true; the Trainer's flagship push must not over-claim. Verdict: **honesty
review of all new copy/CTAs (S41, S45)**.

**QA / CI.** Every visual change ships with a screenshot review at 1280 + 390 and a
green `site_qa`; no regressions to the working homepage or Trainer app. Verdict:
**the standing gate on every UI sprint.**

**PRODUCER (synthesis).** Three pillars: **(A) Trainer as MSP** (S40 homepage
flagship band + S41 front door), **(B) whole-site elevation** (S39 foundation, S42
chrome/nav, S44 motion), **(C) breadth & polish** (S43 sub-pages, S45 review). Two
teams corroborate the flagship band (REFINERS + R&D + SIM) → highest rank.

## The 7-sprint plan
- **39 — Foundation.** This brief + a shared motion/reveal refinement (unified
  easing, a reusable scroll-reveal, reduced-motion baseline) so later sprints
  compose cleanly. Small, safe, no visual regressions.
- **40 — Trainer flagship (homepage).** A dedicated, live Trainer feature band +
  a "flagship" signal in the app grid + hero copy that leads with the Trainer.
- **41 — Trainer front door.** Elevate the `/trainer` logged-out landing into a
  best-in-class product page (hero, live "what you get", trust row, conversion).
- **42 — Chrome & nav.** HUD, footer/statusbar, ⌘K palette, mobile menu — motion +
  active states; Trainer prominent in nav.
- **43 — Sub-pages.** Compute / Synthesis / The Press / meme brought to the shared
  premium bar (chrome, type, spacing, reveal).
- **44 — Motion & a11y & perf.** Tasteful transitions + micro-interactions; the
  RED TEAM perf/a11y gate (reduced-motion, focus, contrast, no CLS, mobile).
- **45 — Producer review.** Multi-viewport screenshot sweep, cohesion polish,
  cross-team sign-off, roll-ups.

## Standing gate (every UI sprint)
`site_qa` green (homepage + trainer console-clean, no horizontal overflow at 1280
& 390) · screenshot review at 1280 + 390 · `prefers-reduced-motion` respected · no
new external asset (CSP + the 0.4s promise) · pytest still green · push → verify_live.

## Pending (owner, free — unchanged)
Set `GMAIL_USER` + `GMAIL_APP_PASSWORD` on Render (`EMAIL_SETUP.md`) to enable OTP +
password-reset email for real users. Not a UI item; stays tracked.

---

## Rebrand pitch outcome + 3 new standing teams (2026-08-05)

The owner reviewed the four rebrand directions (FUNFLIX → "The Trainer", keeping all
eight apps). **Chosen: Direction II — The Voice** (a coach persona hosts the site).
Built as a **private, non-production prototype only** (Artifact, not deployed): a
time-aware serif greeting + an "Ask your Trainer" router that hands you the right
app with a coach's reasoning. The live site is untouched. Do **not** ship the
rebrand without an explicit owner go-ahead.

The other three teams are **hired permanently** — not to rebrand, but to keep lifting
the real website. Each stays wired to an existing team so its work is grounded.

### THE ATELIER — craft & finish  (wired to THE REFINERS + UI Council)
Owns the "made-by-hand" quality bar: hallmark/mark consistency, the premium detail
pass (spacing, hairlines, elevation, edition-numbering), and the "Instrument No."
framing the site already uses. Standing job: every new surface gets an Atelier
finish review before it ships.

### THE DOCTRINE — narrative & positioning  (wired to R&D LAB + THE PRODUCER)
Owns voice, copy, and the "why each thing exists" throughline across the whole site.
Standing job: no headline/CTA/empty-state ships without a Doctrine copy pass — active
voice, specific-beats-clever, evidence-first. Guards against filler.

### THE CLUB — membership, belonging & wayfinding  (wired to THE GUARDIANS + QA)
Owns the account/membership experience, navigation & wayfinding, and the live
presence/status language ("Enter", the clocks, "your trainer is in"). Standing job:
the arrival + sign-in + cross-app navigation flows stay coherent and welcoming, and
membership never becomes a dark pattern (with the Guardians).

**Roster now:** QA · CI/CD · Automation · R&D LAB · SIMULATION · RED TEAM · THE
REFINERS · THE GUARDIANS · UI Council · **THE ATELIER · THE DOCTRINE · THE CLUB** ·
Producer. (THE VOICE remains on call for the rebrand if/when it's greenlit.)
