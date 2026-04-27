# Portfolio Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the portfolio repo into a `client/` + `server/` layout, split `src/main.js` (377 lines) into focused modules under `client/src/three/`, extract HTML sections into `client/src/components/`, split `style.css` into `client/src/styles/`, and add `partials/`, `dom/`, `utils/`, `pages/` folders so the codebase scales as the site grows.

**Architecture:** Vanilla JS + Vite + Three.js. No framework added. Components are JS template functions returning HTML strings. Three.js logic is split by responsibility (config, scene, textures, planets, starfield, transitions, loop). DOM-only behavior lives in `dom/`. CSS is one file per component/partial, aggregated by `styles/main.css`.

**Tech Stack:** Vite 5, Three.js 0.169, vanilla ES modules, plain CSS with `@import`.

**Verification approach:** This project has no tests. After each task that changes runtime code, the verification step is `npm run build` from repo root — Vite's build catches import errors, syntax errors, and missing modules. A single end-to-end visual smoke test is reserved for the final task (the user opens the dev server and confirms the page renders and scrolls correctly).

**Reference:** Full design at `docs/superpowers/specs/2026-04-27-portfolio-restructure-design.md`.

---

## Task 1: Move existing app into `client/`

Move all current frontend files into a new `client/` directory using `git mv` to preserve history. After this task, the old structure is gone and Vite still works when invoked from `client/`.

**Files:**
- Move: `index.html` → `client/index.html`
- Move: `src/` → `client/src/`
- Move: `public/` → `client/public/`
- Move: `package.json` → `client/package.json`
- Move: `package-lock.json` → `client/package-lock.json`
- Delete: root `node_modules/`, root `dist/` (regenerated inside `client/`)

- [ ] **Step 1: Create the `client/` directory and move files with `git mv`**

Run from repo root:

```bash
mkdir -p client
git mv index.html client/index.html
git mv src client/src
git mv public client/public
git mv package.json client/package.json
git mv package-lock.json client/package-lock.json
```

- [ ] **Step 2: Remove stale root `node_modules/` and `dist/`**

These will be reinstalled inside `client/` in the next step.

```bash
rm -rf node_modules dist
```

- [ ] **Step 3: Install dependencies inside `client/`**

```bash
cd client && npm install
```

Expected: `node_modules/` and `package-lock.json` exist under `client/`. No errors.

- [ ] **Step 4: Verify the build still works from inside `client/`**

```bash
cd client && npm run build
```

Expected: Vite reports a successful build, `client/dist/` is created with `index.html` and bundled assets.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: move frontend into client/ folder"
```

---

## Task 2: Add root `package.json` with delegating scripts

Add a thin root `package.json` so `npm run dev|build|preview` from repo root delegates into `client/`. No dependencies at root.

**Files:**
- Create: `package.json`

- [ ] **Step 1: Create root `package.json`**

```json
{
  "name": "portfolio",
  "private": true,
  "version": "0.0.1",
  "scripts": {
    "dev": "npm --prefix client run dev",
    "build": "npm --prefix client run build",
    "preview": "npm --prefix client run preview"
  }
}
```

- [ ] **Step 2: Verify `npm run build` works from repo root**

```bash
npm run build
```

Expected: Vite builds successfully. The output goes to `client/dist/` (Vite resolves paths relative to `client/`).

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add root package.json with delegating scripts"
```

---

## Task 3: Extract Three.js config into `client/src/three/config.js`

Pull the `SECTIONS` object, `SECTION_ORDER`, and all timing/spacing constants out of `client/src/main.js` into a pure-data module.

**Files:**
- Create: `client/src/three/config.js`
- Modify: `client/src/main.js` (remove extracted constants, add import)

- [ ] **Step 1: Create `client/src/three/config.js`**

```js
import * as THREE from 'three';

// Per-section: planet config + texture path. Solid color shows briefly until the
// texture loads, then the sphere upgrades in place.
export const SECTIONS = {
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

export const SECTION_ORDER = ['hero', 'about', 'skills', 'work', 'contact'];

// Rail layout
export const PLANET_SPACING_Z = 18;
export const AXIAL_TILT_RAD = THREE.MathUtils.degToRad(23.5);

// Transition timing
export const PAN_OUT_DURATION = 0.5;
export const PAN_IN_DURATION = 0.6;
export const ZOOM_OUT_DURATION = 0.35;
export const ZOOM_IN_DURATION = 0.35;
export const JUMP_THROUGH_Z = 2;
export const JUMP_IN_FROM_Z = -12;
export const JUMP_OUT_DURATION = 0.22;
export const JUMP_IN_DURATION = 0.4;
export const FAST_SCROLL_WINDOW_MS = 250;
export const FAST_SCROLL_SPEEDUP = 0.65;
export const ZOOM_AWAY_Z = -25;
```

- [ ] **Step 2: Replace inline constants in `client/src/main.js` with imports**

At the top of `client/src/main.js`, after `import * as THREE from 'three';`, add:

```js
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
```

Then delete from `main.js`:
- The entire `const SECTIONS = { ... };` block.
- The line `const SECTION_ORDER = ['hero', 'about', 'skills', 'work', 'contact'];`.
- The lines defining `PLANET_SPACING_Z`, `AXIAL_TILT_RAD`, `ZOOM_AWAY_Z`, `PAN_OUT_DURATION`, `PAN_IN_DURATION`, `ZOOM_OUT_DURATION`, `ZOOM_IN_DURATION`, `JUMP_THROUGH_Z`, `JUMP_IN_FROM_Z`, `JUMP_OUT_DURATION`, `JUMP_IN_DURATION`, `FAST_SCROLL_WINDOW_MS`, `FAST_SCROLL_SPEEDUP`.

- [ ] **Step 3: Verify the build succeeds**

```bash
npm run build
```

Expected: success, no errors about undefined identifiers.

- [ ] **Step 4: Commit**

```bash
git add client/src/three/config.js client/src/main.js
git commit -m "refactor: extract three config into three/config.js"
```

---

## Task 4: Extract scene primitives into `client/src/three/scene.js`

Move scene, camera, renderer, lights, and the resize handler. Export `{ scene, camera, renderer }` and `attachResizeHandler()`.

**Files:**
- Create: `client/src/three/scene.js`
- Modify: `client/src/main.js`

- [ ] **Step 1: Create `client/src/three/scene.js`**

```js
import * as THREE from 'three';

const canvas = document.querySelector('#bg');

export const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0a0a0f, 12, 28);

export const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 0, 6);

export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
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

export function attachResizeHandler() {
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}
```

- [ ] **Step 2: Update `client/src/main.js` to import scene primitives**

Replace the top of `main.js` (everything from `const canvas = ...` through `scene.add(fillLight);`) with:

```js
import { scene, camera, renderer, attachResizeHandler } from './three/scene.js';
```

Then near the bottom, **delete** the existing `window.addEventListener('resize', ...)` block and add **before** `animate();`:

```js
attachResizeHandler();
```

- [ ] **Step 3: Verify the build succeeds**

```bash
npm run build
```

Expected: success.

- [ ] **Step 4: Commit**

```bash
git add client/src/three/scene.js client/src/main.js
git commit -m "refactor: extract scene/camera/renderer/lights into three/scene.js"
```

---

## Task 5: Extract texture cache + loader into `client/src/three/textures.js`

Move `textures` cache, `ensureEntry`, `loadTexture` helper.

**Files:**
- Create: `client/src/three/textures.js`
- Modify: `client/src/main.js`

- [ ] **Step 1: Create `client/src/three/textures.js`**

```js
import * as THREE from 'three';

export const textures = {}; // { sectionName: { sphere?, ring? } }

export function ensureEntry(name) {
  if (!textures[name]) textures[name] = {};
  return textures[name];
}

const textureLoader = new THREE.TextureLoader();

export function loadTexture(path, onSuccess) {
  textureLoader.load(
    path,
    (tex) => { tex.colorSpace = THREE.SRGBColorSpace; onSuccess(tex); },
    undefined,
    () => { /* missing — keep solid color */ }
  );
}
```

- [ ] **Step 2: Update `main.js` to import from `three/textures.js`**

In `main.js`, replace this block:

```js
// === Texture cache ===
const textures = {};
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
```

with:

```js
import { textures, ensureEntry, loadTexture } from './three/textures.js';
```

(Move the import to the top of the file with the other imports.)

- [ ] **Step 3: Verify the build succeeds**

```bash
npm run build
```

Expected: success.

- [ ] **Step 4: Commit**

```bash
git add client/src/three/textures.js client/src/main.js
git commit -m "refactor: extract texture cache and loader into three/textures.js"
```

---

## Task 6: Extract planet construction into `client/src/three/planets.js`

Move `buildPlanet`, `addRingTo`, `remapRingUVs`, `applySphereTextureToPlanet`, `applyRingTextureToPlanet`. `buildPlanet` and the two `apply*` functions are exported; the two ring helpers stay private.

**Files:**
- Create: `client/src/three/planets.js`
- Modify: `client/src/main.js`

- [ ] **Step 1: Create `client/src/three/planets.js`**

```js
import * as THREE from 'three';
import { SECTIONS } from './config.js';
import { textures } from './textures.js';

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
  group.add(sphere);

  if (cfg.ring) addRingTo(group, cfg.ring, tex.ring);

  return group;
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

- [ ] **Step 2: Update `main.js` to import from `three/planets.js`**

In `main.js`, delete the entire block from `// === Planet construction ===` through the end of `applyRingTextureToPlanet`. At the top with the other imports, add:

```js
import {
  buildPlanet,
  applySphereTextureToPlanet,
  applyRingTextureToPlanet,
} from './three/planets.js';
```

- [ ] **Step 3: Verify the build succeeds**

```bash
npm run build
```

Expected: success.

- [ ] **Step 4: Commit**

```bash
git add client/src/three/planets.js client/src/main.js
git commit -m "refactor: extract planet construction into three/planets.js"
```

---

## Task 7: Extract starfield into `client/src/three/starfield.js`

**Files:**
- Create: `client/src/three/starfield.js`
- Modify: `client/src/main.js`

- [ ] **Step 1: Create `client/src/three/starfield.js`**

```js
import * as THREE from 'three';

export function createStarfield(starCount = 1200) {
  const starsGeometry = new THREE.BufferGeometry();
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    starPositions[i * 3 + 0] = (Math.random() - 0.5) * 100;
    starPositions[i * 3 + 1] = (Math.random() - 0.5) * 100;
    starPositions[i * 3 + 2] = (Math.random() - 0.5) * 100;
  }
  starsGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  return new THREE.Points(
    starsGeometry,
    new THREE.PointsMaterial({ color: 0xffffff, size: 0.04, sizeAttenuation: true })
  );
}
```

- [ ] **Step 2: Update `main.js`**

In `main.js`, delete the entire `// === Starfield ===` block (the `starsGeometry`/`starCount`/`starPositions` block plus the `const stars = new THREE.Points(...)` and `scene.add(stars);`).

Replace it with — placed right after the planets rail setup:

```js
import { createStarfield } from './three/starfield.js'; // add at top with other imports

// (later, where the old starfield block was)
const stars = createStarfield();
scene.add(stars);
```

- [ ] **Step 3: Verify the build succeeds**

```bash
npm run build
```

Expected: success.

- [ ] **Step 4: Commit**

```bash
git add client/src/three/starfield.js client/src/main.js
git commit -m "refactor: extract starfield into three/starfield.js"
```

---

## Task 8: Extract transition state machine into `client/src/three/transitions.js`

Move all transition state and logic. The module owns its mutable state and exposes `setSection(name)`, `updateTransition(dt)`, `setPlanetsRail(rail)`, and `getCurrentSectionName()`.

**Files:**
- Create: `client/src/three/transitions.js`
- Modify: `client/src/main.js`

- [ ] **Step 1: Create `client/src/three/transitions.js`**

```js
import * as THREE from 'three';
import {
  SECTIONS,
  SECTION_ORDER,
  PLANET_SPACING_Z,
  FAST_SCROLL_WINDOW_MS,
  FAST_SCROLL_SPEEDUP,
  ZOOM_OUT_DURATION,
  JUMP_OUT_DURATION,
  PAN_OUT_DURATION,
  PAN_IN_DURATION,
} from './config.js';

let planetsRail = null;
let currentSectionName = 'hero';

export const restingSpin = new THREE.Vector3(0, 0.3, 0);

let transitionState = 'idle'; // 'idle' | 'out' | 'in'
let transitionT = 0;
let pendingSection = null;
let lastSectionRequestAt = 0;
let isFastScroll = false;
const sectionQueue = [];

const outFrom = new THREE.Vector3();
const outTo = new THREE.Vector3();
let outDuration = PAN_OUT_DURATION;

export function setPlanetsRail(rail) {
  planetsRail = rail;
}

export function getCurrentSectionName() {
  return currentSectionName;
}

function configureTransition(fromName, toName) {
  pendingSection = toName;

  const fromIdx = SECTION_ORDER.indexOf(fromName);
  const toIdx = SECTION_ORDER.indexOf(toName);
  const goingBack = toIdx < fromIdx;
  const speed = isFastScroll ? FAST_SCROLL_SPEEDUP : 1;

  const toZ = toIdx * PLANET_SPACING_Z;
  const fromZ = planetsRail.position.z;

  outFrom.set(0, 0, fromZ);
  outTo.set(0, 0, toZ);
  outDuration = (goingBack ? ZOOM_OUT_DURATION : JUMP_OUT_DURATION) * speed;
}

function startNextTransition() {
  if (transitionState !== 'idle') return;
  if (sectionQueue.length === 0) return;

  const next = sectionQueue.shift();
  configureTransition(currentSectionName, next);
  transitionState = 'out';
  transitionT = 0;
}

export function setSection(name) {
  const cfg = SECTIONS[name];
  if (!cfg) return;
  if (name === currentSectionName && transitionState === 'idle' && sectionQueue.length === 0) return;

  const now = performance.now();
  isFastScroll = (now - lastSectionRequestAt) < FAST_SCROLL_WINDOW_MS;
  lastSectionRequestAt = now;

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

  startNextTransition();
}

export function updateTransition(dt) {
  if (transitionState !== 'out') return;
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
```

- [ ] **Step 2: Update `main.js`**

At the top of `main.js` with the other imports, add:

```js
import {
  setSection,
  setPlanetsRail,
  getCurrentSectionName,
  restingSpin,
  updateTransition,
} from './three/transitions.js';
```

In `main.js`, delete:
- The line `const restingSpin = new THREE.Vector3(0, 0.3, 0);`
- The block of transition state declarations (`let transitionState = 'idle';` through `let inDuration = PAN_IN_DURATION;`).
- The `configureTransition`, `startNextTransition`, and `setSection` function definitions.
- The variables `inFrom`, `inTo`, `inDuration` (they were unused after the simplification).

After the planets rail is created (after `scene.add(planetsRail);`), add:

```js
setPlanetsRail(planetsRail);
```

Also remove the `let currentSectionName = 'hero';` line — replaced by `getCurrentSectionName()`.

- [ ] **Step 3: Update `main.js` `animate()` loop to call the new helpers**

In the existing `animate()` function, replace:

```js
  const activePlanet = planetsBySection[currentSectionName];
```

with:

```js
  const activePlanet = planetsBySection[getCurrentSectionName()];
```

Replace the entire `if (transitionState === 'out') { ... }` block (about 15 lines) with:

```js
  updateTransition(dt);
```

- [ ] **Step 4: Verify the build succeeds**

```bash
npm run build
```

Expected: success.

- [ ] **Step 5: Commit**

```bash
git add client/src/three/transitions.js client/src/main.js
git commit -m "refactor: extract transition state machine into three/transitions.js"
```

---

## Task 9: Extract render loop into `client/src/three/loop.js`

Move the `animate` function and `clock` into a dedicated module.

**Files:**
- Create: `client/src/three/loop.js`
- Modify: `client/src/main.js`

- [ ] **Step 1: Create `client/src/three/loop.js`**

```js
import * as THREE from 'three';
import { scene, camera, renderer } from './scene.js';
import { getCurrentSectionName, restingSpin, updateTransition } from './transitions.js';

const clock = new THREE.Clock();

export function startRenderLoop({ planetsBySection, stars }) {
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
}
```

- [ ] **Step 2: Update `main.js`**

At the top with the other imports, add:

```js
import { startRenderLoop } from './three/loop.js';
```

In `main.js`, delete:
- The line `const clock = new THREE.Clock();`
- The entire `function animate() { ... }` block.
- The trailing `animate();` call.

Replace them with — at the bottom of `main.js`:

```js
startRenderLoop({ planetsBySection, stars });
```

You can also now delete the imports of `restingSpin`, `getCurrentSectionName`, and `updateTransition` from `main.js` (the loop module owns those interactions). Keep `setSection` and `setPlanetsRail` imported in `main.js`.

- [ ] **Step 3: Verify the build succeeds**

```bash
npm run build
```

Expected: success.

- [ ] **Step 4: Commit**

```bash
git add client/src/three/loop.js client/src/main.js
git commit -m "refactor: extract render loop into three/loop.js"
```

---

## Task 10: Extract scroll observer into `client/src/dom/sectionObserver.js`

Move the IntersectionObserver wiring and dot active-state toggling into a DOM-only module.

**Files:**
- Create: `client/src/dom/sectionObserver.js`
- Modify: `client/src/main.js`

- [ ] **Step 1: Create `client/src/dom/sectionObserver.js`**

```js
import { setSection } from '../three/transitions.js';

export function initSectionObserver() {
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
}
```

- [ ] **Step 2: Update `main.js`**

In `main.js`, delete the `// === Section observer ===` block (the four `const`/`forEach`/`new IntersectionObserver` lines through the final `sections.forEach((s) => observer.observe(s));`).

At the top with the other imports add:

```js
import { initSectionObserver } from './dom/sectionObserver.js';
```

Before `startRenderLoop(...)`, add:

```js
initSectionObserver();
```

You can also remove the `setSection` import from `main.js` since only the observer uses it now.

- [ ] **Step 3: Verify the build succeeds**

```bash
npm run build
```

Expected: success.

- [ ] **Step 4: Commit**

```bash
git add client/src/dom/sectionObserver.js client/src/main.js
git commit -m "refactor: extract section observer into dom/sectionObserver.js"
```

---

## Task 11: Slim `main.js` to a thin orchestrator

After Tasks 3–10, `main.js` should already be much smaller. This task verifies the final shape and cleans up any leftover unused imports or code.

**Files:**
- Modify: `client/src/main.js`

- [ ] **Step 1: Replace `client/src/main.js` with the final orchestrator version**

Overwrite `client/src/main.js` with exactly:

```js
import { scene, attachResizeHandler } from './three/scene.js';
import { SECTIONS, SECTION_ORDER, PLANET_SPACING_Z, AXIAL_TILT_RAD } from './three/config.js';
import { ensureEntry, loadTexture } from './three/textures.js';
import {
  buildPlanet,
  applySphereTextureToPlanet,
  applyRingTextureToPlanet,
} from './three/planets.js';
import { createStarfield } from './three/starfield.js';
import { setPlanetsRail } from './three/transitions.js';
import { initSectionObserver } from './dom/sectionObserver.js';
import { startRenderLoop } from './three/loop.js';
import * as THREE from 'three';

// Build the rail of planets (all planets exist at once, spaced along Z).
const planetsRail = new THREE.Group();
scene.add(planetsRail);

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

setPlanetsRail(planetsRail);
attachResizeHandler();
initSectionObserver();
startRenderLoop({ planetsBySection, stars });
```

- [ ] **Step 2: Verify the build succeeds**

```bash
npm run build
```

Expected: success.

- [ ] **Step 3: Commit**

```bash
git add client/src/main.js
git commit -m "refactor: slim main.js to thin orchestrator"
```

---

## Task 12: Extract section markup into `client/src/components/`

Create one component per section, returning the same HTML markup currently in `index.html`. Also create `Nav.js` for the dot navigation.

**Files:**
- Create: `client/src/components/Nav.js`
- Create: `client/src/components/Hero.js`
- Create: `client/src/components/About.js`
- Create: `client/src/components/Skills.js`
- Create: `client/src/components/Work.js`
- Create: `client/src/components/Contact.js`

- [ ] **Step 1: Create `client/src/components/Nav.js`**

```js
export const Nav = () => `
  <nav class="dots">
    <a href="#hero" data-target="hero"></a>
    <a href="#about" data-target="about"></a>
    <a href="#skills" data-target="skills"></a>
    <a href="#work" data-target="work"></a>
    <a href="#contact" data-target="contact"></a>
  </nav>
`;
```

- [ ] **Step 2: Create `client/src/components/Hero.js`**

```js
export const Hero = () => `
  <section id="hero" data-spin="hero">
    <p class="eyebrow">Portfolio</p>
    <h1>Your Name</h1>
    <p class="tagline">Developer · Designer · Builder</p>
  </section>
`;
```

- [ ] **Step 3: Create `client/src/components/About.js`**

```js
export const About = () => `
  <section id="about" data-spin="about">
    <h2>About</h2>
    <p>Short intro about you goes here. Talk about what you do, what you care about, and what you're building right now.</p>
  </section>
`;
```

- [ ] **Step 4: Create `client/src/components/Skills.js`**

```js
export const Skills = () => `
  <section id="skills" data-spin="skills">
    <h2>Skills</h2>
    <ul class="skills-grid">
      <li>JavaScript</li>
      <li>Three.js</li>
      <li>React</li>
      <li>Node.js</li>
      <li>Python</li>
      <li>UI / UX</li>
    </ul>
  </section>
`;
```

- [ ] **Step 5: Create `client/src/components/Work.js`**

```js
export const Work = () => `
  <section id="work" data-spin="work">
    <h2>Work</h2>
    <ul class="projects">
      <li><h3>Project One</h3><p>One-line description.</p></li>
      <li><h3>Project Two</h3><p>One-line description.</p></li>
      <li><h3>Project Three</h3><p>One-line description.</p></li>
    </ul>
  </section>
`;
```

- [ ] **Step 6: Create `client/src/components/Contact.js`**

```js
export const Contact = () => `
  <section id="contact" data-spin="contact">
    <h2>Contact</h2>
    <p><a href="mailto:you@example.com">you@example.com</a></p>
  </section>
`;
```

- [ ] **Step 7: Commit**

```bash
git add client/src/components/
git commit -m "feat: add component template functions for each section"
```

---

## Task 13: Slim `index.html` and mount components from `main.js`

Replace inline markup in `index.html` with mount points, and update `main.js` to inject component HTML at boot — running **before** `initSectionObserver()` so the observer finds the sections.

**Files:**
- Modify: `client/index.html`
- Modify: `client/src/main.js`

- [ ] **Step 1: Replace `client/index.html` with the slim shell**

Overwrite `client/index.html` with exactly:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Portfolio</title>
    <link rel="stylesheet" href="/src/style.css" />
  </head>
  <body>
    <canvas id="bg"></canvas>
    <div id="nav-mount"></div>
    <main id="app"></main>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

(The `<link>` to `style.css` is updated to point at `/src/styles/main.css` in Task 17. Leave it as `/src/style.css` for now.)

- [ ] **Step 2: Update `main.js` to mount components**

In `client/src/main.js`, add component imports at the top with the other imports:

```js
import { Nav } from './components/Nav.js';
import { Hero } from './components/Hero.js';
import { About } from './components/About.js';
import { Skills } from './components/Skills.js';
import { Work } from './components/Work.js';
import { Contact } from './components/Contact.js';
```

Add this block **before** the `// Build the rail of planets...` block (the components must be in the DOM before the section observer runs):

```js
document.querySelector('#nav-mount').innerHTML = Nav();
document.querySelector('#app').innerHTML = [
  Hero(),
  About(),
  Skills(),
  Work(),
  Contact(),
].join('');
```

Note: `initSectionObserver()` runs later in `main.js`, after the rail and starfield setup, so by the time it queries the DOM the sections already exist.

- [ ] **Step 3: Verify the build succeeds**

```bash
npm run build
```

Expected: success.

- [ ] **Step 4: Commit**

```bash
git add client/index.html client/src/main.js
git commit -m "refactor: slim index.html and mount components from main.js"
```

---

## Task 14: Add `partials/`, `utils/`, `pages/` placeholders

Create the empty-but-documented folders so future contributors know where things go. No JS code added yet — just `README.md` files explaining each folder's purpose.

**Files:**
- Create: `client/src/partials/README.md`
- Create: `client/src/utils/README.md`
- Create: `client/src/pages/README.md`

- [ ] **Step 1: Create `client/src/partials/README.md`**

```markdown
# Partials

Small reusable HTML atoms — buttons, cards, badges, icons. Each file
exports a function that takes props and returns an HTML string.

Use these inside `components/` (full sections) or any future page.

Example:

```js
// Button.js
export const Button = ({ href = '#', label, variant = 'primary' }) => `
  <a class="btn btn--${variant}" href="${href}">${label}</a>
`;
```

Style each partial in `client/src/styles/partials/<name>.css` and add an
`@import` line in `client/src/styles/main.css`.
```

- [ ] **Step 2: Create `client/src/utils/README.md`**

```markdown
# Utils

Generic helpers that don't belong to Three.js, the DOM layer, or any one
component. Math helpers, string formatters, small dom helpers, etc.

Empty by default — add files as needs appear, one per concern.
```

- [ ] **Step 3: Create `client/src/pages/README.md`**

```markdown
# Pages

Placeholder for future multi-page setup. Vite multi-page apps put HTML
files at the project root (`client/`); each HTML file gets its own JS
entry.

When adding a second page (e.g. blog, projects):

1. Create `client/<page>.html` with its own mount points.
2. Create a per-page entry like `client/src/pages/blog.js` that imports
   the components and styles it needs.
3. Reference the entry from the HTML file with
   `<script type="module" src="/src/pages/blog.js"></script>`.
4. Update `vite.config.js` `build.rollupOptions.input` if you want the
   build to produce both pages.
```

- [ ] **Step 4: Commit**

```bash
git add client/src/partials/README.md client/src/utils/README.md client/src/pages/README.md
git commit -m "docs: scaffold partials/, utils/, pages/ folders with READMEs"
```

---

## Task 15: Split `style.css` into `client/src/styles/`

Break the single `style.css` file into focused stylesheets aggregated by `main.css`. Update `index.html` to load `main.css`. Delete the old `style.css`.

**Files:**
- Create: `client/src/styles/main.css`
- Create: `client/src/styles/base.css`
- Create: `client/src/styles/layout.css`
- Create: `client/src/styles/nav.css`
- Create: `client/src/styles/components/hero.css`
- Create: `client/src/styles/components/skills.css`
- Create: `client/src/styles/components/projects.css`
- Create: `client/src/styles/components/contact.css`
- Modify: `client/index.html`
- Delete: `client/src/style.css`

- [ ] **Step 1: Create `client/src/styles/base.css`**

```css
:root {
  --bg: #0a0a0f;
  --fg: #f5f5f7;
  --muted: #9aa0a6;
  --accent: #7c8cff;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

html { background: var(--bg); }
body {
  color: var(--fg);
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  scroll-behavior: smooth;
  background: transparent;
}
```

- [ ] **Step 2: Create `client/src/styles/layout.css`**

```css
#bg {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  z-index: 0;
  display: block;
  pointer-events: none;
}

main, .dots { position: relative; z-index: 1; }

main {
  max-width: 880px;
  margin: 0 auto;
  padding: 0 2rem;
}

section {
  min-height: 180vh;
  padding: 10rem 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  opacity: 1;
  transform: translateY(0);
  transition: opacity 0.8s ease, transform 0.8s ease;
}

section.pending {
  opacity: 0;
  transform: translateY(24px);
}

h2 {
  font-size: 2rem;
  margin-bottom: 1.5rem;
  letter-spacing: -0.01em;
}
```

- [ ] **Step 3: Create `client/src/styles/nav.css`**

```css
.dots {
  position: fixed;
  right: 1.5rem;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  z-index: 10;
}
.dots a {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  transition: background 0.3s ease, transform 0.3s ease;
}
.dots a.active {
  background: var(--accent);
  transform: scale(1.4);
}
```

- [ ] **Step 4: Create `client/src/styles/components/hero.css`**

```css
#hero .eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-size: 0.8rem;
  color: var(--muted);
  margin-bottom: 1rem;
}

#hero h1 {
  font-size: clamp(2.5rem, 8vw, 5.5rem);
  line-height: 1.05;
  letter-spacing: -0.02em;
}

#hero .tagline {
  margin-top: 1rem;
  color: var(--muted);
  font-size: 1.1rem;
}
```

- [ ] **Step 5: Create `client/src/styles/components/skills.css`**

```css
#about p { color: var(--muted); max-width: 60ch; line-height: 1.6; }

.skills-grid {
  list-style: none;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 0.75rem;
}
.skills-grid li {
  padding: 1rem 1.25rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  text-align: center;
  color: var(--muted);
}
```

(About-only `p` rule lives here too since it's a single line; if About grows, split it into `about.css`.)

- [ ] **Step 6: Create `client/src/styles/components/projects.css`**

```css
.projects { list-style: none; display: grid; gap: 1.25rem; }
.projects li {
  padding: 1.5rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  backdrop-filter: blur(8px);
}
.projects h3 { margin-bottom: 0.5rem; }
.projects p { color: var(--muted); }
```

- [ ] **Step 7: Create `client/src/styles/components/contact.css`**

```css
#contact a {
  color: var(--accent);
  text-decoration: none;
  font-size: 1.25rem;
}
#contact a:hover { text-decoration: underline; }
```

- [ ] **Step 8: Create `client/src/styles/main.css`**

```css
@import "./base.css";
@import "./layout.css";
@import "./nav.css";
@import "./components/hero.css";
@import "./components/skills.css";
@import "./components/projects.css";
@import "./components/contact.css";
```

- [ ] **Step 9: Update `client/index.html` to load `styles/main.css`**

Change the `<link>` element from:

```html
<link rel="stylesheet" href="/src/style.css" />
```

to:

```html
<link rel="stylesheet" href="/src/styles/main.css" />
```

- [ ] **Step 10: Delete the old `client/src/style.css`**

```bash
git rm client/src/style.css
```

- [ ] **Step 11: Verify the build succeeds**

```bash
npm run build
```

Expected: success.

- [ ] **Step 12: Commit**

```bash
git add client/src/styles client/index.html
git commit -m "refactor: split style.css into styles/ folder"
```

---

## Task 16: Add `server/` placeholder

**Files:**
- Create: `server/README.md`

- [ ] **Step 1: Create `server/README.md`**

```markdown
# Server

Backend for the portfolio site. **Empty for now** — no backend code has
been added yet. This folder exists so the boundary between frontend and
backend is obvious from the repo root.

Reserved for things like:
- Contact form handler (e.g. accepting POST from `client/src/components/Contact.js`).
- Projects / blog API (CMS-driven content).
- Auth endpoints if any admin tooling is added.

When work begins:

1. Add a `server/package.json` with the chosen runtime (Node + Express,
   Fastify, etc.).
2. Add `server/src/` with the entry file (e.g. `index.js`).
3. Update root `package.json` to add scripts that delegate into
   `server/`, e.g. `"dev:server": "npm --prefix server run dev"` and a
   combined `"dev:all"` that runs both client and server in parallel.
```

- [ ] **Step 2: Commit**

```bash
git add server/README.md
git commit -m "docs: add server/ placeholder with intent README"
```

---

## Task 17: Update `CLAUDE.md` with project structure section

Add a short section pointing at the new layout and the design doc, so future Claude sessions immediately see the structure.

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Append a "Project structure" section to `CLAUDE.md`**

Append the following at the end of the existing `CLAUDE.md` (after the "Scroll smoothing (HTML/CSS)" section):

```markdown

## Project structure (added 2026-04-27)

The repo is split into `client/` (frontend) and `server/` (placeholder
for future backend). Inside `client/src/`:

- `main.js` — thin orchestrator: mounts components, builds rail, starts loop.
- `three/` — Three.js scene logic, split by responsibility:
  - `config.js` — `SECTIONS`, ordering, and timing constants.
  - `scene.js` — scene, camera, renderer, lights, resize handler.
  - `textures.js` — texture cache + loader.
  - `planets.js` — `buildPlanet`, ring helpers, texture appliers.
  - `starfield.js` — starfield generator.
  - `transitions.js` — rail-based transition state machine (`setSection`, `updateTransition`).
  - `loop.js` — render loop.
- `components/` — page sections as JS template functions returning HTML strings.
- `partials/` — small reusable HTML atoms (buttons, cards, badges).
- `dom/` — DOM-only behavior (no Three.js, no markup); currently `sectionObserver.js`.
- `styles/` — CSS split per concern; `main.css` aggregates the rest.
- `utils/`, `pages/` — placeholders documented in their READMEs.

Design doc: `docs/superpowers/specs/2026-04-27-portfolio-restructure-design.md`.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document new project structure in CLAUDE.md"
```

---

## Task 18: Final visual smoke test

This is the only task that requires the user's eyes. After all earlier tasks pass `npm run build`, the site should also render and behave identically in a real browser.

**Files:** none

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Expected: Vite reports a local URL (e.g. `http://localhost:5173`).

- [ ] **Step 2: Open the URL in a browser and verify**

Confirm each of the following:

- Page loads with no console errors.
- Hero section visible at top, with "Your Name" and tagline.
- Neptune planet (hero) visible in the background.
- Scrolling forward one section advances the planet (Earth → Mars → Jupiter → Saturn).
- Saturn's ring renders with the texture (not a flat color).
- Fast scrolling does not skip planets — the rail traverses each in order.
- Scrolling back advances the rail in reverse without skipping.
- Right-side dot navigation highlights the active section.

- [ ] **Step 3: Stop the dev server**

`Ctrl+C` in the terminal running `npm run dev`.

- [ ] **Step 4: (No commit — verification only)**

If anything looks wrong, the most likely causes are:
- Component mount order (sections must be in the DOM before `initSectionObserver()` runs).
- A missing `@import` line in `styles/main.css`.
- A missed import or stray identifier left in `main.js`.
