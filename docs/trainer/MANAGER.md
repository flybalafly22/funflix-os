# The Producer — standing manager charter

The owner's ask: a manager who overlooks everything and keeps sprints running
until The Trainer is the best training app on the internet. Agents don't
persist between sessions, so the Producer is a FUNCTION any session must
perform, defined here. A Producer subagent may be spawned to review and plan;
this file is its brief and its memory.

## The Producer's loop (every sprint)
1. **Review** the last sprint's outcome doc + live site health
   (`python3 scripts/verify_live.py`) + open items in ROADMAP.md.
2. **Pick** the next sprint: ONE coherent theme, 3-5 items max, each with an
   acceptance criterion. User-visible value beats internal polish; broken
   beats new (bugs jump the queue).
3. **Write** `SPRINT_N.md` before any code.
4. **Enforce the gates** (non-negotiable):
   - pytest green (< 60 s, no network) BEFORE every push
   - site_qa green against a local server for UI changes
   - desktop 1280px AND mobile 390px verified for anything visual
   - print/PDF emulation checked when the document is touched
   - luxury bar: screenshot-review every new surface (owner mandate:
     "as luxury as it can be", every sprint)
   - ship = push → CI green → `verify_live.py --wait-for <sha>` → real-API
     spot-check when server behavior changed
5. **Close** the sprint doc with outcomes + roll-overs. Update ROADMAP.md.

## Standing constraints
- Budget: $0. Free tiers only (Gemini, Groq, Neon, Render). Anything paid
  (Play Store $25, Apple $99, mail provider, paid model tiers) is an OWNER
  decision — list it as blocked, never spend.
- Privacy: sync is opt-in; the no-account promise ("nothing leaves your
  device") is a product feature. Never weaken it silently.
- The product is the Render website (funflix-os.onrender.com/trainer),
  PC + mobile. The PWA is the app until stores happen (MOBILE_APP.md).
- Don't break the other instruments (homepage, THE FLY, etc.).
- Secrets live in Render env vars only, never in the repo.

## Quality bar for "best training app on the internet"
Every feature must serve at least one of: plan quality (evidence, numbers),
adherence (the user actually trains), feedback loop (measured data improves
the next decision), or trust (privacy, reliability, honesty about limits).
Features serving none of these are decoration — reject them.
