# UI Sprint 44 — Motion & delight + the RED TEAM a11y gate

**Delight (restrained).** A hover-lift on the flagship product mock
(`.fl-mock:hover .flm-card` → translateY(-5px) + deeper shadow, `--ease`), guarded
by `prefers-reduced-motion`. Echoes the site's physicality without gimmicks.

**A11y / perf gate (RED TEAM), verified**
- **Reduced-motion:** under `prefers-reduced-motion: reduce`, all 7 flagship
  `data-rv` elements resolve to opacity 1 (no stuck-invisible content); the `.rv`
  utility, nav underline, and hover-lift all no-op. Confirmed by emulation.
- **Focus:** the flagship CTA (and all interactive chrome) shows a visible focus
  ring — `outline: 2px rgb(12,138,76)` on `:focus-visible`.
- **Contrast:** flagship subcopy `rgb(99,99,94)` on paper `#FAFAF8` ≈ 5.4:1 — passes
  AA for body text. Trust pills / eyebrow within range.
- **No new external asset** (CSP + the 0.4s-load promise honoured); no layout shift.

**Gates.** site_qa 32/32; reduced-motion / focus / contrast checks green; pytest 142.

**Next:** S45 — full multi-viewport Producer review + sign-off.
