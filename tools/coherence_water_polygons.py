"""
Aral Sea water polygons straight from the raw NISAR GUNW .h5 files (interferometric coherence).

Why coherence: between two passes 12 days apart, open water changes completely, so its coherence
drops to ~0 whatever the wind. Desert, steppe and dry seabed stay stable (high coherence).

Runs inside QGIS (uses the GDAL that ships with QGIS, nothing to install):
    QGIS > Plugins > Python Console > Show Editor > open this file > Run
or in the console:
    exec(open('/Users/javen/Desktop/aral sea/tools/coherence_water_polygons.py').read())

Outputs (in water_polygons/coherence/):
    coh_<ref>_<sec>.tif          coherence mosaic (North + South frames) per date pair
    coherence_water.gpkg         layer 'lake_polygons': one polygon set per pair x basin, with area_km2
    coherence_water_area.csv     North vs South water area per pair
"""
import os, glob, csv, re
import numpy as np
from osgeo import gdal, ogr, osr

gdal.UseExceptions()
PROJECT = os.path.expanduser('~/Desktop/aral sea')
GUNW_DIR = os.path.join(PROJECT, 'nisar_raw', 'gunw')
OUT = os.path.join(PROJECT, 'water_polygons', 'coherence')
COH_THRESHOLD = 0.35     # below this = water (check the seed medians printed below)
MIN_PIXELS = 25          # sieve: drop low-coherence blobs smaller than this (pixels)
# Seed points inside each lake (UTM 40N metres). A lake = low-coherence polygons containing the seed.
SEEDS = {'North': (743000, 5152000), 'South_West': (612000, 4975000)}
DEFAULT_EPSG = 32640


def walk(group, prefix=''):
    """Yield full paths of every array in an HDF5 file (GDAL multidimensional API)."""
    for name in group.GetMDArrayNames() or []:
        yield prefix + '/' + name
    for sub in group.GetGroupNames() or []:
        yield from walk(group.OpenGroup(sub), prefix + '/' + sub)


def nearest(paths, target, name):
    """Of arrays called `name`, pick the one sharing the longest path prefix with `target`."""
    cands = [p for p in paths if p.endswith('/' + name)]
    if not cands:
        return None
    return max(cands, key=lambda p: len(os.path.commonprefix([p, target])))


def read_coherence(h5):
    ds = gdal.OpenEx(h5, gdal.OF_MULTIDIM_RASTER)
    root = ds.GetRootGroup()
    paths = list(walk(root))
    cohs = [p for p in paths if p.endswith('/coherenceMagnitude')]
    if not cohs:
        raise RuntimeError(f'no coherenceMagnitude in {os.path.basename(h5)}')
    # prefer the unwrapped-interferogram grid, HH polarisation
    cohs.sort(key=lambda p: ('unwrappedInterferogram' not in p, '/HH/' not in p, p))
    coh_path = cohs[0]
    coh = root.OpenMDArrayFromFullname(coh_path).ReadAsArray().astype('float32')
    x = root.OpenMDArrayFromFullname(nearest(paths, coh_path, 'xCoordinates')).ReadAsArray()
    y = root.OpenMDArrayFromFullname(nearest(paths, coh_path, 'yCoordinates')).ReadAsArray()
    epsg = DEFAULT_EPSG
    proj_path = nearest(paths, coh_path, 'projection')
    if proj_path:
        try:
            epsg = int(root.OpenMDArrayFromFullname(proj_path).GetAttribute('epsg_code').Read())
        except Exception:
            pass
    dx, dy = float(x[1] - x[0]), float(y[1] - y[0])
    gt = (float(x[0]) - dx / 2, dx, 0, float(y[0]) - dy / 2, 0, dy)
    coh[~np.isfinite(coh) | (coh <= 0) | (coh > 1)] = np.nan
    return coh, gt, epsg, coh_path


def write_tif(path, arr, gt, epsg, nodata):
    drv = gdal.GetDriverByName('GTiff')
    dt = gdal.GDT_Float32 if arr.dtype.kind == 'f' else gdal.GDT_Byte
    ds = drv.Create(path, arr.shape[1], arr.shape[0], 1, dt, ['COMPRESS=DEFLATE', 'TILED=YES'])
    ds.SetGeoTransform(gt)
    srs = osr.SpatialReference(); srs.ImportFromEPSG(epsg); ds.SetProjection(srs.ExportToWkt())
    b = ds.GetRasterBand(1); b.WriteArray(arr); b.SetNoDataValue(nodata); ds.FlushCache(); ds = None


def seed_median(arr, gt, xy, half=10):
    c = int((xy[0] - gt[0]) / gt[1]); r = int((xy[1] - gt[3]) / gt[5])
    if not (0 <= r < arr.shape[0] and 0 <= c < arr.shape[1]):
        return None
    v = arr[max(r - half, 0):r + half, max(c - half, 0):c + half]
    v = v[np.isfinite(v)]
    return round(float(np.median(v)), 3) if v.size else None


os.makedirs(OUT, exist_ok=True)
files = sorted(f for f in glob.glob(os.path.join(GUNW_DIR, '*.h5')) if os.path.exists(f + '.done'))
pat = re.compile(r'GUNW_\d+_\d+_[AD]_(\d{3})_\d+_\d+_\w\w_(\d{8})T\d+_\d{8}T\d+_(\d{8})T')
pairs = {}
for f in files:
    m = pat.search(os.path.basename(f))
    if m:
        pairs.setdefault((m.group(2), m.group(3)), []).append(f)
print(f'{len(files)} finished GUNW files -> {len(pairs)} date pairs')

gpkg = os.path.join(OUT, 'coherence_water.gpkg')
if os.path.exists(gpkg):
    ogr.GetDriverByName('GPKG').DeleteDataSource(gpkg)
srs = osr.SpatialReference(); srs.ImportFromEPSG(DEFAULT_EPSG)
out_ds = ogr.GetDriverByName('GPKG').CreateDataSource(gpkg)
lake_lyr = out_ds.CreateLayer('lake_polygons', srs, ogr.wkbMultiPolygon)
for name, t in [('pair', ogr.OFTString), ('ref_date', ogr.OFTString), ('sec_date', ogr.OFTString),
                ('basin', ogr.OFTString), ('area_km2', ogr.OFTReal), ('coh_threshold', ogr.OFTReal),
                ('seed_median_coh', ogr.OFTReal)]:
    lake_lyr.CreateField(ogr.FieldDefn(name, t))

rows = []
for (ref, sec), group in sorted(pairs.items()):
    tag = f'{ref}_{sec}'
    parts = []
    for f in group:
        coh, gt, epsg, coh_path = read_coherence(f)
        p = os.path.join(OUT, f'_frame_{tag}_{len(parts)}.tif')
        write_tif(p, coh, gt, epsg, float('nan')); parts.append(p)
    mosaic = os.path.join(OUT, f'coh_{tag}.tif')
    vrt = gdal.BuildVRT('', parts, srcNodata=float('nan'), VRTNodata=float('nan'))
    gdal.Translate(mosaic, vrt, creationOptions=['COMPRESS=DEFLATE', 'TILED=YES']); vrt = None
    for p in parts:
        os.remove(p)

    m = gdal.Open(mosaic); gt = m.GetGeoTransform(); coh = m.GetRasterBand(1).ReadAsArray(); m = None
    water = (np.isfinite(coh) & (coh < COH_THRESHOLD)).astype('uint8')
    mem = gdal.GetDriverByName('MEM').Create('', water.shape[1], water.shape[0], 1, gdal.GDT_Byte)
    mem.SetGeoTransform(gt); mem.SetProjection(srs.ExportToWkt())
    band = mem.GetRasterBand(1); band.WriteArray(water)
    gdal.SieveFilter(band, None, band, MIN_PIXELS, 4)
    tmp = ogr.GetDriverByName('Memory').CreateDataSource('tmp')
    tl = tmp.CreateLayer('w', srs, ogr.wkbPolygon); tl.CreateField(ogr.FieldDefn('v', ogr.OFTInteger))
    gdal.Polygonize(band, band, tl, 0)   # band as its own mask: only water (1) is polygonised

    for basin, xy in SEEDS.items():
        pt = ogr.Geometry(ogr.wkbPoint); pt.AddPoint(*xy)
        lake = ogr.Geometry(ogr.wkbMultiPolygon)
        tl.ResetReading()
        for feat in tl:
            g = feat.GetGeometryRef()
            if g.Contains(pt):
                lake.AddGeometry(g.Clone())
        med = seed_median(coh, gt, xy)
        area = lake.GetArea() / 1e6 if not lake.IsEmpty() else 0.0
        if not lake.IsEmpty():
            f = ogr.Feature(lake_lyr.GetLayerDefn())
            for k, v in dict(pair=tag, ref_date=ref, sec_date=sec, basin=basin, area_km2=round(area, 1),
                             coh_threshold=COH_THRESHOLD, seed_median_coh=med if med is not None else -1).items():
                f.SetField(k, v)
            f.SetGeometry(lake); lake_lyr.CreateFeature(f)
        rows.append(dict(pair=tag, ref_date=ref, sec_date=sec, basin=basin, water_km2=round(area, 1),
                         seed_median_coherence=med, frames=len(group)))
        print(f'{tag}  {basin:<10}  {area:8.1f} km2   seed coherence {med}')
out_ds = None

with open(os.path.join(OUT, 'coherence_water_area.csv'), 'w', newline='') as fh:
    if rows:
        w = csv.DictWriter(fh, list(rows[0])); w.writeheader(); w.writerows(rows)
print('Written to', OUT)

try:  # add to the open QGIS project when run from the QGIS console
    from qgis.core import QgsProject, QgsVectorLayer, QgsRasterLayer
    QgsProject.instance().addMapLayer(QgsVectorLayer(gpkg + '|layername=lake_polygons', 'Coherence water polygons', 'ogr'))
    print('Added the polygons layer to the project (coherence rasters are in water_polygons/coherence/).')
except Exception:
    pass
