# Sprint 32 — Sync that doesn't lose data (server-side union merge)

**Why:** the last open RED TEAM item — the sync lost-update race. Two devices that
pull the same base, each append a different session, and push, would each overwrite
the other's `logs` blob (server did a wholesale newer-wins overwrite), silently
dropping a just-logged session. Also fixes the SIMULATION "same-day backdated log
collision." Server-only.

## What shipped (`app.py`, stores, tests)
- `_merge_logs(old, new)` — union of two log lists de-duped by a **session
  signature** (`at` + `day` + a sorted signature of `entries`), newest-first,
  capped at 400 (client `LOG_CAP`). Two distinct sessions backdated to the same
  day (both get noon-of-day as `at`) stay separate; an identical session synced
  twice dedupes.
- `_merge_weights(old, new)` — one weigh-in per calendar day, union by date,
  incoming wins a same-day correction.
- `merge_blob(uid, kind, value, at, merge_fn)` on both stores. **PgStore does a
  read-merge-write under `SELECT … FOR UPDATE`**, so two workers syncing the same
  user serialize instead of losing a side. `plan` stays newer-wins (single object,
  drives history archiving) — only `logs`/`weights` merge.
- Sync PUT routes `logs`/`weights` through `merge_blob`, `plan` through `put_blob`.

## Gates
- pytest **142 green** (136 + 6 in `tests/test_sync_merge.py`: concurrent pushes
  don't clobber, idempotent, same-day backdated distinct sessions both kept, 400
  cap, weights union by date, same-day weight correction wins).
- site_qa **32/32** (contract intact). Server-only; no client change needed (the
  client's pull now receives the authoritative union; its own belt-and-suspenders
  merge is harmless).

## Outcome (closed)
The RED TEAM watch-list is now empty. Concurrent multi-device logging is
lossless, and same-day backdated sessions no longer collide. Next: Sprint 33
(kg/lb units).
