# UI Sprint 39 — Council brief + design foundation

**Deliverables**
- `docs/ui/UI_COUNCIL.md` — every team's UI input synthesised (owner ask: "ask
  every single team"), the honest read (elevation not rescue; Trainer reads as
  1-of-8), and the 7-sprint plan (39–45).
- **Motion + elevation tokens** in `os.css`: `--ease` / `--ease-in-out`, `--dur-1/2`,
  `--shadow-1/2/3` — a shared vocabulary the later sprints compose with.
- **Accessible scroll-reveal**: a `.rv` / `.rv.in` utility (+ `.d1–d4` stagger) in
  `os.css` and an `OS.reveal()` IntersectionObserver in `os.js` that adds `.in` on
  enter, or shows everything immediately under `prefers-reduced-motion` / no-IO.

**Safety.** Purely additive — no existing rule changed, nothing uses `.rv` yet, so
zero visual change this sprint. It's the substrate for S40–S45.

**Gates.** pytest 142; site_qa 32/32 (homepage + trainer console-clean, no
horizontal overflow at 1280 & 390). Shared across the whole site (`os.css`/`os.js`
are included by every page).

**Next:** S40 — the Trainer flagship band on the homepage (the MSP move).
