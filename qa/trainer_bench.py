#!/usr/bin/env python3
"""Golden-intake eval bench for THE TRAINER (R&D LAB Sprint 15 spec).

Turns "one hand-eyeballed live plan" into a deterministic score across ~10 fixed
populations, so any change to the prompts, the model chain, or _validate_plan is
gated by a number, not a vibe.

Usage:
  python qa/trainer_bench.py                 # offline (default, $0, no key, CI-safe):
                                             #   scores the demo plan + any captured fixtures
  BENCH_LIVE=1 python qa/trainer_bench.py --server http://127.0.0.1:5057
                                             # live: POST each intake once to a running
                                             #   server, capture the plan to a fixture, score

Exits nonzero if any scored intake falls below its bar (all checks pass, unless a
per-intake meta.min_score tolerates a tracked soft failure).

Imports the SHIPPED gate (app._validate_plan / _plan_strings) so the bench and
production can never drift.
"""
import json
import os
import re
import ssl
import sys
import urllib.request

try:
    import certifi
    _SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except Exception:
    _SSL_CTX = None

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)
from app import _validate_plan, _plan_strings  # noqa: E402

BANDS = {"novice": (8, 12), "intermediate": (10, 16), "advanced": (14, 20)}
CORE_MUSCLES = {"chest", "back", "quads", "hamstrings", "delts"}
BANNED_PHRASES = ["eat healthy", "listen to your body", "stay consistent",
                  "train hard", "be consistent", "trust the process"]

# ── static movement→muscle map (grown, never guessed: an unmapped name warns) ──
# first pattern that matches the lowercased exercise name wins.
EXERCISE_MUSCLE = [
    (r"romanian deadlift|\brdl\b|leg curl", ["hamstrings"], []),
    (r"conventional deadlift|\bdeadlift\b|rack pull", ["hamstrings"], ["back", "glutes"]),
    (r"hip thrust|glute bridge", ["glutes"], ["hamstrings"]),
    (r"bulgarian|split squat|lunge|step[- ]?up", ["quads"], ["glutes"]),
    (r"back squat|front squat|hack squat|leg press|goblet|\bsquat\b|leg extension", ["quads"], ["glutes"]),
    (r"calf", ["calves"], []),
    (r"crunch|leg raise|plank|ab wheel|hanging|sit[- ]?up|rollout", ["abs"], []),
    (r"bench press|chest press|floor press|incline (dumbbell|barbell) press|dumbbell press|pec deck|cable fly|\bfly\b|push[- ]?up|\bdip\b", ["chest"], ["triceps", "delts"]),
    (r"overhead press|shoulder press|\bohp\b|military|arnold", ["delts"], ["triceps"]),
    (r"lateral raise|\blateral\b|rear delt|reverse fly|face pull|upright row", ["delts"], []),
    (r"pulldown|pull-?up|chin-?up|\brow\b|pullover", ["back"], ["biceps"]),
    (r"triceps|pressdown|pushdown|skull|kickback|close[- ]grip|overhead (cable|dumbbell) (triceps )?extension", ["triceps"], []),
    (r"curl", ["biceps"], []),
]


def muscles_for(name):
    # strip "(Superset with Lateral Raises)" etc. — the superset partner in a
    # parenthetical must not decide THIS exercise's muscle
    n = re.sub(r"\(.*?\)", " ", str(name)).lower()
    for pat, prim, sec in EXERCISE_MUSCLE:
        if re.search(pat, n):
            return prim, sec
    return None, None


def _all_exercises(plan):
    for d in (plan.get("workout_days") or []):
        for ex in (d.get("exercises") or []):
            yield ex


def _plan_text(plan):
    return " ".join(_plan_strings(plan)).lower()


# ─────────────────────────── core rubric checks ───────────────────────────

def check_structural(plan, entry):
    fails = _validate_plan(plan, entry.get("intake") or {})
    return ("structural", not fails, ", ".join(fails))


def check_volume_band(plan, entry):
    band = (entry.get("meta") or {}).get("band")
    if not band or band not in BANDS or not (plan.get("workout_days")):
        return None
    lo, hi = BANDS[band]
    tally = {}
    unmapped = []
    for ex in _all_exercises(plan):
        try:
            sets = float(ex.get("sets") or 0)
        except (TypeError, ValueError):
            sets = 0
        prim, sec = muscles_for(ex.get("name"))
        if prim is None:
            unmapped.append(ex.get("name"))
            continue
        for m in prim:
            tally[m] = tally.get(m, 0) + sets
        for m in sec:
            tally[m] = tally.get(m, 0) + sets * 0.5
    # the check is a deterministic sanity net: catch JUNK volume (well over band)
    # and genuinely NEGLECTED core movers (near zero), not "a few sets under
    # ideal" — equipment limits, low training days and strength goals all
    # legitimately lower a muscle's direct-set count.
    floor = max(3, lo - 4)
    problems = []
    for m, v in sorted(tally.items()):
        if v > hi + 6:
            problems.append(f"{m} {v:g} over band")
        elif m in CORE_MUSCLES and v < floor:
            problems.append(f"{m} {v:g} neglected (<{floor})")
    detail = ", ".join(f"{m} {v:g}" for m, v in sorted(tally.items()))
    if unmapped:
        detail += " | unmapped: " + ", ".join(sorted(set(map(str, unmapped))))
    return ("volume_band", not problems, "; ".join(problems) or detail)


def check_session_time(plan, entry):
    hours = (entry.get("meta") or {}).get("hours_per_session")
    if not hours or not (plan.get("workout_days")):
        return None
    slot = float(hours) * 60
    worst = []
    for d in plan["workout_days"]:
        declared = d.get("estimated_duration_minutes")
        if isinstance(declared, (int, float)) and declared > 0:
            # hold the model to its OWN stated duration — a firmer, less
            # false-positive-prone signal than a crude per-set estimate
            est, budget = float(declared), slot * 1.15
        else:
            comp = iso = 0
            for ex in (d.get("exercises") or []):
                try:
                    s = float(ex.get("sets") or 0)
                except (TypeError, ValueError):
                    s = 0
                rest = ex.get("rest_seconds") or 0
                if isinstance(rest, (int, float)) and rest >= 105:
                    comp += s
                else:
                    iso += s
            est, budget = 8 + 4.5 * comp + 2.5 * iso, slot * 1.20
        if est > budget:
            worst.append(f"{d.get('day_label', '?')} ~{est:.0f}m > {budget:.0f}m")
    return ("session_time", not worst, "; ".join(worst) or f"all days fit the {slot:.0f}m slot")


def _allergen_words(raw):
    stop = {"none", "nothing", "known", "food", "mild", "severe", "and", "any", "all", "nil", "free"}
    return [(w[:-1] if w.endswith("s") and len(w) > 3 else w)
            for w in re.split(r"[^a-z]+", str(raw).lower()) if len(w) >= 3 and w not in stop]


def _diet_food_text(plan):
    # diet strings EXCEPT the notes that legitimately name avoided allergens
    dp = plan.get("diet_plan") or {}
    food = {k: v for k, v in dp.items() if k not in ("allergy_note", "diet_preference_note")}
    return " ".join(_plan_strings(food)).lower()


def check_allergen_scan(plan, entry):
    alg = (entry.get("intake") or {}).get("allergies", "")
    words = _allergen_words(alg)
    if not words:
        return None
    hay = _diet_food_text(plan)
    hits = [w for w in words if re.search(r"\b" + re.escape(w) + r"s?\b", hay)]
    return ("allergen_scan", not hits, "found: " + ", ".join(hits) if hits else "clean")


def check_banned_phrase(plan, entry):
    # these phrases are banned OUTRIGHT (matches the prompt + _validate_plan);
    # markdown/newlines/emoji are never allowed inside strings either
    bad = []
    hay = " ".join(_plan_strings(plan)).lower()
    for ph in BANNED_PHRASES:
        if ph in hay:
            bad.append(f"'{ph}'")
    for s in _plan_strings(plan):
        if "\n" in s or "**" in s or "##" in s or "```" in s:
            bad.append("markdown/newline")
            break
    return ("banned_phrase", not bad, ", ".join(sorted(set(bad))) or "clean")


CORE_CHECKS = [check_structural, check_volume_band, check_session_time,
               check_allergen_scan, check_banned_phrase]


# ─────────────────────── population assertion registry ───────────────────────

def _wb(arg):
    # word-boundary the whole alternation so "run" can't match "cRUNch" and
    # "row" can't match "eyebROW"
    return r"\b(?:" + arg + r")\b"


def _a_no_exercise_matching(plan, entry, arg):
    pat = _wb(arg)
    for ex in _all_exercises(plan):
        for field in ("name", "substitution", "tempo_or_notes"):
            if re.search(pat, str(ex.get(field, "")), re.I):
                return False, f"matched '{ex.get('name')}' ({field})"
    return True, "none matched"


def _a_some_exercise_matching(plan, entry, arg):
    pat = _wb(arg)
    for ex in _all_exercises(plan):
        if re.search(pat, str(ex.get("name", "")), re.I):
            return True, f"matched '{ex.get('name')}'"
    return False, "no exercise matched"


def _a_equipment_denied(plan, entry, arg):
    pat = _wb(arg)
    for ex in _all_exercises(plan):
        if re.search(pat, str(ex.get("name", "")), re.I):
            return False, f"banned equipment: '{ex.get('name')}'"
    return True, "equipment respected"


def _diet(plan):
    return plan.get("diet_plan") or {}


def _num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _a_protein_on_goal_weight(plan, entry, arg):
    gw = (entry.get("meta") or {}).get("goal_weight_kg")
    p = _num(_diet(plan).get("protein_g"))
    if not gw or p is None:
        return False, "no protein_g / goal_weight"
    ratio = p / gw
    cur = _num(re.sub(r"[^0-9.]", "", str((entry.get("intake") or {}).get("weight", ""))) or 0)
    ok = 1.5 <= ratio <= 2.5 and (not cur or p <= cur * 2.4 + 5)
    return ok, f"protein {p:g}g = {ratio:.2f} g/goal-kg"


def _maintenance(plan):
    ps = plan.get("profile_summary") or {}
    return _num(ps.get("tdee_kcal")) or _num(ps.get("maintenance_kcal"))


def _a_no_calorie_deficit(plan, entry, arg):
    kcal = _num(_diet(plan).get("calorie_target_kcal"))
    maint = _maintenance(plan)
    if kcal is None:
        return False, "no calorie target"
    if maint is None:
        return kcal >= 1400, f"no maintenance in plan; target {kcal:g}"
    return kcal >= 0.98 * maint, f"target {kcal:g} vs maint {maint:g}"


def _a_calorie_floor(plan, entry, arg):
    kcal = _num(_diet(plan).get("calorie_target_kcal"))
    return (kcal is not None and kcal >= float(arg)), f"target {kcal}"


def _a_rir_no_failure(plan, entry, arg):
    # only the EFFORT prescriptions matter for a minor — the quality_vs_quantity
    # stance and safety prose legitimately discuss proximity to failure as a concept
    strings = []
    for ex in _all_exercises(plan):
        strings.append(str(ex.get("rpe_or_rir", "")))
        strings.append(str(ex.get("tempo_or_notes", "")))
    po = plan.get("progressive_overload") or {}
    strings.append(json.dumps(po.get("protocol", "")))
    for s in strings:
        if re.search(r"\brir\s*[01]\b|to failure|\bamrap\b|\b1rm\b|1 ?rep max", s, re.I):
            return False, f"failure-ish effort cue: '{s[:40]}'"
    return True, "no failure training in effort prescriptions"


def _a_string_present(plan, entry, arg):
    return (re.search(arg, _plan_text(plan), re.I) is not None), arg


def _a_no_string_in_diet(plan, entry, arg):
    hay = " ".join(_plan_strings(_diet(plan))).lower()
    m = re.search(arg, hay, re.I)
    return (m is None), (f"found '{m.group(0)}'" if m else "clean")


def _a_frequency_min(plan, entry, arg):
    n = int(arg)
    days = {}
    for i, d in enumerate(plan.get("workout_days") or []):
        for ex in (d.get("exercises") or []):
            prim, _ = muscles_for(ex.get("name"))
            for m in (prim or []):
                days.setdefault(m, set()).add(d.get("day_label") or i)
    low = [m for m in CORE_MUSCLES if len(days.get(m, ())) < n]
    return (not low), ("under-frequent: " + ", ".join(low) if low else f"all core >= {n}/wk")


def _a_starting_loads_present(plan, entry, arg):
    lifts = str((entry.get("intake") or {}).get("current lifts", "")).lower()
    roots = [w for w in ("bench", "squat", "deadlift", "press", "row") if w in lifts]
    if not roots:
        return True, "no current lifts provided"
    misses = []
    for root in roots:
        found = False
        for ex in _all_exercises(plan):
            if root in str(ex.get("name", "")).lower():
                if re.search(r"\d+(\.\d+)?\s*kg", str(ex.get("tempo_or_notes", "")), re.I):
                    found = True
                    break
        if not found:
            misses.append(root)
    return (not misses, "missing starting loads: " + ", ".join(misses) if misses else "loads present")


def _a_meals_anchored_to_wake(plan, entry, arg):
    diet = _diet(plan)
    strings = " ".join(_plan_strings(diet.get("meal_schedule") or diet))
    if re.search(r"\bwake|after waking|on rising|after rising|post[- ]shift|hours? after", strings, re.I):
        return True, "anchored to wake"
    return False, "meal timing uses clock time"


def _a_checkin_review_present(plan, entry, arg):
    if "checkin_review" not in plan:
        return False, "no checkin_review"
    keys = list(plan.keys())
    if "workout_days" in keys and keys.index("checkin_review") > keys.index("workout_days"):
        return False, "checkin_review not emitted first"
    return True, "present and first"


def _a_targets_unchanged_vs_prev(plan, entry, arg):
    prev = (entry.get("meta") or {}).get("prev_kcal")
    kcal = _num(_diet(plan).get("calorie_target_kcal"))
    if not prev or kcal is None:
        return False, "missing kcal"
    pct = abs(kcal - prev) / prev * 100
    return (pct <= float(arg)), f"moved {pct:.1f}% (<= {arg}%)"


def _a_allergen_scan_strict(plan, entry, arg):
    hay = _diet_food_text(plan)
    hits = [w for w in re.split(r"\|", arg) if re.search(r"\b" + w + r"s?\b", hay, re.I)]
    return (not hits), ("found: " + ", ".join(hits) if hits else "clean")


REGISTRY = {
    "no_exercise_matching": _a_no_exercise_matching,
    "some_exercise_matching": _a_some_exercise_matching,
    "equipment_denied": _a_equipment_denied,
    "protein_on_goal_weight": _a_protein_on_goal_weight,
    "no_calorie_deficit": _a_no_calorie_deficit,
    "calorie_floor": _a_calorie_floor,
    "rir_no_failure": _a_rir_no_failure,
    "string_present": _a_string_present,
    "no_string_in_diet": _a_no_string_in_diet,
    "frequency_min": _a_frequency_min,
    "starting_loads_present": _a_starting_loads_present,
    "meals_anchored_to_wake": _a_meals_anchored_to_wake,
    "checkin_review_present": _a_checkin_review_present,
    "targets_unchanged_vs_prev": _a_targets_unchanged_vs_prev,
    "allergen_scan_strict": _a_allergen_scan_strict,
}
# assertions that duplicate a core check are covered there; skip in the pop loop
CORE_ALIASES = {"structural", "volume_band", "session_time", "banned_phrase", "allergen_scan"}


def score_plan(plan, entry):
    checks = []
    for fn in CORE_CHECKS:
        r = fn(plan, entry)
        if r is not None:
            checks.append(r)
    for assertion in (entry.get("assertions") or []):
        name, _, arg = assertion.partition(":")
        if name in CORE_ALIASES:
            continue
        fn = REGISTRY.get(name)
        if not fn:
            checks.append((f"pop:{name}", False, "UNKNOWN ASSERTION"))
            continue
        ok, detail = fn(plan, entry, arg)
        checks.append((f"pop:{name}", bool(ok), detail))
    passed = sum(1 for _, ok, _ in checks if ok)
    return checks, passed


# ─────────────────────────── plan sourcing ───────────────────────────

def load_fixture(entry):
    path = entry.get("fixture")
    if path:
        fp = os.path.join(ROOT, path)
    else:
        fp = os.path.join(HERE, "bench_fixtures", entry["id"] + ".json")
    if os.path.exists(fp):
        with open(fp) as f:
            return json.load(f)
    return None


def _demo_digest():
    with open(os.path.join(ROOT, "data", "trainer_demo.json")) as f:
        demo = json.load(f)
    return {"weekly_split": demo.get("weekly_split"), "profile": demo.get("profile_summary"),
            "diet_targets": {k: (demo.get("diet_plan") or {}).get(k)
                             for k in ("calorie_target_kcal", "protein_g", "carbs_g", "fat_g")},
            "days": [{"day": d.get("day_label"),
                      "exercises": [f"{x.get('name')} — {x.get('sets')} x {x.get('rep_range')}"
                                    for x in (d.get("exercises") or [])]}
                     for d in (demo.get("workout_days") or [])]}


def fetch_live(entry, server):
    body = {"intake": entry["intake"]}
    if entry.get("mode") == "checkin":
        body["mode"] = "checkin"
        body["prev_plan"] = _demo_digest()
        body["log_digest"] = {"sessions": [
            {"date": "2026-07-01", "day": "Upper A", "best_sets": ["Barbell bench press: 60 kg x 8"]},
            {"date": "2026-07-10", "day": "Upper A", "best_sets": ["Barbell bench press: 60 kg x 8"]}],
            "stalls": [], "plan_age_days": 28}

    def post(payload):
        req = urllib.request.Request(server.rstrip("/") + "/api/trainer",
                                     data=json.dumps(payload).encode(),
                                     headers={"Content-Type": "application/json"}, method="POST")
        with urllib.request.urlopen(req, timeout=300, context=_SSL_CTX) as r:
            text = r.read().decode().strip()
        if text.startswith("ERROR") or "\nERROR:" in text:
            raise RuntimeError(text[:200])
        text = re.sub(r"^```(?:json)?\s*", "", text).rstrip("`").strip()
        return json.loads(text)

    data = post(body)
    if data.get("type") == "questions":
        qs = data.get("questions") or []
        ans = entry.get("default_answer") or "None of those apply — proceed with sensible defaults."
        body["followup_answers"] = [{"q": (q.get("question") if isinstance(q, dict) else str(q)),
                                     "a": ans} for q in qs]
        data = post(body)
    return data


# ─────────────────────────── runner ───────────────────────────

def main():
    server = only = None
    for i, a in enumerate(sys.argv):
        if a == "--server" and i + 1 < len(sys.argv):
            server = sys.argv[i + 1]
        if a == "--only" and i + 1 < len(sys.argv):
            only = set(sys.argv[i + 1].split(","))
    live = os.environ.get("BENCH_LIVE") == "1"
    if live and not server:
        server = "http://127.0.0.1:5057"

    with open(os.path.join(HERE, "bench_intakes.json")) as f:
        intakes = json.load(f)["intakes"]
    if only:
        intakes = [e for e in intakes if e["id"] in only]

    from datetime import datetime, timezone
    report = {"generated": datetime.now(timezone.utc).isoformat(),
              "mode": "live" if live else "offline", "intakes": []}
    total_checks = total_passed = intakes_pass = intakes_run = 0
    rows = []

    for entry in intakes:
        eid = entry["id"]
        plan = source = None
        if live:
            try:
                plan = fetch_live(entry, server)
                source = "live"
                fp = os.path.join(HERE, "bench_fixtures", eid + ".json")
                os.makedirs(os.path.dirname(fp), exist_ok=True)
                with open(fp, "w") as f:
                    json.dump(plan, f, indent=1)
            except Exception as exc:
                rows.append((eid, "ERR", f"live fetch failed: {str(exc)[:60]}"))
                report["intakes"].append({"id": eid, "error": str(exc)[:200]})
                continue
        else:
            plan = load_fixture(entry)
            source = "fixture"
            if plan is None:
                rows.append((eid, "—", "no fixture (offline skip)"))
                continue

        if not (isinstance(plan, dict) and plan.get("type") in (None, "plan")) and "workout_days" not in plan:
            rows.append((eid, "ERR", "not a plan"))
            report["intakes"].append({"id": eid, "error": "not a plan"})
            continue

        checks, passed = score_plan(plan, entry)
        n = len(checks)
        min_score = (entry.get("meta") or {}).get("min_score", n)
        ok = passed >= min_score
        intakes_run += 1
        intakes_pass += 1 if ok else 0
        total_checks += n
        total_passed += passed
        fails = [c[0] for c in checks if not c[1]]
        rows.append((eid, f"{passed}/{n}", ("✓" if ok else "✗ " + " ".join(fails))))
        report["intakes"].append({"id": eid, "plan_source": source, "score": passed, "max": n,
                                  "pass": ok, "checks": [{"name": c[0], "pass": c[1], "detail": c[2]}
                                                         for c in checks]})

    report["totals"] = {"intakes": intakes_run, "passed": intakes_pass,
                        "checks_run": total_checks, "checks_passed": total_passed}
    with open(os.path.join(HERE, "bench_report.json"), "w") as f:
        json.dump(report, f, indent=2)

    print(f"\nTRAINER EVAL BENCH — {report['mode']} mode")
    print("-" * 66)
    for eid, score, note in rows:
        print(f"  {eid:26} {score:>6}  {note}")
    print("-" * 66)
    t = report["totals"]
    print(f"  intakes {t['passed']}/{t['intakes']} clean · checks {t['checks_passed']}/{t['checks_run']} passed")
    print(f"  report → qa/bench_report.json\n")

    failed = [r for r in rows if r[2].startswith("✗") or r[1] == "ERR"]
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
