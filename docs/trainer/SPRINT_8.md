# Sprint 8 — The Archive & The Welcome

**Goal:** synced accounts become materially better than localStorage (every
program you've ever run, kept), and a cold visitor gets a doorway instead of
a 20-field wall.

## Scope & acceptance criteria

1. **Plan archive (server)** — when a synced plan is overwritten by a newer
   one, the old one is archived automatically (per-user cap 10, oldest
   pruned). `GET /api/history` lists summaries (date, goal, kcal, days);
   `GET /api/history/<id>` returns the full plan. Auth-gated.
   *Accept: overwrite → history grows; cap enforced; 401 unauthenticated —
   all unit-tested on the memory store.*
2. **History UI (client)** — signed-in account modal shows "Plan history";
   opening an entry renders the archived plan with an "Old plan → current"
   diff card on top and a "Make this my current plan" action (which archives
   the one it replaces — the loop closes itself).
   *Accept: simulated two-plan account browses, diffs, restores.*
3. **First-run welcome** — visitors with no saved plan see a compact serif
   welcome above the tabs (what you get, in three lines + sample CTA);
   disappears forever once any plan exists. `?sample` URL auto-opens the
   sample program (linkable from anywhere).
   *Accept: cold context shows card, sample renders on CTA and via ?sample;
   card gone for returning users; both viewports clean.*
4. **Luxury (standing mandate)** — welcome + history styled to the bar.

Deferred to Sprint 9: the 3-step progressive intake (needs its own test
rework), homepage deep-link.

## Outcome — CLOSED 2026-07-18, all scope shipped

- Archive: newer plan writes auto-archive the one they replace (transactional,
  per-user cap 10, stale writes never archive); /api/history list + detail
  auth-gated. 4 new unit tests on the mirrored memory store (59 total).
- History UI: signed-in modal lists date · goal · kcal · days; opening an
  entry renders the archived plan with a "This plan → your current" diff on
  top and "Make this my current plan" — restoring pushes to sync, which
  archives the replaced plan: the loop closes itself. Verified in-browser
  with stubbed endpoints (2800 kcal → 2400 kcal diff row exact).
- Welcome: cold visitors get a serif welcome card (three value lines +
  sample CTA); disappears once any plan exists; ?sample auto-opens the
  sample program from a bare URL. Both verified, no mobile overflow.
- Live: verify_live green + real archive round-trip on production Neon.
