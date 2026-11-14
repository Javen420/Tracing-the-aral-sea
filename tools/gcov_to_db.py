"""
Step 1 of the Aral pipeline: raw NISAR L2 GCOV .h5  ->  60 m HH / HV backscatter in dB (GeoTIFF).

For every acquisition date found in nisar_raw/gcov/ (frames 065, 066, 067 of track 107D):
  1. read HHHH and HVHV (linear power, 20 m, EPSG:32640) strip by strip
  2. average 3 x 3 blocks in linear power  -> 60 m  (reduces speckle, ~9 looks)
  3. place each frame on one common 60 m grid and average where frames overlap
  4. convert to dB = 10*log10(power); invalid / zero pixels -> NaN
Output: aral_out/<YYYYMMDD>_HH_dB.tif and _HV_dB.tif  (same grid as the existing files, if present)

Usage:  python3 tools/gcov_to_db.py            (run from the 'aral sea' folder)
        python3 tools/gcov_to_db.py --force    (re-make files that already exist)
Needs: numpy, h5py, rasterio
"""
import sys, re, glob, os
import numpy as np
import h5py
import rasterio
from rasterio.transform import Affine

SRC = 'nisar_raw/gcov'
OUT = 'aral_out'
F = 3                     # 20 m -> 60 m
STRIP = 1536              # rows read at a time (multiple of 3 and of the 512 chunk size)
FORCE = '--force' in sys.argv
os.makedirs(OUT, exist_ok=True)


def target_grid():
    """Re-use the grid of an existing aral_out file so every date lines up; else build one."""
    ex = sorted(glob.glob(os.path.join(OUT, '2026????_HH_dB.tif')))
    for p in ex:
        with rasterio.open(p) as r:
            if r.res == (60.0, 60.0):
                return r.transform, r.height, r.width, r.crs
    # fallback: union of all GCOV frames at 60 m
    xs, ys = [], []
    for f in glob.glob(os.path.join(SRC, '*.h5')):
        with h5py.File(f, 'r') as h:
            g = h['science/LSAR/GCOV/grids/frequencyA']
            x, y = g['xCoordinates'][[0, -1]], g['yCoordinates'][[0, -1]]
            xs += list(x); ys += list(y)
    x0, y0 = min(xs) - 10, max(ys) + 10
    w = int(np.ceil((max(xs) + 10 - x0) / 60)); hgt = int(np.ceil((y0 - (min(ys) - 10)) / 60))
    return Affine(60, 0, x0, 0, -60, y0), hgt, w, rasterio.crs.CRS.from_epsg(32640)


def frame_to_60m(path, band):
    """Return (sum_of_power, count) arrays of one frame at 60 m, plus its 60 m origin."""
    with h5py.File(path, 'r') as h:
        g = h['science/LSAR/GCOV/grids/frequencyA']
        d = g[band]; ny, nx = d.shape
        x = g['xCoordinates']; y = g['yCoordinates']
        x0 = float(x[0]) - 10.0; y0 = float(y[0]) + 10.0     # pixel-centre -> corner (20 m pixels)
        ny3, nx3 = ny // F, nx // F
        out = np.full((ny3, nx3), np.nan, dtype='float32')
        for r0 in range(0, ny3 * F, STRIP):
            r1 = min(r0 + STRIP, ny3 * F)
            a = d[r0:r1, :nx3 * F].astype('float32')
            a[~np.isfinite(a) | (a <= 0)] = np.nan
            a = a.reshape((r1 - r0) // F, F, nx3, F)
            with np.errstate(all='ignore'):
                cnt = np.sum(np.isfinite(a), axis=(1, 3))
                s = np.nansum(a, axis=(1, 3))
                m = np.where(cnt >= 5, s / np.maximum(cnt, 1), np.nan)   # need >= 5 of 9 valid looks
            out[r0 // F:r1 // F] = m
    return out, x0, y0


T, H, W, CRS = target_grid()
files = sorted(glob.glob(os.path.join(SRC, '*.h5')))
by_date = {}
for f in files:
    m = re.search(r'_A_(\d{8})T', os.path.basename(f))
    if m and os.path.exists(f + '.done'):
        by_date.setdefault(m.group(1), []).append(f)
print(f'{len(files)} GCOV files, dates: {sorted(by_date)}')

for date, group in sorted(by_date.items()):
    for band, tag in [('HHHH', 'HH'), ('HVHV', 'HV')]:
        out_path = os.path.join(OUT, f'{date}_{tag}_dB.tif')
        if os.path.exists(out_path) and not FORCE:
            print('exists, skipping', out_path); continue
        acc = np.zeros((H, W), 'float32'); cnt = np.zeros((H, W), 'uint8')
        for f in sorted(group):
            a, fx0, fy0 = frame_to_60m(f, band)
            # integer offset of this frame on the target grid (both are 60 m, same CRS)
            c0 = int(round((fx0 - T.c) / 60)); r0 = int(round((T.f - fy0) / 60))
            rs, cs = max(r0, 0), max(c0, 0)
            re_, ce = min(r0 + a.shape[0], H), min(c0 + a.shape[1], W)
            if rs >= re_ or cs >= ce:
                continue
            sub = a[rs - r0:re_ - r0, cs - c0:ce - c0]
            ok = np.isfinite(sub)
            acc[rs:re_, cs:ce][ok] += sub[ok]; cnt[rs:re_, cs:ce][ok] += 1
            del a
        with np.errstate(all='ignore'):
            db = np.where(cnt > 0, 10 * np.log10(acc / np.maximum(cnt, 1)), np.nan).astype('float32')
        prof = dict(driver='GTiff', height=H, width=W, count=1, dtype='float32', crs=CRS, transform=T,
                    nodata=np.nan, compress='deflate', predictor=3, tiled=True, blockxsize=256, blockysize=256)
        with rasterio.open(out_path, 'w', **prof) as dst:
            dst.write(db, 1)
            dst.update_tags(source='NISAR L2 GCOV ' + band, frames=','.join(os.path.basename(f)[:60] for f in group),
                            method='3x3 linear-power block mean (>=5 valid of 9), frame overlap averaged, 10*log10')
        v = db[np.isfinite(db)]
        print(f'{out_path}: valid {v.size/db.size:.0%}, median {np.median(v):.1f} dB')
        del acc, cnt, db
print('done')
