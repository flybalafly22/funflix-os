# Sprint 4 — Signature

**Goal:** the plan document gets a visual signature (movement pictograms), plans
travel through the phone's native share sheet, and the mobile-app question gets
a real answer with everything preparable prepared.

## Scope & acceptance criteria

### 1. Exercise pictograms (self-authored — zero licensing exposure)
- A consistent set of minimal, signage-style SVG movement glyphs (ink strokes,
  round caps, 48×48 grid) pattern-matched to exercise names: press (flat/
  incline/overhead), squat, hinge/deadlift, row, vertical pull, curl, triceps,
  lateral raise, fly, lunge, leg press, leg curl, calf, abs/plank, carry,
  cardio, barbell default.
- Rendered beside each exercise name on screen AND in the PDF (ink prints well).
- **Accept:** every demo-plan exercise gets a sensible glyph; a reviewed
  render strip looks premium, not clip-art. Self-authored → note in
  ASSETS_CREDITS.md.

### 2. Share sheet (the practical "email it to myself")
- "Share link" uses the Web Share API where available (mobile: native sheet →
  Mail, WhatsApp, anything), falling back to the existing clipboard copy.
- Real server-sent email documented as an owner decision (mail provider key).
- **Accept:** desktop keeps clipboard behavior; navigator.share invoked when
  available (verified by stubbing it in the browser).

### 3. Mobile app strategy + iOS polish
- `docs/trainer/MOBILE_APP.md`: honest analysis (PWA today vs Play Store TWA
  vs App Store), costs, owner actions, recommendation.
- iOS standalone niceties on /trainer: apple-mobile-web-app metas so
  Add-to-Home-Screen opens clean and standalone on iPhones.
- **Accept:** doc committed; metas served; no behavior change elsewhere.

## Out of scope
Actual store submissions (owner accounts: Google $25 one-time / Apple $99-yr),
server-sent email (owner mail-provider key).

## Outcome — CLOSED 2026-07-17, all scope shipped

- Pictograms: 17-glyph signage set authored in three visual iterations
  (leg press deliberately mapped to the squat glyph rather than shipping a
  weak drawing). All 26 demo exercises matched sensibly; recorded as own
  work / CC0 in ASSETS_CREDITS.md. Verified in-document: subtle, premium.
- Share sheet: navigator.share on mobile (native sheet covers "email it to
  myself"), clipboard fallback on desktop; AbortError (user closed sheet)
  handled quietly. Verified via stubbed navigator.share.
- Mobile app: MOBILE_APP.md analysis committed — PWA now, Play Store TWA
  ($25, ~1 hr owner clicks via PWABuilder) at traction, iOS deferred until a
  native feature set justifies $99/yr + review risk. iOS A2HS metas added.
- QA: pytest 41/41; suite + demo flow green with glyphs and share changes.
