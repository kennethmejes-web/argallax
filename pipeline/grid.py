#!/usr/bin/env python3
"""Build grid-cell-day and cell-month tables per satellite, following analysis/PREREGISTRATION.md.

Unit: one (0.25° cell, UTC acq_date, daynight, sensor) with >= 1 qualifying detection.
Qualifying = archive type 0 ("verified") or NRT with no type field ("unverified", §7),
plus the confidence filter (MODIS >= 30, VIIRS != 'l'). Types 1-3 are dropped.
Verified and unverified cell-days are counted in separate columns and never added.
Counts cover a rectangular screening area around the Philippines, not the national land boundary.

AI-assisted code. Licensed under Apache-2.0.
"""
import json
from pathlib import Path
import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parents[1]
PROC = ROOT / 'data/processed'
NOTICE = 'Counts cover a rectangular screening area around the Philippines, not the national land boundary.'
CELL = 0.25
SENSORS = {'aqua': ('aqua_modis', 'Aqua MODIS', 'modis'),
           'snpp': ('snpp_viirs', 'S-NPP VIIRS', 'viirs'),
           'noaa20': ('noaa20_viirs', 'NOAA-20 VIIRS', 'viirs')}
REGIONS = [(16.0, 'North Luzon'), (12.5, 'South Luzon'), (9.5, 'Visayas'), (-90, 'Mindanao')]


def region_of(lat_centre):
    out = np.full(len(lat_centre), 'Mindanao', dtype=object)
    for lo, name in reversed(REGIONS[:-1]):
        out[lat_centre >= lo] = name
    return out


def type_status(df):
    t = pd.to_numeric(df['type'], errors='coerce')
    return np.where(t.isna(), 'type_unknown', np.where(t.eq(0), 'type0_verified', 'other_type'))


def full_months(dates):
    """Months lying wholly between the first and last detection date (§1)."""
    first, last = dates.min(), dates.max()
    lo = first.to_period('M') if first.day == 1 else first.to_period('M') + 1
    hi = last.to_period('M') if last == last + pd.offsets.MonthEnd(0) else last.to_period('M') - 1
    return lo, hi


def build(key):
    stem, name, kind = SENSORS[key]
    d = pd.read_parquet(PROC / f'{stem}.parquet')
    d['acq_date'] = pd.to_datetime(d['acq_date'])
    d['type_status'] = type_status(d)  # recomputed here; never filled or inferred
    # NRT rows carry no type; archive rows always do. Guard against mixing.
    bad = (d.data_status.eq('archive') & d.type_status.eq('type_unknown')) | (d.data_status.eq('nrt') & ~d.type_status.eq('type_unknown'))
    if bad.any():
        raise ValueError(f'{name}: {int(bad.sum())} rows break the archive=typed / nrt=untyped rule')
    # Archive precedence by sensor-date (§7), enforced again here for every sensor.
    archive_days = set(d.loc[d.data_status.eq('archive'), 'acq_date'])
    d = d[~(d.data_status.eq('nrt') & d.acq_date.isin(archive_days))]
    if kind == 'modis':
        conf_ok = pd.to_numeric(d.confidence, errors='raise') >= 30
    else:
        if not set(d.confidence.dropna().unique()) <= {'l', 'n', 'h'}:
            raise ValueError(f'{name}: unexpected VIIRS confidence codes')
        conf_ok = d.confidence.ne('l')
    q = d[conf_ok & d.type_status.isin(['type0_verified', 'type_unknown']) & d.daynight.isin(['D', 'N'])].copy()
    q['verified'] = q.type_status.eq('type0_verified')
    q['iy'] = np.floor(q.latitude / CELL).astype(int)
    q['ix'] = np.floor(q.longitude / CELL).astype(int)
    cd = (q.groupby(['iy', 'ix', 'acq_date', 'daynight', 'verified'], as_index=False)
            .agg(n_detections=('latitude', 'size')))
    cd['cell_lat'] = (cd.iy + 0.5) * CELL
    cd['cell_lon'] = (cd.ix + 0.5) * CELL
    cd['region'] = region_of(cd.cell_lat.to_numpy())
    cd['month'] = cd.acq_date.dt.to_period('M').astype(str)
    cd['sensor'] = name
    # Cell-month: count cell-days, verified and unverified kept apart.
    cm = (cd.assign(n_verified=cd.verified.astype(int), n_unverified=(~cd.verified).astype(int))
            .groupby(['iy', 'ix', 'cell_lat', 'cell_lon', 'region', 'month', 'daynight'], as_index=False)[['n_verified', 'n_unverified']].sum())
    arch = d.loc[d.data_status.eq('archive'), 'acq_date']
    allr = d['acq_date']
    a_lo, a_hi = full_months(arch)
    t_lo, t_hi = full_months(allr)
    meta = {
        'sensor': name, 'aoi_notice': NOTICE, 'cell_deg': CELL,
        'detection_bounds_lon_lat': [float(d.longitude.min()), float(d.latitude.min()), float(d.longitude.max()), float(d.latitude.max())],
        'archive_first_date': str(arch.min().date()), 'archive_last_date': str(arch.max().date()),
        'archive_first_full_month': str(a_lo), 'archive_last_full_month': str(a_hi),
        'all_first_date': str(allr.min().date()), 'all_last_date': str(allr.max().date()),
        'all_first_full_month': str(t_lo), 'all_last_full_month': str(t_hi),
        'nrt_label': 'provisional — source type not verified; may include non-vegetation heat sources',
    }
    for frame, fname in [(cd.drop(columns='sensor'), f'celldays_{key}.parquet'), (cm, f'cellmonth_{key}.parquet')]:
        t = pa.Table.from_pandas(frame, preserve_index=False)
        md = dict(t.schema.metadata or {}); md[b'argallax'] = json.dumps(meta).encode()
        pq.write_table(t.replace_schema_metadata(md), PROC / fname)
    return meta, cd, cm, len(d), len(q)


def main():
    metas, lines = {}, []
    for key in SENSORS:
        meta, cd, cm, n_rows, n_q = build(key)
        metas[key] = meta
        yr = cd.assign(year=cd.acq_date.dt.year).groupby(['year', 'daynight', 'verified']).size().unstack(['daynight', 'verified'], fill_value=0)
        lines.append((meta, n_rows, n_q, len(cd), len(cm), yr))
    (PROC / 'grid_meta.json').write_text(json.dumps(metas, indent=2))
    out = ['# Grid build check', '', NOTICE, '',
           'Built by `pipeline/grid.py` (unit and filters from analysis/PREREGISTRATION.md §1, §7). '
           'This is a build check only: no ratio, comparison or score is computed here.', '']
    for meta, n_rows, n_q, n_cd, n_cm, _ in lines:
        out.append(f"- **{meta['sensor']}**: {n_rows:,} rows after archive precedence → {n_q:,} qualifying detections → "
                   f"{n_cd:,} cell-day rows → {n_cm:,} cell-month rows. Archive {meta['archive_first_date']} to {meta['archive_last_date']} "
                   f"(full months {meta['archive_first_full_month']}–{meta['archive_last_full_month']}); all data to {meta['all_last_date']}.")
    (ROOT / 'docs/GRID_CHECK.md').write_text('\n'.join(out) + '\n')
    print('\n'.join(out))


if __name__ == '__main__':
    main()
