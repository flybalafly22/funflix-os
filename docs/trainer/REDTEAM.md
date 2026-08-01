# The Trainer — RED TEAM bug ledger

> Standing team charter: `docs/trainer/TEAMS.md` → **RED TEAM — adversarial bug
> hunting.** Every sprint this team tries to *break* the app rather than use it,
> and files concrete, reproducible findings ranked by severity. Authorized
> security/robustness testing of our OWN app. It hunts bugs; the Producer
> schedules the fixes (this sprint, or queued in `ROADMAP.md` with a reason).
>
> **Ground rules honoured:** no code was modified by this team (read-only on
> `app.py` / `templates/trainer.html`); no destructive load or DoS was run
> against production; probing was done against a LOCAL server
> (`python3 app.py`, port 5000, keyless demo path) and by direct code
> reasoning for DB/account paths (no DB locally). This file is the only artifact.
>
> **Method notes:** local server has no `DATABASE_URL`, so accounts/sync are
> disabled locally — those paths are reasoned from code or marked for
> throwaway-account verification on prod. The plan endpoint's real leg needs a
> Gemini key; the keyless `{"demo":1}` path and direct `import app` unit probes
> were used to confirm everything below without spending quota.

Severity key: **Critical** = auth/data-integrity break or trivial RCE ·
**High** = cost/abuse or protection fully defeated · **Medium** = crash /
availability / self-DoS / needs an account · **Low** = hardening / narrow / model-mediated.

Legend: **[CONFIRMED]** reproduced here · **[CODE-CONFIRMED]** proven by reading
the exact code path, not yet run end-to-end (DB/key gated) · **[THEORETICAL]** plausible, not yet demonstrated.

---

## Sprint 14 (RED TEAM sprint 1) — findings

### 🔴 HIGH

#### RT-1 — Rate limiter fully bypassable via `X-Forwarded-For` spoofing  **[CONFIRMED]**
- **Where:** `app.py:408-428` — `_client_ip()` (line 410) + `_rate_limited()` localhost exemption (line 416).
- **What:** `_client_ip()` returns `request.headers.get("X-Forwarded-For").split(",")[0]` — the **left-most, client-supplied** value. Two independent bypasses:
  1. Send header `X-Forwarded-For: 127.0.0.1` → `_rate_limited` line 416 (`if ip in ("127.0.0.1","::1",""): return False`) treats every request as trusted localhost → **all limits off**.
  2. Send a **fresh** `X-Forwarded-For: 1.2.3.<n>` each request → every request is a brand-new bucket → never limited.
- **Repro (direct import, deterministic):**
  ```python
  import os; os.environ["GEMINI_API_KEY"]=""; import app
  app.TRAINER_RL_MAX = 3
  def limited(xff):
      with app.app.test_request_context('/', headers={'X-Forwarded-For': xff}):
          return app._rate_limited(app._client_ip(), bucket="auth", limit=3)
  [limited("5.5.5.5") for _ in range(6)]   # -> F,F,F,T,T,T  (real IP is capped)
  [limited("127.0.0.1") for _ in range(6)] # -> F,F,F,F,F,F  (spoofed localhost: never capped)
  [limited(f"1.2.3.{i}") for i in range(6)]# -> F,F,F,F,F,F  (rotated IP: never capped)
  ```
- **Observed:** spoofed/rotated requests are never rate-limited.
- **Expected:** a single real client is capped regardless of headers it sends.
- **Impact:** defeats *every* limiter at once —
  - `auth` (10/hr, `app.py:449/470/588`): **unlimited password brute-force** against `/api/auth/login`, plus account enumeration (register returns `409` for existing emails, `app.py:460).
  - `plan` (6/hr, `app.py:739`): **unlimited real Gemini generations** → quota exhaustion / real cost.
  - `qa` (20/hr, `app.py:993`).
- **$0 fix:** gate the localhost exemption on `request.remote_addr` (the real socket peer, unspoofable), **never** on the parsed XFF. Behind Render's single proxy, take the **right-most** XFF hop, not the left-most:
  ```python
  def _client_ip():
      if request.remote_addr in ("127.0.0.1", "::1"):   # real loopback only
          return request.remote_addr
      fwd = request.headers.get("X-Forwarded-For", "")
      return (fwd.split(",")[-1].strip() if fwd else request.remote_addr) or ""
  ```
  and drop `"127.0.0.1"/"::1"` from the `_rate_limited` string check (the function above already handles real loopback). Optionally wrap the WSGI app in `werkzeug.middleware.proxy_fix.ProxyFix(app, x_for=1)` and read `request.remote_addr`.

---

### 🟠 MEDIUM

#### RT-2 — Unhandled 500 on malformed input *types* (crash family)  **[CONFIRMED]**
- **Where:** `app.py:731` (`intake.get(...)` on a non-dict `intake`); `app.py:989` (`m.get("role")` over `messages` in `/api/trainer/ask`); `app.py:329` (same in `/api/analyst`); `app.py:757` (`qa.get('q')` over `followup_answers`).
- **What:** guards assume containers hold the expected type. A JSON body where `intake` / a `messages` item / a `followup_answers` item is a **list, string, or number** hits `.get`/`.items` on a non-dict → `AttributeError` → unhandled → HTTP 500.
- **Repro (local, keyless — all return 500):**
  ```
  curl -XPOST :5000/api/trainer      -H 'Content-Type: application/json' -d '{"intake":[1,2,3]}'          # 500
  curl -XPOST :5000/api/trainer      -H 'Content-Type: application/json' -d '{"intake":"hello"}'         # 500
  curl -XPOST :5000/api/trainer/ask  -H 'Content-Type: application/json' -d '{"plan":{"type":"plan"},"messages":["boom"]}'  # 500
  curl -XPOST :5000/api/analyst      -H 'Content-Type: application/json' -d '{"messages":["boom"]}'      # 500
  ```
  (`followup_answers:["boom"]` is code-confirmed; locally it is masked by the key-gate 500 at `app.py:734`, so it only manifests on the live keyed server.)
- **Observed:** `AttributeError: 'list' object has no attribute 'get'` → 500. **Locally the full Werkzeug interactive debugger is served in the 500 body** (see RT-8) because `app.py:1052` runs `app.run(debug=True)`; production (gunicorn) returns a plain 500.
- **Expected:** a clean `400 {"error": ...}`, like the well-formed-but-empty case already returns.
- **Impact:** trivial pre-auth 500s on public endpoints; noisy error pages, log spam, and (on the plan endpoint) the crash fires *before* the key/rate-limit checks, so it is unauthenticated.
- **$0 fix:** coerce types at the boundary —
  `intake = payload.get("intake"); intake = intake if isinstance(intake, dict) else {}`;
  filter message/followup lists to dicts before iterating:
  `[m for m in messages if isinstance(m, dict)]`, `for qa in followups[:8]: if not isinstance(qa, dict): continue`.

#### RT-3 — No request-body size cap (`MAX_CONTENT_LENGTH` unset)  **[CONFIRMED]**
- **Where:** `app.py:26/36-41` — app config never sets `MAX_CONTENT_LENGTH` (`MAX_FORM_MEMORY_SIZE=500000` applies only to form/multipart, not raw JSON).
- **Repro:** POST a 12 MB JSON body `{"demo":1,"junk":"A"*12_000_000}` to `/api/trainer` → **HTTP 200**; the server buffered and JSON-parsed the entire 12 MB in memory. Confirmed `app.app.config["MAX_CONTENT_LENGTH"] is None`.
- **Observed:** unbounded bodies accepted on every endpoint.
- **Expected:** oversized bodies rejected with 413 before buffering.
- **Impact:** memory-exhaustion DoS; `/api/sync`'s own 300K/800K caps (`app.py:500`) are checked only *after* the full body is parsed. Amplified by RT-1 (no request-count limit to slow an attacker).
- **$0 fix:** `app.config["MAX_CONTENT_LENGTH"] = 2 * 1024 * 1024` (Flask returns 413 automatically; 2 MB is generous vs the sync caps).

#### RT-4 — Client-controlled `at` timestamp permanently freezes sync (newer-wins pin)  **[CODE-CONFIRMED — needs account]**
- **Where:** `app.py:506` passes `item.get("at")` straight through; `PgStore.put_blob` `app.py:122-127` upserts with `... DO UPDATE ... WHERE trainer_blobs.updated_at <= EXCLUDED.updated_at`, and archives at `app.py:116` on `int(at) > row[1]`.
- **What:** the client fully controls `at`. A single PUT with a far-future `at` (e.g. `9999999999999999`) pins `updated_at` absurdly high. Every subsequent sync carries a real ms timestamp (~`1.7e12` < the pinned value), so the `WHERE` clause fails and the upsert **silently does nothing** — no error, the route just re-reads and returns the stale value (`app.py:507-509`). The plan/logs are frozen across *all* the user's devices forever.
- **Repro (throwaway account, prod):** `PUT /api/sync {"plan":{"value":{...},"at":9999999999999999}}`, then `PUT /api/sync {"plan":{"value":{...changed...},"at":<now-ms>}}` → GET `/api/sync` still returns the first value.
- **Observed:** later legitimate updates dropped without error.
- **Expected:** newer-wins should be anchored to server time, tolerant of small skew only.
- **Impact:** self-inflicted or clock-skew-inflicted permanent sync breakage (a device whose clock is far ahead pins the account; correct-clock devices can never update). Data-availability bug.
- **$0 fix:** clamp server-side: `at = min(int(item.get("at") or now), now + 86_400_000)` (reject/cap timestamps more than ~1 day in the future) in `sync()` before `put_blob`.

#### RT-5 — `at` as a non-numeric string → 500  **[CODE-CONFIRMED — needs account]**
- **Where:** `PgStore.put_blob` `app.py:116` / `app.py:127` — `int(at)` with `at` taken from `item.get("at")` (`app.py:506`).
- **What:** `PUT /api/sync {"plan":{"value":{...},"at":"abc"}}` → `int("abc")` → `ValueError` → the `_cur` context manager rolls back and re-raises → route has no try/except → HTTP 500.
- **Expected:** 400, or coerce to server time.
- **$0 fix:** `try: at = int(item.get("at")) ... except (TypeError, ValueError): at = int(time.time()*1000)` in `sync()` (also fixes RT-4's clamp cleanly).

#### RT-6 — Decompression-bomb / oversized payload via `#p=` share fragment  **[✅ FIXED — Sprint 17]**
- **Fix shipped:** `decompressFromB64()` now rejects any encoded fragment > 256 KB
  up front, and streams the inflation through a reader loop with a hard 1 MB byte
  ceiling (cancels the stream and throws past it) — so a bomb can never be fully
  buffered. Verified in `qa_reminders.py`: an 8 MB-inflating fragment (10.6 KB
  encoded) is rejected with the tab still alive; a 300 KB encoded fragment is
  rejected by the length gate; a legit small share still renders.

- **Where:** `templates/trainer.html:1618-1624` `decompressFromB64()` and the boot handler at `:1664-1677` (`location.hash.indexOf('#p=')`).
- **What:** the share fragment is fully attacker-controlled and unauthenticated (it never hits the server). `decompressFromB64` inflates an arbitrary `deflate-raw` blob to a full string with **no size cap** before `JSON.parse` + `renderPlan`. A ~1 KB crafted fragment can inflate to hundreds of MB → victim tab hangs/OOMs on opening the link. The surrounding `try/catch` (`:1666-1675`) cannot save a tab that OOMs mid-inflate.
- **Repro:** build a URL `…/trainer#p=<deflate-raw of a multi-hundred-MB JSON string>`; opening it stalls/crashes the tab.
- **Expected:** bounded input; reject oversized shares gracefully.
- **Impact:** click-a-link client DoS (share links are meant to be sent to others).
- **$0 fix:** cap the encoded fragment length (e.g. `if (hash.length > 200_000) throw`) and cap the inflated string (`if (text.length > 1_000_000) throw`) before `JSON.parse`; same guard in `TRAINER_VIEW_HISTORY` isn't needed (server-scoped), but apply to the `#p=` path.

---

### 🟢 LOW

#### RT-7 — `esc()` does not escape quotes → attribute-breakout XSS  **[CODE-CONFIRMED — narrow/model-mediated]**
- **Where:** `esc()` at `templates/trainer.html:1679` encodes only `& < >` (via `textContent`→`innerHTML`), **not** `"` or `'`. Its output is interpolated **inside double-quoted attributes** at:
  - `:900` — follow-up input `placeholder="' + esc(q.answer_format ...) + '"` (value comes from the model's `questions` reply),
  - `:1297-1300` — Coach-Mode set inputs `placeholder="…"` / `value="…"` (values come from the user's own logged kg/reps in localStorage).
- **What:** a value containing `"` closes the attribute early; because `<`/`>` are still escaped an attacker cannot open a new tag, but they **can** inject an event-handler attribute (e.g. `" onfocus="…`). The main plan renderer (`renderPlan`) uses `esc()` only in **text** positions, and the shareable `#p=` payload flows there — so this is **not** cross-user via a shared plan. Exploit surface is limited to (a) a prompt-injected `answer_format` the model emits verbatim, and (b) self-authored log values.
- **Expected:** attribute-safe escaping everywhere `esc()` feeds an attribute.
- **$0 fix:** extend `esc()` to also replace `"`→`&quot;` and `'`→`&#39;` (safe for text nodes too), or wrap attribute uses in a dedicated `escAttr()`.

#### RT-8 — `app.run(debug=True)` ships in `app.py`  **[✅ FIXED — Sprint 18]**
- **Fix shipped:** `_debug_enabled()` reads `FLASK_DEBUG` (accepts 1/true/yes/on),
  and `app.run(debug=_debug_enabled())` now defaults **OFF** — the Werkzeug
  debugger/reloader is opt-in only. Regression test `test_debug_gated_off_by_default`
  in `tests/test_hardening.py`. Local dev opts in with `FLASK_DEBUG=1 python app.py`.

---

## Round 2 — threat-hunt on the new surfaces (Sprint 19)

#### RT-9 — iCalendar (`.ics`) injection via the plan's `weekly_split[].focus`  **[✅ DEFENDED at ship]**
- **Where:** the new `buildICS()` / `icsEscape()` in `templates/trainer.html` (Add-to-calendar).
- **What:** the exported `.ics` embeds model-generated `focus`/`day_label` text into
  `SUMMARY`/`DESCRIPTION`. Per RFC 5545, an unescaped CRLF in a TEXT value ends the
  property and can inject new properties or a whole extra `VEVENT` (calendar injection)
  into the file the victim imports. The plan text is only quasi-trusted (it's a language
  model's output, and it round-trips through shareable `#p=` links).
- **Defence shipped:** `icsEscape()` strips control chars, then escapes `\ ; ,` and folds
  every real CR/CRLF/LF to a literal `\n`; lines are emitted CRLF-terminated and folded to
  ≤75 octets. Verified in `qa_ics.py`: a `focus` carrying `\r\nSUMMARY:HACKED\r\nBEGIN:VEVENT…RRULE:FREQ=DAILY`
  produces **no** extra `VEVENT`, no standalone injected property line — the payload stays
  inside the escaped `SUMMARY` value as literal `\n`; `;`/`,`/`\` escape correctly.
- **Bonus hardening (same code):** `estimated_duration_minutes` is now `parseInt`-coerced
  (was `"85 min"` → `NaN` → an `Invalid Date` `DTEND:NaNNaN…`).

---

## Checked and found SAFE (no bug — recorded so we don't re-chase)
- **IDOR on `/api/history/<id>`** — `get_history_item` queries `WHERE user_id=%s AND id=%s` (`app.py:137`); a signed-in user cannot read another user's archived plan by guessing `hid`. Isolation holds.
- **Stored XSS via synced plan / history** — `os.js:293-296` renders history via `escA()`; `renderPlan` uses `esc()` in text positions. Goal/notes with HTML render inert.
- **CSRF** — `SESSION_COOKIE_SAMESITE="Lax"` (`app.py:37`) blocks cross-site POST/PUT with cookies; `/api/export` is a GET but its response is cross-origin-unreadable, so no data exfil.
- **Foreign-account data bleed on shared browser (happy path)** — owner-stamp (`OWNER_KEY`) wipe on identity change (`trainer.html:1586-1596`) plus server-side uid scoping prevent one account's plan/logs reaching another *when localStorage writes succeed and the user actually logs out*.

## Theoretical / watch-list
- ~~**`_trainer_hits` unbounded growth**~~ — **CLOSED Sprint 31.** `_rate_limited`
  now hard-bounds the map: once it exceeds `_RL_MAX_KEYS` (5000) it sweeps
  stale/empty keys and, if still full, fails open for a brand-new key rather than
  growing memory. An IP-rotation flood can no longer leak memory.
- ~~**XFF IP-rotation brute-forces one account past the per-IP cap**~~ — **CLOSED
  Sprint 31.** `_rate_limited_account` adds a per-email cap (`AUTH_ACCT_LIMIT`=20/hr)
  on login + reset/start, independent of source IP, so rotating `X-Forwarded-For`
  no longer multiplies password/code guesses against a targeted account. Kept
  generous so an attacker can at worst lock one account for an hour (documented
  tradeoff), never the whole site.
- ~~**Long-password hashing cost**~~ — **CLOSED Sprint 31.** `_PW_MAX`=128 caps the
  password wherever it's *set* (register, reset); login rejects anything over a
  1024-char DoS ceiling before the KDF runs, so no conceivable real password is
  locked out while a multi-MB string can't burn CPU.
- **Non-dict JSON on auth endpoints** — **CLOSED Sprint 31.** `_req_json()` coerces
  a list/string/number/malformed body to `{}` so `.get(...)` can't `AttributeError`
  → 500 on register/login/reset (previously only `/api/trainer` guarded this).
- **Sync log lost-update race**: the union-merge is client-side (`trainer.html`);
  two devices that pull→merge→push concurrently can each overwrite the other's
  `logs` blob (server does a wholesale newer-wins overwrite). Window is small;
  worst case a just-logged session is dropped on one device until its next push.
  *(Still open — a server-side per-kind merge would close it; queued.)*
- **Session secret derivation** (`app.py:34-35`): when `SECRET_KEY` is unset, the signing key is `sha256("funflix-trainer::" + DATABASE_URL)`. With a DB present this depends on the secret DB URL (acceptable); with no DB the key is a public constant, but accounts are disabled then so no session is trusted. Recommend an explicit `SECRET_KEY` env var on Render regardless.
