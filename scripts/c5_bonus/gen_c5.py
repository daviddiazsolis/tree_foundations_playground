"""Regenerates the c50py parts of data.es.json / data.en.json (bonus C5.0 tab) and prints the
numbers quoted in the page text. Run from this folder: python gen_c5.py"""
import io, json, sys, time, contextlib, warnings
warnings.filterwarnings("ignore")
import numpy as np, pandas as pd
import c50py
from c50py import C5Classifier
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import roc_auc_score
import data_sources as D

V = c50py.__version__
churn, FEATS, tr, te = D.churn, D.FEATS, D.tr, D.te
X_tr, X_te = tr[FEATS].values.astype(object), te[FEATS].values.astype(object)
y_tr, y_te = tr.churn.values, te.churn.values

def depth(n): return 0 if n.is_leaf else 1 + max(depth(n.children["left"]), depth(n.children["right"]))
def fit(**kw):
    t0 = time.time(); m = C5Classifier(categorical_features=["region", "plan"], **kw).fit(X_tr, y_tr, feature_names=FEATS); return m, time.time() - t0
def row(m, t): return dict(hojas=len(m.export_rules()), prof=depth(m.tree_), acc=round(m.score(X_te, y_te), 3),
                           auc=round(roc_auc_score(y_te, m.predict_proba(X_te)[:, 1]), 3), seg=round(t, 1))
m10, t10 = fit(min_samples_leaf=10); m25, t25 = fit(min_samples_leaf=25); m50, t50 = fit(min_samples_leaf=50, pruning=False)
mb, tb = fit(min_samples_leaf=25, trials=10)
r10, r25, r50 = row(m10, t10), row(m25, t25), row(m50, t50)
rb = dict(acc=round(mb.score(X_te, y_te), 3), auc=round(roc_auc_score(y_te, mb.predict_proba(X_te)[:, 1]), 3), seg=round(tb, 1))
buf = io.StringIO()
with contextlib.redirect_stdout(buf):
    m25.print_tree(feature_names=FEATS)
arbol = buf.getvalue().replace("np.int64(0)", "0").replace("np.int64(1)", "1")
reglas = m25.export_rules()

rng = np.random.default_rng(7); idx = rng.choice(len(te), 10, replace=False)
reg_cli = m25.predict_rule(X_te[idx], feature_names=FEATS); p_cli = m25.predict_proba(X_te[idx])[:, 1]

def count_region(n):
    if n.is_leaf: return 0
    return int(FEATS[n.feature_index] == "region") + count_region(n.children["left"]) + count_region(n.children["right"])

NAMES = {"es": {"region": "región", "plan": "plan", "antiguedad_meses": "antigüedad", "gasto_mensual": "gasto",
                "reclamos_12m": "reclamos", "datos_gb": "datos GB", "edad": "edad"},
         "en": {"region": "region", "plan": "plan", "antiguedad_meses": "tenure", "gasto_mensual": "spend",
                "reclamos_12m": "complaints", "datos_gb": "data GB", "edad": "age"}}
def num(x, lang, big):
    if big:
        s = f"{x:,.0f}"; return s.replace(",", ".") if lang == "es" else s
    s = f"{x:.1f}"; return s.replace(".", ",") if lang == "es" else s
def graph(n, lang):
    tot = sum(n.class_distribution.values()); p1 = n.class_distribution.get(1, 0) / tot if tot else 0
    if n.is_leaf: return {"hoja": int(n.predicted_class), "cnt": int(round(tot)), "p1": round(p1, 2)}
    f = FEATS[n.feature_index]; nm = NAMES[lang][f]
    if n.split_type == "numeric":
        lab, ei, ed = f"{nm} ≤ {num(n.threshold, lang, f == 'gasto_mensual')}", "≤", ">"
    else:
        cats = ", ".join(sorted(map(str, n.threshold)))
        lab, ei, ed = (f"{nm} en {{{cats}}}", "sí", "no") if lang == "es" else (f"{nm} in {{{cats}}}", "yes", "no")
    return {"lab": lab, "ei": ei, "ed": ed, "cnt": int(round(tot)), "p1": round(p1, 2),
            "izq": graph(n.children["left"], lang), "der": graph(n.children["right"], lang)}

for lang in ["es", "en"]:
    path = f"../../src/engine/data.{lang}.json"
    data = json.load(open(path)); ch = data["churn"]
    f = ch["filas"]
    lab = {"es": ("trials = 1, poda por defecto", "sin poda", "(orientado a ordenar por riesgo)"),
           "en": ("trials = 1, default pruning", "no pruning", "(aimed at ranking by risk)")}[lang]
    f[0].update(modelo=f"c50py {V}, {lab[0]}, min_samples_leaf = 10", **r10)
    f[2].update(modelo=f"c50py {V}, {lab[0]}, min_samples_leaf = 25", **r25)
    f[5].update(modelo=f"c50py {V}, {lab[1]}, min_samples_leaf = 50 {lab[2]}", **r50)
    ch["boost"][0].update(modelo=f"c50py {V}, trials = 10, min_samples_leaf = 25", **rb)
    ch["arbol_c5"] = arbol; ch["reglas_c5"] = reglas; ch["usa_region_c5"] = count_region(m25.tree_)
    for c, r, p in zip(ch["clientes"], reg_cli, p_cli):
        c["regla"] = r; c["p"] = round(float(p), 3)
    ch["arbol_c5_g"] = graph(m25.tree_, lang)
    json.dump(data, open(path, "w"), ensure_ascii=False, separators=(",", ":"))

print("churn:", r10, r25, r50, rb, "region splits", count_region(m25.tree_))
print("ids", [int(te.index[i]) for i in idx][:3], [c["id"] for c in json.load(open("../../src/engine/data.es.json"))["churn"]["clientes"]][:3])
for r in reglas: print("  ", r)

# ---- 219 firms (numbers quoted in the text)
Xtr, Xte = D.X_train.values.astype(float), D.X_test.values.astype(float)
ytr, yte = D.y_train.values, D.y_test.values
def c5(**kw): return C5Classifier(**kw).fit(Xtr, ytr, feature_names=D.RATIOS)
for kw in [dict(), dict(min_samples_leaf=1), dict(min_samples_leaf=1, global_pruning=False), dict(min_samples_leaf=1, global_pruning=False, cf=0.01),
           dict(min_samples_leaf=5, global_pruning=False), dict(min_samples_leaf=10, global_pruning=False), dict(pruning=False, min_samples_leaf=1)]:
    m = c5(**kw); print("firms", kw, len(m.export_rules()), round(m.score(Xtr, ytr), 3), round(m.score(Xte, yte), 3))
rng = np.random.default_rng(4)
Xm = Xtr.copy(); Xm[rng.random(Xm.shape) < 0.20] = np.nan
Xtm = Xte.copy(); Xtm[rng.random(Xtm.shape) < 0.20] = np.nan
med = np.nanmedian(Xm, axis=0); Xi, Xti = np.where(np.isnan(Xm), med, Xm), np.where(np.isnan(Xtm), med, Xtm)
comp = ~np.isnan(Xm).any(axis=1)
mf = C5Classifier(min_samples_leaf=1).fit(Xm, ytr)
print("missing: c5 frac", len(mf.export_rules()), round(mf.score(Xtm, yte), 3),
      " cart median", round(DecisionTreeClassifier(random_state=0).fit(Xi, ytr).score(Xti, yte), 3),
      " cart complete", round(DecisionTreeClassifier(random_state=0).fit(Xm[comp], ytr[comp]).score(Xti, yte), 3), int(comp.sum()),
      " c5 no gaps", round(C5Classifier(min_samples_leaf=1).fit(Xtr, ytr).score(Xte, yte), 3),
      " cart no gaps", round(DecisionTreeClassifier(random_state=0).fit(Xtr, ytr).score(Xte, yte), 3))
for t in [1, 3, 5, 10, 25]:
    b = c5(trials=t); print("boost", t, len(b.ensemble_) or 1, round(b.score(Xtr, ytr), 3), round(b.score(Xte, yte), 3), np.round(getattr(b, "estimator_errors_", []), 3))
m = c5(); print(*m.export_rules(), sep="\n"); m.print_tree()
cred = None
