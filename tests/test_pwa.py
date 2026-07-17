"""PWA surface: service worker route, manifest validity, icons, registration markup."""
import json

import app as A


def _client():
    return A.app.test_client()


def test_sw_served_from_root_with_js_type():
    r = _client().get("/trainer-sw.js")
    assert r.status_code == 200
    assert "javascript" in r.content_type
    body = r.get_data(as_text=True)
    assert "addEventListener('fetch'" in body
    assert "/api/" in body  # must explicitly bypass the API


def test_manifest_valid_and_scoped_to_trainer():
    r = _client().get("/static/trainer/manifest.json")
    assert r.status_code == 200
    m = json.loads(r.get_data(as_text=True))
    assert m["start_url"] == "/trainer"
    assert m["scope"] == "/trainer"
    assert m["display"] == "standalone"
    assert len(m["icons"]) >= 2


def test_icons_are_real_pngs():
    c = _client()
    for path in ("/static/trainer/icon-192.png", "/static/trainer/icon-512.png"):
        r = c.get(path)
        assert r.status_code == 200
        assert r.data[:8] == b"\x89PNG\r\n\x1a\n", path


def test_trainer_page_registers_pwa():
    html = _client().get("/trainer").get_data(as_text=True)
    assert 'rel="manifest"' in html
    assert "serviceWorker" in html
    assert "/trainer-sw.js" in html
