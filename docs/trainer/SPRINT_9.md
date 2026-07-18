# Sprint 9 — The Front Door

**Goal:** the account is the product's spine — sell it on every page, not one
pill on one tab. And the intake stops being a 20-field wall: three calm steps.

## Scope & acceptance criteria

1. **Site-wide account CTA (owner ask: "integrate it well, sell it well")**
   - The hud's dead "Enter" button (openAccess was never defined) becomes a
     state-aware account button on EVERY page: signed-out → "Create account",
     signed-in → "● name". Click: on /trainer it opens the account modal
     directly; elsewhere it navigates to /trainer#account which auto-opens it.
   - ⌘K concierge gets an account entry ("Create your FUNFLIX account — your
     training, on every device" / signed-in variant).
   - Accounts disabled (no DB) → button falls back to old behavior, nothing
     breaks. *Accept: button state + click-through verified on homepage and
     a non-trainer page; #account auto-open verified; graceful without DB.*
2. **3-step progressive intake**
   - Step 1 You (client + goal) → Step 2 Training (availability/equipment +
     health/recovery) → Step 3 Fuel (diet + extras + submit). Mono stepper
     rail, Next/Back, per-step native validation; check-in form stays
     single-page. *Accept: stepped flow submits the same payload; required
     fields gate step 1; site_qa green with refactored navigation.*
3. **Luxury (standing)** — stepper styled to the bar; both viewports clean.

## Outcome — CLOSED 2026-07-18, all scope shipped

- Account, sold site-wide: the dead "Enter" hud button is now a state-aware
  account CTA on every sub-page ("Create account" / "● name", with selling
  title copy); ⌘K's first entry is the account; the homepage's bespoke nav
  gets its own acid "Create account" link and the hero line "NO ACCOUNT" —
  which had become a lie — now reads "FREE OPTIONAL ACCOUNT — YOUR TRAINING
  ON EVERY DEVICE". /trainer#account auto-opens the modal from anywhere.
  Accounts-disabled fallback keeps old behavior byte-for-byte.
- 3-step intake: 01 You → 02 Training → 03 Fuel with a mono stepper rail,
  per-step native validation (step 1 gates on the required fields),
  back-navigation via rail or buttons; same payload, same demo/peek flows.
- Verified: signed-out/in states on home + /study, subpage CTA navigates
  and auto-opens the modal, validation gating, stepped submit renders the
  full plan, no overflow at 390px anywhere; site_qa refactored for the
  stepped form (29/29), pytest 59/59.
- Bug found & fixed during QA: Flask template cache (again) — and a test
  harness lambda swallowing Playwright's request arg (harness, not product).
