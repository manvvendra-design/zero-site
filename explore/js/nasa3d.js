// NASA's own free 3D model of the Apollo Lunar Module (github.com/nasa/NASA-3D-Resources), made game-ready in
// Blender by tools/blender/prep_lm.py: real size, split into its two stages, physically based materials, crinkled
// foil and soft contact shadows baked into textures. Loads in the background; the code-built lander shows until then.
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/GLTFLoader.js';

const loader = new GLTFLoader();
const texLoader = new THREE.TextureLoader();
const cache = {};
let env = null;

// a simple lunar environment for reflections: black sky above, sunlit grey ground below
export function moonEnv(renderer) {
  if (env || !renderer) return env;
  const s = new THREE.Scene();
  const g = new THREE.SphereGeometry(10, 32, 16); const col = [];
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 10; const v = y > 0.02 ? 0.004 : 0.32 + 0.12 * Math.min(1, -y * 3); col.push(v, v * 0.98, v * 0.95); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  s.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const pm = new THREE.PMREMGenerator(renderer); env = pm.fromScene(s, 0.02).texture; pm.dispose();
  return env;
}

function tex(url, srgb) {
  const t = texLoader.load(url); t.channel = 1; t.flipY = false; t.anisotropy = 4;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; return t;
}
function stage(name) {
  if (!cache[name]) {
    cache[name] = loader.loadAsync(`models/lm_${name}.glb`).then((gl) => {
      const ao = tex(`models/lm_${name}_ao.jpg`), nrm = tex(`models/lm_${name}_nrm.jpg`);
      gl.scene.traverse((o) => {
        if (!o.isMesh) return;
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of ms) {
          m.aoMap = ao; m.aoMapIntensity = 1; m.normalMap = nrm; m.normalScale.set(1, -1);
          m.envMapIntensity = 1; if (env) m.envMap = env;
        }
      });
      return gl.scene;
    });
  }
  return cache[name].then((s) => s.clone());
}

// Swap the code-built lander inside `g` for NASA's model once it has loaded. full = with the crew cabin on top.
export function upgradeLM(g, full) {
  const proto = g.children.find((c) => c.isMesh) || g.children[0];
  Promise.all([stage('descent'), full ? stage('ascent') : null]).then(([d, a]) => {
    const fresh = new THREE.Group(); fresh.add(d); if (a) fresh.add(a);
    const mask = proto ? proto.layers.mask : 1, cast = true;
    fresh.traverse((o) => { o.layers.mask = mask; if (o.isMesh) { o.castShadow = cast; o.receiveShadow = true; if (env) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { m.envMap = env; }); } } });
    // keep anything the scene attached to the lander later (engine plume etc.)
    const keep = g.children.filter((c) => c.userData.keep);
    g.clear(); g.add(fresh, ...keep); g.userData.nasa = true;
  }).catch((e) => console.warn('NASA lander model not loaded, keeping the code-built one', e));
}
