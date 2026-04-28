# AGENTS.md

Code-organization guide for any agent (Claude, Copilot, etc.) working in
this repo. Read this **before** writing or modifying code.

The companion file `CLAUDE.md` describes _what_ the project is and _what
features are planned_. This file describes _where things go_ and _how to
keep them consistent_.

---

## Folder map (quick reference)

```
portfolio/
├── client/                    # Frontend (Vite + Three.js + vanilla JS)
│   ├── public/assets/         # Static assets served at /assets/...
│   ├── src/
│   │   ├── main.js            # Thin orchestrator. Keep small.
│   │   ├── three/             # All Three.js scene logic.
│   │   ├── components/        # Page sections — full <section> blocks.
│   │   ├── partials/          # Reusable HTML atoms (button, card, badge).
│   │   ├── dom/               # Plain-DOM behavior (no Three.js, no markup).
│   │   ├── styles/            # CSS, split per concern. main.css aggregates.
│   │   ├── utils/             # Generic helpers.
│   │   └── pages/             # Multi-page entries (when added).
│   ├── index.html             # Slim shell. Mounts via #nav-mount + #app.
│   └── package.json
├── server/                    # Backend (placeholder until first feature).
├── docs/superpowers/          # Design specs + implementation plans.
├── CLAUDE.md                  # Project context + planned features.
├── AGENTS.md                  # This file.
└── package.json               # Delegates to client/ and (future) server/.
```

---

## Where does X go?

Use this decision guide before creating any new file.

| You're adding... | Goes in | Notes |
|---|---|---|
| A new scrollable section (Hero/About-style) | `client/src/components/<Name>.js` | Update `main.js` mount block + add planet entry to `three/config.js` `SECTIONS`. |
| A reusable atom (button, card, badge, icon) | `client/src/partials/<Name>.js` | Style in `client/src/styles/partials/<name>.css` and `@import` from `styles/main.css`. |
| Three.js scene/object/material logic | `client/src/three/<file>.js` | Never import or query the DOM here (except the `#bg` canvas in `scene.js`). |
| A new constant or section config | `client/src/three/config.js` | All timing / sizing / SECTIONS data lives here. No `THREE.*` instances at module scope outside this. |
| Texture load / cache logic | `client/src/three/textures.js` | Use `loadTexture(path, onSuccess)` + `ensureEntry(name)`. |
| DOM-only behavior (scroll, modal, menu) | `client/src/dom/<file>.js` | Pure DOM. May import from `three/transitions.js` to call `setSection`, but never touch Three.js objects directly. |
| A render-loop side effect | `client/src/three/loop.js` | Add the per-frame call inside `startRenderLoop`'s `animate()`. |
| A small generic helper (math, formatter) | `client/src/utils/<file>.js` | One concern per file. |
| Styles for a section | `client/src/styles/components/<name>.css` | Add `@import` to `styles/main.css`. |
| Styles for an atom | `client/src/styles/partials/<name>.css` | Add `@import` to `styles/main.css`. |
| Global tokens / reset | `client/src/styles/base.css` | Variables on `:root`, resets, base typography. |
| Layout / structural CSS | `client/src/styles/layout.css` | `main`, `section`, canvas placement. |
| A new HTML page (e.g. `/blog`) | `client/<page>.html` + `client/src/pages/<page>.js` | Add the entry to `vite.config.js` `build.rollupOptions.input`. |
| Backend code (API, mailer, DB) | `server/...` | Scaffold `server/package.json` first. Update root scripts. |
| Static asset (image, texture, font) | `client/public/assets/<category>/` | Reference as `/assets/<category>/file.ext` (Vite serves `public/` at root). |

---

## Conventions per folder

### `components/`
- One file per section. Filename matches the export: `Hero.js` exports `Hero`.
- Default export is **not** used — use named exports: `export const Hero = () => \`...\``.
- The function takes optional props, returns an HTML string. No DOM manipulation inside.
- The `<section>` element must keep the `id="<name>"` and `data-spin="<name>"` attributes — both are required by `dom/sectionObserver.js` and `three/transitions.js`.
- When adding a new section, **also**:
  1. Add a planet config to `three/config.js` `SECTIONS`.
  2. Add the section name to `SECTION_ORDER` (order matters — controls the rail).
  3. Import and mount in `main.js`.
  4. Add a dot link to `components/Nav.js` with `href="#<name>"` and `data-target="<name>"`.

### `partials/`
- Small, prop-driven, return HTML strings.
- Example shape:
  ```js
  export const Button = ({ href = '#', label, variant = 'primary' }) => `
    <a class="btn btn--${variant}" href="${href}">${label}</a>
  `;
  ```
- Always sanitize / escape user-supplied values if they ever come from outside this codebase (none currently do — but if you wire one up to backend data, escape).

### `three/`
- Each module owns its slice of state. Don't reach across modules to mutate state — export a function instead (`setPlanetsRail`, `setSection`, etc.).
- `config.js` is pure data. The only `THREE.*` use allowed there is `THREE.MathUtils.degToRad`.
- New per-frame work goes inside `startRenderLoop`'s `animate()` in `three/loop.js`.

### `dom/`
- No Three.js imports here. If you need a Three.js side effect, import a function from `three/transitions.js` (or another `three/` module) and call it.
- Each module exports an `init*()` function. `main.js` calls these once at boot.

### `styles/`
- Every new CSS file must be `@import`-ed from `styles/main.css`.
- Don't introduce a CSS framework or preprocessor without first updating this file (and `CLAUDE.md`).
- Use `var(--bg)`, `var(--fg)`, `var(--muted)`, `var(--accent)` from `base.css`. If you need a new color or token, add it to `:root` in `base.css`.

### `utils/`
- One concern per file. No god-modules.
- Pure functions only — no DOM, no Three.js side effects.

### `server/`
- Currently empty. When you start backend work, read `server/README.md` first.
- The frontend never imports from `server/`. Cross the boundary only via `fetch()` to API endpoints.

---

## Wiring checklist when adding a new section

This is the failure mode most likely to bite an agent. Use the list.

- [ ] `client/src/components/<Name>.js` created, returns `<section id="<name>" data-spin="<name>">...</section>`.
- [ ] `client/src/main.js` imports and includes it in the `#app` mount block, in the right order.
- [ ] `client/src/three/config.js` `SECTIONS` has a `<name>` entry with planet config.
- [ ] `client/src/three/config.js` `SECTION_ORDER` includes `<name>` at the right index.
- [ ] `client/src/components/Nav.js` has a matching dot link.
- [ ] If new styles are needed: file in `styles/components/<name>.css` + `@import` in `styles/main.css`.
- [ ] Planet texture exists at `client/public/assets/planets/<file>` if `texturePath` is set.
- [ ] `npm run build` from repo root succeeds.
- [ ] Manual check: page renders, scroll triggers the new section, dot highlights.

---

## Verification

This project has no automated test suite. After **every** non-trivial change:

```bash
npm run build      # from repo root — fails fast on import / syntax errors
npm run dev        # for visual confirmation
```

If you can't run a browser, at minimum confirm `npm run build` exits 0 before declaring work complete.

---

## What NOT to do

- **Don't put Three.js code in `dom/` or `components/`.** Components return strings; DOM modules call DOM APIs. Three.js stays in `three/`.
- **Don't put HTML strings in `three/`.** Three.js never speaks HTML.
- **Don't introduce a framework** (React, Vue, Svelte, lit-html, etc.) without first proposing it in a design doc under `docs/superpowers/specs/`.
- **Don't bypass `styles/main.css`.** Every CSS file must be reachable from there.
- **Don't grow `main.js` past ~80 lines.** When it does, the next module probably wants to be extracted (e.g. `three/rail.js` for the planets-rail setup).
- **Don't add `package.json` dependencies at the repo root.** Dependencies live in `client/` (and later `server/`). Root scripts only delegate.
- **Don't commit `dist/`, `node_modules/`, or `.vite/`.** Already gitignored.
- **Don't write planning, decision, or analysis `.md` files unless explicitly asked.** Specs and plans go under `docs/superpowers/`.

---

## Process for non-trivial work

For any change that touches more than 2 files or introduces new patterns:

1. Write a short design doc to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`.
2. Write an implementation plan to `docs/superpowers/plans/YYYY-MM-DD-<feature>.md` with bite-sized tasks.
3. Implement on a feature branch (e.g. `feat/contact-form`), not on `main`.
4. Verify with `npm run build` after each commit.
5. Merge with `git merge --ff-only` to keep history linear.

For trivial single-file edits (typo, comment, one-liner), skip the design / plan and just make the change on a branch.
