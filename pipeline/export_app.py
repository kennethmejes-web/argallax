#!/usr/bin/env python3
"""Step 8: compact files the static website reads (app/public/data/).

- cells.json        : cell-month values per sensor (columnar), raw counts; area sums are done in the browser.
- meta.json         : AOI, grid, regions, era/status per month, frozen ratios, interval quantiles and when each
                      may be used, validation numbers, label texts, warning threshold, credits.
                      Nothing region-specific is hard-coded in the app.
- hotspots/YYYY.csv : qualifying detections per year for CSV download (rows labeled by satellite; never summed).

Intervals are never stored per cell: the app applies them only to the total of a selected area
(preregistration §4). Counts cover a rectangular screening area around the Philippines, not the
national land boundary.

AI-assisted code. Licensed under Apache-2.0.
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'analysis'))
import experiment as ex  # noqa: E402

PROC, RES, OUT = ROOT / 'data/processed', ROOT / 'analysis/results', ROOT / 'app/public/data'
NOTICE = ex.NOTICE
fz = json.loads((RES / 'frozen_method.json').read_text())
ft = json.loads((RES / 'final_test.json').read_text())
pf = json.loads((RES / 'postfreeze.json').read_text())
eb = json.loads((RES / 'explore_bridge_strata.json').read_text())
dg = json.loads((RES / 'diagnostic_s2.json').read_text())
META = ex.META
RATIO = fz['selected_parameters']['r_strata']
MAP = {tuple(k.split('|')): v for k, v in fz['strata_mapping'].items()}
SENS = ['aqua', 'snpp', 'noaa20']
REGIONS = ['North Luzon', 'South Luzon', 'Visayas', 'Mindanao']

# ---------------- eras (all dates read from data) ----------------
a_first = META['aqua']['archive_first_full_month']
a_arch_last = META['aqua']['archive_last_full_month']
v_first = META['snpp']['archive_first_full_month']
v_last = META['snpp']['archive_last_full_month']  # main series: S-NPP through its last full archive month
n_arch_last = META['noaa20']['archive_last_full_month']
last_date = pd.Timestamp(META['noaa20']['all_last_date'])
cov = pd.read_csv(ROOT / 'docs/NRT_COVERAGE.csv')
incomplete = set(pd.to_datetime(cov.loc[cov.status.eq('incomplete'), 'date']).dt.normalize())
last_complete = last_date - pd.Timedelta(days=1) if last_date.normalize() in incomplete else last_date
cur_month = str(last_complete.to_period('M'))
elapsed = int(last_complete.day)
month_end_full = (last_complete + pd.Timedelta(days=1)).day == 1
months = ex.months(a_first, cur_month)

era = []
for m in months:
    if m < v_first:
        s, kind, arch_last = 'aqua', 'harmonized', a_arch_last
    elif m <= v_last:
        s, kind, arch_last = 'snpp', 'observed', v_last
    else:
        s, kind, arch_last = 'noaa20', 'bridged', n_arch_last
    era.append({'month': m, 'sensor': s, 'kind': kind,
                'status': 'provisional' if m > arch_last else 'archive',
                'complete': not (m == cur_month and not month_end_full)})

# ---------------- cell-month table ----------------
rows = []
for si, key in enumerate(SENS):
    cd = pd.read_parquet(PROC / f'celldays_{key}.parquet')
    cd['acq_date'] = pd.to_datetime(cd.acq_date)
    if key == 'aqua':
        cd = cd[cd.daynight.eq('D')]  # Aqua night is never back-estimated (prereg §1)
    cd = cd[cd.month.between(a_first, cur_month) & (cd.acq_date <= last_complete)]
    cd['early'] = cd.acq_date.dt.day <= elapsed
    cd['ver'] = cd.verified.astype(int)
    cd['unv'] = (~cd.verified).astype(int)
    cd['ever'] = (cd.verified & cd.early).astype(int)
    cd['eunv'] = (~cd.verified & cd.early).astype(int)
    t = (cd.groupby(['iy', 'ix', 'region', 'month', 'daynight'], as_index=False)
           [['ver', 'unv', 'ever', 'eunv']].sum()
           .rename(columns={'ver': 'v', 'unv': 'u', 'ever': 'ev', 'eunv': 'eu'}))
    t['s'] = si
    rows.append(t)
cm = pd.concat(rows, ignore_index=True)
# early-day counts are only needed for the calendar month of the current (possibly partial) month
cm.loc[cm.month.str[5:7].ne(cur_month[5:7]), ['ev', 'eu']] = 0
cell_keys = sorted(set(zip(cm.iy, cm.ix, cm.region)))
cidx = {k: i for i, k in enumerate(cell_keys)}
midx = {m: i for i, m in enumerate(months)}
cm['c'] = [cidx[k] for k in zip(cm.iy, cm.ix, cm.region)]
cm['m'] = cm.month.map(midx)
cm['d'] = cm.daynight.eq('N').astype(int)
cm = cm.sort_values(['s', 'd', 'm', 'c']).reset_index(drop=True)

cells_json = {
    'aoi_notice': NOTICE,
    'cell_deg': 0.25,
    'cells': [[int(iy), int(ix), REGIONS.index(r)] for iy, ix, r in cell_keys],
    'cells_note': 'cell centre lat = (iy+0.5)*0.25, lon = (ix+0.5)*0.25; third value indexes meta.regions',
    'months': months,
    'columns': {
        's': 'sensor index into meta.sensors', 'd': '0 = day, 1 = night', 'm': 'month index', 'c': 'cell index',
        'v': 'verified cell-days (archive, type 0)',
        'u': 'provisional cell-days (NRT, source type not verified)',
        'ev': f'verified cell-days on days 1..{elapsed} (filled only for calendar month {cur_month[5:7]})',
        'eu': f'provisional cell-days on days 1..{elapsed} (filled only for calendar month {cur_month[5:7]})'},
    'harmonize': 'Aqua rows only: estimated VIIRS-equivalent = count x meta.harmonization.ratios[region|season]',
    'rows': {k: cm[k].astype(int).tolist() for k in ['s', 'd', 'm', 'c', 'v', 'u', 'ev', 'eu']},
}
OUT.mkdir(parents=True, exist_ok=True)
(OUT / 'cells.json').write_text(json.dumps(cells_json, separators=(',', ':')))

# ---------------- hotspots CSV per year ----------------
CNAME = {'aqua_modis': 'Aqua MODIS', 'snpp_viirs': 'S-NPP VIIRS', 'noaa20_viirs': 'NOAA-20 VIIRS'}
frames = []
for stem in CNAME:
    d = pd.read_parquet(PROC / f'{stem}.parquet')
    d['acq_date'] = pd.to_datetime(d.acq_date)
    t = pd.to_numeric(d['type'], errors='coerce')
    d['status'] = np.where(t.isna(), 'provisional', np.where(t.eq(0), 'archive', 'drop'))
    arch_days = set(d.loc[d.data_status.eq('archive'), 'acq_date'])
    d = d[~(d.data_status.eq('nrt') & d.acq_date.isin(arch_days)) & d.status.ne('drop')]
    ok = (pd.to_numeric(d.confidence, errors='coerce') >= 30) if stem == 'aqua_modis' else d.confidence.ne('l')
    d = d[ok & (d.acq_date <= last_complete) & (d.acq_date >= pd.Period(a_first).start_time)]
    frames.append(pd.DataFrame({
        'acq_date': d.acq_date.dt.strftime('%Y-%m-%d'),
        'acq_time_utc': d.acq_time.astype(str).str.zfill(4),
        'latitude': d.latitude.round(4), 'longitude': d.longitude.round(4),
        'satellite': CNAME[stem], 'daynight': d.daynight, 'confidence': d.confidence,
        'frp_mw': d.frp, 'record_status': d.status}))
hs = pd.concat(frames, ignore_index=True).sort_values(['acq_date', 'acq_time_utc', 'satellite'])
head = (f'# {NOTICE} Source: NASA FIRMS (MODIS C6.1 Aqua; VIIRS 375 m S-NPP and NOAA-20). '
        'Qualifying detections only (archive type 0 or NRT; MODIS confidence >= 30; VIIRS confidence not low). '
        'Rows are detections, not fires; do not add satellites together. '
        'record_status: archive = science-quality, type 0 (presumed vegetation fire); provisional = near-real-time, '
        'source type not verified, may include non-vegetation heat sources.\n')
(OUT / 'hotspots').mkdir(exist_ok=True)
files = {}
for y, g in hs.groupby(hs.acq_date.str[:4]):
    p = OUT / 'hotspots' / f'{y}.csv'
    p.write_text(head + g.to_csv(index=False))
    files[y] = p.stat().st_size

# ---------------- meta ----------------
fs, fa = ft['scores']['frozen'], ft['scores']['a']
br = pf['bridge']
eb_test = eb[[k for k in eb if k.startswith('test_2')][0]]
meta = {
    'title': 'ARGALLAX',
    'question': 'Did the burning change, or did the satellite change?',
    'aoi_notice': NOTICE,
    'aoi_bounds_lon_lat': [116.9, 4.6, 126.6, 20.8],
    'unit': 'grid-cell-days: number of 0.25° cell × UTC day combinations with at least one qualifying detection',
    'unit_short': 'cell-days',
    'cell_deg': 0.25,
    'regions': [{'name': 'North Luzon', 'lat_min': 16.0, 'lat_max': None},
                {'name': 'South Luzon', 'lat_min': 12.5, 'lat_max': 16.0},
                {'name': 'Visayas', 'lat_min': 9.5, 'lat_max': 12.5},
                {'name': 'Mindanao', 'lat_min': None, 'lat_max': 9.5}],
    'regions_note': 'Latitude bands of the screening rectangle (by cell centre), not island or administrative boundaries.',
    'seasons': {'dry': [2, 3, 4, 5], 'rest': [6, 7, 8, 9, 10, 11, 12, 1]},
    'sensors': [{'key': 'aqua', 'name': 'Aqua MODIS (C6.1, 1 km)'},
                {'key': 'snpp', 'name': 'S-NPP VIIRS (375 m)'},
                {'key': 'noaa20', 'name': 'NOAA-20 VIIRS (375 m)'}],
    'eras': era,
    'era_summary': [
        {'from': a_first, 'to': ex.months(a_first, v_first)[-2], 'sensor': 'aqua',
         'label': 'Aqua MODIS, converted to estimated VIIRS-equivalent'},
        {'from': v_first, 'to': v_last, 'sensor': 'snpp', 'label': 'S-NPP VIIRS (reference scale)'},
        {'from': ex.months(v_last, cur_month)[1], 'to': cur_month, 'sensor': 'noaa20',
         'label': 'NOAA-20 VIIRS continuing the S-NPP scale (provisional)'}],
    'current_month': {'month': cur_month, 'last_complete_date': str(last_complete.date()),
                      'elapsed_days': elapsed, 'complete': bool(month_end_full),
                      'rule': f'A partial month is compared only with days 1–{elapsed} of the same month in past years.'},
    'night': ('Night detections are shown only from 2012 as observed VIIRS; they are never estimated for the '
              'Aqua era and are not part of the main series.'),
    'harmonization': {'method': '(c) ratio per region × season', 'ratios': RATIO,
                      'fit_period': fz['periods']['fit'], 'reference': 'S-NPP VIIRS daytime cell-days'},
    'intervals': {
        'apply_to': 'Aqua-era months only (before Feb 2012), and only to the total of the selected area — never per cell, never summed.',
        'whole_area': {'q10': fz['interval_quantiles']['aoi_month']['q10'],
                       'q90': fz['interval_quantiles']['aoi_month']['q90'],
                       'label': 'Nominal 80% range; 13 of 18 test months fell inside.'},
        'region': {'q10': fz['interval_quantiles']['region_month']['q10'],
                   'q90': fz['interval_quantiles']['region_month']['q90'],
                   'label': 'Range covered 67% of test months at regional scale (not 80%).'},
        'other_box': {'uses': 'region',
                      'label': 'Approximate range, not validated at this size (the regional range, which covered 67% of test months).'},
        'formula': 'lo = max((x+1)·e^q10 − 1, 0); hi = max((x+1)·e^q90 − 1, 0), with x = estimated total for the selected area',
        'caveat': ('Ranges reflect month-to-month scatter in 2018–2019; they do not include possible long-term change '
                   'in the Aqua-to-VIIRS relation before 2012.')},
    'small_area_warning': {
        'threshold_deg': 0.5,
        'label': 'Small area: the harmonized history is less reliable here.',
        'basis': ('Interface warning based on an exploratory diagnostic (2018–2019 data): scaled Aqua was no closer to '
                  'S-NPP than raw Aqua for single 0.25° cells, and closer for 0.5° blocks and larger. It is not a '
                  'validated accuracy boundary, and larger areas are not thereby validated.'),
        'diagnostic_block_error': {k: {'raw': v['WAPE_a'], 'harmonized': v['WAPE_c']} for k, v in dg['blocks'].items()}},
    'validation': {
        'final_test': {
            'period': ft['period'],
            'regional_error_harmonized': round(fs['S1_region_month_WAPE'], 3),
            'regional_error_raw': round(fa['S1_region_month_WAPE'], 3),
            'whole_area_ratio_harmonized': round(fs['bias_sum_Vhat_over_V'], 3),
            'whole_area_ratio_raw': round(fa['bias_sum_Vhat_over_V'], 3),
            'cell_error_harmonized': round(fs['S2_cell_month_WAPE'], 3),
            'cell_error_raw': round(fa['S2_cell_month_WAPE'], 3)},
        'bridge': {
            'test': br['test'],
            'whole_area_ratio_noaa20_over_snpp': br['primary']['bias_sum_Shat_over_V'],
            'by_year_noaa20_over_snpp': {y: round(1 / v['V_over_Shat'], 3) for y, v in br['primary']['per_year'].items()},
            'exploratory_by_region_season': {k: v['N_over_V'] for k, v in eb_test.items()},
            'exploratory_note': 'Exploratory, not preregistered; not corrected for. Its practical effect on single months was not tested.'},
        'drift_after_mid_2021_regional_error': {y: v['S1'] for y, v in pf['drift_check']['per_year'].items()}},
    'labels': {
        'harmonized_month': 'Estimated VIIRS-equivalent (Aqua MODIS converted to the S-NPP VIIRS scale).',
        'observed_month': 'Observed S-NPP VIIRS (reference scale).',
        'bridged_month': ('NOAA-20 VIIRS used as a continuation of S-NPP. Checked for whole-area yearly totals '
                          '(2022 – Jul 2026), where it read about 4% higher (1–7% by year). In an exploratory '
                          'breakdown it read 1–6% higher by region and 8–11% higher in June–January; this difference '
                          'is not corrected and its effect on single months was not tested. Cannot be checked after '
                          'S-NPP ended (2 Nov 2026).'),
        'provisional_month': ('Provisional: near-real-time data, source type not verified; may include non-vegetation '
                              'heat sources. Science-quality data replaces it after about five months.'),
        'incomplete_month': f'Incomplete month: compared with days 1–{elapsed} of past years only.',
        'zero': 'No detections in the supplied files, which is not proof of no fire. Cloud, smoke or a missed overpass can also give no detections.',
        'clouds': ('Hotspot counts depend on whether the satellite could see the ground; a cloudy month can show fewer '
                   'detections without less burning. This is not corrected.'),
        'what_it_measures': ('A sensor-harmonized index of detected hotspot activity on the S-NPP VIIRS scale; not '
                             'fire counts, burned area or emissions.'),
        'drift': ('After mid-2021, Aqua drifted from its fixed orbit and Aqua and S-NPP agreed less well (regional '
                  'monthly difference 23–33%); the cause cannot be separated from S-NPP ageing or real change. The '
                  'main series uses VIIRS from Feb 2012.'),
        'selection_amendment': ('The method-selection rule was changed after the 2018–2019 selection scores were seen '
                                'and before the final test; under the original rule, no correction would have been '
                                'selected. Both outcomes are reported.'),
        'not_better_than_one_ratio': 'The test does not show that eight ratios are better than one single ratio.',
        'agreement_scope': 'Agreement is with S-NPP VIIRS detections, not with true fire activity.',
        'pre2012': 'Values before 2012 assume the 2012–2017 Aqua-to-VIIRS relation held from 2002; this cannot be tested.'},
    'claims_source': 'analysis/SCIENCE_REVIEW.md §6',
    'credits': {
        'data': ('NASA FIRMS: MODIS Collection 6.1 (Aqua) and VIIRS 375 m (S-NPP, NOAA-20) active fire products; '
                 'recent months from LANCE FIRMS near-real-time data.'),
        'citation_url': 'https://www.earthdata.nasa.gov/data/tools/firms',
        'ai': 'ARGALLAX was created by Kenneth Mejes for Project Sidequest, a solo entry in NASA Space Apps Challenge 2026. Development was AI-assisted, with the project direction, scientific decisions, and final accountability held by the creator. AI tools used: Claude (Anthropic); ChatGPT and Codex (OpenAI).',
        'licence': 'Apache-2.0'},
    'files': {'cells': 'cells.json', 'hotspots_by_year': sorted(files), 'hotspots_bytes': files},
}
(OUT / 'meta.json').write_text(json.dumps(meta, indent=1, ensure_ascii=False))
print('cell-month rows', len(cm), '| cells', len(cell_keys), '| months', len(months),
      '| current', cur_month, 'elapsed', elapsed, 'complete', month_end_full)
print('hotspot rows', len(hs), '| files', len(files), '| total MB', round(sum(files.values()) / 1e6, 1),
      '| largest MB', round(max(files.values()) / 1e6, 2))
