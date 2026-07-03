"""Sprint 3 QA: job-offer flow, cap wardrobe, smoke, regression."""
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
    pg.evaluate("() => localStorage.clear()")   # fresh progression for deterministic test
    pg.keyboard.press("Space")
    pg.wait_for_timeout(600)

    rep = {}
    # deliver twice via teleport (onboarding jobs, no offer yet)
    def deliver_once():
        return pg.evaluate("""() => new Promise(res => {
            const d = window.__fly.game.debug;
            d.P.pos.x = d.pickup.pos.x + 1.2; d.P.pos.z = d.pickup.pos.z + 1.2;
            setTimeout(() => {
                d.P.pos.x = d.dropoff.pos.x + 1.2; d.P.pos.z = d.dropoff.pos.z + 1.2;
                setTimeout(() => res({score: d.score, offer: !!d.offer, total: d.totalDeliv}), 700);
            }, 700);
        })""")
    r1 = deliver_once(); r2 = deliver_once()
    rep["after_2_deliveries"] = r2
    # the 3rd task should be an OFFER (choice of two)
    rep["offer_shown"] = r2["offer"]
    pg.wait_for_timeout(400)
    pg.screenshot(path=os.path.join(OUT, "qa_offer.png"))
    # choose card 2 with the keyboard
    pg.keyboard.press("Digit2")
    pg.wait_for_timeout(400)
    rep["after_choice"] = pg.evaluate("""() => { const d = window.__fly.game.debug;
        return { offerGone: !d.offer, hasPickup: !!d.pickup, score: d.score }; }""")

    # wardrobe: totalDeliv >= 2 → still rank 0 (need 5); force rank-up by delivering 3 more
    for _ in range(3):
        pg.wait_for_timeout(200)
        r = deliver_once()
        if r["offer"]:
            pg.keyboard.press("Digit1"); pg.wait_for_timeout(300)
    rep["total_after_5"] = pg.evaluate("() => window.__fly.game.debug.totalDeliv")
    pg.wait_for_timeout(2800)  # let the rank-up + cap toasts fire
    rep["cap_after_rankup"] = pg.evaluate("() => window.__fly.game.debug.capSel")
    pg.screenshot(path=os.path.join(OUT, "qa_rankup.png"))
    # C cycles the cap
    pg.keyboard.press("KeyC"); pg.wait_for_timeout(200)
    rep["cap_after_cycle"] = pg.evaluate("() => window.__fly.game.debug.capSel")

    rep["errors"] = errs[:15]
    print(json.dumps(rep, indent=2))
    b.close()
