import * as THREE from 'three';

const canvas = document.querySelector('#bg');

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0a0a0f, 12, 28);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 0, 6);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

// Lights — neutral key + soft fill
scene.add(new THREE.AmbientLight(0xffffff, 0.45));
const sunLight = new THREE.DirectionalLight(0xffffff, 1.6);
sunLight.position.set(5, 3, 4);
scene.add(sunLight);
const fillLight = new THREE.PointLight(0x7c8cff, 18, 30);
fillLight.position.set(-5, -2, 3);
scene.add(fillLight);

// Per-section: planet config + texture path. Solid color shows briefly until the
// texture loads, then the sphere upgrades in place.
const SECTIONS = {
  hero: {
    radius: 1.7, color: 0x4166f5, emissive: 0x081330, emissiveIntensity: 0.1,
    roughness: 0.7, metalness: 0.05, spin: [0, 0.3, 0],
    texturePath: '/assets/planets/neptune.jpg',
  },
  about: {
    radius: 1.5, color: 0x3a7bd5, emissive: 0x07254a, emissiveIntensity: 0.15,
    roughness: 0.55, metalness: 0.05, spin: [0, 0.5, 0],
    texturePath: '/assets/planets/earth.jpg',
  },
  skills: {
    radius: 1.4, color: 0xc1440e, emissive: 0x000000, emissiveIntensity: 0,
    roughness: 0.9, metalness: 0.0, spin: [0, 0.45, 0],
    texturePath: '/assets/planets/mars.jpg',
  },
  work: {
    radius: 1.85, color: 0xd1a36b, emissive: 0x000000, emissiveIntensity: 0,
    roughness: 0.7, metalness: 0.0, spin: [0, 0.3, 0],
    texturePath: '/assets/planets/jupiter.jpg',
  },
  contact: {
    radius: 1.5, color: 0xe8d4a3, emissive: 0x000000, emissiveIntensity: 0,
    roughness: 0.7, metalness: 0.0, spin: [0, 0.35, 0],
    ring: {
      inner: 1.9, outer: 2.8, color: 0xc9b48a, opacity: 0.75, tilt: 0.45,
      texturePath: '/assets/planets/saturn_ring.png',
    },
    texturePath: '/assets/planets/saturn.jpg',
  },
};

// === Texture cache ===
const textures = {}; // { sectionName: { sphere?, ring? } }
function ensureEntry(name) {
  if (!textures[name]) textures[name] = {};
  return textures[name];
}

const textureLoader = new THREE.TextureLoader();

function loadTexture(path, onSuccess) {
  textureLoader.load(
    path,
    (tex) => { tex.colorSpace = THREE.SRGBColorSpace; onSuccess(tex); },
    undefined,
    () => { /* missing — keep solid color */ }
  );
}

// === Planet construction ===

function remapRingUVs(geom, inner, outer) {
  const pos = geom.attributes.position;
  const uv = geom.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const r = Math.sqrt(x * x + y * y);
    uv.setXY(i, (r - inner) / (outer - inner), 1);
  }
  uv.needsUpdate = true;
}

function addRingTo(group, ringCfg, ringTex) {
  const geom = new THREE.RingGeometry(ringCfg.inner, ringCfg.outer, 128);
  // Always remap UVs: ring textures load async, so the mesh is often created before the map exists.
  remapRingUVs(geom, ringCfg.inner, ringCfg.outer);
  const mat = new THREE.MeshBasicMaterial({
    map: ringTex || null,
    color: ringTex ? 0xffffff : ringCfg.color,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: ringTex ? 1 : ringCfg.opacity,
    alphaTest: ringTex ? 0.05 : 0,
  });
  const ring = new THREE.Mesh(geom, mat);
  ring.rotation.x = Math.PI * ringCfg.tilt;
  ring.userData.ringMat = mat;
  group.add(ring);
}

function buildPlanet(name) {
  const cfg = SECTIONS[name];
  const tex = textures[name] || {};
  const group = new THREE.Group();

  group.name = `planet:${name}`;

  const sphereMat = new THREE.MeshStandardMaterial({
    map: tex.sphere || null,
    color: tex.sphere ? 0xffffff : cfg.color,
    emissive: cfg.emissive,
    emissiveIntensity: cfg.emissiveIntensity,
    roughness: cfg.roughness,
    metalness: cfg.metalness,
  });
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(cfg.radius, 64, 64),
    sphereMat
  );
  sphere.userData.sphereMat = sphereMat;
  group.add(sphere);

  if (cfg.ring) addRingTo(group, cfg.ring, tex.ring);

  return group;
}

function applySphereTextureToPlanet(planet, cfg, tex) {
  planet.traverse((obj) => {
    const mat = obj?.userData?.sphereMat;
    if (mat) {
      mat.map = tex || null;
      mat.color.set(tex ? 0xffffff : cfg.color);
      mat.needsUpdate = true;
    }
  });
}

function applyRingTextureToPlanet(planet, ringCfg, tex) {
  planet.traverse((obj) => {
    const mat = obj?.userData?.ringMat;
    if (mat) {
      mat.map = tex || null;
      mat.color.set(tex ? 0xffffff : ringCfg.color);
      mat.opacity = tex ? 1 : ringCfg.opacity;
      mat.alphaTest = tex ? 0.05 : 0;
      mat.needsUpdate = true;
    }
  });
}

const SECTION_ORDER = ['hero', 'about', 'skills', 'work', 'contact'];

// === Planets rail (all planets exist at once) ===
const PLANET_SPACING_Z = 18;
const AXIAL_TILT_RAD = THREE.MathUtils.degToRad(23.5);
const planetsRail = new THREE.Group();
scene.add(planetsRail);

let currentSectionName = 'hero';
const planetsBySection = {};
for (let i = 0; i < SECTION_ORDER.length; i++) {
  const name = SECTION_ORDER[i];
  const planet = buildPlanet(name);
  planet.rotation.x = AXIAL_TILT_RAD;
  planet.position.set(0, 0, -i * PLANET_SPACING_Z);
  planetsRail.add(planet);
  planetsBySection[name] = planet;
}

// Kick off all texture loads in parallel; update planet materials on arrival.
for (const [name, cfg] of Object.entries(SECTIONS)) {
  if (cfg.texturePath) {
    loadTexture(cfg.texturePath, (tex) => {
      ensureEntry(name).sphere = tex;
      applySphereTextureToPlanet(planetsBySection[name], cfg, tex);
    });
  }
  if (cfg.ring?.texturePath) {
    loadTexture(cfg.ring.texturePath, (tex) => {
      ensureEntry(name).ring = tex;
      applyRingTextureToPlanet(planetsBySection[name], cfg.ring, tex);
    });
  }
}

// === Per-section rotation (no spring) ===
const restingSpin = new THREE.Vector3(0, 0.3, 0);

// === Direction-aware transition state ===
// Forward (next section) → lateral pan, alternating left/right.
// Backward (previous section / back to top) → zoom out far, new planet emerges from depth.
const ZOOM_AWAY_Z = -25;       // far away when receding

const PAN_OUT_DURATION = 0.5;
const PAN_IN_DURATION = 0.6;
const ZOOM_OUT_DURATION = 0.35;
const ZOOM_IN_DURATION = 0.35;
const JUMP_THROUGH_Z = 2;      // how far past the camera to fly (added to camera.position.z)
const JUMP_IN_FROM_Z = -12;    // where the next planet starts (depth) before zooming in
const JUMP_OUT_DURATION = 0.22;
const JUMP_IN_DURATION = 0.4;
const FAST_SCROLL_WINDOW_MS = 250;
const FAST_SCROLL_SPEEDUP = 0.65; // smaller = faster transitions during rapid scroll

let transitionState = 'idle'; // 'idle' | 'out' | 'in'
let transitionT = 0;
let pendingSection = null;
let lastSectionRequestAt = 0;
let isFastScroll = false;
const sectionQueue = [];


const outFrom = new THREE.Vector3();
const outTo = new THREE.Vector3();
const inFrom = new THREE.Vector3();
const inTo = new THREE.Vector3();
let outDuration = PAN_OUT_DURATION;
let inDuration = PAN_IN_DURATION;

function configureTransition(fromName, toName) {
  pendingSection = toName;

  const fromIdx = SECTION_ORDER.indexOf(fromName);
  const toIdx = SECTION_ORDER.indexOf(toName);
  const goingBack = toIdx < fromIdx;
  const speed = isFastScroll ? FAST_SCROLL_SPEEDUP : 1;

  const toZ = toIdx * PLANET_SPACING_Z; // rail position that brings target planet to z=0
  const fromZ = planetsRail.position.z;

  outFrom.set(0, 0, fromZ); // start from current rail position for responsiveness

  if (goingBack) {
    // Backward: move rail to target (no overshoot / spring).
    outTo.set(0, 0, toZ);
    outDuration = ZOOM_OUT_DURATION * speed;
  } else {
    // Forward: move rail to target (no overshoot / spring).
    outTo.set(0, 0, toZ);
    outDuration = JUMP_OUT_DURATION * speed;
  }
}

function startNextTransition() {
  if (transitionState !== 'idle') return;
  if (sectionQueue.length === 0) return;

  const next = sectionQueue.shift();
  configureTransition(currentSectionName, next);
  transitionState = 'out';
  transitionT = 0;
}

function setSection(name) {
  const cfg = SECTIONS[name];
  if (!cfg) return;
  if (name === currentSectionName && transitionState === 'idle' && sectionQueue.length === 0) return;

  // If user scrolls quickly, keep up by shortening durations for queued hops.
  const now = performance.now();
  isFastScroll = (now - lastSectionRequestAt) < FAST_SCROLL_WINDOW_MS;
  lastSectionRequestAt = now;

  // Build a path of intermediate sections so we don't skip planets.
  const currentTarget =
    (sectionQueue.length > 0)
      ? sectionQueue[sectionQueue.length - 1]
      : (pendingSection ?? currentSectionName);

  const fromIdx = SECTION_ORDER.indexOf(currentTarget);
  const toIdx = SECTION_ORDER.indexOf(name);
  if (fromIdx === -1 || toIdx === -1) return;
  if (fromIdx === toIdx) return;

  const step = toIdx > fromIdx ? 1 : -1;
  for (let i = fromIdx + step; step > 0 ? i <= toIdx : i >= toIdx; i += step) {
    const s = SECTION_ORDER[i];
    if (s && s !== pendingSection) sectionQueue.push(s);
  }

  // Start immediately if idle; otherwise finish current hop then continue the queue.
  startNextTransition();
}

// === Starfield ===
const starsGeometry = new THREE.BufferGeometry();
const starCount = 1200;
const starPositions = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i++) {
  starPositions[i * 3 + 0] = (Math.random() - 0.5) * 100;
  starPositions[i * 3 + 1] = (Math.random() - 0.5) * 100;
  starPositions[i * 3 + 2] = (Math.random() - 0.5) * 100;
}
starsGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
const stars = new THREE.Points(
  starsGeometry,
  new THREE.PointsMaterial({ color: 0xffffff, size: 0.04, sizeAttenuation: true })
);
scene.add(stars);

// === Section observer ===
const sections = document.querySelectorAll('section[data-spin]');
const dots = document.querySelectorAll('.dots a');

sections.forEach((s, i) => { if (i > 0) s.classList.add('pending'); });

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.remove('pending');
      const name = entry.target.dataset.spin;
      setSection(name);
      dots.forEach((d) => d.classList.toggle('active', d.dataset.target === name));
    }
  });
}, { threshold: 0.4 });

sections.forEach((s) => observer.observe(s));

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// === Render loop ===
const clock = new THREE.Clock();

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);

  const activePlanet = planetsBySection[currentSectionName];
  if (activePlanet) {
    activePlanet.rotation.x += restingSpin.x * dt;
    activePlanet.rotation.y += restingSpin.y * dt;
    activePlanet.rotation.z += restingSpin.z * dt;
  }

  // Position transition (lateral pan or depth zoom, depending on direction)
  if (transitionState === 'out') {
    transitionT += dt;
    const p = Math.min(transitionT / outDuration, 1);
    const eased = p * p; // ease-in
    planetsRail.position.lerpVectors(outFrom, outTo, eased);
    if (p >= 1) {
      currentSectionName = pendingSection;
      pendingSection = null;
      const cfg = SECTIONS[currentSectionName];
      restingSpin.set(cfg.spin[0], cfg.spin[1], cfg.spin[2]);
      planetsRail.position.copy(outTo);
      transitionState = 'idle';
      startNextTransition();
    }
  }

  stars.rotation.y += dt * 0.02;

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
