# Sprint 11 — Yours, Visibly

**Owner ask (2026-07-18):** five teams. Two new standing research teams (R&D LAB
for output quality/new ideas; SIMULATION for a 3-subject × 12-month desk study)
— hired, chartered in TEAMS.md, first studies running in parallel. Three build
streams, integrated by the Producer because they share files:

## Scope & acceptance criteria

1. **Export & erase (roadmap top item, closes Sprint-10 finding A8)**
   - `GET /api/export` (auth): one JSON document — account, current synced plan,
     logs, full plan history. Client "Export my data" also works signed-out
     (device-local data only).
   - `POST /api/auth/delete` (auth, typed confirmation): wipes trainer_users,
     trainer_blobs, trainer_plan_history rows and the session. The privacy
     promise, demonstrable.
   *Accept: pytest covers export shape + delete wipes rows + auth required;
   round-trip verified on live Neon after deploy.*
2. **Signed-in identity, site-wide (owner: "see their name on the top…
   maybe a profile… valid for the whole website")**
   - Signed-in name visible in the top chrome on every page (hud CTA + homepage
     nav pill already state-aware — verify and polish).
   - A real **profile view** inside the account modal: who you are, member
     since, what's synced (plan · logs · archived plans), and the new
     export/delete actions. Opens from every page (chrome-owned modal).
   - Records stay account-scoped: /api/history, sync and archives are only
     visible signed-in (already enforced server-side); guest mode stays
     device-local by design (privacy promise — deliberate, see ROADMAP).
   *Accept: name on top verified on /, /study, /trainer; profile shows live
   counts; both viewports.*
3. **Aesthetics pass (standing luxury mandate + owner: "unique and different
   UI is the main selling point")** — the account modal/profile becomes a
   signature surface; micro-interactions and finish across chrome.
   *Accept: no overflow at 390px; consistent with the established premium-
   minimal direction (no decorative gimmicks).*
4. **Research intake** — R&D LAB + SIMULATION findings land in
   RND_LAB.md / SIM_STUDY.md and are groomed into ROADMAP for Sprint 12+.

## Outcome — CLOSED 2026-07-19, all scope shipped

- Two new standing teams hired and chartered (TEAMS.md): R&D LAB delivered
  RND_LAB.md (8 ranked output-quality findings with exact prompt fixes, Groq
  parity patch, 7 new ideas); SIMULATION delivered SIM_STUDY.md (3 subjects ×
  12 months; converged with R&D on the #1 defect: stateless check-ins).
  Both studies groomed into ROADMAP — Sprint 12's menu is written.
- Export & erase: GET /api/export (full account document, downloads as JSON),
  POST /api/auth/delete (password-confirmed; cascade-wipes users/blobs/
  history + session). Trainer "Export data" button: signed-in → server
  document, guest → device-local JSON (works fully offline-honest).
- Profile, site-wide: the account modal's signed-in panel is now a real
  profile — monogram, name, email, "Member since", live stat tiles (plan
  synced · sessions logged · archived plans via new /api/profile), plan
  history, export, and a typed-password danger zone for deletion with an
  honest farewell note. Opens in place on every page; name on top everywhere
  (hud CTA + homepage pill already state-aware). Records stay account-scoped
  server-side; guest mode stays device-local by design.
- Aesthetics: serif numerals on stat tiles, monogram disc, card entrance
  motion (reduced-motion safe) — modal is now a signature surface.
- QA: pytest 64/64 (5 new: profile counts, export shape, delete wipes +
  auth/wrong-password refusals), site_qa 29/29, scripted real-browser pass
  (profile render, delete flow both paths, guest export download, 390px no
  overflow). Landmine relearned: a stale test server from a previous session
  was still holding port 5098 — always lsof before trusting a green boot.
