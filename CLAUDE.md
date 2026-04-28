# Project updates (2026-04-25)

This file summarizes the changes made during the latest iteration on the Three.js portfolio background + scroll transitions.

## Planet scene + loading

- **Preload all planet textures**: texture loads are started in parallel and cached, then applied to existing meshes when they arrive.
- **All planets exist in the scene at once**: planets are created once at startup and placed along a Z “rail” so they can be seen in the distance.
  - `planetsRail` holds every `planet:<section>` group.
  - Spacing is controlled by `PLANET_SPACING_Z`.
- **No per-section rebuild/dispose**: removed the previous approach that removed/created meshes per section change.

## Transitions + fast scroll behavior

- **No lateral panning**: section transitions are depth/rail-based (no X pan).
- **No skipping planets**: rapid scroll uses a `sectionQueue` so moving from `hero` → `work` will traverse `about` → `skills` → `work`.
- **Keeps up with fast scrolling**:
  - Requests within `FAST_SCROLL_WINDOW_MS` apply a `FAST_SCROLL_SPEEDUP` multiplier to shorten durations.
- **Removed “springy” overshoot**:
  - Removed the overshoot component and simplified the transition to a single move to the target rail position.

## Rotation changes

- **Removed spring rotation**: replaced spring physics with direct per-section spin using `restingSpin`.
- **Axial tilt**: each planet is created with a constant axial tilt:
  - `AXIAL_TILT_RAD = degToRad(23.5)`

## Ring texture fix (Saturn ring)

- **Fixed ring UVs applying too late**: ring UV remapping now runs unconditionally when the ring geometry is created (textures load asynchronously).

## Scroll smoothing (HTML/CSS)

- **Longer scroll sections**: increased per-section vertical space so the IntersectionObserver doesn’t advance multiple sections too easily.
  - `section { min-height: 180vh; padding: 10rem 0; }`

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

When writing or modifying code in this repo, follow the conventions in
`AGENTS.md` at the repo root.

## Planned features (roadmap)

Not yet built — captured here so future iterations have context. Each
will get its own design + plan when picked up.

### Contact & Communication
- Contact form that emails the owner directly.
- Auto-reply to people who message in.
- Spam protection: rate limiting + captcha verification.

### Blog / Writing
- Posts authored in markdown, served via API.
- Draft / publish workflow so posts aren't live until ready.
- Tags, categories, search.

### Projects showcase
- Project data (title, description, tech stack, links, screenshots) in
  a database instead of hardcoded in `components/Work.js`.
- Add / update projects from a CMS without touching code.
- Filter by technology or category.

### Project links — possible approaches (pick per project)
- **Direct link** to the live deployed project (simplest, no backend).
- **GitHub repo link** so visitors can browse the code.
- **Embedded preview** — iframe inside the portfolio.
- **Screenshot / video + link** — backend serves the media, frontend displays it.
- **Password-protected demos** — backend verifies password before showing.

### Analytics & tracking
- Count profile views and project clicks.
- See which projects get the most attention.
- Self-hosted (no Google Analytics).

### Auth (only if needed)
- Admin login so only the owner can add / edit projects.
- Protect specific pages or admin routes.

Most of these require the `server/` half of the repo. When work begins,
scaffold `server/` per its README and update root `package.json` scripts.
