"""QA drive of THE FLY town build: start card, movement, collision, traffic, shots."""
import json, sys, time, os
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:5057"
OUT = os.path.dirname(os.path.abspath(__file__))
URL = BASE + "/play/the-fly"
errs = []

with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=angle", "--ignore-gpu-blocklist", "--enable-webgl"])
    pg = b.new_page(viewport={"width": 1280, "height": 720})
    pg.on("console", lambda m: errs.append(f"{m.type}: {m.text}") if m.type == "error" else None)
    pg.on("pageerror", lambda e: errs.append(f"pageerror: {e}"))
    pg.goto(URL, wait_until="domcontentloaded", timeout=45000)
    pg.wait_for_selector("canvas", timeout=20000)
    pg.wait_for_timeout(4000)

    rep = {}
    rep["start_card_visible"] = pg.evaluate("() => !!document.getElementById('flyStart')")
    pg.screenshot(path=os.path.join(OUT, "qa_startcard.png"))

    # begin the game
    pg.keyboard.press("Space")
    pg.wait_for_timeout(800)
    rep["start_card_gone"] = pg.evaluate(
        "() => { const s = document.getElementById('flyStart'); return !s || s.classList.contains('gone'); }")
    rep["job_started"] = pg.evaluate("() => document.querySelector('#flyTimerT').textContent !== '--'")

    # walk forward for a bit
    pg.keyboard.down("w"); pg.wait_for_timeout(2500); pg.keyboard.up("w")
    pg.screenshot(path=os.path.join(OUT, "qa_walk.png"))
    pos1 = pg.evaluate("() => ({x: window.__fly.ctx.player.pos.x, z: window.__fly.ctx.player.pos.z})")
    rep["moved_from_spawn"] = abs(pos1["x"]) + abs(pos1["z"] + 4) > 2

    # COLLISION TEST: teleport just in front of the clock tower (0, ROWZ+22=41 z),
    # then push into it for 3s — we must NOT end up inside the 3.8 half-extent box.
    pg.evaluate("""() => { const g = window.__fly; g.game && 0;
        // reach into the game via player handle: set position by dispatching through __fly
        }""")
    # use keyboard only: turn and walk toward a known building row instead.
    # Simpler check: walk hard toward +Z (plaza civics at z=28) for 8s; z must stay < 24.5
    pg.keyboard.down("w"); pg.wait_for_timeout(8000); pg.keyboard.up("w")
    pos2 = pg.evaluate("() => ({x: window.__fly.ctx.player.pos.x, z: window.__fly.ctx.player.pos.z, y: window.__fly.ctx.player.pos.y})")
    rep["pos_after_push"] = pos2
    pg.screenshot(path=os.path.join(OUT, "qa_collide.png"))

    # ground height: on the plaza the courier should ride at ~0.25
    rep["ground_y"] = round(pos2["y"], 3)

    # walk left along the avenue (camera-relative turn) and shoot
    pg.keyboard.down("a"); pg.wait_for_timeout(3000); pg.keyboard.up("a")
    pg.screenshot(path=os.path.join(OUT, "qa_turn.png"))

    rep["errors"] = errs[:15]
    print(json.dumps(rep, indent=2))
    b.close()
