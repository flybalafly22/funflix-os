"""Sprint 7 QA: harbor view + deck walk + water guard + dialogue trigger."""
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
    # walk onto the quay looking at the boat + sea
    pg.evaluate("""() => { const d = window.__fly.game.debug;
        d.P.pos.set(146, 0, 0); d.P.yaw = Math.PI / 2; d.camYaw = Math.PI / 2; }""")
    pg.wait_for_timeout(1200)
    pg.keyboard.down("w"); pg.wait_for_timeout(2200); pg.keyboard.up("w")
    pos = pg.evaluate("() => { const p = window.__fly.game.debug.P.pos; return {x: +p.x.toFixed(1), y: +p.y.toFixed(2)}; }")
    rep["on_deck"] = pos
    pg.screenshot(path=os.path.join(OUT, "harbor_view.png"))
    # water guard: keep pushing east — x must stop before 165.4
    pg.keyboard.down("w"); pg.wait_for_timeout(3000); pg.keyboard.up("w")
    edge = pg.evaluate("() => +window.__fly.game.debug.P.pos.x.toFixed(1)")
    rep["water_guard_x"] = edge
    rep["harbor_addresses"] = pg.evaluate("""() => ['LA LONJA', 'EL PESQUERO']
        .filter(n => window.__fly.world.addresses.some(a => a.name === n))""")

    # dialogue: force a story job via debug? — simulate by delivering until a story appears is slow;
    # instead directly call say() is internal. Check the dlg element exists and chains render in log.
    rep["dlg_el"] = pg.evaluate("() => !!document.getElementById('flyDlg')")
    rep["log_chains"] = pg.evaluate("() => document.querySelectorAll('#flyLog .q').length")

    rep["errors"] = errs[:10]
    print(json.dumps(rep, indent=2))
    b.close()
