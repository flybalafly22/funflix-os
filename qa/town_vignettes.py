"""Screenshot the vignettes: scooter repair, pelota kids, fisherman, carpenter."""
import sys, os
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:5057"
OUT = os.path.dirname(os.path.abspath(__file__))
SPOTS = [
    ("vig_scooter.png", -35.5, -7.5, 3.4),   # face -Z toward the repair
    ("vig_fisher.png", 161.5, -16.5, 1.5708),  # face +X toward the sitting fisherman
    ("vig_carpenter.png", 95, -7.2, 3.14159),  # face -Z toward the sawing
    ("vig_shrine.png", 41.8, 10.2, 0.35),            # face +Z toward the shrine
]

with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=angle", "--ignore-gpu-blocklist", "--enable-webgl"])
    pg = b.new_page(viewport={"width": 1280, "height": 720})
    pg.goto(BASE + "/play/the-fly", wait_until="domcontentloaded", timeout=45000)
    pg.wait_for_selector("canvas", timeout=20000)
    pg.wait_for_timeout(3500)
    pg.keyboard.press("Space"); pg.wait_for_timeout(400)
    pg.keyboard.press("KeyP"); pg.wait_for_timeout(200)   # photo mode: clean frames
    for name, x, z, yaw in SPOTS:
        pg.evaluate(f"""() => {{ const d = window.__fly.game.debug;
            d.P.pos.set({x}, 0.25, {z}); d.P.yaw = {yaw}; d.camYaw = {yaw}; }}""")
        pg.wait_for_timeout(1300)
        pg.screenshot(path=os.path.join(OUT, name))
    b.close()
print("vignette shots saved")
