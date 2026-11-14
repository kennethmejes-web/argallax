#!/usr/bin/env python3
"""Fetch recent FIRMS gaps; rebuild with --offline from cached raw responses.
AI-assisted code. Licensed under Apache-2.0. API documentation: https://firms.modaps.eosdis.nasa.gov/api/area
"""
import argparse
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import io
import json
from pathlib import Path
from urllib.request import urlopen
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
import load_firms

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT/'data/raw/nrt'
NOTICE = 'Counts cover a rectangular screening area around the Philippines, not the national land boundary.'
PROVISIONAL = 'provisional — source type not verified; may include non-vegetation heat sources'
BOX = '116.9,4.6,126.6,20.8'
SOURCES = [('VIIRS_NOAA20_NRT','noaa20_viirs','NOAA-20 VIIRS','N20','NOAA-20 VIIRS C2'), ('MODIS_NRT','aqua_modis','Aqua MODIS','Aqua','MODIS C6.1')]

def read_csv(raw, required):
    data = pd.read_csv(io.BytesIO(raw), dtype={'acq_time':'string','confidence':'string','satellite':'string','version':'string'})
    if not set(required) <= set(data.columns):
        raise ValueError('FIRMS response lacks expected CSV columns')
    return data

def request(path, key):
    # Never propagate exceptions containing the secret-bearing request URL.
    try:
        with urlopen('https://firms.modaps.eosdis.nasa.gov/api/'+path.replace('{key}',key), timeout=45) as response:
            return response.read()
    except Exception:
        raise RuntimeError('FIRMS request failed; URL and credentials suppressed') from None

def chunks(start, end):
    while start <= end:
        stop = min(end, start + timedelta(days=4))
        yield start, stop
        start = stop + timedelta(days=1)

def merge(base, extra):
    data = pd.concat([base,extra], ignore_index=True)
    data['acq_date'] = pd.to_datetime(data.acq_date)
    data['acq_time'] = data.acq_time.astype('string').str.zfill(4)
    # Preregistered archive precedence is by satellite-date, not just matched pixels.
    archive_days = set(data.loc[data.data_status.eq('archive'),'acq_date'])
    data = data[~(data.data_status.eq('nrt') & data.acq_date.isin(archive_days))]
    data = data.sort_values(['data_status','source_file'],kind='stable').drop_duplicates(['satellite_name','acq_date','acq_time','latitude','longitude'])
    data['type_status'] = data['type'].map(lambda v: 'type_unknown' if pd.isna(v) else ('type0_verified' if v == 0 else 'other_type'))
    data['provisional'] = data.data_status.eq('nrt')
    data['provisional_label'] = data.provisional.map({True: PROVISIONAL, False: ''})
    return data

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--offline',action='store_true')
    parser.add_argument('--through', type=lambda value: datetime.strptime(value,'%Y-%m-%d').date(), help='Last requested UTC acquisition date (defaults to today in Asia/Manila)')
    args=parser.parse_args()
    today=datetime.now(ZoneInfo('Asia/Manila')).date()
    if args.through:
        if args.through > today:
            raise SystemExit('Cannot fetch future dates')
        today=args.through
    RAW.mkdir(parents=True,exist_ok=True)
    key=''
    if not args.offline:
        for line in (ROOT/'.env').read_text().splitlines():
            if line.strip().startswith('FIRMS_MAP_KEY='):
                key=line.split('=',1)[1].strip().strip('\"\x27')
        if not key:
            raise SystemExit('Set FIRMS_MAP_KEY in .env; never paste it into chat.')
        raw=request('data_availability/csv/{key}/all',key)
        read_csv(raw,['data_id','min_date','max_date'])
        (RAW/'availability.csv').write_bytes(raw)
    availability=read_csv((RAW/'availability.csv').read_bytes(),['data_id','min_date','max_date'])
    print(availability[availability.data_id.isin([s[0] for s in SOURCES])].to_string(index=False))
    load_firms.main()  # Restore baseline from the ten original ZIPs, including embedded NRT.
    coverage=[]
    monthly=[]
    for source,stem,name,satellite,product in SOURCES:
        path=ROOT/'data/processed'/f'{stem}.parquet'
        base=pd.read_parquet(path)
        start=base.acq_date.max().date()+timedelta(days=1)
        available=availability[availability.data_id.eq(source)]
        low=pd.to_datetime(available.min_date.iloc[0]).date() if len(available) else today+timedelta(days=1)
        high=pd.to_datetime(available.max_date.iloc[0]).date() if len(available) else start-timedelta(days=1)
        extras=[]
        for a,b in chunks(start,today):
            for day in pd.date_range(a,b):
                if not low <= day.date() <= high:
                    coverage.append([source,day.date(),'missing','outside advertised availability'])
            a,b=max(a,low),min(b,high)
            if a>b: continue
            cache=RAW/f'{source}_{a}_{b}.csv'
            try:
                if not cache.exists() and not args.offline:
                    raw=request(f'area/csv/{{key}}/{source}/{BOX}/{(b-a).days+1}/{a}',key)
                    frame=read_csv(raw,['latitude','longitude','acq_date','acq_time','satellite','confidence','daynight'])
                    cache.write_bytes(raw)
                frame=read_csv(cache.read_bytes(),['latitude','longitude','acq_date','acq_time','satellite','confidence','daynight'])
                frame['acq_date']=pd.to_datetime(frame.acq_date)
                if not frame.empty and not (frame.acq_date.dt.date.between(a,b) & frame.latitude.between(4.6,20.8) & frame.longitude.between(116.9,126.6)).all():
                    raise ValueError('Response outside requested dates or AOI')
                frame=frame[frame.satellite.eq(satellite)].copy()
                frame=frame.rename(columns={'bright_ti4':'brightness','bright_ti5':'bright_t31'})
                frame['source_zip']=pd.NA
                frame['source_file']=str(cache.relative_to(ROOT))
                frame['product']=product
                frame['data_status']='nrt'
                frame['satellite_name']=name
                frame['type']=float('nan')
                extras.append(frame)
                for day in pd.date_range(a,b):
                    coverage.append([source,day.date(),'provisional' if day.date()<today else 'incomplete','queried; no detections does not prove full coverage'])
            except Exception:
                for day in pd.date_range(a,b): coverage.append([source,day.date(),'missing','request failed or cached response unavailable/invalid'])
        combined=merge(base,pd.concat(extras,ignore_index=True) if extras else base.iloc[:0])
        table=pa.Table.from_pandas(combined,preserve_index=False)
        metadata=dict(table.schema.metadata or {})
        metadata[b'aoi_notice']=NOTICE.encode()
        metadata[b'request_bounds']=BOX.encode()
        metadata[b'detection_bounds']=json.dumps([float(combined.longitude.min()),float(combined.latitude.min()),float(combined.longitude.max()),float(combined.latitude.max())]).encode()
        pq.write_table(table.replace_schema_metadata(metadata),path)
        for (month,status),group in combined.groupby([combined.acq_date.dt.strftime('%Y-%m'),'type_status']):
            monthly.append([name,month,status,len(group),bool(group.provisional.any()),NOTICE])
    pd.DataFrame(coverage,columns=['product','date','status','note']).assign(aoi_notice=NOTICE).to_csv(ROOT/'docs/NRT_COVERAGE.csv',index=False)
    report=pd.DataFrame(monthly,columns=['satellite','month','type_status','detections','provisional','aoi_notice'])
    report.to_csv(ROOT/'docs/NRT_MONTHLY.csv',index=False)
    print(report[report.month.ge('2026-08')].drop(columns='aoi_notice').to_string(index=False))
    print(pd.DataFrame(coverage,columns=['product','date','status','note']).to_string(index=False))

if __name__=='__main__':
    main()
