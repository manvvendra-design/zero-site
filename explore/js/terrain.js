// Real elevation data shared by walk mode and the landing task.
// A site's `dem` points at base64 text of little-endian 16-bit samples on a regular grid
// (+x east, +z south, metres relative to the landing point), made by tools/prep_dem.py.

export async function loadDem(d) {
  try {
    const r = await fetch(new URL('../' + d.url, import.meta.url));
    if (!r.ok) throw new Error(r.status);
    const bin = atob((await r.text()).trim()), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const q = new Uint16Array(u8.buffer);
    if (q.length !== d.w * d.h) throw new Error('size');
    const f = new Float32Array(q.length), k = (d.max - d.min) / 65535;
    for (let i = 0; i < q.length; i++) f[i] = d.min + q[i] * k;
    return { ...d, z: f, x0: -d.west, z0: -d.north, x1: -d.west + (d.w - 1) * d.spacing, z1: -d.north + (d.h - 1) * d.spacing };
  } catch (e) { console.warn('Elevation data not loaded', e); return null; }
}

// bilinear height at (x, z); outside the grid the edge value is used
export function demH(D, x, z) {
  const s = D.spacing;
  const gx = Math.min(D.w - 1.001, Math.max(0, (x - D.x0) / s)), gz = Math.min(D.h - 1.001, Math.max(0, (z - D.z0) / s));
  const i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j, w = D.w, a = D.z;
  const h00 = a[j * w + i], h10 = a[j * w + i + 1], h01 = a[(j + 1) * w + i], h11 = a[(j + 1) * w + i + 1];
  return (h00 * (1 - fx) + h10 * fx) * (1 - fz) + (h01 * (1 - fx) + h11 * fx) * fz;
}

// Coarse ground reaching to the horizon beyond the data, so its edges never show.
// Heights repeat the data's edge values outward; it sits slightly lower so the real mesh always wins.
export function makeSurround(THREE, D, color, size = 9000, step = 60) {
  const n = Math.round(size / step), geo = new THREE.PlaneGeometry(size, size, n, n);
  geo.rotateX(-Math.PI / 2);
  const cx = (D.x0 + D.x1) / 2, cz = (D.z0 + D.z1) / 2;
  geo.translate(cx, 0, cz);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const inside = x > D.x0 && x < D.x1 && z > D.z0 && z < D.z1;
    p.setY(i, inside ? D.min - 80 : demH(D, x, z) - 0.6);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0 }));
  m.receiveShadow = true;
  return m;
}
