# Project Pages: Listing + Detail + Screenshot Gallery — Design (2026-05-25)

**Date:** 2026-05-25
**Status:** Draft (pending user spec review)
**Owner:** John Kyle Camson

## Goal

Give projects a real structure beyond the single summary-only card on the front page:

1. A dedicated **`/projects` listing page** showing every published project (the full list).
2. A per-project **detail page at `/projects/<slug>`** surfacing the full story — long-form description, multiple captioned screenshots, tech stack, and links.
3. The main-page **Work section becomes a featured teaser** that shows a few featured projects and links to `/projects`, keeping the 3D scroll journey intact.

One data-driven template renders every detail page; nothing is hand-built per project. Project cards are shared across the teaser and the listing page.

This is **Part C** of the projects/skills polish work. Parts A (skills admin-only) and B (remove tag filter bar) already shipped.

## Why this shape

- The `projects` table already stores a long-form `description` that the front page never shows — the detail page mostly surfaces data that already exists.
- Shareable per-project URLs are useful when linking a specific project from a resume or job application (a stated user goal).
- A single `project.html` template keyed on the slug means zero per-project maintenance.
- Multiple screenshots need a place to live; a child table keeps ordering + captions clean without bloating the `projects` row.

## Non-goals

- **No markdown** in descriptions — plain-text paragraphs only (decided 2026-05-25). A markdown renderer + sanitizer is deferred.
- **No drag-and-drop reordering** — screenshots order via a numeric field, consistent with `projects.sort_order` and `skills.sort_order`.
- **No separate structured "features" list field** — the description (prose) covers features. A dedicated field can come later.
- **No tech filter anywhere** — the `/projects` page ships as a plain full list (decided 2026-05-25); the Work teaser is filter-free too. (This supersedes the broader plan's "filter by technology" item.)
- **No 3D scene** on the detail or listing pages — they're lightweight static pages (faster load).
- **No multi-screenshot on the project card** — cards (teaser + listing) still show only the single cover image; the gallery is detail-page only.

## Schema

Add to `supabase/schema.sql` (Studio is source of truth; the file is the committed reference). The user applies the SQL in Studio before deploy, same as the skills table.

```sql
-- Project screenshots gallery (added 2026-05-25). One row per additional
-- screenshot on a project's detail page. The project's cover image stays
-- in projects.screenshot_url; these are the extra gallery shots.

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

-- Public can read a screenshot only when its parent project is published.
create policy "public reads screenshots of published projects"
  on project_screenshots for select
  using (exists (
    select 1 from projects p
    where p.id = project_screenshots.project_id
      and p.published = true
  ));

-- Owner can read all (incl. drafts) and write.
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

Notes:
- `on delete cascade` — deleting a project removes its screenshot rows automatically. (Storage files are cleaned best-effort by the admin delete handler; orphaned files in the bucket are a tolerated v1 trade-off, matching the existing cover-image behavior.)
- The public-read policy name differs from the storage policy `"owner inserts screenshots"` already in the file — no collision (different objects).
- Cover image stays `projects.screenshot_url`. The gallery is purely additive.

## Storage

Reuse the existing `project-screenshots` bucket. Gallery files need unique names (the cover uses `<slug>.<ext>`, which would collide). Use:

```
<slug>-<timestamp>.<ext>     e.g.  my-app-1716620000000.webp
```

Public URL via `supabase.storage.from('project-screenshots').getPublicUrl(filename)`, stored in `project_screenshots.url`.

## Routing

Two pretty routes in production, with robust fallbacks:

- `/projects` → the listing page (`projects.html`).
- `/projects/<slug>` → the detail page (`project.html`).

**Vercel rewrites** (add to `vercel.json`):
```json
"rewrites": [
  { "source": "/projects", "destination": "/projects.html" },
  { "source": "/projects/:slug", "destination": "/project.html" }
]
```
The exact `/projects` rewrite and the `/projects/:slug` (one-segment) rewrite don't overlap. Neither affects `/`, `/admin`, or `/api/**`.

**Link targets:** the Work teaser's "View all projects →" links to `/projects`; each project card links to `/projects/<slug>`.

**Slug resolution in JS** (detail page): read the slug from the path segment after `/projects/`; if absent, fall back to the `?slug=` query param. So `project.html?slug=my-app` works for plain `vite` dev (`npm run dev`), where rewrites aren't active. `vercel dev` (`npm run dev:full`) and production apply the rewrites, so `/projects` and `/projects/<slug>` resolve there. For plain `vite` dev, the listing is reachable directly at `/projects.html` (the teaser link still points at `/projects` — a known dev-only difference).

## New files

- `client/project.html` — slim detail-page shell (like `admin.html`): `<head>` with title + stylesheet link, `<body>` with a mount node + module script. No Three.js, no canvas.
- `client/projects.html` — slim listing-page shell, same pattern.
- `client/src/pages/project.js` — detail entry; reads the slug, calls `initProjectDetail(mountNode, slug)`.
- `client/src/pages/projects.js` — listing entry; calls `initProjectsPage(mountNode)`.
- `client/src/dom/projectDetail.js` — detail fetch + render + lightbox. Pure DOM, no Three.js.
- `client/src/dom/projectsPage.js` — listing fetch (all published) + render via the shared card. Pure DOM.
- `client/src/partials/ProjectCard.js` — `export const ProjectCard = (p) => \`…\``: the single source of project-card markup, used by the Work teaser and the listing page. Escapes all DB values; cover + title link to `/projects/<slug>`; Demo/Code are direct external links. (Lives in `partials/` per AGENTS.md — the documented home for reusable HTML atoms.)
- `client/src/styles/project.css` — `@import "./base.css";` + detail-page + gallery + lightbox styles.
- `client/src/styles/projects-page.css` — `@import "./base.css"; @import "./components/projects.css";` (reuse the card/grid vocabulary) + listing-page header/layout.

## Modified files

- `client/vite.config.js` — add `project` and `projects` entries to `build.rollupOptions.input`.
- `vercel.json` — add the two `rewrites` above.
- `supabase/schema.sql` — append the `project_screenshots` block.
- `client/src/dom/projectsList.js` — Work section becomes the **featured teaser**: fetch featured projects (fallback to the 3 most recent if none featured), render via `ProjectCard`, no filter. (Removes its local `card()` in favor of the shared partial.)
- `client/src/components/Work.js` — add a `View all projects →` link to `/projects` below the list. (The heading is already "Work/Projects".)
- `client/src/admin/projectForm.js` — add a "Screenshots gallery" section (edit-mode only).
- `client/src/styles/components/projects.css` — add `.projects__viewall` link style; confirm `.projects__card`/`.projects__media` hover still applies now that the media is an internal link.

## Public detail page

**Data flow** (`dom/projectDetail.js`):
1. Resolve slug (path, then `?slug=`). If none → render the not-found state.
2. Fetch the project by slug:
   ```js
   const { data: project, error } = await supabase
     .from('projects').select('*')
     .eq('slug', slug).eq('published', true)
     .maybeSingle();
   ```
   - `error` → error state. No project (unknown or unpublished slug) → not-found state.
3. Once the project resolves, fetch its screenshots by id:
   ```js
   const { data: shots } = await supabase
     .from('project_screenshots').select('*')
     .eq('project_id', project.id)
     .order('sort_order').order('created_at');
   ```
   - A screenshot fetch error is non-fatal — render the project without the gallery rather than failing the whole page.
4. Render the page; wire the lightbox.

**Layout** (single centered column, dark theme from `base.css`):
- Back link: `← Back to portfolio` → `/`.
- Cover hero: `projects.screenshot_url` (or a neutral fallback block if null).
- Title (`title`), summary (`summary`).
- Links row: Demo (`demo_url`) + Code (`repo_url`), shown only when present.
- Description: `description` rendered as plain-text paragraphs — split on blank lines into `<p>`, single newlines become `<br>`, all text escaped. If `description` is null/empty, the section is omitted.
- Screenshots: heading + a responsive grid of the gallery images in `sort_order`, each with its caption beneath. Omitted entirely if there are no gallery rows.
- Tech stack: the `tech_stack` chips (reuse the `.projects__tech` styling vocabulary).

**Lightbox:** clicking any gallery image opens a fixed dark overlay showing the image large + its caption. Close on overlay click, on a close (×) button, or on `Esc`. Vanilla JS, no library. Only one overlay element, reused.

**States:**
- Loading: a simple "Loading…" line in the mount node before data resolves.
- Not-found (unknown/unpublished/missing slug): "Project not found." + a back link to `/`.
- Error (fetch failed): "Couldn't load this project — refresh to try again." + back link.

## Shared project card (`partials/ProjectCard.js`)

Single source of card markup, used by the teaser and the listing page:
- Cover media `<a>` and the title link to `/projects/${slug}` (was: cover → demo/repo).
- Keep Demo and Code in the links row as direct external links.
- Show `tech_stack` chips (unchanged vocabulary). Cover falls back to the neutral block when `screenshot_url` is null.
- Escape every DB value, including the slug in the URL.

## Projects listing page (`/projects`)

- `projects.html` + `pages/projects.js` + `dom/projectsPage.js`. No 3D scene.
- `initProjectsPage(mountNode)` fetches **all** published projects (`published=true`, ordered `featured desc, sort_order asc, created_at desc`) and renders a header ("Projects" + a back-to-home link) plus a grid of `ProjectCard`s. No filter.
- States: loading / empty ("No projects yet.") / error ("Couldn't load projects — refresh to try again.").

## Work section → featured teaser

- `components/Work.js`: keep the section + heading ("Work/Projects"); the `#projects-list` `<ul>` stays; add a `View all projects →` link (`<a class="projects__viewall" href="/projects">`) after the list.
- `dom/projectsList.js` (`initProjectsList`): fetch **featured** projects (`published=true and featured=true`, ordered `sort_order asc, created_at desc`). If none are featured, fall back to the 3 most-recent published. Render via `ProjectCard`. No filter logic remains.
- The teaser and the listing page share `ProjectCard`, so a card looks identical in both places and both link to the detail page.

## Admin gallery management

In `client/src/admin/projectForm.js`, add a "Screenshots gallery" section that appears **only in edit mode** (a `project_id` must exist to attach rows; for a new project, the user saves first, then re-opens it to manage the gallery). The section:

- **Existing rows:** for each `project_screenshots` row of this project (ordered), show a small thumbnail, a caption text input, a numeric order input, and a Delete button.
  - Caption / order edits save via `supabase.from('project_screenshots').update(...)` (on blur or via a small "Save" affordance — the plan picks the simplest reliable trigger).
  - Delete: `confirm("Delete this screenshot?")` → delete the row, then best-effort `storage.remove([filename])` parsed from the URL, then refresh the list.
- **Add new:** a multi-file `<input type="file" accept="image/jpeg,image/png,image/webp" multiple>` + an "Upload" button. For each selected file: validate type + size (≤5 MB, same as the cover), upload to `project-screenshots` with a unique `<slug>-<timestamp>.<ext>` name, then insert a `project_screenshots` row (`project_id`, `url`, `caption=''`, `sort_order` = current max + 1). Refresh the list.
- Errors surface inline in the existing `#form-error` area (or a section-local error node).

The existing single cover-image upload (`projects.screenshot_url`) is unchanged.

## Description rendering helper

Plain-text → safe HTML, shared by the detail page:
- Split on `\n\s*\n` into paragraphs.
- Within a paragraph, escape `& < > " '`, then replace single `\n` with `<br>`.
- Join as `<p>…</p>` blocks. Empty input → render nothing.

## Error handling & edge cases

- **Unpublished or unknown slug:** not-found state (RLS + the `published=true` filter both enforce this; an unpublished project's screenshots are also hidden by RLS).
- **No cover image:** detail hero shows the neutral fallback block (same vocabulary as the Work card fallback).
- **No description:** description section omitted.
- **No gallery rows:** screenshots section omitted.
- **Broken gallery image URL:** `<img>` `onerror` hides that image (or swaps to a neutral placeholder) — consistent with the skills icon-fallback approach.
- **Gallery upload partial failure:** if one file in a multi-upload fails, report which failed and keep the successes; don't abort the whole batch silently.
- **Direct visit to `project.html` with no slug:** not-found state.

## Verification (manual smoke tests)

1. `/projects` lists all published projects as cards; each card's image/title opens its detail page; Demo/Code open external links.
2. Main-page Work section shows the featured teaser (featured projects, or 3 most-recent if none featured) + a "View all projects →" link that goes to `/projects`.
3. `/projects/<published-slug>` renders: back link, cover, title, summary, Demo/Code (when set), description paragraphs, gallery with captions in order, tech chips.
4. Clicking a gallery image opens the lightbox; overlay/✕/Esc all close it.
5. `/projects/<draft-slug>` and `/projects/<nonexistent>` → "Project not found."
6. A project with no description / no gallery → those sections are cleanly omitted (no empty headings).
7. Plain `npm run dev`: listing at `/projects.html`, detail at `project.html?slug=<slug>`. `vercel dev` / production: `/projects` and `/projects/<slug>` resolve via rewrites.
8. Admin → edit a project → Screenshots gallery: upload 2–3 images, set captions + order, save; they appear on the detail page in order. Delete one → gone after refresh.
9. New project: gallery section explains it's available after first save; save, re-open, gallery is usable.
10. Non-owner cannot read draft-project screenshots (RLS); owner can manage all.
11. `npm run build` exits 0.

## Implementation order (high level)

1. Schema — `project_screenshots` table + RLS (+ apply in Studio).
2. Shared `partials/ProjectCard.js` — extract card markup (links to detail page); rewire the existing teaser to use it (keeps the main page working).
3. Routing scaffold — `project.html` + `projects.html`, `pages/project.js` + `pages/projects.js`, `vite.config.js` entries, `vercel.json` rewrites, `styles/project.css` + `styles/projects-page.css` shells.
4. Listing page — `dom/projectsPage.js`: fetch all published, render the grid, states.
5. Work teaser — `dom/projectsList.js`: featured/fallback fetch + render; add "View all projects →" link in `Work.js`.
6. Detail page — `dom/projectDetail.js`: slug resolve, fetch project + screenshots, render (cover/title/summary/links/description/tech), states.
7. Gallery render + lightbox on the detail page.
8. Admin gallery management in `projectForm.js`.
9. CLAUDE.md update (new files + mark shipped).

Each step builds and is visually testable in dev.
