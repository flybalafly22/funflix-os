# The Trainer — standalone mobile app: analysis & path

Written Sprint 4. Question: should The Trainer become a standalone Android/iOS
app, and how?

## What exists today (already shipped)

The Trainer is a full PWA: installable from the browser on **both platforms**
(Android Chrome: Install app / iPhone Safari: Share → Add to Home Screen),
opens standalone with its own icon, and works **offline** — saved plan, workout
logger, and check-in autofill all run on-device. For the actual user experience
of "an app on my phone," this is 95% of a native app at 0% of the cost.

## The three real options

### 1. Stay PWA-only (current state) — cost: $0
- Pros: zero maintenance overhead, instant updates with every deploy, no
  store review, already live.
- Cons: no store listing (discovery), iPhone install is a 2-tap manual flow
  that many users don't know.

### 2. Android on the Play Store via TWA — cost: $25 one-time, ~an hour of owner clicks
A Trusted Web Activity wraps the live PWA in a real Android app; Google
explicitly supports this (it is how many production apps ship). No new
codebase — the store app IS the website, always current.
Owner steps when wanted:
1. Create a Google Play developer account ($25 one-time).
2. Go to **pwabuilder.com**, enter `https://funflix-os.onrender.com/trainer`,
   generate the Android package (it produces the `.aab` + a signing key —
   keep the key safe).
3. PWABuilder gives a `assetlinks.json` with the key's fingerprint; hand it
   to the dev session, which will serve it at `/.well-known/assetlinks.json`
   (removes the browser bar inside the app). One tiny Flask route.
4. Upload the `.aab` in the Play Console, fill the listing (the 512px icon
   and screenshots already exist in the repo/QA shots).
Recommendation: **worth doing once the trainer has steady users.**

### 3. iOS App Store — cost: $99/year + a Mac + real risk
- Requires an Apple Developer account ($99/yr), Xcode builds, and review.
- Apple's guideline 4.2 ("minimum functionality") regularly rejects thin
  web wrappers; passing usually means adding native capabilities (push
  notifications, HealthKit, widgets) — i.e., a genuine native/Capacitor
  project, not a wrapper. That's a real engineering project (weeks), plus
  ongoing dual maintenance.
- The PWA already covers iPhone users functionally (Safari A2HS, offline OK
  on iOS 16.4+).
Recommendation: **defer.** Revisit only if there's traction that justifies
$99/yr + a native feature set (push workout reminders + HealthKit sync would
be the honest iOS pitch).

## Recommended sequence
1. Now: PWA (done — shipped Sprint 3, polished Sprint 4 with iOS metas).
2. At first real traction: Play Store TWA (option 2, $25, ~1 hour).
3. Only with sustained users: evaluate a Capacitor build with push
   notifications + HealthKit/Google Fit as the store-worthy differentiator.

## What the repo already has ready for option 2
- Manifest with maskable 512 icon, standalone display, /trainer scope
- Service worker with offline shell
- HTTPS domain on Render
- Missing only: `/.well-known/assetlinks.json` (needs the owner's signing-key
  fingerprint from PWABuilder — 5-minute dev task when the time comes)
