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

// ---------- photoreal ground, made in code ----------
// A tileable grey regolith texture: layered value noise plus thousands of tiny craters
// (dark floor, bright rim), the way the Moon's surface looks at boot scale.
export function regolithTexture(THREE, N = 512, seed = 7) {
  const rnd = (i, j, s) => { const v = Math.sin(i * 127.1 + j * 311.7 + s * 74.7) * 43758.5453; return v - Math.floor(v); };
  const f = new Float32Array(N * N);
  // periodic value noise, several octaves
  for (const [cells, amp] of [[8, 0.35], [16, 0.25], [32, 0.18], [64, 0.12], [128, 0.1]]) {
    const cs = N / cells;
    for (let y = 0; y < N; y++) {
      const gy = y / cs, j = Math.floor(gy), ty = gy - j, sy = ty * ty * (3 - 2 * ty);
      for (let x = 0; x < N; x++) {
        const gx = x / cs, i = Math.floor(gx), tx = gx - i, sx = tx * tx * (3 - 2 * tx);
        const i1 = (i + 1) % cells, j1 = (j + 1) % cells;
        const a = rnd(i, j, seed + cells), b = rnd(i1, j, seed + cells), c = rnd(i, j1, seed + cells), d = rnd(i1, j1, seed + cells);
        f[y * N + x] += amp * ((a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy);
      }
    }
  }
  // small craters: many tiny, few larger (a rough power law), wrapped at the edges so it tiles
  for (let k = 0; k < 900; k++) {
    const r = 2 + Math.pow(rnd(k, 1, seed), 3.2) * 34, cx = rnd(k, 2, seed) * N, cy = rnd(k, 3, seed) * N, depth = 0.12 + 0.18 * rnd(k, 4, seed);
    const R = Math.ceil(r * 1.6);
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const q = Math.hypot(dx, dy) / r; if (q > 1.6) continue;
      const v = q < 1 ? -depth * (1 - q * q) * 0.9 + depth * 0.35 * q * q * q : depth * 0.35 * Math.max(0, 1 - (q - 1) / 0.6) ** 2;
      const x = ((Math.round(cx + dx) % N) + N) % N, y = ((Math.round(cy + dy) % N) + N) % N;
      f[y * N + x] += v;
    }
  }
  let lo = 1e9, hi = -1e9; for (const v of f) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const c = document.createElement('canvas'); c.width = c.height = N;
  const ctx = c.getContext('2d'), img = ctx.createImageData(N, N);
  for (let i = 0; i < N * N; i++) { const g = Math.round((255 * (f[i] - lo)) / (hi - lo)); img.data.set([g, g, g, 255], i * 4); }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}

// Ground material: vertex colours carry the large-scale brightness from the elevation data;
// the regolith texture adds detail at three scales in world space (4 m, 31 m, 230 m) so tiling never shows,
// and a bump map adds the grain that catches the low sun.
export function regolithMaterial(THREE, tex, { w, d, color = null } = {}) {
  const bump = tex.clone(); bump.needsUpdate = true; bump.repeat.set(w / 4, d / 4);
  const m = new THREE.MeshStandardMaterial({ vertexColors: !color, color: color || 0xffffff, roughness: 1, metalness: 0, bumpMap: bump, bumpScale: 0.6 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.detail = { value: tex };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vWXZ;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWXZ = (modelMatrix * vec4(position, 1.0)).xz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D detail;\nvarying vec2 vWXZ;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float d1 = texture2D(detail, vWXZ / 4.0).r;
        float d2 = texture2D(detail, vWXZ / 31.0 + 0.37).r;
        float d3 = texture2D(detail, vWXZ / 230.0 + 0.71).r;
        diffuseColor.rgb *= (0.62 + 0.76 * d1) * (0.8 + 0.4 * d2) * (0.86 + 0.28 * d3);`);
  };
  return m;
}

// Brightness from the shape of the ground: fresh crater rims and steep walls expose brighter, less weathered
// soil; flat old ground is darker. Returns a multiplier around 1.
export function demAlbedo(D, x, z) {
  const s = 2, h = demH(D, x, z);
  const lap = demH(D, x + s, z) + demH(D, x - s, z) + demH(D, x, z + s) + demH(D, x, z - s) - 4 * h;
  const sx = (demH(D, x + s, z) - demH(D, x - s, z)) / (2 * s), sz = (demH(D, x, z + s) - demH(D, x, z - s)) / (2 * s);
  const slope = Math.hypot(sx, sz);
  return Math.min(1.45, Math.max(0.8, 1 + Math.max(-0.15, Math.min(0.25, -lap * 0.6)) + Math.min(0.2, slope * 0.35)));
}

// Irregular rock shapes: an icosphere pushed in and out by noise, flat-shaded like broken basalt.
export function rockGeometry(THREE, seed) {
  const g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position, v = new THREE.Vector3();
  const k = (a) => Math.sin(a * 12.9898 + seed * 78.233) * 43758.5453 % 1;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = 0.78 + 0.4 * Math.abs(k(Math.round(v.x * 7) * 3 + Math.round(v.y * 7) * 7 + Math.round(v.z * 7) * 13));
    v.multiplyScalar(n); v.y *= 0.72; p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}
