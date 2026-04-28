# Three.js Scene Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the rail-jump scene with a continuous scroll-driven camera sweep through scattered planets toward a distant sun, modelled on `test.tsx` at the repo root. Keep all five real-textured planets, all components, all CSS, all dot-nav HTML.

**Architecture:** Vanilla JS + Three.js + Vite (unchanged). Three.js scene logic stays under `client/src/three/` with the same module-per-responsibility split. Adds `sun.js`, `dust.js`, `scroll.js`. Replaces `starfield.js` and `loop.js`. Updates `config.js`, `scene.js`, `planets.js`. Strips `dom/sectionObserver.js`. Deletes `three/transitions.js`. Updates `main.js`.

**Reference:** `docs/superpowers/specs/2026-04-28-scene-redesign-design.md` (full design + scaled-down constants table).

**Verification approach:** No tests in this project. After every file change, `npm run build` from repo root must succeed. Final visual smoke test in a browser is the user's job (Task 6).

**User commit policy:** **The user handles git commits.** Subagents should NOT run `git add` or `git commit`. Make file edits, verify with `npm run build`, report back. The user commits when ready.

**Branch:** Feature branch `feat/scene-redesign` (NOT main). Created at the start of execution.

---

## Task 1: Add new modules — `sun.js`, `dust.js`, `scroll.js`

These three files are pure additions. Nothing imports them yet, so the build keeps passing and runtime behavior is unchanged. After this task the scene still renders the old way.

**Files:**
- Create: `client/src/three/sun.js`
- Create: `client/src/three/dust.js`
- Create: `client/src/three/scroll.js`

- [ ] **Step 1: Create `client/src/three/sun.js`**

```js
import * as THREE from 'three';

export function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,228,170,1)');
  g.addColorStop(0.18, 'rgba(255,180,80,0.65)');
  g.addColorStop(0.45, 'rgba(255,110,40,0.22)');
  g.addColorStop(1, 'rgba(255,80,20,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

const sharedGlowTexture = makeGlowTexture();

export function getSharedGlowTexture() {
  return sharedGlowTexture;
}

export function createSun({ position, radius, glowScale, coronaScale }) {
  const group = new THREE.Group();
  group.position.copy(position);

  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 64, 64),
    new THREE.MeshBasicMaterial({ color: 0xffd07a })
  );
  group.add(sphere);

  const glowMat = new THREE.SpriteMaterial({
    map: sharedGlowTexture,
    color: 0xffcb6b,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const glow = new THREE.Sprite(glowMat);
  glow.scale.set(glowScale, glowScale, 1);
  group.add(glow);

  const coronaMat = new THREE.SpriteMaterial({
    map: sharedGlowTexture,
    color: 0xff8a2a,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.5,
  });
  const corona = new THREE.Sprite(coronaMat);
  corona.scale.set(coronaScale, coronaScale, 1);
  group.add(corona);

  return { group, glow, corona, glowMat };
}
```

- [ ] **Step 2: Create `client/src/three/dust.js`**

```js
import * as THREE from 'three';

export function createDust(count = 600) {
  const geom = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 21 + Math.random() * 57;            // /14 of test.tsx 300..1100
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi) - 14;  // /14 of test.tsx -200
    const warm = Math.random();
    colors[i * 3 + 0] = 0.6 + warm * 0.4;
    colors[i * 3 + 1] = 0.3 + warm * 0.3;
    colors[i * 3 + 2] = 0.5 + (1 - warm) * 0.3;
  }
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 1.0,                                     // /14 of test.tsx 14
    vertexColors: true,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.07,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Points(geom, mat);
}
```

- [ ] **Step 3: Create `client/src/three/scroll.js`**

```js
let smoothScroll = 0;

export function getSmoothedScroll() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const target = max > 0 ? window.scrollY / max : 0;
  smoothScroll += (target - smoothScroll) * 0.07;
  return smoothScroll;
}
```

- [ ] **Step 4: Verify build**

Run from repo root:
```bash
npm run build
```
Expected: success.

- [ ] **Step 5: Stop and report**

No commit. Report DONE with files created and `git status` output.

---

## Task 2: Replace `starfield.js` with sphere-shell version

The exported function name (`createStarfield`) and signature stay the same, so `main.js` keeps working without changes. Only the internals change.

**Files:**
- Replace: `client/src/three/starfield.js`

- [ ] **Step 1: Overwrite `client/src/three/starfield.js`**

```js
import * as THREE from 'three';

export function createStarfield(count = 3500) {
  const geom = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 43 + Math.random() * 128;            // /14 of test.tsx 600..2400
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
    const intensity = 0.4 + Math.random() * 0.6;
    const tint = Math.random();
    colors[i * 3 + 0] = intensity * (tint < 0.7 ? 1 : 0.7);
    colors[i * 3 + 1] = intensity * (tint < 0.4 ? 0.95 : 1);
    colors[i * 3 + 2] = intensity * (tint > 0.6 ? 1 : 0.85);
  }
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.12,                                    // small enough at our scale
    vertexColors: true,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });
  return new THREE.Points(geom, mat);
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```
Expected: success.

- [ ] **Step 3: Stop and report**

No commit. Report DONE.

---

## Task 3: Atomic switch — config + scene + planets + loop + observer + delete transitions + main.js

This is the largest task. All these files change together because they're interdependent. After this task, the scene renders the new way: scattered planets, sun, camera sweep on scroll. Verify with `npm run build` after **all** edits, not between them.

**Files:**
- Replace: `client/src/three/config.js`
- Replace: `client/src/three/scene.js`
- Replace: `client/src/three/planets.js`
- Replace: `client/src/three/loop.js`
- Replace: `client/src/dom/sectionObserver.js`
- Delete: `client/src/three/transitions.js`
- Replace: `client/src/main.js`

- [ ] **Step 1: Overwrite `client/src/three/config.js`**

```js
import * as THREE from 'three';

export const SECTIONS = {
  hero: {
    radius: 1.7, color: 0x4166f5, emissive: 0x081330, emissiveIntensity: 0.25,
    roughness: 0.85, metalness: 0.05,
    offset: { x: -65 / 14, y: 12 / 14 },
    z: 180 / 14,
    rotSpeed: 0.005,
    haloColor: 0x4a7cff,
    haloOpacity: 0.45,
    texturePath: '/assets/planets/neptune.jpg',
  },
  about: {
    radius: 1.5, color: 0x3a7bd5, emissive: 0x07254a, emissiveIntensity: 0.25,
    roughness: 0.85, metalness: 0.05,
    offset: { x: 78 / 14, y: -22 / 14 },
    z: 60 / 14,
    rotSpeed: 0.003,
    haloColor: 0x4ddc92,
    haloOpacity: 0.45,
    texturePath: '/assets/planets/earth.jpg',
  },
  skills: {
    radius: 1.4, color: 0xc1440e, emissive: 0x3a0a06, emissiveIntensity: 0.25,
    roughness: 0.85, metalness: 0.05,
    offset: { x: -95 / 14, y: 28 / 14 },
    z: -90 / 14,
    rotSpeed: 0.004,
    haloColor: 0xff5a3d,
    haloOpacity: 0.45,
    texturePath: '/assets/planets/mars.jpg',
  },
  work: {
    radius: 1.85, color: 0xd1a36b, emissive: 0x3a2a10, emissiveIntensity: 0.25,
    roughness: 0.85, metalness: 0.05,
    offset: { x: 62 / 14, y: 24 / 14 },
    z: -230 / 14,
    rotSpeed: 0.006,
    haloColor: 0xe2b76c,
    haloOpacity: 0.45,
    texturePath: '/assets/planets/jupiter.jpg',
  },
  contact: {
    radius: 1.5, color: 0xe8d4a3, emissive: 0x3a2a10, emissiveIntensity: 0.25,
    roughness: 0.85, metalness: 0.05,
    offset: { x: -55 / 14, y: -32 / 14 },
    z: -370 / 14,
    rotSpeed: 0.007,
    haloColor: 0xe2b76c,
    haloOpacity: 0.45,
    ring: {
      inner: 1.9, outer: 2.8, color: 0xc9b48a, opacity: 0.75, tilt: 0.45,
      texturePath: '/assets/planets/saturn_ring.png',
    },
    texturePath: '/assets/planets/saturn.jpg',
  },
};

export const SECTION_ORDER = ['hero', 'about', 'skills', 'work', 'contact'];

// Camera sweep
export const CAMERA_START_Z = 350 / 14;
export const CAMERA_END_Z = -540 / 14;

// Sun
export const SUN_POSITION = new THREE.Vector3(0, 0, -650 / 14);
export const SUN_RADIUS = 90 / 14;
export const SUN_GLOW_SCALE = 520 / 14;
export const SUN_CORONA_SCALE = 820 / 14;
```

- [ ] **Step 2: Overwrite `client/src/three/scene.js`**

```js
import * as THREE from 'three';
import { CAMERA_START_Z, SUN_POSITION } from './config.js';

const canvas = document.querySelector('#bg');

export const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x05020a, 0.0008);

export const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  5000
);
camera.position.set(0, 0, CAMERA_START_Z);

export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x02030a, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;

scene.add(new THREE.AmbientLight(0x222244, 0.55));
const sunLight = new THREE.PointLight(0xffd599, 4.5, 3000, 1.4);
sunLight.position.copy(SUN_POSITION);
scene.add(sunLight);

export function attachResizeHandler() {
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}
```

- [ ] **Step 3: Overwrite `client/src/three/planets.js`**

```js
import * as THREE from 'three';
import { SECTIONS } from './config.js';
import { textures } from './textures.js';
import { getSharedGlowTexture } from './sun.js';

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

function addHaloTo(group, cfg) {
  const haloMat = new THREE.SpriteMaterial({
    map: getSharedGlowTexture(),
    color: cfg.haloColor,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: cfg.haloOpacity,
  });
  const halo = new THREE.Sprite(haloMat);
  const haloScale = cfg.radius * 4;
  halo.scale.set(haloScale, haloScale, 1);
  group.add(halo);
}

export function buildPlanet(name) {
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
  sphere.rotation.z = (Math.random() - 0.5) * 0.6;
  group.add(sphere);

  addHaloTo(group, cfg);

  if (cfg.ring) addRingTo(group, cfg.ring, tex.ring);

  return { group, mesh: sphere };
}

export function applySphereTextureToPlanet(planet, cfg, tex) {
  planet.traverse((obj) => {
    const mat = obj?.userData?.sphereMat;
    if (mat) {
      mat.map = tex || null;
      mat.color.set(tex ? 0xffffff : cfg.color);
      mat.needsUpdate = true;
    }
  });
}

export function applyRingTextureToPlanet(planet, ringCfg, tex) {
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
```

**Note:** `buildPlanet` now returns `{ group, mesh }` instead of a bare `Group`. `main.js` uses both fields. The texture-apply functions still take a `THREE.Group` (the `planet.group`).

- [ ] **Step 4: Overwrite `client/src/three/loop.js`**

```js
import { CAMERA_START_Z, CAMERA_END_Z, SUN_GLOW_SCALE, SUN_CORONA_SCALE } from './config.js';
import { getSmoothedScroll } from './scroll.js';

export function startRenderLoop({ scene, camera, renderer, planets, sun, stars, dust }) {
  function animate() {
    const t = getSmoothedScroll();
    camera.position.z = CAMERA_START_Z + (CAMERA_END_Z - CAMERA_START_Z) * t;

    const time = Date.now() * 0.0001;
    camera.position.x = Math.sin(time) * 0.4;
    camera.position.y = Math.cos(time * 0.7) * 0.3;
    camera.lookAt(0, 0, sun.group.position.z);

    planets.forEach((p) => { p.mesh.rotation.y += p.rotSpeed; });

    const pulse = 1 + Math.sin(Date.now() * 0.0011) * 0.04;
    sun.glow.scale.set(SUN_GLOW_SCALE * pulse, SUN_GLOW_SCALE * pulse, 1);
    sun.corona.scale.set(SUN_CORONA_SCALE * pulse, SUN_CORONA_SCALE * pulse, 1);
    sun.glowMat.opacity = 0.85 + Math.max(0, Math.min(1, t)) * 0.15;

    stars.rotation.y += 0.00008;
    dust.rotation.y -= 0.00004;

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();
}
```

- [ ] **Step 5: Overwrite `client/src/dom/sectionObserver.js`**

```js
export function initSectionObserver() {
  const sections = document.querySelectorAll('section[data-spin]');
  const dots = document.querySelectorAll('.dots a');

  sections.forEach((s, i) => { if (i > 0) s.classList.add('pending'); });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.remove('pending');
        const name = entry.target.dataset.spin;
        dots.forEach((d) => d.classList.toggle('active', d.dataset.target === name));
      }
    });
  }, { threshold: 0.4 });

  sections.forEach((s) => observer.observe(s));
}
```

- [ ] **Step 6: Delete `client/src/three/transitions.js`**

```bash
rm client/src/three/transitions.js
```

- [ ] **Step 7: Overwrite `client/src/main.js`**

```js
import { scene, camera, renderer, attachResizeHandler } from './three/scene.js';
import {
  SECTION_ORDER,
  SECTIONS,
  SUN_POSITION,
  SUN_RADIUS,
  SUN_GLOW_SCALE,
  SUN_CORONA_SCALE,
} from './three/config.js';
import { ensureEntry, loadTexture } from './three/textures.js';
import {
  buildPlanet,
  applySphereTextureToPlanet,
  applyRingTextureToPlanet,
} from './three/planets.js';
import { createSun } from './three/sun.js';
import { createStarfield } from './three/starfield.js';
import { createDust } from './three/dust.js';
import { initSectionObserver } from './dom/sectionObserver.js';
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

const sun = createSun({
  position: SUN_POSITION,
  radius: SUN_RADIUS,
  glowScale: SUN_GLOW_SCALE,
  coronaScale: SUN_CORONA_SCALE,
});
scene.add(sun.group);

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
startRenderLoop({ scene, camera, renderer, planets, sun, stars, dust });
```

- [ ] **Step 8: Verify build**

```bash
npm run build
```
Expected: success. If it fails, the most likely cause is an import that still references `transitions.js` or `setSection`. Grep for `transitions` and `setSection` under `client/src/` and remove any leftovers.

- [ ] **Step 9: Stop and report**

No commit. Report DONE with `git status` showing modified files and `client/src/three/transitions.js` deleted.

---

## Task 4: Visual smoke test (user)

This task is the user's. Run the dev server and confirm the scene behaves correctly.

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Open in browser**

Open the URL Vite prints. Confirm:

- All five planets visible at varied screen positions (some left, some right, some up, some down).
- Each planet has a soft halo of its accent color.
- Saturn's ring renders with the texture.
- Sun visible in the distance — yellow core with orange/yellow glow, gently pulsing.
- Camera floats subtly even without scrolling.
- Scrolling the page causes the camera to fly forward through the planets toward the sun.
- No discrete jumps — motion is continuous.
- Stars and dust visible in the background.
- Right-side dots highlight the current section as you scroll.
- Clicking a dot scrolls smoothly to that section (default browser anchor behavior).
- No console errors.

- [ ] **Step 3: Tune if needed**

If something looks off:
- Planets too close / too small / too big → adjust `SECTIONS[<name>].offset` or `radius` in `config.js`.
- Camera sweep too short / too long → adjust `CAMERA_START_Z` / `CAMERA_END_Z` in `config.js`.
- Sun too small / too dim → adjust `SUN_RADIUS`, `SUN_GLOW_SCALE`, `SUN_CORONA_SCALE`.

All tuning happens in `config.js` only. No other file should need changes.
