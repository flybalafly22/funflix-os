"""QA night capture — uses the ?qa=1 debug bridge to force night + free roam,
so iteration-4 atmosphere (lit windows, headlights, glow) can be scored."""
import sys, time, os
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:5091"
URL = BASE + "/play/city-game?qa=1"
HERE = os.path.dirname(__file__); os.makedirs(os.path.join(HERE, "shots"), exist_ok=True)
errs = []

with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=angle", "--ignore-gpu-blocklist", "--enable-webgl"])
    pg = b.new_page(viewport={"width": 1280, "height": 720})
    pg.on("console", lambda m: errs.append(f"{m.type}: {m.text}") if m.type == "error" else None)
    pg.on("pageerror", lambda e: errs.append(f"pageerror: {e}"))
    pg.goto(URL, wait_until="domcontentloaded", timeout=45000)
    pg.wait_for_selector("canvas", timeout=20000)
    pg.wait_for_timeout(2000)

    bridge = pg.evaluate("() => !!window.__cv")
    print("qa bridge present:", bridge)
    # enter free roam via bridge if available, else click through menu
    if bridge:
        pg.evaluate("() => window.__cv.freeRoam && window.__cv.freeRoam()")
        pg.wait_for_timeout(1500)
        pg.evaluate("() => window.__cv.setTime && window.__cv.setTime(22)")  # 22:00 night
        pg.wait_for_timeout(800)
    else:
        for t in ("FREE ROAM", "STORY MODE"):
            try:
                loc = pg.locator(f"text={t}").first
                if loc.count(): loc.click(timeout=2000); break
            except Exception: pass
        pg.wait_for_timeout(2000)

    # enter a vehicle + drive so headlights/beam show
    pg.keyboard.press("KeyF"); pg.wait_for_timeout(900)
    pg.keyboard.down("ArrowUp"); pg.wait_for_timeout(2200)
    info = pg.evaluate("() => window.__cv ? {nightF: window.__cv.getNightF&&window.__cv.getNightF(), inVeh: window.__cv.inVehicle&&window.__cv.inVehicle(), lights: window.__cv.lights&&window.__cv.lights()} : null")
    shot = os.path.join(HERE, "shots", f"night_{int(time.time())}.png")
    pg.screenshot(path=shot)
    pg.keyboard.up("ArrowUp")
    b.close()

print("night info:", info)
print("console/page errors:", len(errs), errs[:5])
print("shot:", shot)
