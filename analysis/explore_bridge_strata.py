#!/usr/bin/env python3
"""EXPLORATORY (not preregistered): NOAA-20 vs S-NPP daytime cell-days by region x season,
fit period 2018-04..2021-12 and test period 2022-01..last full month of both. Changes no rule,
label or parameter by itself; reported for transparency about smaller areas.
Counts cover a rectangular screening area around the Philippines, not the national land boundary.
AI-assisted code. Licensed under Apache-2.0."""
import json, sys
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).parent))
import experiment as ex
hi = min(ex.META['snpp']['archive_last_full_month'], ex.META['noaa20']['archive_last_full_month'])
out = {'label': 'exploratory, not preregistered', 'aoi_notice': ex.NOTICE, 'ratio': 'sum NOAA-20 / sum S-NPP daytime cell-days'}
for name, lo, h in [('fit_2018-04_2021-12', ex.META['noaa20']['archive_first_full_month'], '2021-12'), (f'test_2022-01_{hi}', '2022-01', hi)]:
    d = ex.load_pair('noaa20', 'snpp', lo, h)
    tab = {}
    for (g, s), x in d.groupby(['region', 'season']):
        tab[f'{g}|{s}'] = {'noaa20': int(x.X.sum()), 'snpp': int(x.Y.sum()), 'N_over_V': round(x.X.sum()/x.Y.sum(), 3)}
    for g, x in d.groupby('region'):
        tab[f'{g}|all'] = {'noaa20': int(x.X.sum()), 'snpp': int(x.Y.sum()), 'N_over_V': round(x.X.sum()/x.Y.sum(), 3)}
    tab['AOI|all'] = {'noaa20': int(d.X.sum()), 'snpp': int(d.Y.sum()), 'N_over_V': round(d.X.sum()/d.Y.sum(), 3)}
    if name.startswith('test'):
        yrs = {}
        for (g, y), x in d.assign(year=d.month.str[:4]).groupby(['region', 'year']):
            yrs[f'{g}|{y}'] = round(x.X.sum()/x.Y.sum(), 3) if x.Y.sum() else None
        out['test_by_region_year'] = yrs
    out[name] = tab
(ex.RES/'explore_bridge_strata.json').write_text(json.dumps(out, indent=2))
for k in [k for k in out if k.startswith(('fit','test_2'))]:
    print(k); [print(f'  {s:22s} N={v["noaa20"]:6d} V={v["snpp"]:6d} N/V={v["N_over_V"]}') for s, v in out[k].items()]
print({k: v for k, v in out['test_by_region_year'].items()})
