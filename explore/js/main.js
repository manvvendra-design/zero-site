import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { PLANETS, SMALL_BODIES, MOON_EL, PROBES } from './bodies.js';
import { TRAJ } from './trajectories.js';
import { ACHIEVEMENTS, QUESTS } from './achievements.js';
import { EPOCH_JD, jdFromIso, dateFromJd, keplerPosition, orbitPath, trajPosition, toMap, mapRadius } from './orbit.js';

// ---------- time ----------
const START_JD = jdFromIso('1957-09-01');
const END_JD = EPOCH_JD; // today, 24 Nov 2026
const state = { jd: END_JD, playing: false, speed: 365.25 / 4 /* days per second */, focus: null, quest: null };

// ---------- progress (per browser) ----------
const STORE = 'zu-explorer-found-v1';
let found = new Set();
try { found = new Set(JSON.parse(localStorage.getItem(STORE) || '[]')); } catch (e) { /* private mode */ }
function saveFound() { try { localStorage.setItem(STORE, JSON.stringify([...found])); } catch (e) { /* ignore */ } }

for (const a of ACHIEVEMENTS) a.jd = jdFromIso(a.date);
ACHIEVEMENTS.sort((x, y) => x.jd - y.jd);
const byId = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

// ---------- renderer ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#0D0E11');
const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 4000);
camera.position.set(0, 95, 150);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 1.2;
controls.maxDistance = 420;
controls.target.set(0, 0, 0);

scene.add(new THREE.AmbientLight(0xffffff, 0.16));
const sunLight = new THREE.PointLight(0xfff1dc, 2.4, 0, 0);
scene.add(sunLight);

// ---------- helpers ----------
const tmp = [0, 0, 0];
const v3 = () => new THREE.Vector3();
function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646; }

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Code-drawn surfaces: bands for giant planets, speckle for rocky worlds. Artistic, not maps.
function planetTexture(p) {
  const base = new THREE.Color(p.color);
  const r = rng(p.name.length * 7919 + p.size * 1000);
  return canvasTexture(256, 128, (g, w, h) => {
    g.fillStyle = p.color; g.fillRect(0, 0, w, h);
    const giant = ['jupiter', 'saturn', 'uranus', 'neptune'].includes(p.key);
    if (giant) {
      for (let y = 0; y < h; y += 2) {
        const k = Math.sin(y * 0.21 + r() * 0.6) * 0.5 + Math.sin(y * 0.07) * 0.5;
        const c = base.clone().offsetHSL(0, 0, k * (p.key === 'jupiter' ? 0.12 : 0.05));
        g.fillStyle = '#' + c.getHexString(); g.fillRect(0, y, w, 2);
      }
      if (p.key === 'jupiter') { g.fillStyle = 'rgba(178,84,52,.85)'; g.beginPath(); g.ellipse(w * 0.62, h * 0.64, 14, 7, 0, 0, Math.PI * 2); g.fill(); }
    } else {
      for (let i = 0; i < 900; i++) {
        const c = base.clone().offsetHSL(0, (r() - 0.5) * 0.08, (r() - 0.5) * 0.18);
        g.fillStyle = '#' + c.getHexString(); g.globalAlpha = 0.5;
        g.beginPath(); g.arc(r() * w, r() * h, 1 + r() * 6, 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1;
      if (p.key === 'earth') {
        g.fillStyle = '#3f7f4a';
        for (let i = 0; i < 70; i++) { g.globalAlpha = 0.7 + r() * 0.3; g.beginPath(); g.ellipse(r() * w, h * 0.15 + r() * h * 0.7, 3 + r() * 11, 2 + r() * 7, r() * 3, 0, Math.PI * 2); g.fill(); } g.globalAlpha = 1;
        g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(0, 0, w, 7); g.fillRect(0, h - 7, w, 7);
      }
      if (p.key === 'mars') { g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(0, 0, w, 5); g.fillRect(0, h - 4, w, 4); }
    }
  });
}

function glowSprite(color, size, opacity = 1) {
  const tex = canvasTexture(128, 128, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.2, 'rgba(255,255,255,.55)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  });
  const m = new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
  const s = new THREE.Sprite(m);
  s.scale.set(size, size, 1);
  return s;
}

// Subdivide straight segments in real space, so the log-compressed map draws them as smooth curves.
function subdivide(pts, k) {
  if (k <= 1) return pts;
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    for (let j = 0; j < k; j++) { const u = j / k; out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]); }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
function lineFromPoints(pts, color, opacity) {
  const g = new THREE.BufferGeometry();
  const arr = new Float32Array(pts.length * 3);
  const p = v3();
  pts.forEach((q, i) => { toMap(q, p); arr.set([p.x, p.y, p.z], i * 3); });
  g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  return new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
}

// ---------- labels (DOM, projected each frame) ----------
const labelLayer = document.getElementById('labels');
const labels = [];
function addLabel(text, cls, getPos, dy = 14) {
  const el = document.createElement('div');
  el.className = 'lbl ' + cls;
  el.setAttribute('aria-hidden', 'true');
  el.textContent = text;
  labelLayer.appendChild(el);
  const l = { el, getPos, dy, visible: true };
  labels.push(l);
  return l;
}

// ---------- backdrop: stars and a distance grid ----------
{
  const r = rng(42);
  const n = 2600, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = r() * 2 - 1, th = r() * Math.PI * 2, R = 1500 + r() * 900;
    const s = Math.sqrt(1 - u * u);
    pos.set([R * s * Math.cos(th), R * u, R * s * Math.sin(th)], i * 3);
    const w = 0.55 + r() * 0.45, warm = r() < 0.15;
    col.set(warm ? [w, w * 0.8, w * 0.75] : [w, w, w], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.85 })));

  // Distance rings on the plane of Earth's orbit. Spacing is logarithmic, so the labels matter.
  for (const au of [1, 5, 10, 30, 100, 150]) {
    const R = mapRadius(au), pts = [];
    for (let k = 0; k <= 180; k++) { const a = (k / 180) * Math.PI * 2; pts.push(new THREE.Vector3(R * Math.cos(a), 0, R * Math.sin(a))); }
    const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xc8102e, transparent: true, opacity: au === 1 ? 0.0 : 0.22, depthWrite: false }));
    scene.add(ring);
    if (au >= 5) addLabel(`${au} AU`, 'ring', (o) => o.set(R * 0.7071, 0, R * 0.7071), 0);
  }
  // radial spokes
  const spokes = [];
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    spokes.push(new THREE.Vector3(mapRadius(0.6) * Math.cos(a), 0, mapRadius(0.6) * Math.sin(a)), new THREE.Vector3(mapRadius(150) * Math.cos(a), 0, mapRadius(150) * Math.sin(a)));
  }
  scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(spokes), new THREE.LineBasicMaterial({ color: 0xc8102e, transparent: true, opacity: 0.08, depthWrite: false })));
}

// ---------- the Sun ----------
const sun = new THREE.Mesh(new THREE.SphereGeometry(2.6, 48, 32), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
scene.add(sun);
const sunGlow = glowSprite(0xffb870, 16, 0.9);
scene.add(sunGlow);
addLabel('Sun', 'planet', (o) => o.set(0, 0, 0), 28);

// ---------- planets and small bodies ----------
const bodies = {}; // key -> { obj, el, size, epoch }
function makeBody(p, small = false) {
  const geo = new THREE.SphereGeometry(p.size, small ? 16 : 40, small ? 12 : 28);
  const mat = new THREE.MeshStandardMaterial({ map: planetTexture(p), roughness: 0.9, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  const holder = new THREE.Group();
  holder.add(mesh);
  if (p.rings) {
    const rg = new THREE.RingGeometry(p.size * 1.35, p.size * 2.3, 64);
    const ringTex = canvasTexture(256, 4, (g, w) => { for (let x = 0; x < w; x++) { const a = 0.25 + 0.6 * Math.abs(Math.sin(x * 0.09)) * (x > w * 0.62 && x < w * 0.68 ? 0.1 : 1); g.fillStyle = `rgba(230,210,160,${a})`; g.fillRect(x, 0, 1, 4); } });
    // map the strip radially
    const uv = rg.attributes.uv, pos = rg.attributes.position, vv = new THREE.Vector3();
    for (let i = 0; i < uv.count; i++) { vv.fromBufferAttribute(pos, i); uv.setXY(i, (vv.length() - p.size * 1.35) / (p.size * 0.95), 0.5); }
    const ring = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2 + 0.47;
    holder.add(ring);
  }
  if (p.comet) holder.add(glowSprite(0xdfe8ff, 1.4, 0.6));
  scene.add(holder);
  const orbit = lineFromPoints(orbitPath(p.el, small ? 160 : 256), p.dwarf || !small ? 0xf4f1ea : 0xe8a0a8, small ? 0.1 : 0.16);
  scene.add(orbit);
  bodies[p.key] = { obj: holder, mesh, el: p.el, size: p.size, epoch: p.epoch || EPOCH_JD, name: p.name, orbit };
  addLabel(p.name, small ? 'small' : 'planet', (o) => o.copy(holder.position), p.size * 0 + 12);
}
PLANETS.forEach((p) => makeBody(p));
SMALL_BODIES.forEach((p) => makeBody(p, true));

// Moon (geocentric), drawn 2.2 units from Earth along its true direction.
const moon = new THREE.Mesh(new THREE.SphereGeometry(0.26, 20, 14), new THREE.MeshStandardMaterial({ map: planetTexture({ name: 'Moon', size: 0.26, color: '#b9b4ab', key: 'moon' }), roughness: 1 }));
scene.add(moon);
bodies.moon = { obj: moon, size: 0.26, name: 'Moon' };
addLabel('Moon', 'small', (o) => o.copy(moon.position), 10);

// Earth-orbit ring for satellites and stations.
const earthRing = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.012, 6, 90), new THREE.MeshBasicMaterial({ color: 0xff2d46, transparent: true, opacity: 0.55 }));
earthRing.rotation.x = Math.PI / 2;
scene.add(earthRing);

// ---------- spacecraft with real trajectories ----------
function probeModel() {
  // A simple code-built probe: bus, dish and boom. Small, but readable when you fly close.
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: 0xd9d4c8, roughness: 0.5, metalness: 0.6 });
  const bus = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 10), m);
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 8, 0, Math.PI * 2, 0, 0.55), new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.4, side: THREE.DoubleSide }));
  dish.position.y = 0.2; dish.rotation.x = Math.PI;
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.6, 4), m);
  boom.rotation.z = Math.PI / 2; boom.position.x = 0.3;
  g.add(bus, dish, boom);
  g.add(glowSprite(0xff2d46, 1.1, 0.95));
  return g;
}
const probes = {};
const SUB = 8;
for (const p of PROBES) {
  const t = TRAJ[p.key];
  const n = t.xyz.length / 3;
  const pts = [];
  for (let i = 0; i < n; i++) pts.push([t.xyz[i * 3], t.xyz[i * 3 + 1], t.xyz[i * 3 + 2]]);
  const trail = lineFromPoints(subdivide(pts, SUB), p.end ? 0xe8a0a8 : 0xff2d46, p.end ? 0.2 : 0.6);
  trail.geometry.setDrawRange(0, 0);
  scene.add(trail);
  const model = probeModel();
  scene.add(model);
  probes[p.key] = { ...p, t, n, trail, model, endJd: p.end ? jdFromIso(p.end) : Infinity, launchJd: jdFromIso(p.launch) };
  probes[p.key].label = addLabel(p.name, 'probe', (o) => o.copy(model.position), 10);
}

// ---------- achievement markers, one per place ----------
const places = {};
for (const a of ACHIEVEMENTS) (places[a.place] ||= []).push(a);
const pinLayer = labelLayer;
const pins = {};
for (const key of Object.keys(places)) {
  const b = document.createElement('button');
  b.className = 'pin';
  b.innerHTML = '<i></i><b></b>';
  b.setAttribute('aria-label', placeName(key));
  b.addEventListener('click', (e) => { e.stopPropagation(); openPlace(key); });
  pinLayer.appendChild(b);
  pins[key] = { el: b, pos: new THREE.Vector3(), count: b.querySelector('b') };
}

// Near Earth, several places overlap when seen from afar: show one cluster marker until you fly in.
const EARTH_GROUP = ['earth-orbit', 'L1', 'L2', 'moon'];
{
  const b = document.createElement('button');
  b.className = 'pin';
  b.innerHTML = '<i></i><b></b>';
  b.setAttribute('aria-label', 'Earth and the Moon');
  b.addEventListener('click', (e) => { e.stopPropagation(); openEarthGroup(); });
  pinLayer.appendChild(b);
  pins['earth-group'] = { el: b, pos: new THREE.Vector3(), count: b.querySelector('b'), virtual: true };
}

function placeName(key) {
  if (key === 'earth-orbit') return 'Earth orbit';
  if (key === 'earth-group') return 'Earth and the Moon';
  if (key === 'L1') return 'Sun–Earth L1';
  if (key === 'L2') return 'Sun–Earth L2';
  if (key === 'sun') return 'Near the Sun';
  if (key.startsWith('probe:')) return probes[key.slice(6)]?.name || key;
  return bodies[key]?.name || key;
}

// ---------- update positions for a date ----------
const P = v3(), Q = v3();
function update(jd) {
  for (const [key, b] of Object.entries(bodies)) {
    if (key === 'moon') continue;
    keplerPosition(b.el, jd, b.epoch, tmp);
    toMap(tmp, b.obj.position);
  }
  const earth = bodies.earth.obj.position;
  keplerPosition(MOON_EL, jd, EPOCH_JD, tmp);
  Q.set(tmp[0], tmp[2], -tmp[1]).normalize().multiplyScalar(2.2);
  moon.position.copy(earth).add(Q);
  earthRing.position.copy(earth);
  bodies.earth.mesh.rotation.y = jd * 2 * Math.PI * 1.0027;
  bodies.jupiter.mesh.rotation.y = jd * 2 * Math.PI * 2.42;
  bodies.saturn.mesh.rotation.y = jd * 2 * Math.PI * 2.25;

  for (const p of Object.values(probes)) {
    const pos = trajPosition(p.t, jd, tmp);
    const live = pos && jd >= p.launchJd && jd <= p.endJd;
    p.model.visible = !!live;
    p.label.visible = !!live;
    if (pos) toMap(pos, p.model.position);
    const idx = Math.max(0, Math.min((p.n - 1) * SUB + 1, Math.ceil(((jd - p.t.jd0) / p.t.step) * SUB) + 1));
    p.trail.geometry.setDrawRange(0, pos ? idx : 0);
  }

  // pins
  const sunDir = v3().copy(earth).normalize();
  for (const [key, pin] of Object.entries(pins)) {
    const pos = pin.pos;
    if (key === 'earth-group') pos.copy(earth).add(Q.set(0, 1.6, 0));
    else if (key === 'earth-orbit') pos.copy(earth).add(Q.set(0, 1.35, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), 0.7));
    else if (key === 'L1') pos.copy(earth).addScaledVector(sunDir, -1.9);
    else if (key === 'L2') pos.copy(earth).addScaledVector(sunDir, 1.9);
    else if (key === 'sun') pos.set(0, 3.4, 0);
    else if (key === 'moon') pos.copy(moon.position).add(Q.set(0, 0.55, 0));
    else if (key.startsWith('probe:')) { const p = probes[key.slice(6)]; pos.copy(p.model.position).add(Q.set(0, 0.7, 0)); }
    else { const b = bodies[key]; pos.copy(b.obj.position).add(Q.set(0, b.size + 0.55, 0)); }
  }
}

// ---------- per-frame projection of labels and pins ----------
const proj = v3();
function project(world, el, dy, show) {
  proj.copy(world).project(camera);
  const vis = show && proj.z < 1 && proj.z > -1 && Math.abs(proj.x) < 1.1 && Math.abs(proj.y) < 1.1;
  el.style.display = vis ? '' : 'none';
  if (!vis) return;
  const x = (proj.x * 0.5 + 0.5) * W, y = (-proj.y * 0.5 + 0.5) * H + dy;
  el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, ${dy ? '0' : '-50%'})`;
}
let W = 1, H = 1;
function layoutDom() {
  const camDist = camera.position.distanceTo(controls.target);
  for (const l of labels) {
    l.getPos(proj);
    const world = proj.clone();
    let show = l.visible;
    if (l.el.classList.contains('small')) show = show && camera.position.distanceTo(world) < 130;
    if (l.el.classList.contains('ring')) show = camDist > 40;
    project(world, l.el, l.dy, show);
  }
  const questIds = state.quest ? new Set(QUESTS.find((q) => q.id === state.quest).ids) : null;
  const nearEarth = camera.position.distanceTo(bodies.earth.obj.position) < 26;
  for (const [key, pin] of Object.entries(pins)) {
    const all = key === 'earth-group' ? EARTH_GROUP.flatMap((k) => places[k] || []) : places[key];
    const avail = all.filter((a) => a.jd <= state.jd);
    let show = avail.length > 0;
    if (key === 'earth-group') show = show && !nearEarth;
    else if (EARTH_GROUP.includes(key)) show = show && nearEarth;
    if (key.startsWith('probe:')) show = show && probes[key.slice(6)].model.visible;
    const newOnes = avail.filter((a) => !found.has(a.id)).length;
    pin.el.classList.toggle('new', newOnes > 0);
    pin.el.classList.toggle('done', avail.length > 0 && newOnes === 0);
    pin.el.classList.toggle('quest', !!questIds && avail.some((a) => questIds.has(a.id) && !found.has(a.id)));
    pin.count.textContent = avail.length > 1 ? avail.length : '';
    pin.count.style.display = avail.length > 1 ? '' : 'none';
    project(pin.pos, pin.el, 0, show);
  }
}

// ---------- camera flights ----------
let flight = null;
function flyTo(targetVec, dist, ms = 1400) {
  const fromT = controls.target.clone(), fromP = camera.position.clone();
  const dir = fromP.clone().sub(fromT).normalize();
  if (dir.y < 0.25) { dir.y = 0.35; dir.normalize(); }
  const toP = targetVec.clone().addScaledVector(dir, dist);
  flight = { t0: performance.now(), ms, fromT, fromP, toT: targetVec.clone(), toP, follow: null };
}
function focusPlace(key) {
  let target, dist = 9, follow = null;
  if (key === 'earth-orbit' || key === 'L1' || key === 'L2') { follow = () => bodies.earth.obj.position; dist = 7; }
  else if (key === 'moon') { follow = () => moon.position; dist = 4; }
  else if (key === 'sun') { follow = () => new THREE.Vector3(0, 0, 0); dist = 14; }
  else if (key.startsWith('probe:')) { const p = probes[key.slice(6)]; follow = () => p.model.position; dist = 7; }
  else { const b = bodies[key]; follow = () => b.obj.position; dist = Math.max(5, b.size * 9); }
  target = follow().clone();
  flyTo(target, dist);
  flight.follow = follow;
  state.focus = follow;
}
function overview() {
  state.focus = null;
  flyTo(new THREE.Vector3(0, 0, 0), 175, 1600);
}

// ---------- panel ----------
const panel = document.getElementById('panel');
const panelBody = document.getElementById('panelBody');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtDate = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
function accentTitle(t) {
  const w = t.split(' ');
  const i = w.findIndex((x) => /^(first|only|farthest|closest|deepest|biggest|most|second)$/i.test(x));
  if (i < 0) return esc(t);
  return w.map((x, k) => (k === i ? `<span class="accent">${esc(x)}</span>` : esc(x))).join(' ');
}
// Keep the focused object in the visible part of the screen when the panel covers some of it.
function applyViewOffset() {
  if (panel.hidden) camera.clearViewOffset();
  else if (W < 640) camera.setViewOffset(W, H, 0, Math.round(H * 0.28), W, H);
  else camera.setViewOffset(W, H, Math.round(Math.min(400, W * 0.3) / 2), 0, W, H);
  camera.updateProjectionMatrix();
}
function openPanel(html) { panelBody.innerHTML = html; panel.hidden = false; panel.scrollTop = 0; applyViewOffset(); }
function closePanel() { panel.hidden = true; applyViewOffset(); }
document.getElementById('panelClose').addEventListener('click', closePanel);

function openPlace(key) {
  focusPlace(key);
  const list = places[key].filter((a) => a.jd <= state.jd);
  if (list.length === 1) return openAchievement(list[0].id, false);
  const hidden = places[key].length - list.length;
  openPanel(`
    <div class="meta"><span class="pill">${esc(placeName(key))}</span></div>
    <h2>${list.length} achievements here</h2>
    <ul class="list">${list.map(itemRow).join('')}</ul>
    ${hidden ? `<p class="fine">${hidden} more appear here later in history. Move the timeline forward to unlock them.</p>` : ''}`);
  bindRows();
}
function openEarthGroup() {
  state.focus = () => bodies.earth.obj.position;
  flyTo(bodies.earth.obj.position.clone(), 9);
  flight.follow = state.focus;
  const groups = EARTH_GROUP.map((k) => [k, (places[k] || []).filter((a) => a.jd <= state.jd)]).filter(([, l]) => l.length);
  openPanel(`
    <div class="meta"><span class="pill">Earth and the Moon</span></div>
    <h2>${groups.reduce((n, [, l]) => n + l.length, 0)} achievements nearby</h2>
    ${groups.map(([k, l]) => `<h3>${esc(placeName(k))}</h3><ul class="list">${l.map(itemRow).join('')}</ul>`).join('')}
    <p class="fine">L1 and L2 are balance points 1.5 million km from Earth, towards and away from the Sun.</p>`);
  bindRows();
}
function itemRow(a) {
  const locked = a.jd > state.jd;
  return `<li class="${locked ? 'locked' : ''}"><button data-id="${a.id}"><span class="y">${a.date.slice(0, 4)}</span><span class="t">${esc(a.title)}<small>${esc(a.mission)} · ${esc(a.who)}</small></span><span class="d ${found.has(a.id) ? 'done' : ''}"></span></button></li>`;
}
function bindRows() {
  panelBody.querySelectorAll('[data-id]').forEach((b) => b.addEventListener('click', () => {
    const a = byId[b.dataset.id];
    if (a.jd > state.jd) setJd(a.jd + 1);
    openAchievement(a.id, true);
  }));
}

function openAchievement(id, fly = true) {
  const a = byId[id];
  if (fly) focusPlace(a.place);
  const isNew = !found.has(id);
  found.add(id);
  saveFound();
  refreshCount();
  const quest = QUESTS.find((q) => q.ids.includes(id));
  const qDone = quest ? quest.ids.filter((x) => found.has(x)).length : 0;
  const nextInQuest = quest ? quest.ids.map((x) => byId[x]).find((x) => !found.has(x.id)) : null;
  openPanel(`
    <div class="meta"><span class="date">${fmtDate(a.date)}</span>${isNew ? '<span class="found-badge">Found</span>' : ''}</div>
    <h2>${accentTitle(a.title)}</h2>
    <div class="meta" style="margin-bottom:14px"><span class="pill">${esc(a.mission)}</span><span>${esc(a.who)}</span></div>
    <p>${esc(a.text)}</p>
    <a class="src" href="${esc(a.source)}" target="_blank" rel="noopener">Source: ${esc(a.sourceLabel)} ↗</a>
    <div class="row-btns">
      <button class="btn" id="seeWhere">Where: ${esc(placeName(a.place))}</button>
      ${nextInQuest ? `<button class="btn primary" id="nextQ">Next in “${esc(quest.title)}”</button>` : ''}
    </div>
    ${quest ? `<h3>Quest · ${esc(quest.title)}</h3><div class="bar"><i style="width:${(100 * qDone) / quest.ids.length}%"></i></div><p class="fine" style="margin-top:6px">${qDone} of ${quest.ids.length} found${qDone === quest.ids.length ? ' · complete' : ''}</p>` : ''}`);
  document.getElementById('seeWhere').addEventListener('click', () => focusPlace(a.place));
  const nb = document.getElementById('nextQ');
  if (nb) nb.addEventListener('click', () => { state.quest = quest.id; if (nextInQuest.jd > state.jd) setJd(nextInQuest.jd + 1); focusPlace(nextInQuest.place); toast(`Find it at ${placeName(nextInQuest.place)}`, nextInQuest.date.slice(0, 4)); closePanel(); });
  if (isNew && quest && qDone === quest.ids.length) toast(`Quest complete: ${quest.title}`, '★');
}

function openList() {
  const total = ACHIEVEMENTS.length;
  openPanel(`
    <div class="meta"><span class="pill">${found.size} of ${total} found</span></div>
    <h2>Quests</h2>
    ${QUESTS.map((q) => { const d = q.ids.filter((x) => found.has(x)).length; return `<button class="quest ${state.quest === q.id ? 'on' : ''}" data-q="${q.id}"><div class="qt"><span>${esc(q.title)}</span><span>${d}/${q.ids.length}</span></div><p>${esc(q.hint)}</p><div class="bar"><i style="width:${(100 * d) / q.ids.length}%"></i></div></button>`; }).join('')}
    <p class="fine">Pick a quest to make its markers glow. Progress is saved in this browser only.</p>`);
  panelBody.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => {
    state.quest = state.quest === b.dataset.q ? null : b.dataset.q;
    const q = QUESTS.find((x) => x.id === b.dataset.q);
    if (state.quest) {
      setJd(END_JD);
      const next = q.ids.map((x) => byId[x]).find((x) => !found.has(x.id)) || byId[q.ids[0]];
      focusPlace(next.place);
      toast(`Quest on: ${q.title}`, '◆');
      closePanel();
    } else openList();
  }));
}
function openTimelineList() {
  openPanel(`<div class="meta"><span class="pill">1957 to today</span></div><h2>All achievements</h2><ul class="list">${ACHIEVEMENTS.map(itemRow).join('')}</ul>`);
  bindRows();
}
function openAbout() {
  openPanel(`
    <div class="meta"><span class="pill">About this map</span></div>
    <h2>A real map, <span class="accent">squeezed</span> to fit</h2>
    <p>Planet, moon, asteroid and comet positions come from NASA JPL Horizons orbital elements. The paths of Voyager 1 and 2, Pioneer 10, New Horizons, Cassini, Rosetta and Juno are their real flight paths from JPL Horizons.</p>
    <p><b>Distances are compressed.</b> Directions are true, but the distance from the Sun is on a log scale, so Mercury and Voyager 1 fit on one screen. The red rings mark 5, 10, 30, 100 and 150 AU (1 AU is the Earth–Sun distance). Planet sizes are enlarged and colours are drawn in code, not photographs.</p>
    <p>Each achievement links to its record in NASA’s NSSDCA catalogue or the agency’s own page. Spotted a mistake? Tell us and we will fix it.</p>
    <p class="fine">Data: NASA JPL Solar System Dynamics (Horizons), NASA NSSDCA. 3D engine: three.js. Built by Zero Universe.</p>`);
}

document.getElementById('progressBtn').addEventListener('click', openList);
document.getElementById('listBtn').addEventListener('click', openTimelineList);
document.getElementById('aboutBtn').addEventListener('click', openAbout);
document.getElementById('homeBtn').addEventListener('click', (e) => { e.preventDefault(); closePanel(); overview(); });

function refreshCount() {
  document.getElementById('foundCount').textContent = found.size;
  document.getElementById('totalCount').textContent = ACHIEVEMENTS.length;
}
document.getElementById('introCount').textContent = ACHIEVEMENTS.length;
refreshCount();

// ---------- toast ----------
const toastEl = document.getElementById('toast');
let toastTimer = 0, toastAction = null;
function toast(text, tag = '', action = null) {
  toastEl.innerHTML = `${tag ? `<b>${esc(tag)}</b>` : ''}<span>${esc(text)}</span>`;
  toastEl.classList.add('show');
  toastAction = action;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 4200);
}
toastEl.addEventListener('click', () => { if (toastAction) toastAction(); toastEl.classList.remove('show'); });

// ---------- timeline ----------
const slider = document.getElementById('timeSlider');
const dateLabel = document.getElementById('dateLabel');
const dateNote = document.getElementById('dateNote');
const playBtn = document.getElementById('playBtn');
const ticks = document.getElementById('ticks');
const toSlider = (jd) => Math.round(((jd - START_JD) / (END_JD - START_JD)) * 1000);
const fromSlider = (v) => START_JD + (v / 1000) * (END_JD - START_JD);
for (const a of ACHIEVEMENTS) { const i = document.createElement('i'); i.style.left = `${(toSlider(a.jd) / 10).toFixed(2)}%`; ticks.appendChild(i); }

let lastShownJd = END_JD;
function setJd(jd, fromPlay = false) {
  const prev = state.jd;
  state.jd = Math.max(START_JD, Math.min(END_JD, jd));
  slider.value = toSlider(state.jd);
  const d = dateFromJd(state.jd);
  dateLabel.textContent = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const latest = [...ACHIEVEMENTS].reverse().find((a) => a.jd <= state.jd);
  dateNote.textContent = state.jd >= END_JD - 0.5 ? 'Today · positions from NASA JPL' : latest ? `Latest: ${latest.mission}` : 'Before the space age';
  update(state.jd);
  if (fromPlay) {
    const crossed = ACHIEVEMENTS.filter((a) => a.jd > prev && a.jd <= state.jd);
    if (crossed.length) { const a = crossed[crossed.length - 1]; toast(a.title, a.date.slice(0, 4), () => openAchievement(a.id)); }
  }
}
slider.addEventListener('input', () => { stop(); closePanel(); setJd(fromSlider(+slider.value)); });
document.getElementById('todayBtn').addEventListener('click', () => { stop(); setJd(END_JD); });
function play() {
  if (state.jd >= END_JD - 1) setJd(START_JD);
  state.playing = true; playBtn.textContent = '❚❚'; playBtn.setAttribute('aria-label', 'Pause');
}
function stop() { state.playing = false; playBtn.textContent = '▶'; playBtn.setAttribute('aria-label', 'Play history'); }
playBtn.addEventListener('click', () => (state.playing ? stop() : play()));

// ---------- intro ----------
const intro = document.getElementById('intro');
document.getElementById('startToday').addEventListener('click', () => { intro.classList.add('gone'); flyTo(new THREE.Vector3(0, 0, 0), 120, 2000); });
document.getElementById('startReplay').addEventListener('click', () => { intro.classList.add('gone'); setJd(START_JD); focusEarthWide(); play(); });
function focusEarthWide() { state.focus = () => bodies.earth.obj.position; flyTo(bodies.earth.obj.position.clone(), 40, 1800); flight.follow = state.focus; }

// deep links: #a=apollo11
function fromHash() {
  const m = location.hash.match(/a=([\w-]+)/);
  if (m && byId[m[1]]) { intro.classList.add('gone'); openAchievement(m[1]); }
}

// ---------- loop ----------
function resize() {
  W = window.innerWidth; H = window.innerHeight;
  renderer.setSize(W, H, false);
  camera.aspect = W / H;
  camera.fov = W < 640 ? 62 : 50;
  applyViewOffset();
}
window.addEventListener('resize', resize);
resize();
setJd(END_JD);

let last = performance.now();
controls.addEventListener('start', () => { if (flight) flight = null; });
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (state.playing) {
    setJd(state.jd + dt * state.speed * (state.jd < jdFromIso('1990-01-01') ? 1.6 : 1), true);
    if (state.jd >= END_JD) stop();
  }
  if (flight) {
    const u = Math.min(1, (now - flight.t0) / flight.ms);
    const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
    const toT = flight.follow ? flight.follow() : flight.toT;
    const offset = flight.toP.clone().sub(flight.toT);
    controls.target.lerpVectors(flight.fromT, toT, e);
    camera.position.lerpVectors(flight.fromP, toT.clone().add(offset), e);
    if (u >= 1) flight = null;
  } else if (state.focus) {
    // keep a focused, moving object centred
    const want = state.focus();
    const delta = want.clone().sub(controls.target);
    controls.target.add(delta);
    camera.position.add(delta);
  }
  sunGlow.scale.setScalar(16 + Math.sin(now * 0.0012) * 0.6);
  controls.update();
  renderer.render(scene, camera);
  layoutDom();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
fromHash();
window.addEventListener('hashchange', fromHash);
// leaving focus when the user pans far away
canvas.addEventListener('dblclick', () => { closePanel(); overview(); });
