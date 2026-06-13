"""
Supplement Impact — EDA + Predictive Modeling
=============================================
1. Data cleaning  (Strength_Gain "28%" -> 28.0 float, derived features)
2. Exploratory analysis (consistency of strength gains by supplement, etc.)
3. Predictive model (Random Forest + Gradient Boosting) for Strength_Gain (%)
"""
import warnings
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

warnings.filterwarnings("ignore")
pd.set_option("display.width", 120)
RNG = 42

# ----------------------------------------------------------------------------
# 1. LOAD + CLEAN
# ----------------------------------------------------------------------------
df = pd.read_csv("data/supplement_impact_data.csv")

# Strength_Gain: strip '%' -> float
df["Strength_Gain"] = df["Strength_Gain"].str.rstrip("%").astype(float)

# Derived physical features
df["WT_Change"] = df["Final_WT"] - df["Initial_WT"]          # kg gained
df["WT_Change_Pct"] = df["WT_Change"] / df["Initial_WT"] * 100  # % bodyweight gained

print("=" * 70)
print("1. DATA QUALITY")
print("=" * 70)
print(f"Rows: {len(df)} | Cols: {df.shape[1]}")
print(f"Duplicate IDs: {df['ID'].duplicated().sum()} | Missing cells: {df.isna().sum().sum()}")
print(f"Strength_Gain range: {df.Strength_Gain.min():.0f}%–{df.Strength_Gain.max():.0f}%  "
      f"(mean {df.Strength_Gain.mean():.1f}%)")
neg = (df.WT_Change < 0).sum()
print(f"Negative weight change rows: {neg}  (everyone gained weight)" if neg == 0
      else f"Negative weight change rows: {neg}")

# ----------------------------------------------------------------------------
# 2. EXPLORATORY ANALYSIS
# ----------------------------------------------------------------------------
print("\n" + "=" * 70)
print("2. EDA — STRENGTH GAIN BY SUPPLEMENT")
print("=" * 70)

by_supp = (df.groupby("Supplement")["Strength_Gain"]
             .agg(n="count", mean="mean", std="std", min="min", max="max")
             .round(2))
# Coefficient of variation = consistency (lower = more consistent)
by_supp["CoV_%"] = (by_supp["std"] / by_supp["mean"] * 100).round(1)
by_supp = by_supp.sort_values("mean", ascending=False)
print(by_supp)
best_mean = by_supp.index[0]
best_consistent = by_supp["CoV_%"].idxmin()
print(f"\n-> Highest avg strength gain : {best_mean} ({by_supp.loc[best_mean,'mean']}%)")
print(f"-> Most CONSISTENT (lowest CoV): {best_consistent} ({by_supp.loc[best_consistent,'CoV_%']}% CoV)")

print("\n--- Weight change (kg) by supplement (validates dataset logic) ---")
print(df.groupby("Supplement")["WT_Change"].agg(mean="mean", std="std").round(2)
        .sort_values("mean", ascending=False))

print("\n--- Strength gain by Gender (should be ~flat: gender is random) ---")
print(df.groupby("Gender")["Strength_Gain"].mean().round(2))

print("\n--- Correlations with Strength_Gain ---")
num = ["Age", "Weeks", "Initial_WT", "Final_WT", "WT_Change", "WT_Change_Pct", "Strength_Gain"]
print(df[num].corr()["Strength_Gain"].round(3).sort_values(ascending=False))

print("\n--- Avg strength gain by Primary_Benefit ---")
print(df.groupby("Primary_Benefit")["Strength_Gain"].agg(n="count", mean="mean").round(2)
        .sort_values("mean", ascending=False))

# ----------------------------------------------------------------------------
# 3. PREDICTIVE MODELING — predict Strength_Gain (%)
# ----------------------------------------------------------------------------
print("\n" + "=" * 70)
print("3. PREDICTIVE MODELING (target = Strength_Gain %)")
print("=" * 70)

# Use only PRE-cycle / profile info as predictors (no leakage from Final_WT,
# which is a post-outcome measurement). Primary_Benefit is also a post-hoc
# self-report, so we keep the feature set to genuine inputs.
num_feats = ["Age", "Weeks", "Initial_WT"]
cat_feats = ["Gender", "Supplement"]
X = df[num_feats + cat_feats]
y = df["Strength_Gain"]

pre = ColumnTransformer([
    ("cat", OneHotEncoder(handle_unknown="ignore"), cat_feats),
], remainder="passthrough")

models = {
    "Baseline (mean)": DummyRegressor(strategy="mean"),
    "LinearRegression": LinearRegression(),
    "RandomForest": RandomForestRegressor(n_estimators=400, random_state=RNG, n_jobs=-1),
    "GradientBoosting": GradientBoostingRegressor(random_state=RNG),
}

cv = KFold(n_splits=5, shuffle=True, random_state=RNG)
print(f"\n{'Model':<20}{'MAE (pp)':>10}{'R²':>10}   (5-fold CV)")
print("-" * 52)
results = {}
for name, est in models.items():
    pipe = Pipeline([("pre", pre), ("model", est)])
    pred = cross_val_predict(pipe, X, y, cv=cv, n_jobs=-1)
    mae, r2 = mean_absolute_error(y, pred), r2_score(y, pred)
    results[name] = (mae, r2)
    print(f"{name:<20}{mae:>10.2f}{r2:>10.3f}")

# Fit best (by MAE, excluding baseline) on full data for feature importance
best_name = min((k for k in results if k != "Baseline (mean)"),
                key=lambda k: results[k][0])
print(f"\nBest model: {best_name} (MAE {results[best_name][0]:.2f} pp, "
      f"R² {results[best_name][1]:.3f})")

best_pipe = Pipeline([("pre", pre), ("model", models[best_name])]).fit(X, y)
perm = permutation_importance(best_pipe, X, y, n_repeats=15,
                              random_state=RNG, scoring="r2")
imp = (pd.Series(perm.importances_mean, index=X.columns)
         .sort_values(ascending=False).round(4))
print("\nPermutation importance (drop in R² when feature shuffled):")
print(imp.to_string())

print("\n" + "=" * 70)
print("INTERPRETATION")
print("=" * 70)
print(f"""\
- Supplement is by far the dominant driver of Strength_Gain; demographics
  (Age/Gender) and Weeks add little. This matches the dataset's stated logic:
  Creatine/Both optimise strength while Mass Gainer optimises weight.
- '{best_consistent}' delivers the most CONSISTENT strength spikes (lowest CoV),
  '{best_mean}' the highest average — independent of age/gender.
- A simple model gets a low MAE because strength is essentially a function of
  supplement class with small noise; R² is modest only because within-class
  spread is mostly random noise the features cannot explain.""")
