#!/usr/bin/env python3
"""Post-freeze analyses (preregistration §4 drift check, §4 outage-screen sensitivity, §5 bridge).
Uses the method frozen in analysis/results/frozen_method.json; changes nothing in it.
Counts cover a rectangular screening area around the Philippines, not the national land boundary.
AI-assisted code. Licensed under Apache-2.0."""
import json, sys
from pathlib import Path
import numpy as np, pandas as pd
sys.path.insert(0, str(Path(__file__).parent))
import experiment as ex

RES, PROC = ex.RES, ex.PROC
fz = json.loads((RES/'frozen_method.json').read_text())
ft = json.loads((RES/'final_test.json').read_text())
MAP = {tuple(k.split('|')): v for k, v in fz['strata_mapping'].items()}
M, PAR = fz['selected_method'], fz['selected_parameters']
META = ex.META

def s1_bias(df, vh):
    d = df.assign(Vh=vh); rm = d.groupby(['region','month'])[['X','Y','Vh']].sum(); rm = rm[(rm.X+rm.Y)>0]
    return float((rm.Vh-rm.Y).abs().sum()/rm.Y.sum()), float(rm.Vh.sum()/rm.Y.sum()), int(len(rm))

# ---------- outage screen (raw rows, any type/confidence/daynight) ----------
def raw_days(stem):
    d = pd.read_parquet(PROC/f'{stem}.parquet', columns=['acq_date','data_status'])
    return set(pd.to_datetime(d.loc[d.data_status.eq('archive'),'acq_date']).dt.normalize())
RAW = {'aqua': raw_days('aqua_modis'), 'snpp': raw_days('snpp_viirs'), 'noaa20': raw_days('noaa20_viirs')}
def screened_months(x, y, lo, hi):
    days = pd.date_range(pd.Period(lo).start_time, pd.Period(hi).end_time.normalize())
    bad = set()
    for s, o in [(x, y), (y, x)]:
        has = np.array([d in RAW[s] for d in days]); oth = np.array([d in RAW[o] for d in days])
        i = 0
        while i < len(days):
            if not has[i]:
                j = i
                while j < len(days) and not has[j]: j += 1
                if j - i >= 5 and oth[i:j].sum() >= 3:
                    bad |= {str(d.to_period('M')) for d in days[i:j]}
                i = j
            else:
                i += 1
    return sorted(bad)

out = {'aoi_notice': ex.NOTICE, 'method': M}
# ---------- drift check ----------
a_hi = min(META['aqua']['archive_last_full_month'], META['snpp']['archive_last_full_month'])
drift = ex.load_pair('aqua', 'snpp', '2021-07', a_hi)
vh = ex.predict(drift, M, PAR, MAP)
per_year = {}
for y in sorted(drift.month.str[:4].unique()):
    m = drift.month.str.startswith(y)
    s1, b, n = s1_bias(drift[m], vh[m])
    per_year[y] = {'S1': round(s1,4), 'bias': round(b,4), 'n_region_months': n,
                   'months': f"{drift[m].month.min()}–{drift[m].month.max()}"}
out['drift_check'] = {'period': ['2021-07', a_hi], 'per_year': per_year,
                      'note': 'Descriptive only. Aqua orbit drift, S-NPP ageing and real change are confounded.'}

# ---------- bridge ----------
n_lo = META['noaa20']['archive_first_full_month']
b_hi = min(META['snpp']['archive_last_full_month'], META['noaa20']['archive_last_full_month'])
bf = ex.load_pair('noaa20', 'snpp', n_lo, '2021-12')   # X = NOAA-20 (N), Y = S-NPP (V)
bt = ex.load_pair('noaa20', 'snpp', '2022-01', b_hi)
rho_raw = float(bf.Y.sum()/bf.X.sum())
rho = 1.0 if abs(np.log(rho_raw)) < np.log(1.05) else rho_raw
def bridge_eval(test, months_drop=()):
    t = test[~test.month.isin(months_drop)]
    sh = t.X*rho
    bias = float(sh.sum()/t.Y.sum())
    rm = t.assign(Sh=sh).groupby(['region','month'])[['X','Y','Sh']].sum(); rm = rm[(rm.X+rm.Y)>0]
    s1 = float((rm.Sh-rm.Y).abs().sum()/rm.Y.sum()); s2 = float((sh-t.Y).abs().sum()/t.Y.sum())
    years = {}
    for y in sorted(t.month.str[:4].unique()):
        g = t[t.month.str.startswith(y)]; V, N = int(g.Y.sum()), int(g.X.sum()); S = N*rho
        q = V >= 800 and N >= 800; r = V/S if S else float('nan')
        years[y] = {'sum_V_snpp': V, 'sum_N_noaa20': N, 'V_over_Shat': round(r,4), 'V_over_N': round(V/N,4) if N else None,
                    'months': f"{g.month.min()}–{g.month.max()}",
                    'status': ('pass' if 0.90 <= r <= 1.10 else 'fail') if q else 'insufficient sample for the annual pass/fail criterion'}
    crit1 = abs(bias-1) <= 0.05
    qual = [v for v in years.values() if v['status'] != 'insufficient sample for the annual pass/fail criterion']
    if not qual:
        label = 'not validated (annual stability untestable: insufficient sample)'; passed = False
    else:
        crit2 = all(v['status']=='pass' for v in qual); passed = crit1 and crit2
        label = 'validated' if passed else 'not validated'
    return {'bias_sum_Shat_over_V': round(bias,4), 'criterion_i_bias_within_5pct': crit1, 'S1': round(s1,4), 'S2': round(s2,4),
            'per_year': years, 'passed': passed, 'label': label}
out['bridge'] = {'fit': [n_lo, '2021-12'], 'test': ['2022-01', b_hi], 'rho_fitted': round(rho_raw,4), 'rho_used': rho,
                 'primary': bridge_eval(bt)}

# ---------- outage-screen sensitivity ----------
sens = {}
drop_ft = screened_months('aqua','snpp','2020-01','2021-06')
test = ex.load_pair('aqua','snpp','2020-01','2021-06'); keep = ~test.month.isin(drop_ft)
s1f,_,_ = s1_bias(test[keep], ex.predict(test[keep], M, PAR, MAP)); s1a,_,_ = s1_bias(test[keep], test[keep].X.astype(float))
sens['final_test'] = {'months_dropped': drop_ft, 'S1_frozen': round(s1f,4), 'S1_a': round(s1a,4)}
drop_dr = screened_months('aqua','snpp','2021-07',a_hi); kd = ~drift.month.isin(drop_dr)
s1d,bd,_ = s1_bias(drift[kd], vh[kd]); sens['drift_check'] = {'months_dropped': drop_dr, 'S1_all_years': round(s1d,4), 'bias': round(bd,4)}
drop_br = screened_months('noaa20','snpp','2022-01',b_hi)
br_s = bridge_eval(bt, drop_br); sens['bridge'] = {'months_dropped': drop_br, 'passed': br_s['passed'], 'bias': br_s['bias_sum_Shat_over_V']}
out['sensitivity_outage_screen'] = {'label': 'sensitivity: outage screen', 'note': 'Can only remove months where sensors disagree, so it can only favour agreement. Not primary.', **sens}
(RES/'postfreeze.json').write_text(json.dumps(out, indent=2))
print(json.dumps(out, indent=1))
