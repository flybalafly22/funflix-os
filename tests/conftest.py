"""Shared pytest setup: make the repo root importable so `import app` works
regardless of how pytest inserts rootdirs into sys.path."""
import os
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)
