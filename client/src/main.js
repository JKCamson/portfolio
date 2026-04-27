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
import { setPlanetsRail } from './three/transitions.js';
import { initSectionObserver } from './dom/sectionObserver.js';
import { startRenderLoop } from './three/loop.js';

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

attachResizeHandler();
initSectionObserver();
startRenderLoop({ planetsBySection, stars });
