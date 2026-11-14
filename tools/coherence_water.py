"""
Step 3 of the Aral pipeline: raw NISAR L2 GUNW .h5  ->  coherence mosaics + water polygons per 12-day pair.

Open water decorrelates completely between passes 12 days apart (coherence ~0) whatever the wind;
desert, steppe and dry seabed stay coherent. So low coherence connected to the lake = water.

For every date pair in nisar_raw/gunw/ (frames 065 + 066):
  1. read unwrappedInterferogram/HH/coherenceMagnitude (80 m) and resample onto the 60 m aral_out grid
  2. average frames where they overlap  -> aral_out/coh_<ref>_<sec>.tif
  3. per basin: choose the coherence threshold that best separates a water box from land boxes,
     record that separation as a quality gate, keep low-coherence areas connected to the lake
  4. polygons + areas, also at threshold +/- 0.02 (sensitivity)
Outputs in water_polygons/coherence/:  <pair>_<basin>_lake_polygon.geojson, all_pairs_lake_polygons.geojson,
  coherence_water_area.csv, parameters.json

Usage: python3 tools/coherence_water.py   (from the 'aral sea' folder; re-run until it prints 'done' - finished pairs are cached).  Needs numpy, h5py, rasterio, scipy, shapely
"""
import os, re, glob, json, csv
import numpy as np
import h5py
import rasterio
from rasterio.transform import Affine
from rasterio.warp import reproject, Resampling, transform_geom
from rasterio.features import shapes
from rasterio.windows import from_bounds
from scipy.ndimage import median_filter, label, binary_fill_holes
from shapely.geometry import shape

SRC = 'nisar_raw/gunw'; OUT = 'water_polygons/coherence'; RASTERS = 'aral_out'
os.makedirs(OUT, exist_ok=True)
CACHE = os.path.join(RASTERS, 'coherence_cache')   # masks + per-pair cache (large, not committed)
os.makedirs(CACHE, exist_ok=True)
GATE = 0.90; DELTA = 0.02; MIN_PIXELS = 25; MAX_HOLE_KM2 = 50
BASINS = {
    'North': dict(region=lambda X, Y: Y > 5090e3, water=(735, 5145, 752, 5160), land=[(640, 5180, 680, 5200), (770, 5100, 800, 5120)]),
    'South_West': dict(region=lambda X, Y: (Y <= 5090e3) & (X > 598e3) & (X < 660e3), water=(609, 4960, 615, 4990), land=[(630, 4950, 650, 4990), (640, 5000, 660, 5040)]),
}

ref = sorted(glob.glob(os.path.join(RASTERS, '2026????_HH_dB.tif')))[0]
with rasterio.open(ref) as r:
    T, H, W, CRS = r.transform, r.height, r.width, r.crs
pix_ha = 60 * 60 / 1e4
cols, rows = np.meshgrid(np.arange(W), np.arange(H))
X = T.c + (cols + .5) * T.a; Y = T.f + (rows + .5) * T.e
REG = {b: c['region'](X, Y) for b, c in BASINS.items()}
del cols, rows, X, Y


def read_coh(path):
    with h5py.File(path, 'r') as h:
        g = h['science/LSAR/GUNW/grids/frequencyA/unwrappedInterferogram']
        c = g['HH/coherenceMagnitude'][:].astype('float32')
        x, y = g['xCoordinates'][:], g['yCoordinates'][:]
        epsg = 32640
        for cand in ('projection', '../projection'):
            try:
                p = g[cand]; epsg = int(p.attrs.get('epsg_code', p[()])); break
            except Exception:
                pass
    dx, dy = float(x[1] - x[0]), float(y[1] - y[0])
    c[~np.isfinite(c) | (c <= 0) | (c > 1)] = np.nan
    return c, Affine(dx, 0, float(x[0]) - dx / 2, 0, dy, float(y[0]) - dy / 2), epsg


def box(a, bx):
    w = from_bounds(bx[0]*1e3, bx[1]*1e3, bx[2]*1e3, bx[3]*1e3, T).round_offsets().round_lengths()
    v = a[int(w.row_off):int(w.row_off+w.height), int(w.col_off):int(w.col_off+w.width)]
    return v[np.isfinite(v)]


def pick(water, land):
    best = (0.0, None)
    for t in np.arange(0.05, 0.80, 0.01):
        ba = .5 * ((water <= t).mean() + (land > t).mean())
        if ba > best[0]: best = (float(ba), round(float(t), 2))
    return best


def lake(a, t, region, seed):
    m = (a <= t) & region
    lab, _ = label(m); sz = np.bincount(lab.ravel()); keep = sz >= MIN_PIXELS; keep[0] = False
    m = keep[lab]; lab, _ = label(m)
    w = from_bounds(seed[0]*1e3, seed[1]*1e3, seed[2]*1e3, seed[3]*1e3, T).round_offsets().round_lengths()
    ids = np.unique(lab[int(w.row_off):int(w.row_off+w.height), int(w.col_off):int(w.col_off+w.width)]); ids = ids[ids > 0]
    body = np.isin(lab, ids)
    holes = binary_fill_holes(body) & ~body
    hl, _ = label(holes); hs = np.bincount(hl.ravel()); small = hs < MAX_HOLE_KM2 * 100 / pix_ha; small[0] = False
    return body | small[hl]


def polys(mask, props):
    out = []
    for geom, _ in shapes(mask.astype('uint8'), mask=mask, transform=T, connectivity=4):
        p = shape(geom)
        out.append({'type': 'Feature', 'properties': dict(props, area_ha=round(p.area / 1e4, 2)),
                    'geometry': transform_geom(CRS, 'EPSG:4326', geom)})
    return out


pat = re.compile(r'_SH_(\d{8})T\d+_\d{8}T\d+_(\d{8})T')
pairs = {}
for f in sorted(glob.glob(os.path.join(SRC, '*.h5'))):
    m = pat.search(os.path.basename(f))
    if m and os.path.exists(f + '.done'):
        pairs.setdefault((m.group(1), m.group(2)), []).append(f)
print(len(pairs), 'pairs')

rows_out, allf = [], []
for (a_d, b_d), group in sorted(pairs.items()):
    tag = f'{a_d}_{b_d}'
    cache = os.path.join(CACHE, f'_pair_{tag}.json')       # finished pairs are skipped on re-runs
    if os.path.exists(cache):
        c = json.load(open(cache)); rows_out += c['rows']; allf += c['features']; continue
    pair_rows, pair_feats = [], []
    acc = np.zeros((H, W), 'float32'); n = np.zeros((H, W), 'uint8')
    for f in group:
        c, tr, epsg = read_coh(f)
        dst = np.full((H, W), np.nan, 'float32')
        reproject(c, dst, src_transform=tr, src_crs=f'EPSG:{epsg}', dst_transform=T, dst_crs=CRS,
                  resampling=Resampling.bilinear, src_nodata=np.nan, dst_nodata=np.nan)
        ok = np.isfinite(dst); acc[ok] += dst[ok]; n[ok] += 1
    coh = np.where(n > 0, acc / np.maximum(n, 1), np.nan).astype('float32')
    with rasterio.open(os.path.join(RASTERS, f'coh_{tag}.tif'), 'w', driver='GTiff', height=H, width=W, count=1,
                       dtype='float32', crs=CRS, transform=T, nodata=np.nan, compress='deflate', tiled=True) as d:
        d.write(coh, 1)
    valid = np.isfinite(coh)
    s = median_filter(np.where(valid, coh, 1.0), size=3)   # invalid = 1.0 so it never counts as water
    s[~valid] = np.nan
    for b, cfg in BASINS.items():
        wv = box(s, cfg['water']); lv = np.concatenate([box(s, x) for x in cfg['land']])
        if wv.size == 0 or lv.size == 0:
            print(tag, b, 'no coverage'); continue
        ba, t = pick(wv, lv); ok = ba >= GATE
        reg = REG[b] & valid
        res = {k: lake(s, tt, reg, cfg['water']) for k, tt in [('c', t), ('lo', t - DELTA), ('hi', t + DELTA)]}
        props = dict(pair=tag, ref_date=a_d, sec_date=b_d, basin=b, threshold=t, balanced_accuracy=round(ba, 3),
                     gate_pass=bool(ok), water_median_coh=round(float(np.median(wv)), 3), land_median_coh=round(float(np.median(lv)), 3))
        feats = polys(res['c'], props); pair_feats += feats
        json.dump({'type': 'FeatureCollection', 'features': feats}, open(os.path.join(OUT, f'{tag}_{b}_lake_polygon.geojson'), 'w'), separators=(',', ':'))
        row = dict(props, water_km2=float(round(res['c'].sum()*pix_ha/100, 1)),
                   km2_threshold_minus=float(round(res['lo'].sum()*pix_ha/100, 1)), km2_threshold_plus=float(round(res['hi'].sum()*pix_ha/100, 1)))
        pair_rows.append(row); print(row)
        np.save(os.path.join(CACHE, f'_mask_{tag}_{b}.npy'), np.packbits(res['c']))           # used by make_web_images.py
        np.save(os.path.join(CACHE, f'_uncertain_{tag}_{b}.npy'), np.packbits(res['lo'] != res['hi']))
    json.dump({'rows': pair_rows, 'features': pair_feats}, open(cache, 'w'))
    rows_out += pair_rows; allf += pair_feats
json.dump({'type': 'FeatureCollection', 'features': allf}, open(os.path.join(OUT, 'all_pairs_lake_polygons.geojson'), 'w'), separators=(',', ':'))
with open(os.path.join(OUT, 'coherence_water_area.csv'), 'w', newline='') as fh:
    w = csv.DictWriter(fh, list(rows_out[0])); w.writeheader(); w.writerows(rows_out)
json.dump(dict(product='NISAR L2 GUNW unwrappedInterferogram/HH/coherenceMagnitude (80 m) resampled bilinear to 60 m',
               filter='3x3 median', threshold='per pair and basin, maximises balanced accuracy of water vs land reference boxes',
               gate=GATE, sensitivity=DELTA, min_component_pixels=MIN_PIXELS, max_hole_km2=MAX_HOLE_KM2,
               basins={b: dict(water=c['water'], land=c['land']) for b, c in BASINS.items()},
               note='Coherence measures change over the 12-day interval: an area is water if it decorrelated over the whole pair.'),
          open(os.path.join(OUT, 'parameters.json'), 'w'), indent=2)
print('done')
