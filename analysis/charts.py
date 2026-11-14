#!/usr/bin/env python3
"""Charts and the real-example table for analysis/RESULTS_SUMMARY.md. Uses the frozen method only.
Counts cover a rectangular screening area around the Philippines, not the national land boundary.
AI-assisted code. Licensed under Apache-2.0."""
import json, sys
from pathlib import Path
import numpy as np, pandas as pd
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
sys.path.insert(0, str(Path(__file__).parent))
import experiment as ex
RES, PROC = ex.RES, ex.PROC
fz = json.loads((RES/'frozen_method.json').read_text())
MAP = {tuple(k.split('|')): v for k, v in fz['strata_mapping'].items()}
M, PAR, Q = fz['selected_method'], fz['selected_parameters'], fz['interval_quantiles']['aoi_month']
SNPP, HARM, N20, RAW = '#2a78d6', '#eb6834', '#1baf7a', '#898781'
INK, INK2, GRID, AXIS, SURF = '#0b0b0b', '#52514e', '#e1e0d9', '#c3c2b7', '#fcfcfb'
plt.rcParams.update({'font.size': 10, 'axes.edgecolor': AXIS, 'axes.labelcolor': INK2, 'xtick.color': INK2, 'ytick.color': INK2,
                     'axes.spines.top': False, 'axes.spines.right': False, 'axes.grid': True, 'grid.color': GRID, 'grid.linewidth': 0.6,
                     'figure.facecolor': SURF, 'axes.facecolor': SURF, 'lines.linewidth': 2})
FOOT = 'Daytime grid-cell-days (0.25°), NASA FIRMS. ' + ex.NOTICE

def daycm(key):
    cm = pd.read_parquet(PROC/f'cellmonth_{key}.parquet'); return cm[cm.daynight.eq('D')]

aq = daycm('aqua'); aq['season'] = aq.month.map(ex.season)
lab = pd.Series([MAP[(g, s)] for g, s in zip(aq.region, aq.season)], index=aq.index)
aq['harm'] = aq.n_verified * lab.map(PAR['r_strata'])
A = aq.groupby('month')[['n_verified', 'harm']].sum()
V = daycm('snpp').groupby('month').n_verified.sum()
N = daycm('noaa20').groupby('month').n_verified.sum()
mt = ex.META
a_lo, a_hi = mt['aqua']['archive_first_full_month'], mt['aqua']['archive_last_full_month']
v_lo, v_hi = mt['snpp']['archive_first_full_month'], mt['snpp']['archive_last_full_month']

# --- Real example: stitched record across the Aqua -> S-NPP switch (annual, full months only)
allm = ex.months(a_lo, v_hi)
raw = pd.Series({m: (A.n_verified.get(m, 0) if m < v_lo else V.get(m, 0)) for m in allm})
har = pd.Series({m: (A.harm.get(m, 0) if m < v_lo else V.get(m, 0)) for m in allm})
yr = lambda s: s.groupby(s.index.str[:4]).sum()
ry, hy = yr(raw), yr(har)
full_years = [y for y in ry.index if all(f'{y}-{mm:02d}' in allm for mm in range(1, 13))]
ex_tab = pd.DataFrame({'raw_stitched': ry[full_years], 'harmonized_stitched': hy[full_years].round(0)})
ex_tab.to_csv(RES/'example_stitched_annual.csv')
pre = [y for y in full_years if '2003' <= y <= '2011']; post = [y for y in full_years if '2013' <= y <= '2021']
summ = {'raw_mean_2003_2011': float(ry[pre].mean()), 'harm_mean_2003_2011': float(hy[pre].mean()),
        'snpp_mean_2013_2021': float(ry[post].mean()),
        'raw_step_ratio_post_over_pre': float(ry[post].mean()/ry[pre].mean()),
        'harm_step_ratio_post_over_pre': float(ry[post].mean()/hy[pre].mean()),
        'aqua_raw_mean_2003_2011': float(A.n_verified[[m for m in A.index if '2003' <= m[:4] <= '2011']].sum()/9),
        'aqua_raw_mean_2013_2021': float(A.n_verified[[m for m in A.index if '2013' <= m[:4] <= '2021']].sum()/9),
        'note': '2012 omitted (switch year). Annual sums of daytime cell-days, whole AOI; harmonized pre-2012 values are estimated VIIRS-equivalent.'}
(RES/'example_stitched_summary.json').write_text(json.dumps(summ, indent=2))

# Chart 1: annual stitched record, raw vs harmonized
fig, ax = plt.subplots(figsize=(10, 4.6))
x = np.array([int(y) for y in full_years])
ax.plot(x, ry[full_years].values, color=RAW, marker='o', ms=4, label='Raw: Aqua MODIS to 2011, then S-NPP VIIRS')
ax.plot(x, hy[full_years].values, color=HARM, marker='o', ms=4, label='ARGALLAX: Aqua as estimated VIIRS-equivalent, then S-NPP')
ax.axvspan(x.min()-0.5, 2011.5, color='#f3f2ee', zorder=0); ax.text(2002.8, 1200, 'Aqua MODIS era', color=INK2)
ax.text(2012.2, 1200, 'S-NPP VIIRS era', color=INK2)
ax.set_title('Did the burning change, or did the satellite change?', loc='left', color=INK, fontweight='bold')
ax.set_ylabel('Daytime grid-cell-days per year'); ax.set_ylim(0, 25000); ax.legend(frameon=False, loc='upper right')
fig.text(0.01, 0.01, FOOT, fontsize=7.5, color=INK2); fig.tight_layout(rect=(0, 0.04, 1, 1)); fig.savefig(RES/'chart_stitched_record.png', dpi=160); plt.close(fig)

# Chart 2: final test months, whole AOI, with interval
tm = ex.months('2020-01', '2021-06')
vh = A.harm.reindex(tm, fill_value=0); obs = V.reindex(tm, fill_value=0); rawa = A.n_verified.reindex(tm, fill_value=0)
lo = np.maximum((vh+1)*np.exp(Q['q10'])-1, 0); hi = np.maximum((vh+1)*np.exp(Q['q90'])-1, 0)
fig, ax = plt.subplots(figsize=(10, 4.6)); xs = pd.to_datetime(tm)
ax.fill_between(xs, lo, hi, color=HARM, alpha=0.18, lw=0, label='Interval (72% of test months inside)')
ax.plot(xs, obs, color=SNPP, label='S-NPP VIIRS (reference)')
ax.plot(xs, vh, color=HARM, label='Aqua harmonized, method (c)')
ax.plot(xs, rawa, color=RAW, label='Aqua raw')
ax.set_title('Final test: months not used for fitting or method selection (Jan 2020 – Jun 2021)', loc='left', color=INK, fontweight='bold')
ax.set_ylabel('Daytime grid-cell-days per month'); ax.legend(frameon=False); ax.set_ylim(bottom=0)
fig.text(0.01, 0.01, FOOT, fontsize=7.5, color=INK2); fig.tight_layout(rect=(0, 0.04, 1, 1)); fig.savefig(RES/'chart_final_test.png', dpi=160); plt.close(fig)

# Chart 3: bridge, S-NPP vs NOAA-20 monthly
bm = ex.months(mt['noaa20']['archive_first_full_month'], min(v_hi, mt['noaa20']['archive_last_full_month']))
fig, ax = plt.subplots(figsize=(10, 4.6)); xs = pd.to_datetime(bm)
ax.axvspan(pd.Timestamp('2022-01-01'), xs.max(), color='#f3f2ee', zorder=0); ax.text(pd.Timestamp('2022-02-01'), 4150, 'bridge test period', color=INK2, va='bottom')
ax.plot(xs, V.reindex(bm, fill_value=0), color=SNPP, label='S-NPP VIIRS')
ax.plot(xs, N.reindex(bm, fill_value=0), color=N20, lw=1.5, ls='--', label='NOAA-20 VIIRS')
ax.set_ylim(0, 4500); ax.set_title('S-NPP → NOAA-20 bridge: the record continues after S-NPP', loc='left', color=INK, fontweight='bold', pad=14)
ax.set_ylabel('Daytime grid-cell-days per month'); ax.legend(frameon=False); ax.set_ylim(bottom=0)
fig.text(0.01, 0.01, FOOT, fontsize=7.5, color=INK2); fig.tight_layout(rect=(0, 0.04, 1, 1)); fig.savefig(RES/'chart_bridge.png', dpi=160); plt.close(fig)
print(json.dumps(summ, indent=1)); print(ex_tab.to_string())
