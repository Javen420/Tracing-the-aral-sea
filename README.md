# Tracing the Aral Sea — NISAR water mapping

NASA Space Apps 2026, "Dancing with the SARs". Maps open water in the North Aral and the South Aral western basin from NISAR L-band radar, June–October 2026, and presents it in an interactive website.

## Data

NISAR provisional products (P05023), track 107 descending, frames 065 / 066 / 067, from NASA Earthdata (ASF).

- **GCOV** (backscatter, HH + HV, 20 m): 9 dates, 21 Jun – 19 Oct 2026.
- **GUNW** (interferograms, coherence 80 m): 9 consecutive 12-day pairs, frames 065 + 066.

Large files are not in this repo. They live in a sibling folder, `../aral sea DATA/`, and are reached through three git-ignored symlinks:

- `nisar_raw` → raw .h5 files (~74 GB)
- `aral_out` → 60 m dB and coherence rasters, plus `coherence_cache/` (masks)
- `exports` → QGIS GeoTIFF exports

On a fresh clone, create that folder (or the three folders here) before running the pipeline. Run `./download_all_aral.sh` to fetch them. You need an Earthdata login in `~/.netrc`.

## Pipeline (run from this folder, in order)

| Step | Script | Output |
|---|---|---|
| 1 | `./download_all_aral.sh` | `nisar_raw/gcov/*.h5`, `nisar_raw/gunw/*.h5` (~74 GB, resumable) |
| 2 | `python3 tools/gcov_to_db.py` | `aral_out/<date>_HH_dB.tif`, `_HV_dB.tif`: 60 m, 3×3 linear-power average, frames stitched |
| 3 | `python3 tools/coherence_water.py` | `aral_out/coh_<pair>.tif`, `water_polygons/coherence/` (GeoJSON polygons, `coherence_water_area.csv`) |
| 4 | `python3 tools/make_web_images.py` | `website/img/` (radar, coherence, water outlines, change map) and `water_polygons/coherence/change_summary.json` |
| — | `tools/make_water_polygons.py` | First method (HH brightness thresholds), kept for comparison: `water_polygons/` |
| — | `tools/export_layers_to_tif.py` | QGIS Processing tool: export styled layers to GeoTIFF |

Python: numpy, h5py, rasterio, scipy, shapely, pillow, matplotlib.
QGIS project: `Aral Sea 3 month imagery.qgz`.

## Method

1. **Coherence** (GUNW `unwrappedInterferogram/HH/coherenceMagnitude`) is resampled to the 60 m grid and median-filtered 3×3.
2. **Threshold.** For each pair and basin, the threshold is the value that best separates a known-water reference box from known-land boxes.
3. **Quality gate.** A pair passes only if the reference boxes separate with balanced accuracy of at least 0.90. All 18 basin-pairs passed. With the first method (HH brightness), only 2 of 6 basin-dates passed, because wind makes water bright.
4. **Lake body.** Water is the low-coherence area connected to the lake reference box. Enclosed gaps under 50 km² are filled.
5. **Uncertainty.** Each area is also reported at threshold ±0.02.
6. **Change.** The first window (21 Jun–3 Jul) is compared with the last (7–19 Oct) pixel by pixel.

## Results (km²)

| Window | North Aral | South-west basin |
|---|---|---|
| 21 Jun – 3 Jul | 3,071 (3,055–3,081) | 1,772 (1,746–1,781) |
| 7 – 19 Oct | 2,939 (2,930–2,944) | 1,739 (1,736–1,741) |

- **North, June → October:** 133 km² lost (shallow margins), 0.5 km² gained.
- **Comparison:** the officially reported North Aral area is about 3,065 km².

## Limitations

- Not yet validated against optical imagery (Sentinel-2 / Landsat).
- A coherence window means water was present over 12 days, not on a single date.
- Four months cannot separate seasonal evaporation from management effects.
- Area is a poor proxy for water level in the steep-sided western basin.
- Wetlands and delta vegetation are not mapped yet.

## Website

Open `website/index.html` in a browser. It has three chapters:

1. **History:** a sourced timeline.
2. **Present environment:** the latest analysed coherence window.
3. **Northern replenishment:** 9 windows, area chart, change map, and an evidence ledger.

It also includes a radar explorer (brightness / coherence, fade / swipe) and a section on evidence strength.

Historical NASA images go in `website/img/history/`, named `1960s.jpg`, `1964.jpg`, `1973_1989_2000.jpg`, `2000.jpg`, `2005.jpg`, `2007.jpg` and `2014.jpg`.
