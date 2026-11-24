// Zero Universe Explorer: walk a real landing site as an astronaut.
import * as THREE from 'three';
import { SITES, SITE_ORDER } from './sites.js';
import { makeAstronaut, makeModel } from './models.js';
import { loadDem, demH as demHeight, makeSurround } from './terrain.js';
import * as M from './mission.js';

const params = new URLSearchParams(location.search);
const siteId = SITES[params.get('site')] ? params.get('site') : 'apollo11';
const S = SITES[siteId];
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DEG = Math.PI / 180;
const fmtDate = (iso) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

// ---------- progress ----------
const KEY = 'zu-walk-found';
let found = new Set();
try { found = new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch (e) { /* private mode */ }
const saveFound = () => { try { localStorage.setItem(KEY, JSON.stringify([...found])); } catch (e) { /* ignore */ } };

// ---------- terrain ----------
function hash(x, y) { const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, o = 5) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5; } return s; }
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const DEM = S.dem ? await loadDem(S.dem) : null;
const demH = (x, z) => demHeight(DEM, x, z);

const SIZE = 420, HALF = SIZE / 2;
// walkable area: a circle on generated ground, the data's box (less a margin) on real ground
const BOUND = DEM ? { x0: DEM.x0 + 6, x1: DEM.x1 - 6, z0: DEM.z0 + 6, z1: DEM.z1 - 6 } : null;
const LIMIT = 185;
const keepClear = [...S.items.map((i) => i.at), ...S.models.filter((m) => m.r).map((m) => m.pos)];
const craters = [...S.craters];
for (let k = 0, tries = 0; k < S.nCraters && tries < 2000; tries++) {
  const x = (hash(tries, 7.3) - 0.5) * 360, z = (hash(tries, 19.1) - 0.5) * 360;
  const r = 1.5 + Math.pow(hash(tries, 3.7), 3) * 16;
  if (keepClear.some(([px, pz]) => Math.hypot(px - x, pz - z) < r + 5)) continue;
  craters.push([x, z, r, r * (0.16 + 0.1 * hash(tries, 1.1))]); k++;
}
function craterH(x, z) {
  let h = 0;
  for (const [cx, cz, r, d] of craters) {
    const q = Math.hypot(x - cx, z - cz) / r;
    if (q > 1.8) continue;
    if (q < 1) h -= d * (1 - q * q);
    h += d * 0.32 * Math.exp(-(((q - 1) / 0.28) ** 2));
  }
  return h;
}
function height(x, z) {
  // real ground + texture finer than the 2 m data can show (small bumps only, no invented craters)
  if (DEM) return demH(x, z) + S.rough * (vnoise(x * 0.9, z * 0.9) - 0.5) + 0.4 * S.rough * (vnoise(x * 3.1 + 7, z * 3.1) - 0.5);
  const dist = Math.hypot(x, z);
  const flat = smooth(10, 32, dist);
  let h = S.rough * (fbm(x / 26 + 3, z / 26 + 9) - 0.5) * (0.35 + 0.65 * flat);
  h += 0.12 * S.rough * (vnoise(x * 0.9, z * 0.9) - 0.5);
  h += craterH(x, z);
  if (S.rimHills) h += S.rimHills * smooth(120, 205, dist) * (0.55 + 0.6 * fbm(x / 40, z / 40, 3));
  if (S.delta) h += 9 * smooth(52, 64, x + 10 * fbm(z / 18, 2, 3)) * (0.85 + 0.3 * fbm(x / 9, z / 9, 3));
  if (S.body === 'mars') h += 18 * smooth(140, 205, dist) * fbm(x / 50 + 4, z / 50, 3);
  if (S.ocean) { h *= 0.5; h -= 3.2 * smooth(120, 135, x); }
  return h;
}

// ---------- renderer & scene ----------
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = S.body === 'earth' ? 1.0 : 1.12;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 3000);

const SKY = { moon: 0x000000, mars: 0xc99a72, earth: 0x9cc6ea };
scene.background = new THREE.Color(SKY[S.body]);
if (S.body === 'mars') scene.fog = new THREE.Fog(0xc99a72, 90, 420);
if (S.body === 'earth') scene.fog = new THREE.Fog(0xbcd6ec, 160, 900);

const sunDir = new THREE.Vector3().setFromSphericalCoords(1, (90 - S.sun.el) * DEG, S.sun.az * DEG);
const sun = new THREE.DirectionalLight(0xffffff, S.body === 'mars' ? 2.4 : S.body === 'earth' ? 2.6 : 3.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 260 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);
const hemi = S.body === 'moon' ? new THREE.HemisphereLight(0x8a94a8, 0x3c3a37, 0.55)
  : S.body === 'mars' ? new THREE.HemisphereLight(0xe2b48c, 0x6b3a22, 0.9)
    : new THREE.HemisphereLight(0xcfe4f7, 0x6d6a50, 1.1);
scene.add(hemi);

// stars (Moon only: no air to hide them)
if (S.body === 'moon') {
  const n = 2400, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3().setFromSphericalCoords(1600, Math.acos(1 - 2 * hash(i, 1.7)), hash(i, 9.2) * Math.PI * 2);
    if (v.y < -50) v.y = -v.y;
    pos.set([v.x, v.y, v.z], i * 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.75, fog: false })));
}
function discSprite(size, draw, at) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, fog: false, depthWrite: false, transparent: true }));
  s.scale.setScalar(size); s.position.copy(at);
  scene.add(s); return s;
}
const sunSprite = discSprite(S.body === 'mars' ? 40 : 70, (c) => {
  const g = c.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,250,1)'); g.addColorStop(0.18, 'rgba(255,252,235,1)'); g.addColorStop(0.26, 'rgba(255,240,210,.35)'); g.addColorStop(1, 'rgba(255,230,200,0)');
  c.fillStyle = g; c.fillRect(0, 0, 256, 256);
}, sunDir.clone().multiplyScalar(1400));
if (S.earthInSky) {
  const eDir = new THREE.Vector3().setFromSphericalCoords(1, (90 - S.earthInSky.el) * DEG, S.earthInSky.az * DEG);
  discSprite(46, (c) => {
    c.save(); c.beginPath(); c.arc(128, 128, 100, 0, 7); c.clip();
    c.fillStyle = '#1f4f9a'; c.fillRect(0, 0, 256, 256);
    c.fillStyle = 'rgba(80,130,70,.9)'; c.beginPath(); c.ellipse(110, 150, 40, 26, 0.6, 0, 7); c.fill();
    c.fillStyle = 'rgba(255,255,255,.85)';
    for (let i = 0; i < 14; i++) { c.beginPath(); c.ellipse(40 + hash(i, 2) * 180, 40 + hash(i, 5) * 180, 30, 7, hash(i, 8) * 3, 0, 7); c.fill(); }
    c.fillStyle = 'rgba(0,0,0,.88)'; c.beginPath(); c.arc(60, 128, 112, 0, 7); c.fill(); // night side
    c.restore();
  }, eDir.multiplyScalar(1300));
}

// ground mesh
const SEG = 220;
const gGeo = DEM ? new THREE.PlaneGeometry(DEM.x1 - DEM.x0, DEM.z1 - DEM.z0, DEM.w - 1, DEM.h - 1) : new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
gGeo.rotateX(-Math.PI / 2);
if (DEM) gGeo.translate((DEM.x0 + DEM.x1) / 2, 0, (DEM.z0 + DEM.z1) / 2);
{
  const p = gGeo.attributes.position, col = new Float32Array(p.count * 3);
  const c1 = new THREE.Color(S.ground[0]), c2 = new THREE.Color(S.ground[1]), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), h = height(x, z);
    p.setY(i, h);
    const n = fbm(x / 9 + 50, z / 9, 3) * 0.7 + vnoise(x * 2.1, z * 2.1) * 0.3;
    c.copy(c2).lerp(c1, Math.min(1, Math.max(0, n * 1.25 - 0.1 + (DEM ? 0 : h * 0.04))));
    if (S.ocean && h < -1.2) c.set(0xd9cfa6);
    col.set([c.r, c.g, c.b], i * 3);
  }
  gGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  gGeo.computeVertexNormals();
}
const ground = new THREE.Mesh(gGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }));
ground.receiveShadow = true;
scene.add(ground);
if (DEM) scene.add(makeSurround(THREE, DEM, new THREE.Color(S.ground[0]).lerp(new THREE.Color(S.ground[1]), 0.6)));
if (S.ocean) {
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(2000, 3000), new THREE.MeshStandardMaterial({ color: 0x2f6f95, roughness: 0.25, metalness: 0.1 }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(1100, -1.6, 0); scene.add(sea);
}

// scattered rocks
{
  const n = S.body === 'earth' ? 0 : S.body === 'mars' ? 700 : 900;
  if (n) {
    const geo = new THREE.DodecahedronGeometry(1, 0);
    const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: new THREE.Color(S.ground[1]).multiplyScalar(0.92), flatShading: true, roughness: 1 }), n);
    im.castShadow = true; im.receiveShadow = true;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const x = (hash(i, 31.7) - 0.5) * 380, z = (hash(i, 57.3) - 0.5) * 380;
      const r = 0.06 + Math.pow(hash(i, 3.3), 4) * 0.7;
      const clear = keepClear.some(([px, pz]) => Math.hypot(px - x, pz - z) < 3.5);
      q.setFromEuler(new THREE.Euler(hash(i, 1) * 3, hash(i, 2) * 3, 0));
      s.set(r * 1.2, r * 0.7, r); v.set(x, height(x, z) + r * 0.2, z);
      if (clear) s.setScalar(0.0001);
      im.setMatrixAt(i, m.compose(v, q, s));
    }
    scene.add(im);
  }
}

// marks on the ground: boot prints and wheel tracks
function decals(points, w, l, color, opacity) {
  const geo = new THREE.CircleGeometry(0.5, 10);
  const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 1, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), points.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  points.forEach(([x, z, a], i) => {
    e.set(-Math.PI / 2, 0, a); q.setFromEuler(e);
    im.setMatrixAt(i, m.compose(new THREE.Vector3(x, height(x, z) + 0.03, z), q, new THREE.Vector3(w, l, 1)));
  });
  im.receiveShadow = true; scene.add(im);
}
const groundDark = new THREE.Color(S.ground[1]).multiplyScalar(0.55);
for (const md of S.models) {
  if (md.kind === 'prints') {
    const pts = [];
    for (let i = 0; i < 520; i++) {
      const a = hash(i, 4.4) * Math.PI * 2, r = 3 + Math.pow(hash(i, 6.6), 1.4) * 11;
      pts.push([Math.cos(a) * r, Math.sin(a) * r, hash(i, 8.8) * 6]);
    }
    // Armstrong's walk to Little West
    const [wx, wz] = (S.items.find((i) => i.id === 'a11-west') || { at: [27, -6] }).at;
    const steps = Math.round(Math.hypot(wx - 4, wz + 3) / 0.52), ang = Math.atan2(wx - 4, wz + 3);
    for (let i = 0; i < steps; i++) { const t = i / steps; pts.push([4 + (wx - 4) * t + (i % 2 ? 0.25 : -0.25) * Math.cos(ang), -3 + (wz + 3) * t - (i % 2 ? 0.25 : -0.25) * Math.sin(ang), ang]); }
    decals(pts, 0.16, 0.32, groundDark, 0.55);
  }
  if (md.kind === 'tracks') {
    const pts = [];
    const path = siteId === 'change4' ? (t) => [3 + t * 13, Math.sin(t * 2.2) * 5 + t * 10] : (t) => [-t * 40 * Math.cos(t * 1.4), 2 - t * 22 + Math.sin(t * 4) * 6];
    for (let i = 0; i < 260; i++) {
      const t = i / 260, [x, z] = path(t), [x2, z2] = path(t + 0.004);
      const a = Math.atan2(x2 - x, z2 - z), nx = Math.cos(a), nz = -Math.sin(a), w = siteId === 'change4' ? 0.45 : 1.25;
      pts.push([x + nx * w, z + nz * w, -a], [x - nx * w, z - nz * w, -a]);
    }
    decals(pts, 0.22, 0.32, groundDark, 0.45);
  }
}

// hardware models
const colliders = [];
for (const md of S.models) {
  const o = makeModel(md, S.ground[1]);
  if (!o) continue;
  const [x, z] = md.pos;
  o.position.set(x, md.kind === 'pad' ? height(x, z) + 0.05 : height(x, z), z);
  o.rotation.y = md.rot || 0;
  scene.add(o);
  if (md.r) colliders.push({ x, z, r: md.r });
}

// item markers
const markerGeo = new THREE.OctahedronGeometry(0.22, 0);
const markerMat = new THREE.MeshBasicMaterial({ color: 0xFF2D46, fog: false });
const markerDone = new THREE.MeshBasicMaterial({ color: 0xF4F1EA, fog: false });
const items = S.items.map((it) => {
  const [x, z] = it.at;
  const m = new THREE.Mesh(markerGeo, found.has(it.id) ? markerDone : markerMat);
  m.scale.y = 1.5;
  const base = height(x, z);
  m.position.set(x, base + 2.4, z);
  scene.add(m);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.9, 40), new THREE.MeshBasicMaterial({ color: 0xFF2D46, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(x, base + 0.06, z); scene.add(ring);
  const lbl = document.createElement('div'); lbl.className = 'wlbl'; lbl.textContent = it.name; $('labels').appendChild(lbl);
  return { ...it, m, ring, base, lbl, pos: new THREE.Vector3(x, base, z) };
});

// ---------- astronaut ----------
const astro = makeAstronaut();
scene.add(astro);
const P = { pos: new THREE.Vector3(S.spawn[0], 0, S.spawn[1]), vy: 0, onGround: true, yaw: 0, phase: 0, speed: 0 };
P.pos.y = height(P.pos.x, P.pos.z);
P.yaw = Math.atan2(S.face[0] - P.pos.x, S.face[1] - P.pos.z);
const cam = { yaw: P.yaw + Math.PI, pitch: 0.32, dist: 6.5 };

// ---------- input ----------
const keys = new Set();
const input = { mx: 0, mz: 0, run: false, jump: false, lookX: 0, lookY: 0 };
addEventListener('keydown', (e) => {
  if (e.target.closest && e.target.closest('input,textarea')) return;
  keys.add(e.code);
  if (e.code === 'Space') { input.jump = true; e.preventDefault(); }
  if (e.code === 'KeyE' || e.code === 'Enter') inspectNear();
  if (e.code === 'Escape') closePanel();
  if (e.code.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

// mouse / touch look and joystick
const joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
const look = { id: null, x: 0, y: 0 };
const pinch = new Map(); let pinch0 = 0; // two fingers on the camera side: pinch to zoom
const pinchDist = () => { const p = [...pinch.values()]; return p.length < 2 ? 0 : Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); };
const zoomBy = (f) => { cam.dist = Math.min(45, Math.max(2.2, cam.dist * f)); };
const joyEl = $('joy'), knob = $('joyKnob');
const tap = new Map();
canvas.addEventListener('pointerdown', (e) => {
  const touch = e.pointerType === 'touch';
  tap.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() });
  canvas.focus({ preventScroll: true });
  if (touch && e.clientX < innerWidth * 0.45 && joy.id === null) {
    Object.assign(joy, { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 });
    joyEl.style.transform = `translate(${e.clientX - 60}px, ${e.clientY - 60}px)`; joyEl.classList.add('on');
  } else {
    if (look.id === null) Object.assign(look, { id: e.pointerId, x: e.clientX, y: e.clientY });
    if (touch) { pinch.set(e.pointerId, { x: e.clientX, y: e.clientY }); pinch0 = pinchDist(); }
  }
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerId === joy.id) {
    let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy; const l = Math.hypot(dx, dy), mx = 50;
    if (l > mx) { dx *= mx / l; dy *= mx / l; }
    joy.x = dx / mx; joy.y = dy / mx; knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }
  const pp = pinch.get(e.pointerId);
  if (pp) { pp.x = e.clientX; pp.y = e.clientY; if (pinch.size >= 2) { const d = pinchDist(); if (pinch0 > 0 && d > 0) zoomBy(pinch0 / d); pinch0 = d; look.x = e.clientX; look.y = e.clientY; return; } }
  if (e.pointerId === look.id) {
    const k = e.pointerType === 'touch' ? 0.006 : 0.0045;
    cam.yaw -= (e.clientX - look.x) * k; cam.pitch += (e.clientY - look.y) * k;
    look.x = e.clientX; look.y = e.clientY;
  }
});
const endPtr = (e) => {
  const tp = tap.get(e.pointerId); tap.delete(e.pointerId);
  if (e.type === 'pointerup' && tp && Math.hypot(e.clientX - tp.x, e.clientY - tp.y) < 10 && performance.now() - tp.t < 450) walkTo(e.clientX, e.clientY);
  if (e.pointerId === joy.id) { joy.id = null; joy.x = joy.y = 0; knob.style.transform = ''; joyEl.classList.remove('on'); }
  if (e.pointerId === look.id) look.id = null;
  if (pinch.delete(e.pointerId)) { pinch0 = pinchDist(); if (look.id === null && pinch.size) { const [id, q] = [...pinch.entries()][0]; Object.assign(look, { id, x: q.x, y: q.y }); } }
};
canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);
canvas.addEventListener('wheel', (e) => { zoomBy(1 + Math.max(-0.3, Math.min(0.3, e.deltaY * 0.001))); e.preventDefault(); }, { passive: false });
canvas.addEventListener('dblclick', () => { cam.yaw = P.yaw + Math.PI; cam.pitch = 0.32; cam.dist = 6.5; });
// tap or click the ground (or a marker) to walk there
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const goalRing = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 32), new THREE.MeshBasicMaterial({ color: 0xFF2D46, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
goalRing.rotation.x = -Math.PI / 2; goalRing.visible = false; scene.add(goalRing);
function walkTo(cx, cy) {
  if (!started) return;
  const r = canvas.getBoundingClientRect();
  ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hitM = ray.intersectObjects(items.map((i) => i.m))[0];
  if (hitM) { const it = items.find((i) => i.m === hitM.object); P.goal = { x: it.at[0], z: it.at[1], item: it }; }
  else {
    const hit = ray.intersectObject(ground)[0];
    if (!hit) return;
    // snap to an item if the tap landed near one
    const it = items.find((i) => Math.hypot(i.at[0] - hit.point.x, i.at[1] - hit.point.z) < 2.2);
    P.goal = it ? { x: it.at[0], z: it.at[1], item: it } : { x: hit.point.x, z: hit.point.z, item: null };
  }
  goalRing.position.set(P.goal.x, height(P.goal.x, P.goal.z) + 0.08, P.goal.z);
  goalRing.visible = true;
}
$('jumpBtn').addEventListener('click', () => { input.jump = true; });
$('inspectBtn').addEventListener('click', () => inspectNear());
if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');

// gamepad (PS5 DualSense / any standard controller)
let padPrev = [];
let padName = null;
addEventListener('gamepadconnected', (e) => { padName = e.gamepad.id; toast('Controller connected', '🎮'); document.body.classList.add('pad'); });
addEventListener('gamepaddisconnected', () => { padName = null; document.body.classList.remove('pad'); });
function readPad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = [...pads].find((p) => p && p.connected);
  if (!gp) return null;
  const dz = (v) => (Math.abs(v) < 0.15 ? 0 : (v - Math.sign(v) * 0.15) / 0.85);
  const b = gp.buttons.map((x) => x.pressed);
  const pressed = (i) => b[i] && !padPrev[i];
  const r = { mx: dz(gp.axes[0] || 0), mz: dz(gp.axes[1] || 0), lx: dz(gp.axes[2] || 0), ly: dz(gp.axes[3] || 0), run: b[10] || b[7], jump: pressed(0), inspect: pressed(2) || pressed(3), back: pressed(1) };
  padPrev = b;
  return r;
}

// ---------- UI ----------
$('siteName').textContent = S.name;
$('totalCount').textContent = items.length;
const refreshCount = () => { $('foundCount').textContent = items.filter((i) => found.has(i.id)).length; };
refreshCount();
const panel = $('panel'), panelBody = $('panelBody');
function openPanel(html) { panelBody.innerHTML = html; panel.hidden = false; panel.scrollTop = 0; }
function closePanel() { panel.hidden = true; }
$('panelClose').addEventListener('click', closePanel);

let toastTimer;
function toast(msg, badge = '') {
  const t = $('toast'); t.innerHTML = `${badge ? `<b>${esc(badge)}</b>` : ''}<span>${esc(msg)}</span>`;
  t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

function inspect(it) {
  const isNew = !found.has(it.id);
  found.add(it.id); saveFound(); refreshCount();
  it.m.material = markerDone; it.ring.material.color.set(0xF4F1EA);
  const n = items.filter((i) => found.has(i.id)).length;
  openPanel(`
    <div class="meta"><span class="pill">${esc(S.mission)}</span><span>${esc(S.who)}</span>${isNew ? '<span class="found-badge">Found</span>' : ''}</div>
    <h2>${esc(it.title)}</h2>
    <p>${esc(it.text)}</p>
    <a class="src" href="${esc(it.src)}" target="_blank" rel="noopener">Source: ${esc(it.srcLabel)} ↗</a>
    <h3>${esc(S.name)} · ${n} of ${items.length} found</h3>
    <div class="bar"><i style="width:${(100 * n) / items.length}%"></i></div>${MISSION ? missionHook(it, isNew) : ''}`);
  if (MISSION) refreshPts();
  if (isNew && n === items.length) setTimeout(() => toast(`You found everything at ${S.name}`, '★'), 600);
}
let nearItem = null;
function inspectNear() { if (nearItem) inspect(nearItem); }

function openSites() {
  openPanel(`
    <h2>Landing sites</h2>
    <p class="fine">Walk the real places where spacecraft landed. Objects are placed closer together than in real life so you can reach them on foot.</p>
    <ul class="list">${SITE_ORDER.map((id) => {
      const s = SITES[id]; const n = s.items.filter((i) => found.has(i.id)).length;
      return `<li><a class="site-row ${id === siteId ? 'here' : ''}" href="walk.html?site=${id}"><span class="y">${s.date.slice(0, 4)}</span><span class="t">${esc(s.name)}<small>${esc(s.mission)} · ${esc(s.where)}</small></span><span class="n">${n}/${s.items.length}</span></a></li>`;
    }).join('')}</ul>
    <h3>Controls</h3>
    <p class="fine"><b>Keyboard:</b> WASD or arrows to walk, Shift to run, Space to jump, E to inspect, drag the mouse to look.<br><b>Touch:</b> left thumb to walk, right thumb to look, buttons to jump and inspect.<br><b>Controller (PS5 DualSense or other):</b> left stick to walk, right stick to look, Cross to jump, Square to inspect, Circle to close, R1 or R2 to run.</p>`);
}
$('sitesBtn').addEventListener('click', openSites);

// ---------- Mission 1 (Apollo 11): points, field notes, questions, patch ----------
const MISSION = siteId === 'apollo11';
const ptsBtn = $('ptsBtn');
function refreshPts() { if (!MISSION) return; const sc = M.score(items, found); ptsBtn.innerHTML = `<b>${sc.total}</b><span class="fw"> pts</span>`; }
function missionHook(it, isNew) {
  const q = M.QUESTIONS.find((x) => x.needs === it.id); const st = M.load();
  const pts = isNew ? `<p class="fine">+${M.PTS.find} points for finding it. Field note saved to your mission log.</p>` : '';
  if (!q) return pts;
  const r = st.q[q.id];
  return pts + (r && r.ok ? `<button class="btn small" data-mission="log">Mission log</button>`
    : `<button class="btn small primary" data-q="${q.id}">Answer a question about this · +${M.PTS.qFirst}</button>`);
}
function openMission() {
  const st = M.load(), sc = M.score(items, found, st);
  const qRow = (q, i) => {
    const r = st.q[q.id], open = found.has(q.needs), it = items.find((x) => x.id === q.needs);
    const state = r && r.ok ? `<span class="n ok">+${r.tries === 1 ? M.PTS.qFirst : M.PTS.qLater}</span>` : open ? '<span class="n">Answer</span>' : '<span class="n">Locked</span>';
    return `<li><button class="qrow ${open ? '' : 'locked'}" ${open ? `data-q="${q.id}"` : 'disabled'}><span class="y">Q${i + 1}</span><span class="t">${esc(q.q)}${open ? '' : `<small>Find the ${esc(it ? it.name.toLowerCase() : 'object')} to unlock</small>`}</span>${state}</button></li>`;
  };
  const notes = items.filter((i) => found.has(i.id));
  openPanel(`
    <div class="meta"><span class="pill">Mission 1</span><span>Apollo 11</span></div>
    <h2>Mission log</h2>
    <div class="score"><b>${sc.total}</b><span>of ${sc.max} points</span></div>
    <table class="tally"><tbody>
      <tr><th>Things found</th><td>${sc.finds} of ${items.length}</td><td>${sc.findPts}</td></tr>
      <tr><th>Land the Eagle (best)</th><td>${st.land ? esc(st.land.verdict) : 'Not flown yet'}</td><td>${sc.land}</td></tr>
      <tr><th>Questions</th><td>${sc.answered} of ${M.QUESTIONS.length}</td><td>${sc.qPts}</td></tr>
    </tbody></table>
    <div class="patch-box">${M.patchSVG(sc.patch, 150)}<p>${sc.patch ? '<b>Patch earned.</b> Our own design for Mission 1, drawn in code.' : `Answer all ${M.QUESTIONS.length} questions to earn the Apollo 11 patch.`}</p></div>
    <a class="btn small" href="land.html">${st.land ? 'Fly Land the Eagle again' : 'Fly Land the Eagle · up to 100'}</a>
    <h3>Questions</h3>
    <ul class="list">${M.QUESTIONS.map(qRow).join('')}</ul>
    <h3>Field notes</h3>
    ${notes.length ? `<ul class="notes">${notes.map((i) => `<li><b>${esc(i.title)}</b>${esc(i.text)} <a href="${esc(i.src)}" target="_blank" rel="noopener">Source ↗</a></li>`).join('')}</ul>` : '<p class="fine">Walk up to the red markers and inspect them to fill your notebook.</p>'}
    <p class="fine">Progress is saved in this browser. <button class="linkbtn" data-mission="reset">Start the mission over</button></p>`);
}
function openQuestion(qid) {
  const q = M.QUESTIONS.find((x) => x.id === qid); if (!q) return;
  const st = M.load(), r = st.q[q.id];
  // shuffle the options, but the same way every time for a given question
  const order = q.a.map((_, i) => i).sort((a, b) => ((a * 7 + q.id.length * 3) % 5) - ((b * 7 + q.id.length * 3) % 5));
  openPanel(`
    <div class="meta"><span class="pill">Question ${M.QUESTIONS.indexOf(q) + 1} of ${M.QUESTIONS.length}</span></div>
    <h2 class="q">${esc(q.q)}</h2>
    <ul class="answers">${order.map((i) => `<li><button data-a="${i}" ${r && r.ok ? 'disabled' : ''} class="${r && r.ok && i === 0 ? 'right' : ''}">${esc(q.a[i])}</button></li>`).join('')}</ul>
    <div id="qResult">${r && r.ok ? qExplain(q, r) : `<p class="fine">${r && r.tries ? 'Not quite. Try again for ' + M.PTS.qLater + ' points.' : `${M.PTS.qFirst} points first try, ${M.PTS.qLater} after that.`}</p>`}</div>`);
  panelBody.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => {
    const ok = b.dataset.a === '0'; const res = M.answer(M.load(), q.id, ok);
    if (ok) {
      panelBody.querySelectorAll('[data-a]').forEach((x) => { x.disabled = true; });
      b.classList.add('right'); $('qResult').innerHTML = qExplain(q, res); refreshPts();
      const sc = M.score(items, found);
      toast(`+${res.tries === 1 ? M.PTS.qFirst : M.PTS.qLater} points`, '✓');
      if (sc.patch && sc.answered === M.QUESTIONS.length && res.tries) setTimeout(() => { toast('You earned the Apollo 11 patch', '★'); }, 900);
    } else { b.classList.add('wrong'); b.disabled = true; $('qResult').innerHTML = `<p class="fine">Not quite. Try again for ${M.PTS.qLater} points.</p>`; }
  }));
}
function qExplain(q, r) {
  return `<p><b class="ok">Right${r.tries === 1 ? ', first try' : ''}.</b> ${esc(q.why)}</p>
    <a class="src" href="${esc(q.src)}" target="_blank" rel="noopener">Source: ${esc(q.srcLabel)} ↗</a>
    <p><button class="btn small" data-mission="log">Mission log</button></p>`;
}
if (MISSION) {
  ptsBtn.hidden = false; refreshPts();
  ptsBtn.addEventListener('click', openMission);
  panelBody.addEventListener('click', (e) => {
    const t = e.target.closest('[data-q],[data-mission]'); if (!t) return;
    if (t.dataset.q) openQuestion(t.dataset.q);
    else if (t.dataset.mission === 'log') openMission();
    else if (t.dataset.mission === 'reset' && confirm('Clear your Apollo 11 points, answers and finds in this browser?')) {
      try { localStorage.removeItem('zu-a11-mission'); } catch (e2) { /* ignore */ }
      items.forEach((i) => { found.delete(i.id); i.m.material = markerMat; i.ring.material.color.set(0xFF2D46); }); found.delete('a11-landed'); saveFound(); refreshCount(); refreshPts(); openMission();
    }
  });
}

// intro
$('introTitle').textContent = S.name;
$('introMeta').textContent = `${fmtDate(S.date)} · ${S.mission} · ${S.who}`;
$('introText').textContent = S.intro;
$('introWhere').textContent = S.where;
if (S.dem) $('introFine').textContent = 'Walk up to a red marker and inspect it. The ground is NASA’s real elevation map and the equipment stands where it really stands, so some things are a short walk away. Works with a PS5 or other game controller.';
const startBtn = $('startBtn');
startBtn.addEventListener('click', () => {
  $('intro').classList.add('gone'); started = true;
  canvas.focus({ preventScroll: true });
  toast(matchMedia('(pointer: coarse)').matches ? 'Tap the ground to walk there, or drag on the left to steer' : 'Click the ground to walk there, or use W A S D / arrow keys', '→');
});
let started = false;

// ---------- loop ----------
const tmp = new THREE.Vector3(), camTarget = new THREE.Vector3(), fwd = new THREE.Vector3(), right = new THREE.Vector3();
let last = performance.now();
let guideT = 0;
function step(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const pad = readPad();
  if (pad && (pad.mx || pad.mz || pad.jump || pad.inspect) && !started) { $('intro').classList.add('gone'); started = true; }

  // movement intent
  let mx = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  let mz = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
  mx += joy.x; mz += joy.y;
  let run = keys.has('ShiftLeft') || keys.has('ShiftRight') || Math.hypot(joy.x, joy.y) > 0.95;
  if (pad) {
    mx += pad.mx; mz += pad.mz; run = run || pad.run;
    cam.yaw -= pad.lx * 2.6 * dt; cam.pitch += pad.ly * 1.8 * dt;
    if (pad.jump) input.jump = true;
    if (pad.inspect) { if (!panel.hidden) closePanel(); else inspectNear(); }
    if (pad.back) closePanel();
  }
  if (keys.has('Equal') || keys.has('NumpadAdd')) zoomBy(1 - 1.2 * dt);
  if (keys.has('Minus') || keys.has('NumpadSubtract')) zoomBy(1 + 1.2 * dt);
  cam.pitch = Math.min(1.5, Math.max(-0.45, cam.pitch));
  let mag = Math.hypot(mx, mz);
  if (mag > 1) { mx /= mag; mz /= mag; mag = 1; }
  if (!started) mag = 0;
  let goalDir = null;
  if (mag > 0.05) { P.goal = null; goalRing.visible = false; }
  else if (P.goal && started) {
    const gx = P.goal.x - P.pos.x, gz = P.goal.z - P.pos.z, gd = Math.hypot(gx, gz);
    const stopAt = P.goal.item ? 1.4 : 0.35;
    if (gd < stopAt || (P.goal.t = (P.goal.t || 0) + dt) > 15) {
      if (P.goal.item && gd < 2.6) inspect(P.goal.item);
      P.goal = null; goalRing.visible = false;
    } else { goalDir = Math.atan2(gx, gz); mag = Math.min(1, gd / 1.5 + 0.3); run = gd > 14; }
  }

  // camera-relative direction
  fwd.set(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw));
  right.set(-fwd.z, 0, fwd.x);
  const target = mag > 0.05 ? (run ? S.speed * 2 : S.speed) * mag : 0;
  P.speed += (target - P.speed) * Math.min(1, dt * (P.onGround ? 8 : 1.5));
  if (mag > 0.05) {
    tmp.copy(fwd).multiplyScalar(-mz).addScaledVector(right, mx).normalize();
    const want = goalDir !== null ? goalDir : Math.atan2(tmp.x, tmp.z);
    let d = want - P.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
    P.yaw += d * Math.min(1, dt * 10);
  }
  P.pos.x += Math.sin(P.yaw) * P.speed * dt;
  P.pos.z += Math.cos(P.yaw) * P.speed * dt;
  // collisions
  for (const c of colliders) {
    const dx = P.pos.x - c.x, dz = P.pos.z - c.z, l = Math.hypot(dx, dz), min = c.r + 0.4;
    if (l < min && l > 0.0001) { P.pos.x = c.x + (dx / l) * min; P.pos.z = c.z + (dz / l) * min; }
  }
  if (BOUND) {
    P.pos.x = Math.min(BOUND.x1, Math.max(BOUND.x0, P.pos.x)); P.pos.z = Math.min(BOUND.z1, Math.max(BOUND.z0, P.pos.z));
  } else {
    const rr = Math.hypot(P.pos.x, P.pos.z);
    if (rr > LIMIT) { P.pos.x *= LIMIT / rr; P.pos.z *= LIMIT / rr; }
  }
  if (S.ocean && P.pos.x > 118) P.pos.x = 118;

  // gravity and jumping
  const gy = height(P.pos.x, P.pos.z);
  if (input.jump && P.onGround && started) { P.vy = S.jump; P.onGround = false; }
  input.jump = false;
  P.vy -= S.gravity * dt;
  P.pos.y += P.vy * dt;
  if (P.pos.y <= gy) { P.pos.y = gy; P.vy = 0; P.onGround = true; } else if (P.pos.y > gy + 0.05) P.onGround = false;

  // pose
  const lowG = S.gravity < 5;
  const moving = P.speed > 0.2;
  P.phase += dt * (lowG ? 5.2 : 7.5) * Math.min(1.6, P.speed / S.speed);
  const amp = moving ? Math.min(0.75, 0.25 + P.speed * 0.1) : 0;
  const sw = Math.sin(P.phase) * amp;
  const u = astro.userData;
  const air = !P.onGround;
  u.legL.rotation.x += ((air ? -0.5 : sw) - u.legL.rotation.x) * Math.min(1, dt * 12);
  u.legR.rotation.x += ((air ? 0.3 : -sw) - u.legR.rotation.x) * Math.min(1, dt * 12);
  u.armL.rotation.x += ((air ? -0.6 : -sw * 0.6) - u.armL.rotation.x) * Math.min(1, dt * 12);
  u.armR.rotation.x += ((air ? -0.6 : sw * 0.6) - u.armR.rotation.x) * Math.min(1, dt * 12);
  u.armL.rotation.z = 0.12; u.armR.rotation.z = -0.12;
  u.body.position.y = moving && P.onGround ? Math.abs(Math.sin(P.phase)) * (lowG ? 0.16 : 0.06) : 0;
  u.body.rotation.x = moving ? Math.min(0.2, P.speed * 0.03) : 0;
  astro.position.copy(P.pos);
  astro.rotation.y = P.yaw;

  // camera
  camTarget.set(P.pos.x, P.pos.y + 1.5, P.pos.z);
  const cp = Math.cos(cam.pitch);
  camera.position.set(camTarget.x + Math.sin(cam.yaw) * cp * cam.dist, camTarget.y + Math.sin(cam.pitch) * cam.dist, camTarget.z + Math.cos(cam.yaw) * cp * cam.dist);
  const ch = height(camera.position.x, camera.position.z) + 0.5;
  if (camera.position.y < ch) camera.position.y = ch;
  camera.lookAt(camTarget);

  // light follows the player
  sun.position.copy(P.pos).addScaledVector(sunDir, 120);
  sun.target.position.copy(P.pos);
  sunSprite.position.copy(camera.position).addScaledVector(sunDir, 1400);

  // markers, labels, nearest item
  nearItem = null; let best = 1e9; let nextUnfound = null, nextD = 1e9;
  const t = now / 1000;
  for (const it of items) {
    it.m.rotation.y = t * 1.5;
    it.m.position.y = it.base + 2.4 + Math.sin(t * 2 + it.at[0]) * 0.12;
    const d = Math.hypot(P.pos.x - it.at[0], P.pos.z - it.at[1]);
    if (d < 2.6 && d < best) { best = d; nearItem = it; }
    if (!found.has(it.id) && d < nextD) { nextD = d; nextUnfound = it; }
    tmp.set(it.at[0], it.base + 3.05, it.at[1]).project(camera);
    const vis = tmp.z < 1 && d < 45 && Math.abs(tmp.x) < 1.1 && Math.abs(tmp.y) < 1.1;
    it.lbl.style.opacity = vis ? String(Math.min(1, (45 - d) / 15)) : '0';
    if (vis) it.lbl.style.transform = `translate(${((tmp.x + 1) / 2) * innerWidth}px, ${((1 - tmp.y) / 2) * innerHeight}px) translate(-50%, -100%)`;
    it.lbl.classList.toggle('done', found.has(it.id));
  }
  const pr = $('prompt');
  if (nearItem && started) {
    pr.innerHTML = `<b>${esc(nearItem.name)}</b><span class="k k-key">E</span><span class="k k-pad">▢</span><span class="k k-touch">Tap Inspect</span>`;
    pr.classList.add('show'); document.body.classList.add('near');
  } else { pr.classList.remove('show'); document.body.classList.remove('near'); }

  // guide arrow to the nearest thing not found yet
  guideT -= dt;
  if (guideT <= 0) {
    guideT = 0.1;
    const g = $('guide');
    if (nextUnfound && started) {
      const ang = Math.atan2(nextUnfound.at[0] - P.pos.x, nextUnfound.at[1] - P.pos.z);
      const rel = ang - (cam.yaw + Math.PI);
      g.innerHTML = `<i style="transform:rotate(${(-rel * 180) / Math.PI}deg)">▲</i><span>${esc(nextUnfound.name)} · ${Math.round(nextD)} m</span>`;
      g.classList.add('show');
    } else g.classList.remove('show');
  }

  renderer.render(scene, camera);
  requestAnimationFrame(step);
}

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.fov = w < h ? 68 : 55; camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();
requestAnimationFrame(step);
if (siteId === 'apollo11') $('landBtn').hidden = false;
window.__walk = { openMission: () => openMission(), openQuestion: (q) => openQuestion(q), M, found, P, cam, items, inspect, S, height, dem: () => DEM && demH };
