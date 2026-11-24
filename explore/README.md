# Zero Universe Explorer

A 3D map of the real Solar System in the browser, where people discover what every space agency has achieved.
Plain static files, no build step: open `index.html` through any static server.

- `js/bodies.js`: orbital elements for planets, dwarf planets, asteroids and comet 67P (NASA JPL Horizons, 24 Nov 2026).
- `js/trajectories.js`: real flight paths of Voyager 1 and 2, Pioneer 10, New Horizons, Cassini, Rosetta and Juno (JPL Horizons).
- `js/achievements.js`: the 45 achievements and 6 quests. Each one links its NASA NSSDCA record. Add one by copying an entry.
- `js/orbit.js`: Kepler solver and the log-scale map projection (directions true, distances compressed).
- `js/main.js`: the three.js scene, timeline, panels and progress (saved in the visitor's browser).
- `vendor/`: three.js r170 (MIT, see THREE_LICENSE) and OrbitControls.

No AI-generated imagery: every surface is drawn in code.

## Walk mode (walk.html)

`walk.html?site=apollo11|change4|jezero|lz1` drops you onto a real landing site as a code-built astronaut.
Walk up to red markers to inspect the hardware; every item links a primary source (js/sites.js).
Controls: WASD/arrows, Shift, Space, E; touch joystick; any standard gamepad (PS5 DualSense: left stick, right stick, Cross jump, Square inspect, Circle close).
Models are built in code in js/models.js (no AI imagery, no logos). Distances between objects are shortened on purpose.
