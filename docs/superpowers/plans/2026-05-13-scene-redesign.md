# Scene Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Push the sun far + offset (fixes the contact-section glare), add 3 missing planets (Mercury, Venus, Uranus) so all 8 appear in real solar-system order, replace the straight Z sweep with a quadratic Bezier camera arc, and have the camera look at the active section's planet instead of the sun.

**Architecture:** All changes are isolated to `client/src/three/` and `client/src/main.js`. No section HTML, no CSS, no DOM behavior changes — `components/*.js`, `dom/*.js`, `styles/**/*.css` stay byte-identical. Each task is independently committable and visually testable; the scene never breaks between commits.

**Tech Stack:** Three.js, Vite, vanilla JS. No new dependencies. Mercury's missing texture is generated procedurally on the canvas (~30 lines) — drop in a real `mercury.jpg` later if you want.

**Spec:** `docs/superpowers/specs/2026-05-13-scene-redesign-design.md`

**Notes for the executor:**
- **No automated tests in this repo.** Verification = manual browser check via `npm --prefix client run dev`. Matches contact-form / projects-showcase precedent.
- **User handles commits.** Each task ends in a "Pause for user commit" step with a suggested message and the exact files to stage. Do **NOT** run `git add` or `git commit`.
- **Coordinate scale.** Section planet positions in `config.js` are written as `<test.tsx_value> / 14` for historical reasons (the test.tsx prototype this was originally scaled from). Background planets and Bezier control points use plain decimal values in the same world scale — both styles coexist and Three.js doesn't care.

---

## File structure (reference)

**Modified:**
- `client/src/three/config.js` — Tasks 1, 2, 4, 5
- `client/src/three/loop.js` — Tasks 1, 5, 6
- `client/src/three/textures.js` — Task 3
- `client/src/three/planets.js` — Task 4 (small signature refactor)
- `client/src/three/scene.js` — Task 5
- `client/src/main.js` — Tasks 4, 6
- `CLAUDE.md` — Task 7

**Created:** none. **Deleted:** none.

---

## Task 1: Push the sun far + cap glow opacity

**Files:**
- Modify: `client/src/three/config.js`
- Modify: `client/src/three/loop.js`

Smallest possible change that solves the original contact-section pain. After this commit, the sun is far + upper-right + dim. Section planets and camera math are unchanged.

- [ ] **Step 1: Update sun constants in `config.js`**

Replace the sun block:

```js
// Sun
export const SUN_POSITION = new THREE.Vector3(0, 0, -650 / 14);
export const SUN_RADIUS = 90 / 14;
export const SUN_GLOW_SCALE = 520 / 14;
export const SUN_CORONA_SCALE = 820 / 14;
export const SUN_TEXTURE_PATH = '/assets/planets/sun.jpg';
```

With:

```js
// Sun — far + upper-right offset so the contact section isn't blown out
export const SUN_POSITION = new THREE.Vector3(420 / 14, 260 / 14, -1600 / 14);
export const SUN_RADIUS = 170 / 14;
export const SUN_GLOW_SCALE = 1300 / 14;
export const SUN_CORONA_SCALE = 2200 / 14;
export const SUN_TEXTURE_PATH = '/assets/planets/sun.jpg';
```

- [ ] **Step 2: Cap glow opacity ramp in `loop.js`**

Find this line:

```js
sun.glowMat.opacity = 0.85 + Math.max(0, Math.min(1, t)) * 0.15;
```

Replace with:

```js
sun.glowMat.opacity = 0.55 + Math.max(0, Math.min(1, t)) * 0.15;
```

This shifts the ramp from `0.85 → 1.0` to `0.55 → 0.70`. The PointLight intensity is unchanged — the additive sprite glow was the bleaching factor.

- [ ] **Step 3: Verify in browser**

Run:
```
npm --prefix client run dev
```

Open `http://localhost:5173/`. Expected:
- Hero looks almost identical to before, but the sun has shifted from dead-center-back to upper-right of the frame.
- Scroll to the contact section. The sun is visible but much smaller and dimmer. The form text and inputs remain readable.

Stop the dev server (Ctrl+C).

- [ ] **Step 4: Pause for user commit**

Suggested message:
```
feat: push sun far + cap glow to fix contact section glare
```

Files to stage: `client/src/three/config.js`, `client/src/three/loop.js`.

---

## Task 2: Rebind section planets to real solar order

**Files:**
- Modify: `client/src/three/config.js`

XY offset, Z position, and content layout side stay tied to the section. Texture, halo color, emissive, base color, radius, rotSpeed, and ring (if any) **move with the planet identity**. Saturn's ring moves from contact (where Saturn was) to about (where Saturn is now).

- [ ] **Step 1: Replace the entire `SECTIONS` block in `config.js`**

Replace the existing `export const SECTIONS = { ... };` (currently lines 3–58) with:

```js
export const SECTIONS = {
  hero: {
    // Neptune (unchanged — already outermost)
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
    // Saturn (was Earth) — ring moved here
    radius: 1.5, color: 0xe8d4a3, emissive: 0x3a2a10, emissiveIntensity: 0.25,
    roughness: 0.85, metalness: 0.05,
    offset: { x: 78 / 14, y: -22 / 14 },
    z: 60 / 14,
    rotSpeed: 0.007,
    haloColor: 0xe2b76c,
    haloOpacity: 0.45,
    ring: {
      inner: 1.9, outer: 2.8, color: 0xc9b48a, opacity: 0.75, tilt: 0.45,
      texturePath: '/assets/planets/saturn_ring.png',
    },
    texturePath: '/assets/planets/saturn.jpg',
  },
  skills: {
    // Jupiter (was Mars)
    radius: 1.85, color: 0xd1a36b, emissive: 0x3a2a10, emissiveIntensity: 0.25,
    roughness: 0.85, metalness: 0.05,
    offset: { x: -95 / 14, y: 28 / 14 },
    z: -90 / 14,
    rotSpeed: 0.006,
    haloColor: 0xe2b76c,
    haloOpacity: 0.45,
    texturePath: '/assets/planets/jupiter.jpg',
  },
  work: {
    // Mars (was Jupiter)
    radius: 1.4, color: 0xc1440e, emissive: 0x3a0a06, emissiveIntensity: 0.25,
    roughness: 0.85, metalness: 0.05,
    offset: { x: 62 / 14, y: 24 / 14 },
    z: -230 / 14,
    rotSpeed: 0.004,
    haloColor: 0xff5a3d,
    haloOpacity: 0.45,
    texturePath: '/assets/planets/mars.jpg',
  },
  contact: {
    // Earth (was Saturn) — no ring anymore
    radius: 1.5, color: 0x3a7bd5, emissive: 0x07254a, emissiveIntensity: 0.25,
    roughness: 0.85, metalness: 0.05,
    offset: { x: -55 / 14, y: -32 / 14 },
    z: -370 / 14,
    rotSpeed: 0.003,
    haloColor: 0x4ddc92,
    haloOpacity: 0.45,
    texturePath: '/assets/planets/earth.jpg',
  },
};
```

Note: `SECTION_ORDER` below this block is unchanged.

- [ ] **Step 2: Verify in browser**

Run `npm --prefix client run dev`. Open `http://localhost:5173/`. Scroll through every section:

- **Hero** — Neptune (deep blue, no change).
- **About** — Saturn with its ring tilted (was Earth's blue marble before).
- **Skills** — Jupiter (tan/orange gas giant; was Mars's red disc).
- **Work** — Mars (small red planet; was Jupiter's large tan disc).
- **Contact** — Earth (blue marble; was Saturn).

The XY positions of each planet on screen should look identical to before (since `offset` stays tied to section). Only the planet identity changes.

Stop the dev server.

- [ ] **Step 3: Pause for user commit**

Suggested message:
```
feat: rebind sections to real solar-system order
```

Files to stage: `client/src/three/config.js`.

---

## Task 3: Procedural Mercury texture helper

**Files:**
- Modify: `client/src/three/textures.js`

A canvas-generated greyish-rocky texture, used when no `mercury.jpg` exists. Just adds the function — no visual change in this task. Task 4 wires it in.

- [ ] **Step 1: Append the Mercury texture helper to `textures.js`**

Add to the end of `client/src/three/textures.js`:

```js
let cachedMercuryTexture = null;

export function getMercuryTexture() {
  if (cachedMercuryTexture) return cachedMercuryTexture;

  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d');

  // Base grey
  ctx.fillStyle = '#8a8580';
  ctx.fillRect(0, 0, 512, 256);

  // Crater-like darker blobs
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 256;
    const r = 6 + Math.random() * 30;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, '#5a5550');
    grad.addColorStop(1, 'transparent');
    ctx.globalAlpha = 0.2 + Math.random() * 0.4;
    ctx.beginPath();
    ctx.fillStyle = grad;
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  cachedMercuryTexture = tex;
  return tex;
}
```

- [ ] **Step 2: Verify build still passes**

Run:
```
npm --prefix client run build
```

Expected: build succeeds, no syntax errors. No visual change yet.

- [ ] **Step 3: Pause for user commit**

Suggested message:
```
feat: add procedural mercury texture helper
```

Files to stage: `client/src/three/textures.js`.

---

## Task 4: Background planets (Uranus, Venus, Mercury)

**Files:**
- Modify: `client/src/three/config.js`
- Modify: `client/src/three/planets.js`
- Modify: `client/src/main.js`

Three new planets that float in the scene but aren't section anchors. Tiny refactor to `buildPlanet` so it can accept config directly (instead of looking it up by section name). They rotate but aren't lookAt targets.

- [ ] **Step 1: Add `BACKGROUND_PLANETS` to `config.js`**

Append to the end of `client/src/three/config.js`:

```js
// Background planets — not tied to any section. Rotate and drift through
// peripheral view. Mercury uses a procedural texture (no mercury.jpg yet).
export const BACKGROUND_PLANETS = [
  {
    // Uranus — between Neptune (hero, z=12.86) and Saturn (about, z=4.29)
    key: 'uranus',
    radius: 1.2,
    color: 0x9fd8e8, emissive: 0x1a4858, emissiveIntensity: 0.25,
    roughness: 0.85, metalness: 0.05,
    offset: { x: -3, y: 1 },
    z: 8.5,
    rotSpeed: 0.004,
    haloColor: 0x9fd8e8,
    haloOpacity: 0.4,
    texturePath: '/assets/planets/uranus.jpg',
    procedural: false,
  },
  {
    // Venus — between Earth (contact, z=-26.43) and the sun. Filename has the
    // existing typo "athmosphere" preserved.
    key: 'venus',
    radius: 1.0,
    color: 0xd8b67a, emissive: 0x3a2a10, emissiveIntensity: 0.25,
    roughness: 0.85, metalness: 0.05,
    offset: { x: 2, y: -1 },
    z: -32,
    rotSpeed: 0.005,
    haloColor: 0xd8b67a,
    haloOpacity: 0.4,
    texturePath: '/assets/planets/venus_athmosphere.jpg',
    procedural: false,
  },
  {
    // Mercury — closest to the sun. Procedural texture.
    key: 'mercury',
    radius: 0.7,
    color: 0x8a8580, emissive: 0x2a2520, emissiveIntensity: 0.2,
    roughness: 0.95, metalness: 0.02,
    offset: { x: -1.5, y: 1.5 },
    z: -38,
    rotSpeed: 0.006,
    haloColor: 0x999999,
    haloOpacity: 0.3,
    texturePath: null,
    procedural: true,
  },
];
```

- [ ] **Step 2: Refactor `buildPlanet` in `planets.js` to accept config directly**

The current `buildPlanet(name)` does `const cfg = SECTIONS[name]` and `const tex = textures[name] || {}`. Section planets and background planets need the same construction logic but differ in lookup. Change the signature so callers pass cfg + tex.

Replace the entire function:

```js
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
```

With:

```js
export function buildPlanet(cfg, tex = {}, name = 'planet') {
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
```

Note: the imports for `SECTIONS` and `textures` at the top of `planets.js` are no longer used directly by `buildPlanet` — but they're still imported. Leave them. (`textures` may still be referenced by `applySphereTextureToPlanet` consumers.) Actually re-check the imports:

Look at the top of `planets.js`. The current imports are:
```js
import * as THREE from 'three';
import { SECTIONS } from './config.js';
import { textures } from './textures.js';
import { getSharedGlowTexture } from './sun.js';
```

Remove the two now-unused imports — change to:

```js
import * as THREE from 'three';
import { getSharedGlowTexture } from './sun.js';
```

(`SECTIONS` and `textures` are no longer referenced inside this file after the refactor.)

- [ ] **Step 3: Update the section-planet build call site in `main.js`**

Find the section planet build (currently around lines 63–69 in `main.js`):

```js
const planets = SECTION_ORDER.map((name) => {
  const { group, mesh } = buildPlanet(name);
  const cfg = SECTIONS[name];
  group.position.set(cfg.offset.x, cfg.offset.y, cfg.z);
  scene.add(group);
  return { name, group, mesh, rotSpeed: cfg.rotSpeed };
});
```

Replace with:

```js
import { textures } from './three/textures.js';  // add near other ./three/ imports if not already there

const planets = SECTION_ORDER.map((name) => {
  const cfg = SECTIONS[name];
  const { group, mesh } = buildPlanet(cfg, textures[name] || {}, name);
  group.position.set(cfg.offset.x, cfg.offset.y, cfg.z);
  scene.add(group);
  return { name, group, mesh, rotSpeed: cfg.rotSpeed };
});
```

If `textures` is already imported alongside `ensureEntry, loadTexture` at the top, just add it to the existing import line. Otherwise add a new import.

- [ ] **Step 4: Build the background planets in `main.js`**

Just below the section planet build (after the closing `});` of `const planets = SECTION_ORDER.map(...)`), add:

```js
import { BACKGROUND_PLANETS } from './three/config.js';
import { getMercuryTexture } from './three/textures.js';

const backgroundPlanets = BACKGROUND_PLANETS.map((bg) => {
  const initialTex = { sphere: bg.procedural ? getMercuryTexture() : null };
  const { group, mesh } = buildPlanet(bg, initialTex, bg.key);
  group.position.set(bg.offset.x, bg.offset.y, bg.z);
  scene.add(group);

  if (!bg.procedural && bg.texturePath) {
    loadTexture(bg.texturePath, (tex) => {
      applySphereTextureToPlanet(group, bg, tex);
    });
  }

  return { name: bg.key, group, mesh, rotSpeed: bg.rotSpeed };
});
```

Add `BACKGROUND_PLANETS` to the existing `./three/config.js` import. Add `getMercuryTexture` to the existing `./three/textures.js` import.

- [ ] **Step 5: Pass background planets to the render loop so they rotate**

Find the render loop kickoff at the bottom of `main.js`:

```js
startRenderLoop({ scene, camera, renderer, planets, sun, stars, dust });
```

Replace with:

```js
startRenderLoop({
  scene, camera, renderer, sun, stars, dust,
  planets: [...planets, ...backgroundPlanets],
});
```

(`startRenderLoop` already iterates `planets.forEach((p) => { p.mesh.rotation.y += p.rotSpeed; })` — merging the two arrays is enough to make background planets rotate.)

- [ ] **Step 6: Verify in browser**

Run `npm --prefix client run dev`. Open `http://localhost:5173/`.

Expected:
- **Hero** — Neptune visible. Uranus drifts faintly to its lower-left (smaller, lighter blue).
- **About → Skills** — Uranus has passed; Saturn (about) and Jupiter (skills) appear in turn.
- **Contact** — Earth front-and-center. Venus (warm yellow) appears further back to the right, Mercury (smaller, grey) further still to the left, both near the dim sun in the upper-right.
- All planets visibly rotate.

If Mercury looks too flat (procedural grey is intentionally simple), that's fine — Task 7's roadmap notes a real `mercury.jpg` swap is deferred.

Stop the dev server.

- [ ] **Step 7: Pause for user commit**

Suggested message:
```
feat: add Uranus, Venus, Mercury as background planets
```

Files to stage: `client/src/three/config.js`, `client/src/three/planets.js`, `client/src/main.js`.

---

## Task 5: Bezier camera position

**Files:**
- Modify: `client/src/three/config.js`
- Modify: `client/src/three/scene.js`
- Modify: `client/src/three/loop.js`

Replace the straight Z lerp with a quadratic Bezier curve. The camera swings left + slightly up by t=0.5, then returns toward center as it approaches the sun zone. `lookAt` still points at the sun for now — Task 6 changes that.

- [ ] **Step 1: Replace the camera scalar constants with Vector3 control points in `config.js`**

Find:

```js
// Camera sweep
export const CAMERA_START_Z = 350 / 14;
export const CAMERA_END_Z = -540 / 14;
```

Replace with:

```js
// Camera Bezier control points. Quadratic curve: P(t) = (1-t)²P0 + 2(1-t)tP1 + t²P2.
// Swings left + up at midpoint, returns toward center near the sun zone.
export const CAMERA_BEZIER_P0 = new THREE.Vector3(0, 0, 25);
export const CAMERA_BEZIER_P1 = new THREE.Vector3(-21, 6, -17);
export const CAMERA_BEZIER_P2 = new THREE.Vector3(0, 0, -58.6);
```

- [ ] **Step 2: Update `scene.js` initial camera position**

Find:

```js
import { CAMERA_START_Z, SUN_POSITION } from './config.js';
```

Replace with:

```js
import { CAMERA_BEZIER_P0, SUN_POSITION } from './config.js';
```

And find:

```js
camera.position.set(0, 0, CAMERA_START_Z);
```

Replace with:

```js
camera.position.copy(CAMERA_BEZIER_P0);
```

- [ ] **Step 3: Replace the straight Z lerp with the Bezier formula in `loop.js`**

Find the imports at the top of `loop.js`:

```js
import { CAMERA_START_Z, CAMERA_END_Z, SUN_GLOW_SCALE, SUN_CORONA_SCALE } from './config.js';
```

Replace with:

```js
import {
  CAMERA_BEZIER_P0, CAMERA_BEZIER_P1, CAMERA_BEZIER_P2,
  SUN_GLOW_SCALE, SUN_CORONA_SCALE,
} from './config.js';
```

Find the camera-position lines inside `animate()`:

```js
const t = getSmoothedScroll();
camera.position.z = CAMERA_START_Z + (CAMERA_END_Z - CAMERA_START_Z) * t;

const time = Date.now() * 0.0001;
camera.position.x = Math.sin(time) * 0.4;
camera.position.y = Math.cos(time * 0.7) * 0.3;
```

Replace with:

```js
const t = getSmoothedScroll();
const mt = 1 - t;
const p0 = CAMERA_BEZIER_P0;
const p1 = CAMERA_BEZIER_P1;
const p2 = CAMERA_BEZIER_P2;
camera.position.x = mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x;
camera.position.y = mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y;
camera.position.z = mt * mt * p0.z + 2 * mt * t * p1.z + t * t * p2.z;

// Hand-held organic float on top of the Bezier position
const time = Date.now() * 0.0001;
camera.position.x += Math.sin(time) * 0.4;
camera.position.y += Math.cos(time * 0.7) * 0.3;
```

Leave `camera.lookAt(0, 0, sun.group.position.z);` alone — Task 6 replaces it.

- [ ] **Step 4: Verify in browser**

Run `npm --prefix client run dev`. Open `http://localhost:5173/`.

Expected:
- Hero starts at the same view as before (camera at `(0, 0, 25)`).
- Scrolling causes the camera to swing left and slightly up, peaking around the skills section (mid-scroll).
- Camera returns toward x=0 near the contact section.
- Planet screen-positions visibly shift as the camera arcs — they pass at different lateral angles.

If the camera swings too aggressively for your taste, you can tune `CAMERA_BEZIER_P1` later (e.g., `(-15, 4, -17)` for a gentler arc).

Stop the dev server.

- [ ] **Step 5: Pause for user commit**

Suggested message:
```
feat: replace straight Z sweep with Bezier camera arc
```

Files to stage: `client/src/three/config.js`, `client/src/three/scene.js`, `client/src/three/loop.js`.

---

## Task 6: Section-planet lookAt with easing

**Files:**
- Modify: `client/src/main.js`
- Modify: `client/src/three/loop.js`

Instead of pointing at the sun, the camera looks at the active section's planet. As scroll moves between sections, the lookAt target lerps from one planet to the next using a smoothstep `easeInOut` so it doesn't track linearly through dead space.

- [ ] **Step 1: Extract section-planet positions in `main.js` and pass to the render loop**

After `const planets = SECTION_ORDER.map(...)` is built but before `startRenderLoop` is called, add:

```js
const sectionPlanetPositions = SECTION_ORDER.map((name) => {
  const planet = planets.find((p) => p.name === name);
  return planet.group.position.clone();
});
```

Update the `startRenderLoop` call to pass the new array:

```js
startRenderLoop({
  scene, camera, renderer, sun, stars, dust,
  planets: [...planets, ...backgroundPlanets],
  sectionPlanetPositions,
});
```

- [ ] **Step 2: Replace `camera.lookAt(0, 0, sun.z)` with section-planet interpolation in `loop.js`**

At the very top of `loop.js`, add a Three.js import (if not already present) and reusable vectors:

```js
import * as THREE from 'three';
```

(Below the existing imports.)

Just below the `import` block but above `export function startRenderLoop`, add:

```js
const lookAtTarget = new THREE.Vector3();
const fromVec = new THREE.Vector3();
const toVec = new THREE.Vector3();

function easeInOut(x) {
  // Smoothstep — soft start and end, linear middle.
  return x * x * (3 - 2 * x);
}
```

Update the function signature:

```js
export function startRenderLoop({ scene, camera, renderer, planets, sun, stars, dust, sectionPlanetPositions }) {
```

Just inside the function body (before `function animate()`), add:

```js
const segmentCount = sectionPlanetPositions.length - 1;
```

Replace this single line inside `animate()`:

```js
camera.lookAt(0, 0, sun.group.position.z);
```

With:

```js
const clamped = Math.max(0, Math.min(1, t));
const scaled = clamped * segmentCount;
const segIdx = Math.min(Math.floor(scaled), segmentCount - 1);
const segT = scaled - segIdx;
fromVec.copy(sectionPlanetPositions[segIdx]);
toVec.copy(sectionPlanetPositions[segIdx + 1]);
lookAtTarget.copy(fromVec).lerp(toVec, easeInOut(segT));
camera.lookAt(lookAtTarget);
```

(Reuses `t` from the existing line `const t = getSmoothedScroll();` earlier in `animate()`.)

- [ ] **Step 3: Verify in browser**

Run `npm --prefix client run dev`. Open `http://localhost:5173/`.

Expected:
- **Hero** — Neptune is centered in the camera view (lookAt target = Neptune).
- **About** — Saturn (with ring) centers as you scroll.
- **Skills** — Jupiter centers; the camera has visibly turned to track it.
- **Work** — Mars centers.
- **Contact** — Earth centers; the sun stays in the upper-right (no longer behind the camera direction).
- During mid-scroll between sections, the camera "eases" between planet targets rather than tracking linearly — there's a soft settle on each planet before moving to the next.

Stop the dev server.

- [ ] **Step 4: Pause for user commit**

Suggested message:
```
feat: camera looks at active section's planet with easing
```

Files to stage: `client/src/main.js`, `client/src/three/loop.js`.

---

## Task 7: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

Bring the "Current scene" section in sync with the redesigned scene model. Mark the scene redesign as shipped.

- [ ] **Step 1: Replace the entire "Current scene" section in `CLAUDE.md`**

Find the section starting with `## Current scene (as of 2026-04-28)` (around line 12) through the line just before `---` at the end of that section (around line 65).

Replace the whole block — including the `## Current scene` header line — with:

```markdown
## Current scene (as of 2026-05-13)

**Scroll-driven Bezier camera flight through a real-solar-system layout
toward a far, offset sun.**

### Planets
- All 8 real planets in real outer-to-inner order. 5 are section-anchored,
  3 float in the background as scenery.
- Section-anchored (one per section): hero=Neptune, about=Saturn (with ring),
  skills=Jupiter, work=Mars, contact=Earth. The XY/Z position of each
  section is tied to the section (preserved from the 2026-04-28 layout);
  the planet identity (texture, halo color, ring) was reassigned to fit
  real solar order.
- Background (no section binding): Uranus (between hero and about), Venus
  (between contact and sun), Mercury (closest to sun, procedural texture).
- Each planet has a colored atmosphere halo (additive sprite using a
  shared canvas-generated radial-gradient texture from `sun.js`).
- Background-planet array lives in `client/src/three/config.js` as
  `BACKGROUND_PLANETS`; built alongside the section planets in `main.js`
  via the same `buildPlanet` helper.

### Sun
- Far + upper-right: position `(30, 18.6, -114.3)` (was `(0, 0, -46.4)`).
- Larger radius (~12 vs ~6.4) and bigger glow / corona sprites — same
  apparent size but with greater depth.
- Glow opacity ramp capped at 0.55 → 0.70 (was 0.85 → 1.0) so the contact
  section isn't bleached out.
- Single `THREE.PointLight` at the sun's position is still the scene's
  only directional light.

### Backdrop
- 3500-point procedural starfield (unchanged).
- 600-point nebula dust (unchanged).
- `stars_milkyway.jpg` skybox sphere at radius 200, `BackSide`,
  opacity 0.45 (unchanged).

### Camera
- **Path:** quadratic Bezier P0=`(0,0,25)`, P1=`(-21,6,-17)`, P2=`(0,0,-58.6)`,
  parametrised by smoothed scroll progress `t ∈ [0,1]`.
- **Look-at:** the active section's planet, interpolated with smoothstep
  easing as scroll moves between sections (was: always sun's Z).
- Hand-held float (`sin(time)*0.4`, `cos(time*0.7)*0.3`) layered on top of
  the Bezier position for an organic feel.

### HTML / sections
- Unchanged from 2026-04-28. Five sections, same content layout modifiers
  (`.section--centered` / `.section--left` / `.section--right`), same
  dot navigation. Only the planet you see at each section changed.

Design doc for the redesign: `docs/superpowers/specs/2026-05-13-scene-redesign-design.md`.
Plan: `docs/superpowers/plans/2026-05-13-scene-redesign.md`.
Previous (rail-jump → continuous-sweep) doc: `docs/superpowers/specs/2026-04-28-scene-redesign-design.md`.
```

- [ ] **Step 2: Update the "Recently shipped" section**

Find the "## Recently shipped" header. Prepend (above the projects-showcase bullet) a new entry:

```markdown
- **Scene redesign** (2026-05-13) — Pushed the sun far + upper-right
  (fixed contact-section glare), added Mercury / Venus / Uranus so all 8
  real planets appear in real outer-to-inner order, replaced the straight
  Z sweep with a quadratic Bezier camera arc, and switched lookAt from
  the sun to the active section's planet with smoothstep easing between
  sections. Mercury uses a procedural canvas texture (~30 lines in
  `textures.js`); swap a real `mercury.jpg` in any time. Spec:
  `docs/superpowers/specs/2026-05-13-scene-redesign-design.md`. Plan:
  `docs/superpowers/plans/2026-05-13-scene-redesign.md`.
```

- [ ] **Step 3: Update "Currently building"**

Find the "## Currently building" section. The current text mentions the scene redesign as the next-up scope. Replace its body with:

```markdown
*Nothing in progress.* Next up per the "Highlight picks" — the **AI chat
widget** powered by the Anthropic API. Spec / plan to be written when
work begins.
```

- [ ] **Step 4: Verify**

Run `git diff CLAUDE.md` and confirm changes are limited to the three sections above (Current scene, Recently shipped, Currently building). No other content drift.

- [ ] **Step 5: Pause for user commit**

Suggested message:
```
docs: mark scene redesign as shipped in CLAUDE.md
```

Files to stage: `CLAUDE.md`.

---

## Notes / known limitations

- **No automated tests.** Manual browser verification only.
- **Background-planet positions are tuned by eye.** Exact `offset` / `z` values can be adjusted post-build without changing the spec; the values in Task 4 are reasonable defaults.
- **Mercury procedural texture is intentionally simple.** Drop a real `mercury.jpg` into `client/public/assets/planets/` and update `BACKGROUND_PLANETS[2].texturePath` + flip `procedural` to `false` to swap.
- **Bezier P1 is tunable.** If the camera swing feels too aggressive, reducing `CAMERA_BEZIER_P1.x` from `-21` toward `-15` softens the arc.
- **EaseInOut is smoothstep `t*t*(3-2t)`.** Could swap for `easeInOutCubic` or a custom curve if the settle-on-planet feel needs more weight; spec leaves this as deferred / future polish.
