# Three.js Scene Redesign — Design (2026-05-13)

**Date:** 2026-05-13
**Status:** Approved (pending user spec review)
**Owner:** John Kyle Camson
**Supersedes (partially):** `2026-04-28-scene-redesign-design.md` — current scene
**Reference:** `test-2.md` at repo root (React + TypeScript prototype with Bezier camera, far sun, 7 scattered planets)

## Goal

Evolve the current scroll-driven scene into a believable solar-system flyby. Concretely:

1. **Push the sun far away and offset up-right** so it doesn't dominate the contact section visually. Today the glow ramps to opacity 1.0 right where the contact form sits — visitors lose readability.
2. **Add the three missing real planets** (Mercury, Venus, Uranus) so all eight appear in real solar-system order from outer to inner (Neptune → Uranus → Saturn → Jupiter → Mars → Earth → Venus → Mercury → Sun).
3. **Replace the straight Z sweep with a quadratic Bezier camera arc** — camera weaves laterally through the system instead of pointing-and-flying.
4. **Replace `camera.lookAt(sun)` with `camera.lookAt(activeSectionPlanet)`**, interpolated smoothly between adjacent sections as the visitor scrolls. Each section feels anchored to its planet.

## Non-Goals

- No framework change. Still vanilla JS + Three.js + Vite.
- No section markup or copy changes. `components/{Hero,About,Skills,Work,Contact}.js` stay byte-identical.
- No new sections, no change to dot navigation count (still 5 dots).
- No backend / API work.
- No CSS layout changes for sections (`.section--left/right/centered` stay assigned exactly as today).
- No procedural fallback for planets we already have textures for. Only Mercury (missing) uses a procedural texture.

## Why these specific choices

### Why rebind sections to new planets (and not keep current bindings)

Current bindings — `hero=Neptune, about=Earth, skills=Mars, work=Jupiter, contact=Saturn` — were chosen for aesthetic variety, not solar order. To preserve "real solar-system order as you scroll inward," sections must rebind to planets that are in the right outer-to-inner sequence. The existing Z positions of sections (`+12.86, +4.29, -6.43, -16.43, -26.43` in our scale) are already monotonically decreasing, so we only have to relabel which planet's texture and halo color go to which section. The XY scatter offsets stay tied to the section, not the planet — this preserves the carefully-tuned screen-space planet-vs-content layout.

### Why look at the active section's planet (option C from brainstorm), not the sun

`test-2.md` always looks at the sun. We picked the more narrative option: each section's planet is the camera target during that section. The visitor's gaze is led by the camera onto the planet that matches the section's text. Background planets pass at varied angles in peripheral view.

### Why a quadratic Bezier specifically

Cubic gives an extra control point and more drift but adds tuning surface. Quadratic — single control point — is enough to get a believable lateral swing through scattered planets without overcomplication. Math: `P(t) = (1-t)² P0 + 2(1-t)t P1 + t² P2`.

## High-level changes

| | Before | After |
|---|---|---|
| Camera path | Straight Z: `+25 → -38.6` | Bezier: P0=`(0,0,25)`, P1=`(-21,6,-17)`, P2=`(0,0,-58.6)` |
| Camera lookAt | `(0, 0, sun.z)` — always sun, always straight ahead | Interpolated between adjacent section planets based on scroll t |
| Planet count | 5 (one per section) | 8 (5 section-anchored + 3 background) |
| Planet order | Aesthetic | Real solar order outer → inner |
| Sun position | `(0, 0, -46.4)` | `(30, 18.6, -114.3)` — far, upper-right offset |
| Sun radius | 6.4 | ~12 (larger but further → similar apparent size with depth) |
| Sun glow opacity ramp | 0.85 → 1.0 over scroll | 0.55 → 0.70 over scroll (capped) |
| Section content layout (CSS) | unchanged | unchanged |

## Section → planet remapping

The XY offset, ring config, halo brightness, content-layout side, and Z position of each section **stay tied to the section** (so layouts don't shift). Only the texture, halo color, and atmosphere identity rebind to the new planet.

| Section | Z (unchanged) | Was | Becomes | Texture | Has ring | Halo color |
|---|---|---|---|---|---|---|
| hero | +12.86 | Neptune | Neptune (no change) | `neptune.jpg` | no | `0x4a7cff` |
| about | +4.29 | Earth | **Saturn** | `saturn.jpg` + `saturn_ring.png` | **yes (moved here)** | `0xe2b76c` |
| skills | -6.43 | Mars | **Jupiter** | `jupiter.jpg` | no | `0xe2b76c` (gold-tan) |
| work | -16.43 | Jupiter | **Mars** | `mars.jpg` | no | `0xff5a3d` |
| contact | -26.43 | Saturn | **Earth** | `earth.jpg` | no | `0x4ddc92` |

The Saturn ring config (inner/outer radii, tilt, texture) **moves from `contact` to `about`** in `config.js`. The ring's tilt and tint match Saturn regardless of which section hosts it.

## Background planets

A new exported array `BACKGROUND_PLANETS` in `config.js` describes the 3 non-section planets. Each entry follows the same shape as a `SECTIONS` value but without the section-binding fields:

| Background slot | Z | x | y | radius | Texture | Halo color |
|---|---|---|---|---|---|---|
| Uranus | +8.5 | -8 | -3 | 1.2 | `uranus.jpg` | `0x9fd8e8` |
| Venus | -32 | 5 | -1.5 | 1.0 | `venus_athmosphere.jpg` (note: existing typo preserved) | `0xd8b67a` |
| Mercury | -38 | -3 | 2 | 0.7 | **procedural — generated at init** | `0x999999` |

- Uranus sits between Neptune (z=12.86) and Saturn (z=4.29) so it drifts past during the hero→about transition.
- Venus and Mercury sit between Earth (z=-26.43) and the sun (z=-114.3) — visible in the deep background once the visitor reaches the contact section.
- All three rotate on `rotSpeed` like section planets but are not lookAt targets.

## Mercury texture (procedural)

We don't have `mercury.jpg`. The smallest planet in the scene, at greatest distance from camera, in the background of the contact section — generating a procedural greyish rocky canvas texture is sufficient and matches the test-2.md aesthetic. Implementation: a `makeMercuryTexture()` function in `three/textures.js` that generates a 512×256 canvas with a grey base + random crater-like darker blobs (mirrors `test-2.md`'s `makePlanetTexture` approach).

The user can drop a real `mercury.jpg` into `/public/assets/planets/` at any time; one config switch and the procedural fallback is bypassed.

## Sun changes

```js
SUN_POSITION = new THREE.Vector3(30, 18.6, -114.3);  // upper-right, far
SUN_RADIUS = 12;                  // was 6.4
SUN_GLOW_SCALE = 93;              // was 37.1
SUN_CORONA_SCALE = 157;           // was 58.6
```

In `loop.js`, change the glow opacity ramp from `0.85 + t * 0.15` to `0.55 + t * 0.15` so the maximum is 0.70 (was 1.0). The PointLight at the sun's position keeps its intensity (4.5) — it's the additive sprite glow that was bleaching the contact section, not the light's reach.

## Camera mechanics

### Position (Bezier)

```js
function bezierPos(t) {
  const mt = 1 - t;
  return {
    x: 2 * mt * t * P1.x + t * t * P2.x,
    y: 2 * mt * t * P1.y + t * t * P2.y,
    z: mt * mt * P0.z + 2 * mt * t * P1.z + t * t * P2.z,
  };
}
```

With control points `P0=(0,0,25), P1=(-21,6,-17), P2=(0,0,-58.6)`, the camera swings to `x≈-10.5, y≈3` at t=0.5 and returns to `x=0` at t=1.

Hand-held float (`sin(time)*0.4`, `cos(time*0.7)*0.3`) stays on top of the Bezier position for the organic feel.

### LookAt (section interpolation)

The 5 section planets' world positions form an ordered array `[heroPlanet.pos, aboutPlanet.pos, skillsPlanet.pos, workPlanet.pos, contactPlanet.pos]`. Given smoothed scroll `t ∈ [0, 1]`:

```js
const segmentCount = SECTION_ORDER.length - 1;  // 4 segments between 5 planets
const scaled = t * segmentCount;
const segIdx = Math.min(Math.floor(scaled), segmentCount - 1);
const segT = scaled - segIdx;                   // 0..1 within this segment
const from = sectionPlanetPositions[segIdx];
const to   = sectionPlanetPositions[segIdx + 1];
const lookAtTarget = from.clone().lerp(to, easeInOut(segT));
camera.lookAt(lookAtTarget);
```

`easeInOut` (smoothstep `t*t*(3-2*t)` or similar) avoids the lookAt feeling like it tracks linearly through space — the camera pauses on each planet, then transitions, then settles on the next.

For t < 0 (scroll above the page) the target clamps to the hero planet. For t > 1 (rubber-band scroll) it clamps to contact.

## File changes

**Modified:**
- `client/src/three/config.js`
  - Rebind `SECTIONS.about` / `.skills` / `.work` / `.contact` to new planets (texture path, halo color, emissive color, ring config moved to about).
  - Update `SUN_POSITION`, `SUN_RADIUS`, `SUN_GLOW_SCALE`, `SUN_CORONA_SCALE`.
  - **Replace** scalar `CAMERA_START_Z` and `CAMERA_END_Z` with three `THREE.Vector3` constants: `CAMERA_BEZIER_P0`, `CAMERA_BEZIER_P1`, `CAMERA_BEZIER_P2`. The current `CAMERA_END_Z = -540/14` becomes `CAMERA_BEZIER_P2.z = -58.6` (further to leave room behind Earth at contact).
  - Add `BACKGROUND_PLANETS` array.
- `client/src/three/scene.js`
  - `sunLight.position.copy(SUN_POSITION)` (already does this — value just changes).
  - The `camera.position.set(0, 0, CAMERA_START_Z)` initializer becomes `camera.position.copy(CAMERA_BEZIER_P0)`.
- `client/src/three/loop.js`
  - Replace `camera.position.z = lerp(start, end, t)` with Bezier position function.
  - Replace `camera.lookAt(0, 0, sun.z)` with the section-planet interpolation logic.
  - Cap glow opacity ramp at 0.70.
  - Loop now also rotates the background planets.
- `client/src/three/textures.js`
  - Add `makeMercuryTexture()` (canvas-generated grey-rocky).
  - Add `getMercuryTexture()` accessor that returns the real `.jpg` if present in `/public/assets/planets/`, else the procedural one.
- `client/src/main.js`
  - Build background planets from `BACKGROUND_PLANETS` after the section planets are built.
  - Pass `sectionPlanetPositions` and `backgroundPlanets` into `startRenderLoop`.

**Created:**
- None. No new files. Background-planet building can live alongside section-planet building in `main.js` — it's a few lines, same `buildPlanet` helper.

**Unchanged:**
- All `components/*.js`.
- All `dom/*.js`.
- All `styles/**/*.css`.
- All `partials/`, `pages/`, `admin/`, `lib/`.
- `client/index.html`, `client/admin.html`.
- `client/src/three/planets.js`, `sun.js`, `skybox.js`, `starfield.js`, `dust.js`, `scroll.js`.

## Edge cases / risks

- **`OWNER_EMAIL` hardcoded in three places** is a separate (existing) concern, not touched by this redesign.
- **Background-planet textures fail to load.** Same fallback as section planets — the planet renders with its base color material until the texture resolves. Mercury's procedural texture is generated synchronously so it's never missing.
- **LookAt clamp at t < 0 or t > 1.** Smoothed scroll can briefly overshoot during inertial scrolling. Math clamps target to first/last planet position.
- **Bezier x-swing too aggressive for narrow viewports.** Hand-held float adds another `±0.4` on x. Worst case at t=0.5: `x ≈ -10.5 - 0.4 = -10.9`. With FOV 60° and z-distance ~25 to the focused planet, that's well within frame.
- **Camera looks at Saturn (about section) — Saturn has a ring at a tilted angle.** No issue, the ring is part of the planet group and rotates with the planet.
- **Performance.** 3 extra planets adds ≤ 0.5ms of draw time. Procedural Mercury canvas runs once at init.

## Smoke tests (manual)

1. Page loads at hero — Neptune visible roughly centered, sun small + upper-right + dim.
2. Scroll smoothly to about — Saturn (with ring) becomes the focus, camera has swung left.
3. Scroll to skills — Jupiter centers, camera continues swinging.
4. Scroll to work — Mars centers, camera begins returning right.
5. Scroll to contact — Earth centers, sun visible but not glaring. Contact form remains readable.
6. Background planets (Uranus, Venus, Mercury) are visible in peripheral view at the correct points in the scroll: Uranus between hero and about, Venus and Mercury beyond Earth toward the sun.
7. Scroll back to top — camera reverses smoothly; lookAt transitions feel like easing, not snapping.
8. Resize window — no broken aspect, camera FOV behaves.
9. Visit `/admin` and any project page — admin entry is unaffected (no Three.js on admin).

## Implementation order (high level)

Each step is independently committable and visually testable in `npm --prefix client run dev`. The order is designed so the scene never breaks between steps.

1. **Sun + glow** — update `SUN_POSITION`, `SUN_RADIUS`, glow/corona scales in `config.js`; cap glow opacity ramp in `loop.js`. Smallest possible change that solves the original contact-section pain. Hero scene looks identical otherwise.
2. **Section rebind** — swap texturePath / halo / emissive for about/skills/work/contact. Move Saturn ring config from contact to about. After this commit, the visitor scrolls past Neptune → Saturn → Jupiter → Mars → Earth at the same XY positions as before. Camera math unchanged.
3. **Background planets** — add `BACKGROUND_PLANETS` to config; add `makeMercuryTexture` to `textures.js`; build the 3 extra planets in `main.js` after the section planets. Camera still ignores them; they rotate but aren't lookAt targets.
4. **Bezier camera position** — replace scalar `CAMERA_START_Z`/`END_Z` constants with Vector3 `CAMERA_BEZIER_P0/P1/P2`. Update `scene.js` initial camera position. In `loop.js`, replace the Z lerp with the quadratic Bezier formula. `lookAt` still points at sun for now.
5. **Section-planet lookAt** — replace the sun lookAt with section-planet interpolation + easeInOut. `loop.js` now consumes the section-planet positions array.
6. **CLAUDE.md update** — refresh the "Current scene" section, add the 2026-05-13 redesign reference; this spec becomes the new source of truth instead of the 2026-04-28 one.

## Open items (deferred / future)

- Real `mercury.jpg` if the procedural texture feels too flat.
- Per-planet `texture.colorSpace` tuning if any planet looks washed out after sun-distance changes.
- Possibly a "homing" easing variation where the camera slightly overshoots the next planet then settles (would feel more inertial; not in scope today).
