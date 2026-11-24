#!/usr/bin/env bash
# Installs Blender (headless, GPU Cycles) and GDAL on a Runpod pod.
# Everything durable lives in /workspace (the network volume); tools go on the container disk.
set -euo pipefail
BLENDER_VER=4.2.3
mkdir -p /workspace/tools /workspace/data /workspace/renders /workspace/logs
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq gdal-bin python3-gdal libxi6 libxxf86vm1 libxfixes3 libxrender1 libgl1 libegl1 libxkbcommon0 libsm6 xz-utils wget unzip git-lfs >/dev/null
if [ ! -x /workspace/tools/blender/blender ]; then
  cd /workspace/tools
  wget -q "https://download.blender.org/release/Blender${BLENDER_VER%.*}/blender-${BLENDER_VER}-linux-x64.tar.xz" -O blender.tar.xz
  tar -xf blender.tar.xz && rm blender.tar.xz
  mv "blender-${BLENDER_VER}-linux-x64" blender
fi
/workspace/tools/blender/blender -b --version | head -1
gdalinfo --version
