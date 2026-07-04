"""Sprint 10 QA: bike, lost letters, gust chase, day report."""
import json, sys, os
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
    pg.evaluate("() => localStorage.clear()")
    pg.keyboard.press("Space"); pg.wait_for_timeout(500)

    rep = {}
    # BIKE: stand next to it, mount, ride 1s in empty ground, expect > walking distance
    pg.evaluate("""() => { const d = window.__fly.game.debug;
        d.P.pos.set(0, 0, -48); d.P.yaw = 0; d.camYaw = 0;
        d.bikePos.set(0.8, 0, -48); }""")
    pg.wait_for_timeout(600)
    pg.keyboard.press("KeyE"); pg.wait_for_timeout(300)
    rep["mounted"] = pg.evaluate("() => window.__fly.game.debug.onBike")
    z0 = pg.evaluate("() => window.__fly.game.debug.P.pos.z")
    pg.keyboard.down("w"); pg.wait_for_timeout(1000); pg.keyboard.up("w")
    z1 = pg.evaluate("() => window.__fly.game.debug.P.pos.z")
    rep["bike_dz_1s"] = round(z1 - z0, 2)          # walking ≈ 3.2; bike should be > 5
    pg.keyboard.press("KeyE"); pg.wait_for_timeout(200)
    rep["dismounted"] = pg.evaluate("() => !window.__fly.game.debug.onBike")

    # LOST LETTER: teleport to spot #3 (0, 24.5)
    pg.evaluate("""() => { const d = window.__fly.game.debug; d.P.pos.set(6.5, 0.25, 20.5); }""")
    pg.wait_for_timeout(600)
    rep["letters_found"] = pg.evaluate("() => window.__fly.game.debug.lostCount()")

    # GUST: grab the pickup, force the gust, chase the letter
    gust = pg.evaluate("""() => new Promise(res => {
        const d = window.__fly.game.debug;
        d.P.pos.x = d.pickup.pos.x + 1.2; d.P.pos.z = d.pickup.pos.z + 1.2;
        setTimeout(() => {
            d.forceGust();
            setTimeout(() => {
                const loose = d.gustLoose;
                d.P.pos.x = d.gustPos.x; d.P.pos.z = d.gustPos.z;
                setTimeout(() => res({loose, recovered: !d.gustLoose && d.carrying}), 1600);
            }, 300);
        }, 600);
    })""")
    rep["gust"] = gust

    # DAY REPORT: set dayDeliv to 7 and deliver once
    rep["report"] = pg.evaluate("""() => new Promise(res => {
        const d = window.__fly.game.debug;
        d.dayDeliv = 7;
        d.P.pos.x = d.dropoff.pos.x + 1.2; d.P.pos.z = d.dropoff.pos.z + 1.2;
        setTimeout(() => res({shown: d.reporting, day: d.dayNum}), 900);
    })""")
    pg.screenshot(path=os.path.join(OUT, "day_report.png"))
    pg.keyboard.press("Enter"); pg.wait_for_timeout(400)
    rep["report_closed_day"] = pg.evaluate("() => ({rep: window.__fly.game.debug.reporting, day: window.__fly.game.debug.dayNum})")

    rep["errors"] = errs[:10]
    print(json.dumps(rep, indent=2))
    b.close()
