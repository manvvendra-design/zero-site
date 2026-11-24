# Zero Universe: Unreal / Blender pipeline (cloud)

Runs on a Runpod GPU pod; durable files live on the network volume at `/workspace`.

- `pod/setup_blender.sh`: installs Blender 4.2 LTS (headless) and GDAL.
- `pod/prep_apollo11_terrain.sh`: crops a 2 km tile around Tranquility Base from NASA's LROC NAC DTM
  (`NAC_DTM_APOLLO11`, 2 m/pixel, public domain) into a 16-bit heightmap.
- `blender/render_tranquility.py`: Cycles render of the site with the NASA 3D Resources Apollo Lunar Module.

Sources: LROC NAC DTM via the PDS (pds.lroc.asu.edu), NASA 3D Resources (github.com/nasa/NASA-3D-Resources).
