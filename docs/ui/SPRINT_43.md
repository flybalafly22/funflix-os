# UI Sprint 43 — Sub-pages: shared polish + a real mobile fix

**Finding.** The sub-pages (Compute, Synthesis, The Press, The Study, meme) are
*already* premium and cohesive — every one wears the "Instrument/Atelier No. X"
editorial framing, Instrument Serif titles, and the shared chrome (now with the
Trainer flagship dot). So this sprint is safe shared polish + fixing what's broken,
not a rework.

**Shipped**
- **Animated nav underline** (`os.css`, `.hud-links a::after`) — a subtle accent
  underline that grows from the left on hover and stays on the active page. Applies
  to every sub-page's chrome at once; respects `prefers-reduced-motion`.
- **Calculator mobile overflow fixed** — `.instrument` and the mobile `.ledger`
  had a hard `width: 430px`, overflowing 390px viewports (scrollWidth 410). Changed
  to `min(430px, 100%)` → clean 390 = 390. A real bug `site_qa` never caught (it
  only checks the homepage). Meme + Press verified overflow-free at 390.

**Gates.** site_qa 32/32; calculator 390px now 390=390 (was 410); mobile calculator
screenshot reviewed (fills width cleanly); nav-underline hover reviewed. pytest 142.

**Next:** S44 — motion & delight + a11y/perf sweep.
