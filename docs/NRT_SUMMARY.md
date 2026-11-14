# Recent FIRMS data — Step 6a

Counts cover a rectangular screening area around the Philippines, not the national land boundary.

The FIRMS availability query on 2026-11-14 reported NOAA-20 NRT available for 2026-08-01–2026-11-14 and MODIS NRT for 2026-09-01–2026-11-14. The original ZIP downloads already contained NRT detections through November 6 for both sensors. Only November 7–14 was requested, in five-day and three-day requests per product, using the original request rectangle (116.9°E, 4.6°N, 126.6°E, 20.8°N). MODIS responses include Terra; only Aqua rows were appended.

| Month | NOAA-20 NRT detections | Aqua NRT detections |
| --- | ---: | ---: |
| 2026-08 | 1,248 | — (Aqua archive data retained) |
| 2026-09 | 1,018 | 105 |
| 2026-10 | 513 | 27 |
| 2026-11, through Nov 14 | 360 | 26 |

Newly downloaded: 178 NOAA-20 and 12 Aqua detections. All NRT values are **provisional — source type not verified; may include non-vegetation heat sources**. These are raw detection counts with no confidence or scientific filters applied; they must not be used as verified vegetation-fire counts. No fit, scoring, gridding, or harmonization was performed. November and the current UTC day are incomplete. No requested date was unavailable or failed; queried days without detections do not prove complete observation coverage.

[Monthly counts](NRT_MONTHLY.csv) keep verified, other-type and unknown-type rows separate; [daily request coverage](NRT_COVERAGE.csv) records missing or incomplete dates explicitly. These reports cover the two requested sensors. The original Step 4 inventories remain snapshots of the original ZIPs. S-NPP and Terra were not extended.

Raw responses and the availability snapshot are in ignored `data/raw/nrt/`; updated Aqua and NOAA-20 Parquet files remain in ignored `data/processed/`. Source filenames and products are retained. Archive rows win over NRT for the same satellite-date, and acquisition-time/position duplicates are removed. Parquet metadata includes the AOI notice and bounds. An offline rebuild matched the output tables exactly; type/provenance flags and archive precedence were checked.

To rebuild this snapshot from the original ZIPs plus saved responses: run `python pipeline/fetch_nrt.py --offline --through 2026-11-14`. Running the Step 4 loader alone restores only the original ZIP snapshot. To check newer availability and fetch subsequent dates, run `python pipeline/fetch_nrt.py`; `.env` supplies `FIRMS_MAP_KEY`.

API references: [FIRMS availability](https://firms.modaps.eosdis.nasa.gov/api/data_availability), [FIRMS area API and five-day limit](https://firms.modaps.eosdis.nasa.gov/api/area). Availability dates and acquisition dates use UTC; the default requested end date is today's date in Asia/Manila.
