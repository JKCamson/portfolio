import * as THREE from 'three';
import {
  SECTIONS,
  SECTION_ORDER,
  PLANET_SPACING_Z,
  AXIAL_TILT_RAD,
} from './three/config.js';
import { scene, camera, renderer, attachResizeHandler } from './three/scene.js';
import { textures, ensureEntry, loadTexture } from './three/textures.js';
import {
  buildPlanet,
  applySphereTextureToPlanet,
  applyRingTextureToPlanet,
} from './three/planets.js';
import { createStarfield } from './three/starfield.js';
import {
  setSection,
  setPlanetsRail,
  getCurrentSectionName,
  restingSpin,
  updateTransition,
} from './three/transitions.js';

// === Planets rail (all planets exist at once) ===
const planetsRail = new THREE.Group();
scene.add(planetsRail);
setPlanetsRail(planetsRail);

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

const stars = createStarfield();
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

  const activePlanet = planetsBySection[getCurrentSectionName()];
  if (activePlanet) {
    activePlanet.rotation.x += restingSpin.x * dt;
    activePlanet.rotation.y += restingSpin.y * dt;
    activePlanet.rotation.z += restingSpin.z * dt;
  }

  updateTransition(dt);

  stars.rotation.y += dt * 0.02;

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();
