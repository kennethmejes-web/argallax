# ARGALLAX

ARGALLAX is a NASA Space Apps Challenge 2026 project: a monthly hotspot calendar for the Philippines, 2002–2026, with Aqua MODIS and S-NPP/NOAA-20 VIIRS records put on one tested scale.

- **Live site:** https://kennethmejes-web.github.io/argallax/
- **Results:** [analysis/RESULTS_SUMMARY.md](analysis/RESULTS_SUMMARY.md) · independent review: [analysis/SCIENCE_REVIEW.md](analysis/SCIENCE_REVIEW.md) · design: [analysis/PREREGISTRATION.md](analysis/PREREGISTRATION.md)
- Counts cover a rectangular screening area around the Philippines, not the national land boundary. Hotspot detections are not fire counts or burned area.

**Rebuild:** `python pipeline/build.py` (grid tables from `data/raw/`), then `python pipeline/export_app.py` (app data), then `cd app && npm ci && npm run build` (static site in `app/dist/`). Raw FIRMS archive downloads are not included; download the same products (MODIS C6.1, VIIRS 375 m S-NPP and NOAA-20) for the bounding box from FIRMS Archive Download.

ARGALLAX was created by Kenneth Mejes for Project Sidequest, a solo entry in NASA Space Apps Challenge 2026. Development was AI-assisted, with the project direction, scientific decisions, and final accountability held by the creator.

AI tools used: Claude (Anthropic); ChatGPT and Codex (OpenAI).

Some frozen documents mention internal planning files that are not part of this public release.

Data source: NASA Fire Information for Resource Management System (FIRMS), [NASA Earthdata FIRMS](https://www.earthdata.nasa.gov/data/tools/firms). See [NASA LANCE/FIRMS citation guidance](https://www.earthdata.nasa.gov/data/projects/lance#ed-firms-citation). Raw FIRMS downloads stay in `data/raw/` and are not committed.

Project code is licensed under [Apache-2.0](LICENSE).
