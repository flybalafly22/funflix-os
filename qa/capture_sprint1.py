"""
THE FLY — Sprint 1 (Hero Block) evidence capture.

Usage: python qa/capture_sprint1.py <label> [base_url]
  <label> = 'before' or 'after' (writes docs/overhaul/sprint-1/<label>_*.png)

Captures fixed-camera / fixed-seed art shots (HUD hidden) at the hero-slice poses,
a live-HUD mobile + desktop shot (real chase camera, HUD visible) to show the HUD
overflow + portrait-framing fixes, runs an interior-entry-trigger check, and records
perf. Same seed (20240617) as the Sprint 0 baseline.
"""
import json, os, sys, time
from playwright.sync_api import sync_playwright

LABEL = sys.argv[1] if len(sys.argv) > 1 else "after"
BASE = (sys.argv[2] if len(sys.argv) > 2 else "http://127.0.0.1:5099").rstrip("/")
URL = BASE + "/play/the-fly"
OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "docs", "overhaul", "sprint-1"))
os.makedirs(OUT, exist_ok=True)

# fixed art poses (HUD hidden) — matched to the Sprint 0 baseline framing
ART = {
    "plaza":   dict(px=0,  py=34, pz=64, lx=0,  ly=0, lz=24),
    "tower":   dict(px=10, py=16, pz=58, lx=0,  ly=18, lz=41),  # clock-tower hero close-up
    "rooftop": dict(px=6,  py=30, pz=40, lx=8,  ly=6,  lz=18),  # flat roofs: AC units, dome, density
}
DESKTOP = {"width": 1280, "height": 720}
MOBILE = {"width": 390, "height": 844}

PERF_JS = """() => new Promise(res=>{const R=window.__fly.renderer,S=window.__fly.scene,C=window.__fly.camera;
 let f=0;const t0=performance.now();(function l(){f++;const e=performance.now()-t0;
 if(e<1600){requestAnimationFrame(l);}else{R.info.autoReset=true;R.setRenderTarget(null);R.render(S,C);
 const ri=R.info.render,m=R.info.memory;res({fps:+(f/(e/1000)).toFixed(1),scene_draw_calls:ri.calls,
 scene_triangles:ri.triangles,geometries:m.geometries,textures:m.textures,pixelRatio:R.getPixelRatio()});}})();})"""


def boot(pg, url):
    errs = []
    pg.on("console", lambda m: errs.append(m.type + ": " + m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: errs.append("pageerror: " + str(e)))
    pg.goto(url, wait_until="domcontentloaded", timeout=45000)
    pg.wait_for_selector("canvas", timeout=20000)
    pg.wait_for_timeout(3500)
    pg.keyboard.press("Enter"); pg.wait_for_timeout(1000)   # dismiss start card → gameplay HUD live
    return errs


def run():
    report = {"label": LABEL, "ts": time.strftime("%Y-%m-%d %H:%M:%S"), "seed": 20240617}
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-gl=angle", "--ignore-gpu-blocklist", "--enable-webgl"])

        # ---- art shots, both viewports, HUD hidden ----
        for vpname, vp in (("desktop", DESKTOP), ("mobile", MOBILE)):
            ctx = b.new_context(viewport=vp, device_scale_factor=1.5)
            pg = ctx.new_page(); errs = boot(pg, URL)
            report.setdefault("console_errors", {})[vpname] = errs
            pg.evaluate("() => { const h=document.getElementById('hud'); if(h) h.style.display='none'; }")
            for name, pose in ART.items():
                if vpname == "mobile" and name != "plaza":
                    continue  # mobile art shot: plaza only (keeps set tight)
                pg.evaluate("(f)=>{window.__QA_FREEZE=f;}", pose)
                pg.wait_for_timeout(450)
                pg.screenshot(path=os.path.join(OUT, "%s_%s_%s.png" % (LABEL, name, vpname)))
            report.setdefault("perf", {})[vpname] = pg.evaluate(PERF_JS)
            ctx.close()

        # ---- live-HUD shots (real chase camera, HUD visible): HUD-overflow + portrait framing ----
        for vpname, vp in (("desktop", DESKTOP), ("mobile", MOBILE)):
            ctx = b.new_context(viewport=vp, device_scale_factor=2 if vpname == "mobile" else 1.5,
                                is_mobile=(vpname == "mobile"), has_touch=(vpname == "mobile"))
            pg = ctx.new_page(); boot(pg, URL)
            pg.evaluate("() => { window.__QA_FREEZE = null; }")   # let the real chase camera frame it
            pg.wait_for_timeout(1200)
            # measure the rank card: does any long line overflow, and does the log button overlap?
            hud = pg.evaluate("""()=>{const el=document.getElementById('flyBest');if(!el)return{none:true};
              const r=el.getBoundingClientRect();const lb=document.getElementById('flyLogBtn');
              const lr=lb?lb.getBoundingClientRect():null;
              const overlap = lr ? !(lr.top>r.bottom||lr.bottom<r.top||lr.left>r.right||lr.right<r.left) : null;
              return {cardW:Math.round(r.width),cardBottom:Math.round(r.bottom),scrollW:el.scrollWidth,
                clientW:el.clientWidth,overflowX:el.scrollWidth>el.clientWidth,logBtnOverlapsCard:overlap};}""")
            report.setdefault("hud_check", {})[vpname] = hud
            pg.screenshot(path=os.path.join(OUT, "%s_hud_%s.png" % (LABEL, vpname)))
            ctx.close()

        # ---- interior entry-trigger check (only meaningful on 'after'; run both for parity) ----
        ctx = b.new_context(viewport=DESKTOP, device_scale_factor=1.5)
        pg = ctx.new_page(); boot(pg, URL)
        trig = pg.evaluate("""()=>new Promise(res=>{
          // use the game's own debug API: teleport the courier to an enterable shop,
          // confirm the door trigger fires, then enter + exit.
          const g=window.__fly.game.debug, w=window.__fly.world;
          const names=g.enterableNames(); const shop=names.find(n=>n==='PHARMACY')||names[0];
          const a=(w.addresses||[]).find(x=>x.name===shop);
          if(!a){res({checked:false});return;}
          g.P.pos.set(a.pos.x,0,a.pos.z);
          requestAnimationFrame(()=>requestAnimationFrame(()=>{
            const nearDoor=g.nearDoor; g.enterShop(shop);
            requestAnimationFrame(()=>requestAnimationFrame(()=>{
              const inAfterEnter=g.inside; g.leaveShop();
              requestAnimationFrame(()=>requestAnimationFrame(()=>{
                res({checked:true, enterableCount:names.length, shop, nearDoorDetected:nearDoor,
                  insideAfterEnter:inAfterEnter, insideAfterExit:g.inside,
                  pass:(nearDoor===shop && inAfterEnter===true && g.inside===false)});
              }));
            }));
          }));
        })""")
        report["interior_trigger"] = trig
        ctx.close()
        b.close()

    with open(os.path.join(OUT, "%s_report.json" % LABEL), "w") as f:
        json.dump(report, f, indent=2)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    run()
