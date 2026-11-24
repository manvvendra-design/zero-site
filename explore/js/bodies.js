// Osculating heliocentric ecliptic elements from NASA JPL Horizons at JD 2461368.5 (24 Nov 2026 00:00 TDB).
// [a AU, e, inclination deg, ascending node deg, argument of perihelion deg, mean anomaly deg, mean motion deg/day]
// Colours and display sizes are artistic; sizes are not to scale.

export const PLANETS = [
  { key: 'mercury', name: 'Mercury', size: 0.55, color: '#a49b91', el: [0.387097517, 0.205637412, 7.00336884, 48.297161, 29.2004978, 55.8459545, 4.09235717] },
  { key: 'venus', name: 'Venus', size: 0.85, color: '#e3c58f', el: [0.723334651, 0.00674075964, 3.39445958, 76.6030513, 55.0050611, 308.897209, 1.60212243] },
  { key: 'earth', name: 'Earth', size: 0.9, color: '#3d7bd6', el: [0.999045934, 0.0160437211, 0.00372936936, 174.171721, 291.214374, 317.217249, 0.987021338] },
  { key: 'mars', name: 'Mars', size: 0.65, color: '#c1440e', el: [1.52375971, 0.0933894871, 1.84742518, 49.4797835, 286.67467, 127.138048, 0.523997743] },
  { key: 'jupiter', name: 'Jupiter', size: 2.1, color: '#d4b08a', el: [5.20398207, 0.0482417071, 1.30333472, 100.509838, 273.923628, 116.16831, 0.0830629927] },
  { key: 'saturn', name: 'Saturn', size: 1.8, color: '#e6cf98', rings: true, el: [9.53826028, 0.055085761, 2.48852838, 113.705385, 338.846637, 286.276045, 0.0334628075] },
  { key: 'uranus', name: 'Uranus', size: 1.3, color: '#9fd8e0', el: [19.2605333, 0.0476606939, 0.772293839, 74.0225956, 92.6515668, 261.951076, 0.0116603367] },
  { key: 'neptune', name: 'Neptune', size: 1.25, color: '#4a6fd8', el: [30.0656793, 0.0096687004, 1.77166876, 131.84418, 281.036135, 310.951817, 0.00597872705] },
];

export const SMALL_BODIES = [
  { key: 'pluto', name: 'Pluto', size: 0.4, color: '#cdb89f', dwarf: true, el: [39.7459371, 0.251455415, 17.2924379, 110.439527, 114.831561, 52.6515772, 0.00393337148] },
  { key: 'ceres', name: 'Ceres', size: 0.32, color: '#9a948c', dwarf: true, el: [2.76640199, 0.0798448768, 10.5866685, 80.2482696, 73.1110665, 310.605257, 0.214205758] },
  { key: 'vesta', name: 'Vesta', size: 0.26, color: '#a9a094', el: [2.36111747, 0.0902487811, 7.14388641, 103.699378, 151.404032, 126.891638, 0.271661243] },
  { key: 'itokawa', name: 'Itokawa', size: 0.18, color: '#8c8478', el: [1.32415, 0.280101, 1.620934, 69.07485, 162.8288, 279.3412, 0.6468421] },
  { key: 'ryugu', name: 'Ryugu', size: 0.18, color: '#6f6a64', el: [1.190914, 0.1910373, 5.866403, 251.2889, 211.6102, 189.7501, 0.7583737] },
  { key: 'bennu', name: 'Bennu', size: 0.18, color: '#6a655e', el: [1.125923, 0.203668, 6.032988, 1.965641, 66.40247, 211.0584, 0.8249756] },
  { key: 'didymos', name: 'Didymos & Dimorphos', size: 0.18, color: '#8a8070', el: [1.642729, 0.3830933, 3.413772, 72.98471, 319.5775, 339.5069, 0.4681178] },
  { key: 'arrokoth', name: 'Arrokoth', size: 0.2, color: '#b5674a', el: [44.05552, 0.03518524, 2.451354, 159.0216, 188.1914, 312.1634, 0.003370572] },
  // Comet 67P's orbit changes at each pass near Jupiter: these are the elements at the Philae landing (JD 2456973.5).
  { key: 'c67p', name: 'Comet 67P', size: 0.2, color: '#c9c3b8', comet: true, epoch: 2456973.5, el: [3.462832, 0.6409782, 7.040233, 50.14243, 12.78539, 318.0801, 0.1529526] },
];

// The Moon's geocentric elements at the same epoch (a in AU). Drawn at a fixed display distance from Earth.
export const MOON_EL = [0.002582168, 0.07082835, 5.002039, 324.1282, 120.1716, 332.4342, 13.0977];

// Spacecraft with real trajectories from JPL Horizons (see trajectories.js).
export const PROBES = [
  { key: 'voyager1', name: 'Voyager 1', launch: '1977-09-05', active: true },
  { key: 'voyager2', name: 'Voyager 2', launch: '1977-08-20', active: true },
  { key: 'pioneer10', name: 'Pioneer 10', launch: '1972-03-03', active: false, lastContact: '2003-01-23' },
  { key: 'newhorizons', name: 'New Horizons', launch: '2006-01-19', active: true },
  { key: 'cassini', name: 'Cassini', launch: '1997-10-15', end: '2017-09-15' },
  { key: 'rosetta', name: 'Rosetta', launch: '2004-03-02', end: '2016-09-30' },
  { key: 'juno', name: 'Juno', launch: '2011-08-05', trajEnd: '2025-09-01' },
];
