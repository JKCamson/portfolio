# Portfolio Repo Restructure — Design

**Date:** 2026-04-27
**Status:** Approved (pending spec review)
**Owner:** John Kyle Camson

## Goal

Reorganize the portfolio repository so it (a) clearly separates frontend from a future backend, (b) splits the monolithic `src/main.js` into focused modules along Three.js / DOM / config boundaries, and (c) provides folders that scale as the site grows (more sections, reusable UI atoms, additional pages).

The current layout — three flat files (`index.html`, `src/main.js` at 377 lines, `src/style.css`) — is fine for a prototype but won't scale as more features are added.

## Non-Goals

- No behavioral changes to the Three.js scene, transitions, or scroll observer. Restructure only — output should look and behave identically.
- No new framework (React/Vue/Svelte). Stays vanilla JS + Vite + Three.js.
- No backend implementation. `server/` is a scaffolded placeholder only.
- No new features or sections. Reorganization of existing code only.

## Top-Level Layout

```
portfolio/
├── client/              # Frontend (Vite + Three.js)
│   ├── public/
│   │   └── assets/planets/
│   ├── src/             # see "Inside client/src/" below
│   ├── index.html
│   ├── package.json
│   └── vite.config.js   # added if Vite needs config (e.g. base path); otherwise omit
├── server/              # Backend — empty scaffold
│   └── README.md        # describes future intent (API endpoints, contact form, etc.)
├── docs/
│   └── superpowers/specs/   # design docs and specs
├── package.json         # root: workspace scripts (dev, build, preview) that delegate to client/
├── CLAUDE.md
├── .gitignore
└── README.md
```

The `client/` vs `server/` split is the explicit "frontend / backend" boundary. `server/` exists immediately so future backend work has an obvious home, even though it starts empty.

## Inside `client/src/`

```
client/src/
├── main.js              # Entry: imports styles, mounts components, boots Three.js
├── three/               # All Three.js scene logic — split from current main.js
│   ├── scene.js         # scene, camera, renderer, lights, resize handler
│   ├── config.js        # SECTIONS, SECTION_ORDER, PLANET_SPACING_Z, AXIAL_TILT_RAD, durations
│   ├── textures.js      # texture cache (`textures` object) + `loadTexture` helper
│   ├── planets.js       # buildPlanet, addRingTo, remapRingUVs, applySphereTextureToPlanet, applyRingTextureToPlanet
│   ├── starfield.js     # starfield generation
│   ├── transitions.js   # rail position, sectionQueue, configureTransition, setSection, startNextTransition
│   └── loop.js          # animate() / render loop, clock
├── components/          # Page-level sections — return full <section> markup as strings
│   ├── Nav.js           # .dots nav
│   ├── Hero.js
│   ├── About.js
│   ├── Skills.js
│   ├── Work.js
│   └── Contact.js
├── partials/            # Small reusable HTML atoms — drop in anywhere
│   ├── Button.js
│   ├── Card.js
│   ├── Badge.js
│   ├── Icon.js
│   └── SectionHeading.js
├── dom/                 # DOM-only behavior (no Three.js, no markup)
│   └── sectionObserver.js  # IntersectionObserver wiring + dot active state
├── styles/
│   ├── main.css         # @imports the rest
│   ├── base.css         # :root vars, reset, html/body
│   ├── layout.css       # main, section, .pending, #bg canvas
│   ├── nav.css          # .dots
│   ├── components/      # one CSS file per page section
│   │   ├── hero.css
│   │   ├── skills.css
│   │   ├── projects.css
│   │   └── contact.css
│   └── partials/        # one CSS file per atom
│       ├── button.css
│       ├── card.css
│       └── badge.css
├── utils/               # Generic helpers as they appear (math, dom). Empty at start.
└── pages/               # Placeholder for future multi-page setup (blog.html, projects.html)
    └── README.md
```

## Module Responsibilities

### `three/` modules

Splits `src/main.js` along its existing logical seams:

- **`config.js`** — pure data. `SECTIONS` (per-section planet config), `SECTION_ORDER`, all timing / spacing constants (`PLANET_SPACING_Z`, `AXIAL_TILT_RAD`, `FAST_SCROLL_WINDOW_MS`, `FAST_SCROLL_SPEEDUP`, `JUMP_OUT_DURATION`, etc.). No Three.js imports.
- **`scene.js`** — exports `{ scene, camera, renderer }` and the `resize` handler. Owns lights. Imported by `main.js`.
- **`textures.js`** — exports `textures` cache, `ensureEntry(name)`, `loadTexture(path, onSuccess)`. No scene side effects.
- **`planets.js`** — exports `buildPlanet(name)`, `applySphereTextureToPlanet`, `applyRingTextureToPlanet`. Internal helpers `addRingTo`, `remapRingUVs` stay private to the module.
- **`starfield.js`** — exports `createStarfield()` returning the `THREE.Points` object. Caller adds it to scene.
- **`transitions.js`** — exports `setSection(name)` (the public API used by the scroll observer) and the per-frame transition update used by the render loop. Owns `currentSectionName`, `pendingSection`, `sectionQueue`, `transitionState`, `transitionT`, `outFrom`, `outTo`, `outDuration`, `restingSpin`.
- **`loop.js`** — exports `startRenderLoop({ scene, camera, renderer, planetsRail, planetsBySection, stars })`. Owns the `clock` and `requestAnimationFrame` loop. Calls into `transitions.js` for the per-frame transition step.

### `components/` modules

Each exports a function returning an HTML string. Example:

```js
// client/src/components/Hero.js
export const Hero = () => `
  <section id="hero" data-spin="hero">
    <p class="eyebrow">Portfolio</p>
    <h1>Your Name</h1>
    <p class="tagline">Developer · Designer · Builder</p>
  </section>
`;
```

`main.js` mounts these into `<main id="app"></main>`:

```js
import { Hero } from './components/Hero.js';
import { About } from './components/About.js';
// ...
document.querySelector('#app').innerHTML = [Hero(), About(), Skills(), Work(), Contact()].join('');
```

### `partials/` modules

Take props, return HTML strings. Composable inside components and any future page.

```js
// client/src/partials/Button.js
export const Button = ({ href = '#', label, variant = 'primary' }) => `
  <a class="btn btn--${variant}" href="${href}">${label}</a>
`;
```

### `dom/` modules

Plain-DOM behavior, no Three.js. Currently just `sectionObserver.js`, which wires `IntersectionObserver` to call `setSection(name)` from `transitions.js` and toggles the active dot.

### `styles/`

`index.html` loads only `styles/main.css`. `main.css` `@import`s the rest in order:

```css
@import "./base.css";
@import "./layout.css";
@import "./nav.css";
@import "./components/hero.css";
@import "./components/skills.css";
@import "./components/projects.css";
@import "./components/contact.css";
@import "./partials/button.css";
@import "./partials/card.css";
@import "./partials/badge.css";
```

Only create a CSS file for a partial when it actually has styles. Don't create empty placeholders — keep `styles/partials/` and the `@import` list short and accurate.

## `index.html`

Slimmed down to a shell. Body becomes:

```html
<body>
  <canvas id="bg"></canvas>
  <main id="app"></main>
  <script type="module" src="/src/main.js"></script>
</body>
```

`main.js` injects Nav and section markup at boot. (`Nav` is mounted outside `<main>` to preserve current `position: fixed` behavior — handled by `main.js`.)

## `main.js` Responsibilities

`main.js` becomes a thin orchestrator:

1. Import `styles/main.css`.
2. Mount components into the DOM.
3. Import scene primitives from `three/scene.js`.
4. Build the planets rail (`buildPlanet` for each section, position on Z-rail) — this stays in `main.js` for now since it's <30 lines and uses both `scene` and `planets`/`textures`/`config`. Can graduate to `three/rail.js` if it grows.
5. Kick off texture loads.
6. Add starfield.
7. Wire `dom/sectionObserver.js` to `three/transitions.js#setSection`.
8. Start the render loop from `three/loop.js`.

Target size: ~50 lines.

## Root `package.json`

Top-level `package.json` exposes scripts that delegate into `client/`:

```json
{
  "name": "portfolio",
  "private": true,
  "scripts": {
    "dev": "npm --prefix client run dev",
    "build": "npm --prefix client run build",
    "preview": "npm --prefix client run preview"
  }
}
```

Three.js and Vite move into `client/package.json`. Root has no dependencies. Workspaces are not introduced (overkill for two folders).

## Server Placeholder

`server/README.md` should briefly state:

- Currently empty — no backend.
- Reserved for future API (e.g. contact form handler, projects CMS, blog API).
- When work begins, scaffold here with its own `package.json` and update root scripts to add `dev:server` etc.

## Asset Path Considerations

Texture paths in `config.js` currently use `/assets/planets/...`. After the move, `client/public/assets/planets/...` is served at the same `/assets/planets/...` URL by Vite (Vite serves `public/` at root). No path changes needed.

## Migration Order (for the implementation plan)

1. Create `client/` folder; move `index.html`, `src/`, `public/`, `package.json`, `package-lock.json` into it. Verify `npm run dev` still works from `client/`.
2. Create root `package.json` with delegating scripts. Verify `npm run dev` from repo root still works.
3. Create `client/src/three/`, split `main.js` into `config.js`, `scene.js`, `textures.js`, `planets.js`, `starfield.js`, `transitions.js`, `loop.js` one at a time, verifying the page still renders after each split.
4. Create `client/src/components/`, extract section markup from `index.html` into component template functions; thin out `index.html`; mount from `main.js`. Verify visually.
5. Create `client/src/partials/`, `client/src/dom/`, `client/src/utils/`, `client/src/pages/` (stub READMEs/placeholders only — no code moved yet).
6. Create `client/src/styles/`, split `style.css` along the structure. Replace the single `<link>` in `index.html` with `import './styles/main.css'` in `main.js` (or a single `<link rel="stylesheet" href="/src/styles/main.css">`).
7. Create `server/README.md`.
8. Update `CLAUDE.md` with a short "Project Structure" section pointing at this design.

Each step is independently verifiable in the browser. Commit after each.

## Verification

After each step and at the end:

- `npm run dev` from repo root starts the Vite dev server.
- Page loads, planets render, scroll transitions work, fast-scroll and back-scroll behave as documented in `CLAUDE.md`.
- All five planets exist on the Z-rail (active one at z=0, others receding into depth) and the ring texture on Saturn applies correctly.
- No console errors.

## Risks / Trade-offs

- **More files to navigate.** Trade-off accepted: smaller, focused files are easier to extend than one 377-line file.
- **Template-string components have no compile-time safety.** Acceptable for vanilla JS — if it becomes a problem, switching to lit-html or a real framework is a separate decision.
- **Root `package.json` adds one indirection.** Mitigated by simple `--prefix` scripts; no new tooling.
- **`client/` rename touches Vite's working directory.** Verified by running dev server after step 1 before doing anything else.
