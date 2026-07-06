"""
THE FLY — Sprint 0 baseline capture.

Boots /play/the-fly in headless Chromium, freezes the camera to fixed poses (via
the window.__QA_FREEZE hook in town.html) over the deterministic seed (world.js
setSeed(20240617)), and captures:
  • fixed-camera / fixed-seed screenshots: plaza, one street, one retail vignette
  • perf metrics at desktop + simulated-mobile viewports:
      FPS proxy (rAF over a window), draw calls, triangles, textures + est. texture MB
  • GLTF-pipeline verification (loads /play/the-fly?gltf=1, confirms the probe asset
    is in-scene) and a shot with the probe visible.

Outputs into docs/overhaul/sprint-0/ : *.png + baseline_perf.json.

CAVEAT: headless Chromium uses SwiftShader (software WebGL), so FPS is a
regression FLOOR, not GPU-accurate. Draw calls / triangles / textures are exact.

Usage: python qa/baseline_sprint0.py [base_url]   (default http://127.0.0.1:5099)
"""
import json
import os
import sys
import time

from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:5099").rstrip("/")
URL = BASE + "/play/the-fly"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs", "overhaul", "sprint-0")
OUT = os.path.abspath(OUT)
os.makedirs(OUT, exist_ok=True)

# Fixed camera poses (world coords; see ART_BIBLE §6 / world.js). {px,py,pz}=eye,
# {lx,ly,lz}=look-at. Chosen to frame real locations deterministically.
SHOTS = [
    ("plaza",  dict(px=0,   py=34, pz=64,  lx=0,  ly=0, lz=24)),   # aerial 3/4 over the plaza + fountain
    ("street", dict(px=-56, py=15, pz=17,  lx=6,  ly=1, lz=0)),    # down the main avenue (z=0)
    ("shop",   dict(px=10,  py=6,  pz=34,  lx=2,  ly=2, lz=22)),   # street-level retail vignette (no walk-in interiors in this build)
]

# device profiles
DESKTOP = dict(name="desktop", viewport={"width": 1280, "height": 720}, dpr=1.5, mobile=False)
MOBILE = dict(name="mobile", viewport={"width": 390, "height": 844}, dpr=2.0, mobile=True)

PERF_JS = """
() => new Promise(resolve => {
  const fly = window.__fly; if (!fly) { resolve({error:'no __fly'}); return; }
  const R = fly.renderer, S = fly.scene, C = fly.camera;
  let frames = 0; const t0 = performance.now();
  function loop(){ frames++; const el = performance.now() - t0;
    if (el < 2000) { requestAnimationFrame(loop); }
    else {
      // renderer.info reflects the LAST render() — with the post composer that is a
      // fullscreen quad (calls=1). Force ONE full SCENE render from the frozen
      // camera and read info immediately → true scene draw calls / triangles.
      R.info.autoReset = true;
      R.setRenderTarget(null); R.render(S, C);
      const ri = R.info.render, mem = R.info.memory;
      // texture-MB estimate: walk unique textures on scene materials (RGBA8 + ~33% mips)
      const seen = new Set(); let bytes = 0;
      S.traverse(o => {
        const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
        mats.forEach(m => { for (const k in m) { const t = m[k];
          if (t && t.isTexture && t.image && !seen.has(t.uuid)) { seen.add(t.uuid);
            const w = t.image.width||t.image.videoWidth||0, h = t.image.height||t.image.videoHeight||0;
            bytes += w*h*4*1.33; } } });
      });
      resolve({
        fps: +(frames/(el/1000)).toFixed(1),
        scene_draw_calls: ri.calls, scene_triangles: ri.triangles,
        geometries: mem.geometries, textures: mem.textures,
        est_texture_mb: +(bytes/1048576).toFixed(1),
        pixelRatio: R.getPixelRatio(),
        note: 'scene_draw_calls = one beauty pass; per-frame total is ~2-3x (adds shadow + ink normal passes). FPS = SwiftShader floor.'
      });
    }
  }
  requestAnimationFrame(loop);
})
"""


def boot(page, url):
    errors = []
    logs = []
    page.on("console", lambda m: (logs.append(m.text),
            errors.append(m.type + ": " + m.text) if m.type == "error" else None))
    page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
    page.goto(url, wait_until="domcontentloaded", timeout=45000)
    page.wait_for_selector("canvas", timeout=20000)
    page.wait_for_timeout(3500)   # let world build + batch + settle
    # dismiss the "PRESS ANY KEY TO START" card so baseline shots show the town,
    # not the title overlay (camera is frozen for framing regardless)
    page.keyboard.press("Enter")
    page.wait_for_timeout(1200)
    batch = next((l for l in logs if "batched static geometry" in l), None)
    return errors, batch


def run():
    report = {"url": URL, "ts": time.strftime("%Y-%m-%d %H:%M:%S"), "seed": 20240617, "devices": {}}
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--use-gl=angle", "--ignore-gpu-blocklist", "--enable-webgl"])

        for dev in (DESKTOP, MOBILE):
            ctx = browser.new_context(viewport=dev["viewport"], device_scale_factor=dev["dpr"],
                                      is_mobile=dev["mobile"], has_touch=dev["mobile"])
            page = ctx.new_page()
            errs, batch = boot(page, URL)

            # freeze to a canonical pose (plaza) so draw-call counts are stable and
            # comparable across devices (frustum culling makes them view-dependent)
            page.evaluate("(f) => { window.__QA_FREEZE = f; }", SHOTS[0][1])
            page.wait_for_timeout(600)
            perf = page.evaluate(PERF_JS)
            report["devices"][dev["name"]] = {"viewport": dev["viewport"], "dpr": dev["dpr"],
                                              "perf": perf, "batching": batch, "console_errors": errs}

            # fixed-camera / fixed-seed shots
            for name, pose in SHOTS:
                page.evaluate("(f) => { window.__QA_FREEZE = f; }", pose)
                page.wait_for_timeout(500)   # let the freeze pose render a few frames
                page.screenshot(path=os.path.join(OUT, "baseline_%s_%s.png" % (name, dev["name"])))
            page.evaluate("() => { window.__QA_FREEZE = null; }")
            ctx.close()

        # GLTF pipeline verification (desktop, ?gltf=1)
        ctx = browser.new_context(viewport=DESKTOP["viewport"], device_scale_factor=DESKTOP["dpr"])
        page = ctx.new_page()
        gerrs, _gbatch = boot(page, URL + "?gltf=1")
        page.wait_for_timeout(1500)
        gltf = page.evaluate("""() => {
          const a = window.__fly && window.__fly.assets;
          const loaded = a && a.loaded && a.loaded.crate;
          let meshes = 0; if (loaded) loaded.traverse(o => { if (o.isMesh) meshes++; });
          return { loaderReady: !!(a && a.ready), probeInScene: !!loaded, probeMeshes: meshes,
                   manifest: a ? Object.keys(a.manifest) : [] };
        }""")
        page.evaluate("(f) => { window.__QA_FREEZE = f; }", dict(px=0, py=34, pz=68, lx=0, ly=18, lz=42))
        page.wait_for_timeout(500)
        page.screenshot(path=os.path.join(OUT, "gltf_probe_desktop.png"))
        gltf["console_errors"] = gerrs
        report["gltf_pipeline"] = gltf
        ctx.close()
        browser.close()

    with open(os.path.join(OUT, "baseline_perf.json"), "w") as f:
        json.dump(report, f, indent=2)
    print(json.dumps(report, indent=2))
    return report


if __name__ == "__main__":
    run()
