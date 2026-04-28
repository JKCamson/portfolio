# Three.js Scene Redesign — Design

**Date:** 2026-04-28
**Status:** Approved
**Owner:** John Kyle Camson

## Goal

Replace the current discrete rail-jump scene with a **continuous scroll-driven camera sweep through scattered planets toward a distant sun**, modelled on the animation behaviors in `test.tsx`. Keep all five existing real-textured planets (Neptune / Earth / Mars / Jupiter / Saturn), keep the existing HTML / sections / dot navigation, keep the file architecture established in the 2026-04-27 restructure.

## Non-Goals

- No framework change (still vanilla JS + Three.js + Vite).
- No new sections or copy changes — `components/*.js` markup stays exactly as-is.
- No procedural canvas textures for the planets — `test.tsx` generates them on the fly, but we already have real `.jpg` textures and they look better.
- No backend / server work in this iteration.

## Reference

`test.tsx` at the repo root contains the React + Three.js prototype this design ports to vanilla. The animation behaviors (camera sweep, smoothed scroll, sun pulse, stars, dust, halos) are taken directly from there.

## High-level changes

### Animation model

| | Before | After |
|---|---|---|
| Camera | Static at `(0,0,6)`. Planets-rail moves along Z to swap planet under camera. | Camera sweeps Z from `+350` → `-540` based on scroll progress; floats on sin/cos; looks at sun. |
| Planets | All five on a straight Z-rail at `i * PLANET_SPACING_Z`. | Five planets at fixed scattered `(x, y, z)` offsets in world space. |
| Transitions | Discrete rail jumps triggered by IntersectionObserver. | None. Camera position is a continuous function of scroll progress. |
| Sun | Did not exist. | Centered backdrop at `(0, 0, -650)`, glow sprite + corona sprite, pulses on `sin(time)`. |
| Lights | Ambient + directional sun + point fill. | Single point light at sun position + dim ambient. |
| Stars | 1200 cube-distributed white points. | 3500 sphere-shell distributed points with vertex colors. |
| Dust | Did not exist. | 600 warm/cool additive points, counter-rotates. |
| Per-planet halo | Did not exist. | Atmosphere-color glow sprite around each planet. |
| Saturn ring | Real `saturn_ring.png` texture. | Same — ring keeps the existing texture. |
| Fog | `Fog(linear, 12, 28)`. | `FogExp2(0x05020a, 0.0008)` (matches test.tsx). |

### HTML / DOM

- **Unchanged:** `index.html` shell, all components, dot nav HTML.
- **Behavior change:** dot nav links (`<a href="#hero">` etc.) become plain scroll-anchors. The IntersectionObserver only updates the active dot now — it no longer triggers any Three.js transition.

### Section → planet mapping

Existing assignments preserved. Positions taken from `test.tsx`'s `PLANETS` array (in mapping order):

| Section | Planet | Texture | x | y | z | rotSpeed | Has ring |
|---|---|---|---|---|---|---|---|
| hero | Neptune | `neptune.jpg` | -65 | 12 | 180 | 0.005 | no |
| about | Earth | `earth.jpg` | 78 | -22 | 60 | 0.003 | no |
| skills | Mars | `mars.jpg` | -95 | 28 | -90 | 0.004 | no |
| work | Jupiter | `jupiter.jpg` | 62 | 24 | -230 | 0.006 | no |
| contact | Saturn | `saturn.jpg` + `saturn_ring.png` | -55 | -32 | -370 | 0.007 | yes |

**Planet sizes** stay at the existing radii from `config.js` (1.4–1.85). They are dwarfed by `test.tsx`'s scale (16–30 units) because that prototype uses a much larger world. We scale the sun and camera Z range to match our planet scale instead — the **ratios** from test.tsx are what matter, not the absolute numbers.

### Scaled-down constants for our world

`test.tsx` uses planet sizes of 16–30 units, sun radius 90, camera Z range `[350, -540]`, sun at z = -650, glow scale 520, corona 820. Our planets are at radius ~1.5. Scale factor ≈ `1.5 / 22 ≈ 0.07`. We round to a clean 1/14 (≈0.071) for math sanity:

| test.tsx | scaled | our value |
|---|---|---|
| Sun radius 90 | / 14 | ~6.5 |
| Sun z = -650 | / 14 | -46.5 |
| Glow scale 520 | / 14 | ~37 |
| Corona scale 820 | / 14 | ~58 |
| Camera startZ 350 | / 14 | 25 |
| Camera endZ -540 | / 14 | -39 |
| Planet x/y offsets ±60–95 | / 14 | ±4–7 |
| Planet z 180 → -370 | / 14 | 13 → -26 |

These scaled numbers go into `config.js`. `test.tsx`'s `0.07` smoothed-scroll lerp factor and timing (`Date.now() * 0.0001` for camera float, `* 0.0011` for sun pulse) are time-domain and **don't scale** — they stay as-is.

## File structure

Inside `client/src/three/` after the redesign:

```
client/src/three/
├── config.js          (UPDATED: scattered positions, SUN, CAMERA_SWEEP)
├── scene.js           (UPDATED: FogExp2, single sun point light + dim ambient)
├── textures.js        (unchanged)
├── planets.js         (UPDATED: adds halo sprite, reads offset from config)
├── sun.js             (NEW: createSun() + makeGlowTexture())
├── starfield.js       (REPLACED: sphere-shell, vertex colors)
├── dust.js            (NEW: createDust() returns Points)
├── scroll.js          (NEW: getSmoothedScroll() reads window.scrollY)
├── loop.js            (REPLACED: camera sweep + float + sun pulse)
└── transitions.js     (DELETED — rail transitions no longer exist)
```

`client/src/dom/sectionObserver.js` is **simplified** to update only the active dot on intersection. It no longer imports `setSection`.

`client/src/main.js` removes the rail loop and `setPlanetsRail` call; instead it places each planet directly at its configured `(x, y, z)` and adds the sun + dust groups.

No changes to: `components/`, `partials/`, `styles/`, `utils/`, `pages/`, `index.html`, `server/`, root `package.json`, `client/package.json`, vite config (none).

## Module responsibilities

### `three/sun.js` (new)

```js
export function makeGlowTexture(); // returns THREE.CanvasTexture
export function createSun();       // returns { group, glow, corona, glowMat }
                                   //   group:    THREE.Group at (0, 0, SUN_Z)
                                   //   glow:     inner sprite (yellow)
                                   //   corona:   outer sprite (orange)
                                   //   glowMat:  the inner sprite's material (for opacity ramp)
```

The sun group's position and sprite scales come from `config.js` (`SUN_POSITION`, `SUN_GLOW_SCALE`, `SUN_CORONA_SCALE`). The sprite materials use additive blending with `depthWrite: false`.

### `three/dust.js` (new)

```js
export function createDust(); // returns THREE.Points
```

600 particles in a sphere shell biased toward `z = -200` with warm/cool tinted vertex colors. Additive blending. No per-frame work — rotation is applied externally in the loop.

### `three/scroll.js` (new)

```js
export function getSmoothedScroll(); // returns number in [0, 1]
                                     // (smoothed via internal lerp at 0.07/frame
                                     //  toward window.scrollY / maxScroll)
```

Internal state: a single `smoothScroll` variable updated lazily on each call. Reads `document.documentElement.scrollHeight - window.innerHeight` for max each call (cheap, handles resize).

### `three/starfield.js` (replaced)

```js
export function createStarfield(); // returns THREE.Points
```

3500 stars in a spherical shell at radius 600–2400 (scaled by /14 from test.tsx → 43–171), vertex-colored with slight blue/yellow tint randomization. Slow Y rotation applied externally in the loop.

### `three/planets.js` (updated)

`buildPlanet(name)` now also creates a halo sprite using the **shared glow texture** from `sun.js`. The halo sprite is added to the planet group, scale = `radius * 4` (matching test.tsx ratio). The sphere material's `roughness` and `metalness` are tweaked to match test.tsx's look (`roughness: 0.85, metalness: 0.05`) — the existing per-section roughness/metalness in config is dropped (was per-planet variation, but test.tsx uses one look across all planets).

Saturn ring continues to use the existing `saturn_ring.png` texture and `addRingTo` logic — no changes there.

### `three/scene.js` (updated)

- `scene.fog = new THREE.FogExp2(0x05020a, 0.0008)`.
- `renderer.setClearColor(0x02030a, 1)` (replaces `alpha: true`).
- Lights: remove the existing `AmbientLight(0xffffff, 0.45)`, `DirectionalLight`, and `PointLight(0x7c8cff, ...)`. Add: `AmbientLight(0x222244, 0.55)` and `PointLight(0xffd599, 4.5, 3000, 1.4)` positioned at `SUN_POSITION` (imported from config).
- Camera initial position becomes `(0, 0, CAMERA_START_Z)` from config.

### `three/loop.js` (replaced)

```js
import { getSmoothedScroll } from './scroll.js';

const clock = new THREE.Clock();

export function startRenderLoop({
  scene, camera, renderer,
  planets,        // array of { group, mesh, rotSpeed }
  sun,            // { group, glow, corona, glowMat }
  stars,          // THREE.Points
  dust,           // THREE.Points
}) {
  function animate() {
    const t = getSmoothedScroll();
    camera.position.z = CAMERA_START_Z + (CAMERA_END_Z - CAMERA_START_Z) * t;

    const time = Date.now() * 0.0001;
    camera.position.x = Math.sin(time) * 0.4;            // / 14 from test.tsx's 6
    camera.position.y = Math.cos(time * 0.7) * 0.3;      // / 14 from test.tsx's 4
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

`clock` is no longer needed (camera is driven by scroll, not dt). Per-planet rotation uses raw fixed-step increments matching test.tsx exactly.

### `three/transitions.js` (deleted)

Rail transitions are gone. Anything that imported `setSection`, `setPlanetsRail`, `getCurrentSectionName`, `restingSpin`, `updateTransition` must drop those imports. Affected files: `main.js`, `dom/sectionObserver.js`, `loop.js` (already replaced).

### `dom/sectionObserver.js` (simplified)

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

No `setSection` import. The observer's only job is dot active-state + the `pending` fade-in class.

### `client/src/main.js` (updated)

```js
import { scene, camera, renderer, attachResizeHandler } from './three/scene.js';
import { SECTION_ORDER, SECTIONS, SUN_POSITION } from './three/config.js';
import { ensureEntry, loadTexture } from './three/textures.js';
import { buildPlanet, applySphereTextureToPlanet, applyRingTextureToPlanet } from './three/planets.js';
import { createSun } from './three/sun.js';
import { createStarfield } from './three/starfield.js';
import { createDust } from './three/dust.js';
import { initSectionObserver } from './dom/sectionObserver.js';
import { startRenderLoop } from './three/loop.js';

import { Nav, Hero, About, Skills, Work, Contact } from './components/...'; // keep as separate imports

document.querySelector('#nav-mount').innerHTML = Nav();
document.querySelector('#app').innerHTML = [Hero(), About(), Skills(), Work(), Contact()].join('');

const sun = createSun();
scene.add(sun.group);

const stars = createStarfield();
scene.add(stars);

const dust = createDust();
scene.add(dust);

const planets = SECTION_ORDER.map((name) => {
  const planet = buildPlanet(name);
  const cfg = SECTIONS[name];
  planet.position.set(cfg.offset.x, cfg.offset.y, cfg.z);
  scene.add(planet);
  return { name, group: planet, mesh: planet.children.find(c => c.userData.sphereMat), rotSpeed: cfg.rotSpeed };
});

// Texture loads as before, but applied to planet.group
for (const [name, cfg] of Object.entries(SECTIONS)) {
  const planet = planets.find(p => p.name === name).group;
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

The rail group, `setPlanetsRail`, `AXIAL_TILT_RAD`, and `THREE.Group` import are gone.

## Config.js extensions

Add to each section in `SECTIONS`:
- `offset: { x, y }` — world-space x/y offset.
- `z: number` — world-space z position (replaces rail-derived position).
- `rotSpeed: number` — per-frame Y-axis rotation increment (test.tsx uses 0.003–0.007).
- `haloOpacity: 0.45` (or accept default in planets.js).

Add new constants:
- `CAMERA_START_Z = 25`
- `CAMERA_END_Z = -39`
- `SUN_POSITION = new THREE.Vector3(0, 0, -46.5)` (or `[0, 0, -46.5]` and have caller construct)
- `SUN_RADIUS = 6.5`
- `SUN_GLOW_SCALE = 37`
- `SUN_CORONA_SCALE = 58`

Drop:
- `PLANET_SPACING_Z` (no rail)
- `AXIAL_TILT_RAD` (test.tsx randomizes z-rotation per planet, doesn't apply consistent tilt)
- `PAN_*`, `ZOOM_*`, `JUMP_*`, `FAST_SCROLL_*` (rail-transition timing constants)
- `restingSpin` (replaced by per-planet `rotSpeed`)

## Verification

After implementation:

1. `npm run build` from repo root must succeed.
2. `npm run dev`, open in browser, confirm:
   - All five planets visible at distance with halos.
   - Sun visible behind/beyond planets, glowing, pulsing.
   - Scrolling moves the camera through the scene smoothly (no discrete jumps).
   - Camera floats subtly even when not scrolling.
   - Stars and dust visible, slow background rotation.
   - Saturn ring renders with texture.
   - Dot nav highlights the active section as you scroll.
   - Clicking a dot scrolls to that section (browser anchor behavior).

## Implementation order (informs the plan)

Additive first, atomic switch last:

1. **Add new modules without wiring them in** (build still passes, behavior unchanged):
   - `three/sun.js`
   - `three/dust.js`
   - `three/scroll.js`
2. **Replace starfield internals** (signature unchanged, build passes):
   - `three/starfield.js`
3. **Atomic switch** (one batch — multi-file changes that depend on each other):
   - `three/config.js` (new shape)
   - `three/scene.js` (lights, fog)
   - `three/planets.js` (halo + reads offset)
   - `three/loop.js` (camera sweep)
   - `dom/sectionObserver.js` (strip)
   - delete `three/transitions.js`
   - `client/src/main.js` (place planets, add sun/dust, drop rail)
4. **Visual smoke test** (browser).

## Risks / Trade-offs

- **No graceful fallback if camera Z range is wrong.** If planets aren't visible at the right scroll points, you tweak numbers in `config.js`. Cheap to iterate.
- **Halo color requires the sphere config to keep `color`.** Currently each section's `color` is the fallback before texture loads. After this redesign, `color` also drives the halo tint. That's fine — the existing planet colors map naturally to atmosphere tints (Neptune blue → blue halo, Mars rust → red halo, etc.).
- **Removing `setSection` API.** Any future caller that wanted to programmatically jump to a section must use `element.scrollIntoView()` instead. That's a one-liner so this isn't a real loss.
- **Section CSS `min-height: 180vh`** stays. With 5 sections that gives ~9 viewports of scroll, which is enough resolution for a smooth camera Z lerp from +25 to -39. Fewer sections → choppier sweep; we have enough.
