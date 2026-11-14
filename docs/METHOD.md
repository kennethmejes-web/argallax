# Method and limitations

*Counts cover a rectangular screening area around the Philippines, not the national land boundary.*

## What is counted
ARGALLAX counts **daytime grid-cell-days**: a 0.25° grid cell on one UTC day counts once if it has at least one qualifying hotspot detection, however many detections it holds. Detections come from the NASA FIRMS archive (type 0 only): Aqua MODIS Collection 6.1 at confidence ≥ 30, and VIIRS at any confidence except low. Hotspot detections are not fire counts or burned area, and a month with no detections does not mean there was no fire.

## One satellite at a time, on one scale
The record never adds satellites together. It uses Aqua MODIS before 2012, converted to **estimated VIIRS-equivalent** values; S-NPP VIIRS from 2012; and NOAA-20 VIIRS as the continuation of S-NPP. Aqua records about 6 times fewer cell-days than S-NPP. The conversion uses eight ratios, one for each of four latitude bands (North Luzon, South Luzon, Visayas, Mindanao) in each of two seasons (dry: February–May; rest: June–January), fitted on 2012–2017.

## How it was tested
The ratios were fitted on 2012–2017, the method was chosen on 2018–2019, and the result was tested on 18 months not used for fitting or method selection (January 2020 – June 2021).
- On those months, scaling Aqua to the S-NPP scale cut the difference from S-NPP in regional monthly totals from 85% to 16% of the total. The whole-area total came out 4% low; unscaled Aqua was 85% low.
- The test design, periods, scoring and success rule were written before any model was fitted. The method-selection rule was changed after the 2018–2019 selection scores were seen and before the final test; under the original rule, no correction would have been selected. Both outcomes are in the record.
- The test does not show that eight ratios are better than one.
- All agreement is with S-NPP VIIRS detections, not with true fire activity.

## Uncertainty
Whole-area intervals are nominal 80%: 13 of 18 test months fell inside. Regional intervals covered 67% of test months. For values before 2012, the interval reflects month-to-month scatter in 2018–2019 only; it does not include any long-term change in the Aqua–VIIRS relation.

## Unusual months
A month is flagged as above or below its historical reference range when it falls outside the 10th–90th percentile of the same calendar month in other years. This range is descriptive: it is not a prediction or a significance test.

## Limitations
- **Small areas.** The improvement is for regional and whole-area totals. For single 0.25° cells the scaled record was no closer to S-NPP than raw Aqua. No minimum area size is validated.
- **Before 2012.** Values are estimated VIIRS-equivalent. They assume the 2012–2017 Aqua-to-VIIRS relation held from 2002; this cannot be tested, because no VIIRS data exists before 2012.
- **After mid-2021.** The Aqua-to-S-NPP relation was noisier (regional monthly difference 23–33%); the cause cannot be separated between Aqua's orbit drift, S-NPP ageing and real change.
- **NOAA-20.** It passed its preregistered tolerance as a continuation of S-NPP for whole-area totals in 2022 – July 2026, reading about 4% higher (1–7% by year), so the record steps up by about 4% where it moves to NOAA-20. It was not checked by region or season in the preregistered test. An exploratory breakdown (not preregistered, not corrected for) found NOAA-20 reading 1–6% higher by region and 8–11% higher in June–January. It cannot be checked after S-NPP ended on 2 November 2026.
- **Recent months.** Recent months (from August 2026) use near-real-time NOAA-20 data. They are provisional, their source type is not verified, and they may include non-vegetation heat sources. Science-quality data replaces them after about five months.
- **Clouds.** Hotspot counts depend on whether the satellite could see the ground. A cloudy month can show fewer detections without less burning; this is not corrected.

## Example: the 2012 satellite switch
A record that switches from Aqua to S-NPP in 2012 shows a 5.2-fold jump in yearly totals. Aqua's own record shows no rise across the same periods, so the jump is a sensor artifact. This says nothing about whether actual burning changed.

## What this record cannot tell you
It cannot say whether burning rose, fell or stayed the same, and nothing in it was validated against fires, burned area or ground truth.

Data: NASA Fire Information for Resource Management System (FIRMS).
