# THE GUARDIANS — data privacy & trust

> Standing team, hired 2026-07-31 after a user found a privacy/trust bug that
> **every existing team missed**. The Guardians own one question and never stop
> asking it: *can a user trust The Trainer with their confidential data?*
> They run **every sprint**, alongside QA / Red Team / Simulation / Refiners.

## Charter

The Trainer's core promise is **"nothing leaves your device without an account,
and your account's data is yours alone."** The Guardians make that literally
true and *visibly* true. Their beat:

1. **The not-logged-in view.** What does a brand-new / signed-out / guest visitor
   see? They must never see data that reads as "someone else's." Every surface is
   audited from a cold, logged-out browser first.
2. **Device-local data lifecycle.** Exactly what is written to `localStorage`,
   when, by whom, and how it is cleared. Samples/demos are exploratory and must
   leave **no trace**. Guests get an obvious way to wipe local data.
3. **Cross-user isolation (server).** A logged-in user's plan, logs, weights and
   history are readable and writable **only** by that account. Proven by tests,
   not assumed.
4. **Shared-device safety.** A second person on the same browser must not inherit
   the first person's data, and signing in as a different account wipes foreign
   device state before touching sync.
5. **Honest UX.** No affordance may imply ownership or safety it doesn't have
   ("Restore last plan" for a sample is a lie; a "synced" badge with no account is
   a lie).

Deliverable each sprint: a short audit note in this file (what was checked, what
held, what was fixed) + at least one new isolation/privacy regression test.

---

## Retrospective — why the teams missed this (2026-07-31)

**The bug (GD-1).** A signed-out visitor saw **"Restore last plan · 17 Jul"** on
`/trainer`. Cause: peeking a sample program wrote it to `localStorage` as a plan
(`demo:true`), and the restore affordance showed *any* stored plan — so a **sample
masqueraded as the visitor's own saved data**. On a shared browser this reads as
"whose data is this?" — a trust-destroying privacy smell, even though it is
device-local (no server cross-user leak occurred).

**Why five teams missed it — named honestly:**
- **QA** drove every flow **as a user who builds or logs a plan** — it seeded
  state and asserted features worked. It never opened the app **cold and
  logged-out and asked "what do I see, and should I?"**. Its one relevant check
  (`demo_seeds_fresh_visitor`) actually *asserted the buggy behavior as correct*.
- **The Red Team** hunted injection, DoS, and auth bypass (RT-1..9) — genuine
  server-side threats — but treated `localStorage` as "the user's own device, out
  of scope." It never modelled the **shared-device / borrowed-laptop** user.
- **Simulation** ran multi-month journeys for a **single persistent persona**, so
  the "sample seen by a different person" case never arose.
- **The Refiners** studied competitors' *mechanisms*, not their *trust surfaces*.
- **R&D** optimized output quality, not the logged-out shell.

**Root process gap:** no team owned **the logged-out, shared-device perspective**,
and no one audited **what persists vs. what should**. That is now the Guardians'
standing job, and the first item on their checklist is literally *"open it cold
and signed out."*

**Fix shipped (GD-1):** samples render in memory only and are **never** written to
`localStorage`; `savedPlan()` ignores any `demo:true` entry; a one-time load purge
removes demo entries older builds left behind; and a guest now sees **"Saved only
on this browser… Not your device? Clear this data"** to wipe local data without an
account. Regression coverage in `qa_privacy.py` + `site_qa.py`
(`demo_peek_does_not_persist`, `demo_peek_no_restore_tab`).

---

## Audit — S3 isolation proof (2026-07-31)

Ran the full checklist. **Server-side isolation holds** and is proven by
`tests/test_accounts.py` (two users' plans/logs/history stay separate; the
history-item route is `WHERE user_id AND id` so IDOR fails; one user's write never
touches another; deleting one account leaves the other intact; every data endpoint
rejects the anonymous). **Browser cross-user proof added** (`qa_isolation_e2e.py`):
A registers via OTP and syncs a plan; A logs out; **B registers on the same
browser** → B's `/api/sync` is empty of A's data, B is B (not A), **A's device
localStorage is wiped** on B's login (owner-stamp), and B cannot read A's history
item by id. **Email-OTP** (S2) further ties each account to a verified inbox.
Result: a logged-in user's data is theirs alone, preserved in their profile, and
never leaks to a guest or a second account on a shared browser.

## Standing checklist (run cold, every sprint)

- [ ] Open `/trainer` in a fresh, signed-out browser — is anything shown that
      implies saved/owned data? (restore tab, "synced", a name, logs)
- [ ] Peek every sample path (`?sample`, `?sample=cut`, welcome CTAs, homepage
      card) — confirm **nothing** is written to `localStorage`.
- [ ] Seed account A, sign out, sign in as B on the same browser — confirm A's
      plan/logs/weights/history are gone before B's sync runs.
- [ ] Hit `/api/sync`, `/api/history`, `/api/export`, `/api/profile` as B — confirm
      only B's data returns (server isolation tests green).
- [ ] Confirm a guest can wipe all device-local Trainer data in one action.

## Open beat (Guardians backlog)
- **Account creation should require email verification (OTP)** so accounts map to
  a real, owned inbox — needs an owner mail-provider key (free tier). Build ready.
- **Prove server-side isolation with tests** across sync/history/export/profile.
- **Sign-in must be fully functional** for existing accounts — audit end to end.
