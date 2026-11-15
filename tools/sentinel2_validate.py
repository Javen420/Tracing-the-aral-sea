"""
Step 5 of the Aral pipeline: compare NISAR coherence water maps with Sentinel-2 optical water.

Inputs (in aral_out/ via the DATA folder):
  sentinel2/tiles/<date>_<tile>_{B11,SCL,L2A_PVI}.tif   Sentinel-2 L2A (Element84 Earth Search, AWS open data)
  sentinel2/raw/aral_s2_selection.json                  chosen scene per 12-day window and basin
  aral_out/coherence_cache/_mask_<pair>_<basin>.npy     NISAR water masks from coherence_water.py
Method (per window x basin):
  1. Sentinel-2 SWIR (B11, 1.6 um) surface reflectance = DN*1e-4 - 0.1. Water absorbs SWIR strongly; salt crust,
     sand and vegetation are bright. Clouds, shadows, saturated and no-data pixels are removed with the SCL layer.
  2. Average to the radar's 60 m grid; a cell is optical water if mean SWIR < threshold (Otsu over the basin,
     clamped 0.02-0.12) and >= 90% of the cell is cloud-free.
  3. Same clean-up as the radar: keep water connected to the lake reference box, fill enclosed gaps < 50 km2.
  4. Compare with the NISAR mask inside the basin region: F1, IoU, precision, recall, area difference, kappa.
     Sensitivity: fixed SWIR threshold 0.05, and the Sentinel-2 scene-classification water class.
Outputs:
  water_polygons/sentinel2/s2_validation.csv, s2_validation_summary.json, s2_water_<pair>_<basin>.geojson
  website/img/optical/{full,north}_<date>.jpg   Sentinel-2 true colour (preview product, ~320 m) on the web crops
  website/img/agree/{full,north}_<pair>.png     agreement map: both / radar only / optical only
Usage: python3 tools/sentinel2_validate.py   (re-run until 'done'; finished windows are cached)
"""
import os, json, glob, csv
import numpy as np
import rasterio
from rasterio.warp import reproject, Resampling, transform_geom
from rasterio.transform import Affine
from rasterio.features import shapes
from rasterio.windows import from_bounds
from scipy.ndimage import label, binary_fill_holes
from shapely.geometry import shape
from PIL import Image

S2 = 'aral_out/../sentinel2' if os.path.isdir('aral_out/../sentinel2') else '../aral sea DATA/sentinel2'
TILES = os.path.join(S2, 'tiles'); SEL = json.load(open(os.path.join(S2, 'raw', 'aral_s2_selection.json')))
CACHE = 'aral_out/coherence_cache'; OUTD = 'water_polygons/sentinel2'; WEB = 'website/img'
for d in [OUTD, CACHE + '/s2', WEB + '/optical', WEB + '/agree']: os.makedirs(d, exist_ok=True)

ref = sorted(glob.glob('aral_out/2026????_HH_dB.tif'))[0]
with rasterio.open(ref) as r: T, H, W, CRS = r.transform, r.height, r.width, r.crs
PIX_KM2 = 60 * 60 / 1e6
AREAS = {  # radar basin name, sub-grid bounds (m), region test, water seed box (km) -- same as coherence_water.py
    'N': dict(basin='North', bounds=(680e3, 5085e3, 836e3, 5197e3), region=lambda X, Y: Y > 5090e3, seed=(735, 5145, 752, 5160)),
    'S': dict(basin='South_West', bounds=(590e3, 4870e3, 666e3, 5095e3), region=lambda X, Y: (Y <= 5090e3) & (X > 598e3) & (X < 660e3), seed=(609, 4960, 615, 4990)),
}
CLOUDY = {0, 1, 8, 9, 10}   # no data, saturated, cloud medium/high, thin cirrus (cloud-shadow class 3 is kept: over the Aral it is mostly dark water)
MAX_HOLE_KM2 = 50; MIN_PIX = 25


def subgrid(bounds):
    c0 = int(np.floor((bounds[0] - T.c) / 60)); c1 = int(np.ceil((bounds[2] - T.c) / 60))
    r0 = int(np.floor((T.f - bounds[3]) / 60)); r1 = int(np.ceil((T.f - bounds[1]) / 60))
    c0, r0 = max(c0, 0), max(r0, 0); c1, r1 = min(c1, W), min(r1, H)
    return r0, r1, c0, c1, Affine(60, 0, T.c + c0 * 60, 0, -60, T.f - r0 * 60)


def to_grid(arr, src_tr, src_crs, shape_, dst_tr, method, nodata=np.nan):
    out = np.full(shape_, np.nan, 'float32')
    reproject(arr.astype('float32'), out, src_transform=src_tr, src_crs=src_crs, dst_transform=dst_tr, dst_crs=CRS,
              resampling=method, src_nodata=nodata, dst_nodata=np.nan)
    return out


def otsu(v, lo=0.0, hi=0.4, bins=200):
    h, e = np.histogram(v[(v > lo) & (v < hi)], bins=bins, range=(lo, hi)); c = (e[:-1] + e[1:]) / 2
    w0 = np.cumsum(h); w1 = w0[-1] - w0; m0 = np.cumsum(h * c) / np.maximum(w0, 1); m1 = (np.sum(h * c) - np.cumsum(h * c)) / np.maximum(w1, 1)
    return float(c[np.argmax(w0 * w1 * (m0 - m1) ** 2)])


def lake(mask, seed, tr):
    lab, _ = label(mask); sz = np.bincount(lab.ravel()); keep = sz >= MIN_PIX; keep[0] = False
    m = keep[lab]; lab, _ = label(m)
    w = from_bounds(seed[0] * 1e3, seed[1] * 1e3, seed[2] * 1e3, seed[3] * 1e3, tr).round_offsets().round_lengths()
    ids = np.unique(lab[int(w.row_off):int(w.row_off + w.height), int(w.col_off):int(w.col_off + w.width)]); ids = ids[ids > 0]
    if ids.size == 0:   # reference box clouded: fall back to the large water bodies
        sz2 = np.bincount(lab.ravel()); sz2[0] = 0; ids = np.where(sz2 >= 20000)[0]
    body = np.isin(lab, ids); holes = binary_fill_holes(body) & ~body
    hl, _ = label(holes); hs = np.bincount(hl.ravel()); small = hs < MAX_HOLE_KM2 / PIX_KM2; small[0] = False
    return body | small[hl]


def metrics(radar, opt, ok):
    a, b = radar[ok], opt[ok]
    tp = int((a & b).sum()); fp = int((a & ~b).sum()); fn = int((~a & b).sum()); tn = int((~a & ~b).sum()); n = tp + fp + fn + tn
    prec = tp / max(tp + fp, 1); rec = tp / max(tp + fn, 1); f1 = 2 * tp / max(2 * tp + fp + fn, 1); iou = tp / max(tp + fp + fn, 1)
    oa = (tp + tn) / max(n, 1); pe = ((tp + fp) * (tp + fn) + (fn + tn) * (fp + tn)) / max(n * n, 1); kappa = (oa - pe) / max(1 - pe, 1e-9)
    return dict(tp=tp, fp=fp, fn=fn, tn=tn, precision=round(prec, 4), recall=round(rec, 4), f1=round(f1, 4), iou=round(iou, 4),
                overall_accuracy=round(oa, 4), kappa=round(kappa, 4),
                radar_km2=round((tp + fp) * PIX_KM2, 1), optical_km2=round((tp + fn) * PIX_KM2, 1),
                area_diff_pct=round(100 * ((tp + fp) - (tp + fn)) / max(tp + fn, 1), 2))


def load_radar(pair, basin):
    p = f'{CACHE}/_mask_{pair}_{basin}.npy'
    return np.unpackbits(np.load(p))[:H * W].reshape(H, W).astype(bool)


rows, category = [], {}
for s in SEL:
    pair = s['win'].replace('-', ''); A = AREAS[s['area']]; basin = A['basin']
    cache = f'{CACHE}/s2/{pair}_{basin}_v2.npz'
    r0, r1, c0, c1, tr = subgrid(A['bounds']); shp = (r1 - r0, c1 - c0)
    if os.path.exists(cache):
        z = np.load(cache, allow_pickle=True); res = json.loads(str(z['res'])); opt = z['opt']; okm = z['ok']
    else:
        refl_sum = np.zeros(shp, 'float32'); refl_n = np.zeros(shp, 'float32'); clear = np.full(shp, np.nan, 'float32'); sclw = np.full(shp, np.nan, 'float32')
        for it in s['items']:
            tile = it['tile'].replace('MGRS-', '')
            with rasterio.open(f"{TILES}/{s['date']}_{tile}_SCL.tif") as rs: scl = rs.read(1); scl_tr, scl_crs = rs.transform, rs.crs
            with rasterio.open(f"{TILES}/{s['date']}_{tile}_B11.tif") as rb: dn = rb.read(1); b_tr, b_crs = rb.transform, rb.crs
            good = (dn > 0) & ~np.isin(scl, list(CLOUDY))
            refl = np.where(good, dn * 1e-4 - 0.1, np.nan).astype('float32')
            rg = to_grid(refl, b_tr, b_crs, shp, tr, Resampling.average)
            cf = to_grid(np.where(scl > 0, good.astype('float32'), np.nan), scl_tr, scl_crs, shp, tr, Resampling.average)
            sw = to_grid(np.where(scl > 0, (scl == 6).astype('float32'), np.nan), scl_tr, scl_crs, shp, tr, Resampling.average)
            okr = np.isfinite(rg); refl_sum[okr] += rg[okr]; refl_n[okr] += 1
            clear = np.where(np.isfinite(cf) & ~(np.isfinite(clear) & (clear > cf)), cf, clear)
            sclw = np.where(np.isfinite(sw), sw, sclw)
            del scl, dn, refl, good
        refl60 = np.where(refl_n > 0, refl_sum / np.maximum(refl_n, 1), np.nan)
        rows_i, cols_i = np.mgrid[r0:r1, c0:c1]
        X = T.c + (cols_i + .5) * 60; Y = T.f - (rows_i + .5) * 60
        region = A['region'](X, Y)
        okm = region & np.isfinite(refl60) & (np.nan_to_num(clear) >= 0.9)
        t = float(np.clip(otsu(refl60[okm]), 0.02, 0.12))
        opt = lake((refl60 < t) & okm, A['seed'], tr)
        opt_fixed = lake((refl60 < 0.05) & okm, A['seed'], tr)
        opt_scl = lake((np.nan_to_num(sclw) >= 0.5) & okm, A['seed'], tr)
        radar = load_radar(pair, basin)[r0:r1, c0:c1]
        m = metrics(radar, opt, okm); mf = metrics(radar, opt_fixed, okm); ms = metrics(radar, opt_scl, okm)
        res = dict(window=pair, basin=basin, s2_date=s['date'], s2_scenes=';'.join(i['id'] for i in s['items']), tile_cloud_pct=s['cloud'],
                   days_from_window_mid=s['gap'], swir_threshold=round(t, 4), usable_pct=round(100 * okm.sum() / max(region.sum(), 1), 1),
                   **m, f1_fixed005=mf['f1'], f1_scl_water=ms['f1'])
        np.savez_compressed(cache, res=json.dumps(res), opt=opt, ok=okm)
        # polygons
        feats = []
        for geom, _ in shapes(opt.astype('uint8'), mask=opt, transform=tr, connectivity=4):
            feats.append({'type': 'Feature', 'properties': {'window': pair, 'basin': basin, 's2_date': s['date']},
                          'geometry': transform_geom(CRS, 'EPSG:4326', geom)})
        json.dump({'type': 'FeatureCollection', 'features': feats}, open(f'{OUTD}/s2_water_{pair}_{basin}.geojson', 'w'), separators=(',', ':'))
        print('done', pair, basin, s['date'], 'F1', m['f1'], 'IoU', m['iou'], 'dA%', m['area_diff_pct'], 'thr', round(t, 3), 'usable', res['usable_pct'])
    rows.append(res)
    # full-grid agreement categories: 1 both, 2 radar only, 3 optical only, 4 masked/cloud
    cat = category.setdefault(pair, np.zeros((H, W), 'uint8'))
    radar = load_radar(pair, basin)[r0:r1, c0:c1]
    sub = np.zeros(radar.shape, 'uint8'); sub[okm & radar & opt] = 1; sub[okm & radar & ~opt] = 2; sub[okm & ~radar & opt] = 3
    rows_i, cols_i = np.mgrid[r0:r1, c0:c1]; region = A['region'](T.c + (cols_i + .5) * 60, T.f - (rows_i + .5) * 60)
    sub[region & ~okm] = 4
    view = cat[r0:r1, c0:c1]; view[sub > 0] = sub[sub > 0]

with open(f'{OUTD}/s2_validation.csv', 'w', newline='') as f:
    w = csv.DictWriter(f, list(rows[0])); w.writeheader(); w.writerows(rows)

def pooled(b):
    rr = [r for r in rows if r['basin'] == b]; tp = sum(r['tp'] for r in rr); fp = sum(r['fp'] for r in rr); fn = sum(r['fn'] for r in rr)
    f1s = sorted(r['f1'] for r in rr)
    return dict(pooled_f1=round(2 * tp / (2 * tp + fp + fn), 4), pooled_iou=round(tp / (tp + fp + fn), 4), median_f1=f1s[len(f1s) // 2],
                min_f1=f1s[0], max_f1=f1s[-1], mean_area_diff_pct=round(float(np.mean([r['area_diff_pct'] for r in rr])), 2), n=len(rr))
json.dump({'North': pooled('North'), 'South_West': pooled('South_West'),
           'method': 'Sentinel-2 L2A B11 SWIR reflectance < Otsu threshold (0.02-0.12), SCL cloud mask, 60 m mean, >=90% clear, lake-connected; compared with NISAR coherence water'},
          open(f'{OUTD}/s2_validation_summary.json', 'w'), indent=2)

# ---- web images ----
CROPS = {'full': ((575e3, 4840e3, 830e3, 5200e3), (850, 1200)), 'north': ((680e3, 5090e3, 835e3, 5195e3), (960, 650))}
def crop_idx(bounds, size):
    xs = bounds[0] + (np.arange(size[0]) + .5) * (bounds[2] - bounds[0]) / size[0]
    ys = bounds[3] - (np.arange(size[1]) + .5) * (bounds[3] - bounds[1]) / size[1]
    ci = np.floor((xs - T.c) / 60).astype(int); ri = np.floor((T.f - ys) / 60).astype(int)
    return np.clip(ri, 0, H - 1), np.clip(ci, 0, W - 1), (ri >= 0) & (ri < H), (ci >= 0) & (ci < W)
COL = {1: (38, 132, 196, 170), 2: (240, 120, 40, 255), 3: (170, 90, 230, 255), 4: (120, 120, 120, 90)}
for pair, cat in category.items():
    for name, (b, sz) in CROPS.items():
        ri, ci, okr, okc = crop_idx(b, sz); sub = cat[np.ix_(ri, ci)] * (okr[:, None] & okc[None, :])
        rgba = np.zeros((sz[1], sz[0], 4), 'uint8')
        for k, c in COL.items(): rgba[sub == k] = c
        Image.fromarray(rgba).save(f'{WEB}/agree/{name}_{pair}.png', optimize=True)

for date in sorted({s['date'] for s in SEL}):
    items = [it for s in SEL if s['date'] == date for it in s['items']]
    for name, (b, sz) in CROPS.items():
        p = f'{WEB}/optical/{name}_{date}.jpg'
        if os.path.exists(p): continue
        dst_tr = Affine((b[2] - b[0]) / sz[0], 0, b[0], 0, -(b[3] - b[1]) / sz[1], b[3])
        acc = np.zeros((3, sz[1], sz[0]), 'float32'); n = np.zeros((sz[1], sz[0]), 'float32')
        for it in items:
            with rasterio.open(f"{TILES}/{date}_{it['tile'].replace('MGRS-', '')}_L2A_PVI.tif") as r:
                for k in range(3):
                    o = np.full((sz[1], sz[0]), np.nan, 'float32')
                    reproject(r.read(k + 1).astype('float32'), o, src_transform=r.transform, src_crs=r.crs, dst_transform=dst_tr, dst_crs=CRS,
                              resampling=Resampling.bilinear, src_nodata=0, dst_nodata=np.nan)
                    if k == 0: okp = np.isfinite(o)
                    acc[k][okp] += np.nan_to_num(o[okp])
                n[okp] += 1
        rgb = np.where(n > 0, acc / np.maximum(n, 1), np.nan)
        img = np.nan_to_num(rgb, nan=24).astype('uint8').transpose(1, 2, 0)
        img[n == 0] = (20, 32, 30)
        Image.fromarray(img).save(p, quality=82)
print('done')
