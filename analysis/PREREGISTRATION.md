# ARGALLAX preregistration

Frozen 14 Nov 2026, before any candidate was fit or scored. Written from `CLAUDE.md` and `docs/DATA_SUMMARY.md` only; no monthly or per-region counts were inspected. Amended three times the same day before any fit or score, and a fourth time (Amendment 4) after the 2018–2019 selection scores were seen but before any final-test outcome was computed or inspected (see Amendments at the bottom). Later changes go in `docs/DECISIONS.md` with a reason. (AI-assisted: Claude Fable 5.2.)

## 1. Unit and filters

**Unit: grid-cell-day** = one (cell, UTC `acq_date`, sensor) with ≥ 1 qualifying detection. Monthly value = number of such cell-days in the UTC calendar month.

| Setting | Decision | Reason |
|---|---|---|
| Grid | 0.25°; cell = (floor(lat/0.25), floor(lon/0.25)) | Default confirmed: coarse enough to absorb the 1 km vs 375 m footprint difference. |
| Day/night | Counted separately by FIRMS `daynight`. **All fits, scores and the harmonized series are daytime (`D`) only.** Night is shown from 2012 as observed VIIRS, never back-estimated. | Aqua has 2,886 night detections in 24 years (3%): too few to fit a ratio. |
| Type | Archive rows: `type = 0` only. Rows without `type`: see §7. | Default confirmed. Dropping types 1–3 is the only volcano/static/offshore exclusion; **no land mask is applied** (§8). |
| Confidence | MODIS `confidence ≥ 30`; VIIRS `confidence ≠ l` | Defaults confirmed: both drop each product's documented low-confidence class and nothing else. |
| Duplicates | One copy per (satellite, acquisition time, position), as in the summary. | |
| Dates | Each sensor's first/last **full month** is derived from its first/last detection date in the data (a month is full if it lies wholly between them). | Never typed by hand. |
| Months used | **Primary results use all full months.** No month is dropped for suspected outages (see the sensitivity analysis in §4). | Amendment 1. |

Notation: A, V, N = daytime cell-days per cell-month for Aqua, S-NPP, NOAA-20. V̂ = predicted S-NPP. Region totals are sums over cells.

## 2. Methods, regions, sample-size threshold

- (a) V̂ = A. (b) V̂ = r·A, r = ΣV/ΣA over all fit cell-months. (c) V̂ = r_{g,s}·A, same ratio of sums within region g × season s. (d) runs only if fully specified in a committed addendum before the selection run.
- **Fit period:** first full S-NPP month through Dec 2017. Parameters are never refit after that.
- **Regions (by cell-centre latitude):** North Luzon ≥ 16°N; South Luzon 12.5–<16°N; Visayas 9.5–<12.5°N; Mindanao < 9.5°N. **Seasons:** dry peak Feb–May; rest Jun–Jan. These are screening bands, not island or administrative boundaries.
- **Threshold:** every stratum needs **≥ 200 Aqua and ≥ 200 S-NPP cell-days in the fit period** (≈ 7% relative noise on a ratio under Poisson counting). The summary gives no per-band counts, so this is checked mechanically as the first implementation step, using fit-period counts only. Failing strata are merged in this fixed order: (1) the region's two seasons; (2) the region with its neighbour (North+South Luzon, or Visayas+Mindanao). If fewer than two regions survive, the sample-size check **fails**: (c) is dropped and adding Southeast Asian neighbours becomes a logged `DECISIONS.md` question.

## 3. Scoring and selection (selection period: 2018–2019)

- **S1 (primary), region-month WAPE** = Σ|V̂−V| / ΣV over region-months with A+V > 0.
- **S2, cell-month WAPE**, same formula over cell-months with A+V > 0. Cell-months empty in both sensors are never scored.
- **S3, seasonality guard:** per region, Spearman correlation of monthly V̂ and V; report the median across regions. (It cannot separate (a) from (b); it guards against (c)/(d) distorting the seasonal shape.)
- Also reported, not used for selection: bias ΣV̂/ΣV and median |ln((V̂+1)/(V+1))| over region-months.

**Selection rule.** Order of complexity: a < b < c < d. Start from (a). A more complex method replaces the current choice only if it lowers S1 by ≥ 10% relative, does not raise S2, and does not lower S3 by more than 0.05. *(Amendment 4: S2 is no longer a veto; it is still computed and reported. The outcome under the original wording is reported beside the amended one.)* Ties go to the simpler method. The choice and its parameters are committed (hash recorded in the results file) before the final-test script is run.

## 4. Final test, intervals, drift check

- **Final test (Jan 2020 – Jun 2021), run once:** report S1, S2, S3 and bias for the frozen method and for (a). **Success = frozen S1 < (a)'s S1**, reported with a 90% interval on the difference from a month-block bootstrap (2,000 resamples, seed 20261114). If the frozen method is (a), the finding is "no tested correction beat no correction".
- **Failure:** reported as it is. Fallback (b) may ship labeled **not independently validated**; if (b) itself failed, pre-2012 values are shown as raw Aqua counts labeled "not harmonized".
- **Intervals:** residuals e = ln((V+1)/(V̂+1)) from selection-period region-months with A+V > 0, pooled. Interval = [(V̂+1)·exp(q₁₀)−1, (V̂+1)·exp(q₉₀)−1], floored at 0. The same is done at whole-AOI monthly level.
- **Coverage check:** share of final-test region-months (and AOI-months) with V inside. It is called an "80% interval" only if coverage is 70–90%; otherwise it is labeled with its measured coverage. No re-tuning after the test. User-drawn boxes use the region-month quantiles, labeled "approximate; not validated at this size".
- **Aqua orbit-drift check (Jul 2021 – last archive month):** frozen method, per-year S1 and bias. Descriptive only; it changes nothing.
- **Outage-screen sensitivity analysis (not primary):** the final test, coverage check, drift check and bridge test are each recomputed once after dropping any month in which either sensor of the pair has ≥ 5 consecutive UTC dates with zero raw rows in the AOI while the other has raw rows on ≥ 3 of those dates. Fitted parameters, the selected method and the interval quantiles are not recomputed. The result is reported beside the primary result, labeled "sensitivity: outage screen", with the dropped months listed. **This screen can only remove months where the sensors disagree, so it can only favour agreement.** It never replaces the primary result and decides no pass, fail, selection or label.

## 5. S-NPP → NOAA-20 bridge

Daytime, same filters, archive type-0 rows only, months full for both sensors. Fit: first full NOAA-20 month – Dec 2021. Test, run once: Jan 2022 – last full archive month of both. Ŝ = ρ·N with ρ = ΣV/ΣN on the fit period; if |ln ρ| < ln 1.05, ρ is set to 1. **Pass requires both:** (i) test bias |ΣŜ/ΣV − 1| ≤ 5% over the whole test period, **and** (ii) ΣV/ΣŜ within 0.90–1.10 in **every** test year (each calendar year containing at least one test month, summed over that year's test months and the whole AOI) **that qualifies**. A test year qualifies only if **both** its ΣV and its ΣN (S-NPP and NOAA-20 daytime cell-days in that year's test months, whole AOI) are **≥ 800** (Amendment 3). Reason: if the two counts were independent Poisson, the ratio's relative noise would be ≈ √(2/n), which is 10% at n = 200 (as wide as the tolerance, so a perfect bridge would fail about one year in three by chance) and 5% at n = 800 (about one in twenty). The sensors see many of the same fires, so the true noise is probably smaller; 800 is the conservative choice. Years with either total below 800 are still reported with their ΣV, ΣN and ratio, labeled **"insufficient sample for the annual pass/fail criterion"**; they cannot pass or fail (ii), and their months still count in (i). **If no test year qualifies,** (ii) cannot be evaluated, the bridge cannot pass, and it is labeled **"not validated (annual stability untestable: insufficient sample)"** with the pooled bias from (i) still reported. The threshold is checked once, on test-period S-NPP and NOAA-20 counts only, and is not adjusted afterwards. S1, S2 and the per-year ratios ΣV/ΣŜ and ΣV/ΣN are reported either way. **If it fails,** the bridge is labeled **"not validated"** wherever bridged NOAA-20 values appear (app, CSV, figures, slides), the failure and its numbers are stated, and the record is still shown. ρ is not re-tuned after the test. Main series: Aqua (estimated VIIRS-equivalent) before the first full S-NPP month, S-NPP through its last full month, bridged NOAA-20 after. Satellites are never summed.

## 6. What each test shows

| Test | Shows | Does not show |
|---|---|---|
| Final test | Whether corrected Aqua tracks S-NPP daytime cell-days better than raw Aqua, in 18 unseen months | Agreement with true fire activity or burned area; validity before 2012, where no VIIRS exists and stability of the ratio is assumed |
| Coverage | Whether the interval width was right in the test months | Coverage for other periods, user boxes, or single cells |
| Drift check | Whether the Aqua–S-NPP relation moved after mid-2021 | Why it moved (Aqua drift, S-NPP ageing and real change are confounded) |
| Bridge | Whether NOAA-20 continues the S-NPP scale in 2022 onward, overall and in each year with enough data from both sensors | Behaviour after S-NPP ended; anything about absolute accuracy |

Zero Aqua cell-days always predict zero: fires only VIIRS can see are not recovered, only rescaled on average.

## 7. Rows with no `type` field (all NRT)

- Every row carries `data_status` ∈ {archive, nrt} and `type_status` ∈ {`type0_verified`, `other_type`, `type_unknown`}. A missing `type` is never filled, defaulted or inferred.
- Aggregates keep two columns, `n_verified` and `n_unverified` (confidence filter applied to both); they are never added into one column. Where an archive row and an NRT row cover the same sensor-date, archive wins.
- `type_unknown` rows are excluded from every fit, score, interval, bridge calculation and historical median.
- In the app and CSV they appear only in months without archive data, labeled **"provisional — source type not verified; may include non-vegetation heat sources"**, drawn distinctly. Any comparison with the historical median carries the same label.

## 8. Geographic definition

The downloaded rectangle is a **screening area of interest (AOI), not a Philippine land boundary**. It includes sea and may include land of other countries; the four regions are latitude bands of that rectangle. Its bounds are read from the data and written to every output's metadata. Every result file, figure, CSV header, slide and the app's method panel carries this sentence: *"Counts cover a rectangular screening area around the Philippines, not the national land boundary."* "Zero" always means no qualifying detections in the supplied files, never "no fire".

## Amendments

### Amendment 1 — 2026-11-14 16:39 PHT

Made before any model was fitted or scored and before any monthly or per-region counts were inspected.

1. **Outage screen moved from the primary analysis to a labeled sensitivity analysis (§1, §4).** Reason: the screen drops a month only when one sensor has rows and the other does not, so it selects on the very disagreement the tests measure and can only make agreement look better. Primary results now use all full months.
2. **Bridge pass rule tightened and its failure consequence fixed (§5).** Pass now also requires every test year's ΣV/ΣŜ to lie within 0.90–1.10. Reason: a pooled bias within 5% can hide opposite-signed yearly errors or a drift late in S-NPP's life, which is exactly when the bridge matters. On failure the bridge is labeled "not validated" and the record is still shown with the failure stated, so the outcome is decided before the result is seen.

### Amendment 2 — 2026-11-14 16:43 PHT

Made before any model was fitted or scored and before any monthly, annual or per-region counts were inspected. Amendment 1 and every other frozen rule stand unchanged.

1. **Timezone label corrected.** Amendment 1's timestamp read "16:39 PST". The clock time was already Philippine local time (UTC+8; the commit is stamped 16:39:56 +0800); only the abbreviation was ambiguous, because "PST" is also read as US Pacific time. It now reads "PHT". No clock time was changed.
2. **Minimum annual sample for the bridge's per-year criterion (§5).** A test year counts towards criterion (ii) only if its S-NPP daytime cell-days total ≥ 800. Reason: Amendment 1 set a ±10% yearly tolerance without a sample floor, so a short or sparse year (for example a final year with few archive months) could pass or fail on counting noise alone. 200 was considered and rejected: under independent Poisson counting its ratio noise (≈ 10%) equals the tolerance. Years below 800 are reported and labeled insufficient rather than dropped silently. If no year qualifies, the bridge cannot pass and is labeled "not validated (annual stability untestable: insufficient sample)", so a missing test is never read as a passed one.

### Amendment 3 — 2026-11-14 16:46 PHT

Made before any model was fitted or scored and before any monthly, annual or per-region counts were inspected. Amendments 1 and 2 and every other frozen rule stand unchanged, apart from the one change below.

1. **Both sensors must meet the annual sample floor (§5).** A bridge test year qualifies for the per-year check only if ΣV ≥ 800 **and** ΣN ≥ 800 daytime cell-days. Reason: the per-year ratio ΣV/ΣŜ is built from both counts, and the ≈ √(2/n) noise argument behind the 800 floor assumes both are at least n. Amendment 2 checked only S-NPP, so a year with a sparse NOAA-20 total could still be judged on a noisy ratio.

Known limitation, stated in advance: a year in which S-NPP is ≥ 800 but NOAA-20 is < 800 is labeled insufficient rather than failed, although such a gap could itself be a real NOAA-20 shortfall. That year's ΣV, ΣN and ratio are therefore always reported, and its months still count in the pooled bias criterion (i), which a large shortfall would move.

### Amendment 4 — 2026-11-14 17:20 PHT (post-hoc: made after the 2018–2019 selection scores were seen)

**Timing, stated plainly.** This amendment was made **after** methods (a)–(c) were fitted on 2012-02 – 2017-12 and scored on 2018–2019, and **before** any final-test outcome (2020-01 – 2021-06) was computed or inspected. It is therefore not preregistered in the strict sense, and it is reported as a post-hoc change.

**What "before the final test" does and does not mean.**
- *Processed, not used for outcomes:* the general ingestion and gridding steps (`pipeline/load_firms.py`, `fetch_nrt.py`, `grid.py`; Steps 4, 6a, 6b) read and gridded every year in the files, including 2020–2021, to clean, deduplicate and build tables. Their checks were row counts, date ranges, duplicate and consistency tests over all years; none compared sensors, computed a ratio or scored anything for any period.
- *Descriptive counts that include the test period:* Step 4 wrote `docs/DATA_MONTHLY.csv` (raw, unfiltered detection counts per month and latitude band for Aqua and S-NPP, 2012–2021) and `docs/DATA_ANNUAL.csv` (detections per sensor and year). These cover the final-test months. The preregistration was written without inspecting monthly counts, and the agent that ran the selection and the diagnostic did not open either file. It is not verified whether they were viewed by a person or by ChatGPT at the Step 4 data-quality checkpoint. They were not used in fitting, diagnostics, selection or tuning.
- *Not used:* the fit, the selection scoring and the diagnostic load only months ≤ 2019-12 (enforced in code); no final-test score, residual, ratio or interval coverage has been computed.

1. **S2 removed as a selection veto (§3).** S1 and S3 conditions, the 10% threshold, the complexity order and every other rule are unchanged. S2 is still computed and reported for every method and period.
2. **Both outcomes are kept in the record.** Under the original rule the selected method is **(a) no correction** (b and c were vetoed by S2 alone). Under the amended rule the selected method is **(c) ratio per season × region** (b replaces a; c replaces b). Both appear in `analysis/results/frozen_method.json`.
3. **Reason.** S2 (cell-month absolute error) is a valid measure, but of a different objective: placing activity in individual 0.25° cells. Selection-period scores and an exploratory diagnostic (`analysis/diagnostic_s2.py`, `analysis/results/diagnostic_s2.json`, 2012–2019 data only) show that raw Aqua scores best on S2 while undercounting S-NPP about 6-fold overall (bias 0.16), because in 69% of scored cell-months Aqua has no detection and every method predicts zero; a rescaling cannot restore locations MODIS missed and overshoots in some cells where it did detect. The project's stated aim is consistent monthly records for regions and user-selected areas, where (b) and (c) cut error substantially (region-month S1 0.84 → 0.19 / 0.16; 0.5°-block error 0.85 → 0.66 / 0.67; 1°-block 0.85 → 0.46 / 0.46). Keeping the veto would ship a record known to be about 6× too low for every area.
4. **Limitation recorded with the amendment.** The correction is **not** shown to improve accuracy for individual 0.25° cells; in 2018–2019 it was worse there. Improvement was seen only for aggregates (0.5° and larger in the exploratory diagnostic; regions in S1). No area-size threshold is validated: the app will warn for boxes smaller than about 0.5° × 0.5°, and this warning is exploratory, not a guarantee that larger boxes are accurate. Claims are limited to aggregate comparability with S-NPP daytime cell-days.
5. **Evidence for (c) over (b) is modest.** (c)'s S1 gain over (b) was about 3% in 2018 and 23% in 2019. It is selected because the unchanged rule selects it, not by judgement; the final test decides whether it generalizes.
6. **What is frozen with this amendment:** the selected method, its eight fitted ratios, the strata mapping and region/season definitions, the interval quantiles, the processing code (`pipeline/`), and the experiment code including the not-yet-run final-test stage (`analysis/experiment.py`). The final test runs once; the script refuses to run if these files differ from the committed versions or if a final-test result already exists. Nothing is re-tuned after it.

