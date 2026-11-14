# Decisions

## 2026-11-14 16:39 PHT — Preregistration Amendment 1 (before any fit or score)

- **Outage screen is no longer part of the primary analysis.** Primary results use all full months. The screen (≥ 5 consecutive zero-row dates for one sensor while the other has rows on ≥ 3 of them) is kept only as a labeled sensitivity analysis reported beside the primary result. **Reason:** it can only remove months where the sensors disagree, so using it in the primary analysis would bias every agreement score upward.
- **Bridge pass rule changed.** Pass requires |bias − 1| ≤ 5% **and** every test year's ΣV/ΣŜ within 0.90–1.10. If it fails, the bridge is labeled "not validated" and the record is still shown, with the failure stated. **Reason:** a pooled bias can hide offsetting or drifting yearly errors, and the consequence of failure had not been fixed in advance.

Neither change alters a locked project decision. Details: `analysis/PREREGISTRATION.md`, Amendments.

## 2026-11-14 16:43 PHT — Preregistration Amendment 2 (before any fit or score)

- **Timezone label corrected from "PST" to "PHT"** on the Amendment 1 timestamps here and in the preregistration. The clock times were already Philippine local time (UTC+8) and are unchanged. **Reason:** "PST" is ambiguous with US Pacific time.
- **Bridge test: minimum annual S-NPP sample of 800 daytime grid-cell-days** for a test year to count in the per-year pass/fail criterion. Years below it are still reported, labeled "insufficient sample for the annual pass/fail criterion". If no year qualifies, the bridge cannot pass and is labeled "not validated (annual stability untestable: insufficient sample)"; the pooled bias is still reported. **Reason:** the ±10% yearly tolerance had no sample floor, so a sparse year could pass or fail by chance. 200 was considered, but under independent Poisson counting its ratio noise (≈ √(2/200) = 10%) is as wide as the tolerance; 800 brings it to about 5%.

Amendment 1 and all other frozen rules are unchanged. Neither change alters a locked project decision. Nothing was fitted, scored or inspected.

## 2026-11-14 16:46 PHT — Preregistration Amendment 3 (before any fit or score)

- **Bridge test: the annual sample floor now applies to both sensors.** A test year qualifies for the per-year pass/fail check only if both its S-NPP total (ΣV) and its NOAA-20 total (ΣN) are ≥ 800 daytime grid-cell-days. Everything else in Amendment 2 stands: years that do not qualify are still reported and labeled insufficient, and if no year qualifies the bridge cannot pass. **Reason:** the per-year ratio uses both counts, and the noise argument for 800 assumes both reach it; Amendment 2 checked only S-NPP.
- **Known limitation:** a year with enough S-NPP but too little NOAA-20 data is labeled insufficient, not failed, even though the gap could be a real NOAA-20 shortfall. Its totals and ratio are always reported, and its months still count in the pooled bias check.

No locked project decision is altered. Nothing was fitted, scored or inspected.

## 2026-11-14 17:20 PHT — Preregistration Amendment 4 (post-hoc: after 2018–2019 selection scores, before any final-test outcome)

- **S2 (cell-month error) is no longer a selection veto; it is still reported.** Original rule → **(a) no correction**. Amended rule → **(c) ratio per season × region**. Both outcomes are kept in `analysis/results/frozen_method.json`.
- **Reason:** S2 is a valid cell-level measure, but cell-level placement and regional/area aggregate comparability are different objectives. Raw Aqua wins S2 while undercounting S-NPP about 6-fold; (b)/(c) cut region-month error from 0.84 to 0.19/0.16 and 0.5°–1° block error substantially (exploratory diagnostic, 2012–2019 data only).
- **Limitation:** no improvement is shown for single 0.25° cells. The app warns for boxes smaller than ~0.5°; that threshold is exploratory, not validated.
- **Decision by Kenneth Mejes**, after an independent review and the diagnostic. No final-test outcome (Jan 2020 – Jun 2021) had been computed or inspected. Those months were processed by the general ingestion and gridding steps, and appear in the Step 4 descriptive detection-count files (`DATA_MONTHLY.csv`, `DATA_ANNUAL.csv`); they were not used in fitting, diagnostics, selection or tuning. Details: preregistration, Amendment 4. It runs once, on the frozen choice, and is reported whatever it shows.

This changes the scoring rule in the preregistration, which the locked project decisions say is fixed before candidates are run; this entry is the required record of that change.


## 2026-11-14 23:40 PHT — App data choices (Step 8)

- **Main-series switch to NOAA-20 at Aug 2026.** The main series uses S-NPP through its last full *archive* month (Jul 2026) and NOAA-20 from Aug 2026. **Reason:** after Jul 2026 both satellites have only provisional NRT data, and S-NPP ended on 2 Nov 2026; switching at the archive boundary avoids a second satellite change inside the provisional period. The preregistration's "S-NPP through its last full month" is read as last full archive month.
- **Partial current month.** Nov 2026 is compared on days 1–13 only; 14 Nov is excluded as incomplete (docs/NRT_COVERAGE.csv). Past Novembers are counted over the same days.
- **Intervals are applied only to the total of a selected area, never stored per cell or summed.** Whole area: nominal 80% (13 of 18 test months inside). The four regions: covered 67%. Any other box: the regional range, labeled "approximate; not validated at this size" (preregistration §4). Ranges apply only to Aqua-era months.
- **0.5° small-area warning** is an interface warning based on an exploratory diagnostic, not a validated accuracy boundary.
- **NOAA-20 seasonal excess (exploratory: 8–11% in June–January) is shown in the label and not corrected**; the preregistration forbids re-tuning the bridge, and its practical effect on single months was not tested.

## 2026-11-14 23:25 PHT — "Unusual month" rule for the app (decided by Kenneth Mejes)

- A month is flagged **above** or **below** its **historical reference range** when its value lies above the 90th or below the 10th percentile of the same calendar month in other years.
- Comparison is on the harmonized observation scale (the main series: estimated VIIRS-equivalent before Feb 2012, S-NPP, then NOAA-20). Reference years are complete months from other years; provisional and incomplete months are not used as references.
- A partial month is compared with the same elapsed days (days 1–N) of that month in other years.
- The band is labeled **"historical reference range"**. It is descriptive: not a prediction interval and not a significance test.
- Historical variability is shown separately from sensor-conversion uncertainty (the Aqua-era interval). Interval coverage is not presented as validated for arbitrary selected boxes.
- Set before the app displayed any flag.
