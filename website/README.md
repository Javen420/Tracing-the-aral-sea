# Website: Tracing the Aral Sea

A static site with no build step. Open `index.html` in a browser, or serve the folder with any web server (for example `python3 -m http.server`).

```
website/
├── index.html            page structure and text
├── css/styles.css        all styles (palette and fonts in :root at the top)
├── js/
│   ├── utils.js          shared helpers (ARAL namespace, date and km² formatting)
│   ├── data.js           ALL content and numbers: image paths, timeline, passes, 12-day windows, ledger
│   ├── timeline.js       Chapter 1: history timeline
│   ├── explorer.js       radar explorer: brightness/coherence, fade/swipe, play
│   ├── present.js        Chapter 2: class toggles
│   ├── north.js          Chapter 3: window strip, map, change overlay, SVG chart
│   ├── ledger.js         Chapter 3: completed/reported/target/measured list
│   ├── downloads.js      measurements CSV and copy button
│   └── nav.js            top-bar chapter highlight
├── data/
│   ├── water_boundaries.json   water outlines, one MultiPolygon per window and basin (WGS84)
│   ├── coherence_water_area.csv   areas, thresholds, quality checks
│   └── change_summary.json        lost / gained / persistent water, first vs last window
└── img/
    ├── radar/       {full,north}_<YYYYMMDD>.jpg        GCOV HH brightness, 9 passes
    ├── coherence/   {full,north}_<ref>_<sec>.jpg       GUNW coherence, 9 windows
    ├── water/       {full,north}_<ref>_<sec>.png       water outline overlays
    ├── classes/     <ref>_<sec>.png                    water + uncertain shoreline
    ├── change/      {full,north}_first_vs_last.png     water lost / gained / in both
    ├── history/     timeline images (placeholders, see below)
    └── _legacy/     outputs from the first (brightness) method, not used by the site
```

Scripts load in the order listed in `index.html`. They are plain scripts sharing the `window.ARAL` object, not ES modules, so the site also works when opened straight from disk.

## History images

`img/history/` holds the timeline images, cropped or letterboxed to 1600×1000. The downloaded originals are in `img/history/originals/`.

All are NASA or NASA/USGS images (public domain), except the two marked "team", which are our own NISAR products. Each image's credit is shown under its timeline entry, from `credit` in `js/data.js`.

| File | Entry | Source |
|---|---|---|
| 1960s.jpg | Rivers diverted | KH-5 Argon 1964, Amu Darya delta crop (NASA SVS 10862) |
| 1964.jpg | 1964 Argon view | NASA SVS 10862 |
| 1977_1989_2006.jpg | Three decades | Landsat, NASA SVS 10862 |
| 1989_split.jpg | North/South split | MODIS 2000 and 2009, NASA SVS 10862 |
| 1992_dike.jpg | Berg's Strait dike | MODIS 25 Aug 2000 crop, NASA EO 84437 |
| 2000.jpg | South splits again | MODIS 25 Aug 2000, NASA EO 84437 |
| 2005.jpg | Kok-Aral Dam | MODIS 15 Apr 2005, NASA EO 7645 |
| 2007.jpg | North recovers | MODIS 14 Apr 2007, NASA EO 7645 |
| 2014.jpg | Eastern basin dries | MODIS 19 Aug 2014, NASA EO 84437 |
| 2025_nisar_launch.jpg | NISAR launches | NASA/JPL-Caltech PIA26613 |
| 2026_nisar.jpg | Phase two | team: NISAR GCOV HH, 19 Oct 2026 |
| 2026_analysis.jpg | Our analysis | team: coherence change, Jun vs Oct 2026 |

To swap an image, replace the file under the same name, or change `img` in `js/data.js`. If a file is missing, `placeholder.svg` is shown instead.

## Updating after re-running the pipeline

1. `python3 tools/coherence_water.py`, then `python3 tools/make_web_images.py`. This rewrites `img/`.
2. Copy the new numbers from `water_polygons/coherence/coherence_water_area.csv` into `WIN` in `js/data.js`.
3. Copy the new `change_summary.json` figures into the Chapter 3 cards in `index.html`.
