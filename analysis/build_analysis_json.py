
"""
Build data/analysis.json — the single source of truth the dashboard + chatbot read.
Runs offline (needs pandas/sklearn); production only reads the JSON (no heavy deps).
"""
import json
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.linear_model import LinearRegression
from sklearn.dummy import DummyRegressor
from sklearn.model_selection import cross_val_predict, KFold
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.inspection import permutation_importance

RNG = 42
r2 = lambda x: round(float(x), 3)
r1 = lambda x: round(float(x), 1)
r2f = lambda x: round(float(x), 2)

df = pd.read_csv("data/supplement_impact_data.csv")
df["Strength_Gain"] = df["Strength_Gain"].str.rstrip("%").astype(float)
df["WT_Change"] = (df["Final_WT"] - df["Initial_WT"]).round(2)
df["WT_Change_Pct"] = (df["WT_Change"] / df["Initial_WT"] * 100).round(2)

# ── aggregates ───────────────────────────────────────────────────────────────
by_supp = []
for name, g in df.groupby("Supplement"):
    by_supp.append({
        "name": name, "n": int(len(g)),
        "mean": r2f(g.Strength_Gain.mean()), "std": r2f(g.Strength_Gain.std()),
        "min": r1(g.Strength_Gain.min()), "max": r1(g.Strength_Gain.max()),
        "cov": r1(g.Strength_Gain.std() / g.Strength_Gain.mean() * 100),
        "wt_mean": r2f(g.WT_Change.mean()), "wt_std": r2f(g.WT_Change.std()),
    })
by_supp.sort(key=lambda d: d["mean"], reverse=True)

by_gender = [{"name": n, "n": int(len(g)), "mean": r2f(g.Strength_Gain.mean())}
             for n, g in df.groupby("Gender")]
by_benefit = sorted(
    [{"name": n, "n": int(len(g)), "mean": r2f(g.Strength_Gain.mean())}
     for n, g in df.groupby("Primary_Benefit")],
    key=lambda d: d["mean"], reverse=True)

corr = df[["Age", "Weeks", "Initial_WT", "WT_Change", "Strength_Gain"]].corr()["Strength_Gain"]
correlations = {k: r2(v) for k, v in corr.drop("Strength_Gain").items()}

# ── modeling (profile inputs only — no post-cycle leakage) ───────────────────
num_feats, cat_feats = ["Age", "Weeks", "Initial_WT"], ["Gender", "Supplement"]
X, y = df[num_feats + cat_feats], df["Strength_Gain"]
pre = ColumnTransformer([("cat", OneHotEncoder(handle_unknown="ignore"), cat_feats)],
                        remainder="passthrough")
models = {
    "Baseline (mean)": DummyRegressor(strategy="mean"),
    "Linear Regression": LinearRegression(),
    "Random Forest": RandomForestRegressor(n_estimators=400, random_state=RNG, n_jobs=-1),
    "Gradient Boosting": GradientBoostingRegressor(random_state=RNG),
}
cv = KFold(n_splits=5, shuffle=True, random_state=RNG)
model_rows = []
for name, est in models.items():
    pipe = Pipeline([("pre", pre), ("model", est)])
    pred = cross_val_predict(pipe, X, y, cv=cv, n_jobs=-1)
    model_rows.append({"name": name, "mae": r2f(mean_absolute_error(y, pred)),
                       "r2": r2(r2_score(y, pred))})
best = min((m for m in model_rows if m["name"] != "Baseline (mean)"), key=lambda m: m["mae"])

best_pipe = Pipeline([("pre", pre), ("model", models[best["name"]])]).fit(X, y)
perm = permutation_importance(best_pipe, X, y, n_repeats=15, random_state=RNG, scoring="r2")
importance = sorted([{"feature": f, "value": r2(v)}
                     for f, v in zip(X.columns, perm.importances_mean)],
                    key=lambda d: d["value"], reverse=True)

# ── per-record data for interactive charts ───────────────────────────────────
records = df[["Age", "Gender", "Supplement", "Weeks", "Initial_WT", "Final_WT",
              "WT_Change", "Strength_Gain", "Primary_Benefit"]].to_dict("records")

# ── AI grounding digest (compact, tables included) ───────────────────────────
supp_tbl = "\n".join(
    f"  - {s['name']}: n={s['n']}, mean strength gain={s['mean']}%, std={s['std']}, "
    f"CoV={s['cov']}% (consistency), weight change={s['wt_mean']}kg" for s in by_supp)
model_tbl = "\n".join(f"  - {m['name']}: MAE={m['mae']}pp, R2={m['r2']}" for m in model_rows)
imp_tbl = "\n".join(f"  - {i['feature']}: {i['value']}" for i in importance)
ben_tbl = "\n".join(f"  - {b['name']}: n={b['n']}, mean strength={b['mean']}%" for b in by_benefit)

digest = f"""DATASET: Supplement Impact — {len(df)} synthetic participants on sports-nutrition regimens.
Columns: Age (18-65), Gender (Male/Female/Non-Binary), Supplement (Creatine Monohydrate / Mass Gainer / Both),
Weeks (4-24 cycle length), Initial_WT & Final_WT (kg), Strength_Gain (% increase), Primary_Benefit (self-report).
Derived: WT_Change = Final_WT - Initial_WT (kg). Data is clean: no missing values, no duplicate IDs,
every participant gained weight. Overall mean strength gain = {r1(df.Strength_Gain.mean())}% (range 5-30%).

STRENGTH GAIN BY SUPPLEMENT (CoV = coefficient of variation; lower = more consistent):
{supp_tbl}
Highest average: {by_supp[0]['name']}. Most consistent (lowest CoV): {min(by_supp, key=lambda s: s['cov'])['name']}.

WEIGHT vs STRENGTH SPLIT: Mass Gainer drives weight (~{[s for s in by_supp if s['name']=='Mass Gainer'][0]['wt_mean']}kg) but
little strength; Creatine drives strength with almost no weight change
(~{[s for s in by_supp if s['name']=='Creatine Monohydrate'][0]['wt_mean']}kg); 'Both' leads on both axes.

STRENGTH GAIN BY GENDER (flat — gender is randomly assigned noise):
{chr(10).join(f"  - {g['name']}: {g['mean']}%" for g in by_gender)}

CORRELATIONS with Strength_Gain (all near zero — demographics barely matter):
{chr(10).join(f"  - {k}: {v}" for k, v in correlations.items())}

STRENGTH GAIN BY PRIMARY_BENEFIT (all ~16%, so the self-reported benefit does NOT predict strength):
{ben_tbl}

PREDICTIVE MODEL (target = Strength_Gain %, predictors = Age, Weeks, Initial_WT, Gender, Supplement;
Final_WT and Primary_Benefit excluded as post-cycle leakage; 5-fold cross-validation):
{model_tbl}
Best model: {best['name']} (MAE {best['mae']} percentage points, R2 {best['r2']}).
Permutation importance (drop in R2 when a feature is shuffled):
{imp_tbl}
TAKEAWAY: Supplement choice is essentially the ONLY driver of strength gain; Age, Gender, Weeks and
starting weight add almost nothing. The R2 ceiling (~{best['r2']}) reflects that within-supplement spread
is mostly irreducible random noise in this synthetic data."""

out = {
    "meta": {"n": int(len(df)), "strength_mean": r1(df.Strength_Gain.mean()),
             "strength_min": r1(df.Strength_Gain.min()), "strength_max": r1(df.Strength_Gain.max()),
             "age_min": int(df.Age.min()), "age_max": int(df.Age.max()),
             "weeks_min": int(df.Weeks.min()), "weeks_max": int(df.Weeks.max())},
    "by_supplement": by_supp, "by_gender": by_gender, "by_benefit": by_benefit,
    "correlations": correlations,
    "model": {"rows": model_rows, "importance": importance, "best": best["name"]},
    "records": records, "digest": digest,
}
with open("data/analysis.json", "w") as f:
    json.dump(out, f)
print(f"Wrote data/analysis.json — {len(records)} records, best model {best['name']} "
      f"(MAE {best['mae']}, R2 {best['r2']})")
