import json, os
from playwright.sync_api import sync_playwright
BASE="http://127.0.0.1:5057"; OUT=os.path.dirname(os.path.abspath(__file__)); errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=angle","--ignore-gpu-blocklist","--enable-webgl"])
    pg=b.new_page(viewport={"width":1280,"height":720})
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append(m.text) if m.type=="error" else None)
    pg.goto(BASE+"/play/the-fly", wait_until="domcontentloaded", timeout=45000)
    pg.wait_for_selector("canvas", timeout=20000); pg.wait_for_timeout(3500)
    pg.evaluate("() => localStorage.clear()"); pg.keyboard.press("Space"); pg.wait_for_timeout(500)
    rep={}
    # grab a pickup, force a race, verify rival appears & advances toward dropoff
    r = pg.evaluate("""() => new Promise(res => { const d=window.__fly.game.debug;
        d.P.pos.x=d.pickup.pos.x+1.2; d.P.pos.z=d.pickup.pos.z+1.2;
        setTimeout(()=>{ d.forceRace();
            const s=d.rivalPos.clone ? d.rivalPos.clone() : {x:d.rivalPos.x,z:d.rivalPos.z};
            const dp=d.dropoff.pos; const d0=Math.hypot(s.x-dp.x, s.z-dp.z);
            setTimeout(()=>{ const d1=Math.hypot(d.rivalPos.x-dp.x, d.rivalPos.z-dp.z);
                res({racing:d.racing, approached: d1 < d0 - 3});}, 1500);
        },600);})""")
    rep["race"]=r
    pg.screenshot(path=os.path.join(OUT,"race.png"))
    # player beats him: teleport to dropoff -> coins jump, race ends
    w = pg.evaluate("""() => new Promise(res=>{ const d=window.__fly.game.debug; const c0=d.coins;
        d.P.pos.x=d.dropoff.pos.x+1.2; d.P.pos.z=d.dropoff.pos.z+1.2;
        setTimeout(()=>res({coinDelta:d.coins-c0, raceOver:!d.racing}),700);})""")
    rep["win"]=w
    rep["errors"]=errs[:8]
    print(json.dumps(rep,indent=2)); b.close()
