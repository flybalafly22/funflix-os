# UI Sprint 41 — The Trainer's front door

The `/trainer` logged-out landing was already premium ("Instrument No. VIII", value
card, sample CTAs, stepped intake). Elevated it to match the homepage flagship
promise with a **trust strip** below the welcome card — four honest pills:
`$0 forever` · `Private — stays on your device` · `Evidence-based — every number
justified` · `Syncs to every device`. Reinforces conversion (SIMULATION) and the
GUARDIANS' honesty mandate; additive, shows/hides with the welcome block so the
intake flow is untouched.

**Gates.** site_qa 32/32 (intake visible, tabs work, no h-overflow); welcome +
trust strip confirmed visible; desktop screenshot reviewed. pytest 142.
Restrained by design — the front door was already strong; no gimmicks.

**Next:** S42 — site chrome & nav (HUD, footer, ⌘K, mobile menu, active states).
