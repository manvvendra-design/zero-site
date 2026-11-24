// Mission 1: Apollo 11. Points, field notes, five sourced questions and a patch drawn in code.
// Progress lives in this browser only (localStorage), so it survives closing the page.
import { ALSJ11, LROC_FLAGS } from './sites.js';

const KEY = 'zu-a11-mission';
const FOUND = 'zu-walk-found';
export const PTS = { find: 10, landMax: 100, qFirst: 20, qLater: 10 };

// Each question unlocks once the player has seen the thing it is about (needs: an item id).
export const QUESTIONS = [
  { id: 'q-west', needs: 'a11-lm',
    q: 'Why did Armstrong take manual control and fly past the spot the computer was aiming for?',
    a: ['It was steering into a field of boulders around West crater', 'The landing radar had stopped working', 'Mission Control told him to land closer to Earth', 'The lander was too heavy to stop in time'],
    why: 'The computer was taking Eagle into the boulder field around West crater, a crater about the size of a football field. Flying on beyond it added about 0.6 km to how far Eagle landed past the planned spot.',
    src: ALSJ11('a11.landing.html'), srcLabel: 'NASA Apollo Lunar Surface Journal: The Landing' },
  { id: 'q-easep', needs: 'a11-lrrr',
    q: 'Which two experiments did Armstrong and Aldrin carry about 20 metres south of Eagle?',
    a: ['A laser reflector and a seismometer', 'A telescope and a weather station', 'A drill and a small rover', 'A radio mast and a rain gauge'],
    why: 'They set up a laser reflector and a passive seismometer, the two experiments scientists most wanted if no one ever went back.',
    src: ALSJ11('a11.summary.html'), srcLabel: 'NASA Apollo Lunar Surface Journal: Summary' },
  { id: 'q-littlewest', needs: 'a11-west',
    q: 'How far east of Eagle is Little West crater, the farthest point anyone reached on Apollo 11?',
    a: ['About 60 metres', 'About 6 metres', 'About 600 metres', 'About 6 kilometres'],
    why: 'Little West is about 60 metres east of the lander. Armstrong ran out and back, about 120 metres in all, in just over three minutes.',
    src: ALSJ11('a11.clsout.html'), srcLabel: 'NASA Apollo Lunar Surface Journal: Closeout' },
  { id: 'q-flag', needs: 'a11-flag',
    q: 'What happened to the flag when Eagle’s top half took off?',
    a: ['The engine exhaust blew it over', 'The astronauts took it back to Earth', 'It is still standing today', 'It was moved to the laser reflector'],
    why: 'Aldrin said the exhaust blew it over. Photos from orbit in 2012 show flag shadows at Apollo 12, 16 and 17, but none at Apollo 11.',
    src: LROC_FLAGS, srcLabel: 'NASA LROC: Apollo flags still standing' },
  { id: 'q-gravity', needs: 'a11-prints',
    q: 'How strong is gravity on the Moon compared with Earth?',
    a: ['About one-sixth as strong', 'About half as strong', 'The same', 'About one-hundredth as strong'],
    why: 'One-sixth. In his suit and backpack Armstrong weighed only about 60 pounds (27 kg). You can feel it in the game: your jumps are high and slow.',
    src: ALSJ11('a11.summary.html'), srcLabel: 'NASA Apollo Lunar Surface Journal: Summary' },
];

export function load() {
  let m = {};
  try { m = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { /* private mode */ }
  m.q = m.q || {}; m.land = m.land || null;
  return m;
}
export function save(m) { try { localStorage.setItem(KEY, JSON.stringify(m)); } catch (e) { /* ignore */ } }
export function foundSet() { try { return new Set(JSON.parse(localStorage.getItem(FOUND) || '[]')); } catch (e) { return new Set(); } }

// landing points: 0 for a crash; 40 hard but safe, 60 soft; +10 softer than Armstrong; +10 more fuel than him;
// +20 within 30 m of the real spot (+10 within 100 m)
export function landPoints({ cls, down, fuel, fromReal }, REAL) {
  if (cls === 'bad') return 0;
  let p = cls === 'good' ? 60 : 40;
  if (down <= REAL.down) p += 10;
  if (fuel >= REAL.fuelLeft) p += 10;
  p += fromReal <= 30 ? 20 : fromReal <= 100 ? 10 : 0;
  return Math.min(PTS.landMax, p);
}
export function recordLanding(result, REAL) {
  const m = load(); const pts = landPoints(result, REAL);
  const best = m.land ? m.land.pts : -1;
  if (pts > best) m.land = { pts, verdict: result.verdict, at: Date.now() };
  save(m);
  return { pts, best: Math.max(pts, best), isBest: pts > best };
}
export function answer(m, qid, ok) {
  const r = m.q[qid] || { tries: 0, ok: false };
  if (r.ok) return r;
  r.tries += 1; if (ok) r.ok = true;
  m.q[qid] = r; save(m);
  return r;
}

export function score(items, found = foundSet(), m = load()) {
  const finds = items.filter((i) => found.has(i.id)).length;
  const qPts = QUESTIONS.reduce((s, q) => { const r = m.q[q.id]; return s + (r && r.ok ? (r.tries === 1 ? PTS.qFirst : PTS.qLater) : 0); }, 0);
  const land = m.land ? m.land.pts : 0;
  const answered = QUESTIONS.filter((q) => m.q[q.id] && m.q[q.id].ok).length;
  return {
    finds, findPts: finds * PTS.find, qPts, land, answered,
    total: finds * PTS.find + qPts + land,
    max: items.length * PTS.find + QUESTIONS.length * PTS.qFirst + PTS.landMax,
    patch: answered === QUESTIONS.length,
  };
}

// The Zero Universe Apollo 11 patch: our own design, drawn in code (not the official mission emblem).
// The Moon's horizon at Tranquility Base, the Earth high in the sky, the lander's descent stage, and the date.
export function patchSVG(earned = true, size = 220) {
  const id = 'p' + Math.random().toString(36).slice(2, 7);
  const ink = earned ? '#F4F1EA' : 'rgba(244,241,234,.35)', red = earned ? '#FF2D46' : 'rgba(255,45,70,.35)';
  return `<svg class="patch${earned ? '' : ' locked'}" viewBox="0 0 220 220" width="${size}" height="${size}" role="img" aria-label="Apollo 11 mission patch${earned ? '' : ' (locked)'}">
  <defs>
    <clipPath id="${id}c"><circle cx="110" cy="110" r="72"/></clipPath>
    <path id="${id}t" d="M 30 110 A 80 80 0 0 1 190 110"/>
    <path id="${id}b" d="M 16 110 A 94 94 0 0 0 204 110"/>
    <radialGradient id="${id}g" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="#1a1c24"/><stop offset="1" stop-color="#07080b"/></radialGradient>
  </defs>
  <circle cx="110" cy="110" r="106" fill="#0D0E11" stroke="${red}" stroke-width="5"/>
  <circle cx="110" cy="110" r="73.5" fill="none" stroke="${ink}" stroke-width="1.2" opacity=".6"/>
  <g clip-path="url(#${id}c)">
    <rect x="0" y="0" width="220" height="220" fill="url(#${id}g)"/>
    ${earned ? [[52, 58], [150, 50], [168, 88], [70, 96], [128, 74], [92, 44], [60, 120], [176, 120]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 ? 0.9 : 1.4}" fill="#F4F1EA" opacity=".8"/>`).join('') : ''}
    <circle cx="140" cy="70" r="13" fill="${earned ? '#3b6fb6' : '#555'}"/>
    <path d="M 140 57 A 13 13 0 0 1 140 83 A 7 13 0 0 0 140 57 Z" fill="#07080b" opacity=".8"/>
    <path d="M 20 150 Q 60 138 110 142 T 200 146 L 200 220 L 20 220 Z" fill="${earned ? '#8f8c86' : '#3a3936'}"/>
    <ellipse cx="62" cy="166" rx="16" ry="4" fill="#5d5b57"/><ellipse cx="160" cy="176" rx="10" ry="2.6" fill="#5d5b57"/>
    <g transform="translate(104 146) scale(1.45)" fill="none" stroke="${earned ? '#D9A43B' : ink}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
      <path d="M -16 -6 L 16 -6 L 20 -18 L -20 -18 Z" fill="${earned ? '#D9A43B' : 'none'}"/>
      <path d="M -18 -8 L -32 6 M 18 -8 L 32 6 M -36 6 L -28 6 M 28 6 L 36 6"/>
      <path d="M -8 -18 L -6 -30 L 6 -30 L 8 -18" stroke="${ink}"/>
    </g>
    <path d="M 0 0" />
  </g>
  <text font-family="Barlow Condensed, sans-serif" font-weight="800" font-size="16" letter-spacing="2.6" fill="${ink}"><textPath href="#${id}t" startOffset="50%" text-anchor="middle">APOLLO 11 · TRANQUILITY BASE</textPath></text>
  <text font-family="Barlow Condensed, sans-serif" font-weight="800" font-size="14" letter-spacing="2.6" fill="${red}"><textPath href="#${id}b" startOffset="50%" text-anchor="middle">20 JULY 1969 · ZERO UNIVERSE</textPath></text>
</svg>`;
}
