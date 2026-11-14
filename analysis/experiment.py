#!/usr/bin/env python3
"""ARGALLAX harmonization experiment, implementing analysis/PREREGISTRATION.md.

Stages (run in order, each committed before the next):
  select  -- sample-size check, fit (a)-(c) on fit period, score on 2018-2019, apply selection rule,
             build interval quantiles, write analysis/results/frozen_method.json. Reads NO data after 2019-12.
  test    -- final test Jan 2020-Jun 2021, run once on the frozen method (refuses if frozen file is uncommitted).
Counts cover a rectangular screening area around the Philippines, not the national land boundary.
AI-assisted code (Claude Opus 5.5). Licensed under Apache-2.0.
"""
import argparse, json, subprocess
from pathlib import Path
import numpy as np
import pandas as pd
from scipy.stats import spearmanr

ROOT = Path(__file__).resolve().parents[1]
PROC, RES = ROOT / 'data/processed', ROOT / 'analysis/results'
NOTICE = 'Counts cover a rectangular screening area around the Philippines, not the national land boundary.'
REGIONS = ['North Luzon', 'South Luzon', 'Visayas', 'Mindanao']
NEIGHBOUR = {'North Luzon': 'South Luzon', 'South Luzon': 'North Luzon', 'Visayas': 'Mindanao', 'Mindanao': 'Visayas'}
DRY = {2, 3, 4, 5}
THRESH = 200
META = json.loads((PROC / 'grid_meta.json').read_text())


def season(month_str):
    m = int(month_str[5:7])
    return 'dry' if m in DRY else 'rest'


def months(lo, hi):
    return [str(p) for p in pd.period_range(lo, hi, freq='M')]


def load_pair(sensor_x, sensor_y, lo, hi):
    """Daytime, archive-verified cell-months for two sensors, restricted to [lo, hi] at load time."""
    keep = set(months(lo, hi))
    out = []
    for key, col in [(sensor_x, 'X'), (sensor_y, 'Y')]:
        cm = pd.read_parquet(PROC / f'cellmonth_{key}.parquet')
        cm = cm[cm.daynight.eq('D') & cm.month.isin(keep)]
        out.append(cm[['iy', 'ix', 'region', 'month', 'n_verified']].rename(columns={'n_verified': col}))
    df = out[0].merge(out[1], on=['iy', 'ix', 'region', 'month'], how='outer').fillna({'X': 0, 'Y': 0})
    df[['X', 'Y']] = df[['X', 'Y']].astype(int)
    assert df.month.min() >= lo and df.month.max() <= hi
    df['season'] = df.month.map(season)
    return df[(df.X + df.Y) > 0].reset_index(drop=True)


def full_both(a, b):
    lo = max(META[a]['archive_first_full_month'], META[b]['archive_first_full_month'])
    hi = min(META[a]['archive_last_full_month'], META[b]['archive_last_full_month'])
    return lo, hi


def strata(fit):
    """Region x season strata with the preregistered merge order. Returns mapping (region, season) -> stratum label."""
    def ok(mask):
        return fit.loc[mask, 'X'].sum() >= THRESH and fit.loc[mask, 'Y'].sum() >= THRESH
    log, mapping = [], {}
    region_level = []
    for g in REGIONS:
        both = all(ok(fit.region.eq(g) & fit.season.eq(s)) for s in ('dry', 'rest'))
        if both:
            for s in ('dry', 'rest'):
                mapping[(g, s)] = f'{g}|{s}'
        else:
            log.append(f'{g}: a season stratum below {THRESH}; seasons merged (step 1)')
            region_level.append(g)
    for g in region_level:
        if (g, 'dry') in mapping:
            continue
        if ok(fit.region.eq(g)):
            for s in ('dry', 'rest'):
                mapping[(g, s)] = f'{g}|all'
        else:
            n = NEIGHBOUR[g]
            log.append(f'{g}: region below {THRESH} after season merge; merged with {n} (step 2)')
            label = '+'.join(sorted([g, n])) + '|all'
            for r in (g, n):
                for s in ('dry', 'rest'):
                    mapping[(r, s)] = label
    regions_surviving = {lab.split('|')[0] for lab in mapping.values()}
    counts = {f'{g}|{s}': {'aqua': int(fit.loc[fit.region.eq(g) & fit.season.eq(s), 'X'].sum()),
                           'snpp': int(fit.loc[fit.region.eq(g) & fit.season.eq(s), 'Y'].sum())}
              for g in REGIONS for s in ('dry', 'rest')}
    return mapping, log, len(regions_surviving) >= 2, counts


def predict(df, method, params, mapping):
    if method == 'a':
        return df.X.astype(float)
    if method == 'b':
        return df.X * params['r']
    if method == 'c':
        lab = [mapping[(g, s)] for g, s in zip(df.region, df.season)]
        return df.X * pd.Series(lab, index=df.index).map(params['r_strata'])
    raise ValueError(method)


def score(df, vhat, all_months):
    d = df.assign(V=df.Y, Vh=vhat)
    rm = d.groupby(['region', 'month'])[['X', 'V', 'Vh']].sum().reset_index()
    rm = rm[(rm.X + rm.V) > 0]
    rm['Vh'] = rm.Vh.round(9)  # remove float-sum noise so equal totals tie exactly in S3
    s1 = float((rm.Vh - rm.V).abs().sum() / rm.V.sum())
    s2 = float((d.Vh - d.V).abs().sum() / d.V.sum())
    rhos = []
    for g in REGIONS:
        full = rm[rm.region.eq(g)].set_index('month').reindex(all_months, fill_value=0)
        rhos.append(spearmanr(full.Vh, full.V).statistic)
    return {'S1_region_month_WAPE': s1, 'S2_cell_month_WAPE': s2, 'S3_median_spearman': float(np.median(rhos)),
            'S3_by_region': dict(zip(REGIONS, map(float, rhos))),
            'bias_sum_Vhat_over_V': float(rm.Vh.sum() / rm.V.sum()),
            'median_abs_log_ratio': float(np.median(np.abs(np.log((rm.Vh + 1) / (rm.V + 1))))),
            'n_region_months': int(len(rm)), 'n_cell_months': int(len(d))}


def beats(new, cur, s2_veto):
    ok = (new['S1_region_month_WAPE'] <= 0.9 * cur['S1_region_month_WAPE']
          and new['S3_median_spearman'] >= cur['S3_median_spearman'] - 0.05)
    if s2_veto:
        ok = ok and new['S2_cell_month_WAPE'] <= cur['S2_cell_month_WAPE']
    return ok


def run_rule(candidates, scores, s2_veto):
    chosen, trail = 'a', []
    for m in candidates[1:]:
        win = beats(scores[m], scores[chosen], s2_veto)
        trail.append(f'{m} vs {chosen}: ' + ('replaces' if win else 'does not replace'))
        if win:
            chosen = m
    return chosen, trail


def stage_select():
    lo_full, hi_full = full_both('aqua', 'snpp')
    fit_lo, fit_hi = META['snpp']['archive_first_full_month'], '2017-12'
    sel_lo, sel_hi = '2018-01', '2019-12'
    assert lo_full <= fit_lo and sel_hi <= hi_full
    fit = load_pair('aqua', 'snpp', fit_lo, fit_hi)
    sel = load_pair('aqua', 'snpp', sel_lo, sel_hi)
    mapping, merge_log, sample_ok, counts = strata(fit)
    params = {'a': {}, 'b': {'r': float(fit.Y.sum() / fit.X.sum())}}
    candidates = ['a', 'b']
    if sample_ok:
        lab = pd.Series([mapping[(g, s)] for g, s in zip(fit.region, fit.season)], index=fit.index)
        grp = fit.groupby(lab)[['X', 'Y']].sum()
        params['c'] = {'r_strata': (grp.Y / grp.X).astype(float).to_dict()}
        candidates.append('c')
    sel_months = months(sel_lo, sel_hi)
    scores = {m: score(sel, predict(sel, m, params[m], mapping), sel_months) for m in candidates}
    orig_choice, orig_trail = run_rule(candidates, scores, s2_veto=True)
    chosen, trail = run_rule(candidates, scores, s2_veto=False)  # Amendment 4
    # Interval quantiles from selection-period residuals of the chosen method (§4).
    vh = predict(sel, chosen, params[chosen], mapping)
    d = sel.assign(Vh=vh)
    rm = d.groupby(['region', 'month'])[['X', 'Y', 'Vh']].sum().reset_index()
    rm = rm[(rm.X + rm.Y) > 0]
    e_rm = np.log((rm.Y + 1) / (rm.Vh + 1))
    aoi = d.groupby('month')[['X', 'Y', 'Vh']].sum().reindex(sel_months, fill_value=0)
    aoi = aoi[(aoi.X + aoi.Y) > 0]
    e_aoi = np.log((aoi.Y + 1) / (aoi.Vh + 1))
    frozen = {
        'aoi_notice': NOTICE,
        'periods': {'fit': [fit_lo, fit_hi], 'selection': [sel_lo, sel_hi], 'final_test': ['2020-01', '2021-06']},
        'unit': 'daytime archive type-0 grid-cell-days, 0.25 deg; Aqua MODIS conf>=30 vs S-NPP VIIRS conf!=l',
        'sample_size_check': {'threshold_each_sensor': THRESH, 'fit_counts_by_stratum': counts,
                              'merge_log': merge_log, 'passed': sample_ok,
                              'strata_used': sorted(set(mapping.values()))},
        'parameters': params, 'selection_scores_2018_2019': scores,
        'selection_rule_original': 'start (a); a more complex method replaces the current choice only if S1 drops >=10% relative, S2 not raised, S3 not lowered by >0.05',
        'selection_outcome_original_rule': {'trail': orig_trail, 'selected': orig_choice},
        'selection_rule_amended': 'Amendment 4 (made after the 2018-2019 scores were seen, before any 2020+ data was read): as original, but S2 is reported and no longer a veto',
        'selection_trail': trail, 'selected_method': chosen, 'selected_parameters': params[chosen],
        'strata_mapping': {f'{g}|{s}': lab for (g, s), lab in mapping.items()},
        'region_definition': 'cell-centre latitude: North Luzon >=16; South Luzon 12.5-<16; Visayas 9.5-<12.5; Mindanao <9.5. Dry season Feb-May; rest Jun-Jan.',
        'spatial_limitation': 'Exploratory diagnostic (analysis/results/diagnostic_s2.json): at single 0.25 deg cell-months the correction does not beat raw Aqua on absolute error; it helps at 0.5 deg and coarser in 2018-2019. No size threshold is validated; claims are limited to aggregate comparability.',
        'interval_quantiles': {'region_month': {'q10': float(np.quantile(e_rm, 0.1)), 'q90': float(np.quantile(e_rm, 0.9)), 'n': int(len(e_rm))},
                               'aoi_month': {'q10': float(np.quantile(e_aoi, 0.1)), 'q90': float(np.quantile(e_aoi, 0.9)), 'n': int(len(e_aoi))}},
        'method_d': 'not run: no committed addendum specifying it',
        'final_test_isolation': {'fit_selection_diagnostic_loaded_months_after_2019_12': False,
                                 'final_test_outcome_computed_or_inspected': False,
                                 'note': 'All years, including 2020-2021, were processed by ingestion and gridding (Steps 4, 6a, 6b) and appear in Step 4 descriptive raw detection counts (docs/DATA_MONTHLY.csv, docs/DATA_ANNUAL.csv); not used in fitting, diagnostics, selection or tuning.'},
    }
    RES.mkdir(parents=True, exist_ok=True)
    (RES / 'frozen_method.json').write_text(json.dumps(frozen, indent=2))
    print(json.dumps(frozen, indent=2))


def git_read(*args):
    return subprocess.run(['git', *args], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()


def assert_frozen():
    """Refuse to run unless the frozen files on disk equal their committed versions (read-only git checks)."""
    info = {}
    for rel in ['analysis/results/frozen_method.json', 'analysis/experiment.py', 'analysis/PREREGISTRATION.md']:
        committed = git_read('rev-parse', f'HEAD:{rel}')
        on_disk = git_read('hash-object', rel)
        if committed != on_disk:
            raise SystemExit(f'{rel} differs from HEAD; commit the freeze first')
        info[rel] = {'blob': on_disk, 'last_commit': git_read('log', '-1', '--format=%H %cI', '--', rel)}
    return info


def interval(vh, q):
    lo = np.maximum((vh + 1) * np.exp(q['q10']) - 1, 0)
    hi = np.maximum((vh + 1) * np.exp(q['q90']) - 1, 0)
    return lo, hi


def stage_test():
    freeze = assert_frozen()
    fz = json.loads((RES / 'frozen_method.json').read_text())
    if (RES / 'final_test.json').exists():
        raise SystemExit('final_test.json already exists: the final test runs once')
    lo, hi = fz['periods']['final_test']
    test = load_pair('aqua', 'snpp', lo, hi)
    mapping = {tuple(k.split('|')): v for k, v in fz['strata_mapping'].items()}
    m = fz['selected_method']
    tm = months(lo, hi)
    vh = {'frozen': predict(test, m, fz['selected_parameters'], mapping), 'a': predict(test, 'a', {}, mapping)}
    scores = {k: score(test, v, tm) for k, v in vh.items()}

    def rm_table(v):
        d = test.assign(Vh=v)
        r = d.groupby(['region', 'month'])[['X', 'Y', 'Vh']].sum().reset_index()
        return r[(r.X + r.Y) > 0]
    rf, ra = rm_table(vh['frozen']), rm_table(vh['a'])
    rng = np.random.default_rng(20261114)
    diffs = []
    for _ in range(2000):
        pick = rng.choice(tm, size=len(tm), replace=True)
        cnt = pd.Series(pick).value_counts()
        w_f = rf.month.map(cnt).fillna(0); w_a = ra.month.map(cnt).fillna(0)
        s_f = ((rf.Vh - rf.Y).abs() * w_f).sum() / (rf.Y * w_f).sum()
        s_a = ((ra.Vh - ra.Y).abs() * w_a).sum() / (ra.Y * w_a).sum()
        diffs.append(s_f - s_a)
    q = fz['interval_quantiles']
    l, h = interval(rf.Vh.to_numpy(), q['region_month'])
    cov_rm = float(((rf.Y >= l) & (rf.Y <= h)).mean())
    aoi = test.assign(Vh=vh['frozen']).groupby('month')[['X', 'Y', 'Vh']].sum().reindex(tm, fill_value=0)
    aoi = aoi[(aoi.X + aoi.Y) > 0]
    l2, h2 = interval(aoi.Vh.to_numpy(), q['aoi_month'])
    cov_aoi = float(((aoi.Y >= l2) & (aoi.Y <= h2)).mean())
    lab = lambda c: '80% interval' if 0.70 <= c <= 0.90 else f'interval with measured coverage {c:.0%}'
    s1f, s1a = scores['frozen']['S1_region_month_WAPE'], scores['a']['S1_region_month_WAPE']
    res = {
        'aoi_notice': NOTICE, 'period': [lo, hi], 'selected_method': m, 'freeze_evidence': freeze,
        'scores': scores,
        'success_rule': 'frozen S1 < (a) S1',
        'success': bool(s1f < s1a),
        'S1_difference_frozen_minus_a': float(s1f - s1a),
        'S1_difference_90pct_bootstrap': [float(np.quantile(diffs, 0.05)), float(np.quantile(diffs, 0.95))],
        'bootstrap': 'month-block, 2000 resamples, seed 20261114',
        'coverage': {'region_month': {'coverage': cov_rm, 'n': int(len(rf)), 'label': lab(cov_rm)},
                     'aoi_month': {'coverage': cov_aoi, 'n': int(len(aoi)), 'label': lab(cov_aoi)}},
        'original_rule_note': 'Under the original (pre-Amendment 4) rule the selected method was (a); its scores are the "a" entry above.',
    }
    (RES / 'final_test.json').write_text(json.dumps(res, indent=2))
    print(json.dumps(res, indent=2))


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('stage', choices=['select', 'test'])
    {'select': stage_select, 'test': stage_test}[ap.parse_args().stage]()
