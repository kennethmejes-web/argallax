# FIRMS data inventory

Step 4 inventory of the supplied Philippine bounding-box downloads. Counts are detections, not fires or burned area. No quality, type, land, confidence or harmonization filters were applied. Dates below are the first and last **detections**, not proof of continuous satellite coverage.

| Satellite | Unique detections | First–last detection | Day / night | Type 0 / known type |
| --- | ---: | --- | ---: | ---: |
| Aqua MODIS | 87,919 | 2002-07-05–2026-11-06 | 85,033 / 2,886 | 82,880 / 87,773 (94.4%) |
| S-NPP VIIRS | 462,349 | 2012-01-20–2026-11-02 | 391,691 / 70,658 | 443,156 / 459,570 (96.4%) |
| NOAA-20 VIIRS | 250,823 | 2018-04-01–2026-11-06 | 205,634 / 45,189 | 234,584 / 247,862 (94.6%) |
| Terra MODIS (separate) | 44,763 | 2002-07-05–2026-11-05 | 37,508 / 7,255 | 37,616 / 44,659 (84.2%) |

[Annual details](DATA_ANNUAL.csv) give each satellite and year's detections, type-0 numerator and known-type denominator, exact confidence distribution, day/night counts, and first and last detection. MODIS confidence is numeric; VIIRS uses `l`, `n`, and `h`. NRT files have no `type` field: 146 Aqua, 2,779 S-NPP, 2,961 NOAA-20 and 104 Terra records have unknown type and are excluded from the type-0 denominator. NRT records remain identified by `data_status` and source.

The 2019 standalone archives exactly repeat records in the larger archives: 4,674 Aqua, 2,422 Terra, 44,311 S-NPP, and 44,580 NOAA-20 rows. Matching acquisition time, position and satellite had identical remaining fields; one copy was retained. [Source inventory](DATA_SOURCES.csv) lists each file's dates and row counts. The main archive files meet around June–July 2021; Aqua's earlier files have detections on 2012-01-18 and 2012-01-20, and its archive and NRT files have detections on 2026-08-30 and 2026-09-02. These are detection-date gaps, not confirmed missing-data periods. No coverage availability check was performed.

[Monthly breakdown](DATA_MONTHLY.csv) contains every month in 2012–2021 for Aqua and S-NPP, with the whole supplied bounding box and four rough, mutually exclusive latitude bands: North Luzon ≥16°N; South Luzon 12.5–<16°N; Visayas 9.5–<12.5°N; Mindanao <9.5°N. These are screening bins, not island or administrative boundaries; water and other land within the downloaded box remain included. Zero means no rows in the supplied files, not proof of no fire or complete coverage. S-NPP's first supplied detection is on 2012-01-20. Run `python pipeline/load_firms.py` in the project environment to rebuild the tables and inventories.
