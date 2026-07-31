"""Transactional-email provider routing (Sprint 29): Gmail SMTP is the free,
domain-less path that reaches any recipient; Resend is a fallback. Nothing here
touches the network — smtplib.SMTP and the Resend sender are faked."""
import app as A


class _FakeSMTP:
    """Records the login + send, so a test can assert the message went out
    without opening a socket. Used as a context manager like the real one."""
    instances = []

    def __init__(self, host, port, timeout=0):
        self.host, self.port = host, port
        self.logged_in = None
        self.sent = None
        _FakeSMTP.instances.append(self)

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def ehlo(self):
        pass

    def starttls(self, context=None):
        pass

    def login(self, user, pw):
        self.logged_in = (user, pw)

    def send_message(self, msg):
        self.sent = msg


def _gmail(monkeypatch, user="coach@gmail.com", pw="app pass word here"):
    monkeypatch.setattr(A, "_GMAIL_USER", user.strip())
    monkeypatch.setattr(A, "_GMAIL_PW", pw.replace(" ", ""))
    monkeypatch.setattr(A, "_RESEND_KEY", "")
    _FakeSMTP.instances = []
    monkeypatch.setattr(A.smtplib, "SMTP", _FakeSMTP)


def test_gmail_configured_enables_mail(monkeypatch):
    _gmail(monkeypatch)
    assert A._mail_configured() is True
    assert A._gmail_configured() is True


def test_no_provider_means_not_configured(monkeypatch):
    monkeypatch.setattr(A, "_GMAIL_USER", "")
    monkeypatch.setattr(A, "_GMAIL_PW", "")
    monkeypatch.setattr(A, "_RESEND_KEY", "")
    assert A._mail_configured() is False
    assert A._send_email("x@y.com", "s", "<b>h</b>") is False


def test_send_routes_through_gmail(monkeypatch):
    _gmail(monkeypatch)
    ok = A._send_email("user@example.com", "Your Trainer code", "<b>123456</b>")
    assert ok is True
    assert len(_FakeSMTP.instances) == 1
    inst = _FakeSMTP.instances[0]
    assert inst.host == "smtp.gmail.com" and inst.port == 587
    # app-password spaces are stripped before login
    assert inst.logged_in == ("coach@gmail.com", "apppasswordhere")
    assert inst.sent is not None
    assert inst.sent["To"] == "user@example.com"
    assert "coach@gmail.com" in inst.sent["From"]        # From == authenticated account
    html_part = inst.sent.get_body(preferencelist=("html",))   # multipart: plain + html
    assert html_part is not None and "123456" in html_part.get_content()


def test_gmail_failure_falls_back_to_resend(monkeypatch):
    # Gmail configured but its send raises; a Resend key exists → fall through.
    _gmail(monkeypatch)
    monkeypatch.setattr(A, "_RESEND_KEY", "re_test_key")

    def boom(*a, **k):
        raise OSError("smtp down")
    monkeypatch.setattr(A.smtplib, "SMTP", boom)
    calls = {}
    monkeypatch.setattr(A, "_send_via_resend",
                        lambda to, s, h: (calls.update(to=to) or True))
    assert A._send_email("user@example.com", "s", "<b>h</b>") is True
    assert calls.get("to") == "user@example.com"          # fell back to Resend


def test_gmail_only_enforces_otp_signup(monkeypatch):
    """With Gmail as the only provider (no Resend, no domain), OTP is still
    mandatory: the direct-register path stays closed."""
    from test_accounts import MemStore
    monkeypatch.setattr(A, "STORE", MemStore())
    A._trainer_hits.clear()
    _gmail(monkeypatch)
    c = A.app.test_client()
    r = c.post("/api/auth/register", json={"email": "a@x.com", "password": "hunter2boat"})
    assert r.status_code == 400                           # direct signup blocked
    r2 = c.post("/api/auth/register/start", json={"email": "a@x.com", "password": "hunter2boat"})
    assert r2.status_code == 200 and r2.get_json()["otp"] is True
    assert _FakeSMTP.instances and "a@x.com" == _FakeSMTP.instances[0].sent["To"]
