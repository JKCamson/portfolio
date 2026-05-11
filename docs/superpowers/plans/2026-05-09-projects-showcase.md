# Projects Showcase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded `<ul>` in `Work.js` with a Supabase-backed projects list, add a custom `/admin` dashboard with GitHub-OAuth-gated CRUD + screenshot uploads, and ship single-select tag-pill filtering on the public list — all in one bundled feature.

**Architecture:** Multi-page Vite (`client/index.html` for the public site, `client/admin.html` for the admin dashboard — no Three.js on admin). Browser → Supabase JS direct, with RLS policies gating reads (public sees `published=true`, owner sees all) and writes (owner only). Single Storage bucket `project-screenshots`, public-read, slug-keyed filenames. No new `/api/` routes. Anon key is public-by-design and lives in the client bundle.

**Tech Stack:** Vite + vanilla JS (existing), `@supabase/supabase-js` (new), Supabase Postgres + Auth (GitHub OAuth) + Storage. No automated test framework — verification is manual per spec non-goals (matches contact-form precedent).

**Spec:** `docs/superpowers/specs/2026-05-01-projects-showcase-design.md`

**Notes for the executor:**
- **Commit behavior (this run):** Subagents commit per task using the suggested message in each "Pause for user commit" step. `git push` is still left to the user. The "Pause for user commit" wording is preserved as a record but executes as `git add <files> && git commit -m "<message>"`.
- **Supabase keys (updated 2026-05-09):** Supabase now issues a "publishable key" (public, client-safe) instead of the legacy "anon key". The plan uses `VITE_SUPABASE_PUBLISHABLE_KEY` as the env var. Functionally a drop-in replacement — RLS still gates access. The "secret key" Supabase also issues is server-only and is NOT used in this feature.
- No automated tests in this repo. "Verify" steps are manual: run a command, then visually confirm in the browser.
- Tasks 1, 6, 11 require user action in external dashboards (Supabase, GitHub). Task 16 requires Vercel dashboard access. Other tasks are local-code only.
- In Vite dev, the admin entry is reachable at `http://localhost:5173/admin.html`. In Vercel production, `/admin` rewrites to `admin.html` automatically (no config needed).

---

## File Structure

**Created:**
- `supabase/schema.sql` — committed reference copy of DB schema + RLS (Supabase Studio is source of truth)
- `client/admin.html` — second Vite entry point for admin dashboard
- `client/src/lib/supabase.js` — shared Supabase client instance
- `client/src/dom/projectsList.js` — public list fetch + render + pill filtering
- `client/src/pages/admin.js` — admin entry orchestrator
- `client/src/admin/auth.js` — GitHub OAuth + session/owner check, mounts dashboard or sign-in
- `client/src/admin/dashboard.js` — list view + edit-view state machine
- `client/src/admin/projectForm.js` — create/edit form + image upload
- `client/src/admin/styles/admin.css` — admin-only styles

**Modified:**
- `.env.example` — add `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
- `client/vite.config.js` — multi-page rollup input
- `client/src/main.js` — call `initProjectsList()` after mount
- `client/src/components/Work.js` — replace hardcoded `<ul>` with empty containers + loading state
- `client/src/styles/components/projects.css` — cards + pills styles
- `CLAUDE.md` — move projects showcase to "Recently shipped"; clear "Currently building"

---

## Task 1: Supabase project setup (manual, in Supabase dashboard)

**Files:** none (external dashboard work)

This is one-time setup the user performs in the Supabase web UI. The output is a project URL, an anon key, and the database/storage configured. Subsequent tasks consume the URL + key as env vars.

- [ ] **Step 1: Create the Supabase project**

Sign in at https://supabase.com → New project. Name it (e.g. `portfolio`), pick a region close to you, save the database password somewhere safe. Wait for provisioning (~1 min).

- [ ] **Step 2: Copy URL and anon key**

Project Settings → API. Copy two values:
- `Project URL` (looks like `https://<ref>.supabase.co`)
- `anon` `public` key (long JWT starting with `eyJ...`)

Hold these — Task 2 writes them to `.env`.

- [ ] **Step 3: Defer schema and Storage to Tasks 3 and 11**

Schema SQL is created locally in Task 3 and run in Supabase Studio at the end of Task 3. Storage bucket is created in Task 11. (The split is so the SQL file lives in the repo first and is reviewable before being applied.)

- [ ] **Step 4: No commit yet**

Nothing changed in the repo.

---

## Task 2: Add env vars to `.env.example` and the root `.env`

**Files:**
- Modify: `.env.example`
- Modify: `.env` (gitignored — local only; do not commit)

- [ ] **Step 1: Append two entries to `.env.example`**

Add at the bottom of `.env.example`:

```
# Supabase (https://supabase.com). The publishable key is public-by-design;
# RLS gates all access. Do NOT put the Supabase "secret key" here — it is
# server-only and unused in this client-side feature.
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_replace_me
```

- [ ] **Step 2: Add the actual values to local `.env`**

Open `.env` (root, gitignored) and add the same two keys, but with the real values copied from Task 1 Step 2. Keep all existing entries intact.

- [ ] **Step 3: Verify Vite picks up the env vars**

Run from the repo root:
```
npm --prefix client run dev
```
Expected: dev server starts at `http://localhost:5173` with no errors. Stop it with Ctrl+C — we just confirmed the server boots; the keys aren't used until Task 4.

- [ ] **Step 4: Pause for user commit**

Suggested message:
```
chore: document Supabase env vars in .env.example
```
Files staged: `.env.example` only. Do not commit `.env`.

---

## Task 3: Write the schema SQL file and run it in Supabase

**Files:**
- Create: `supabase/schema.sql`

- [ ] **Step 1: Create `supabase/schema.sql` with the full schema**

```sql
-- Projects showcase schema. Supabase Studio is the source of truth;
-- this file is a committed reference copy. Re-run is safe only on
-- a fresh project (the create table will fail if it already exists).

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

create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger projects_set_updated_at
  before update on projects
  for each row execute function set_updated_at();

alter table projects enable row level security;

create policy "public reads published projects"
  on projects for select
  using (published = true);

create policy "owner reads all projects"
  on projects for select
  using (auth.email() = 'jkylecadap@gmail.com');

create policy "owner inserts projects"
  on projects for insert
  with check (auth.email() = 'jkylecadap@gmail.com');

create policy "owner updates projects"
  on projects for update
  using (auth.email() = 'jkylecadap@gmail.com')
  with check (auth.email() = 'jkylecadap@gmail.com');

create policy "owner deletes projects"
  on projects for delete
  using (auth.email() = 'jkylecadap@gmail.com');

-- Storage RLS for the project-screenshots bucket. The bucket itself
-- is created via the Supabase Storage UI in Task 11; these policies
-- are applied at the same time.

create policy "public reads screenshots"
  on storage.objects for select
  using (bucket_id = 'project-screenshots');

create policy "owner inserts screenshots"
  on storage.objects for insert
  with check (bucket_id = 'project-screenshots'
              and auth.email() = 'jkylecadap@gmail.com');

create policy "owner updates screenshots"
  on storage.objects for update
  using (bucket_id = 'project-screenshots'
         and auth.email() = 'jkylecadap@gmail.com');

create policy "owner deletes screenshots"
  on storage.objects for delete
  using (bucket_id = 'project-screenshots'
         and auth.email() = 'jkylecadap@gmail.com');
```

- [ ] **Step 2: Run only the `projects` table portion in Supabase**

In Supabase Studio → SQL Editor, paste lines 5–58 of `supabase/schema.sql` (everything from `create table projects` through the last `create policy "owner deletes projects" ...;`). Hit Run.

Expected: "Success. No rows returned." Storage policies are deferred to Task 11 because the bucket doesn't exist yet — running them now would error.

- [ ] **Step 3: Verify the table exists**

In Supabase Studio → Table Editor, confirm a `projects` table appears with all 15 columns. RLS should show as **enabled** (lock icon). Click into the policies tab — five policies should be listed.

- [ ] **Step 4: Pause for user commit**

Suggested message:
```
feat: add Supabase schema for projects showcase
```
Files staged: `supabase/schema.sql`.

---

## Task 4: Install `@supabase/supabase-js` and create the shared client

**Files:**
- Modify: `client/package.json` (via npm install)
- Create: `client/src/lib/supabase.js`

- [ ] **Step 1: Install the dependency**

Run from the repo root:
```
npm --prefix client install @supabase/supabase-js
```

Expected: install completes, `client/package.json` gains `@supabase/supabase-js` under `dependencies`, `client/package-lock.json` updates.

- [ ] **Step 2: Create `client/src/lib/supabase.js`**

```js
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);
```

- [ ] **Step 3: Verify the client loads without runtime errors**

Run `npm --prefix client run dev`. Open `http://localhost:5173/`, open browser devtools console, paste:
```
(await import('/src/lib/supabase.js')).supabase.from('projects').select('*').then(console.log)
```

Expected: an object logged with `data` (empty array `[]` since no rows yet) and `error: null`. If `error` is truthy, the URL or anon key is wrong — fix `.env` and restart the dev server.

Stop the dev server.

- [ ] **Step 4: Pause for user commit**

Suggested message:
```
feat: add @supabase/supabase-js client
```
Files staged: `client/package.json`, `client/package-lock.json`, `client/src/lib/supabase.js`.

---

## Task 5: Multi-page Vite — add the admin entry point

**Files:**
- Modify: `client/vite.config.js`
- Create: `client/admin.html`
- Create: `client/src/pages/admin.js`
- Create: `client/src/admin/styles/admin.css`

- [ ] **Step 1: Update `client/vite.config.js`**

Replace the entire file with:

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

- [ ] **Step 2: Create `client/admin.html`**

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
    <div id="admin-mount">Loading admin…</div>
    <script type="module" src="/src/pages/admin.js"></script>
  </body>
</html>
```

- [ ] **Step 3: Create a placeholder `client/src/pages/admin.js`**

```js
const mount = document.querySelector('#admin-mount');
mount.textContent = 'Hello admin (placeholder)';
```

This is a temporary stub. Task 6 replaces the body with the real auth init.

- [ ] **Step 4: Create a starter `client/src/admin/styles/admin.css`**

```css
:root {
  --bg: #0c0e14;
  --fg: #e8eaf1;
  --muted: #8a90a3;
  --accent: #6ea8fe;
  --border: #1f2330;
  --danger: #ff6e6e;
}

html, body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font: 14px/1.5 system-ui, -apple-system, sans-serif;
}

#admin-mount {
  max-width: 960px;
  margin: 0 auto;
  padding: 32px 24px;
}

button, .button {
  background: var(--accent);
  color: var(--bg);
  border: 0;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font: inherit;
}

button.secondary { background: transparent; color: var(--fg); border: 1px solid var(--border); }
button.danger { background: var(--danger); color: var(--bg); }

input, textarea, select {
  width: 100%;
  background: #131623;
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 8px 10px;
  font: inherit;
  box-sizing: border-box;
}

label { display: block; margin: 12px 0 4px; color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; }

table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: 8px; border-bottom: 1px solid var(--border); }
th { color: var(--muted); font-weight: 500; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; }

.error { color: var(--danger); margin: 8px 0; }
.toast { background: var(--accent); color: var(--bg); padding: 8px 12px; border-radius: 4px; display: inline-block; margin: 8px 0; }
```

- [ ] **Step 5: Verify both entry points serve and build**

Run:
```
npm --prefix client run dev
```
Open `http://localhost:5173/` — public site should render normally (Three.js scene + sections).
Open `http://localhost:5173/admin.html` — should render the dark admin shell with the text "Hello admin (placeholder)".

Stop the dev server. Run:
```
npm --prefix client run build
```
Expected: build succeeds with both `dist/index.html` and `dist/admin.html` emitted, plus separate JS chunks. If you see "Could not resolve entry module 'admin.html'", check the `vite.config.js` resolve path.

- [ ] **Step 6: Pause for user commit**

Suggested message:
```
feat: scaffold multi-page Vite with /admin entry
```
Files staged: `client/vite.config.js`, `client/admin.html`, `client/src/pages/admin.js`, `client/src/admin/styles/admin.css`.

---

## Task 6: Configure GitHub OAuth in Supabase + GitHub

**Files:** none (external dashboard work)

- [ ] **Step 1: Create a GitHub OAuth app**

Go to https://github.com/settings/developers → New OAuth App.
- Application name: `Portfolio Admin` (or anything)
- Homepage URL: `https://portfolio.jkylec.dev`
- Authorization callback URL: paste from Supabase Studio → Authentication → Providers → GitHub. The callback URL will look like `https://<ref>.supabase.co/auth/v1/callback`. Copy it from Supabase first.

Click Register. Copy the Client ID. Generate a Client Secret and copy it.

- [ ] **Step 2: Enable GitHub provider in Supabase**

In Supabase Studio → Authentication → Providers → GitHub → toggle Enabled. Paste the Client ID and Client Secret. Save.

- [ ] **Step 3: Configure auth URLs in Supabase**

In Supabase Studio → Authentication → URL Configuration:
- Site URL: `https://portfolio.jkylec.dev`
- Additional Redirect URLs (add both):
  - `http://localhost:5173/admin.html`
  - `https://portfolio.jkylec.dev/admin`

Save.

- [ ] **Step 4: No commit yet**

Nothing changed in the repo.

---

## Task 7: Implement `admin/auth.js` — GitHub OAuth + session check

**Files:**
- Create: `client/src/admin/auth.js`
- Modify: `client/src/pages/admin.js`

- [ ] **Step 1: Create `client/src/admin/auth.js`**

```js
import { supabase } from '../lib/supabase.js';

const OWNER_EMAIL = 'jkylecadap@gmail.com';

export function initAdmin(mountNode) {
  let currentSession = null;

  async function refreshAndRender() {
    const { data: { session } } = await supabase.auth.getSession();
    currentSession = session;
    render(mountNode, session);
  }

  supabase.auth.onAuthStateChange((_event, session) => {
    currentSession = session;
    render(mountNode, session);
  });

  refreshAndRender();
}

function render(mountNode, session) {
  if (!session) return renderSignIn(mountNode);
  if (session.user.email !== OWNER_EMAIL) return renderUnauthorized(mountNode);
  renderDashboardLoading(mountNode);
  // dashboard.js will be wired in Task 8.
  import('./dashboard.js').then(({ renderDashboard }) => renderDashboard(mountNode));
}

function renderSignIn(mountNode) {
  mountNode.innerHTML = `
    <h1>Admin</h1>
    <p>Sign in with the owner GitHub account to continue.</p>
    <button id="signin-github">Sign in with GitHub</button>
  `;
  mountNode.querySelector('#signin-github').addEventListener('click', async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
    if (error) {
      mountNode.insertAdjacentHTML('beforeend', `<p class="error">Sign-in failed: ${escapeText(error.message)}</p>`);
    }
  });
}

function renderUnauthorized(mountNode) {
  mountNode.innerHTML = `
    <h1>Not authorized</h1>
    <p>This Google/GitHub account is not the owner. Sign out and try again.</p>
    <button id="signout">Sign out</button>
  `;
  mountNode.querySelector('#signout').addEventListener('click', async () => {
    await supabase.auth.signOut();
  });
}

function renderDashboardLoading(mountNode) {
  mountNode.innerHTML = `<p>Loading dashboard…</p>`;
}

function escapeText(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
```

- [ ] **Step 2: Replace the placeholder body of `client/src/pages/admin.js`**

```js
import { initAdmin } from '../admin/auth.js';

const mount = document.querySelector('#admin-mount');
initAdmin(mount);
```

- [ ] **Step 3: Stub `client/src/admin/dashboard.js` so the dynamic import resolves**

Create the file with a minimal placeholder. The full implementation lands in Task 8.

```js
export function renderDashboard(mountNode) {
  mountNode.innerHTML = `<h1>Signed in as owner — dashboard goes here.</h1>`;
}
```

- [ ] **Step 4: Verify the OAuth round-trip**

Run `npm --prefix client run dev`. Open `http://localhost:5173/admin.html`.

Expected flow:
1. "Sign in with GitHub" button visible.
2. Click → redirected to GitHub → authorize → redirected back to `localhost:5173/admin.html`.
3. If signed in with the owner GitHub account (whose email is `jkylecadap@gmail.com`): "Signed in as owner — dashboard goes here." appears.
4. If signed in with a non-owner GitHub account: "Not authorized" + Sign out button. Click Sign out → returns to the sign-in screen.

Stop the dev server.

- [ ] **Step 5: Pause for user commit**

Suggested message:
```
feat: add GitHub OAuth gating for /admin
```
Files staged: `client/src/admin/auth.js`, `client/src/admin/dashboard.js`, `client/src/pages/admin.js`.

---

## Task 8: Admin dashboard list view (read-only)

**Files:**
- Modify: `client/src/admin/dashboard.js`

- [ ] **Step 1: Replace `client/src/admin/dashboard.js`**

```js
import { supabase } from '../lib/supabase.js';

export async function renderDashboard(mountNode) {
  mountNode.innerHTML = `
    <header style="display:flex; justify-content:space-between; align-items:center;">
      <h1>Projects</h1>
      <div>
        <button id="new-project">+ New project</button>
        <button id="signout" class="secondary">Sign out</button>
      </div>
    </header>
    <div id="dashboard-error"></div>
    <div id="dashboard-body"><p>Loading…</p></div>
  `;

  mountNode.querySelector('#signout').addEventListener('click', async () => {
    await supabase.auth.signOut();
  });

  mountNode.querySelector('#new-project').addEventListener('click', () => {
    // Wired in Task 9.
    alert('New-project form lands in Task 9.');
  });

  await loadAndRenderList(mountNode);
}

async function loadAndRenderList(mountNode) {
  const body = mountNode.querySelector('#dashboard-body');
  const errorBox = mountNode.querySelector('#dashboard-error');
  errorBox.innerHTML = '';

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('featured', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    errorBox.innerHTML = `<p class="error">Failed to load: ${escapeText(error.message)}</p>`;
    body.innerHTML = '';
    return;
  }

  if (!data.length) {
    body.innerHTML = `<p>No projects yet. Click "+ New project" to add one.</p>`;
    return;
  }

  const rows = data.map(p => `
    <tr>
      <td>
        ${p.screenshot_url
          ? `<img src="${escapeText(p.screenshot_url)}" alt="" style="width:64px; height:40px; object-fit:cover; border-radius:3px;" />`
          : `<div style="width:64px; height:40px; background:#1f2330; border-radius:3px;"></div>`}
      </td>
      <td><strong>${escapeText(p.title)}</strong><br/><span style="color:var(--muted)">${escapeText(p.slug)}</span></td>
      <td>${p.published ? 'Published' : 'Draft'}</td>
      <td>${p.featured ? '★' : ''}</td>
      <td>${p.sort_order}</td>
      <td>
        <button class="secondary" data-action="edit" data-id="${p.id}">Edit</button>
        <button class="danger" data-action="delete" data-id="${p.id}" data-title="${escapeText(p.title)}">Delete</button>
      </td>
    </tr>
  `).join('');

  body.innerHTML = `
    <table>
      <thead>
        <tr><th>Image</th><th>Project</th><th>Status</th><th>★</th><th>Order</th><th></th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  body.querySelectorAll('button[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => handleDelete(mountNode, btn.dataset.id, btn.dataset.title));
  });
  body.querySelectorAll('button[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => {
      // Wired in Task 9.
      alert('Edit form lands in Task 9.');
    });
  });
}

async function handleDelete(mountNode, id, title) {
  if (!confirm(`Delete "${title}"?`)) return;
  const errorBox = mountNode.querySelector('#dashboard-error');
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) {
    errorBox.innerHTML = `<p class="error">Delete failed: ${escapeText(error.message)}</p>`;
    return;
  }
  await loadAndRenderList(mountNode);
}

function escapeText(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
```

- [ ] **Step 2: Seed one row manually for verification**

In Supabase Studio → Table Editor → `projects` → Insert row:
- `slug`: `seed-test`
- `title`: `Seed Test`
- `summary`: `Seed row to verify dashboard rendering.`
- `published`: false (drafts visible to owner)
- All other defaults.

- [ ] **Step 3: Verify the list view**

Run `npm --prefix client run dev`. Sign in at `http://localhost:5173/admin.html`. Expected:
- Dashboard header: "Projects" + "+ New project" + "Sign out".
- One table row showing "Seed Test", slug `seed-test`, status `Draft`, no star, order `0`, Edit/Delete buttons.
- Click "Delete" on the seed row → confirm → row disappears.

Stop the dev server.

- [ ] **Step 4: Pause for user commit**

Suggested message:
```
feat: add admin dashboard list view with delete
```
Files staged: `client/src/admin/dashboard.js`.

---

## Task 9: Admin create/edit form (no image upload yet)

**Files:**
- Create: `client/src/admin/projectForm.js`
- Modify: `client/src/admin/dashboard.js`

- [ ] **Step 1: Create `client/src/admin/projectForm.js`**

```js
import { supabase } from '../lib/supabase.js';

const SLUG_RE = /^[a-z0-9-]+$/;

// project = null means "new project". Otherwise it's the row being edited.
export function renderProjectForm(mountNode, project, onDone) {
  const isEdit = !!project;
  const initial = project ?? {
    slug: '', title: '', summary: '', description: '',
    tech_stack: [], tags: [],
    demo_url: '', repo_url: '',
    sort_order: 0, featured: false, published: false,
    screenshot_url: null,
  };

  mountNode.innerHTML = `
    <header style="display:flex; justify-content:space-between; align-items:center;">
      <h1>${isEdit ? 'Edit project' : 'New project'}</h1>
      <button id="cancel" class="secondary">Cancel</button>
    </header>
    <div id="form-error"></div>
    <form id="project-form">
      <label for="title">Title</label>
      <input id="title" name="title" required value="${esc(initial.title)}" />

      <label for="slug">Slug (lowercase letters, digits, hyphens)</label>
      <input id="slug" name="slug" required pattern="[a-z0-9-]+" value="${esc(initial.slug)}" />

      <label for="summary">Summary (1–2 sentences)</label>
      <textarea id="summary" name="summary" rows="3" required>${esc(initial.summary)}</textarea>

      <label for="description">Description (optional, long-form)</label>
      <textarea id="description" name="description" rows="8">${esc(initial.description ?? '')}</textarea>

      <label for="tech_stack">Tech stack (comma-separated)</label>
      <input id="tech_stack" name="tech_stack" value="${esc((initial.tech_stack ?? []).join(', '))}" />

      <label for="tags">Tags (comma-separated, used for filtering)</label>
      <input id="tags" name="tags" value="${esc((initial.tags ?? []).join(', '))}" />

      <label for="demo_url">Demo URL</label>
      <input id="demo_url" name="demo_url" type="url" value="${esc(initial.demo_url ?? '')}" />

      <label for="repo_url">Repo URL</label>
      <input id="repo_url" name="repo_url" type="url" value="${esc(initial.repo_url ?? '')}" />

      <label for="sort_order">Sort order (lower = earlier)</label>
      <input id="sort_order" name="sort_order" type="number" value="${initial.sort_order}" />

      <label style="display:flex; gap:8px; align-items:center; text-transform:none; color:var(--fg); font-size:14px;">
        <input id="featured" name="featured" type="checkbox" style="width:auto;" ${initial.featured ? 'checked' : ''} />
        Featured (pin to front of public list)
      </label>

      <label style="display:flex; gap:8px; align-items:center; text-transform:none; color:var(--fg); font-size:14px;">
        <input id="published" name="published" type="checkbox" style="width:auto;" ${initial.published ? 'checked' : ''} />
        Published (visible on public site)
      </label>

      <div style="margin-top:24px;">
        <button type="submit" id="save">${isEdit ? 'Save changes' : 'Create project'}</button>
      </div>
    </form>
  `;

  mountNode.querySelector('#cancel').addEventListener('click', () => onDone());
  mountNode.querySelector('#project-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleSubmit(mountNode, project, onDone);
  });
}

async function handleSubmit(mountNode, existing, onDone) {
  const errorBox = mountNode.querySelector('#form-error');
  errorBox.innerHTML = '';

  const form = mountNode.querySelector('#project-form');
  const fd = new FormData(form);

  const slug = String(fd.get('slug') ?? '').trim();
  if (!SLUG_RE.test(slug)) {
    errorBox.innerHTML = `<p class="error">Slug must be lowercase letters, digits, and hyphens only.</p>`;
    return;
  }

  const row = {
    slug,
    title: String(fd.get('title') ?? '').trim(),
    summary: String(fd.get('summary') ?? '').trim(),
    description: nullIfBlank(fd.get('description')),
    tech_stack: splitList(fd.get('tech_stack')),
    tags: splitList(fd.get('tags')),
    demo_url: nullIfBlank(fd.get('demo_url')),
    repo_url: nullIfBlank(fd.get('repo_url')),
    sort_order: Number(fd.get('sort_order') ?? 0) | 0,
    featured: fd.get('featured') === 'on',
    published: fd.get('published') === 'on',
    screenshot_url: existing?.screenshot_url ?? null,
  };

  if (existing) row.id = existing.id;

  const { error } = await supabase.from('projects').upsert(row).select().single();
  if (error) {
    errorBox.innerHTML = `<p class="error">Save failed: ${esc(error.message)}</p>`;
    return;
  }
  onDone();
}

function splitList(raw) {
  return String(raw ?? '').split(',').map(s => s.trim()).filter(Boolean);
}

function nullIfBlank(raw) {
  const s = String(raw ?? '').trim();
  return s.length ? s : null;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
```

- [ ] **Step 2: Wire the form into `dashboard.js`**

Replace the two `alert(...)` placeholders. Find `mountNode.querySelector('#new-project').addEventListener(...)` and the `data-action="edit"` handler block, then replace as follows:

```js
// at top of file:
import { renderProjectForm } from './projectForm.js';
```

Replace the new-project handler:
```js
mountNode.querySelector('#new-project').addEventListener('click', () => {
  renderProjectForm(mountNode, null, () => renderDashboard(mountNode));
});
```

Replace the edit handler — to access the row data, store the fetched array in a closure variable. Update `loadAndRenderList` to keep the array, and the edit handler to look it up:

```js
let cachedProjects = [];

async function loadAndRenderList(mountNode) {
  // ... existing code ...
  cachedProjects = data;
  // ... rest unchanged ...
}
```

And replace the edit click handler with:
```js
body.querySelectorAll('button[data-action="edit"]').forEach(btn => {
  btn.addEventListener('click', () => {
    const project = cachedProjects.find(p => p.id === btn.dataset.id);
    if (!project) return;
    renderProjectForm(mountNode, project, () => renderDashboard(mountNode));
  });
});
```

- [ ] **Step 3: Verify create flow**

Run `npm --prefix client run dev`, sign in at `/admin.html`, click "+ New project". Fill in:
- Title: `Portfolio Site`
- Slug: `portfolio-site`
- Summary: `Three.js scroll-driven space scene.`
- Tech stack: `Three.js, Vite, JavaScript`
- Tags: `web, 3d`
- Published: checked

Click Create. Expected: returns to list view with the new row visible.

- [ ] **Step 4: Verify edit flow**

Click Edit on `Portfolio Site`. Change the title to `Portfolio Site v2` and click Save changes. Expected: returns to list, title shows updated.

- [ ] **Step 5: Verify validation**

Click + New project. Try submitting with an empty title — browser blocks (HTML required). Try a slug like `Bad Slug!` — form shows "Slug must be lowercase letters, digits, and hyphens only."

- [ ] **Step 6: Pause for user commit**

Suggested message:
```
feat: add admin project create/edit form
```
Files staged: `client/src/admin/projectForm.js`, `client/src/admin/dashboard.js`.

---

## Task 10: Image upload — wire `screenshot` field in the form

**Files:**
- Modify: `client/src/admin/projectForm.js`

- [ ] **Step 1: Add the file input to the form template**

In `renderProjectForm`, immediately before the closing `<div style="margin-top:24px;">` block (the one with the submit button), add:

```html
      <label for="screenshot">Screenshot (jpg/png/webp, max 5 MB)</label>
      ${initial.screenshot_url ? `<img src="${esc(initial.screenshot_url)}" alt="" style="max-width:240px; display:block; margin-bottom:8px; border-radius:4px;" />` : ''}
      <input id="screenshot" name="screenshot" type="file" accept="image/jpeg,image/png,image/webp" />
```

- [ ] **Step 2: Update `handleSubmit` to handle uploads**

Replace the body of `handleSubmit` with:

```js
async function handleSubmit(mountNode, existing, onDone) {
  const errorBox = mountNode.querySelector('#form-error');
  errorBox.innerHTML = '';

  const form = mountNode.querySelector('#project-form');
  const fd = new FormData(form);

  const slug = String(fd.get('slug') ?? '').trim();
  if (!SLUG_RE.test(slug)) {
    errorBox.innerHTML = `<p class="error">Slug must be lowercase letters, digits, and hyphens only.</p>`;
    return;
  }

  const file = fd.get('screenshot');
  const hasNewFile = file && file instanceof File && file.size > 0;

  let screenshot_url = existing?.screenshot_url ?? null;
  let oldFilename = null;
  if (existing?.screenshot_url) {
    // Pull the filename out of the existing public URL: ".../<filename>"
    const m = existing.screenshot_url.match(/\/project-screenshots\/(.+)$/);
    if (m) oldFilename = m[1];
  }

  if (hasNewFile) {
    if (file.size > 5 * 1024 * 1024) {
      errorBox.innerHTML = `<p class="error">Image too large (max 5 MB).</p>`;
      return;
    }
    const ext = extFromMime(file.type);
    if (!ext) {
      errorBox.innerHTML = `<p class="error">Unsupported image type. Use JPG, PNG, or WebP.</p>`;
      return;
    }
    const filename = `${slug}.${ext}`;

    const upload = await supabase.storage
      .from('project-screenshots')
      .upload(filename, file, { upsert: true, contentType: file.type });

    if (upload.error) {
      errorBox.innerHTML = `<p class="error">Upload failed: ${esc(upload.error.message)}</p>`;
      return;
    }

    screenshot_url = supabase.storage
      .from('project-screenshots')
      .getPublicUrl(filename).data.publicUrl;

    if (existing && oldFilename && oldFilename !== filename) {
      const cleanup = await supabase.storage.from('project-screenshots').remove([oldFilename]);
      if (cleanup.error) {
        console.warn('Old screenshot cleanup failed (non-fatal):', cleanup.error.message);
      }
    }
  }

  const row = {
    slug,
    title: String(fd.get('title') ?? '').trim(),
    summary: String(fd.get('summary') ?? '').trim(),
    description: nullIfBlank(fd.get('description')),
    tech_stack: splitList(fd.get('tech_stack')),
    tags: splitList(fd.get('tags')),
    demo_url: nullIfBlank(fd.get('demo_url')),
    repo_url: nullIfBlank(fd.get('repo_url')),
    sort_order: Number(fd.get('sort_order') ?? 0) | 0,
    featured: fd.get('featured') === 'on',
    published: fd.get('published') === 'on',
    screenshot_url,
  };

  if (existing) row.id = existing.id;

  const { error } = await supabase.from('projects').upsert(row).select().single();
  if (error) {
    errorBox.innerHTML = `<p class="error">Save failed: ${esc(error.message)}</p>`;
    return;
  }
  onDone();
}

function extFromMime(mime) {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return null;
}
```

The `handleSubmit` function above replaces the entire previous body. The other helper functions (`splitList`, `nullIfBlank`, `esc`) and the imports stay as-is.

- [ ] **Step 3: Verify (deferred to Task 11)**

The file input is wired but the Storage bucket doesn't exist yet, so uploads will fail with a "bucket not found" error. Task 11 creates the bucket and runs end-to-end image verification.

For now, just confirm the form still renders correctly without a bucket. Run `npm --prefix client run dev`, open `/admin.html`, sign in, click + New project — the file picker should appear at the bottom of the form. Don't pick a file; submit with text-only fields and confirm the row still saves (no image path taken).

- [ ] **Step 4: Pause for user commit**

Suggested message:
```
feat: wire screenshot upload in admin project form
```
Files staged: `client/src/admin/projectForm.js`.

---

## Task 11: Create the Storage bucket and run storage RLS

**Files:** none (external dashboard work)

- [ ] **Step 1: Create the bucket**

Supabase Studio → Storage → New bucket:
- Name: `project-screenshots`
- Public bucket: **on**
- File size limit: 5 MB
- Allowed MIME types: `image/jpeg, image/png, image/webp`

Create.

- [ ] **Step 2: Run the storage RLS portion of `schema.sql`**

In Supabase Studio → SQL Editor, paste only the storage policies block from `supabase/schema.sql` (the four `create policy ... on storage.objects ...` statements). Run.

Expected: "Success. No rows returned." If you get "policy already exists", drop it first with `drop policy "<name>" on storage.objects;` and re-run.

- [ ] **Step 3: End-to-end image upload verification**

Run `npm --prefix client run dev`. Sign in at `/admin.html`. Edit `Portfolio Site` from Task 9. Pick any small JPG/PNG and click Save changes.

Expected:
- Form returns to list view (no error toast).
- The list row now shows a thumbnail in the leftmost column.
- In Supabase Studio → Storage → `project-screenshots`, a file named `portfolio-site.<ext>` is listed.

Re-upload (edit again, pick a different image, save). Expected: thumbnail updates, file in Storage replaced (same filename).

Slug-rename test: Edit again, change slug from `portfolio-site` to `portfolio-site-2`, pick a fresh image, save. Expected: file `portfolio-site-2.<ext>` exists; old `portfolio-site.<ext>` is gone.

- [ ] **Step 4: No commit yet**

Nothing changed in the repo; this task was external setup + verification.

---

## Task 12: Public list — `Work.js` + `dom/projectsList.js` (no filtering yet)

**Files:**
- Modify: `client/src/components/Work.js`
- Create: `client/src/dom/projectsList.js`
- Modify: `client/src/main.js`

- [ ] **Step 1: Update `client/src/components/Work.js`**

```js
export const Work = () => `
  <section id="work" data-spin="work" class="section section--left">
    <div class="waypoint">
      <p class="eyebrow">03</p>
      <h2>Work</h2>
      <div class="divider"></div>
      <div id="projects-pills" class="projects__pills" hidden></div>
      <ul id="projects-list" class="projects" aria-busy="true">
        <li class="projects__loading">Loading…</li>
      </ul>
    </div>
  </section>
`;
```

- [ ] **Step 2: Create `client/src/dom/projectsList.js`**

```js
import { supabase } from '../lib/supabase.js';

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
  renderList();
}

function renderList() {
  const list = document.querySelector('#projects-list');
  list.removeAttribute('aria-busy');

  if (!projects.length) {
    list.innerHTML = `<li class="projects__empty">No projects yet</li>`;
    return;
  }

  list.innerHTML = projects.map(card).join('');
}

function card(p) {
  const primaryLink = p.demo_url || p.repo_url || '#';
  const media = p.screenshot_url
    ? `<img src="${esc(p.screenshot_url)}" alt="${esc(p.title)} screenshot" loading="lazy" />`
    : `<div class="projects__media-fallback"></div>`;

  return `
    <li class="projects__card">
      <a class="projects__media" href="${esc(primaryLink)}" target="_blank" rel="noopener">${media}</a>
      <h3>${esc(p.title)}</h3>
      <p>${esc(p.summary)}</p>
      ${p.tech_stack?.length
        ? `<ul class="projects__tech">${p.tech_stack.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`
        : ''}
      <div class="projects__links">
        ${p.demo_url ? `<a href="${esc(p.demo_url)}" target="_blank" rel="noopener">Demo</a>` : ''}
        ${p.repo_url ? `<a href="${esc(p.repo_url)}" target="_blank" rel="noopener">Code</a>` : ''}
      </div>
    </li>
  `;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
```

- [ ] **Step 3: Wire `initProjectsList` into `client/src/main.js`**

Add the import alongside the other `dom/` imports:

```js
import { initProjectsList } from './dom/projectsList.js';
```

And call it after `initContactForm()`:

```js
initContactForm();
initProjectsList();
startRenderLoop({ scene, camera, renderer, planets, sun, stars, dust });
```

- [ ] **Step 4: Verify the public list**

Make sure at least one row in `projects` has `published = true` and a screenshot. Run `npm --prefix client run dev`, open `http://localhost:5173/`, scroll to the Work section.

Expected:
- Loading state appears briefly, then cards render.
- Each card has the screenshot, title, summary, tech-stack chips, and Demo/Code links (only the ones with URLs).
- Drafts (`published=false`) are NOT visible on the public site.

Toggle a published row to draft via the admin → refresh `/` → the card disappears.

- [ ] **Step 5: Pause for user commit**

Suggested message:
```
feat: render projects list from Supabase on public site
```
Files staged: `client/src/components/Work.js`, `client/src/dom/projectsList.js`, `client/src/main.js`.

---

## Task 13: Tag-pill filtering on the public list

**Files:**
- Modify: `client/src/dom/projectsList.js`

- [ ] **Step 1: Replace `client/src/dom/projectsList.js`**

```js
import { supabase } from '../lib/supabase.js';

let projects = [];
let activeTag = null; // null = "All"

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
  renderPills();
  renderList();
  attachPillHandler();
}

function uniqueTags() {
  const set = new Set();
  for (const p of projects) {
    for (const t of p.tags ?? []) set.add(t);
  }
  return [...set].sort();
}

function renderPills() {
  const bar = document.querySelector('#projects-pills');
  if (!bar) return;
  const tags = uniqueTags();
  if (!tags.length) {
    bar.hidden = true;
    bar.innerHTML = '';
    return;
  }
  bar.hidden = false;
  const pillButtons = [
    `<button type="button" class="projects__pill" data-tag="" aria-pressed="${activeTag === null}">All</button>`,
    ...tags.map(t => `<button type="button" class="projects__pill" data-tag="${esc(t)}" aria-pressed="${activeTag === t}">${esc(t)}</button>`),
  ];
  bar.innerHTML = pillButtons.join('');
}

function attachPillHandler() {
  const bar = document.querySelector('#projects-pills');
  if (!bar) return;
  bar.addEventListener('click', (e) => {
    const btn = e.target.closest('button.projects__pill');
    if (!btn) return;
    const tag = btn.dataset.tag === '' ? null : btn.dataset.tag;
    activeTag = activeTag === tag ? null : tag;
    renderPills();
    renderList();
  });
}

function visible() {
  if (activeTag === null) return projects;
  return projects.filter(p => (p.tags ?? []).includes(activeTag));
}

function renderList() {
  const list = document.querySelector('#projects-list');
  list.removeAttribute('aria-busy');

  if (!projects.length) {
    list.innerHTML = `<li class="projects__empty">No projects yet</li>`;
    return;
  }

  const items = visible();
  if (!items.length) {
    list.innerHTML = `
      <li class="projects__empty">
        No projects match this filter.
        <button type="button" class="projects__pill" data-reset>Clear filter</button>
      </li>
    `;
    list.querySelector('[data-reset]')?.addEventListener('click', () => {
      activeTag = null;
      renderPills();
      renderList();
    });
    return;
  }

  list.innerHTML = items.map(card).join('');
}

function card(p) {
  const primaryLink = p.demo_url || p.repo_url || '#';
  const media = p.screenshot_url
    ? `<img src="${esc(p.screenshot_url)}" alt="${esc(p.title)} screenshot" loading="lazy" />`
    : `<div class="projects__media-fallback"></div>`;

  return `
    <li class="projects__card">
      <a class="projects__media" href="${esc(primaryLink)}" target="_blank" rel="noopener">${media}</a>
      <h3>${esc(p.title)}</h3>
      <p>${esc(p.summary)}</p>
      ${p.tech_stack?.length
        ? `<ul class="projects__tech">${p.tech_stack.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`
        : ''}
      <div class="projects__links">
        ${p.demo_url ? `<a href="${esc(p.demo_url)}" target="_blank" rel="noopener">Demo</a>` : ''}
        ${p.repo_url ? `<a href="${esc(p.repo_url)}" target="_blank" rel="noopener">Code</a>` : ''}
      </div>
    </li>
  `;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
```

- [ ] **Step 2: Verify pill filtering**

Seed at least three published projects with overlapping and unique tags, e.g.:
- Project A — tags `web, 3d`
- Project B — tags `web, api`
- Project C — tags `cli`

Run `npm --prefix client run dev`. Open `/`, scroll to Work.

Expected:
- Pill bar shows `All`, `3d`, `api`, `cli`, `web`.
- `All` is the active pill (aria-pressed=true).
- Click `web` → only A and B render. `web` is now active, `All` is not.
- Click `web` again → resets to `All`, all three render.
- Click `cli` → only C renders.
- Click `3d` then add a project that has no tags matching it (or filter to a tag with zero matches) → "No projects match this filter" + Clear filter button. Click Clear filter → resets.

Stop the dev server.

- [ ] **Step 3: Pause for user commit**

Suggested message:
```
feat: add tag-pill filtering on public projects list
```
Files staged: `client/src/dom/projectsList.js`.

---

## Task 14: Styling pass — projects cards/pills + admin polish

**Files:**
- Modify: `client/src/styles/components/projects.css`

- [ ] **Step 1: Read the current `projects.css`**

Skim `client/src/styles/components/projects.css` to see what's already styled. If the file is sparse, the rules below replace it; if rich, integrate by adding only the new selectors (`.projects__pill`, `.projects__pills`, `.projects__card`, `.projects__media`, `.projects__media-fallback`, `.projects__tech`, `.projects__links`, `.projects__loading`, `.projects__empty`, `.projects__error`).

- [ ] **Step 2: Add styles for the new selectors**

Append (or replace, depending on file state) with:

```css
.projects {
  list-style: none;
  padding: 0;
  margin: 24px 0 0 0;
  display: grid;
  gap: 24px;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
}

.projects__pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

.projects__pill {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: inherit;
  padding: 6px 14px;
  border-radius: 999px;
  font: inherit;
  font-size: 13px;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.projects__pill:hover { border-color: rgba(255, 255, 255, 0.4); }
.projects__pill[aria-pressed="true"] {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.55);
}

.projects__card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 16px;
}

.projects__media {
  display: block;
  aspect-ratio: 16 / 10;
  width: 100%;
  border-radius: 6px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.04);
}
.projects__media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.projects__media-fallback {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01));
}

.projects__card h3 { margin: 8px 0 0; font-weight: 400; }
.projects__card p { margin: 0; color: rgba(255,255,255,0.7); }

.projects__tech {
  list-style: none;
  padding: 0;
  margin: 4px 0 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.projects__tech li {
  font-size: 12px;
  letter-spacing: 0.05em;
  background: rgba(255, 255, 255, 0.05);
  padding: 3px 8px;
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.78);
}

.projects__links {
  margin-top: 6px;
  display: flex;
  gap: 12px;
}
.projects__links a {
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.projects__loading,
.projects__empty,
.projects__error {
  list-style: none;
  color: rgba(255, 255, 255, 0.55);
  padding: 16px 0;
}
.projects__error { color: rgba(255, 110, 110, 0.85); }
```

- [ ] **Step 3: Verify visual polish**

Run `npm --prefix client run dev`. Open `/`, scroll to Work. Expected:
- Cards in a responsive grid (1–3 columns depending on viewport).
- Pills as rounded outlines, active pill filled.
- Hover states feel responsive.
- Image aspect ratio stable while loading (no layout shift).

Open `/admin.html` and confirm the form still looks tidy (Task 5's admin styles are unchanged). No regression.

- [ ] **Step 4: Pause for user commit**

Suggested message:
```
feat: style projects cards and tag-pill filter
```
Files staged: `client/src/styles/components/projects.css`.

---

## Task 15: Update `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Move "Projects showcase" from "Planned" to "Recently shipped"**

In `CLAUDE.md`:
1. Under **## Recently shipped**, prepend a new bullet (above the contact-form bullet) with today's date and pointers to the spec + plan:

```
- **Projects showcase** (2026-05-09) — DB-backed projects list (replaces
  hardcoded Work.js), `/admin` dashboard with GitHub OAuth, screenshot
  uploads, and tag-pill filtering. Backend: Supabase (Postgres + Auth +
  Storage). Public reads gated by `published=true` RLS; writes owner-only.
  Multi-page Vite (`client/admin.html`). Spec:
  `docs/superpowers/specs/2026-05-01-projects-showcase-design.md`.
  Plan: `docs/superpowers/plans/2026-05-09-projects-showcase.md`.
```

2. Under **## Currently building**, replace the contents with: `*Nothing in progress.*` plus the next-up note (the AI chat widget per the highlight picks).

3. Under **### Project structure**, the `pages/` and `partials/` "placeholder" lines may need updating (`pages/admin.js` is now real). Optional polish — not strictly required for ship.

4. Under **### Projects showcase** in "Planned features (roadmap)", remove the bullets that are now done (DB-backed list, CMS-style management, filtering by tag). Keep the stretch ideas (search bar, image gallery, etc.) if you want them on the roadmap.

- [ ] **Step 2: Verify**

`git diff CLAUDE.md` should show only changes to the three sections above. No other content drift.

- [ ] **Step 3: Pause for user commit**

Suggested message:
```
docs: mark projects showcase as shipped in CLAUDE.md
```
Files staged: `CLAUDE.md`.

---

## Task 16: Production deploy + smoke test

**Files:** none (deploy + verification)

- [ ] **Step 1: Set Vercel environment variables**

Vercel dashboard → portfolio project → Settings → Environment Variables. Add (Production + Preview + Development):
- `VITE_SUPABASE_URL` = (the Supabase project URL)
- `VITE_SUPABASE_PUBLISHABLE_KEY` = (the Supabase anon JWT)

- [ ] **Step 2: Push and verify deploy**

Push the branch. Vercel should auto-build. Check the build log:
- Build emits `dist/index.html` AND `dist/admin.html`.
- No "missing env var" warnings.

- [ ] **Step 3: Run the spec's smoke test list against production**

At `https://portfolio.jkylec.dev` and `https://portfolio.jkylec.dev/admin`, walk through the 13 smoke tests from the spec (`docs/superpowers/specs/2026-05-01-projects-showcase-design.md`, "Verification" section):

  1. Public list renders with the seeded projects (screenshots, titles, summaries, chips, links).
  2. Filtering — each pill narrows correctly. `All` resets. Active pill has visible state.
  3. Drafts hidden — toggle a project to `published=false` in admin → disappears from `/` after refresh, still shows in `/admin`.
  4. Featured ordering — toggle `featured=true` → moves to front of public list after refresh.
  5. Sign in to `/admin` with the owner GitHub account → dashboard loads.
  6. Sign in with a different GitHub account → "Not authorized" screen. In devtools, run `(await import('/src/lib/supabase.js')).supabase.from('projects').insert({ slug: 'pwn', title: 'pwn', summary: 'x' }).then(console.log)` → returns an RLS error.
  7. Create a project with a screenshot → appears in admin list and on `/` (with `published=true`) after refresh.
  8. Edit a project — change title only → row updates, file untouched.
  9. Edit a slug — old screenshot file removed from Storage after the new one uploads (verify in Supabase Storage UI).
  10. Re-upload a screenshot — file overwritten in place (same URL, new contents).
  11. Delete a project — row gone from `projects`, image file remains in Storage (intentional non-goal).
  12. Local dev (`npm run dev`) flow worked throughout (already verified in Tasks 4–13).
  13. Production smoke (this task).

- [ ] **Step 4: Sanity-check the public bundle**

In devtools Network tab on `https://portfolio.jkylec.dev/`, confirm `admin.css` is NOT loaded on the public site (should only be loaded on `/admin`).

- [ ] **Step 5: Done**

If all 13 smoke tests pass, the feature is shipped. The roadmap moves on to the next item (AI chat widget per the highlight picks in `CLAUDE.md`).

---

## Notes / known limitations (carried forward from spec)

- No automated tests. Manual verification only.
- No image processing pipeline (owner uploads what they want shown).
- Single screenshot per project — gallery is a future feature.
- Row delete does NOT remove the file from Storage. Slug-change still cleans up. Bulk cleanup is a future maintenance task.
- Admin auth = GitHub-OAuth-only. If GitHub is down, edit via Supabase Studio directly.
- `<OWNER_EMAIL>` is hardcoded as `'jkylecadap@gmail.com'` in three places: `client/src/admin/auth.js`, `supabase/schema.sql` (already substituted), and the running RLS policies in Supabase. If the owner email ever changes, update all three.
