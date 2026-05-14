# Portfolio — project notes

Three.js + Vite + vanilla JS portfolio site with a scroll-driven space
scene. Backend (`server/`) is empty for now and will host the contact
form (next feature — see "Currently building" below).

When writing or modifying code in this repo, follow the conventions in
`AGENTS.md` at the repo root.

---

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
  (between contact and sun), Mercury (closest to sun).
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

---

## Project structure

Repo has `client/` (Vite frontend) and `api/` (Vercel serverless
functions; one file = one endpoint). Inside `client/src/`:

- `main.js` — thin orchestrator: mounts components, creates planets / sun
  / skybox / stars / dust, kicks off texture loads, starts the render
  loop.
- `three/` — Three.js scene logic, split by responsibility:
  - `config.js` — `SECTIONS`, `SECTION_ORDER`, `BACKGROUND_PLANETS`,
    `CAMERA_BEZIER_P0/P1/P2`, sun + skybox constants, texture paths.
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
- `dom/` — DOM-only behavior (no Three.js, no markup): `sectionObserver.js`
  (dot active-state + section fade-in), `contactForm.js` (contact form
  state machine + fetch to `/api/contact`), `projectsList.js` (public
  projects fetch from Supabase + tag-pill filtering).
- `lib/` — shared library clients. `supabase.js` exports a single
  `createClient` instance using `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_PUBLISHABLE_KEY`.
- `admin/` — admin-dashboard-only modules: `auth.js` (GitHub OAuth +
  owner-email gate), `dashboard.js` (list view + delete), `projectForm.js`
  (create/edit form, GitHub repo prefill, screenshot upload), and
  `styles/admin.css`. Loaded only by the `/admin.html` entry.
- `pages/` — multi-page Vite entries. `admin.js` boots `admin.html`,
  initializes admin auth + dashboard. No Three.js on this page.
- `styles/` — CSS split per concern: `base.css` (vars, reset,
  scrollbar), `layout.css` (sections, modifiers, headings), `nav.css`
  (dots), `components/{hero,skills,projects,contact,waypoint}.css`.
  `main.css` aggregates everything via `@import`.
- `utils/` — placeholder documented in its README.

Original restructure design (folder layout): `docs/superpowers/specs/2026-04-27-portfolio-restructure-design.md`.

---

## Currently building

*Nothing in progress.* Next up per the "Highlight picks" — the **AI chat
widget** powered by the Anthropic API. Spec / plan to be written when
work begins.

## Recently shipped

- **Scene redesign** (2026-05-14) — Pushed the sun far + upper-right
  (fixed contact-section glare), added Mercury / Venus / Uranus so all 8
  real planets appear in real outer-to-inner order, replaced the straight
  Z sweep with a quadratic Bezier camera arc, and switched lookAt from
  the sun to the active section's planet with smoothstep easing between
  sections. Spec:
  `docs/superpowers/specs/2026-05-13-scene-redesign-design.md`. Plan:
  `docs/superpowers/plans/2026-05-13-scene-redesign.md`.

- **Projects showcase** (2026-05-11) — DB-backed projects list (replaces
  hardcoded `Work.js`), `/admin` dashboard with GitHub OAuth gating,
  screenshot uploads, and tag-pill filtering. Backend: Supabase
  (Postgres + Auth + Storage). Public reads gated by `published=true`
  RLS; writes owner-only. Multi-page Vite (`client/admin.html` for the
  admin entry — no Three.js on admin). Admin form has a "Prefill from
  GitHub" helper that pulls title, slug, summary, tech stack
  (`/languages`), topics, and URLs from a public repo. Public list
  spans the full Work section width with auto-fit 280px cards centered
  in the row. Spec:
  `docs/superpowers/specs/2026-05-01-projects-showcase-design.md`.
  Plan: `docs/superpowers/plans/2026-05-09-projects-showcase.md`.

- **Contact form** (2026-05-01) — `POST /api/contact` (Zod validation,
  honeypot drop, Cloudflare Turnstile verify, Resend owner email +
  auto-reply). Frontend: `Contact.js` form + `dom/contactForm.js`
  state machine. Live on `portfolio.jkylec.dev`. Sender:
  `noreply@jkylec.dev` (apex domain verified in Resend).
  Spec: `docs/superpowers/specs/2026-04-29-contact-form-design.md`.
  Plan: `docs/superpowers/plans/2026-04-29-contact-form.md`.

---

## Planned features (roadmap)

Not yet built — captured here so future iterations have context. Each
will get its own design + plan when picked up.

### Contact & Communication ← **starting now** (quickest universally-useful feature to ship)
- Contact form that emails the owner directly (Nodemailer / SendGrid / Resend — pick during design).
- Auto-reply to people who message in.
- Spam protection: rate limiting + captcha verification.

### Blog / Writing
- Posts authored in markdown, served via API.
- Draft / publish workflow so posts aren't live until ready.
- Tags, categories, search.

### Projects showcase — stretch ideas (MVP shipped 2026-05-11)
- Search bar across title / summary / tech.
- Multi-screenshot gallery (currently 1 screenshot per project).
- Bulk Storage cleanup when projects are deleted (currently the row
  goes but the file lingers — intentional v1 trade-off).
- Multi-select tag filtering (currently single-select pills).

### Project links — possible approaches (pick per project)
- **Embedded preview** — iframe inside the portfolio.
- **Password-protected demos** — backend verifies password before showing.
- (Direct deployed link + GitHub repo link are already supported via
  `demo_url` / `repo_url` on each project row.)

### Analytics & tracking
- Count profile views and project clicks.
- See which projects get the most attention.
- Page views, referrers, time on page (custom visitor analytics).
- Self-hosted (no Google Analytics).

### Authentication & Dynamic Content (admin login shipped 2026-05-11)
- Password-protected case studies / client work.
- Per-route protection (the admin route already gates on owner GitHub
  OAuth; this would extend to public-but-gated pages).

### API integrations
- Auto-import a GitHub repo as a project row on demand (today's admin
  form prefills from GitHub but still requires a manual save). Could
  watch a list of "starred" repos and surface new ones.
- Display live Dribbble / Behance work.
- Show latest blog posts from a CMS (Sanity / Contentful / similar).

### Performance & delivery
- Server-side rendering (SSR) or static site generation for faster
  loads and better SEO.
- Image optimization pipeline (resize / compress on the fly).
- Caching layer with Redis for fast repeat visits.

### Fun / impressive extras
- **AI-powered chat widget** that answers questions about your work,
  via the Anthropic API. *Most memorable feature for visitors —
  stands out on a dev portfolio.*
- Resume / CV generator that builds a PDF on demand.
- "Hire me" availability status pulled from your calendar.

### Highlight picks
- **Already shipped:** contact form (2026-05-01) and projects showcase
  (2026-05-11) — the two highest-value features per past planning.
- **Up next:** scene redesign (push sun, add Mercury / Venus / Uranus,
  Bezier camera arc).
- **Most memorable to visitors after that:** the AI chat widget.

Most of these require the `api/` half of the repo. The contact form
established the patterns (Vercel monorepo config, env-var handling via
Vercel project settings, deploy on `git push`). Supabase-direct-from-
browser (used by the projects showcase) is the alternative for client-
side-heavy features that need DB + Auth + Storage without an extra
API layer.
I have also pushed the new code to github I will find more ways so i can test the API keys in local host because i only knew how to test them when the website is deployed.