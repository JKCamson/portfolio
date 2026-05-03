# Projects Showcase — Design

**Date:** 2026-05-01
**Status:** Approved (pending spec review)
**Owner:** John Kyle Camson

## Goal

Replace the hardcoded `<ul>` in `client/src/components/Work.js` with a real,
DB-backed projects showcase. The owner manages projects through a custom admin
dashboard at `/admin` (no SQL required). Public visitors browse the projects
list with tag-pill filtering, screenshots, demo/repo links, and per-project
metadata. All four sub-projects (read-only list, admin CRUD, image uploads,
filtering) ship together as one feature.

This is the second feature using the backend half of the stack and the first
to use Supabase. It establishes the patterns (Supabase client, RLS gating,
multi-page Vite, admin auth) that future features (analytics dashboard, AI
chat memory, blog) will reuse.

## Non-Goals

- **No image processing pipeline.** Owner uploads what they want shown. No
  resize/compress on the fly. (Listed in roadmap as a future feature.)
- **No image gallery per project (v1).** Single screenshot per project. Schema
  uses `screenshot_url text` (singular). Migrating to a gallery later is
  additive (separate `project_images` table).
- **No SSR / static generation.** This is a Vite SPA; the projects list fetches
  on page load. SEO impact accepted for v1.
- **No search bar (v1).** Tag pills only. Search arrives if/when the project
  count makes pills insufficient.
- **No multi-user admin.** Single owner (`jkylecadap@gmail.com`). RLS gates by
  exact email match.
- **No client-side router.** Multi-page Vite serves `index.html` and
  `admin.html` as separate static entry points.
- **No automated tests.** Verification is manual, matching the rest of the
  repo. A test suite can come later.
- **No orphan-image cleanup on row delete.** Deleting a project row leaves the
  Storage file in place. Re-uploading or changing slug *does* clean up the
  superseded file. Bulk cleanup is a future maintenance task, not a v1
  feature.

## Locked Decisions (from brainstorming)

| # | Decision | Choice |
|---|---|---|
| 1 | Backend provider | Supabase (Postgres + Auth + Storage from one provider) |
| 2 | Admin route | Separate `/admin` page via multi-page Vite (`client/admin.html`); no Three.js scene there |
| 3 | Auth method | GitHub OAuth, single provider. Picked for security (knowing the email is not enough; attacker would need GitHub account access with 2FA). Multi-provider rejected as added attack surface. |
| 4 | Schema | Includes `tech_stack text[]` and `tags text[]` as separate columns (display vs. filtering). Adds `featured boolean` for pinning. |
| 5 | Image storage | Single screenshot per project. One Supabase Storage bucket `project-screenshots`, public-read, slug-keyed filenames. |
| 6 | Filtering UX | Tag pills, single-select, with leading `All` pill. Client-side filtering of pre-fetched array. |
| 7 | Frontend↔Supabase | Direct browser → Supabase JS client. No new `/api/` routes. RLS does all gating. Existing `/api/contact` stays. |

## Architecture

### File layout (after this feature lands)

```
portfolio/
├── api/                                      ← unchanged (existing /api/contact)
├── client/
│   ├── index.html                            ← unchanged (public site entry)
│   ├── admin.html                            ← NEW (admin entry point)
│   ├── vite.config.js                        ← updated (multi-page rollup input)
│   └── src/
│       ├── main.js                           ← +1 line: initProjectsList()
│       ├── lib/
│       │   └── supabase.js                   ← NEW (single shared client)
│       ├── components/
│       │   └── Work.js                       ← updated (empty containers + loading state)
│       ├── dom/
│       │   └── projectsList.js               ← NEW (fetch + render + pill filter)
│       ├── pages/
│       │   └── admin.js                      ← NEW (admin entry, mounted by admin.html)
│       ├── admin/                            ← NEW (admin-only modules)
│       │   ├── auth.js                       ← GitHub OAuth + session check
│       │   ├── dashboard.js                  ← list view + edit view state machine
│       │   ├── projectForm.js                ← create/edit form + image upload
│       │   └── styles/admin.css              ← admin-only styles, no scene
│       └── styles/components/projects.css    ← updated (cards + pills)
├── supabase/
│   └── schema.sql                            ← NEW (committed reference; Supabase is source of truth)
├── docs/
└── .env.example                              ← updated (adds SUPABASE keys)
```

The empty `client/src/pages/` directory (currently a placeholder with only a
README) gets its first real file. Same for `client/src/admin/` (new).

### Two browser entry points (multi-page Vite)

- `client/index.html` — existing portfolio site (scroll scene + sections).
- `client/admin.html` — new, no Three.js. Mounts the admin dashboard.

URL split in production:
- `portfolio.jkylec.dev/` → public site.
- `portfolio.jkylec.dev/admin` → admin dashboard. Vercel serves `admin.html`
  from the static build directly — no special routing needed because Vite's
  multi-page build emits `dist/admin.html` and Vercel serves it for the
  `/admin` path.

### Why a separate admin page (not a route inside the SPA)

- The public site is heavy (Three.js, textures, scroll scene). The admin
  dashboard has no need for any of it; loading it on `/admin` would be wasteful
  and slow down the dashboard with unrelated assets.
- A separate entry keeps the public bundle from growing every time the admin
  grows. Code paths don't tangle.
- Aligns with the existing convention: `dom/` modules and `components/` are
  for the public site. Admin-only code lives in `admin/`, isolated from the
  scroll-scene code path entirely.

### Why direct browser → Supabase (not via `/api/`)

- The Supabase anon key is **public-by-design** (it goes into the client
  bundle). Security is enforced by RLS on the database, not by hiding the key.
- `vite dev` works on `localhost` for the entire feature (no `vercel dev`
  needed). This is a meaningful improvement over the contact-form workflow.
- Errors surface in the browser console + Supabase dashboard logs in real
  time — better debuggability than serverless function logs.
- The existing `/api/contact` route is untouched — it makes sense for
  email-sending (secret API keys). Projects-CRUD doesn't need that pattern.
- Picking direct-client doesn't lock us out of `/api/`. Future features that
  genuinely need server-side secrets (webhooks, cron, hidden keys) can still
  go in `api/`.

## Data model

### `projects` table

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | primary key, default `gen_random_uuid()` | Supabase default |
| `slug` | `text` | unique, not null | URL-safe identifier, e.g. `portfolio-site`. Used as Storage filename root. |
| `title` | `text` | not null | Display name |
| `summary` | `text` | not null | 1–2 sentence blurb for the card view |
| `description` | `text` | nullable | Long-form for future detail / expanded view |
| `tech_stack` | `text[]` | default `'{}'` | e.g. `['Three.js', 'Vite', 'Supabase']`. Display only, not filtered. |
| `tags` | `text[]` | default `'{}'` | Filter categories, e.g. `['web', '3d']` |
| `demo_url` | `text` | nullable | Live deploy link |
| `repo_url` | `text` | nullable | GitHub link |
| `screenshot_url` | `text` | nullable | Public Supabase Storage URL |
| `sort_order` | `int` | default `0` | Manual ordering on public list (lower = earlier) |
| `featured` | `boolean` | not null, default `false` | Featured projects render before others |
| `published` | `boolean` | not null, default `false` | Drafts (`false`) hidden from public site |
| `created_at` | `timestamptz` | not null, default `now()` | |
| `updated_at` | `timestamptz` | not null, default `now()` | Auto-updated by trigger on update |

Default ordering on the public list:
`order by featured desc, sort_order asc, created_at desc`.

### Schema SQL (committed in `supabase/schema.sql`)

```sql
create table projects (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,
  title           text not null,
  summary         text not null,
  description     text,
  tech_stack      text[] not null default '{}',
  tags            text[] not null default '{}',
  demo_url        text,
  repo_url        text,
  screenshot_url  text,
  sort_order      int not null default 0,
  featured        boolean not null default false,
  published       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index projects_published_idx on projects (published);
create index projects_sort_idx on projects (featured desc, sort_order asc);

-- updated_at auto-bump
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger projects_set_updated_at
  before update on projects
  for each row execute function set_updated_at();

alter table projects enable row level security;

-- public read: only published projects
create policy "public reads published projects"
  on projects for select
  using (published = true);

-- owner sees everything (incl. drafts)
create policy "owner reads all projects"
  on projects for select
  using (auth.email() = '<OWNER_EMAIL>');

-- owner-only writes
create policy "owner inserts projects"
  on projects for insert
  with check (auth.email() = '<OWNER_EMAIL>');

create policy "owner updates projects"
  on projects for update
  using (auth.email() = '<OWNER_EMAIL>')
  with check (auth.email() = '<OWNER_EMAIL>');

create policy "owner deletes projects"
  on projects for delete
  using (auth.email() = '<OWNER_EMAIL>');
```

The committed `schema.sql` is a **reference copy** for review. Supabase
Studio is the source of truth — the file is updated by hand when the live
schema changes. No migration framework in v1.

### Storage bucket: `project-screenshots`

- **Public bucket** — read access via plain URL, no signed URLs.
- File size limit: **5 MB**.
- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`.
- Layout: one file per project, named `<slug>.<ext>`. No subfolders.
- Re-uploading for the same project overwrites the existing file via
  `upsert: true`. Slug-rename triggers an explicit `remove([oldFilename])`
  after a successful new upload.

### Storage RLS

```sql
-- public read
create policy "public reads screenshots"
  on storage.objects for select
  using (bucket_id = 'project-screenshots');

-- owner-only writes
create policy "owner inserts screenshots"
  on storage.objects for insert
  with check (bucket_id = 'project-screenshots'
              and auth.email() = '<OWNER_EMAIL>');

create policy "owner updates screenshots"
  on storage.objects for update
  using (bucket_id = 'project-screenshots'
         and auth.email() = '<OWNER_EMAIL>');

create policy "owner deletes screenshots"
  on storage.objects for delete
  using (bucket_id = 'project-screenshots'
         and auth.email() = '<OWNER_EMAIL>');
```

## Component responsibilities

### `client/src/lib/supabase.js`

Single shared client instance, imported by both public-site and admin code:

```js
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);
```

Both keys are read from project-root `.env` via the existing `envDir: '..'`
config in `vite.config.js`. The `VITE_` prefix exposes them to the client
bundle (intentional for the anon key).

### `client/src/components/Work.js`

Stays a thin template function. Renders empty containers + a loading state:

```html
<section id="work" data-spin="work" class="section section--left">
  <div class="waypoint">
    <p class="eyebrow">03</p>
    <h2>Work</h2>
    <div class="divider"></div>
    <div id="projects-pills"></div>
    <ul id="projects-list" class="projects" aria-busy="true">
      <li class="projects__loading">Loading…</li>
    </ul>
  </div>
</section>
```

No data fetching here. Following the existing `components/` convention:
markup-only, no behavior.

### `client/src/dom/projectsList.js`

DOM-only behavior — same category as `dom/contactForm.js` and
`dom/sectionObserver.js`. Exports `initProjectsList()` called once from
`main.js` after sections mount.

Module state:

```js
let projects = [];   // full fetched array, in display order
let activeTag = null; // null = "All"
```

Responsibilities:
1. **Fetch on init** —
   ```js
   const { data, error } = await supabase
     .from('projects')
     .select('*')
     .eq('published', true)
     .order('featured', { ascending: false })
     .order('sort_order', { ascending: true });
   ```
   On error, render error state and stop.
2. **Render pills** — compute `[...new Set(projects.flatMap(p => p.tags))]`,
   render `All` + one pill per tag into `#projects-pills`. Hide the pill bar
   if the tag set is empty. Pills are `<button>` elements with
   `aria-pressed`.
3. **Render list** — pure function `renderList(activeTag)` that filters
   `projects` by tag (`tag === null` shows all) and writes the resulting
   `<li>` cards into `#projects-list`. Removes `aria-busy`.
4. **Click handler** — single delegated listener on `#projects-pills` updates
   `activeTag` and calls `renderList(activeTag)`. Clicking the active pill
   resets to `All`.

Card markup (each project):

```html
<li class="projects__card">
  <a href="${demo_url ?? repo_url}" class="projects__media" target="_blank" rel="noopener">
    <img src="${screenshot_url}" alt="${title} screenshot" loading="lazy" />
  </a>
  <h3>${title}</h3>
  <p>${summary}</p>
  <ul class="projects__tech">
    ${tech_stack.map(t => `<li>${t}</li>`).join('')}
  </ul>
  <div class="projects__links">
    ${demo_url ? `<a href="${demo_url}" target="_blank" rel="noopener">Demo</a>` : ''}
    ${repo_url ? `<a href="${repo_url}" target="_blank" rel="noopener">Code</a>` : ''}
  </div>
</li>
```

All user-supplied strings rendered through a small `escapeHtml(str)` helper
(co-located in `projectsList.js`) before interpolation. The admin flow trusts
input minimally; defense in depth on the public render.

Card layout reserves a fixed aspect ratio for the image to prevent layout
shift while it loads. Falls back to a placeholder background if
`screenshot_url` is null.

States:
| State | UI | Trigger |
|---|---|---|
| loading | `<li class="projects__loading">Loading…</li>`, `aria-busy="true"` | Default |
| empty | `<li class="projects__empty">No projects yet</li>` | Fetch returns `[]` |
| filtered-empty | "No projects match this filter" + reset button | Active tag has zero matches |
| populated | Cards rendered | Fetch returns ≥ 1 row |
| error | "Couldn't load projects — refresh to try again" | Fetch error |

### `client/admin.html`

Bare HTML, no scene, no portfolio nav:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Admin — Portfolio</title>
    <link rel="stylesheet" href="/src/admin/styles/admin.css" />
  </head>
  <body>
    <div id="admin-mount"></div>
    <script type="module" src="/src/pages/admin.js"></script>
  </body>
</html>
```

### `client/src/pages/admin.js`

Thin orchestrator:

```js
import { initAdmin } from '../admin/auth.js';
initAdmin(document.querySelector('#admin-mount'));
```

### `client/src/admin/auth.js`

Single source of truth for auth state. Exports `initAdmin(mountNode)`.

Responsibilities:
1. On load: call `supabase.auth.getSession()`.
2. Subscribe to `supabase.auth.onAuthStateChange((_event, session) => render(session))`.
3. Render decision:
   - **No session** → `renderSignIn(mountNode)`. "Sign in with GitHub" button
     calls `supabase.auth.signInWithOAuth({ provider: 'github', options: { redirectTo: location.origin + '/admin' } })`.
   - **Session exists, but `session.user.email !== OWNER_EMAIL`** →
     `renderUnauthorized(mountNode)`. Message + "Sign out" button. (Defense in
     depth — RLS already blocks writes; this just prevents the dashboard from
     misleadingly appearing.)
   - **Session exists, owner email** → call `renderDashboard(mountNode)` from
     `dashboard.js`.
4. `OWNER_EMAIL` is a hardcoded constant in this file:
   `const OWNER_EMAIL = 'jkylecadap@gmail.com'`. Not a secret; commits fine.

### `client/src/admin/dashboard.js`

Two states, plain JS state machine — no router:

1. **List view** (default): table of all projects (published + drafts).
   Columns: title, slug, published, featured, sort_order, screenshot thumb,
   Edit, Delete. Top of page: "+ New project" button + "Sign out".
2. **Edit view**: form (delegated to `projectForm.js`) for create or edit.
   Cancel returns to list. Save returns to list.

Switching views = swap `mountNode.innerHTML` and re-attach handlers. No
client-side router, no virtual DOM.

Owner sees drafts because the "owner reads all projects" RLS policy is in
effect for their session.

Delete flow: `confirm('Delete <title>?')` → on yes,
`supabase.from('projects').delete().eq('id', id)` → re-fetch list.

### `client/src/admin/projectForm.js`

The CRUD form. Inputs for every column except `id`/`created_at`/`updated_at`.

| Field | Input type | Notes |
|---|---|---|
| `title` | text | required |
| `slug` | text | required, lowercased, validated `[a-z0-9-]+` client-side |
| `summary` | textarea (3 rows) | required |
| `description` | textarea (8 rows) | optional |
| `tech_stack` | text (comma-separated) | split on save: `s.split(',').map(t => t.trim()).filter(Boolean)` |
| `tags` | text (comma-separated) | same split |
| `demo_url` | url | optional |
| `repo_url` | url | optional |
| `screenshot` | file | optional on edit, optional on create |
| `sort_order` | number | default `0` |
| `featured` | checkbox | default unchecked |
| `published` | checkbox | default unchecked |

Submit handler:

1. Build the row from form values (don't include `screenshot_url` yet).
2. **If a new file was selected:**
   - Derive filename: `${slug}.${ext}` where `ext` matches the picked file
     (`.jpg`, `.png`, `.webp`).
   - `await supabase.storage.from('project-screenshots').upload(filename, file, { upsert: true, contentType: file.type })`.
   - On error: stop, surface inline ("Upload failed: <message>"). Row is not
     saved.
   - `row.screenshot_url = supabase.storage.from('project-screenshots').getPublicUrl(filename).data.publicUrl`.
3. **If editing and `slug` changed:** after the new upload succeeds,
   `await supabase.storage.from('project-screenshots').remove([oldFilename])`
   to drop the orphan. Failures here are logged but not fatal — the row is
   already pointing at the new file.
4. **If editing and no new file selected:** `row.screenshot_url = existing.screenshot_url`.
5. `await supabase.from('projects').upsert(row).select().single()`.
6. On success: return to list view + show "Saved" toast.
7. On error: surface inline ("Save failed: <message>"). Stay on form.

Sequential await throughout — never parallelize the upload and the row save.
A failed upload must not result in a row pointing at a missing file.

### `vite.config.js` update

```js
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  envDir: '..',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
      },
    },
  },
});
```

Two entry points; everything else is unchanged.

## Environment variables

| Key | Public? | Where set | Example |
|---|---|---|---|
| `VITE_SUPABASE_URL` | public | `.env` (root) + Vercel env | `https://<ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | public | `.env` (root) + Vercel env | `eyJhbGciOi...` (long JWT) |

Both are read at build time by Vite and baked into the client bundle. The
anon key is public-by-design — security is enforced by RLS, not by hiding
the key.

`.env.example` (committed) gets two new entries documenting the keys.
`.env` (gitignored) holds the actual values for local dev. Vercel Project
Settings → Environment Variables holds them for Preview + Production.

The existing `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`,
`VITE_TURNSTILE_SITE_KEY`, `OWNER_EMAIL`, `SENDER_EMAIL` from the contact
form are untouched.

## Supabase setup (one-time, ~30 min)

Order matters:

1. **Create Supabase project** at supabase.com. Copy `URL` and `anon` key
   from Project Settings → API. Add to `portfolio/.env` and to Vercel.
2. **Run schema SQL** from `supabase/schema.sql` in Supabase SQL Editor.
   This creates the `projects` table, indexes, trigger, and RLS policies.
   Replace `<OWNER_EMAIL>` with `jkylecadap@gmail.com` before running.
3. **Enable GitHub OAuth provider** in Authentication → Providers → GitHub.
   - Create a GitHub OAuth App at github.com/settings/developers.
   - Authorization callback URL: `https://<ref>.supabase.co/auth/v1/callback`
     (Supabase shows the exact URL on the provider config page).
   - Copy Client ID and Client Secret into Supabase.
4. **Add Site URL** to Authentication → URL Configuration:
   - Site URL: `https://portfolio.jkylec.dev`.
   - Additional redirect URLs: `http://localhost:5173/admin` (for local dev).
5. **Create Storage bucket** `project-screenshots`. Set to public. File size
   limit 5 MB. MIME allowlist: `image/jpeg`, `image/png`, `image/webp`.
6. **Apply storage RLS policies** from `supabase/schema.sql` in the SQL
   editor (the file includes them at the bottom).

After step 6, the local site can read the (empty) projects table and the
admin can sign in.

## Local dev workflow

`npm run dev` (existing script, plain Vite) works for the entire feature.
No `vercel dev` needed. The form posts and image uploads go straight to
Supabase, which is reachable from any localhost.

| Command | What runs | When to use |
|---|---|---|
| `npm run dev` | Vite at `localhost:5173` | All projects-showcase work |
| `npm run dev:full` | `vercel dev` | Only when touching `/api/contact` |

Public site at `localhost:5173/`. Admin at `localhost:5173/admin`.

The OAuth redirect URL `http://localhost:5173/admin` is registered in
Supabase auth config (step 4 above), so GitHub OAuth round-trips work
locally.

## Error handling

Consistent across all sub-projects:

- **Public list errors** — single line "Couldn't load projects — refresh to
  try again." No alert dialogs. The rest of the page (scene, contact form)
  is unaffected.
- **Admin errors** — render inline next to the relevant action ("Save failed:
  <message>", "Upload failed: <message>", "Delete failed: <message>"). Real
  error message visible (admin is owner-only, no information disclosure
  concern).
- **Auth failures** — if `getSession` throws or the OAuth redirect lands
  without a session, render the sign-in screen. Never strand the user on a
  half-rendered dashboard.
- **Sequential awaits** in any flow that has multiple Supabase calls. No
  `Promise.all` — failures on step N must abort step N+1 cleanly.

## Spec self-review

Verified before committing:

- **Placeholders:** `<OWNER_EMAIL>` is intentional in the SQL — replaced
  during Supabase setup. All other fields specified.
- **Internal consistency:** Sub-project A uses `published = true` for public
  reads; Sub-project B's "owner reads all" policy supplements (does not
  contradict) it. Storage bucket name `project-screenshots` is consistent
  across schema.sql, projectForm.js, and the public render.
- **Scope:** Single implementation plan covers all four sub-projects. They
  share the table, bucket, and RLS layer; splitting them risks half-built
  state where the public site reads from a table the admin can't write to.
- **Ambiguity:** "Featured projects render before others" is now explicit
  in the default ordering. Image-orphan policy on row delete is now
  explicit (we leave files; only slug-change triggers cleanup).

## Verification (manual smoke list)

Run before merging to main:

1. **Public list renders** on `/` — three seeded projects show in the Work
   section, with screenshot, title, summary, tech_stack chips, links.
2. **Filtering** — clicking each tag pill narrows the list correctly. `All`
   resets. Active pill has visible state.
3. **Drafts hidden** — toggle a project to `published=false` in admin → it
   disappears from `/` after refresh, still shows in `/admin`.
4. **Featured ordering** — toggle a project to `featured=true` → it moves
   to the front of the public list after refresh.
5. **Sign in to `/admin`** with the owner GitHub account → dashboard loads.
6. **Sign in with a different GitHub account** → "Not authorized" screen.
   Open devtools, attempt `supabase.from('projects').insert(...)` directly —
   RLS rejects.
7. **Create a project** with a screenshot — appears in admin list and on `/`
   after refresh (assuming `published=true`).
8. **Edit a project** — change title only → row updates, file untouched.
9. **Edit a project's slug** — old screenshot file is removed from Storage
   after the new one uploads (verify in Supabase Storage UI).
10. **Re-upload a screenshot** for an existing project — file is overwritten
    in place (same URL, new contents).
11. **Delete a project** — row gone from `projects`. Image file remains in
    Storage (intentional, see Non-Goals).
12. **Local dev** — entire flow works in `npm run dev` (no `vercel dev`).
13. **Production smoke** after deploy — same flow against
    `portfolio.jkylec.dev`.

## Implementation order (informs the plan)

Build order shaped by dependency:

1. **Supabase setup** (one-time, manual): create project, run schema SQL,
   enable GitHub OAuth, create Storage bucket, apply storage RLS. Add env
   vars to root `.env` and Vercel.
2. **Install client dep**: `npm --prefix client install @supabase/supabase-js`.
3. **`lib/supabase.js`** — single shared client instance.
4. **`vite.config.js`** — multi-page rollup input. Verify `npm --prefix client run build` succeeds.
5. **`admin.html` + `pages/admin.js`** — empty admin shell that just shows
   "Hello admin". Verify `localhost:5173/admin` loads.
6. **`admin/auth.js`** — GitHub OAuth sign-in / out, owner email check.
   Verify sign-in round-trip works locally (the OAuth callback URL is
   already registered).
7. **`admin/dashboard.js` (list view)** — table of projects (read-only at
   first). Verify drafts visible to owner.
8. **`admin/projectForm.js` + `dashboard.js` (edit view)** — create / edit
   form, no image upload yet. Verify CRUD round-trip.
9. **Image upload in `projectForm.js`** — wire Storage upload, slug-rename
   cleanup. Verify all 4 image scenarios (new, edit no-change, edit slug
   change, re-upload).
10. **`Work.js` update + `dom/projectsList.js`** — public list fetches and
    renders. Verify on `/` with seeded data. Without filtering yet.
11. **Pill filtering in `projectsList.js`** — render pills, wire click
    handler. Verify single-select filtering.
12. **Styles** — `styles/components/projects.css` updates for cards/pills,
    new `admin/styles/admin.css`. Visual polish pass.
13. **`CLAUDE.md` update** — move projects-showcase from "Planned" to
    "Recently shipped"; clear "Currently building".
14. **Production deploy + smoke test** against `portfolio.jkylec.dev`.

Steps 1–9 produce a working admin without any visible change to the public
site. Step 10 is the first user-visible change. This means the public
`Work.js` only flips to DB-backed once the admin can actually populate it.

## Risks / Trade-offs

- **Forgetting RLS** = silent data exposure. Mitigation: schema.sql in repo
  is the canonical source; Supabase setup step 6 explicitly applies storage
  RLS. Smoke test #6 (different GitHub account → RLS rejects) verifies it
  end-to-end.
- **Slug collisions in Storage.** Two projects can't share a slug (DB unique
  constraint). Slug change deletes the old file. Slug deletion (project row
  delete) does *not* delete the file in v1 — accepted trade-off for
  simplicity, listed in Non-Goals.
- **Anon key in client bundle.** Public-by-design; not a risk if RLS is
  correct. The risk is if RLS is misconfigured, which is mitigated by the
  smoke test above.
- **No tests.** Refactors require manual re-verification. Same trade-off as
  the contact form. Acceptable for v1.
- **OAuth-only auth.** If GitHub is down, owner can't sign in. Acceptable
  — projects don't need to be edited urgently. Worst case: edit via Supabase
  Studio directly.
- **Multi-page Vite means two HTML entry points to maintain.** Future entry
  points (e.g., a future analytics admin page) follow the same pattern. Low
  cost.

## CLAUDE.md updates required

After this feature ships:
- Move "projects showcase" from "Planned features" → "Recently shipped" with
  a date and a pointer to this spec + the plan.
- Update "Currently building" to whatever's next per the roadmap.

## Reference

- Brainstorming dialogue: this conversation (2026-05-01).
- Earlier specs:
  - `docs/superpowers/specs/2026-04-27-portfolio-restructure-design.md`
  - `docs/superpowers/specs/2026-04-28-scene-redesign-design.md`
  - `docs/superpowers/specs/2026-04-29-contact-form-design.md` (established
    `/api/`, env-var, error-handling patterns)
- External:
  - Supabase JS docs: https://supabase.com/docs/reference/javascript
  - Supabase RLS docs: https://supabase.com/docs/guides/auth/row-level-security
  - Supabase Storage docs: https://supabase.com/docs/guides/storage
  - Multi-page Vite: https://vitejs.dev/guide/build.html#multi-page-app
