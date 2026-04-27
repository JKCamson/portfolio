import * as THREE from 'three';
import {
  SECTIONS,
  SECTION_ORDER,
  PLANET_SPACING_Z,
  AXIAL_TILT_RAD,
  FAST_SCROLL_WINDOW_MS,
  FAST_SCROLL_SPEEDUP,
  PAN_OUT_DURATION,
  PAN_IN_DURATION,
  ZOOM_OUT_DURATION,
  JUMP_OUT_DURATION,
} from './three/config.js';
import { scene, camera, renderer, attachResizeHandler } from './three/scene.js';
import { textures, ensureEntry, loadTexture } from './three/textures.js';
import {
  buildPlanet,
  applySphereTextureToPlanet,
  applyRingTextureToPlanet,
} from './three/planets.js';

// === Planets rail (all planets exist at once) ===
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

// === Direction-aware transition state ===
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

attachResizeHandler();

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
