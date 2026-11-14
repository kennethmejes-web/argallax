# ARGALLAX independent science review (Step 7b)

Process details not needed to assess the science were removed for this public copy; the full review is kept in the project's private archive.

Reviewer: independent AI-assisted review, 14 Nov 2026. The preregistration and Amendments 1–3 were written by the project's author; the analysis was built and run with AI assistance. The reviewer reran nothing, refitted nothing and did not open the final-test data. The reviewer read the saved result files, the code and the git history.

*Counts cover a rectangular screening area around the Philippines, not the national land boundary.* All agreement discussed here is agreement with S-NPP VIIRS daytime grid-cell-days, not with true fire activity.

## 1. Verdict

**No stop-ship problem. The central result stands, but it is narrower than the summary's wording in three places, and those must be fixed before anything is published.**

- The final test was isolated in every way I can check, and its result is too large to be explained by any leak I could imagine: scaled Aqua differs from S-NPP by 16% of the regional monthly total, raw Aqua by 85%.
- What the test shows is that **rescaling Aqua by a fitted ratio of about 6 puts regional monthly totals on the S-NPP scale**. It does **not** show that the season × region version, method (c), is better than a single ratio, method (b). Method (b) was never scored on the final test.
- The preregistered selection rule chose "no correction". Method (c) was chosen by a rule changed after the selection scores were seen. This is disclosed, and must stay attached to every claim.
- The 2012 example is sound as "the jump is a sensor artifact". It is not sound as "burning was somewhat lower afterwards".
- ARGALLAX produces a sensor-harmonized index of detection activity. Nothing in it identifies a physical fire quantity.

## 2. Stop-ship problems

None.

## 3. Problems that are not fatal, by severity

### Severity 1: fix before the app, slides or README quote any result

**1a. Method (c) is not shown to beat a single ratio on unseen data.**
Evidence: `final_test.json` holds scores for the frozen method and for (a) only. The success rule "frozen S1 < (a) S1" is a low bar, because any ratio near 6 passes it. In selection, (c) beat (b) by 0.160 vs 0.186, with a gain of 3% in 2018 and 23% in 2019.
Fix: describe the tested improvement as "a fitted Aqua-to-VIIRS scaling, applied per season and region". Never say the season × region structure was validated or "works better than one ratio". In `RESULTS_SUMMARY.md` §4 add: "Method (b) was not scored on the final test, so the test does not show that per-season, per-region ratios beat a single ratio." Scoring (b) on the test months now would be a second look at the test set. If the project author wants it, it must be labeled exploratory and post-hoc, and it changes nothing that ships.

**1b. The 2012 example overstates in two sentences (`RESULTS_SUMMARY.md` §8 and §10, third bullet).**
- "0.82 = 0.82" is true by construction. The harmonized 2003–2011 mean is Aqua times about 6.34; the 2013–2021 S-NPP/Aqua ratio is 6.39 (11,588 / 1,815); and the ratios were fitted on six of those nine years. The harmonized record therefore adds no evidence beyond Aqua's own record.
- "No jump, and somewhat lower" is not supported. Yearly totals swing widely (Aqua 2003–2011 ranges from 1,129 to 3,137). From the saved annual table, a rough standard error on the 0.82 ratio is ±0.12, treating years as independent. A value of 1.0 is well inside two standard errors.
- "Not the burning" asserts something about burning that detections cannot establish.

Fix, replacing the last three sentences of §8: "Aqua alone, the same instrument across both periods, shows no rise: its 2013–2021 mean is 0.82 times its 2003–2011 mean, which is within normal year-to-year variation (rough standard error ±0.12). So the 5.2-fold jump in the naive record comes from switching sensors. The harmonized record removes it by construction; that is a consistency check, not independent evidence. This says nothing about whether actual burning changed."
Fix, §10 third bullet: "The apparent 5-fold rise at the 2012 sensor switch is a sensor artifact: Aqua's own record shows no rise across the same periods."

**1c. The bridge is checked only for the whole area by year, and NOAA-20 runs consistently high.**
Evidence: `postfreeze.py` computes yearly ratios for the whole area only. NOAA-20 exceeds S-NPP in every test year (2022 +6.3%, 2023 +7.0%, 2024 +1.1%, 2025 +2.6%, 2026 +6.5%; pooled +4.4% against a 5% limit). Region-month difference is 8.8% of the total, and single-cell difference is 48% (`S2` 0.4757), even though the two instruments are near-identical.
Fix: (i) wherever the bridge is called validated, write "passed its preregistered tolerance for whole-area totals (±5% pooled, ±10% per year); NOAA-20 reads about 4% higher than S-NPP". (ii) The app's provenance band must state a step of about +4% where the record moves to NOAA-20. (iii) The small-area warning must also apply to NOAA-20 months. (iv) See question 4 for the exploratory check.

### Severity 2: fix in wording before submission

**2a. "On 18 months it never saw" (§10) and "unseen months" (final-test chart title).** The pipeline processed those months, and raw monthly counts for them sit in `docs/DATA_MONTHLY.csv`. Fix: "on 18 months not used for fitting or method selection".

**2b. "Run once" cannot be proved, only supported.** Evidence for it: one committed result, a guard in the code, and file hashes in `final_test.json` that equal the freeze commit's (I checked all three). A deleted earlier output would leave no trace. Fix: "run once; the result file records that code, parameters and preregistration matched the freeze commit".

**2c. Bootstrap wording.** See question 3.

**2d. Interval wording.** Whole-area coverage was 13 of 18 months; the "80%" label is allowed by the rule but rests on 18 months. Region-level coverage was 67%. Fix: "nominal 80% interval; 13 of 18 test months fell inside" for whole-area values, and "interval covered 67% of regional test months" elsewhere. For pre-2012 values add: "reflects month-to-month scatter in 2018–2019 only; it does not include any long-term change in the Aqua–VIIRS relation".

**2e. Ratio stability before 2012 is an assumption, and the evidence on stability is mixed.** Whole-area yearly ratios in the fit years ranged 5.93–7.06, single strata 4.29–12.04 (`diagnostic_s2.json`). After mid-2021 the regional monthly difference rose to 0.23–0.33 and one year (2022) was 12% low. Fix: keep the existing caveat and add "in checked years the yearly whole-area total differed from S-NPP by 4% in the final test and by up to 12% afterwards".

**2f. "Too low" and "error".** Amendment 4 says the uncorrected record is "about 6× too low", and the summary calls S1 "error". Both mean "relative to S-NPP". The preregistration is frozen and should not be edited; in the summary, app and pitch use "difference from S-NPP" and "about 6 times lower than S-NPP records".

### Severity 3: record, no schedule impact

**3a. `frozen_method.json` contains one inaccurate phrase:** "before any 2020+ data was read". Ingestion and gridding had read it; the same file's `final_test_isolation` note and Amendment 4 say so correctly. Do not edit the frozen file and do not quote that phrase.

**3b. The freeze guard checks three files, not `pipeline/` or the data tables.** Amendment 4 implies more. I checked separately: `pipeline/` has no changes since commit `cc96b6f`, and the data tables on disk are timestamped 17:00, before selection and freeze.

**3c. The selection stage ran from uncommitted code.** `experiment.py` first appears in the freeze commit, so git cannot prove what code produced the selection scores. Immaterial given the size of the effect.

**3d. Region cut points were not born in the preregistration.** See T2.

## 4. Answers to the seven questions

**1. Was the final test untouched before the freeze?** Yes, as far as it can be checked.
- Commit order: freeze `c1c0694` at 17:21:51, final test `58163d5` at 17:24:33. The reflog shows no amended or reset commits and there is one branch.
- The hashes stored in `final_test.json` for `experiment.py`, `frozen_method.json` and `PREREGISTRATION.md` equal those files in `c1c0694`, and none has changed since.
- In the committed code, the fit, selection and diagnostic load months only up to 2019-12, filtered at load with an assertion.
- Nothing from 2020–21 could have set a parameter: ratios come from 2012-02 to 2017-12, interval quantiles from 2018–2019.
- Seasons came from general knowledge and filters from the locked project decisions, both before any count. Region cut points predate the preregistration (T2).
- Not checkable: whether a person or an independent AI review looked at the 2020–21 rows of `DATA_MONTHLY.csv` before deciding Amendment 4. Even so, the choice between "scale by about 6" and "do not scale" is not something a glance at raw counts could tip unfairly; the gap is 0.16 against 0.85.

**2. Is S1 computed as defined?** Yes. `score()` sums cell-months to region-months, keeps region-months with A + V > 0, and returns Σ|V̂ − V| / ΣV. Region-months empty in both sensors are excluded and would add nothing anyway. In practice the rule never bound: all 72 test region-months and all 96 selection region-months had activity. S1 is volume-weighted, so dry-season months dominate it. The typical region-month is off by about 20% (median absolute log ratio 0.195).

**3. Is the bootstrap claim honest?** The number is computed as preregistered: whole months resampled, regions kept together, both methods scored on the same resample. It treats the 18 months as independent and covers about one and a half fire seasons, so the range is probably too narrow. Safe wording: "The difference was −0.68. Resampling the 18 test months gives a 90% range of −0.72 to −0.60. This treats months as independent, so the true uncertainty is wider; the gap is large enough that this does not change the conclusion." Do not say "statistically significant", "p-value" or "90% confidence".

**4. Could the +4.4% hide regional or seasonal offsets?** Yes. A region-month difference of 8.8% bounds the average, but a small stratum such as a wet-season band could be off by 20% without moving it. My ruling: before bridged values are shown for user-drawn areas, do **one** of these.
- Ship the label "bridge checked for whole-area yearly totals only; offsets for smaller areas or single seasons are unknown" on every NOAA-20 month.
- Or run one exploratory table, labeled exploratory and not preregistered: ΣV/ΣN for the 4 regions × 2 seasons over 2022-01 to 2026-07, with both totals. Decide the display rule before looking: any stratum with both totals ≥ 800 outside 0.90–1.10 is named in the method panel. It cannot change the whole-area pass or ρ.

The first option costs nothing and is sufficient to ship.

**5. How must T5 be stated?** App, method panel and any empty or low month: "No detections recorded. This does not mean nothing burned. Cloud, smoke and gaps between satellite passes hide fires, and this record cannot tell 'looked and saw nothing' from 'could not look'. Rainy-season months are affected most." Pitch: "We harmonize what the satellites recorded. We do not correct for what clouds hid." Never say cloud effects cancel between the sensors; that is untested. The larger rainy-season ratios in three of the four bands (7.6–9.1, against 5.4–6.5 in the dry peak; South Luzon is the exception at 5.9) may partly reflect this, and we cannot tell.

**6. Is any wording stronger than the evidence?** Yes: items 1a, 1b, 1c, 2a, 2b, 2d and 2f above. Amendment 4 itself is candid about timing and limits. Its one overreach is "known to be about 6× too low" (2f). Its statement that the count files "were not used" is testimony, not something I can verify.

**7. Index or physical quantity?** An index. It is the number of 0.25° cell-days with at least one qualifying daytime detection, expressed on the S-NPP scale. It is not a fire count, fire size, emissions or burned area. Two properties must be stated: a cell-day counts once however many fires it holds, so intense periods are compressed; and the ratio of about 6 belongs to this grid, unit and area, and is not a general MODIS-to-VIIRS factor. Wording that crosses the line: "not the burning" (§8), "too low", "error" used without "against S-NPP". The headline question may stay as a question. Its permitted answer is "the satellite changed", not "the burning did not".

## 5. Rulings on the testimony

| Item | Ruling | Basis |
|---|---|---|
| T1 | **Supported, with two limits.** | Load cut-off is in the committed code; order and hashes verified. "Ran once" is supported, not provable (2b). "Only exposure" omits that all-years totals also appear in `DATA_SUMMARY.md` and `GRID_CHECK.md`; none compares sensors by period. |
| T2 | **Partly inaccurate, immaterial.** | Fit window verified. Seasons and filters were fixed without counts. The region cut points (16°, 12.5°, 9.5°N) were written by an AI coding assistant in Step 4 (`pipeline/load_firms.py`), the same step that tabulated monthly counts through 2021; the plan named the four regions but not the cut points. Whether counts informed them is unknown. The preregistration adopted them without seeing counts. Round-number latitude bands cannot explain a 0.16 vs 0.85 result. |
| T3 | **Accurate.** | Verified in `stage_test`. Wording in question 3. |
| T4 | **Accurate.** | Verified in `bridge_eval`. Consequence in 1c and question 4. |
| T5 | **Accurate.** | Nothing in the data or code addresses observation gaps. Wording in question 5. |
| T6 | **Accurate, but the summary does not follow it.** | Full years, 2012 omitted and matched filters verified in `charts.py`. The summary's §10 presents the harmonized 0.82 as a second line of evidence, and §8 adds "somewhat lower" (1b). |

## 6. The exact claims we may make

Each claim carries the area sentence at the top of this file.

1. "On 18 months not used for fitting or method selection (Jan 2020 – Jun 2021), scaling Aqua MODIS to the S-NPP VIIRS scale cut the difference from S-NPP in regional monthly totals from 85% to 16% of the total. The whole-area total came out 4% low; unscaled Aqua was 85% low."
2. "The test design, periods, scoring and success rule were written before any model was fitted. The method-selection rule was changed after the 2018–2019 selection scores were seen and before the final test; under the original rule, no correction would have been selected. Both outcomes are in the record."
3. "The scaling uses eight ratios (four latitude bands × two seasons) fitted on 2012–2017. The test does not show that eight ratios are better than one."
4. "The improvement is for regional and whole-area totals. For single 0.25° cells the scaled record was no closer to S-NPP than raw Aqua. No minimum area size is validated."
5. "NOAA-20 passed its preregistered tolerance as a continuation of S-NPP for whole-area totals in 2022 – Jul 2026, reading about 4% higher (1–7% by year). It was not checked by region or season, and cannot be checked after S-NPP ended."
6. "A record that switches from Aqua to S-NPP in 2012 shows a 5.2-fold jump in yearly totals. Aqua's own record shows no rise across the same periods, so the jump is a sensor artifact."
7. "Values before 2012 are estimated VIIRS-equivalent. They assume the 2012–2017 Aqua-to-VIIRS relation held from 2002; this cannot be tested."
8. "Whole-area intervals are nominal 80%; 13 of 18 test months fell inside. Regional intervals covered 67% of test months."
9. "After mid-2021 the Aqua-to-S-NPP relation was noisier (regional monthly difference 23–33%); the cause cannot be separated between Aqua's orbit drift, S-NPP ageing and real change."

We may **not** say: that burning rose, fell or stayed the same; that anything was validated against fires, burned area or ground truth; that the season × region method is proven better; that the test data were "never seen"; that results are "statistically significant"; that cloud effects cancel; that the bridge holds for small areas, single seasons or after 2 Nov 2026; or that zero means no fire.
