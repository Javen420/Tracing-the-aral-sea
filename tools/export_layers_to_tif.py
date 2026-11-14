"""
QGIS Processing script: Export selected raster layers to GeoTIFF.

Install: Processing Toolbox -> Python icon -> "Add Script to Toolbox..." -> pick this file.
Run:     Processing Toolbox -> Scripts -> Aral Sea tools -> Export selected layers to GeoTIFF
"""
import os
import re

from osgeo import gdal
from qgis.core import (
    Qgis,
    QgsProcessing,
    QgsProcessingAlgorithm,
    QgsProcessingException,
    QgsProcessingParameterBoolean,
    QgsProcessingParameterEnum,
    QgsProcessingParameterFolderDestination,
    QgsProcessingParameterMultipleLayers,
    QgsRasterFileWriter,
    QgsRasterPipe,
)

RASTER_TYPE = getattr(QgsProcessing, "TypeRaster", None)
if RASTER_TYPE is None:  # QGIS 4 style enum
    RASTER_TYPE = Qgis.ProcessingSourceType.Raster

MODES = [
    "Rendered colours (RGBA, exactly as shown on the map)",
    "Raw data values (dB, for analysis)",
]


def _ok(result):
    """True if a QgsRasterFileWriter result means success (works on QGIS 3 and 4)."""
    try:
        return int(result) == 0
    except (TypeError, ValueError):
        name = str(result)
        return name.endswith("NoError") or name.endswith("Success")


class ExportLayersToTif(QgsProcessingAlgorithm):
    LAYERS = "LAYERS"
    MODE = "MODE"
    VISIBLE_EXTENT = "VISIBLE_EXTENT"
    OUTPUT = "OUTPUT"

    def name(self):
        return "export_layers_to_geotiff"

    def displayName(self):
        return "Export selected layers to GeoTIFF"

    def group(self):
        return "Aral Sea tools"

    def groupId(self):
        return "aral_sea_tools"

    def shortHelpString(self):
        return (
            "Tick the raster layers you want, choose an output folder, and each layer is "
            "saved as its own GeoTIFF named after the layer.\n\n"
            "Rendered colours: saves the layer as you see it (colour ramp applied) - "
            "use this for the web app, slides or overlays.\n"
            "Raw data values: saves the original dB numbers - use this for further analysis.\n\n"
            "Optionally clip to the current map view to keep files small."
        )

    def createInstance(self):
        return ExportLayersToTif()

    def initAlgorithm(self, config=None):
        self.addParameter(
            QgsProcessingParameterMultipleLayers(self.LAYERS, "Layers to export", RASTER_TYPE)
        )
        self.addParameter(
            QgsProcessingParameterEnum(self.MODE, "Export as", options=MODES, defaultValue=0)
        )
        self.addParameter(
            QgsProcessingParameterBoolean(
                self.VISIBLE_EXTENT, "Clip to current map view", defaultValue=False
            )
        )
        self.addParameter(QgsProcessingParameterFolderDestination(self.OUTPUT, "Output folder"))

    def processAlgorithm(self, parameters, context, feedback):
        layers = self.parameterAsLayerList(parameters, self.LAYERS, context)
        mode = self.parameterAsEnum(parameters, self.MODE, context)
        clip_view = self.parameterAsBoolean(parameters, self.VISIBLE_EXTENT, context)
        out_dir = self.parameterAsString(parameters, self.OUTPUT, context)
        if not layers:
            raise QgsProcessingException("Select at least one layer.")
        os.makedirs(out_dir, exist_ok=True)

        view_extent = None
        if clip_view:
            try:
                from qgis.utils import iface
                canvas = iface.mapCanvas()
                view_extent = (canvas.extent(), canvas.mapSettings().destinationCrs())
            except Exception:
                feedback.reportError("Could not read the map view; exporting full layers.")

        written = []
        for i, layer in enumerate(layers):
            if feedback.isCanceled():
                break
            if layer.providerType() != "gdal":
                feedback.reportError(f"Skipped '{layer.name()}': not a file-based raster (e.g. a web basemap).")
                continue

            safe = re.sub(r"[^A-Za-z0-9_-]+", "_", layer.name()).strip("_") or f"layer_{i}"
            suffix = "_rgb" if mode == 0 else "_raw"
            path = os.path.join(out_dir, f"{safe}{suffix}.tif")

            extent = layer.extent()
            if view_extent is not None:
                from qgis.core import QgsCoordinateTransform
                vext, vcrs = view_extent
                if vcrs != layer.crs():
                    vext = QgsCoordinateTransform(vcrs, layer.crs(), context.transformContext()).transformBoundingBox(vext)
                extent = extent.intersect(vext)
                if extent.isEmpty():
                    feedback.reportError(f"Skipped '{layer.name()}': outside the current map view.")
                    continue

            px_x = layer.rasterUnitsPerPixelX() or 1
            px_y = layer.rasterUnitsPerPixelY() or 1
            cols = max(1, int(round(extent.width() / px_x)))
            rows = max(1, int(round(extent.height() / px_y)))

            if mode == 0:
                pipe = QgsRasterPipe()
                if not pipe.set(layer.dataProvider().clone()):
                    feedback.reportError(f"Skipped '{layer.name()}': could not read data.")
                    continue
                pipe.set(layer.renderer().clone())
                writer = QgsRasterFileWriter(path)
                opts = ["COMPRESS=DEFLATE", "TILED=YES", "PHOTOMETRIC=RGB", "ALPHA=YES"]
                if hasattr(writer, "setCreationOptions"):
                    writer.setCreationOptions(opts)
                elif hasattr(writer, "setCreateOptions"):
                    writer.setCreateOptions(opts)
                res = writer.writeRaster(pipe, cols, rows, extent, layer.crs(), context.transformContext(), feedback)
                if not _ok(res):
                    feedback.reportError(f"Failed '{layer.name()}' (writer code {res}).")
                    continue
                # Tag bands as Red/Green/Blue/Alpha so every viewer shows true colours
                ds = gdal.Open(path, gdal.GA_Update)
                if ds is not None:
                    interp = [gdal.GCI_RedBand, gdal.GCI_GreenBand, gdal.GCI_BlueBand, gdal.GCI_AlphaBand]
                    for b in range(min(ds.RasterCount, 4)):
                        ds.GetRasterBand(b + 1).SetColorInterpretation(interp[b])
                    ds = None
            else:
                src = layer.source().split("|")[0]
                win = [extent.xMinimum(), extent.yMaximum(), extent.xMaximum(), extent.yMinimum()]
                ds = gdal.Translate(path, src, projWin=win, creationOptions=["COMPRESS=DEFLATE", "TILED=YES"])
                if ds is None:
                    feedback.reportError(f"Failed '{layer.name()}'.")
                    continue
                ds = None
                # Mask the swath-edge junk (about -140 dB) so it doesn't wreck the contrast
                ds = gdal.Open(path, gdal.GA_Update)
                if ds is not None and ds.RasterCount == 1:
                    band = ds.GetRasterBand(1)
                    arr = band.ReadAsArray()
                    if arr.dtype.kind == "f":
                        arr[arr < -60] = float("nan")
                        band.WriteArray(arr)
                        band.SetNoDataValue(float("nan"))
                    ds = None
                # Sidecar style: QGIS auto-applies <name>.qml, so the raw file opens with the same colours
                layer.saveNamedStyle(os.path.splitext(path)[0] + ".qml")

            written.append(path)
            feedback.pushInfo(f"Saved {path}")
            feedback.setProgress(100 * (i + 1) / len(layers))

        feedback.pushInfo(f"Done: {len(written)} file(s) written to {out_dir}")
        return {self.OUTPUT: out_dir}
