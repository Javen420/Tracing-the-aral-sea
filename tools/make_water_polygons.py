"""Aral Sea water/shoreline polygons from NISAR GCOV HH backscatter (adapted from create_candidate_polygons.py).

Status: UNVALIDATED threshold candidates. Smooth water on L-band HH is dark, but wind-roughened
water can be as bright as land, so every date x basin gets a separation gate from reference boxes.
Areas from dates that fail the gate must not be used as evidence. Replace with GUNW coherence when ready.

Usage:  python3 make_water_polygons.py <folder with YYYYMMDD_HH_dB.tif> <output folder>
"""
import sys, json, csv
from pathlib import Path
import numpy as np
import rasterio
from rasterio.features import shapes
from rasterio.warp import transform_geom
from rasterio.windows import from_bounds
from scipy.ndimage import median_filter, binary_erosion, binary_fill_holes, label
from shapely.geometry import shape
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.colors import ListedColormap

SRC = Path(sys.argv[1]); OUT = Path(sys.argv[2]); OUT.mkdir(parents=True, exist_ok=True)
DATES = ['20260621', '20260820', '20261019']
DELTA = 0.5          # dB threshold perturbation for sensitivity
MIN_PIXELS = 25      # 25 x 60 m pixels = 9 ha
MAX_HOLE_KM2 = 200   # enclosed gaps up to this size are filled (wind-roughened patches inside the lake)
GATE = 0.90          # balanced accuracy needed on reference boxes
# Reference boxes, UTM 40N (km): xmin, ymin, xmax, ymax
BASINS = {
    'North': dict(region=lambda X, Y: Y > 5090e3, water=(735, 5145, 752, 5160), land=[(640, 5180, 680, 5200), (770, 5100, 800, 5120)]),
    'South_West': dict(region=lambda X, Y: (Y <= 5090e3) & (X > 598e3) & (X < 660e3), water=(609, 4960, 615, 4990), land=[(630, 4950, 650, 4990), (640, 5000, 660, 5040)]),
}

arrays, base = [], None
for d in DATES:
    with rasterio.open(SRC / f'{d}_HH_dB.tif') as r:
        if base is None: base = (r.crs, r.transform, r.shape); profile = r.profile
        assert (r.crs, r.transform, r.shape) == base
        a = r.read(1).astype('float32'); a[~np.isfinite(a) | (a < -60)] = np.nan  # swath edge fill
        arrays.append(a)
T = profile['transform']; H, W = base[2]
common = binary_erosion(np.logical_and.reduce([np.isfinite(a) for a in arrays]), structure=np.ones((3, 3)), border_value=0)
pix_ha = abs(T.a * T.e) / 1e4
cols, rows = np.meshgrid(np.arange(W), np.arange(H))
X = T.c + (cols + .5) * T.a; Y = T.f + (rows + .5) * T.e
regions = {b: cfg['region'](X, Y) & common for b, cfg in BASINS.items()}
del cols, rows, X, Y

def box(a, bx):
    w = from_bounds(bx[0]*1e3, bx[1]*1e3, bx[2]*1e3, bx[3]*1e3, T).round_offsets().round_lengths()
    r0, c0 = int(w.row_off), int(w.col_off)
    v = a[r0:r0+int(w.height), c0:c0+int(w.width)]; return v[np.isfinite(v)]

def pick_threshold(water, land):
    best = (0, None)
    for t in np.arange(-30, -12, .1):
        ba = .5 * ((water <= t).mean() + (land > t).mean())
        if ba > best[0]: best = (ba, round(float(t), 1))
    return best

def candidate(a, t, region):
    m = (a <= t) & region
    lab, _ = label(m); sizes = np.bincount(lab.ravel()); keep = sizes >= MIN_PIXELS; keep[0] = False
    return keep[lab]

def lake_body(cand, seed_box):
    """Candidate components touching the water reference box = the lake itself; enclosed holes (speckle, wind patches) filled."""
    lab, _ = label(cand)
    w = from_bounds(seed_box[0]*1e3, seed_box[1]*1e3, seed_box[2]*1e3, seed_box[3]*1e3, T).round_offsets().round_lengths()
    ids = np.unique(lab[int(w.row_off):int(w.row_off+w.height), int(w.col_off):int(w.col_off+w.width)]); ids = ids[ids > 0]
    body = np.isin(lab, ids)
    holes = binary_fill_holes(body) & ~body
    hl, _ = label(holes); hs = np.bincount(hl.ravel()); small = hs < MAX_HOLE_KM2 * 100 / pix_ha; small[0] = False
    return body | small[hl]

def vectorize(mask, props):
    feats = []
    for geom, _ in shapes(mask.astype('uint8'), mask=mask, transform=T, connectivity=4):
        poly = shape(geom); assert poly.is_valid
        feats.append({'type': 'Feature', 'properties': dict(props, area_ha=round(poly.area/1e4, 2)),
                      'geometry': transform_geom(profile['crs'], 'EPSG:4326', geom)})
    return feats

def save(name, feats):
    (OUT/name).write_text(json.dumps({'type': 'FeatureCollection', 'features': feats}, separators=(',', ':')))

summary, lakes, all_lake_feats = [], {}, []
smooth = [median_filter(np.where(np.isfinite(a), a, 0), size=3, mode='nearest') for a in arrays]
for d, s in zip(DATES, smooth):

    for b, cfg in BASINS.items():
        wv = box(s, cfg['water']); lv = np.concatenate([box(s, x) for x in cfg['land']])
        ba, t = pick_threshold(wv, lv); ba = float(ba); ok = bool(ba >= GATE)
        res = {}
        for k, tt in [('central', t), ('lower', t-DELTA), ('upper', t+DELTA)]:
            res[k] = lake_body(candidate(s, tt, regions[b]), cfg['water'])
        lakes[(d, b)] = res['central']
        unstable = res['lower'] != res['upper']
        props = dict(date=d, basin=b, threshold_dB=t, balanced_accuracy=round(ba, 3), gate_pass=bool(ok),
                     status='candidate water - passed separation gate' if ok else 'UNRELIABLE - water/land not separable this date (likely wind)')
        f = vectorize(res['central'], props); all_lake_feats += f
        save(f'{d}_{b}_lake_polygon.geojson', f)
        save(f'{d}_{b}_threshold_sensitive.geojson', vectorize(unstable, dict(props, meaning='pixel changes class at threshold +/-0.5 dB')))

        summary.append(dict(date=d, basin=b, threshold_dB=t, balanced_accuracy=round(ba, 3), gate_pass=ok,
                            water_km2=round(res['central'].sum()*pix_ha/100, 1),
                            km2_at_threshold_minus_0_5=round(res['lower'].sum()*pix_ha/100, 1),
                            km2_at_threshold_plus_0_5=round(res['upper'].sum()*pix_ha/100, 1),
                            water_median_dB=round(float(np.median(wv)), 1), land_median_dB=round(float(np.median(lv)), 1)))
save('all_dates_lake_polygons.geojson', all_lake_feats)

# Pairwise shoreline change per basin
pair_rows, pair_feats = [], []
for b in BASINS:
    for i, j in [(0, 1), (1, 2), (0, 2)]:
        a, c = lakes[(DATES[i], b)], lakes[(DATES[j], b)]
        gi = next(r['gate_pass'] for r in summary if r['date'] == DATES[i] and r['basin'] == b)
        gj = next(r['gate_pass'] for r in summary if r['date'] == DATES[j] and r['basin'] == b)
        for m, name in [(~a & c, 'expansion'), (a & ~c, 'retreat')]:
            pair_feats += vectorize(m, {'basin': b, 'from': DATES[i], 'to': DATES[j], 'change': name, 'both_dates_pass': gi and gj})
        pair_rows.append(dict(basin=b, frm=DATES[i], to=DATES[j], expansion_km2=round((~a & c).sum()*pix_ha/100, 1),
                              retreat_km2=round((a & ~c).sum()*pix_ha/100, 1), net_km2=round((c.sum()-a.sum())*pix_ha/100, 1),
                              both_dates_pass=gi and gj))
save('shoreline_change_all_pairs.geojson', pair_feats)

for name, rows in [('water_area_by_date.csv', summary), ('shoreline_change_summary.csv', pair_rows)]:
    with (OUT/name).open('w', newline='') as f:
        w = csv.DictWriter(f, list(rows[0])); w.writeheader(); w.writerows(rows)
(OUT/'parameters.json').write_text(json.dumps(dict(input='GCOV HH dB, 60 m, EPSG:32640', filter='3x3 median', dates=DATES,
    threshold='per date and basin: maximises balanced accuracy between water and land reference boxes',
    gate=GATE, delta_dB=DELTA, min_component_pixels=MIN_PIXELS, lake_body='candidate components touching the water reference box; enclosed holes < MAX_HOLE_KM2 filled (wind patches); wind patches touching the shore are NOT recovered',
    basins={b: dict(water_box_km=c['water'], land_boxes_km=c['land']) for b, c in BASINS.items()},
    caveat='Unvalidated. Wind-roughened water is misclassified as land. Use only gate_pass rows; confirm with GUNW coherence / Sentinel-2.'), indent=2))

# Preview
fig, ax = plt.subplots(1, 3, figsize=(18, 9))
step = 4
for k, (d, a) in enumerate(zip(DATES, arrays)):
    ax[k].imshow(a[::step, ::step], cmap='gray', vmin=-26, vmax=-8)
    for b, col in [('North', 'cyan'), ('South_West', 'yellow')]:
        ax[k].contour(lakes[(d, b)][::step, ::step].astype(float), levels=[.5], colors=[col], linewidths=.7)
    gs = ', '.join(f"{r['basin']} {'ok' if r['gate_pass'] else 'FAIL'}" for r in summary if r['date'] == d)
    ax[k].set_title(f'{d}  ({gs})'); ax[k].set_axis_off()
fig.suptitle('Candidate lake outlines from HH backscatter (cyan North, yellow South-West) - unvalidated')
fig.tight_layout(); fig.savefig(OUT/'lake_outlines_preview.png', dpi=80)
print(json.dumps(summary, indent=1)); print(json.dumps(pair_rows, indent=1))
