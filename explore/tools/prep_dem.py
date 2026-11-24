import sys, math, json, numpy as np, tifffile
src, out = sys.argv[1], sys.argv[2]
R=1737400.0; lat0=math.radians(1.0); lon0=180.0
x0, y0, px = -4748754.0000014, 37496.000000011, 2.0000000000006
lat, lon = 0.67408, 23.47297   # LM position, LROC (Wagner et al.)
dl = ((lon - lon0 + 180) % 360) - 180
X = R*math.cos(lat0)*math.radians(dl); Y = R*math.radians(lat)
col = (X - x0)/px - 0.5; row = (y0 - Y)/px - 0.5   # pixel-centre coordinates
print('LM pixel (centre-based):', round(col,2), round(row,2))
a = tifffile.imread(src)
c, r = int(round(col)), int(round(row))
W0, W1, N0, N1 = 200, 400, 200, 200   # samples west/east/north/south of LM (2 m each)
t = a[r-N0:r+N1+1, c-W0:c+W1+1].astype(np.float64)
assert (t > -1e30).all(), 'nodata in crop'
h0 = float(a[r, c]); t -= h0
lo, hi = float(t.min()), float(t.max())
q = np.round((t - lo)/(hi - lo)*65535).astype('<u2')
q.tofile(out)
err = np.abs(q/65535*(hi-lo)+lo - t).max()
meta = dict(w=t.shape[1], h=t.shape[0], spacing=2, west=W0*2, north=N0*2, min=round(lo,4), max=round(hi,4), lmPixel=[c, r], quantErr_m=round(float(err),4))
print(json.dumps(meta))
np.save(out+'.npy', t)
