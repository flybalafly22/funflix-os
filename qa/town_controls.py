"""Verify control chirality: with camera at spawn (heading ~0, looking +Z):
   W -> +Z (away), S -> -Z (toward), D -> screen-right = -X, A -> screen-left = +X."""
import json, sys, os
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:5057"
errs = []

with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=angle", "--ignore-gpu-blocklist", "--enable-webgl"])
    pg = b.new_page(viewport={"width": 1280, "height": 720})
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(BASE + "/play/the-fly", wait_until="domcontentloaded", timeout=45000)
    pg.wait_for_selector("canvas", timeout=20000)
    pg.wait_for_timeout(3500)
    pg.keyboard.press("Space"); pg.wait_for_timeout(500)

    def reset():
        # bare southern dirt: guaranteed empty (no props, NPCs, traffic spawn here)
        pg.evaluate("""() => { const d = window.__fly.game.debug;
            d.P.pos.set(0, 0, -48); d.P.yaw = 0; d.camYaw = 0; }""")
        pg.wait_for_timeout(600)  # let the camera position settle behind (heading 0)

    def probe(key):
        reset()
        before = pg.evaluate("() => { const p = window.__fly.game.debug.P.pos; return {x: p.x, z: p.z}; }")
        pg.keyboard.down(key); pg.wait_for_timeout(1000); pg.keyboard.up(key)
        after = pg.evaluate("() => { const p = window.__fly.game.debug.P.pos; return {x: p.x, z: p.z}; }")
        return {"dx": round(after["x"] - before["x"], 2), "dz": round(after["z"] - before["z"], 2)}

    rep = {k: probe(k) for k in ["w", "s", "d", "a"]}
    ok = (rep["w"]["dz"] > 1 and rep["s"]["dz"] < -0.5 and rep["d"]["dx"] < -0.5 and rep["a"]["dx"] > 0.5)
    rep["chirality_ok"] = ok
    rep["errors"] = errs[:5]
    print(json.dumps(rep, indent=2))
    b.close()
