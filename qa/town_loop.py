"""End-to-end loop QA: pickup -> deliver -> score; traffic bump; screenshots."""
import json, sys, time, os
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:5057"
OUT = os.path.dirname(os.path.abspath(__file__))
errs = []

with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=angle", "--ignore-gpu-blocklist", "--enable-webgl"])
    pg = b.new_page(viewport={"width": 1280, "height": 720})
    pg.on("console", lambda m: errs.append(f"{m.type}: {m.text}") if m.type == "error" else None)
    pg.on("pageerror", lambda e: errs.append(f"pageerror: {e}"))
    pg.goto(BASE + "/play/the-fly", wait_until="domcontentloaded", timeout=45000)
    pg.wait_for_selector("canvas", timeout=20000)
    pg.wait_for_timeout(3500)
    pg.keyboard.press("Space")
    pg.wait_for_timeout(600)

    rep = {}
    # teleport next to the pickup, wait a beat, expect carrying=true
    rep["picked_up"] = pg.evaluate("""() => new Promise(res => {
        const d = window.__fly.game.debug;
        d.P.pos.x = d.pickup.pos.x + 1.5; d.P.pos.z = d.pickup.pos.z + 1.5;
        setTimeout(() => res(d.carrying), 600);
    })""")
    pg.screenshot(path=os.path.join(OUT, "qa_pickup.png"))
    # teleport to the dropoff, expect score > 0 and a new job assigned
    rep["delivered"] = pg.evaluate("""() => new Promise(res => {
        const d = window.__fly.game.debug;
        d.P.pos.x = d.dropoff.pos.x + 1.5; d.P.pos.z = d.dropoff.pos.z + 1.5;
        setTimeout(() => res({score: d.score, newJobCarrying: d.carrying}), 700);
    })""")
    pg.screenshot(path=os.path.join(OUT, "qa_deliver.png"))

    # traffic bump: stand in the main-avenue right lane and wait up to 25s
    rep["traffic_bump"] = pg.evaluate("""() => new Promise(res => {
        const d = window.__fly.game.debug;
        d.P.pos.x = 30; d.P.pos.z = -3.6;   // driving lane, away from intersections
        const t0 = performance.now();
        (function poll(){
            if (d.stun > 0) return res({hit: true, after_ms: Math.round(performance.now() - t0)});
            if (performance.now() - t0 > 25000) return res({hit: false});
            // keep re-planting the courier in the lane in case knockback moved him
            if (d.stun <= 0) { d.P.pos.x = 30; d.P.pos.z = -3.6; }
            setTimeout(poll, 120);
        })();
    })""")

    rep["errors"] = errs[:15]
    print(json.dumps(rep, indent=2))
    b.close()
