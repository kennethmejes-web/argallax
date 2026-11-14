# ARGALLAX results summary

*Counts cover a rectangular screening area around the Philippines, not the national land boundary.* Unit: daytime grid-cell-days (0.25° cell × UTC day with ≥ 1 qualifying detection), NASA FIRMS archive, type 0 only, Aqua MODIS C6.1 confidence ≥ 30, VIIRS confidence ≠ low. Hotspot detections are not fire counts or burned area. All agreement below is agreement with **S-NPP VIIRS daytime cell-days**, not with true fire activity; "error" below always means difference from S-NPP. AI-assisted; numbers are copied from the result files named in each section. Wording revised after the independent review (`analysis/SCIENCE_REVIEW.md`); no number, method or result was changed.

## 1. Periods and timeline (git evidence)

| Item | Value |
|---|---|
| Fit | 2012-02 – 2017-12 (first full S-NPP month read from data) |
| Selection | 2018-01 – 2019-12 |
| Final test, run once | 2020-01 – 2021-06 |
| Drift check | 2021-07 – 2026-07 |
| Bridge (S-NPP → NOAA-20) | fit 2018-04 – 2021-12; test 2022-01 – 2026-07 |

| Commit | Time (PHT) | What |
|---|---|---|
| `b98473e` | 14 Nov 16:32:50 | Preregistration written before any fit or score |
| `e12acc2` | 14 Nov 16:46:25 | Amendment 3, last pre-fit amendment |
| `c1c0694` | 14 Nov 17:21:51 | **Freeze:** method (c), parameters, intervals, final-test code; Amendment 4 (post-hoc, see §3) |
| `58163d5` | 14 Nov 17:24:33 | **Final test** result, run once (`analysis/results/final_test.json`). The result file records that code, parameters and preregistration matched the freeze commit; the code refuses to run on uncommitted files or twice. A single run is supported by this, not provable |

No method, parameter or interval was changed after `c1c0694`.

Commit references point to the project's private development repository, available to organizers on request.

## 2. Selection (2018–2019) — `analysis/results/frozen_method.json`

Sample-size check: all 8 region × season strata ≥ 200 cell-days for both sensors in the fit period; no merging.

| Method | S1 region-month error | S2 cell-month error | S3 seasonality | Bias ΣV̂/ΣV |
|---|---|---|---|---|
| (a) no correction | 0.845 | 0.857 | 0.975 | 0.16 |
| (b) single ratio 6.38 | 0.186 | 0.941 | 0.975 | 0.99 |
| (c) ratio per season × region | 0.160 | 0.958 | 0.964 | 1.00 |

## 3. Selection rule as applied, and Amendment 4

- **Original preregistered rule → (a) no correction.** (b) and (c) were each vetoed only by "S2 must not rise".
- **Amendment 4 (post-hoc, made after the selection scores were seen, before any final-test outcome was computed):** S2 is reported but no longer a veto. Rule then applied unchanged: (b) replaces (a); (c) replaces (b) (S1 −14%, S3 within 0.05). **Selected: (c).** Decision by Kenneth Mejes after an independent review and an exploratory diagnostic (`analysis/results/diagnostic_s2.json`, 2012–2019 data only).
- Reason: S2 measures placement in single 0.25° cells; raw Aqua wins it while recording about 6 times fewer cell-days than S-NPP. At 0.5° and coarser, (b)/(c) cut error sharply (0.5°: 0.85 → 0.66/0.67; 1°: 0.85 → 0.46/0.46).
- Evidence for (c) over (b) was modest (S1 gain about 3% in 2018, 23% in 2019).

Frozen ratios (S-NPP cell-days per Aqua cell-day, fit period): North Luzon dry 5.41 / rest 7.59; South Luzon 6.50 / 5.90; Visayas 6.48 / 8.03; Mindanao 5.84 / 9.12 (dry = Feb–May, rest = Jun–Jan).

## 4. Final test, run once (Jan 2020 – Jun 2021) — `analysis/results/final_test.json`

| | (c) frozen | (a) no correction = original rule's choice |
|---|---|---|
| S1 region-month error | **0.164** | 0.846 |
| S2 cell-month error | 0.890 | **0.857** |
| S3 seasonality (median Spearman) | 0.952 | 0.952 |
| Bias ΣV̂/ΣV | 0.96 | 0.15 |

- **Success rule (frozen S1 < (a) S1): met.** Difference −0.682. Resampling the 18 test months gives a 90% range of −0.725 to −0.604 (month-block bootstrap, 2,000 resamples, seed 20261114). This treats months as independent, so the true uncertainty is wider; the gap is large enough that this does not change the conclusion.
- **What this does and does not show.** It shows that a fitted Aqua-to-VIIRS scaling puts regional monthly totals on the S-NPP scale. The success rule is a low bar: any ratio near 6 would pass it. Method (b) was not scored on the final test, so the test does not show that per-season, per-region ratios beat a single ratio.
- S1 is volume-weighted, so dry-season months dominate it. The typical region-month differed from S-NPP by about 20% (median absolute log ratio 0.195).
- Interval coverage: whole-AOI months **72% (13 of 18)**. The preregistered 70–90% rule allows the "80%" label, but it rests on 18 months, so it is shown as "nominal 80% interval; 13 of 18 test months fell inside". Region-months **67% (48 of 72)** → labeled "interval covered 67% of regional test months", not 80%. For pre-2012 values the interval reflects month-to-month scatter in 2018–2019 only; it does not include any long-term change in the Aqua–VIIRS relation.
- Weakest region for seasonal shape: Mindanao (S3 0.81 under both methods).
- Not improved: single 0.25° cells (S2 worse than raw). No area-size threshold is validated.

## 5. Aqua drift check (Jul 2021 – Jul 2026), descriptive — `analysis/results/postfreeze.json`

| Year | 2021 H2 | 2022 | 2023 | 2024 | 2025 | 2026 Jan–Jul |
|---|---|---|---|---|---|---|
| S1 | 0.33 | 0.27 | 0.28 | 0.23 | 0.28 | 0.23 |
| Bias | 1.02 | 0.88 | 0.99 | 0.98 | 0.94 | 1.00 |

The difference from S-NPP after mid-2021 (0.23–0.33) is higher than in the final test (0.16). The yearly whole-area total differed from S-NPP by 4% in the final test and by up to 12% afterwards (2022). In the fit years the whole-area ratio itself ranged 5.93–7.06 by year (`diagnostic_s2.json`), so stability of the ratio before 2012 is an assumption with mixed support. Aqua orbit drift, S-NPP ageing and real change are confounded; nothing was re-fitted.

## 6. S-NPP → NOAA-20 bridge — `analysis/results/postfreeze.json`

Fitted ρ = ΣV/ΣN = 0.974; |ln ρ| < ln 1.05, so ρ is set to 1 (NOAA-20 used as is). Test 2022-01 – 2026-07: pooled bias ΣŜ/ΣV = **1.044** (within 5%); every test year qualifies (both totals ≥ 800) and passes 0.90–1.10 (ΣV/ΣŜ: 2022 0.94, 2023 0.93, 2024 0.99, 2025 0.97, 2026 Jan–Jul 0.94); region-month S1 0.088. **Bridge: passed its preregistered tolerance for whole-area totals** (±5% pooled, ±10% per year). NOAA-20 reads higher than S-NPP in every test year (2022 +6.3%, 2023 +7.0%, 2024 +1.1%, 2025 +2.6%, 2026 Jan–Jul +6.5%; pooled +4.4%, close to the 5% limit), so the record steps up by about 4% where it moves to NOAA-20. **The bridge was checked for whole-area yearly totals only; offsets for smaller areas or single seasons are unknown.** Single 0.25° cells differ by 48% of the total between the two VIIRS instruments (S2 0.476), so the small-area warning applies to NOAA-20 months too. Behaviour after S-NPP ended (2 Nov 2026) cannot be tested.

## 7. Sensitivity: outage screen (not primary)

The screen can only remove months where the sensors disagree, so it can only favour agreement. Final test with Jun–Nov 2020 dropped: S1 0.140 (c) vs 0.842 (a). Drift check (17 months dropped): S1 0.237, bias 0.99. Bridge (7 months dropped): passes, bias 1.041. Conclusions unchanged.

## 8. Real example: the 2012 satellite switch — `analysis/results/example_stitched_annual.csv`, `chart_stitched_record.png`

A naive record that uses Aqua MODIS until S-NPP starts and S-NPP after shows annual daytime cell-days jumping from a 2003–2011 mean of **2,219** to a 2013–2021 mean of **11,588**: an apparent **5.2-fold increase**. Aqua alone, the same instrument across both periods, shows no rise: its 2013–2021 mean is **0.82×** its 2003–2011 mean (1,815 vs 2,219), which is within normal year-to-year variation (rough standard error ±0.12, treating years as independent). So the 5.2-fold jump in the naive record comes from switching sensors. With Aqua converted to estimated VIIRS-equivalent, the 2003–2011 mean is **14,071** and the jump disappears (2013–2021 is 0.82× the earlier level); the harmonized record removes it by construction, because the ratios were fitted on six of those nine later years, so that is a consistency check, not independent evidence. This says nothing about whether actual burning changed. Caveat: pre-2012 values assume the 2012–2017 ratios held earlier; that cannot be tested, because no VIIRS data exists before 2012.

## 9. Charts

- `analysis/results/chart_stitched_record.png`: naive vs harmonized annual record, 2003–2025.
- `analysis/results/chart_final_test.png`: final-test months, whole AOI, S-NPP vs harmonized and raw Aqua, with interval.
- `analysis/results/chart_bridge.png`: S-NPP vs NOAA-20 monthly, 2018–2026.

## 10. Claims we may make

- On 18 months not used for fitting or method selection, scaling Aqua to the S-NPP scale cut the difference from S-NPP in regional monthly totals from 85% to 16% of the total; the whole-area total came out 4% low, against 85% low unscaled.
- The scaling uses eight ratios (four latitude bands × two seasons). The test does not show that eight ratios are better than one.
- NOAA-20 passed its preregistered tolerance as a continuation of S-NPP for whole-area totals in 2022 – Jul 2026, reading about 4% higher (1–7% by year). It was not checked by region or season, and cannot be checked after S-NPP ended.
- The apparent 5-fold rise at the 2012 sensor switch is a sensor artifact: Aqua's own record shows no rise across the same periods.
- Always with: the selection rule was amended post-hoc, and under the original rule no correction would have been selected (both outcomes reported); improvement is for aggregates, not single cells; agreement is with S-NPP, not with true fire activity; region-level intervals covered 67%, not 80%; pre-2012 values assume the 2012–2017 relation held earlier.
- Not to be said: that burning rose, fell or stayed the same; that anything was validated against fires or burned area; that results are "statistically significant"; that cloud effects cancel between sensors; that zero means no fire. The full list of permitted claims is in `analysis/SCIENCE_REVIEW.md` §6.
