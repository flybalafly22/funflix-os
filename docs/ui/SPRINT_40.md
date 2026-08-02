# UI Sprint 40 — The Trainer becomes the flagship (homepage)

**The MSP move.** The Trainer read as 1-of-8; now the homepage leads with it.

**Shipped (`templates/funflix.html`)**
- **Flagship band** between the hero and the apps grid: eyebrow "THE FLAGSHIP ·
  INSTRUMENT NO. VIII", a serif-accent headline ("The one you'll keep *coming back
  to.*"), value copy + three accent-dot bullets, dual CTA (See a sample program →
  `/trainer?sample`, Build mine → `/trainer`), and a live **product mock** — a real
  "Upper A / Week 1" plan card with loads, plus floating "COACH · PLATES" and
  "SYNCS TO EVERY DEVICE" chips. Reveals via the homepage's native `data-rv`.
- **Hero copy** now leads with The Trainer ("headlined by **The Trainer**, an AI
  coach that writes your program and runs every session — plus …").
- **FLAGSHIP tag** on The Trainer's app-row (kept at 08 to preserve the "Instrument
  No. VIII" identity — flagged, not reordered).

**Design.** Native to the system (Geist/Instrument Serif, acid-green accent,
`--shadow-2/3`), premium and restrained — no gimmicks (owner taste). Floating chips
echo the hero's chip language.

**Gates.** site_qa 32/32 (homepage console-clean, no horizontal overflow at 1280 &
390); desktop + mobile screenshots reviewed (band, mobile stack, app-list tag);
primary CTA confirmed solid (`rgb(17,17,16)`, opacity 1). pytest 142.

**Next:** S41 — elevate the `/trainer` front door to match this promise.
