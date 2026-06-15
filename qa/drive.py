"""QA gameplay capture — drives into the world and screenshots actual rendering
so visual fidelity can be scored (not just the title screen)."""
import sys, time, os
from playwright.sync_api import sync_playwright

URL = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:5072") + "/play/city-game"
HERE = os.path.dirname(__file__); os.makedirs(os.path.join(HERE, "shots"), exist_ok=True)
errs = []

def click_text(pg, txt):
    try:
        loc = pg.locator(f"text={txt}").first
        if loc.count() and loc.is_visible():
            loc.click(timeout=2500); return True
    except Exception:
        pass
    return False

with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=angle", "--ignore-gpu-blocklist", "--enable-webgl"])
    pg = b.new_page(viewport={"width": 1280, "height": 720})
    pg.on("console", lambda m: errs.append(f"{m.type}: {m.text}") if m.type == "error" else None)
    pg.on("pageerror", lambda e: errs.append(f"pageerror: {e}"))
    pg.goto(URL, wait_until="domcontentloaded", timeout=45000)
    pg.wait_for_selector("canvas", timeout=20000)
    pg.wait_for_timeout(2500)

    # into gameplay: free roam if available, else Story Mode + skip cinematic
    if not click_text(pg, "FREE ROAM"):
        for t in ("STORY MODE", "CONTINUE", "REPLAY STORY"):
            if click_text(pg, t):
                break
        pg.wait_for_timeout(1500)
        for _ in range(6):  # skip cinematic cards
            pg.keyboard.press("Enter"); pg.wait_for_timeout(350)
        click_text(pg, "LET'S GO"); pg.wait_for_timeout(900)
        for _ in range(6):  # advance opening dialog
            pg.keyboard.press("Enter"); pg.wait_for_timeout(350)
    pg.wait_for_timeout(2500)

    shots = []
    # enter a vehicle if possible, then drive
    pg.keyboard.press("KeyF"); pg.wait_for_timeout(1200)
    pg.screenshot(path=(s:=os.path.join(HERE, "shots", f"game_{int(time.time())}_a.png"))); shots.append(s)
    pg.keyboard.down("ArrowUp"); pg.wait_for_timeout(2600)
    pg.screenshot(path=(s:=os.path.join(HERE, "shots", f"game_{int(time.time())}_b.png"))); shots.append(s)
    pg.keyboard.down("ArrowLeft"); pg.wait_for_timeout(1500)  # corner -> roll/drift
    pg.screenshot(path=(s:=os.path.join(HERE, "shots", f"game_{int(time.time())}_c.png"))); shots.append(s)
    pg.keyboard.up("ArrowLeft"); pg.keyboard.up("ArrowUp")
    b.close()

print("console/page errors during drive:", len(errs), errs[:5])
print("shots:", *shots, sep="\n  ")
