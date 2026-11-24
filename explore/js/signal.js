// Mission 2 (November 2026): One light-day. Send a message to Voyager 1 at the speed of light.
// Every distance and time is computed from real positions (NASA JPL Horizons, see bodies.js and trajectories.js);
// only the on-screen layout is squeezed onto a log scale (orbit.js toMap) so Earth and Voyager fit together.
import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { PLANETS, MOON_EL } from './bodies.js';
import { TRAJ } from './trajectories.js';
import { keplerPosition, orbitPath, toMap, jdFromDate, mapRadius } from './orbit.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const AU = 149597870.7, C = 299792.458; // km, km/s
const NASA_LD = 'https://science.nasa.gov/mission/voyager/voyager-1/voyager-1-what-is-a-light-day/';
const KEY = 'zu-m2-voyager';

// ---------- real positions ----------
const V1 = TRAJ.voyager1, nV = V1.xyz.length / 3, vEnd = V1.jd0 + V1.step * (nV - 1);
// Voyager 1 position (AU, ecliptic). Past the end of the Horizons table we continue in a straight line at the
// table's last velocity (about 3.5 AU a year); at NASA's milestone this gives 24.000 light-hours from Earth.
function voyager(jd, out = [0, 0, 0]) {
  const f = Math.max(0, (jd - V1.jd0) / V1.step);
  if (f >= nV - 1) { const k = (nV - 1) * 3, u = (jd - vEnd) / V1.step; for (let c = 0; c < 3; c++) out[c] = V1.xyz[k + c] + (V1.xyz[k + c] - V1.xyz[k - 3 + c]) * u; return out; }
  const i = Math.floor(f), u = f - i, k = i * 3;
  for (let c = 0; c < 3; c++) out[c] = V1.xyz[k + c] * (1 - u) + V1.xyz[k + 3 + c] * u;
  return out;
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const planet = (key, jd) => keplerPosition(PLANETS.find((p) => p.key === key).el, jd);

const JD0 = jdFromDate(new Date()); // the message leaves Earth now
const E0 = planet('earth', JD0);
// where Voyager will be when the light arrives: solve d(target at arrival) = c * travel time
let V = voyager(JD0), T = 0;
for (let i = 0; i < 4; i++) { T = (dist(E0, V) * AU) / C; V = voyager(JD0 + T / 86400); }
const D = T * C; // km along the path
const along = (km, out = [0, 0, 0]) => { const u = Math.min(1, km / D); for (let c = 0; c < 3; c++) out[c] = E0[c] + (V[c] - E0[c]) * u; return out; };

// where Voyager 1 crossed into interstellar space (25 Aug 2012): the heliocentric radius from its own path
const HP_JD = jdFromDate(new Date('2012-08-25T00:00:00Z')), HP_R = Math.hypot(...voyager(HP_JD));
function kmWhereRadius(r) { let lo = 0, hi = D; for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (Math.hypot(...along(m)) < r) lo = m; else hi = m; } return (lo + hi) / 2; }

const STOPS = [
  { id: 'moon', km: 384400, name: 'The Moon’s distance', note: 'Light covers the distance to the Moon in about 1.3 seconds. The Artemis II crew took about three days.' },
  { id: 'sun', km: AU, name: 'The Sun’s distance', note: 'Sunlight takes about 8 minutes 20 seconds to reach Earth: the Sun is 8.3 light-minutes away.' },
  { id: 'mars', km: dist(E0, planet('mars', JD0)) * AU, name: 'Mars’s distance today', note: 'Mars is between 3 and 22 light-minutes from Earth, depending on where both planets are.' },
  { id: 'neptune', km: dist(E0, planet('neptune', JD0)) * AU, name: 'Neptune’s distance today', note: 'The farthest planet is about 4 light-hours away. Voyager 2 took 12 years to get there.' },
  { id: 'helio', km: kmWhereRadius(HP_R), name: 'Edge of the Sun’s bubble', note: `In August 2012, Voyager 1 crossed out of the bubble of solar wind around the Sun, about ${Math.round(HP_R)} times as far from the Sun as Earth. Beyond it is interstellar space.` },
  { id: 'arrive', km: D, name: 'Voyager 1', note: 'Your message has reached Voyager 1. Any reply would take another full day to come home.' },
].sort((a, b) => a.km - b.km);

// ---------- points, questions, patch ----------
const QUESTIONS = [
  { id: 'q-moon', needs: 'moon', q: 'How long does light take to travel between the Moon and Earth?',
    a: ['About 1.3 seconds', 'About 8 minutes 20 seconds', 'About 1 hour', 'About 3 days'],
    why: 'About 1.3 seconds for 384,400 km. The Artemis II astronauts took about three days to cover the same distance.' },
  { id: 'q-lightday', needs: 'arrive', q: 'How far does light travel in one day?',
    a: ['About 26 billion kilometres', 'About 26 million kilometres', 'About 2.6 billion kilometres', 'About 260 billion kilometres'],
    why: 'One light-day is 25,902,068,356 km (16,094,799,096 miles). That is where Voyager 1 reached on 18 November 2026.' },
  { id: 'q-years', needs: 'arrive', q: 'How long had Voyager 1 been travelling when it reached one light-day?',
    a: ['About 49 years', 'About 12 years', 'About 5 years', 'About 100 years'],
    why: '49 years, 2 months and 11 days. It launched on 5 September 1977.' },
  { id: 'q-v2', needs: 'arrive', q: 'When is Voyager 2 expected to reach one light-day?',
    a: ['In November 2035', 'It got there first, in 2020', 'In November 2027', 'Never: it is heading back'],
    why: 'Voyager 2 took a different path to visit Uranus and Neptune, and is on pace to reach one light-day in November 2035.' },
  { id: 'q-star', needs: 'arrive', q: 'Voyager 1 is heading toward a star called Gliese 445. When will it pass closest?',
    a: ['In about 40,000 years', 'In about 400 years', 'In about 40 years', 'In about 4 million years'],
    why: 'In about 40,000 years it will pass within about 1.7 light-years of Gliese 445, in the constellation Ursa Minor, cruising at nearly 61,000 km/h.' },
];
const PTS = { stop: 10, arrive: 40, qFirst: 20, qLater: 10 };
function load() { let m = {}; try { m = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { /* private mode */ } m.stops = m.stops || []; m.q = m.q || {}; return m; }
function save() { try { localStorage.setItem(KEY, JSON.stringify(ST)); } catch (e) { /* ignore */ } }
const ST = load();
function score() {
  const stops = ST.stops.filter((s) => s !== 'arrive').length;
  const q = QUESTIONS.reduce((s, x) => { const r = ST.q[x.id]; return s + (r && r.ok ? (r.tries === 1 ? PTS.qFirst : PTS.qLater) : 0); }, 0);
  const answered = QUESTIONS.filter((x) => ST.q[x.id] && ST.q[x.id].ok).length;
  const arrive = ST.stops.includes('arrive') ? PTS.arrive : 0;
  return { stops, q, answered, arrive, total: stops * PTS.stop + arrive + q, max: (STOPS.length - 1) * PTS.stop + PTS.arrive + QUESTIONS.length * PTS.qFirst, patch: answered === QUESTIONS.length };
}
function patchSVG(earned, size = 150) {
  const id = 'v' + Math.random().toString(36).slice(2, 7), ink = earned ? '#F4F1EA' : 'rgba(244,241,234,.35)', red = earned ? '#FF2D46' : 'rgba(255,45,70,.35)', gold = earned ? '#D9A43B' : 'rgba(244,241,234,.35)';
  return `<svg class="patch${earned ? '' : ' locked'}" viewBox="0 0 220 220" width="${size}" height="${size}" role="img" aria-label="One light-day mission patch${earned ? '' : ' (locked)'}">
  <defs><path id="${id}t" d="M 30 110 A 80 80 0 0 1 190 110"/><path id="${id}b" d="M 16 110 A 94 94 0 0 0 204 110"/></defs>
  <circle cx="110" cy="110" r="106" fill="#0D0E11" stroke="${red}" stroke-width="5"/>
  <circle cx="110" cy="110" r="72" fill="#07080b" stroke="${ink}" stroke-width="1.2" opacity=".9"/>
  ${earned ? [[70, 80], [150, 74], [132, 140], [84, 146], [112, 62], [160, 118], [58, 118]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1" fill="#F4F1EA" opacity=".7"/>`).join('') : ''}
  <circle cx="60" cy="112" r="9" fill="${earned ? '#3b6fb6' : '#555'}"/>
  <path d="M 72 112 L 152 112" stroke="${gold}" stroke-width="2.2" stroke-dasharray="2 5" stroke-linecap="round"/>
  <path d="M 148 107 L 156 112 L 148 117" fill="none" stroke="${gold}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  <g transform="translate(166 112)" stroke="${ink}" stroke-width="2" fill="none"><circle r="6"/><path d="M 0 6 L 0 14 M -5 -8 L 5 -8"/></g>
  <text x="110" y="100" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="800" font-size="13" letter-spacing="2" fill="${gold}">24 HOURS</text>
  <text font-family="Barlow Condensed, sans-serif" font-weight="800" font-size="16" letter-spacing="2.6" fill="${ink}"><textPath href="#${id}t" startOffset="50%" text-anchor="middle">VOYAGER 1 · ONE LIGHT-DAY</textPath></text>
  <text font-family="Barlow Condensed, sans-serif" font-weight="800" font-size="14" letter-spacing="2.6" fill="${red}"><textPath href="#${id}b" startOffset="50%" text-anchor="middle">18 NOV 2026 · ZERO UNIVERSE</textPath></text>
</svg>`;
}

// ---------- scene ----------
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x05060a);
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 5000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.minDistance = 2; controls.maxDistance = 400;
const m3 = (p) => toMap(p, new THREE.Vector3());
{ // stars
  const n = 3000, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(1500 + Math.random() * 500); pos.set([v.x, v.y, v.z], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.3, sizeAttenuation: false, transparent: true, opacity: 0.7 })));
}
function glow(color, size) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, color); g.addColorStop(0.25, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(size); return s;
}
scene.add(glow('rgba(255,236,190,1)', 5));
const line = (pts, color, opacity = 0.5, dashed = false) => {
  const g = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = dashed ? new THREE.LineDashedMaterial({ color, transparent: true, opacity, dashSize: 0.6, gapSize: 0.6 }) : new THREE.LineBasicMaterial({ color, transparent: true, opacity });
  const l = new THREE.Line(g, mat); if (dashed) l.computeLineDistances(); scene.add(l); return l;
};
const labels = [];
function label(text, obj, cls = '') { const el = document.createElement('div'); el.className = `lbl ${cls}`; el.textContent = text; $('labels').appendChild(el); labels.push({ el, obj }); return el; }
for (const p of PLANETS) {
  line(orbitPath(p.el, 180).map(m3), 0x8b93a6, 0.22);
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(p.key === 'earth' ? 0.55 : 0.35 * Math.min(2, p.size), 20, 14), new THREE.MeshBasicMaterial({ color: p.color }));
  mesh.position.copy(m3(planet(p.key, JD0))); scene.add(mesh);
  if (['earth', 'mars', 'jupiter', 'saturn', 'neptune'].includes(p.key)) label(p.name, mesh, p.key === 'earth' ? 'big' : '');
}
// Voyager 1's real path, launch to now
const vPts = []; for (let jd = V1.jd0; jd < JD0; jd += 60) vPts.push(m3(voyager(jd))); vPts.push(m3(voyager(JD0)));
line(vPts, 0xD9A43B, 0.7);
const probe = glow('rgba(255,214,140,1)', 2.4); probe.position.copy(m3(V)); scene.add(probe);
label('Voyager 1', probe, 'big gold');
{ // the Sun's bubble, at the radius where Voyager 1 left it (drawn as a ring in the ecliptic)
  const r = mapRadius(HP_R), pts = []; for (let i = 0; i <= 200; i++) { const a = (i / 200) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); }
  line(pts, 0xFF2D46, 0.35, true);
  const hp = new THREE.Object3D(); hp.position.copy(m3(voyager(HP_JD))); scene.add(hp); label('Left the Sun’s bubble · Aug 2012', hp, 'small');
}
// the signal's straight path (true straight line in space; curved on the log map)
const pathPts = []; for (let i = 0; i <= 400; i++) pathPts.push(m3(along((D * i * i) / 160000)));
line(pathPts, 0x7fd3ff, 0.28, true);
const stopMarks = STOPS.filter((s) => s.id !== 'arrive').map((s) => { const o = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), new THREE.MeshBasicMaterial({ color: 0x7fd3ff })); o.position.copy(m3(along(s.km))); scene.add(o); return o; });
const pulse = glow('rgba(140,220,255,1)', 3.2); pulse.visible = false; scene.add(pulse);
const trailGeo = new THREE.BufferGeometry(); const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: 0x9fe0ff, transparent: true, opacity: 0.9 })); scene.add(trail);
const pulseLbl = label('Your message', pulse, 'pulse'); pulseLbl.style.display = 'none';

const earthPos = m3(E0);
camera.position.copy(earthPos).add(new THREE.Vector3(40, 46, 70)); controls.target.copy(earthPos).lerp(new THREE.Vector3(), 0.3);

// ---------- clock and travel ----------
const fmtT = (s) => s < 60 ? `${s.toFixed(s < 10 ? 2 : 1)} s` : s < 3600 ? `${Math.floor(s / 60)} min ${Math.floor(s % 60)} s` : `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min ${Math.floor(s % 60)} s`;
const fmtKm = (km) => km < 1e6 ? `${Math.round(km).toLocaleString('en')} km` : km < 1e9 ? `${(km / 1e6).toFixed(1)} million km` : `${(km / 1e9).toFixed(2)} billion km`;
const S = { t: 0, warp: 1, running: false, done: false, follow: true, next: 0 };
function send() {
  $('intro').classList.add('gone'); Object.assign(S, { t: 0, running: true, done: false, next: 0, warp: 1 });
  pulse.visible = true; pulseLbl.style.display = ''; $('warp').hidden = false; setWarp(1);
  toast('Message sent from Earth at the speed of light', '→'); canvas.focus({ preventScroll: true });
}
function setWarp(w) {
  if (w === 0) { const s = STOPS[S.next]; if (s) S.t = Math.max(S.t, s.km / C - 2); return; } // jump to just before the next stop
  S.warp = w; document.querySelectorAll('#warp [data-w]').forEach((b) => b.classList.toggle('on', +b.dataset.w === w));
}
document.querySelectorAll('#warp [data-w]').forEach((b) => b.addEventListener('click', () => setWarp(+b.dataset.w)));
function reach(s) {
  const isNew = !ST.stops.includes(s.id);
  if (isNew) { ST.stops.push(s.id); save(); }
  refreshPts();
  if (s.id === 'arrive') { arrive(isNew); return; }
  toast(`${s.name} · ${fmtT(s.km / C)}${isNew ? ` · +${PTS.stop}` : ''}`, '●');
  if (innerWidth >= 700) showStop(s); // on phones the panel would cover the view: the questions wait in the mission log
}
function showStop(s) {
  const q = QUESTIONS.find((x) => x.needs === s.id);
  openPanel(`<div class="meta"><span class="pill">Stop ${STOPS.indexOf(s) + 1} of ${STOPS.length}</span><span>${fmtT(s.km / C)} from Earth</span></div>
    <h2>${esc(s.name)}</h2><p>${esc(s.note)}</p><p class="fine">${fmtKm(s.km)} from Earth along your signal’s path.</p>
    <a class="src" href="${NASA_LD}" target="_blank" rel="noopener">Source: NASA, What Is a Light-Day? ↗</a>
    ${q && !(ST.q[q.id] && ST.q[q.id].ok) ? `<p><button class="btn small primary" data-q="${q.id}">Answer a question · +${PTS.qFirst}</button></p>` : ''}
    <p class="fine">The signal keeps going while you read.</p>`);
}
function arrive(isNew) {
  S.done = true; S.running = false; $('warp').hidden = true;
  // pull back to a side view: Voyager 1 left the planets' plane northward, so seen from above it would sit over the Sun
  S.follow = false; const vm = m3(V); controls.target.copy(vm).multiplyScalar(0.5);
  camera.position.copy(controls.target).add(new THREE.Vector3(-vm.z, 0, vm.x).normalize().multiplyScalar(190)).add(new THREE.Vector3(0, 25, 0));
  const sc = score();
  openPanel(`<div class="meta"><span class="pill">Arrived</span><span>${isNew ? `+${PTS.arrive} points` : 'Arrived again'}</span></div>
    <h2>Voyager 1 hears you</h2>
    <p>Your message took <b>${fmtT(T)}</b> to cross <b>${fmtKm(D)}</b>. Voyager 1 passed one light-day from Earth on 18 November 2026 at 10:16 UTC, after 49 years, 2 months and 11 days in flight, and it is still moving away at nearly 61,000 km/h.</p>
    <p>An answer from the spacecraft would need another full day to come home. A question and its answer take two days.</p>
    <a class="src" href="${NASA_LD}" target="_blank" rel="noopener">Source: NASA, What Is a Light-Day? ↗</a>
    <p><button class="btn small primary" data-mission="log">Answer the questions · ${sc.answered} of ${QUESTIONS.length} done</button> <button class="btn small" data-mission="again">Send another</button></p>`);
  if (isNew) toast(`Arrived after ${fmtT(T)} · +${PTS.arrive}`, '★');
}

// ---------- panel, mission log, questions ----------
const panel = $('panel'), panelBody = $('panelBody');
function openPanel(html) { panelBody.innerHTML = html; panel.hidden = false; panel.scrollTop = 0; }
$('panelClose').addEventListener('click', () => { panel.hidden = true; });
let toastTimer;
function toast(msg, badge = '') { const t = $('toast'); t.innerHTML = `${badge ? `<b>${esc(badge)}</b>` : ''}<span>${esc(msg)}</span>`; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3200); }
function refreshPts() { $('ptsBtn').innerHTML = `<b>${score().total}</b><span class="fw"> pts</span>`; }
function openMission() {
  const sc = score();
  openPanel(`<div class="meta"><span class="pill">Mission 2</span><span>November 2026</span></div>
    <h2>Mission log</h2>
    <div class="score"><b>${sc.total}</b><span>of ${sc.max} points</span></div>
    <table class="tally"><tbody>
      <tr><th>Stops passed</th><td>${sc.stops} of ${STOPS.length - 1}</td><td>${sc.stops * PTS.stop}</td></tr>
      <tr><th>Reached Voyager 1</th><td>${sc.arrive ? 'Yes' : 'Not yet'}</td><td>${sc.arrive}</td></tr>
      <tr><th>Questions</th><td>${sc.answered} of ${QUESTIONS.length}</td><td>${sc.q}</td></tr>
    </tbody></table>
    <div class="patch-box">${patchSVG(sc.patch, 150)}<p>${sc.patch ? '<b>Patch earned.</b> Our own design for Mission 2, drawn in code.' : `Answer all ${QUESTIONS.length} questions to earn the One light-day patch.`}</p></div>
    <h3>Questions</h3>
    <ul class="list">${QUESTIONS.map((q, i) => { const r = ST.q[q.id], open = ST.stops.includes(q.needs);
      const st = r && r.ok ? `<span class="n ok">+${r.tries === 1 ? PTS.qFirst : PTS.qLater}</span>` : open ? '<span class="n">Answer</span>' : '<span class="n">Locked</span>';
      return `<li><button class="qrow ${open ? '' : 'locked'}" ${open ? `data-q="${q.id}"` : 'disabled'}><span class="y">Q${i + 1}</span><span class="t">${esc(q.q)}${open ? '' : `<small>Unlocks when your signal reaches ${q.needs === 'moon' ? 'the Moon’s distance' : 'Voyager 1'}</small>`}</span>${st}</button></li>`; }).join('')}</ul>
    <p class="fine">All facts: <a href="${NASA_LD}" target="_blank" rel="noopener">NASA, What Is a Light-Day? ↗</a>. Progress is saved in this browser.</p>`);
}
function openQuestion(qid) {
  const q = QUESTIONS.find((x) => x.id === qid); if (!q) return;
  const r = ST.q[q.id];
  const order = q.a.map((_, i) => i).sort((a, b) => ((a * 7 + q.id.length * 3) % 5) - ((b * 7 + q.id.length * 3) % 5));
  openPanel(`<div class="meta"><span class="pill">Question ${QUESTIONS.indexOf(q) + 1} of ${QUESTIONS.length}</span></div>
    <h2 class="q">${esc(q.q)}</h2>
    <ul class="answers">${order.map((i) => `<li><button data-a="${i}" ${r && r.ok ? 'disabled' : ''} class="${r && r.ok && i === 0 ? 'right' : ''}">${esc(q.a[i])}</button></li>`).join('')}</ul>
    <div id="qResult">${r && r.ok ? explain(q, r) : `<p class="fine">${PTS.qFirst} points first try, ${PTS.qLater} after that.</p>`}</div>`);
  panelBody.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => {
    const rr = ST.q[q.id] || { tries: 0, ok: false }; if (rr.ok) return;
    rr.tries += 1; const ok = b.dataset.a === '0'; if (ok) rr.ok = true; ST.q[q.id] = rr; save();
    if (ok) {
      panelBody.querySelectorAll('[data-a]').forEach((x) => { x.disabled = true; }); b.classList.add('right'); $('qResult').innerHTML = explain(q, rr); refreshPts();
      toast(`+${rr.tries === 1 ? PTS.qFirst : PTS.qLater} points`, '✓');
      if (score().patch) setTimeout(() => toast('You earned the One light-day patch', '★'), 900);
    } else { b.classList.add('wrong'); b.disabled = true; $('qResult').innerHTML = `<p class="fine">Not quite. Try again for ${PTS.qLater} points.</p>`; }
  }));
}
function explain(q, r) {
  const next = QUESTIONS.find((x) => !(ST.q[x.id] && ST.q[x.id].ok) && ST.stops.includes(x.needs));
  return `<p><b class="ok">Right${r.tries === 1 ? ', first try' : ''}.</b> ${esc(q.why)}</p>
    <a class="src" href="${NASA_LD}" target="_blank" rel="noopener">Source: NASA, What Is a Light-Day? ↗</a>
    <p>${next ? `<button class="btn small primary" data-q="${next.id}">Next question</button> ` : ''}<button class="btn small" data-mission="log">Mission log</button></p>`;
}
panelBody.addEventListener('click', (e) => {
  const t = e.target.closest('[data-q],[data-mission]'); if (!t) return;
  if (t.dataset.q) openQuestion(t.dataset.q);
  else if (t.dataset.mission === 'log') openMission();
  else if (t.dataset.mission === 'again') { panel.hidden = true; send(); }
});
$('ptsBtn').addEventListener('click', openMission);
refreshPts();
const sendBtn = $('sendBtn'); sendBtn.disabled = false; sendBtn.textContent = ST.stops.includes('arrive') ? 'Send another message' : 'Send a message';
sendBtn.addEventListener('click', send);
addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !S.running) { e.preventDefault(); send(); }
  if (e.code === 'KeyF') { S.follow = !S.follow; toast(S.follow ? 'Following your message' : 'Free camera', '◎'); }
});
controls.addEventListener('start', () => { S.follow = false; });

// ---------- loop ----------
const tmp = [0, 0, 0], wp = new THREE.Vector3();
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (S.running) {
    S.t += dt * S.warp;
    while (S.next < STOPS.length && S.t * C >= STOPS[S.next].km) reach(STOPS[S.next++]);
    if (S.done) S.t = T;
  }
  const km = Math.min(D, S.t * C);
  if (pulse.visible) {
    pulse.position.copy(m3(along(km, tmp)));
    const pts = []; for (let i = 0; i <= 60; i++) pts.push(m3(along((km * i) / 60, tmp)));
    trailGeo.setFromPoints(pts);
    if (S.follow) { controls.target.lerp(pulse.position, 0.08); }
  }
  $('cT').textContent = fmtT(km / C); $('cD').textContent = fmtKm(km);
  $('cBar').style.width = `${(100 * km) / D}%`; $('cLeft').textContent = S.done ? 'Arrived' : fmtT((D - km) / C);
  controls.update();
  renderer.render(scene, camera);
  const w = innerWidth, h = innerHeight;
  for (const l of labels) {
    l.obj.getWorldPosition(wp); wp.project(camera);
    const vis = wp.z < 1 && Math.abs(wp.x) < 1.1 && Math.abs(wp.y) < 1.1;
    l.el.style.opacity = vis ? 1 : 0;
    if (vis) l.el.style.transform = `translate(${((wp.x + 1) / 2) * w}px, ${((1 - wp.y) / 2) * h}px)`;
  }
  stopMarks.forEach((m, i) => { m.material.color.set(ST.stops.includes(STOPS[i].id) && S.t * C >= STOPS[i].km ? 0xFF2D46 : 0x7fd3ff); });
  requestAnimationFrame(frame);
}
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
requestAnimationFrame(frame);
window.__sig = { S, STOPS, T, D, HP_R, send, setWarp, openMission, openQuestion, ST, score, voyager, E0, V, JD0 };
