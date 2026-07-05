"""Sprint 11 QA: coins, BAZAR shop, tram ride, rain."""
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
    # coins from a delivery
    c0 = pg.evaluate("() => window.__fly.game.debug.coins")
    pg.evaluate("""() => new Promise(r => { const d = window.__fly.game.debug;
        d.P.pos.x = d.pickup.pos.x+1.2; d.P.pos.z = d.pickup.pos.z+1.2;
        setTimeout(()=>{ d.P.pos.x=d.dropoff.pos.x+1.2; d.P.pos.z=d.dropoff.pos.z+1.2; setTimeout(r,700);},700);})""")
    c1 = pg.evaluate("() => window.__fly.game.debug.coins")
    rep["coins_earned"] = c1 - c0

    # BAZAR shop: give coins, teleport to BAZAR, open with E, buy scarf idx 1
    pg.evaluate("() => { window.__fly.game.debug.coins = 500; }")
    ba = pg.evaluate("() => { const a = window.__fly.world.addresses.find(a=>a.name==='BAZAR'); return a?{x:a.pos.x,z:a.pos.z}:null; }")
    rep["bazar_exists"] = ba is not None
    if ba:
        pg.evaluate(f"() => {{ const d = window.__fly.game.debug; d.P.pos.set({ba['x']}, 0.25, {ba['z']}); }}")
        pg.wait_for_timeout(500)
        pg.keyboard.press("KeyE"); pg.wait_for_timeout(400)
        rep["shop_opened"] = pg.evaluate("() => window.__fly.game.debug.shopOpen")
        pg.screenshot(path=os.path.join(OUT, "shop.png"))
        # click the 2nd scarf item
        try:
            pg.locator("#flyShop .it").nth(1).click(timeout=2000)
        except Exception as e:
            errs.append(f"click: {e}")
        pg.wait_for_timeout(300)
        rep["coins_after_buy"] = pg.evaluate("() => window.__fly.game.debug.coins")
        pg.keyboard.press("KeyE"); pg.wait_for_timeout(200)
        rep["shop_closed"] = pg.evaluate("() => !window.__fly.game.debug.shopOpen")

    # TRAM: snap to a tram every frame for ~1s then board, verify it carries us
    rep["tram_boarded"] = pg.evaluate("""() => new Promise(res => {
        const w = window.__fly.world, d = window.__fly.game.debug;
        const tram = w.traffic.find(c => c.userData.drive && c.userData.drive.hl > 4);
        if (!tram) return res(false);
        const iv = setInterval(() => { d.P.pos.set(tram.position.x, 0, tram.position.z + 1.4); }, 16);
        setTimeout(() => { clearInterval(iv); const ev = new KeyboardEvent('keydown', {code:'KeyE'});
            window.dispatchEvent(ev);
            setTimeout(() => { const x0 = d.P.pos.x; setTimeout(() => res(d.ridingTram && Math.abs(d.P.pos.x - x0) > 3), 800); }, 100);
        }, 400);
    })""")

    # RAIN
    pg.evaluate("() => window.__fly.game.debug.forceRain()")
    pg.wait_for_timeout(1200)
    rep["raining"] = pg.evaluate("() => window.__fly.game.debug.raining")
    pg.screenshot(path=os.path.join(OUT, "rain.png"))

    rep["errors"] = errs[:10]
    print(json.dumps(rep, indent=2))
    b.close()
