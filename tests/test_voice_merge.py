"""The Voice merge: The Trainer is the front door, and the whole house wears one system.

Guards the promises the merge makes: the home page is the Voice landing; its five
answers ride to /trainer in this tab only (sessionStorage) and a real plan consumes
them; no third-party font requests; the landing's facts stay in step with the
engine's own rulebook; and the owner's hard copy rule (no em-dashes) holds on every
surface the merge touched.
"""
import gzip
import os
import re

import app as A

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _read(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return f.read()


def _client():
    return A.app.test_client()


def test_home_is_the_voice_landing():
    html = _client().get("/").get_data(as_text=True)
    assert 'id="act-session"' in html          # the five-question session
    assert 'id="barSvg"' in html               # the bar that loads a plate per answer
    assert 'id="sheet"' in html                # the rest of the house, one tap away
    for href in ("/trainer", "/study", "/calculator", "/journalist", "/meme", "/game",
                 "/play/the-fly", "/play/city-game"):
        assert f'href="{href}"' in html, href


def test_home_is_gzipped_like_every_page():
    r = _client().get("/", headers={"Accept-Encoding": "gzip"})
    assert r.headers.get("Content-Encoding") == "gzip"
    assert b"act-session" in gzip.decompress(r.data)


def test_handoff_is_tab_scoped_and_explicit():
    home = _read("templates/home.html")
    # written to sessionStorage (dies with the tab), never localStorage
    assert 'sessionStorage.setItem("trainerHandoff"' in home
    assert 'localStorage.setItem("trainerHandoff"' not in home
    trainer = _read("templates/trainer.html")
    assert "sessionStorage.getItem(HANDOFF_KEY)" in trainer
    assert "localStorage.getItem('trainerHandoff')" not in trainer
    # a real plan consumes it; a sample never does
    assert "if (!isDemo) { savePlan(data, mode === 'checkin' ? null : captureSafety()); clearHandoff(); }" in trainer
    # the shared-device escape hatch
    assert 'id="hoClear"' in trainer and "Not you? Start blank" in trainer


def test_handoff_maps_onto_real_intake_options():
    trainer = _read("templates/trainer.html")
    options = set(re.findall(r"<option(?: selected)?>([^<]+)</option>", trainer))
    options = {o.replace("&lt;", "<") for o in options}
    for mapped in ("Strength", "Muscle gain", "Fat loss", "General fitness",
                   "Beginner (<1 year)", "Intermediate (1–3 years)", "Advanced (3+ years)",
                   "Commercial gym", "Home: dumbbells", "Home: barbell setup", "Bodyweight only"):
        assert mapped in options, mapped


def test_fonts_are_self_hosted():
    c = _client()
    for name in ("bricolage", "geist", "geist-mono"):
        r = c.get(f"/static/fonts/{name}.woff2")
        assert r.status_code == 200
        assert r.data[:4] == b"wOF2", name
        assert "max-age=604800" in (r.headers.get("Cache-Control") or ""), name
    for rel in ("templates/home.html", "templates/trainer.html", "static/os.css"):
        assert "fonts.googleapis.com" not in _read(rel), rel


def test_landing_facts_match_the_engine_rulebook():
    home, engine = _read("templates/home.html"), _read("data/trainer_system.txt")
    # protein: Morton et al. 2018, 1.6 plateau / 2.2 upper bound
    assert "1.6 grams per kilo" in home and "2.2" in home
    assert "Protein 1.6 to 2.2 g per kg" in engine
    # splits: 4 days upper/lower, 2-3 full body, 5 upper/lower/push/pull/legs
    assert '"Upper / lower"' in home and "4 days: upper/lower x 2" in engine
    assert "5 days: upper/lower/push/pull/legs" in engine and '"Upper / lower + PPL"' in home
    # fat-loss training is hypertrophy-style with full rests (not 60 s circuits)
    assert "Rest about sixty seconds" not in home
    # creatine is the supplement with strong evidence; fat burners are excluded
    assert "creatine (3 to 5 g a day)" in home and "Creatine monohydrate: 3 to 5 g daily" in engine


def test_no_em_dashes_on_merged_surfaces():
    surfaces = ["templates/home.html", "templates/trainer.html", "templates/index.html",
                "templates/meme.html", "templates/journalist.html", "templates/lab.html",
                "static/os.css", "static/os.js", "static/trainer/sw.js",
                "static/trainer/manifest.json", "static/fonts/fonts.css"]
    for rel in surfaces:
        body = _read(rel)
        assert "\u2014" not in body and "&mdash;" not in body, rel


def test_translucent_chrome_is_gone():
    css = _read("static/os.css")
    hud = css[css.find(".hud {"):css.find("}", css.find(".hud {"))]
    assert "backdrop-filter" not in hud and "var(--paper)" in hud


def test_trainer_opts_into_the_theme_switch():
    html = _client().get("/trainer").get_data(as_text=True)
    assert "<html lang=\"en\" data-themeable>" in html
    assert "trainerTheme" in html                       # same preference key as home
    assert ":root[data-theme=\"dark\"]" in _read("static/os.css")
