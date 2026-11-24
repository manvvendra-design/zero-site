// Code-built 3D models: the astronaut and real spacecraft hardware, simplified from public diagrams.
import * as THREE from 'three';
import { upgradeLM } from './nasa3d.js';

export const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...o });
const M = {
  suit: mat(0xEDEBE4, { roughness: 0.85 }),
  grey: mat(0x8f8f8c, { roughness: 0.7 }),
  dark: mat(0x232325, { roughness: 0.6 }),
  red: mat(0xC8102E, { roughness: 0.55 }),
  visor: mat(0xC99A3A, { metalness: 1, roughness: 0.16 }),
  gold: mat(0xC08A2C, { metalness: 0.75, roughness: 0.4 }),
  silver: mat(0xc4c4c0, { metalness: 0.8, roughness: 0.32 }),
  white: mat(0xe9e7e1, { roughness: 0.6 }),
  panel: mat(0x1d2a4a, { metalness: 0.4, roughness: 0.35 }),
  alu: mat(0xa9a9a4, { metalness: 0.7, roughness: 0.4 }),
  concrete: mat(0xb9b5aa, { roughness: 0.95 }),
};

function mesh(geo, m, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  o.castShadow = true; o.receiveShadow = true;
  return o;
}
const box = (w, h, d, m, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), m, x, y, z);
const cyl = (rt, rb, h, m, x, y, z, seg = 16) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z);

// a rod from point a to point b
const _up = new THREE.Vector3(0, 1, 0);
export function rod(a, b, r, m) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const len = A.distanceTo(B);
  const o = mesh(new THREE.CylinderGeometry(r, r, len, 8), m);
  o.position.copy(A).add(B).multiplyScalar(0.5);
  o.quaternion.setFromUnitVectors(_up, B.clone().sub(A).normalize());
  return o;
}

// ---------- astronaut ----------
function limb(len, r, m, endMesh) {
  const g = new THREE.Group();
  const c = mesh(new THREE.CapsuleGeometry(r, len - 2 * r, 4, 10), m, 0, -len / 2, 0);
  g.add(c);
  if (endMesh) { endMesh.position.y = -len; g.add(endMesh); }
  return g;
}
export function makeAstronaut() {
  const g = new THREE.Group();
  const body = new THREE.Group(); // bobs while walking
  g.add(body);
  const torso = mesh(new THREE.CapsuleGeometry(0.3, 0.42, 6, 14), M.suit, 0, 1.24, 0);
  torso.scale.set(1.08, 1, 0.82);
  body.add(torso);
  body.add(box(0.58, 0.74, 0.3, M.suit, 0, 1.3, -0.33));       // life-support backpack
  body.add(box(0.52, 0.1, 0.27, M.grey, 0, 1.71, -0.33));
  body.add(box(0.34, 0.18, 0.12, M.grey, 0, 1.3, 0.27));        // chest control unit
  body.add(box(0.06, 0.06, 0.04, M.red, 0.1, 1.33, 0.34));
  // the head turns on its own (pivot at the neck ring) so the astronaut can look around
  const head = new THREE.Group(); head.position.set(0, 1.62, 0.02); body.add(head);
  head.add(mesh(new THREE.SphereGeometry(0.25, 24, 16), M.suit, 0, 0.18, 0));
  head.add(mesh(new THREE.SphereGeometry(0.258, 24, 16, Math.PI / 2 - 0.95, 1.9, 0.7, 1.05), M.visor, 0, 0.18, 0));
  body.add(cyl(0.2, 0.22, 0.08, M.grey, 0, 1.6, 0.02, 20));     // neck ring

  const armL = limb(0.62, 0.105, M.suit, box(0.13, 0.15, 0.13, M.grey));
  const armR = limb(0.62, 0.105, M.suit, box(0.13, 0.15, 0.13, M.grey));
  armL.position.set(0.42, 1.55, 0); armR.position.set(-0.42, 1.55, 0);
  for (const a of [armL, armR]) a.add(cyl(0.118, 0.118, 0.07, M.red, 0, -0.17, 0)); // Zero red bands
  const bootL = box(0.17, 0.12, 0.3, M.grey); const bootR = box(0.17, 0.12, 0.3, M.grey);
  bootL.position.z = bootR.position.z = 0.05;
  const legL = limb(0.86, 0.13, M.suit, bootL);
  const legR = limb(0.86, 0.13, M.suit, bootR);
  legL.position.set(0.16, 0.98, 0); legR.position.set(-0.16, 0.98, 0);
  bootL.position.y = bootR.position.y = -0.86 + 0.06;
  body.add(armL, armR, legL, legR);
  g.userData = { body, head, armL, armR, legL, legR };
  return g;
}

// ---------- canvas textures ----------
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// ---------- Apollo 11 ----------
function legs(g, n, rFoot, yTop, rTop, m, offset = 0) {
  for (let i = 0; i < n; i++) {
    const a = offset + (i * 2 * Math.PI) / n;
    const fx = Math.cos(a) * rFoot, fz = Math.sin(a) * rFoot;
    g.add(rod([Math.cos(a) * rTop, yTop, Math.sin(a) * rTop], [fx, 0.3, fz], 0.07, m));
    g.add(rod([Math.cos(a) * rTop * 0.75, yTop - 0.9, Math.sin(a) * rTop * 0.75], [fx * 0.86, 0.75, fz * 0.86], 0.04, m));
    g.add(cyl(0.42, 0.48, 0.14, m, fx, 0.07, fz, 18));
  }
}
function makeLM() {
  const g = new THREE.Group();
  const body = cyl(2.1, 2.1, 1.7, M.gold, 0, 2.05, 0, 8); body.rotation.y = Math.PI / 8; g.add(body);
  const deck = cyl(2.02, 2.02, 0.08, M.silver, 0, 2.93, 0, 8); deck.rotation.y = Math.PI / 8; g.add(deck);
  g.add(mesh(new THREE.CylinderGeometry(0.42, 0.8, 0.9, 18, 1, true), M.dark, 0, 0.85, 0));
  legs(g, 4, 4.3, 2.4, 1.9, M.gold, Math.PI / 2); // first leg points to +z (ladder leg)
  // ladder on the +z leg
  for (const s of [-0.24, 0.24]) g.add(rod([s, 2.3, 2.05], [s, 0.45, 3.9], 0.025, M.silver));
  for (let k = 1; k < 8; k++) { const t = k / 8; g.add(rod([-0.24, 2.3 - 1.85 * t, 2.05 + 1.85 * t], [0.24, 2.3 - 1.85 * t, 2.05 + 1.85 * t], 0.02, M.silver)); }
  const plaque = box(0.36, 0.24, 0.02, M.silver, 0, 1.55, 3.0); plaque.rotation.x = -0.78; g.add(plaque);
  // porch platform
  g.add(box(0.9, 0.05, 0.6, M.silver, 0, 2.3, 2.1));
  return g;
}
// the whole lunar module as it flew down: descent stage plus the crew cabin (ascent stage) on top
function makeLMFull() {
  const g = makeLM();
  const cab = new THREE.Group(); cab.position.y = 3.0; g.add(cab);
  const grey = M.grey, dark = M.dark;
  // main cabin: a wide faceted drum, front face toward +z
  const drum = cyl(1.45, 1.55, 2.0, grey, 0, 1.25, -0.2, 8); drum.rotation.y = Math.PI / 8; cab.add(drum);
  const front = box(1.9, 1.5, 0.9, grey, 0, 1.35, 1.05); cab.add(front);
  for (const s of [-1, 1]) { const w = box(0.42, 0.42, 0.04, dark, s * 0.5, 1.75, 1.52); w.rotation.y = s * -0.35; w.rotation.x = 0.2; cab.add(w); }
  cab.add(box(0.85, 0.85, 0.06, dark, 0, 0.8, 1.52)); // forward hatch
  cab.add(cyl(0.48, 0.48, 0.55, grey, 0, 2.5, -0.2, 16)); // docking tunnel
  cab.add(box(1.3, 0.9, 1.0, grey, 0, 1.0, -1.6)); // aft equipment bay
  const dish = cyl(0.42, 0.05, 0.18, M.silver, 1.25, 2.55, -0.9, 16); dish.rotation.z = -0.6; cab.add(dish);
  for (const s of [-1, 1]) cab.add(box(0.25, 0.25, 0.25, M.silver, s * 1.6, 2.0, 0.6)); // thruster quads
  return g;
}
function makeFlag() {
  const g = new THREE.Group();
  g.add(rod([-0.9, 0.05, 0], [0.95, 0.05, 0.2], 0.018, M.silver));
  const tex = canvasTex(120, 64, (c, w, h) => {
    for (let i = 0; i < 13; i++) { c.fillStyle = i % 2 ? '#e9e3dc' : '#c98e8e'; c.fillRect(0, (i * h) / 13, w, h / 13 + 1); }
    c.fillStyle = '#7f8db0'; c.fillRect(0, 0, w * 0.42, h * 0.54);
  });
  const f = mesh(new THREE.PlaneGeometry(0.9, 0.6), mat(0xffffff, { map: tex, side: THREE.DoubleSide, roughness: 0.9 }), 0.4, 0.03, 0.55);
  f.rotation.x = -Math.PI / 2; f.rotation.z = 0.1;
  g.add(f);
  return g;
}
function makeLRRR() {
  const g = new THREE.Group();
  const tex = canvasTex(128, 128, (c, w) => {
    c.fillStyle = '#9a9a96'; c.fillRect(0, 0, w, w);
    for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) { c.fillStyle = '#1b1d24'; c.beginPath(); c.arc(8 + i * 12.4, 8 + j * 12.4, 5, 0, 7); c.fill(); }
  });
  const p = box(0.46, 0.04, 0.46, M.silver, 0, 0.42, 0);
  const face = mesh(new THREE.PlaneGeometry(0.44, 0.44), mat(0xffffff, { map: tex, metalness: 0.6, roughness: 0.25 }), 0, 0.023, 0);
  face.rotation.x = -Math.PI / 2; p.add(face);
  p.rotation.x = -0.5; g.add(p);
  for (const [x, z] of [[-0.25, -0.2], [0.25, -0.2], [0, 0.28]]) g.add(rod([x * 0.6, 0.38, z * 0.6], [x, 0, z], 0.015, M.silver));
  return g;
}
function makePSEP() {
  const g = new THREE.Group();
  g.add(box(0.5, 0.5, 0.5, M.gold, 0, 0.3, 0));
  g.add(cyl(0.08, 0.08, 0.25, M.silver, 0, 0.65, 0));
  for (const s of [-1, 1]) { const w = box(0.9, 0.02, 0.62, M.panel, s * 0.72, 0.42, 0); w.rotation.z = s * 0.25; g.add(w); }
  return g;
}

// ---------- Chang'e 4 ----------
function makeCE4() {
  const g = new THREE.Group();
  g.add(box(2.0, 1.2, 2.0, M.gold, 0, 1.75, 0));
  g.add(box(2.06, 0.08, 2.06, M.silver, 0, 2.38, 0));
  legs(g, 4, 3.0, 1.5, 1.2, M.silver, Math.PI / 4);
  for (const s of [-1, 1]) { const w = box(1.5, 0.03, 1.1, M.panel, s * 1.6, 2.9, 0); w.rotation.z = s * -0.6; g.add(w); }
  g.add(cyl(0.05, 0.05, 1.0, M.silver, 0.5, 2.9, -0.5));
  const dish = mesh(new THREE.SphereGeometry(0.4, 18, 8, 0, Math.PI * 2, 0, 0.9), M.white, 0.5, 3.45, -0.5); dish.rotation.x = 2.6; g.add(dish);
  // ramps down to the ground (+x side)
  for (const s of [-0.35, 0.35]) g.add(rod([1.0, 1.2, s], [3.0, 0.05, s], 0.03, M.silver));
  return g;
}
function wheels(g, xs, zs, r, w, m) {
  for (const x of xs) for (const z of zs) { const wh = cyl(r, r, w, m, x, r, z, 18); wh.rotation.z = Math.PI / 2; g.add(wh); }
}
function makeYutu() {
  const g = new THREE.Group();
  g.add(box(0.8, 0.45, 1.1, M.gold, 0, 0.6, 0));
  wheels(g, [-0.5, 0.5], [-0.42, 0, 0.42], 0.14, 0.12, M.alu);
  const w1 = box(0.8, 0.02, 0.9, M.panel, 0.75, 0.95, 0); w1.rotation.z = -0.5; g.add(w1);
  g.add(box(0.8, 0.02, 1.0, M.panel, 0, 0.84, 0));
  g.add(cyl(0.03, 0.03, 0.6, M.silver, 0, 1.15, 0.45));
  g.add(box(0.3, 0.12, 0.12, M.silver, 0, 1.48, 0.45));
  return g;
}

// ---------- Mars 2020 ----------
function makePercy() {
  const g = new THREE.Group();
  g.add(box(1.9, 0.62, 2.5, M.white, 0, 1.05, 0));
  g.add(box(1.95, 0.06, 2.55, M.alu, 0, 1.38, 0));
  wheels(g, [-1.25, 1.25], [-1.05, 0, 1.05], 0.26, 0.25, M.alu);
  for (const s of [-1.2, 1.2]) { g.add(rod([s, 0.55, -1.05], [s, 0.95, 0], 0.05, M.alu)); g.add(rod([s, 0.55, 1.05], [s, 0.95, 0], 0.05, M.alu)); }
  // mast + head
  g.add(cyl(0.06, 0.06, 1.15, M.white, 0.6, 1.95, 0.95));
  g.add(box(0.55, 0.26, 0.26, M.white, 0.6, 2.6, 1.0));
  g.add(cyl(0.06, 0.06, 0.04, M.dark, 0.45, 2.6, 1.14)); g.add(cyl(0.06, 0.06, 0.04, M.dark, 0.75, 2.6, 1.14));
  // RTG power unit at the back
  const rtg = cyl(0.3, 0.3, 0.7, M.dark, 0, 1.35, -1.55); rtg.rotation.x = 0.9; g.add(rtg);
  for (let k = 0; k < 6; k++) { const fin = box(0.02, 0.62, 0.9, M.dark, 0, 1.35, -1.55); fin.rotation.x = 0.9; fin.rotation.y = (k * Math.PI) / 6; g.add(fin); }
  // high-gain antenna
  const hga = cyl(0.3, 0.3, 0.04, M.alu, -0.55, 1.6, -0.6, 6); hga.rotation.x = 0.4; g.add(hga);
  // robotic arm folded at the front
  g.add(rod([-0.6, 1.1, 1.3], [0.4, 1.05, 1.75], 0.06, M.white));
  g.add(rod([0.4, 1.05, 1.75], [-0.3, 0.9, 1.95], 0.05, M.white));
  g.add(box(0.36, 0.3, 0.3, M.alu, -0.35, 0.9, 1.95));
  return g;
}
function makeIngenuity() {
  const g = new THREE.Group();
  g.add(box(0.14, 0.14, 0.18, M.white, 0, 0.36, 0));
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) g.add(rod([x * 0.05, 0.32, z * 0.05], [x * 0.22, 0, z * 0.22], 0.008, M.alu));
  g.add(cyl(0.012, 0.012, 0.3, M.silver, 0, 0.58, 0));
  const b1 = box(1.2, 0.01, 0.07, M.dark, 0, 0.5, 0); g.add(b1);
  const b2 = box(1.2, 0.01, 0.07, M.dark, 0, 0.6, 0); b2.rotation.y = 1.2; g.add(b2);
  g.add(box(0.42, 0.01, 0.16, M.panel, 0, 0.74, 0));
  return g;
}
function makeTubes() {
  const g = new THREE.Group();
  for (let i = 0; i < 10; i++) {
    const t = cyl(0.035, 0.035, 0.2, M.silver, (i % 2) * 1.2 + i * 0.4, 0.035, i * 1.4 - 6, 10);
    t.rotation.z = Math.PI / 2; t.rotation.y = i * 0.7; g.add(t);
  }
  return g;
}

// ---------- Falcon 9 at LZ-1 ----------
function makeF9() {
  const g = new THREE.Group();
  const H = 41, R = 1.83, y0 = 2.2;
  const geo = new THREE.CylinderGeometry(R, R, H, 32, 24);
  const col = []; const p = geo.attributes.position; const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) + H / 2; // 0 at bottom
    if (y > H - 4) c.set(0x1c1c1e); // black interstage
    else { const soot = Math.max(0, 1 - y / 16) * 0.55 + (Math.sin(p.getX(i) * 3 + y) > 0.6 && y < 24 ? 0.12 : 0); c.setRGB(0.93 - soot, 0.93 - soot, 0.91 - soot * 1.05); }
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.add(mesh(geo, mat(0xffffff, { vertexColors: true, roughness: 0.6 }), 0, y0 + H / 2, 0));
  // engines
  for (let k = 0; k < 9; k++) {
    const a = (k / 8) * Math.PI * 2, r = k === 8 ? 0 : 1.15;
    g.add(mesh(new THREE.CylinderGeometry(0.22, 0.38, 0.9, 14, 1, true), M.dark, Math.cos(a) * r, y0 - 0.4, Math.sin(a) * r));
  }
  // legs and grid fins
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2, cx = Math.cos(a), sz = Math.sin(a);
    g.add(rod([cx * R, y0 + 8.5, sz * R], [cx * 6.2, 0.2, sz * 6.2], 0.22, M.dark));
    g.add(rod([cx * R, y0 + 0.6, sz * R], [cx * 4.6, 1.6, sz * 4.6], 0.1, M.alu));
    g.add(cyl(0.55, 0.6, 0.25, M.dark, cx * 6.2, 0.12, sz * 6.2));
    const b = (k * Math.PI) / 2;
    const fin = box(1.3, 1.5, 0.08, M.grey, Math.cos(b) * (R + 0.7), y0 + H - 5.2, Math.sin(b) * (R + 0.7));
    fin.rotation.y = -b + Math.PI / 2; fin.rotation.x = 0.0;
    g.add(fin);
  }
  return g;
}
function makePad() {
  const g = new THREE.Group();
  const pad = cyl(30, 30, 0.3, M.concrete, 0, 0.0, 0, 64); pad.castShadow = false; g.add(pad);
  const ring = new THREE.Mesh(new THREE.RingGeometry(16, 17.2, 96), mat(0xf2f0ea, { roughness: 0.8 }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.16; ring.receiveShadow = true; g.add(ring);
  const scorch = new THREE.Mesh(new THREE.CircleGeometry(9, 48), mat(0x55524c, { roughness: 1, transparent: true, opacity: 0.55 }));
  scorch.rotation.x = -Math.PI / 2; scorch.position.y = 0.165; scorch.receiveShadow = true; g.add(scorch);
  return g;
}
function makeSign(text) {
  const g = new THREE.Group();
  g.add(cyl(0.06, 0.06, 1.6, M.alu, -0.6, 0.8, 0)); g.add(cyl(0.06, 0.06, 1.6, M.alu, 0.6, 0.8, 0));
  const tex = canvasTex(256, 128, (c, w, h) => {
    c.fillStyle = '#0D0E11'; c.fillRect(0, 0, w, h); c.fillStyle = '#C8102E'; c.fillRect(0, h - 14, w, 14);
    c.fillStyle = '#F4F1EA'; c.font = '900 62px "Barlow Condensed", Arial Narrow, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, w / 2, h / 2 - 4);
  });
  const b = box(1.6, 0.8, 0.06, M.dark, 0, 1.75, 0);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.58, 0.78), mat(0xffffff, { map: tex }));
  face.position.z = 0.035; b.add(face);
  const back = face.clone(); back.rotation.y = Math.PI; back.position.z = -0.035; b.add(back);
  g.add(b);
  return g;
}
function makeBoulder(s) {
  const geo = new THREE.DodecahedronGeometry(1, 1);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = 0.8 + 0.35 * Math.abs(Math.sin(p.getX(i) * 4.1 + p.getZ(i) * 2.3)); p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.7, p.getZ(i) * k); }
  geo.computeVertexNormals();
  const o = mesh(geo, mat(0x77746f, { flatShading: true, roughness: 0.95 }));
  o.scale.setScalar(s); o.position.y = s * 0.35;
  const g = new THREE.Group(); g.add(o); return g;
}

export function makeModel(def, groundColor) {
  switch (def.kind) {
    case 'lm': { const g = makeLM(); if (def.nasa !== false) upgradeLM(g, false); return g; }
    case 'lmfull': { const g = makeLMFull(); if (def.nasa !== false) upgradeLM(g, true); return g; }
    case 'flag': return makeFlag();
    case 'lrrr': return makeLRRR();
    case 'psep': return makePSEP();
    case 'ce4': return makeCE4();
    case 'yutu': return makeYutu();
    case 'percy': return makePercy();
    case 'ingenuity': return makeIngenuity();
    case 'tubes': return makeTubes();
    case 'f9': return makeF9();
    case 'pad': return makePad();
    case 'sign': return makeSign(def.text || '');
    case 'boulder': { const b = makeBoulder(def.s || 1); if (groundColor) b.children[0].material.color.set(groundColor).multiplyScalar(0.85); return b; }
    default: return null;
  }
}
