// Orbital mechanics helpers. Positions are heliocentric ecliptic (J2000), in AU.
// Elements come from NASA JPL Horizons osculating elements at JD 2461368.5 (24 Nov 2026),
// propagated as simple two-body (Kepler) orbits. Good to a fraction of a degree for the planets
// over decades: right for a map, not for navigation.

const D2R = Math.PI / 180;

export const EPOCH_JD = 2461368.5;

export function jdFromDate(d) {
  return d.getTime() / 86400000 + 2440587.5;
}
export function dateFromJd(jd) {
  return new Date((jd - 2440587.5) * 86400000);
}
export function jdFromIso(iso) {
  return jdFromDate(new Date(iso + (iso.length <= 10 ? 'T12:00:00Z' : '')));
}

function solveKepler(M, e) {
  let E = e < 0.8 ? M : Math.PI;
  for (let i = 0; i < 30; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-10) break;
  }
  return E;
}

// el = [a (AU), e, i (deg), node (deg), argPeri (deg), meanAnomaly (deg) at epoch, meanMotion (deg/day)]
export function keplerPosition(el, jd, epoch = EPOCH_JD, out = [0, 0, 0]) {
  const [a, e, inc, node, peri, M0, n] = el;
  let M = (M0 + n * (jd - epoch)) * D2R;
  M = ((M % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const E = solveKepler(M, e);
  const xv = a * (Math.cos(E) - e);
  const yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const v = Math.atan2(yv, xv);
  const r = Math.hypot(xv, yv);
  const O = node * D2R, w = peri * D2R, I = inc * D2R;
  const cu = Math.cos(v + w), su = Math.sin(v + w);
  out[0] = r * (Math.cos(O) * cu - Math.sin(O) * su * Math.cos(I));
  out[1] = r * (Math.sin(O) * cu + Math.cos(O) * su * Math.cos(I));
  out[2] = r * (su * Math.sin(I));
  return out;
}

// Sample a full orbit (for drawing the ellipse).
export function orbitPath(el, steps = 256) {
  const pts = [];
  const [a, e, inc, node, peri] = el;
  for (let k = 0; k <= steps; k++) {
    const E = (k / steps) * 2 * Math.PI;
    const xv = a * (Math.cos(E) - e);
    const yv = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const v = Math.atan2(yv, xv);
    const r = Math.hypot(xv, yv);
    const O = node * D2R, w = peri * D2R, I = inc * D2R;
    const cu = Math.cos(v + w), su = Math.sin(v + w);
    pts.push([
      r * (Math.cos(O) * cu - Math.sin(O) * su * Math.cos(I)),
      r * (Math.sin(O) * cu + Math.cos(O) * su * Math.cos(I)),
      r * (su * Math.sin(I)),
    ]);
  }
  return pts;
}

// Trajectory sampled at a fixed step: linear interpolation between samples.
// Returns null before the first sample; clamps to the last sample after the end.
export function trajPosition(t, jd, out = [0, 0, 0]) {
  const n = t.xyz.length / 3;
  const f = (jd - t.jd0) / t.step;
  if (f < 0) return null;
  if (f >= n - 1) {
    const k = (n - 1) * 3;
    out[0] = t.xyz[k]; out[1] = t.xyz[k + 1]; out[2] = t.xyz[k + 2];
    return out;
  }
  const i = Math.floor(f), u = f - i, k = i * 3;
  for (let c = 0; c < 3; c++) out[c] = t.xyz[k + c] * (1 - u) + t.xyz[k + 3 + c] * u;
  return out;
}

// The map is not to scale: distance from the Sun is compressed logarithmically so that
// Mercury and Voyager 1 both fit on one screen. Direction is always true.
export const SCALE = { K: 14, R0: 0.25 };
export function mapRadius(rAU) {
  return SCALE.K * Math.log(1 + rAU / SCALE.R0);
}
export function toMap(p, out) {
  const r = Math.hypot(p[0], p[1], p[2]);
  const s = r > 0 ? mapRadius(r) / r : 0;
  // ecliptic (x, y, z) -> three.js (x, z-up becomes y-up): map ecliptic z to scene y
  out.set(p[0] * s, p[2] * s, -p[1] * s);
  return out;
}
