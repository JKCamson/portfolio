# Project Pages (Listing + Detail + Gallery) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/projects` listing page and per-project `/projects/<slug>` detail pages (with a captioned screenshot gallery + lightbox), turn the main-page Work section into a featured teaser, and share one `ProjectCard` partial across teaser and listing.

**Architecture:** Two new multi-page Vite entries (`projects.html`, `project.html`) served at pretty URLs via Vercel rewrites, both client-rendered from Supabase with no Three.js. A new `project_screenshots` child table (published-gated RLS) holds the gallery; admin manages it from the existing project form. The Work section keeps its 3D-scene slot but shows only featured projects + a "View all" link.

**Tech Stack:** Vite multi-page + vanilla JS, Supabase (Postgres + Auth + RLS + Storage), Vercel rewrites. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-25-project-detail-page-design.md`.

**Verification model:** No automated test suite (per `AGENTS.md`). Each task ends with `npm run build` (exit 0) from repo root and a browser smoke check (`npm run dev` → `http://localhost:5173`). Pretty-URL routes (`/projects`, `/projects/<slug>`) only resolve under `vercel dev` / production; in plain `vite` dev use `/projects.html` and `project.html?slug=<slug>`.

**Commit hygiene:** This session the user authorized per-task commits. Each task ends with a commit. Use `git add <specific-files>` (never `-A`/`.`); do not push (the user pushes). If running as subagents, the controller may instruct otherwise.

---

## File Structure

**Created:**
- `client/projects.html` — listing-page shell (links `styles/projects-page.css`, mounts `#projects-mount`).
- `client/project.html` — detail-page shell (links `styles/project.css`, mounts `#project-mount`).
- `client/src/pages/projects.js` — listing entry → `initProjectsPage`.
- `client/src/pages/project.js` — detail entry → resolves slug → `initProjectDetail`.
- `client/src/dom/projectsPage.js` — fetch all published + render grid.
- `client/src/dom/projectDetail.js` — fetch project (+ screenshots) + render + lightbox.
- `client/src/partials/ProjectCard.js` — shared card markup (teaser + listing).
- `client/src/styles/projects-page.css` — listing styles (`@import base.css` + `components/projects.css`).
- `client/src/styles/project.css` — detail + gallery + lightbox styles (`@import base.css`).

**Modified:**
- `supabase/schema.sql` — append `project_screenshots`.
- `client/vite.config.js` — add `project` + `projects` entries.
- `vercel.json` — add `rewrites`.
- `client/src/dom/projectsList.js` — Work teaser (featured/fallback, shared card).
- `client/src/components/Work.js` — add "View all projects →" link.
- `client/src/admin/projectForm.js` — gallery management (edit-mode).
- `client/src/styles/components/projects.css` — `.projects__viewall` + `.projects__title-link`.
- `CLAUDE.md` — structure + Recently shipped.

---

### Task 1: `project_screenshots` schema

**Files:**
- Modify: `supabase/schema.sql` (append at end)

- [ ] **Step 1: Append the block to `supabase/schema.sql`**

```sql

-- Project screenshots gallery (added 2026-05-25). One row per additional
-- screenshot on a project's detail page; the cover stays in
-- projects.screenshot_url.

create table project_screenshots (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects (id) on delete cascade,
  url          text not null,
  caption      text,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

create index project_screenshots_project_idx
  on project_screenshots (project_id, sort_order asc);

alter table project_screenshots enable row level security;

create policy "public reads screenshots of published projects"
  on project_screenshots for select
  using (exists (
    select 1 from projects p
    where p.id = project_screenshots.project_id
      and p.published = true
  ));

create policy "owner reads all screenshots"
  on project_screenshots for select
  using (auth.email() = 'jkylecadap@gmail.com');

create policy "owner inserts screenshots rows"
  on project_screenshots for insert
  with check (auth.email() = 'jkylecadap@gmail.com');

create policy "owner updates screenshots rows"
  on project_screenshots for update
  using (auth.email() = 'jkylecadap@gmail.com')
  with check (auth.email() = 'jkylecadap@gmail.com');

create policy "owner deletes screenshots rows"
  on project_screenshots for delete
  using (auth.email() = 'jkylecadap@gmail.com');
```

- [ ] **Step 2: Apply the same SQL in Supabase Studio** — SQL Editor → New query → paste → Run. Expected: "Success. No rows returned." Confirm a `project_screenshots` table appears in the Table Editor.

- [ ] **Step 3: Verify build** — `npm run build` → exit 0.

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat(projects): add project_screenshots table to schema reference"
```

---

### Task 2: Shared `ProjectCard` partial + rewire teaser

**Files:**
- Create: `client/src/partials/ProjectCard.js`
- Modify: `client/src/dom/projectsList.js`

- [ ] **Step 1: Create `client/src/partials/ProjectCard.js`**

```js
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const ProjectCard = (p) => {
  const detailHref = `/projects/${esc(p.slug)}`;
  const media = p.screenshot_url
    ? `<img src="${esc(p.screenshot_url)}" alt="${esc(p.title)} screenshot" loading="lazy" />`
    : `<div class="projects__media-fallback"></div>`;
  return `
    <li class="projects__card">
      <a class="projects__media" href="${detailHref}">${media}</a>
      <h3><a class="projects__title-link" href="${detailHref}">${esc(p.title)}</a></h3>
      <p>${esc(p.summary)}</p>
      ${p.tech_stack?.length
        ? `<ul class="projects__tech">${p.tech_stack.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`
        : ''}
      <div class="projects__links">
        ${p.demo_url ? `<a href="${esc(p.demo_url)}" target="_blank" rel="noopener">Demo</a>` : ''}
        ${p.repo_url ? `<a href="${esc(p.repo_url)}" target="_blank" rel="noopener">Code</a>` : ''}
      </div>
    </li>
  `;
};
```

- [ ] **Step 2: Rewire `client/src/dom/projectsList.js` to use the partial** (still renders all published for now; the teaser/featured logic lands in Task 5). Replace the ENTIRE file with:

```js
import { supabase } from '../lib/supabase.js';
import { ProjectCard } from '../partials/ProjectCard.js';

let projects = [];

export async function initProjectsList() {
  const list = document.querySelector('#projects-list');
  if (!list) return;

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('published', true)
    .order('featured', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    list.removeAttribute('aria-busy');
    list.innerHTML = `<li class="projects__error">Couldn't load projects — refresh to try again.</li>`;
    return;
  }

  projects = data ?? [];
  list.removeAttribute('aria-busy');
  if (!projects.length) {
    list.innerHTML = `<li class="projects__empty">No projects yet</li>`;
    return;
  }
  list.innerHTML = projects.map(ProjectCard).join('');
}
```

- [ ] **Step 3: Add card-link styles to `client/src/styles/components/projects.css`** — append at end:

```css
.projects__title-link {
  color: inherit;
  text-decoration: none;
}
.projects__title-link:hover {
  text-decoration: underline;
}
```

- [ ] **Step 4: Verify build** — `npm run build` → exit 0.

- [ ] **Step 5: Smoke** — `npm run dev`, main page Work section still renders cards; clicking a card's image/title now points at `/projects/<slug>` (will 404 in plain vite dev until later tasks/rewrites — that's expected; just confirm the href is correct via hover/inspect). No console errors.

- [ ] **Step 6: Commit**

```bash
git add client/src/partials/ProjectCard.js client/src/dom/projectsList.js client/src/styles/components/projects.css
git commit -m "refactor(projects): extract shared ProjectCard partial linking to detail page"
```

---

### Task 3: Routing scaffold (pages, entries, rewrites, style shells, stub detail)

**Files:**
- Create: `client/projects.html`, `client/project.html`, `client/src/pages/projects.js`, `client/src/pages/project.js`, `client/src/dom/projectDetail.js` (stub), `client/src/styles/projects-page.css`, `client/src/styles/project.css`
- Modify: `client/vite.config.js`, `vercel.json`

- [ ] **Step 1: Create `client/projects.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Projects — Portfolio</title>
    <link rel="stylesheet" href="/src/styles/projects-page.css" />
  </head>
  <body>
    <main id="projects-mount">Loading…</main>
    <script type="module" src="/src/pages/projects.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Create `client/project.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Project — Portfolio</title>
    <link rel="stylesheet" href="/src/styles/project.css" />
  </head>
  <body>
    <main id="project-mount">Loading…</main>
    <script type="module" src="/src/pages/project.js"></script>
  </body>
</html>
```

- [ ] **Step 3: Create `client/src/pages/projects.js`**

```js
import { initProjectsPage } from '../dom/projectsPage.js';

const mount = document.querySelector('#projects-mount');
initProjectsPage(mount);
```

- [ ] **Step 4: Create `client/src/pages/project.js`**

```js
import { initProjectDetail } from '../dom/projectDetail.js';

function resolveSlug() {
  const m = window.location.pathname.match(/\/projects\/([^/]+)\/?$/);
  if (m) return decodeURIComponent(m[1]);
  const q = new URLSearchParams(window.location.search).get('slug');
  return q ? q.trim() : '';
}

const mount = document.querySelector('#project-mount');
initProjectDetail(mount, resolveSlug());
```

- [ ] **Step 5: Create `client/src/dom/projectDetail.js` (stub — fleshed out in Tasks 6–7)**

```js
export async function initProjectDetail(mountNode, slug) {
  if (!mountNode) return;
  mountNode.innerHTML = `<p class="project-detail__state">Loading… (${slug || 'no slug'})</p>`;
}
```

> Note: `pages/projects.js` imports `dom/projectsPage.js`, which is created in Task 4. To keep this task's build green, also create the stub below.

- [ ] **Step 6: Create `client/src/dom/projectsPage.js` (stub — fleshed out in Task 4)**

```js
export async function initProjectsPage(mountNode) {
  if (!mountNode) return;
  mountNode.innerHTML = `<p>Loading…</p>`;
}
```

- [ ] **Step 7: Create `client/src/styles/projects-page.css`**

```css
@import "./base.css";
@import "./components/projects.css";

.projects-page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 4rem 2rem 6rem;
}
.projects-page__back {
  display: inline-block;
  margin-bottom: 2rem;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.6);
}
.projects-page h1 {
  margin: 0 0 2rem;
}
```

- [ ] **Step 8: Create `client/src/styles/project.css`**

```css
@import "./base.css";

.project-detail {
  max-width: 820px;
  margin: 0 auto;
  padding: 4rem 2rem 6rem;
}
.project-detail__back {
  display: inline-block;
  margin-bottom: 2rem;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.6);
}
.project-detail__state {
  color: rgba(255, 255, 255, 0.6);
  padding: 4rem 2rem;
  text-align: center;
}
.project-detail__error {
  color: rgba(255, 110, 110, 0.85);
}
```

- [ ] **Step 9: Add entries to `client/vite.config.js`** — change the `input` block to:

```js
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
        project: resolve(__dirname, 'project.html'),
        projects: resolve(__dirname, 'projects.html'),
      },
```

- [ ] **Step 10: Add rewrites to `vercel.json`** — insert a `rewrites` array (place it before `"functions"`):

```json
  "rewrites": [
    { "source": "/projects", "destination": "/projects.html" },
    { "source": "/projects/:slug", "destination": "/project.html" }
  ],
```

Resulting `vercel.json`:

```json
{
  "framework": "vite",
  "installCommand": "npm install --prefix client",
  "buildCommand": "npm run build --prefix client",
  "outputDirectory": "client/dist",
  "rewrites": [
    { "source": "/projects", "destination": "/projects.html" },
    { "source": "/projects/:slug", "destination": "/project.html" }
  ],
  "functions": {
    "api/**/*.js": { "maxDuration": 10 }
  }
}
```

- [ ] **Step 11: Verify build** — `npm run build` → exit 0; confirm `client/dist/projects.html` and `client/dist/project.html` are emitted.

- [ ] **Step 12: Smoke** — `npm run dev`; open `http://localhost:5173/projects.html` (stub "Loading…") and `http://localhost:5173/project.html?slug=test` (stub shows the slug). No console errors.

- [ ] **Step 13: Commit**

```bash
git add client/projects.html client/project.html client/src/pages/projects.js client/src/pages/project.js client/src/dom/projectDetail.js client/src/dom/projectsPage.js client/src/styles/projects-page.css client/src/styles/project.css client/vite.config.js vercel.json
git commit -m "feat(projects): scaffold /projects + /projects/:slug routes and shells"
```

---

### Task 4: Listing page render

**Files:**
- Modify: `client/src/dom/projectsPage.js`

- [ ] **Step 1: Replace `client/src/dom/projectsPage.js` with the full implementation**

```js
import { supabase } from '../lib/supabase.js';
import { ProjectCard } from '../partials/ProjectCard.js';

export async function initProjectsPage(mountNode) {
  if (!mountNode) return;
  mountNode.innerHTML = `
    <div class="projects-page">
      <a class="projects-page__back" href="/">← Back to portfolio</a>
      <h1>Projects</h1>
      <ul id="projects-page-list" class="projects" aria-busy="true">
        <li class="projects__loading">Loading…</li>
      </ul>
    </div>
  `;
  const list = mountNode.querySelector('#projects-page-list');

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('published', true)
    .order('featured', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  list.removeAttribute('aria-busy');
  if (error) {
    list.innerHTML = `<li class="projects__error">Couldn't load projects — refresh to try again.</li>`;
    return;
  }
  const projects = data ?? [];
  if (!projects.length) {
    list.innerHTML = `<li class="projects__empty">No projects yet.</li>`;
    return;
  }
  list.innerHTML = projects.map(ProjectCard).join('');
}
```

- [ ] **Step 2: Verify build** — `npm run build` → exit 0.

- [ ] **Step 3: Smoke** — `npm run dev`, open `/projects.html`: back link, "Projects" heading, and a grid of all published projects. Each card image/title links to `/projects/<slug>`. No console errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/dom/projectsPage.js
git commit -m "feat(projects): render the /projects listing page"
```

---

### Task 5: Work section → featured teaser + "View all" link

**Files:**
- Modify: `client/src/dom/projectsList.js`, `client/src/components/Work.js`

- [ ] **Step 1: Replace `client/src/dom/projectsList.js` with the teaser implementation**

```js
import { supabase } from '../lib/supabase.js';
import { ProjectCard } from '../partials/ProjectCard.js';

export async function initProjectsList() {
  const list = document.querySelector('#projects-list');
  if (!list) return;

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('published', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  list.removeAttribute('aria-busy');
  if (error) {
    list.innerHTML = `<li class="projects__error">Couldn't load projects — refresh to try again.</li>`;
    return;
  }

  const all = data ?? [];
  const featured = all.filter((p) => p.featured);
  const teaser = featured.length ? featured : all.slice(0, 3);

  if (!teaser.length) {
    list.innerHTML = `<li class="projects__empty">No projects yet</li>`;
    return;
  }
  list.innerHTML = teaser.map(ProjectCard).join('');
}
```

- [ ] **Step 2: Add the "View all" link to `client/src/components/Work.js`** — replace the file with (note the heading is already "Work/Projects"):

```js
export const Work = () => `
  <section id="work" data-spin="work" class="section section--left">
    <div class="waypoint">
      <p class="eyebrow">03</p>
      <h2>Work/Projects</h2>
      <div class="divider"></div>
      <ul id="projects-list" class="projects" aria-busy="true">
        <li class="projects__loading">Loading…</li>
      </ul>
      <a class="projects__viewall" href="/projects">View all projects →</a>
    </div>
  </section>
`;
```

- [ ] **Step 3: Style `.projects__viewall` in `client/src/styles/components/projects.css`** — append at end:

```css
.projects__viewall {
  display: inline-block;
  margin-top: 1.5rem;
  font-size: 0.875rem;
  letter-spacing: 0.04em;
  color: rgba(255, 255, 255, 0.7);
}
.projects__viewall:hover {
  color: rgba(255, 255, 255, 0.95);
}
```

- [ ] **Step 4: Verify build** — `npm run build` → exit 0.

- [ ] **Step 5: Smoke** — `npm run dev`, main page Work section now shows only featured projects (or the 3 most recent if none are featured) and a "View all projects →" link. No console errors.

- [ ] **Step 6: Commit**

```bash
git add client/src/dom/projectsList.js client/src/components/Work.js client/src/styles/components/projects.css
git commit -m "feat(work): make Work section a featured teaser linking to /projects"
```

---

### Task 6: Detail page render (no gallery yet)

**Files:**
- Modify: `client/src/dom/projectDetail.js`, `client/src/styles/project.css`

- [ ] **Step 1: Replace `client/src/dom/projectDetail.js` with the detail implementation (gallery added in Task 7)**

```js
import { supabase } from '../lib/supabase.js';

export async function initProjectDetail(mountNode, slug) {
  if (!mountNode) return;
  mountNode.innerHTML = `<p class="project-detail__state">Loading…</p>`;

  if (!slug) {
    renderNotFound(mountNode);
    return;
  }

  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();

  if (error) {
    mountNode.innerHTML = `
      <div class="project-detail">
        <a class="project-detail__back" href="/">← Back to portfolio</a>
        <p class="project-detail__state project-detail__error">Couldn't load this project — refresh to try again.</p>
      </div>`;
    return;
  }
  if (!project) {
    renderNotFound(mountNode);
    return;
  }

  render(mountNode, project);
}

function renderNotFound(mountNode) {
  mountNode.innerHTML = `
    <div class="project-detail">
      <a class="project-detail__back" href="/">← Back to portfolio</a>
      <p class="project-detail__state">Project not found.</p>
    </div>`;
}

function render(mountNode, p) {
  const cover = p.screenshot_url
    ? `<img class="project-detail__cover" src="${esc(p.screenshot_url)}" alt="${esc(p.title)} screenshot" />`
    : `<div class="project-detail__cover project-detail__cover--fallback"></div>`;

  const links = [
    p.demo_url ? `<a href="${esc(p.demo_url)}" target="_blank" rel="noopener">Demo</a>` : '',
    p.repo_url ? `<a href="${esc(p.repo_url)}" target="_blank" rel="noopener">Code</a>` : '',
  ].filter(Boolean).join('');

  const desc = p.description
    ? `<div class="project-detail__desc">${paragraphs(p.description)}</div>`
    : '';

  const tech = p.tech_stack?.length
    ? `<ul class="project-detail__tech">${p.tech_stack.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`
    : '';

  mountNode.innerHTML = `
    <div class="project-detail">
      <a class="project-detail__back" href="/">← Back to portfolio</a>
      ${cover}
      <h1>${esc(p.title)}</h1>
      <p class="project-detail__summary">${esc(p.summary)}</p>
      ${links ? `<div class="project-detail__links">${links}</div>` : ''}
      ${desc}
      ${tech}
    </div>
  `;
}

function paragraphs(text) {
  return String(text)
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${esc(block).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
```

- [ ] **Step 2: Add detail styles to `client/src/styles/project.css`** — append at end:

```css
.project-detail__cover {
  width: 100%;
  border-radius: 12px;
  display: block;
  margin-bottom: 1.5rem;
}
.project-detail__cover--fallback {
  aspect-ratio: 16 / 9;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.01));
}
.project-detail h1 {
  margin: 0 0 0.5rem;
}
.project-detail__summary {
  color: rgba(255, 255, 255, 0.6);
  margin: 0 0 1.25rem;
}
.project-detail__links {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
}
.project-detail__links a {
  font-size: 0.8125rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.project-detail__desc {
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.85);
  margin-bottom: 2rem;
}
.project-detail__desc p {
  margin: 0 0 1rem;
}
.project-detail__tech {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.project-detail__tech li {
  font-size: 0.72rem;
  letter-spacing: 0.05em;
  background: rgba(255, 255, 255, 0.05);
  padding: 0.25rem 0.6rem;
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.78);
}
```

- [ ] **Step 3: Verify build** — `npm run build` → exit 0.

- [ ] **Step 4: Smoke** — `npm run dev`, open `project.html?slug=<a-published-slug>`: cover, title, summary, Demo/Code, description paragraphs, tech chips. Try `?slug=nope` → "Project not found." Try a draft slug → "Project not found." No console errors.

- [ ] **Step 5: Commit**

```bash
git add client/src/dom/projectDetail.js client/src/styles/project.css
git commit -m "feat(projects): render project detail page (cover, description, tech, links)"
```

---

### Task 7: Screenshot gallery + lightbox

**Files:**
- Modify: `client/src/dom/projectDetail.js`, `client/src/styles/project.css`

- [ ] **Step 1: Fetch screenshots and render the gallery in `projectDetail.js`.** In `initProjectDetail`, replace the final `render(mountNode, project);` line with:

```js
  let shots = [];
  const shotsRes = await supabase
    .from('project_screenshots')
    .select('*')
    .eq('project_id', project.id)
    .order('sort_order')
    .order('created_at');
  if (!shotsRes.error) shots = shotsRes.data ?? [];

  render(mountNode, project, shots);
```

- [ ] **Step 2: Update `render` to accept `shots` and include the gallery.** Change the `render` signature and add the gallery between `desc` and `tech`:

Change `function render(mountNode, p) {` to `function render(mountNode, p, shots) {`.

After the `const desc = ...` block, add:

```js
  const gallery = shots.length ? renderGallery(shots) : '';
```

In the template literal, insert `${gallery}` between `${desc}` and `${tech}`:

```js
      ${desc}
      ${gallery}
      ${tech}
```

At the end of `render` (after setting `mountNode.innerHTML`), add:

```js
  if (shots.length) attachLightbox(mountNode);
```

- [ ] **Step 3: Add `renderGallery` and `attachLightbox` to `projectDetail.js`** (place above `esc`):

```js
function renderGallery(shots) {
  return `
    <h2 class="project-detail__gallery-heading">Screenshots</h2>
    <ul class="project-detail__gallery">
      ${shots.map((s) => `
        <li class="project-detail__shot">
          <img src="${esc(s.url)}" alt="${esc(s.caption ?? '')}" loading="lazy"
               data-full="${esc(s.url)}" data-caption="${esc(s.caption ?? '')}" />
          ${s.caption ? `<span class="project-detail__caption">${esc(s.caption)}</span>` : ''}
        </li>
      `).join('')}
    </ul>
  `;
}

function attachLightbox(root) {
  const overlay = document.createElement('div');
  overlay.className = 'lightbox';
  overlay.hidden = true;
  overlay.innerHTML = `
    <button class="lightbox__close" type="button" aria-label="Close">×</button>
    <img class="lightbox__img" alt="" />
    <span class="lightbox__caption"></span>
  `;
  document.body.appendChild(overlay);
  const img = overlay.querySelector('.lightbox__img');
  const cap = overlay.querySelector('.lightbox__caption');

  const open = (src, caption) => {
    img.src = src;
    cap.textContent = caption || '';
    overlay.hidden = false;
  };
  const close = () => {
    overlay.hidden = true;
    img.removeAttribute('src');
  };

  root.querySelectorAll('.project-detail__shot img[data-full]').forEach((el) => {
    el.addEventListener('click', () => open(el.dataset.full, el.dataset.caption));
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.classList.contains('lightbox__close')) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.hidden) close();
  });
}
```

- [ ] **Step 4: Add gallery + lightbox styles to `client/src/styles/project.css`** — append at end:

```css
.project-detail__gallery-heading {
  font-size: 1.1rem;
  font-weight: 400;
  margin: 0 0 1rem;
}
.project-detail__gallery {
  list-style: none;
  padding: 0;
  margin: 0 0 2rem;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1rem;
}
.project-detail__shot img {
  width: 100%;
  border-radius: 8px;
  display: block;
  cursor: zoom-in;
}
.project-detail__caption {
  display: block;
  margin-top: 0.4rem;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.55);
}

.lightbox {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 2rem;
}
.lightbox[hidden] {
  display: none;
}
.lightbox__img {
  max-width: 90vw;
  max-height: 80vh;
  border-radius: 8px;
}
.lightbox__caption {
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.875rem;
}
.lightbox__close {
  position: absolute;
  top: 1.25rem;
  right: 1.5rem;
  background: none;
  border: none;
  color: #fff;
  font-size: 2rem;
  line-height: 1;
  cursor: pointer;
}
```

- [ ] **Step 5: Verify build** — `npm run build` → exit 0.

- [ ] **Step 6: Smoke** — needs gallery rows. Add 1–2 `project_screenshots` rows in Supabase Studio for a published project (use any public image URL for `url`, set `project_id`, `sort_order`). `npm run dev`, open that project's detail page: "Screenshots" grid with captions in order. Click an image → lightbox opens; overlay click, ×, and Esc all close it. No console errors. (Remove the test rows after.)

- [ ] **Step 7: Commit**

```bash
git add client/src/dom/projectDetail.js client/src/styles/project.css
git commit -m "feat(projects): add captioned screenshot gallery with lightbox"
```

---

### Task 8: Admin gallery management

**Files:**
- Modify: `client/src/admin/projectForm.js`

- [ ] **Step 1: Add the gallery section to the form markup.** In `renderProjectForm`, find the closing `</form>` in the template string. Immediately after `</form>`, insert:

```js
      ${isEdit
        ? `<section id="gallery-section" style="margin-top:32px; border-top:1px solid var(--border); padding-top:24px;"></section>`
        : `<p style="margin-top:24px; color:var(--muted); font-size:13px;">Save the project first, then re-open it to add screenshots.</p>`}
```

- [ ] **Step 2: Initialize the gallery after the form handlers are wired.** At the end of `renderProjectForm` (after the existing `mountNode.querySelector('#gh-fetch')...` listener), add:

```js
  if (isEdit) initGallery(mountNode, project.id);
```

- [ ] **Step 3: Add the gallery functions to `projectForm.js`** (place above the existing `function esc(s)`):

```js
let galleryRows = [];

async function initGallery(mountNode, projectId) {
  const section = mountNode.querySelector('#gallery-section');
  if (!section) return;
  section.innerHTML = `
    <h2 style="font-size:18px; margin:0 0 12px;">Screenshots gallery</h2>
    <div id="gallery-error"></div>
    <div id="gallery-list">Loading…</div>
    <div style="margin-top:12px;">
      <label for="gallery-files">Add screenshots (jpg/png/webp, max 5 MB each)</label>
      <input id="gallery-files" type="file" accept="image/jpeg,image/png,image/webp" multiple />
      <button type="button" id="gallery-upload" class="secondary" style="margin-top:8px;">Upload</button>
    </div>
  `;
  section.querySelector('#gallery-upload').addEventListener('click', () => handleGalleryUpload(mountNode, projectId));
  await loadGalleryList(mountNode, projectId);
}

async function loadGalleryList(mountNode, projectId) {
  const listEl = mountNode.querySelector('#gallery-list');
  const { data, error } = await supabase
    .from('project_screenshots')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order')
    .order('created_at');
  if (error) {
    listEl.innerHTML = `<p class="error">Failed to load gallery: ${esc(error.message)}</p>`;
    return;
  }
  galleryRows = data ?? [];
  if (!galleryRows.length) {
    listEl.innerHTML = `<p style="color:var(--muted)">No screenshots yet.</p>`;
    return;
  }
  listEl.innerHTML = galleryRows.map(galleryRowHtml).join('');
  listEl.querySelectorAll('button[data-action="save-shot"]').forEach((btn) => {
    btn.addEventListener('click', () => saveShot(mountNode, projectId, btn.dataset.id));
  });
  listEl.querySelectorAll('button[data-action="delete-shot"]').forEach((btn) => {
    btn.addEventListener('click', () => deleteShot(mountNode, projectId, btn.dataset.id, btn.dataset.url));
  });
}

function galleryRowHtml(s) {
  return `
    <div class="gallery-row" data-id="${s.id}" style="display:flex; gap:10px; align-items:center; margin-bottom:8px;">
      <img src="${esc(s.url)}" alt="" style="width:64px; height:40px; object-fit:cover; border-radius:3px;" />
      <input type="text" data-field="caption" placeholder="Caption" value="${esc(s.caption ?? '')}" style="flex:1;" />
      <input type="number" data-field="order" value="${s.sort_order}" style="width:70px;" />
      <button type="button" class="secondary" data-action="save-shot" data-id="${s.id}">Save</button>
      <button type="button" class="danger" data-action="delete-shot" data-id="${s.id}" data-url="${esc(s.url)}">Delete</button>
    </div>
  `;
}

async function saveShot(mountNode, projectId, id) {
  const row = mountNode.querySelector(`.gallery-row[data-id="${id}"]`);
  const caption = row.querySelector('[data-field="caption"]').value.trim();
  const sort_order = Number(row.querySelector('[data-field="order"]').value ?? 0) | 0;
  const errorBox = mountNode.querySelector('#gallery-error');
  const { error } = await supabase
    .from('project_screenshots')
    .update({ caption: caption || null, sort_order })
    .eq('id', id);
  if (error) {
    errorBox.innerHTML = `<p class="error">Save failed: ${esc(error.message)}</p>`;
    return;
  }
  errorBox.innerHTML = '';
  await loadGalleryList(mountNode, projectId);
}

async function deleteShot(mountNode, projectId, id, url) {
  if (!confirm('Delete this screenshot?')) return;
  const errorBox = mountNode.querySelector('#gallery-error');
  const { error } = await supabase.from('project_screenshots').delete().eq('id', id);
  if (error) {
    errorBox.innerHTML = `<p class="error">Delete failed: ${esc(error.message)}</p>`;
    return;
  }
  const m = String(url).match(/\/project-screenshots\/(.+)$/);
  if (m) {
    const cleanup = await supabase.storage.from('project-screenshots').remove([m[1]]);
    if (cleanup.error) console.warn('Screenshot file cleanup failed (non-fatal):', cleanup.error.message);
  }
  await loadGalleryList(mountNode, projectId);
}

async function handleGalleryUpload(mountNode, projectId) {
  const input = mountNode.querySelector('#gallery-files');
  const errorBox = mountNode.querySelector('#gallery-error');
  errorBox.innerHTML = '';
  const files = [...(input.files ?? [])];
  if (!files.length) return;

  const slug = (mountNode.querySelector('#slug')?.value || 'project').trim() || 'project';
  const baseOrder = galleryRows.length ? Math.max(...galleryRows.map((r) => r.sort_order)) + 1 : 0;

  const failures = [];
  let added = 0;
  for (const file of files) {
    if (file.size > 5 * 1024 * 1024) { failures.push(`${file.name} (too large)`); continue; }
    const ext = extFromMime(file.type);
    if (!ext) { failures.push(`${file.name} (unsupported type)`); continue; }
    const filename = `${slug}-${Date.now()}-${added}.${ext}`;
    const up = await supabase.storage.from('project-screenshots').upload(filename, file, { contentType: file.type });
    if (up.error) { failures.push(`${file.name} (${up.error.message})`); continue; }
    const url = supabase.storage.from('project-screenshots').getPublicUrl(filename).data.publicUrl;
    const ins = await supabase.from('project_screenshots').insert({
      project_id: projectId,
      url,
      caption: null,
      sort_order: baseOrder + added,
    });
    if (ins.error) { failures.push(`${file.name} (${ins.error.message})`); continue; }
    added += 1;
  }
  if (failures.length) {
    errorBox.innerHTML = `<p class="error">Some uploads failed: ${esc(failures.join(', '))}</p>`;
  }
  input.value = '';
  await loadGalleryList(mountNode, projectId);
}
```

(`extFromMime` and `esc` already exist in `projectForm.js` — reuse them; do not redeclare.)

- [ ] **Step 4: Verify build** — `npm run build` → exit 0.

- [ ] **Step 5: Smoke** — `npm run dev`, `/admin.html` → sign in → edit a published project → "Screenshots gallery" section: upload 2 images, set captions + order, Save; reload the project's detail page (`project.html?slug=<slug>`) → images appear in order with captions. Delete one → gone after refresh. Open the form for a NEW project → it shows the "save first" note instead of the gallery. No console errors.

- [ ] **Step 6: Commit**

```bash
git add client/src/admin/projectForm.js
git commit -m "feat(admin): manage project screenshot gallery in the project form"
```

---

### Task 9: Update `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the `dom/` bullet** — change it to add the two new modules:

Old:
```
- `dom/` — DOM-only behavior (no Three.js, no markup): `sectionObserver.js`
  (dot active-state + section fade-in), `contactForm.js` (contact form
  state machine + fetch to `/api/contact`), `projectsList.js` (public
  projects fetch from Supabase + tag-pill filtering), `skillsList.js`
  (public Skills section: union of skills table + project tech_stack/tags,
  tab strip + icon-card grid).
```

New:
```
- `dom/` — DOM-only behavior (no Three.js, no markup): `sectionObserver.js`
  (dot active-state + section fade-in), `contactForm.js` (contact form
  state machine + fetch to `/api/contact`), `projectsList.js` (Work-section
  featured teaser), `projectsPage.js` (the `/projects` full listing),
  `projectDetail.js` (the `/projects/<slug>` detail page + screenshot
  lightbox), `skillsList.js` (public Skills section: admin-managed skills
  table, tab strip + icon-card grid).
```

- [ ] **Step 2: Add a `partials/` note + `pages/` update.** Find the `partials/` bullet:

Old:
```
- `partials/` — small reusable HTML atoms (buttons, cards, badges).
  Empty for now; documented in its README.
```

New:
```
- `partials/` — small reusable HTML atoms. `ProjectCard.js` renders the
  shared project card used by both the Work teaser and the `/projects`
  listing (links to the detail page).
```

Find the `pages/` bullet:

Old:
```
- `pages/` — multi-page Vite entries. `admin.js` boots `admin.html`,
  initializes admin auth + dashboard. No Three.js on this page.
```

New:
```
- `pages/` — multi-page Vite entries. `admin.js` boots `admin.html`;
  `projects.js` boots `projects.html` (the `/projects` listing);
  `project.js` boots `project.html` (the `/projects/<slug>` detail page).
  No Three.js on these pages.
```

- [ ] **Step 3: Add a Recently shipped entry** — insert at the top of `## Recently shipped`:

```
- **Project pages** (2026-05-25) — Added a `/projects` listing page and
  per-project `/projects/<slug>` detail pages (cover, full description,
  captioned screenshot gallery with lightbox, tech, links), both pretty
  routes via `vercel.json` rewrites. The main-page Work section became a
  featured teaser linking to `/projects`, and a shared `partials/
  ProjectCard.js` renders cards in both. New `project_screenshots` table
  (published-gated RLS) with admin gallery management in the project form.
  Spec: `docs/superpowers/specs/2026-05-25-project-detail-page-design.md`.
  Plan: `docs/superpowers/plans/2026-05-25-project-pages.md`.
```

- [ ] **Step 4: Verify build** — `npm run build` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: mark project pages shipped in CLAUDE.md"
```

---

## Self-Review

**Spec coverage:**
- `project_screenshots` table + RLS → Task 1 ✓
- Shared `ProjectCard` → Task 2 ✓
- Routing (`project.html`/`projects.html`, vite entries, vercel rewrites, slug resolution) → Task 3 ✓ (slug resolution in `pages/project.js`)
- Listing page → Task 4 ✓
- Work teaser (featured/fallback) + "View all" → Task 5 ✓
- Detail page (cover/title/summary/links/description/tech, states) → Task 6 ✓
- Gallery + lightbox → Task 7 ✓
- Admin gallery (edit-mode, upload/caption/order/delete, new-project note) → Task 8 ✓
- Description as plain-text paragraphs → Task 6 `paragraphs()` ✓
- CLAUDE.md → Task 9 ✓

**Placeholder scan:** No TBDs; every code step has full code. The Task 3 stub modules are intentional, build-green scaffolds replaced in full by Tasks 4 and 6.

**Type/name consistency:**
- `ProjectCard` (Task 2) imported in `projectsList.js` (Tasks 2, 5) and `projectsPage.js` (Task 4) — matches.
- `initProjectsPage(mountNode)` defined Task 3 (stub) / Task 4 (full); called in `pages/projects.js` (Task 3) — matches.
- `initProjectDetail(mountNode, slug)` defined Task 3 (stub) / Tasks 6–7 (full); called in `pages/project.js` (Task 3) — matches.
- `render(mountNode, p)` (Task 6) → `render(mountNode, p, shots)` (Task 7): Task 7 Step 2 explicitly updates the signature + callsite — consistent.
- `project_screenshots` columns (`project_id`, `url`, `caption`, `sort_order`) identical across schema (Task 1), detail fetch (Task 7), and admin (Task 8).
- Storage bucket `project-screenshots` reused in Task 8 (matches the existing cover-upload bucket).
