#!/usr/bin/env bash
# Crops a 2 km x 2 km tile around Tranquility Base from NASA's LROC NAC DTM (2 m/pixel)
# and writes a 16-bit heightmap PNG plus its height range, for Blender and Unreal.
set -euo pipefail
cd /workspace/data/apollo11
SRC=NAC_DTM_APOLLO11.TIF
# Lunar module position (0.67408 N, 23.47297 E) -> pixel (1526, 8528) in this DTM's eqc projection.
gdal_translate -q -srcwin 1022 8024 1009 1009 $SRC tile_a11.tif
read MIN MAX < <(gdalinfo -stats tile_a11.tif | awk -F= '/STATISTICS_MINIMUM/{mn=$2} /STATISTICS_MAXIMUM/{mx=$2} END{print mn, mx}')
gdal_translate -q -ot UInt16 -scale $MIN $MAX 0 65535 -of PNG tile_a11.tif tile_a11_16bit.png
CENTER=$(gdallocationinfo -valonly tile_a11.tif 504 504)
echo "{\"min\": $MIN, \"max\": $MAX, \"lm\": $CENTER, \"pixel_m\": 2, \"size_px\": 1009}" > tile_a11.json
cat tile_a11.json
