#!/usr/bin/env python3
"""Load FIRMS ZIPs and produce source-preserving tables and a data inventory.

AI-assisted code. Licensed under Apache-2.0.
"""
from pathlib import Path
from zipfile import ZipFile
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW, OUT, DOC = ROOT/'data/raw', ROOT/'data/processed', ROOT/'docs'
PRODUCTS = {'M-C61': 'MODIS C6.1', 'SV-C2': 'S-NPP VIIRS C2', 'J1V-C2': 'NOAA-20 VIIRS C2'}
NAMES = {'Aqua': 'Aqua MODIS', 'Terra': 'Terra MODIS', 'SNPP': 'S-NPP VIIRS', 'N20': 'NOAA-20 VIIRS'}

def main():
    files = sorted(RAW.glob('*.zip'))
    if len(files) != 10:
        raise SystemExit(f'Expected 10 ZIPs, found {len(files)}')
    frames = []
    for path in files:
        product_key = next((key for key in PRODUCTS if key in path.name), None)
        if not product_key:
            raise ValueError(f'Unknown product: {path.name}')
        with ZipFile(path) as archive:
            for member in archive.namelist():
                if not member.lower().endswith('.csv'):
                    continue
                with archive.open(member) as handle:
                    df = pd.read_csv(handle, dtype={'satellite': 'string', 'confidence': 'string', 'acq_time': 'string', 'version': 'string'})
                df['source_zip'] = path.name
                df['source_file'] = member
                df['product'] = PRODUCTS[product_key]
                df['data_status'] = 'nrt' if 'fire_nrt_' in member else 'archive'
                frames.append(df)
    data = pd.concat(frames, ignore_index=True)
    data['acq_time'] = data['acq_time'].str.zfill(4)
    data['acq_date'] = pd.to_datetime(data['acq_date'], errors='raise')
    expected = {'MODIS C6.1': {'Aqua','Terra'}, 'S-NPP VIIRS C2': {'SNPP'}, 'NOAA-20 VIIRS C2': {'N20'}}
    for product, allowed in expected.items():
        observed = set(data.loc[data['product'].eq(product), 'satellite'].dropna())
        if not observed <= allowed:
            raise ValueError(f'Unexpected satellite codes for {product}: {observed}')
    data['satellite_name'] = data['satellite'].map(NAMES)
    if data['satellite_name'].isna().any():
        raise ValueError('Missing satellite code')
    # Identity key represents a detection at a location and acquisition time; inspect conflicts separately.
    key = ['satellite_name', 'latitude', 'longitude', 'acq_date', 'acq_time']
    data = data.sort_values(['data_status','source_zip','source_file'], kind='stable')
    repeated = data[data.duplicated(key, keep=False)]
    values = [c for c in data.columns if c not in {'source_zip', 'source_file', 'product', 'data_status'}]
    if len(repeated.drop_duplicates(values)) != len(repeated.drop_duplicates(key)):
        raise ValueError('Matching detection identities have conflicting fields; review before deduplication')
    dup = data.duplicated(key, keep='first')
    duplicate_counts = data.loc[dup].groupby('satellite_name').size().to_dict()
    clean = data.loc[~dup].copy()
    OUT.mkdir(parents=True, exist_ok=True)
    DOC.mkdir(parents=True, exist_ok=True)
    for sat, filename in [('Aqua MODIS','aqua_modis'),('Terra MODIS','terra_modis'),('S-NPP VIIRS','snpp_viirs'),('NOAA-20 VIIRS','noaa20_viirs')]:
        clean.loc[clean.satellite_name.eq(sat)].to_parquet(OUT/f'{filename}.parquet', index=False)
    clean['year'] = clean.acq_date.dt.year
    rows = []
    for (sat, year), g in clean.groupby(['satellite_name','year'], sort=True):
        typ = pd.to_numeric(g.get('type'), errors='coerce')
        known = typ.notna().sum()
        conf = ', '.join(f'{k}:{v}' for k,v in g.confidence.fillna('unknown').value_counts().sort_index().items())
        dn = ', '.join(f'{k}:{v}' for k,v in g.daynight.fillna('unknown').value_counts().sort_index().items())
        rows.append([sat, year, len(g), int(typ.eq(0).sum()), int(known), conf, dn, g.acq_date.min().date(), g.acq_date.max().date()])
    annual = pd.DataFrame(rows, columns=['satellite','year','detections','type_0','type_known','confidence_counts','daynight_counts','first_date','last_date'])
    annual.to_csv(DOC/'DATA_ANNUAL.csv', index=False)
    subset = clean[(clean.satellite_name.isin(['Aqua MODIS','S-NPP VIIRS'])) & clean.year.between(2012,2021)].copy()
    # Rough latitude bands, not administrative boundaries or a land mask.
    subset['region'] = pd.cut(subset.latitude, [-90,9.5,12.5,16,90], labels=['Mindanao','Visayas','South Luzon','North Luzon'], right=False)
    subset['month'] = subset.acq_date.dt.to_period('M').astype(str)
    monthly = subset.groupby(['satellite_name','month','region'], observed=True).size().unstack(fill_value=0).reindex(columns=['North Luzon','South Luzon','Visayas','Mindanao'], fill_value=0)
    idx = pd.MultiIndex.from_product([['Aqua MODIS','S-NPP VIIRS'], pd.period_range('2012-01','2021-12',freq='M').astype(str)], names=['satellite','month'])
    monthly.index.names = ['satellite','month']
    monthly = monthly.reindex(idx, fill_value=0)
    monthly.insert(0, 'Whole bounding box', monthly.sum(axis=1))
    monthly.to_csv(DOC/'DATA_MONTHLY.csv')
    inventory = data.groupby(['satellite_name','source_file','data_status']).agg(rows=('acq_date','size'), first=('acq_date','min'), last=('acq_date','max')).reset_index()
    inventory.to_csv(DOC/'DATA_SOURCES.csv', index=False)
    print('Rows:', len(data), 'unique:', len(clean), 'removed by identity:', duplicate_counts)
    print(inventory.to_string(index=False))
    print('Annual table:', len(annual), 'rows; monthly table:', len(monthly), 'rows')

if __name__ == '__main__':
    main()
