"""Shared pytest setup: make the repo root importable so `import app` works
regardless of how pytest inserts rootdirs into sys.path."""
import os
import sys

import pytest

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)


@pytest.fixture(autouse=True)
def _hermetic_groq(monkeypatch):
    """Tests must never depend on (or spend) a real Groq key from the
    developer's environment. Groq-specific tests set the attribute themselves."""
    import app
    monkeypatch.setattr(app, "GROQ_API_KEY", "", raising=False)
