"""
Costa Vista QA harness — objective measurements for the GTA-likeness loop.
Boots the game in headless Chromium and reports:
  - load time, console errors / page errors
  - FPS proxy (rAF samples over a window; software-rendered, see caveat)
  - WebGL context present, canvas size
  - feature presence (HUD ids + key text markers found in DOM)
  - screenshot to qa/shots/

Usage: python qa/harness.py [base_url]   (default http://127.0.0.1:5070)
Writes qa/last_report.json and prints a summary.

CAVEAT: headless Chromium renders WebGL via software (SwiftShader), so the FPS
number is a *floor / regression signal*, not real-GPU framerate. Treat large
drops or hard caps as meaningful; absolute value is not GPU-accurate.
"""
import json
import os
import sys
import time

URL = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:5070") + "/play/city-game"
HERE = os.path.dirname(__file__)
os.makedirs(os.path.join(HERE, "shots"), exist_ok=True)

# Feature markers we expect a GTA-like build to have in the DOM/HUD.
FEATURE_IDS = ["minimap", "speedo", "wanted", "hud", "objective"]
FEATURE_TEXT = ["minimap", "speed", "wanted", "objective", "health", "radio"]

from playwright.sync_api import sync_playwright

def run():
    errors, page_errors = [], []
    rep = {"url": URL, "ts": time.strftime("%Y-%m-%d %H:%M:%S")}
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-gl=angle", "--ignore-gpu-blocklist",
                                    "--enable-webgl", "--enable-accelerated-2d-canvas"])
        pg = b.new_page(viewport={"width": 1280, "height": 720})
        pg.on("console", lambda m: errors.append(f"{m.type}: {m.text}") if m.type == "error" else None)
        pg.on("pageerror", lambda e: page_errors.append(str(e)))

        t0 = time.time()
        pg.goto(URL, wait_until="domcontentloaded", timeout=45000)
        # wait for the canvas / first render
        try:
            pg.wait_for_selector("canvas", timeout=20000)
        except Exception:
            pass
        pg.wait_for_timeout(3500)  # let the scene warm up
        rep["load_seconds"] = round(time.time() - t0, 2)

        # WebGL + canvas
        rep["webgl"] = pg.evaluate("""() => {
            const c = document.querySelector('canvas');
            if (!c) return {present:false};
            const gl = c.getContext('webgl') || c.getContext('webgl2') || c.getContext('experimental-webgl');
            return {present: !!gl, w: c.width, h: c.height,
                    renderer: gl ? (()=>{const e=gl.getExtension('WEBGL_debug_renderer_info');
                        return e? gl.getParameter(e.UNMASKED_RENDERER_WEBGL):'n/a';})() : 'none'};
        }""")

        # FPS proxy over ~4s
        rep["fps"] = pg.evaluate("""() => new Promise(res => {
            let n = 0; const start = performance.now();
            (function loop(){ n++; if (performance.now()-start < 4000) requestAnimationFrame(loop);
              else res(Math.round(n / ((performance.now()-start)/1000))); })();
        })""")

        # feature presence
        present = pg.evaluate("""(ids) => {
            const html = document.body.innerHTML.toLowerCase();
            const byId = ids.filter(i => document.getElementById(i));
            return {byId, htmlLen: html.length};
        }""", FEATURE_IDS)
        text_hits = pg.evaluate("""(words) => {
            const t = document.body.innerText.toLowerCase();
            return words.filter(w => t.includes(w));
        }""", FEATURE_TEXT)
        rep["features"] = {"hud_ids_found": present["byId"], "text_markers_found": text_hits}

        shot = os.path.join(HERE, "shots", f"shot_{int(time.time())}.png")
        pg.screenshot(path=shot)
        rep["screenshot"] = shot
        b.close()

    rep["console_errors"] = errors[:25]
    rep["page_errors"] = page_errors[:25]
    # objective gates
    rep["gates"] = {
        "renders": bool(rep["webgl"].get("present")),
        "no_console_errors": len(errors) == 0,
        "no_page_errors": len(page_errors) == 0,
        "load_under_8s": rep["load_seconds"] < 8,
        "fps_ok_proxy": rep["fps"] >= 30,
    }
    with open(os.path.join(HERE, "last_report.json"), "w") as f:
        json.dump(rep, f, indent=2)

    print("── Costa Vista QA ──")
    print(f"load        : {rep['load_seconds']}s")
    print(f"fps (proxy) : {rep['fps']}  (software-rendered floor, not GPU-accurate)")
    print(f"webgl       : {rep['webgl']}")
    print(f"console err : {len(errors)}  {errors[:3]}")
    print(f"page err    : {len(page_errors)}  {page_errors[:3]}")
    print(f"HUD ids     : {present['byId']}")
    print(f"text markers: {text_hits}")
    print(f"gates       : {rep['gates']}")
    print(f"screenshot  : {shot}")
    return rep

if __name__ == "__main__":
    run()
