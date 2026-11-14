#!/usr/bin/env python3
"""Diagnostic of the S2 veto, using fit (2012-02..2017-12) and selection (2018-2019) data only.
Exploratory, not preregistered. AI-assisted code. Licensed under Apache-2.0.
Counts cover a rectangular screening area around the Philippines, not the national land boundary."""
import json, sys
from pathlib import Path
import numpy as np, pandas as pd
sys.path.insert(0, str(Path(__file__).parent))
import experiment as ex

fz = json.loads((ex.RES/'frozen_method.json').read_text())
P = fz['parameters']
fit = ex.load_pair('aqua','snpp','2012-02','2017-12')
sel = ex.load_pair('aqua','snpp','2018-01','2019-12')
assert sel.month.max() <= '2019-12'
mapping, *_ = ex.strata(fit)
out = {}
def preds(df):
    return {m: ex.predict(df, m, P[m], mapping) for m in 'abc'}
pr = preds(sel)
V = sel.Y.astype(float)
# 1. S2 baselines and decomposition
wape = lambda vh, v: float((vh - v).abs().sum() / v.sum())
out['S2_predict_zero'] = wape(V*0, V)
for m in 'abc': out[f'S2_{m}'] = wape(pr[m], V)
a0 = sel.X.eq(0)
out['share_of_V_in_cells_with_A0'] = float(V[a0].sum()/V.sum())
out['share_of_cell_months_with_A0'] = float(a0.mean())
for m in 'abc':
    out[f'S2_{m}_A>0_part'] = float((pr[m][~a0]-V[~a0]).abs().sum()/V.sum())
    out[f'over_minus_under_{m}'] = float((pr[m]-V).clip(lower=0).sum()/V.sum()), float((V-pr[m]).clip(lower=0).sum()/V.sum())
# symmetric cell-level measure
for m in 'abc':
    out[f'cell_median_abs_log_{m}'] = float(np.median(np.abs(np.log((pr[m]+1)/(V+1)))))
# 2. block scales: k x k cells (0.25 deg * k)
blocks = {}
for k in [1,2,4,8,16]:
    b = sel.assign(by=sel.iy//k, bx=sel.ix//k, **{f'p{m}':pr[m] for m in 'abc'})
    g = b.groupby(['by','bx','month'])[['X','Y','pa','pb','pc']].sum()
    g = g[(g.X+g.Y)>0]
    row = {'deg': k*0.25, 'n_block_months': int(len(g))}
    for m in 'abc':
        row[f'WAPE_{m}'] = round(float((g[f'p{m}']-g.Y).abs().sum()/g.Y.sum()),4)
        row[f'medlog_{m}'] = round(float(np.median(np.abs(np.log((g[f'p{m}']+1)/(g.Y+1))))),4)
    # share of block-months where b is closer than a
    row['b_closer_than_a'] = round(float(((g.pb-g.Y).abs() < (g.pa-g.Y).abs()).mean()),3)
    blocks[f'{k*0.25}deg'] = row
out['blocks'] = blocks
# 3. b vs c: by year and by region (S1)
def s1(df, vh):
    d = df.assign(Vh=vh); rm = d.groupby(['region','month'])[['X','Y','Vh']].sum(); rm = rm[(rm.X+rm.Y)>0]
    return float((rm.Vh-rm.Y).abs().sum()/rm.Y.sum())
yr = {}
for y in ['2018','2019']:
    m_ = sel.month.str.startswith(y); yr[y] = {m: round(s1(sel[m_], pr[m][m_]),4) for m in 'abc'}
out['S1_by_year'] = yr
reg = {}
for g in ex.REGIONS:
    m_ = sel.region.eq(g); reg[g] = {m: round(s1(sel[m_], pr[m][m_]),4) for m in 'abc'}
out['S1_by_region'] = reg
# stability of ratios across fit years (fit data only)
fit['year'] = fit.month.str[:4]; fit['lab'] = [mapping[(g,s)] for g,s in zip(fit.region, fit.season)]
ry = fit.groupby(['lab','year'])[['X','Y']].sum(); ry = (ry.Y/ry.X).unstack()
out['fit_ratio_by_stratum_year'] = ry.round(2).to_dict(orient='index')
ra = fit.groupby('year')[['X','Y']].sum(); out['fit_ratio_all_by_year'] = (ra.Y/ra.X).round(2).to_dict()
(ex.RES/'diagnostic_s2.json').write_text(json.dumps(out, indent=2))
print(json.dumps(out, indent=1))
