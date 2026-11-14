"""
Step 4 of the Aral pipeline: make the small web images used by website/index.html.

Inputs : aral_out/<date>_HH_dB.tif, aral_out/coh_<pair>.tif, aral_out/coherence_cache/_mask_* and _uncertain_* (.npy)
Outputs: website/img/
   radar/{full,north}_<date>.jpg          HH backscatter, magma colour, -26..-8 dB
   coherence/{full,north}_<pair>.jpg      coherence 0..1, grey
   water/{full,north}_<pair>.png          coherence water outline (transparent PNG)
   classes/<pair>.png                     water (blue) + threshold-sensitive shoreline (amber)
   change/{full,north}_first_vs_last.png  water lost / gained / in both, first vs last window
Usage: python3 tools/make_web_images.py   (from the 'aral sea' folder)
"""
import os, glob, re, json
import numpy as np
import rasterio
from rasterio.windows import from_bounds
from rasterio.enums import Resampling
from scipy.ndimage import binary_dilation
from matplotlib import colormaps
from PIL import Image

OUT = 'website/img'
for _d in ['radar', 'coherence', 'water', 'classes', 'change']: os.makedirs(f'{OUT}/{_d}', exist_ok=True)
CROPS = {'full': ((575e3, 4840e3, 830e3, 5200e3), (850, 1200)), 'north': ((680e3, 5090e3, 835e3, 5195e3), (960, 650))}
MAGMA = colormaps['magma']

ref = sorted(glob.glob('aral_out/2026????_HH_dB.tif'))[0]
with rasterio.open(ref) as r:
    T, H, W = r.transform, r.height, r.width


def read_crop(path, bounds, size):
    with rasterio.open(path) as r:
        return r.read(1, window=from_bounds(*bounds, r.transform), out_shape=(size[1], size[0]), resampling=Resampling.average)


def crop_mask(full_mask, bounds, size):
    """Nearest-neighbour crop/resample of a full-grid boolean mask (outside the grid = False)."""
    xs = bounds[0] + (np.arange(size[0]) + .5) * (bounds[2] - bounds[0]) / size[0]
    ys = bounds[3] - (np.arange(size[1]) + .5) * (bounds[3] - bounds[1]) / size[1]
    ci = np.floor((xs - T.c) / 60).astype(int); ri = np.floor((T.f - ys) / 60).astype(int)
    okc = (ci >= 0) & (ci < W); okr = (ri >= 0) & (ri < H)
    out = np.zeros((size[1], size[0]), bool)
    out[np.ix_(okr, okc)] = full_mask[np.ix_(ri[okr], ci[okc])]
    return out


def load_mask(path):
    return np.unpackbits(np.load(path))[:H * W].reshape(H, W).astype(bool)


dates = sorted(re.search(r'(\d{8})_HH', p).group(1) for p in glob.glob('aral_out/2026????_HH_dB.tif'))
for d in dates:
    for name, (b, sz) in CROPS.items():
        p = f'{OUT}/radar/{name}_{d}.jpg'
        if os.path.exists(p): continue
        a = read_crop(f'aral_out/{d}_HH_dB.tif', b, sz)
        bad = ~np.isfinite(a) | (a < -60)
        rgb = (MAGMA(np.clip((np.nan_to_num(a, nan=-26) + 26) / 18, 0, 1))[..., :3] * 255).astype('uint8'); rgb[bad] = (20, 32, 30)
        Image.fromarray(rgb).save(p, quality=80)
print('HH images:', len(dates))

pairs = sorted(re.search(r'coh_(\d{8}_\d{8})', p).group(1) for p in glob.glob('aral_out/coh_*.tif'))
for tag in pairs:
    if os.path.exists(f'{OUT}/classes/{tag}.png'): continue
    water = np.zeros((H, W), bool); unc = np.zeros((H, W), bool)
    for b in ['North', 'South_West']:
        mp = f'aral_out/coherence_cache/_mask_{tag}_{b}.npy'; up = f'aral_out/coherence_cache/_uncertain_{tag}_{b}.npy'
        if os.path.exists(mp): water |= load_mask(mp)
        if os.path.exists(up): unc |= load_mask(up)
    for name, (b, sz) in CROPS.items():
        c = read_crop(f'aral_out/coh_{tag}.tif', b, sz)
        g = (np.clip(np.nan_to_num(c, nan=0), 0, 1) * 255).astype('uint8')
        Image.fromarray(np.stack([g, g, g], -1)).save(f'{OUT}/coherence/{name}_{tag}.jpg', quality=78)
        m = crop_mask(water, b, sz)
        e = binary_dilation(m, iterations=2 if name == 'north' else 1) & ~m
        rgba = np.zeros((sz[1], sz[0], 4), 'uint8'); rgba[m] = (120, 230, 215, 90); rgba[e] = (140, 255, 240, 255)
        Image.fromarray(rgba).save(f'{OUT}/water/{name}_{tag}.png', optimize=True)
        if name == 'full':
            u = crop_mask(unc, b, sz)
            cls = np.zeros((sz[1], sz[0], 4), 'uint8'); cls[m] = (38, 132, 196, 210); cls[u] = (232, 163, 36, 235)
            Image.fromarray(cls).save(f'{OUT}/classes/{tag}.png', optimize=True)
    print('pair images:', tag)
print('done')

# ---- change map: first pair vs latest pair (gained / lost / persistent water) + per-pixel water frequency ----
first, last = pairs[0], pairs[-1]
def both(tag):
    m = np.zeros((H, W), bool)
    for b in ['North', 'South_West']:
        p = f'aral_out/coherence_cache/_mask_{tag}_{b}.npy'
        if os.path.exists(p): m |= load_mask(p)
    return m
A, B = both(first), both(last)
freq = np.zeros((H, W), 'uint8')
for tag in pairs: freq += both(tag)
stats = {}
for name, (bnd, sz) in CROPS.items():
    a, b = crop_mask(A, bnd, sz), crop_mask(B, bnd, sz)
    rgba = np.zeros((sz[1], sz[0], 4), 'uint8')
    rgba[a & b] = (38, 132, 196, 150); rgba[a & ~b] = (240, 120, 40, 255); rgba[~a & b] = (40, 230, 200, 255)
    Image.fromarray(rgba).save(f'{OUT}/change/{name}_first_vs_last.png', optimize=True)
km2 = 60 * 60 / 1e6
north = np.zeros((H, W), bool); north[:int(round((T.f - 5090e3) / 60)), :] = True
for reg_name, reg in [('North', north), ('South_West', ~north)]:
    stats[reg_name] = dict(persistent_km2=round(float((A & B & reg).sum() * km2), 1), lost_km2=round(float((A & ~B & reg).sum() * km2), 1),
                           gained_km2=round(float((~A & B & reg).sum() * km2), 1),
                           water_every_pair_km2=round(float(((freq == len(pairs)) & reg).sum() * km2), 1),
                           water_some_pairs_km2=round(float(((freq > 0) & (freq < len(pairs)) & reg).sum() * km2), 1))
json.dump(dict(first=first, last=last, n_pairs=len(pairs), stats=stats), open('water_polygons/coherence/change_summary.json', 'w'), indent=2)
print(json.dumps(stats))
