// Zero Universe: land the Eagle. The last 2 minutes 18 seconds of the Apollo 11 descent,
// flown over NASA's real elevation model of the landing site.
// Starting state, fuel and every callout come from the Apollo Lunar Surface Journal (ALSJ) and
// the Apollo 11 Mission Report as quoted there. Game rules (what counts as a soft landing) are ours.
import * as THREE from 'three';
import { SITES } from './sites.js';
import { makeModel } from './models.js';
import { moonEnv } from './nasa3d.js';
import { recordLanding } from './mission.js';
import { loadDem, demH, makeSurround, regolithTexture, regolithMaterial, demAlbedo, rockGeometry } from './terrain.js';

const S = SITES.apollo11;
const $ = (id) => document.getElementById(id);
const DEG = Math.PI / 180, FT = 0.3048, G = 1.62;
const SRC = 'https://www.nasa.gov/wp-content/uploads/static/history/alsj/a11/a11.landing.html';

// ---------- real numbers (ALSJ, Apollo 11 landing) ----------
// Armstrong took manual control (P66) at 102:43:22. Callouts either side: 102:43:16 "540 feet, down 15",
// 102:43:26 "400 feet, down at 9, 58 forward". So the game starts at about 460 ft, down 11, 58 forward.
const START_GET = 102 * 3600 + 43 * 60 + 22;
// The two callouts bracket 456 ft; 482 ft is the start that, flying the real callout rates over this
// terrain, touches down at the real time (the radar callouts are rounded and the radar dropped out twice).
const START = { alt: 482 * FT, down: 11 * FT, fwd: 58 * FT, x: 841 };
// Quantity light at 102:44:31 = 94 s to the Bingo call, then 20 s to land or abort: 114 s of hover fuel left
// 69 s after the start. Burning about hover thrust in between gives ~183 s of hover fuel at the start.
const FUEL0 = 183, BINGO_RESERVE = 20;
// Real touchdown 102:45:39.9: 1.7 ft/s down, 2.1 ft/s to the left, negligible forward speed (Mission Report).
const REAL = { t: 102 * 3600 + 45 * 60 + 39.9 - START_GET, down: 1.7, side: 2.1, fuelLeft: 45 };
// Aldrin's and Houston's calls during the real landing, seconds after 102:43:22
const CALLS = [
  [4, 'Aldrin: 400 feet, down at 9. 58 forward.'],
  [11, 'Aldrin: 350 feet, down at 4.'],
  [13, 'Aldrin: 330, three and a half down.'],
  [20, 'Aldrin: You’re pegged on horizontal velocity.'],
  [24, 'Aldrin: 300 feet, down 3½, 47 forward. Slow it up.'],
  [30, 'Aldrin: 1½ down. Ease her down. 270.'],
  [36, 'Armstrong: Okay, how’s the fuel?   Aldrin: Eight percent.'],
  [40, 'Armstrong: Looks like a good area here.'],
  [45, 'Aldrin: 250, down at 2½, 19 forward.'],
  [54, 'Aldrin: 3½ down, 220 feet, 13 forward.'],
  [62, 'Aldrin: 200 feet, 4½ down.   Armstrong: Gonna be right over that crater.'],
  [67, 'Armstrong: I got a good spot.'],
  [69, 'Aldrin: 160 feet, 6½ down. (Fuel quantity light latches: 94 s to Bingo.)'],
  [78, 'Aldrin: 120 feet.'],
  [83, 'Aldrin: 100 feet, 3½ down, 9 forward. Five percent. Quantity light.'],
  [92, 'Aldrin: 75 feet. And it’s looking good. Down a half, 6 forward.'],
  [100, 'Houston: 60 seconds.'],
  [106, 'Aldrin: 60 feet, down 2½. 2 forward. That’s good.'],
  [115, 'Aldrin: 40 feet, down 2½. Picking up some dust.'],
  [119, 'Aldrin: 30 feet, 2½ down.'],
  [123, 'Aldrin: 4 forward. Drifting to the right a little. 20 feet, down a half.'],
  [129, 'Houston: 30 seconds.'],
  [138, 'Aldrin: Contact light.'],
  [141, 'Armstrong: Shutdown.'],
];

// game rules (ours, not NASA's)
const RULE = { softDown: 3, softSide: 4, maxDown: 10, maxSlope: 12 };
// West crater and its boulder field (rocks up to 2-3 m, ALSJ): centre and radius measured from the elevation model
const WEST = { x: 536, z: 109, r: 95, field: 130 };
const PROBE = 1.73; // contact probes hang 67 inches (1.73 m) below the footpads

// ---------- scene ----------
const DEM = await loadDem(S.dem);
if (!DEM) { $('introText').textContent = 'The NASA terrain could not be loaded. Please reload the page.'; throw new Error('no terrain'); }
const ground = (x, z) => demH(DEM, x, z);

const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
moonEnv(renderer); // reflections for NASA's lander model
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const camera = new THREE.PerspectiveCamera(55, 1, 0.5, 6000);

const sunDir = new THREE.Vector3().setFromSphericalCoords(1, (90 - S.sun.el) * DEG, S.sun.az * DEG);
const sun = new THREE.DirectionalLight(0xfffaf2, 3.8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 1200 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05;
sun.shadow.camera.layers.enable(1); // so the lander (layer 1) still casts its shadow
scene.add(sun, sun.target, new THREE.HemisphereLight(0x9aa3b5, 0x57534d, 0.34));

function hash(x, y) { const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); }
{
  const n = 2400, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3().setFromSphericalCoords(3000, Math.acos(1 - 2 * hash(i, 1.7)), hash(i, 9.2) * Math.PI * 2);
    if (v.y < -100) v.y = -v.y;
    pos.set([v.x, v.y, v.z], i * 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.75 })));
}
function sprite(size, draw) {
  const c = document.createElement('canvas'); c.width = c.height = 256; draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, transparent: true }));
  s.scale.setScalar(size); scene.add(s); return s;
}
const sunSprite = sprite(140, (c) => {
  const g = c.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,250,1)'); g.addColorStop(0.18, 'rgba(255,252,235,1)'); g.addColorStop(0.26, 'rgba(255,240,210,.35)'); g.addColorStop(1, 'rgba(255,230,200,0)');
  c.fillStyle = g; c.fillRect(0, 0, 256, 256);
});
const earthDir = new THREE.Vector3().setFromSphericalCoords(1, (90 - S.earthInSky.el) * DEG, S.earthInSky.az * DEG);
const earth = sprite(92, (c) => {
  c.save(); c.beginPath(); c.arc(128, 128, 100, 0, 7); c.clip();
  c.fillStyle = '#1f4f9a'; c.fillRect(0, 0, 256, 256);
  c.fillStyle = 'rgba(255,255,255,.85)';
  for (let i = 0; i < 14; i++) { c.beginPath(); c.ellipse(40 + hash(i, 2) * 180, 40 + hash(i, 5) * 180, 30, 7, hash(i, 8) * 3, 0, 7); c.fill(); }
  c.fillStyle = 'rgba(0,0,0,.88)'; c.beginPath(); c.arc(60, 128, 112, 0, 7); c.fill();
  c.restore();
});

// ground from NASA's elevation model
const REGO = regolithTexture(THREE);
{
  const geo = new THREE.PlaneGeometry(DEM.x1 - DEM.x0, DEM.z1 - DEM.z0, DEM.w - 1, DEM.h - 1);
  geo.rotateX(-Math.PI / 2); geo.translate((DEM.x0 + DEM.x1) / 2, 0, (DEM.z0 + DEM.z1) / 2);
  const p = geo.attributes.position, col = new Float32Array(p.count * 3);
  const c1 = new THREE.Color(S.ground[0]), c2 = new THREE.Color(S.ground[1]), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    p.setY(i, ground(x, z));
    c.copy(c2).lerp(c1, 0.35 + 0.4 * hash(Math.floor(x / 3), Math.floor(z / 3)) * 0.5);
    c.multiplyScalar(demAlbedo(DEM, x, z));
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, regolithMaterial(THREE, REGO, { w: DEM.x1 - DEM.x0, d: DEM.z1 - DEM.z0 }));
  m.receiveShadow = true; scene.add(m);
}
{ const sr = makeSurround(THREE, DEM, new THREE.Color(S.ground[0]).lerp(new THREE.Color(S.ground[1]), 0.6)); if (REGO) sr.material = regolithMaterial(THREE, REGO, { w: 9000, d: 9000, color: sr.material.color }); scene.add(sr); }
// West crater's boulder field: rocks scattered around and inside the crater (sizes up to ~3 m)
{
  const n = 1400, geo = rockGeometry(THREE, 3);
  const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0x6f6c67, flatShading: true, roughness: 0.95, bumpMap: REGO, bumpScale: 0.8 }), n);
  im.castShadow = true; im.receiveShadow = true;
  const mm = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const a = hash(i, 3.1) * Math.PI * 2, r = WEST.field * Math.sqrt(hash(i, 7.7));
    const x = WEST.x + Math.cos(a) * r, z = WEST.z + Math.sin(a) * r;
    const sz = 0.3 + Math.pow(hash(i, 5.5), 3) * 1.3;
    q.setFromEuler(new THREE.Euler(hash(i, 1) * 3, hash(i, 2) * 3, 0)); s.set(sz * 1.2, sz * 0.8, sz);
    im.setMatrixAt(i, mm.compose(v.set(x, ground(x, z) + sz * 0.2, z), q, s));
  }
  scene.add(im);
}

// the real landing spot, marked faintly so you can aim for it
const target = new THREE.Mesh(new THREE.RingGeometry(3.2, 3.6, 48), new THREE.MeshBasicMaterial({ color: 0xFF2D46, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }));
target.rotation.x = -Math.PI / 2; target.position.set(0, ground(0, 0) + 0.15, 0); scene.add(target);

// the lunar module, facing west (the way it flew)
const lm = makeModel({ kind: 'lmfull' }, S.ground[1]);
// the lander lives on layer 1: the outside camera and the sun's shadow see it; from the window it is hidden so it never blocks the view
lm.traverse((o) => o.layers.set(1));
lm.traverse((o) => { if (o.isMesh) o.castShadow = true; });
lm.rotation.y = -Math.PI / 2;
scene.add(lm);
const plume = new THREE.Mesh(new THREE.ConeGeometry(0.7, 3, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xbfd4ff, transparent: true, opacity: 0.25, depthWrite: false }));
plume.rotation.x = Math.PI; plume.position.y = -1.2; plume.userData.keep = true; lm.add(plume);
// blowing dust: a thin sheet under the engine once low enough (Armstrong noticed it below about 100 ft)
const dust = new THREE.Mesh(new THREE.RingGeometry(1, 40, 48, 1), new THREE.MeshBasicMaterial({ color: 0xb9b5ad, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
dust.rotation.x = -Math.PI / 2; scene.add(dust);

// ---------- state ----------
const L = {};
function reset() {
  Object.assign(L, {
    pos: new THREE.Vector3(START.x, 0, 0), vel: new THREE.Vector3(-START.fwd, -START.down, 0),
    rod: -START.down, tiltF: 0, tiltS: 0, fuel: FUEL0, t: 0, running: false, done: false, said: new Set(), callIx: 0,
  });
  L.pos.y = ground(L.pos.x, L.pos.z) + START.alt;
  $('results').hidden = true; $('call').textContent = ''; $('alert').textContent = '';
}
reset();

// ---------- input ----------
const keys = new Set();
addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'ArrowUp' || e.code === 'KeyR') { rodClick(+1); e.preventDefault(); }
  if (e.code === 'ArrowDown' || e.code === 'KeyF') { rodClick(-1); e.preventDefault(); }
  if (e.code === 'KeyC') toggleView();
  if (e.code === 'KeyV') resetCam();
  if (e.code === 'Space' && !L.running && !L.done) start();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
// the real rate-of-descent switch changed the commanded rate 1 ft/s per click
function rodClick(d) { if (!L.running) return; L.rod = Math.min(3 * FT, Math.max(-30 * FT, L.rod + d * FT)); }
$('slowerBtn').addEventListener('click', () => rodClick(+1));
$('fasterBtn').addEventListener('click', () => rodClick(-1));
$('viewBtn').addEventListener('click', () => toggleView());

const joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
const joyEl = $('joy'), knob = $('joyKnob');
// free 360-degree camera: orbit the lander (outside view) or look around the cabin (window view)
const CAM0 = { yaw: Math.atan2(26, 4), pitch: 0.33, dist: 28 };
const cam = { ...CAM0, wYaw: 0, wPitch: 0 };
const looks = new Map(); // pointers that move the camera (mouse drag, or touches on the right side)
let pinch0 = 0;
const lookBy = (dx, dy) => {
  if (view === 'chase') { cam.yaw -= dx; cam.pitch += dy; }
  else { cam.wYaw -= dx; cam.wPitch -= dy; }
  clampCam();
};
const zoomBy = (f) => { cam.dist = Math.min(600, Math.max(7, cam.dist * f)); };
function clampCam() {
  cam.pitch = Math.min(1.55, Math.max(-0.35, cam.pitch));
  cam.wYaw = Math.atan2(Math.sin(cam.wYaw), Math.cos(cam.wYaw)); cam.wPitch = Math.max(-1.0, Math.min(1.5, cam.wPitch)); // full turn of the head, up to the sky
}
function resetCam() { Object.assign(cam, CAM0, { wYaw: 0, wPitch: 0 }); }
const pinchDist = () => { const p = [...looks.values()]; return p.length < 2 ? 0 : Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); };
canvas.addEventListener('pointerdown', (e) => {
  canvas.focus({ preventScroll: true });
  // touch: left side is the attitude stick, right side turns the camera; mouse: drag turns the camera (fly with W A S D)
  if (e.pointerType === 'touch' && e.clientX < innerWidth * 0.45 && joy.id === null) {
    Object.assign(joy, { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 });
    joyEl.style.transform = `translate(${e.clientX - 60}px, ${e.clientY - 60}px)`; joyEl.classList.add('on');
  } else {
    looks.set(e.pointerId, { x: e.clientX, y: e.clientY });
    pinch0 = pinchDist();
  }
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerId === joy.id) {
    let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy; const l = Math.hypot(dx, dy), mx = 50;
    if (l > mx) { dx *= mx / l; dy *= mx / l; }
    joy.x = dx / mx; joy.y = dy / mx; knob.style.transform = `translate(${dx}px, ${dy}px)`;
    return;
  }
  const lp = looks.get(e.pointerId); if (!lp) return;
  const dx = e.clientX - lp.x, dy = e.clientY - lp.y; lp.x = e.clientX; lp.y = e.clientY;
  if (looks.size >= 2) { const d = pinchDist(); if (pinch0 > 0 && d > 0) zoomBy(pinch0 / d); pinch0 = d; return; }
  const k = e.pointerType === 'touch' ? 0.006 : 0.005;
  lookBy(dx * k, dy * k);
});
const endPtr = (e) => {
  if (e.pointerId === joy.id) { joy.id = null; joy.x = joy.y = 0; knob.style.transform = ''; joyEl.classList.remove('on'); }
  looks.delete(e.pointerId); pinch0 = pinchDist();
};
canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);
canvas.addEventListener('dblclick', resetCam);
canvas.addEventListener('wheel', (e) => { zoomBy(1 + Math.max(-0.3, Math.min(0.3, e.deltaY * 0.0012))); e.preventDefault(); }, { passive: false });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

let padPrev = [];
function readPad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const p of pads) {
    if (!p) continue;
    const dz = (v) => (Math.abs(v) < 0.15 ? 0 : v);
    const b = p.buttons.map((x) => x.pressed);
    const edge = (i) => b[i] && !padPrev[i];
    if (edge(12) || edge(5)) rodClick(+1); // d-pad up or R1: slower descent
    if (edge(13) || edge(4)) rodClick(-1); // d-pad down or L1: faster
    if (edge(0) && !L.running && !L.done) start();
    if (edge(3)) toggleView();
    if (edge(10) || edge(11)) resetCam(); // stick click: reset camera
    padPrev = b;
    return { x: dz(p.axes[0]), y: dz(p.axes[1]), lx: dz(p.axes[2] || 0), ly: dz(p.axes[3] || 0) };
  }
  return null;
}

// ---------- views ----------
let view = 'chase';
function toggleView() { view = view === 'chase' ? 'window' : 'chase'; $('viewBtn').textContent = view === 'chase' ? 'Window view' : 'Outside view'; }

// ---------- flight ----------
const fmt = (v, d = 0) => (Math.abs(v) < 0.05 && d === 0 ? '0' : v.toFixed(d));
const getStr = (t) => { const s = START_GET + t; const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = Math.floor(s % 60); return `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`; };
function say(id, text) { if (L.said.has(id)) return; L.said.add(id); $('alert').textContent = text; $('alert').classList.add('show'); setTimeout(() => $('alert').classList.remove('show'), 3500); }

function start() {
  $('intro').hidden = true; reset(); L.running = true; canvas.focus({ preventScroll: true });
}
$('startBtn').addEventListener('click', start);
$('againBtn').addEventListener('click', start);

function physics(dt, inp) {
  // attitude: tilt toward the stick, up to 20 degrees, like flying the LM "like a helicopter"
  const maxT = 20 * DEG;
  const wantF = -inp.y * maxT, wantS = inp.x * maxT; // stick forward = tilt forward = speed up westward
  L.tiltF += (wantF - L.tiltF) * Math.min(1, dt * 2.5);
  L.tiltS += (wantS - L.tiltS) * Math.min(1, dt * 2.5);
  const engineOn = L.fuel > 0;
  // vertical: the computer holds the commanded descent rate (P66), within engine limits
  let av = engineOn ? (L.rod - L.vel.y) * 1.2 : -G;
  av = Math.max(-G, Math.min(G * 1.2, av));
  const ah = engineOn ? G * Math.tan(L.tiltF) : 0, as = engineOn ? G * Math.tan(L.tiltS) : 0;
  L.vel.x -= ah * dt; // forward = west = -x
  L.vel.z -= as * dt; // right = north = -z when facing west
  L.vel.y += av * dt;
  // fuel: seconds of hover fuel, used in proportion to thrust
  if (engineOn) L.fuel = Math.max(0, L.fuel - dt * Math.hypot(G + av, Math.hypot(ah, as)) / G);
  L.pos.addScaledVector(L.vel, dt);
  L.t += dt;
}

function land() {
  L.running = false; L.done = true; $('alert').classList.remove('show');
  const down = -L.vel.y / FT, fwd = -L.vel.x / FT, side = -L.vel.z / FT, horiz = Math.hypot(fwd, side);
  const x = L.pos.x, z = L.pos.z;
  const sx = (ground(x + 2, z) - ground(x - 2, z)) / 4, sz = (ground(x, z + 2) - ground(x, z - 2)) / 4;
  const slope = Math.atan(Math.hypot(sx, sz)) / DEG;
  const inField = Math.hypot(x - WEST.x, z - WEST.z) < WEST.field;
  const fromReal = Math.hypot(x, z);
  const toBingo = L.fuel - BINGO_RESERVE;
  let verdict, cls;
  if (down > RULE.maxDown || inField || slope > RULE.maxSlope) {
    verdict = inField ? 'Crashed in West crater’s boulder field' : slope > RULE.maxSlope ? 'Tipped over on a slope' : 'Too hard: the landing gear broke'; cls = 'bad';
  } else if (down <= RULE.softDown && horiz <= RULE.softSide) { verdict = 'The Eagle has landed'; cls = 'good'; } else { verdict = 'Landed hard, but safe'; cls = 'ok'; }
  L.pos.y = ground(x, z); L.vel.set(0, 0, 0);
  const row = (k, you, real) => `<tr><th>${k}</th><td>${you}</td><td>${real}</td></tr>`;
  $('resultsBody').innerHTML = `
    <div class="pill ${cls}">${cls === 'bad' ? 'Mission lost' : 'Touchdown'}</div>
    <h2>${verdict}</h2>
    <table class="cmp"><thead><tr><th></th><th>You</th><th>Armstrong</th></tr></thead><tbody>
      ${row('Coming down at', `${fmt(down, 1)} ft/s`, `${REAL.down} ft/s`)}
      ${row('Sideways drift', `${fmt(horiz, 1)} ft/s`, `${REAL.side} ft/s`)}
      ${row('Fuel left', `${Math.round(L.fuel)} s`, `about ${REAL.fuelLeft} s`)}
      ${row('Time from takeover', `${Math.round(L.t)} s`, `${Math.round(REAL.t)} s`)}
      ${row('Distance from the real spot', `${Math.round(fromReal)} m`, '0 m')}
      ${row('Ground slope', `${slope.toFixed(1)}°`, '')}
    </tbody></table>
    <p class="fine">Soft landing in this game: under ${RULE.softDown} ft/s down and ${RULE.softSide} ft/s sideways. Over ${RULE.maxDown} ft/s breaks the gear, about the speed of a free fall from 10 ft in lunar gravity. Fuel: ${toBingo > 0 ? `${Math.round(toBingo)} s before the Bingo call` : 'past Bingo'}.</p>
    <p class="fine">Real figures: <a href="${SRC}" target="_blank" rel="noopener">NASA Apollo Lunar Surface Journal, Apollo 11 landing</a>, quoting the Apollo 11 Mission Report.</p>`;
  const pr = recordLanding({ cls, verdict, down, fuel: L.fuel, fromReal }, REAL);
  $('resultsBody').insertAdjacentHTML('beforeend', `<div class="pts"><b>+${pr.pts}</b> mission points${pr.isBest && pr.pts > 0 ? ' · new best' : ` · best ${pr.best}`}<small>Up to 100: a safe, soft landing, softer than Armstrong, more fuel left than him, and close to the real spot.</small></div>`);
  $('results').hidden = false;
  try {
    if (cls !== 'bad') { const k = 'zu-walk-found', f = new Set(JSON.parse(localStorage.getItem(k) || '[]')); f.add('a11-landed'); localStorage.setItem(k, JSON.stringify([...f])); }
  } catch (e) { /* private mode */ }
}

// ---------- loop ----------
function tick(dt, inp) {
    physics(dt, inp);
    const gz = ground(L.pos.x, L.pos.z), altM = L.pos.y - gz;
    // calls from the real flight, at their real times
    while (L.callIx < CALLS.length && CALLS[L.callIx][0] <= L.t) { $('call').textContent = `${getStr(CALLS[L.callIx][0])}  ${CALLS[L.callIx][1]}`; L.callIx++; }
    const toBingo = L.fuel - BINGO_RESERVE;
    if (toBingo <= 60) say('60', 'Houston: 60 seconds to Bingo fuel');
    if (toBingo <= 30) say('30', 'Houston: 30 seconds to Bingo fuel');
    if (toBingo <= 0) say('bingo', 'BINGO: land within 20 seconds or abort');
    if (L.fuel <= 0) say('out', 'Out of fuel: the engine has stopped');
    if (altM < 100 * FT) say('dust', 'Picking up some dust');
    if (altM - 0.3 < PROBE) say('contact', 'Contact light');
    if (altM <= 0.3) land();
    if (L.pos.x < DEM.x0 + 5) L.pos.x = DEM.x0 + 5;
    if (Math.abs(L.pos.z) > 395) L.pos.z = Math.sign(L.pos.z) * 395;
}


const hud = { alt: $('hAlt'), altm: $('hAltM'), down: $('hDown'), fwd: $('hFwd'), side: $('hSide'), fuel: $('hFuel'), rod: $('hRod'), get: $('hGet') };
let last = performance.now();
function step(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const pad = readPad();
  let ix = 0, iy = 0;
  if (keys.has('KeyA')) ix -= 1; if (keys.has('KeyD')) ix += 1;
  if (keys.has('KeyW')) iy -= 1; if (keys.has('KeyS')) iy += 1;
  if (pad) { ix += pad.x; iy += pad.y; lookBy(pad.lx * 2.4 * dt, pad.ly * 1.6 * dt); }
  { const q = (keys.has('KeyE') ? 1 : 0) - (keys.has('KeyQ') ? 1 : 0); if (q) lookBy(q * 1.8 * dt, 0); }
  if (keys.has('Equal') || keys.has('NumpadAdd')) zoomBy(1 - 1.2 * dt);
  if (keys.has('Minus') || keys.has('NumpadSubtract')) zoomBy(1 + 1.2 * dt);
  ix += joy.x; iy += joy.y;
  const inp = { x: Math.max(-1, Math.min(1, ix)), y: Math.max(-1, Math.min(1, iy)) };
  if (window.__land && window.__land.autopilot && L.running) Object.assign(inp, window.__land.autopilot(L));

  const sub = (window.__land && window.__land.substeps) || 1; // tests run faster than real time
  for (let k = 0; k < sub && L.running; k++) tick(dt, inp);
  const gz = ground(L.pos.x, L.pos.z), altM = Math.max(0, L.pos.y - gz);
  lm.position.set(L.pos.x, L.pos.y - 0.3, L.pos.z);
  lm.rotation.set(0, -Math.PI / 2, 0); lm.rotateX(L.tiltF); lm.rotateZ(L.tiltS);
  plume.visible = L.running && L.fuel > 0;
  plume.scale.y = 0.8 + Math.random() * 0.3;
  dust.position.set(L.pos.x, gz + 0.2, L.pos.z);
  dust.material.opacity = L.running ? Math.max(0, Math.min(0.45, (100 * FT - altM) / (100 * FT) * 0.5)) : 0;
  dust.rotation.z += dt * 2;

  // HUD in the units the crew used (feet, feet per second), metres alongside
  hud.alt.textContent = Math.round(altM / FT); hud.altm.textContent = `${Math.round(altM)} m`;
  hud.down.textContent = fmt(-L.vel.y / FT, 1); hud.fwd.textContent = fmt(-L.vel.x / FT, 0); { const r = -L.vel.z / FT; hud.side.textContent = Math.abs(r) < 0.5 ? '0' : `${r > 0 ? 'R' : 'L'} ${Math.abs(r).toFixed(0)}`; }
  hud.fuel.textContent = Math.max(0, Math.round(L.fuel - BINGO_RESERVE));
  hud.fuel.parentElement.classList.toggle('warn', L.fuel - BINGO_RESERVE < 30);
  hud.rod.textContent = fmt(-L.rod / FT, 0);
  hud.get.textContent = getStr(L.t);

  // camera
  camera.layers.set(0); if (view === 'chase') camera.layers.enable(1);
  if (view === 'chase') {
    // orbit the lander: any direction, from just above the ground to straight down
    const cp = Math.cos(cam.pitch), tY = L.pos.y + 3;
    camera.position.set(L.pos.x + Math.sin(cam.yaw) * cp * cam.dist, tY + Math.sin(cam.pitch) * cam.dist, L.pos.z + Math.cos(cam.yaw) * cp * cam.dist);
    const ch = ground(camera.position.x, camera.position.z) + 1.5;
    if (camera.position.y < ch) camera.position.y = ch;
    camera.lookAt(L.pos.x, tY, L.pos.z);
  } else {
    // Armstrong's window: front of the cabin, looking ahead and down; drag to turn your head
    camera.position.set(L.pos.x - 1.6, L.pos.y + 4.6, L.pos.z + 0.5);
    const yaw = cam.wYaw, pit = -28 * DEG + cam.wPitch;
    camera.lookAt(camera.position.x - Math.cos(yaw) * Math.cos(pit) * 40, camera.position.y + Math.sin(pit) * 40, camera.position.z + Math.sin(yaw) * Math.cos(pit) * 40);
  }
  // the light and its shadow follow the lander's shadow on the ground
  const sh = L.pos.clone().addScaledVector(sunDir, -(L.pos.y - gz) / sunDir.y);
  sun.target.position.copy(sh); sun.position.copy(sh).addScaledVector(sunDir, 600);
  sunSprite.position.copy(camera.position).addScaledVector(sunDir, 2800);
  earth.position.copy(camera.position).addScaledVector(earthDir, 2700);

  renderer.render(scene, camera);
  requestAnimationFrame(step);
}
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();
$('introTitle').textContent = 'Land the Eagle';
$('startBtn').disabled = false;
requestAnimationFrame(step);
window.__land = { L, start, land, ground, CALLS, REAL, FUEL0, cam, resetCam, setView: (v) => { if (v !== view) toggleView(); } };
