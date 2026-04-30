import { scene, camera, renderer, attachResizeHandler } from './three/scene.js';
import {
  SECTION_ORDER,
  SECTIONS,
  SUN_POSITION,
  SUN_RADIUS,
  SUN_GLOW_SCALE,
  SUN_CORONA_SCALE,
  SUN_TEXTURE_PATH,
  MILKYWAY_TEXTURE_PATH,
  SKYBOX_RADIUS,
  SKYBOX_OPACITY,
} from './three/config.js';
import { ensureEntry, loadTexture } from './three/textures.js';
import {
  buildPlanet,
  applySphereTextureToPlanet,
  applyRingTextureToPlanet,
} from './three/planets.js';
import { createSun, applySunTexture } from './three/sun.js';
import { createSkybox, applySkyboxTexture } from './three/skybox.js';
import { createStarfield } from './three/starfield.js';
import { createDust } from './three/dust.js';
import { initSectionObserver } from './dom/sectionObserver.js';
import { initContactForm } from './dom/contactForm.js';
import { startRenderLoop } from './three/loop.js';

import { Nav } from './components/Nav.js';
import { Hero } from './components/Hero.js';
import { About } from './components/About.js';
import { Skills } from './components/Skills.js';
import { Work } from './components/Work.js';
import { Contact } from './components/Contact.js';

document.querySelector('#nav-mount').innerHTML = Nav();
document.querySelector('#app').innerHTML = [
  Hero(),
  About(),
  Skills(),
  Work(),
  Contact(),
].join('');

const skybox = createSkybox({ radius: SKYBOX_RADIUS, opacity: SKYBOX_OPACITY });
scene.add(skybox);
loadTexture(MILKYWAY_TEXTURE_PATH, (tex) => applySkyboxTexture(skybox, tex));

const sun = createSun({
  position: SUN_POSITION,
  radius: SUN_RADIUS,
  glowScale: SUN_GLOW_SCALE,
  coronaScale: SUN_CORONA_SCALE,
});
scene.add(sun.group);
loadTexture(SUN_TEXTURE_PATH, (tex) => applySunTexture(sun, tex));

const stars = createStarfield();
scene.add(stars);

const dust = createDust();
scene.add(dust);

const planets = SECTION_ORDER.map((name) => {
  const { group, mesh } = buildPlanet(name);
  const cfg = SECTIONS[name];
  group.position.set(cfg.offset.x, cfg.offset.y, cfg.z);
  scene.add(group);
  return { name, group, mesh, rotSpeed: cfg.rotSpeed };
});

for (const [name, cfg] of Object.entries(SECTIONS)) {
  const planet = planets.find((p) => p.name === name).group;
  if (cfg.texturePath) {
    loadTexture(cfg.texturePath, (tex) => {
      ensureEntry(name).sphere = tex;
      applySphereTextureToPlanet(planet, cfg, tex);
    });
  }
  if (cfg.ring?.texturePath) {
    loadTexture(cfg.ring.texturePath, (tex) => {
      ensureEntry(name).ring = tex;
      applyRingTextureToPlanet(planet, cfg.ring, tex);
    });
  }
}

attachResizeHandler();
initSectionObserver();
initContactForm();
startRenderLoop({ scene, camera, renderer, planets, sun, stars, dust });
