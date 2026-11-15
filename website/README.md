# Website: Tracing the Aral Sea

A static "field atlas" with no build step. You can serve the folder with any web server (for example `python3 -m http.server` then open http://localhost:8000). Opening `index.html` straight from disk also works, except the **Lab** plate. Browsers block reading image pixels from `file://`, so the Lab shows a note asking you to serve the folder.

The page is a run of numbered "plates". Each plate is something you can interact with:

| Plate | What it does | Script |
|---|---|---|
| 00 Hero | Time-lapse of the 9 North Aral radar passes, with an area counter and the −133 km² stamp | `hero.js` |
| 01 History | Drag-to-compare scrubber through 60 years of NASA/USGS images | `history.js` |
| 02 Radar | Scroll story: a sticky map changes layers as you read 7 steps | `story.js` |
| 03 Quiz | "Spot the water": guess 6 points on the windy 21 June image, then check against coherence | `quiz.js` |
| 04 Lab | Coherence threshold slider. Live flood fill from the lake seed and area in km², with our pipeline's cut-off marked | `lab.js` |
| 05 Check | Radar vs Sentinel-2 lens and swipe, with an agreement layer and F1 / area difference | `lens.js` |
| 06 North | 9-window small multiples, area chart with ±0.02 band, official figure and Sentinel-2 points, plus the ledger | `north.js`, `ledger.js` |
| 07 Evidence | Validation table, method, CSV, data downloads and references | `evidence.js` |

```
website/
├── index.html            page structure and text
├── css/styles.css        all styles (paper palette and fonts in :root)
├── js/
│   ├── utils.js          shared helpers (ARAL namespace, formatting, countTo, onVisible)
│   ├── data.js           ALL numbers and paths: passes, 9 windows, Sentinel-2 stats, timeline, ledger
│   ├── hero.js  history.js  story.js  quiz.js  lab.js  lens.js  north.js  ledger.js  evidence.js
│   └── nav.js            masthead plate highlight
├── data/
│   ├── water_boundaries.json      water outlines per window and basin (WGS84)
│   ├── coherence_water_area.csv   areas, thresholds, quality checks
│   ├── s2_validation.csv          radar vs Sentinel-2 agreement per window and basin
│   └── change_summary.json        lost / gained / persistent water, first vs last window
└── img/
    ├── radar/      {full,north}_<YYYYMMDD>.jpg     GCOV HH brightness, 9 passes
    ├── coherence/  {full,north}_<ref>_<sec>.jpg    GUNW coherence, 9 windows
    ├── water/      {full,north}_<ref>_<sec>.png    water outline overlays
    ├── classes/    <ref>_<sec>.png                 water + uncertain shoreline
    ├── change/     {full,north}_first_vs_last.png  water lost / gained / in both
    ├── lab/        north_coh_<pair>.png            8-bit coherence (value = 1 + 254×coh, 0 = no data) for the Lab
    ├── optical/    {full,north}_<date>.jpg         Sentinel-2 L2A previews (~320 m)
    ├── agree/      {full,north}_<pair>.png         both / radar only / optical only / no optical data
    └── history/    timeline images (NASA / USGS, public domain)
```

Scripts are plain scripts sharing `window.ARAL`, not ES modules. They load in the order listed in `index.html`.

Images are produced by `tools/make_web_images.py` (radar, coherence, water, change, lab) and `tools/sentinel2_validate.py` (optical, agree, s2_validation.csv). If you re-run the pipeline, update the numbers in `js/data.js`.

Fonts: Fraunces, Source Sans 3 and IBM Plex Mono (Google Fonts). Reduced-motion users get no auto-play or animation.
