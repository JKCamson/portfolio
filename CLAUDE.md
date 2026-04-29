# Portfolio — project notes

Three.js + Vite + vanilla JS portfolio site with a scroll-driven space
scene. Backend (`server/`) is empty for now and will host the contact
form (next feature — see "Currently building" below).

When writing or modifying code in this repo, follow the conventions in
`AGENTS.md` at the repo root.

---

## Current scene (as of 2026-04-28)

**Continuous scroll-driven camera sweep through scattered planets toward
a distant sun.** Replaces the earlier rail-jump model entirely.

### Planets
- Five planets at fixed `(x, y, z)` offsets in world space (defined in
  `client/src/three/config.js` `SECTIONS`). One planet per section:
  hero=Neptune, about=Earth, skills=Mars, work=Jupiter, contact=Saturn.
- Each planet has its real `.jpg` texture loaded async (textures live in
  `client/public/assets/planets/`).
- Each planet gets a colored atmosphere halo (additive sprite using a
  shared canvas-generated radial-gradient texture).
- Saturn keeps its `saturn_ring.png` ring with UV-remapped geometry.
- Per-planet `rotSpeed` (range 0.003–0.007) drives Y-axis rotation in
  the render loop.

### Sun
- Centered backdrop at `(0, 0, -650/14)`. Textured with `sun.jpg`.
- Glow + corona sprites with additive blending pulse on `sin(time)`.
- Glow opacity ramps with scroll proximity (0.85 → 1.0).
- Single `THREE.PointLight` at the sun's position is the scene's only
  directional light (plus dim ambient).

### Backdrop
- 3500-point procedural starfield in a sphere-shell distribution with
  subtle blue/yellow vertex tints.
- 600-point nebula dust with warm/cool additive blending,
  counter-rotating.
- `stars_milkyway.jpg` skybox sphere at radius 200, `BackSide`,
  opacity 0.45 — sits behind the procedural points for depth.

### Camera
- Sweeps Z from `+25` (start of page) to `-39` (end of page), driven by
  smoothed window scroll (`scroll.js#getSmoothedScroll`, lerp 0.07).
- Floats organically on `sin(time)*0.4` / `cos(time*0.7)*0.3` for a
  hand-held feel.
- Always looks at the sun's z position.

### HTML / sections
- Five `<section>` blocks: `hero`, `about`, `skills`, `work`, `contact`.
- Each section uses one of three layout modifiers: `.section--centered`
  (hero, contact) or `.section--left` / `.section--right` (about,
  skills, work). The left/right side is opposite the planet's
  screen-space position so the content doesn't overlap the planet.
- Each waypoint section uses the pattern: small uppercase eyebrow → light-weight heading → thin divider → body. Defined by `.waypoint` and
  related rules in `client/src/styles/components/waypoint.css`.
- Hero ends with a pulsing `↓ SCROLL ↓` cue.
- Right-side dot navigation highlights the active section as you scroll
  (the `IntersectionObserver` in `dom/sectionObserver.js`); clicking a
  dot is a plain anchor scroll.

Design doc for this scene: `docs/superpowers/specs/2026-04-28-scene-redesign-design.md`.
Plan: `docs/superpowers/plans/2026-04-28-scene-redesign.md`.

---

## Project structure

Repo is split into `client/` (frontend) and `server/` (backend
placeholder). Inside `client/src/`:

- `main.js` — thin orchestrator: mounts components, creates planets / sun
  / skybox / stars / dust, kicks off texture loads, starts the render
  loop.
- `three/` — Three.js scene logic, split by responsibility:
  - `config.js` — `SECTIONS`, `SECTION_ORDER`, camera sweep range, sun
    + skybox constants, texture paths.
  - `scene.js` — scene, camera, renderer, lights, fog, resize handler.
  - `textures.js` — texture cache + async loader.
  - `planets.js` — `buildPlanet`, ring helpers, halo, texture appliers.
  - `sun.js` — `createSun`, `applySunTexture`, shared glow texture.
  - `skybox.js` — Milky Way backdrop sphere.
  - `starfield.js` — sphere-shell procedural points.
  - `dust.js` — additive nebula dust.
  - `scroll.js` — smoothed window scroll progress (`0..1`).
  - `loop.js` — render loop.
- `components/` — page sections as JS template functions returning HTML
  strings (`Hero.js`, `About.js`, `Skills.js`, `Work.js`, `Contact.js`,
  `Nav.js`).
- `partials/` — small reusable HTML atoms (buttons, cards, badges).
  Empty for now; documented in its README.
- `dom/` — DOM-only behavior (no Three.js, no markup); currently
  `sectionObserver.js` for dot active-state and section fade-in.
- `styles/` — CSS split per concern: `base.css` (vars, reset,
  scrollbar), `layout.css` (sections, modifiers, headings), `nav.css`
  (dots), `components/{hero,skills,projects,contact,waypoint}.css`.
  `main.css` aggregates everything via `@import`.
- `utils/`, `pages/` — placeholders documented in their READMEs.

Original restructure design (folder layout): `docs/superpowers/specs/2026-04-27-portfolio-restructure-design.md`.

---

## Currently building

**Contact form (server-side).** Starting next: scaffold `server/` and
add a `POST /api/contact` endpoint that receives the form, sends an
email to the owner, and replies to the sender. Spam protection (rate
limit + captcha) included. The frontend `Contact` component will swap
its `mailto:` heading for a real form once the endpoint exists.

Spec / plan to be written when work begins.

---

## Planned features (roadmap)

Not yet built — captured here so future iterations have context. Each
will get its own design + plan when picked up.

### Contact & Communication ← **starting now**
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

Most of these require the `server/` half of the repo. The contact form
will set up the patterns (server scaffold, env-var handling, deploy
target) that the rest of these reuse.
