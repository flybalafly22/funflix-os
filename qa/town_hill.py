"""Sprint 6 QA: climb the mirador stairs, verify heights, screenshot the lookout."""
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
    pg.keyboard.press("Space"); pg.wait_for_timeout(500)

    rep = {}
    # place at the park's south gate facing the hill (-Z), walk up both stairs
    pg.evaluate("""() => { const d = window.__fly.game.debug;
        d.P.pos.set(-78, 0.25, -24.5); d.P.yaw = Math.PI; d.camYaw = Math.PI; }""")
    pg.wait_for_timeout(700)
    pg.keyboard.down("w"); pg.wait_for_timeout(2600); pg.keyboard.up("w")
    t1 = pg.evaluate("() => { const p = window.__fly.game.debug.P.pos; return {x: +p.x.toFixed(1), y: +p.y.toFixed(2), z: +p.z.toFixed(1)}; }")
    rep["on_terrace1"] = t1
    pg.screenshot(path=os.path.join(OUT, "hill_t1.png"))
    # continue to terrace 2
    pg.keyboard.down("w"); pg.wait_for_timeout(5200); pg.keyboard.up("w")
    t2 = pg.evaluate("() => { const p = window.__fly.game.debug.P.pos; return {x: +p.x.toFixed(1), y: +p.y.toFixed(2), z: +p.z.toFixed(1)}; }")
    rep["on_terrace2"] = t2
    rep["climbed"] = t1["y"] > 2.5 and t2["y"] > 5.3
    # the lookout view: stand at the mirador, face the town (+Z)
    pg.evaluate("""() => { const d = window.__fly.game.debug;
        d.P.pos.set(-70, 5.74, -49); d.P.yaw = 0; d.camYaw = 0; }""")
    pg.wait_for_timeout(1400)
    pg.screenshot(path=os.path.join(OUT, "hill_lookout.png"))

    # hilltop addresses exist and are deliverable
    rep["hill_addresses"] = pg.evaluate("""() => {
        const names = ['CASA COLINA', 'EL NIDO', 'LA ERMITA', 'EL MIRADOR'];
        const A = window.__fly.world.addresses;
        return names.filter(n => A.some(a => a.name === n));
    }""")
    # walls hold: try to walk off the T2 south edge for 2s — y must stay high
    pg.evaluate("""() => { const d = window.__fly.game.debug;
        d.P.pos.set(-78, 5.74, -56); d.P.yaw = Math.PI; d.camYaw = Math.PI; }""")
    pg.wait_for_timeout(500)
    pg.keyboard.down("w"); pg.wait_for_timeout(1500); pg.keyboard.up("w")
    edge = pg.evaluate("() => +window.__fly.game.debug.P.pos.y.toFixed(2)")
    rep["edge_guarded_y"] = edge

    rep["errors"] = errs[:10]
    print(json.dumps(rep, indent=2))
    b.close()
