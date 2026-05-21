# Skills Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded `<ul>` in `Skills.js` with a category-tabbed icon grid whose contents are the union of a new Supabase `skills` table (owner-managed via `/admin`) and every `tech_stack` / `tags` string from published projects.

**Architecture:** Public site fetches `skills` + `projects` from Supabase in parallel, dedupes case-insensitively (skills-table casing wins, project-only names land under an `other` tab), groups by category, renders an All-plus-categories tab strip and a 4-column icon-card grid. Admin gets a Projects ↔ Skills top-nav toggle with standard CRUD plus a "scan projects for missing skills" helper. Icons are devicon SVGs served from jsDelivr; the form has a "Devicon slug" helper that auto-builds the canonical URL.

**Tech Stack:** Vite + vanilla JS frontend, Supabase (Postgres + Auth + RLS) for storage, devicon CDN for icons. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-14-skills-section-design.md`.

**Verification model:** This project has no automated test suite (per `AGENTS.md`). Each task ends with `npm run build` from repo root and a browser smoke check at `http://localhost:5173` (`npm run dev`) — both must pass before committing.

**Commit hygiene:** The user handles every commit. After each task, stop and tell the user the task is ready for commit — do NOT run `git add`, `git commit`, or `git push` from any task or subagent.

---

## File Structure

**Created:**
- `client/src/dom/skillsList.js` — fetch skills + projects, dedupe + group, render tab strip + icon grid. Mirrors `dom/projectsList.js`.
- `client/src/admin/skillsAdmin.js` — admin Skills view: list rows, delete confirm, "Scan projects for missing skills" button. Mirrors the existing project-list block inside `admin/dashboard.js`.
- `client/src/admin/skillForm.js` — admin create/edit form with devicon slug helper + live icon preview. Mirrors `admin/projectForm.js`, much smaller.

**Modified:**
- `supabase/schema.sql` — append the `skills` table block (create table + indexes + trigger + RLS).
- `client/src/components/Skills.js` — replace hardcoded `<ul>` with the new scaffold (tabs + grid + loading state). Change `.section--right` → `.section--left`.
- `client/src/styles/components/skills.css` — rewrite: scoped 36rem waypoint, tab strip, 4-column icon-card grid, mobile collapse to 2 columns, loading/empty/error states.
- `client/src/admin/dashboard.js` — extract the project list into its own internal view function; add Projects/Skills top-nav buttons that switch between project view and the new skills view.
- `client/src/main.js` — import `initSkillsList` and call it once at boot alongside `initProjectsList()`.
- `CLAUDE.md` — add Skills section to Recently shipped + extend the `dom/` and `admin/` bullets to mention the new files.

**Untouched:**
- All Three.js scene code (`client/src/three/*`). Jupiter's section binding stays put; only the HTML content layout flips from right to left.
- `client/src/lib/supabase.js` — shared client is reused.
- `client/src/admin/auth.js` — GitHub OAuth gate already covers the new skills routes (they're nested inside the same authorized dashboard).

---

### Task 1: Add the `skills` table to Supabase + commit schema reference

**Why first:** every subsequent task fetches from or writes to this table. The repo's `supabase/schema.sql` is a *reference copy* — Supabase Studio is the source of truth. Apply the SQL in Studio, then paste it into the file.

**Files:**
- Modify: `supabase/schema.sql` (append at end of file)

- [ ] **Step 1: Append the schema block to `supabase/schema.sql`**

Append the following at the bottom of the file (after the storage policies). It reuses the existing `set_updated_at()` trigger function defined earlier in the file — do not redeclare it.

```sql

-- Skills table (added 2026-05-14). Owner-managed via /admin; rendered on
-- the public Skills section unioned with project tech_stack/tags strings.

create table skills (
  id           uuid primary key default gen_random_uuid(),
  name         text unique not null,
  category     text not null check (category in (
    'frameworks', 'languages', 'apis', 'testing', 'databases', 'tools'
  )),
  icon_url     text,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index skills_category_idx on skills (category);
create index skills_sort_idx on skills (sort_order asc, name asc);

create trigger skills_set_updated_at
  before update on skills
  for each row execute function set_updated_at();

alter table skills enable row level security;

create policy "public reads all skills"
  on skills for select
  using (true);

create policy "owner inserts skills"
  on skills for insert
  with check (auth.email() = 'jkylecadap@gmail.com');

create policy "owner updates skills"
  on skills for update
  using (auth.email() = 'jkylecadap@gmail.com')
  with check (auth.email() = 'jkylecadap@gmail.com');

create policy "owner deletes skills"
  on skills for delete
  using (auth.email() = 'jkylecadap@gmail.com');
```

- [ ] **Step 2: Apply the same SQL in Supabase Studio**

In the Supabase dashboard for this project: open **SQL Editor** → New query → paste the block above → Run. Expected: "Success. No rows returned." If the table already exists from a prior attempt, the `create table` will error — that's fine, leave it.

- [ ] **Step 3: Verify the table is queryable**

In Supabase Studio → **Table Editor** → confirm a `skills` table now appears. Click **Insert row**, set `name=React`, `category=frameworks`, `icon_url=https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/react/react-original.svg`, `sort_order=0`, Save. Then `Delete row` to clean up.

- [ ] **Step 4: Verify the build still works**

Run from repo root:

```bash
npm run build
```

Expected: build exits 0. (No frontend code changed — this just sanity-checks the working tree.)

- [ ] **Step 5: Stop for user commit**

Tell the user: "Task 1 done — schema reference appended and table created in Studio. Ready for commit." Do not run git commands.

---

### Task 2: Public HTML scaffold + CSS rewrite

**Why second:** lands the new section markup + styles so the rest of the work has a real DOM target. The grid will be empty (showing the loading state) until Task 3 wires in the fetch.

**Files:**
- Modify: `client/src/components/Skills.js`
- Modify: `client/src/styles/components/skills.css`

- [ ] **Step 1: Replace `Skills.js` with the new scaffold**

Overwrite the entire file with:

```js
export const Skills = () => `
  <section id="skills" data-spin="skills" class="section section--left">
    <div class="waypoint">
      <p class="eyebrow">02</p>
      <h2>Skills</h2>
      <div class="divider"></div>
      <div id="skills-tabs" class="skills__tabs" hidden></div>
      <ul id="skills-grid" class="skills__grid" aria-busy="true">
        <li class="skills__loading">Loading…</li>
      </ul>
    </div>
  </section>
`;
```

Notes:
- Section flips from `section--right` (old) to `section--left` (new) per spec.
- Grid is a `<ul>` to match `projects-list` precedent (`Work.js:8` uses the same pattern). Cards will be `<li class="skills__card">`.
- `#skills-tabs` is `hidden` by default and only revealed once `skillsList.js` has data.

- [ ] **Step 2: Replace `skills.css` with the new ruleset**

Overwrite the entire file with:

```css
#skills .waypoint {
  max-width: min(36rem, calc(100vw - 10rem));
}

.skills__tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 1rem 0 1.25rem;
}

.skills__tab {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: inherit;
  padding: 0.35rem 0.9rem;
  border-radius: 999px;
  font: inherit;
  font-size: 0.8125rem;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.skills__tab:hover {
  border-color: rgba(255, 255, 255, 0.4);
}
.skills__tab[aria-pressed="true"] {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.55);
}

.skills__grid {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem;
}

.skills__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  padding: 1.1rem 0.6rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  transition: border-color 0.15s, background 0.15s, transform 0.15s;
}
.skills__card:hover {
  border-color: rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.06);
  transform: translateY(-2px);
}
.skills__card img {
  width: 48px;
  height: 48px;
  display: block;
}
.skills__card-fallback {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.75);
  font-size: 1.1rem;
  letter-spacing: 0;
}
.skills__card-name {
  font-size: 0.8125rem;
  color: rgba(255, 255, 255, 0.85);
  text-align: center;
  line-height: 1.2;
}

.skills__loading,
.skills__empty,
.skills__error {
  list-style: none;
  grid-column: 1 / -1;
  color: rgba(255, 255, 255, 0.55);
  padding: 1rem 0;
  font-size: 0.875rem;
}
.skills__error {
  color: rgba(255, 110, 110, 0.85);
}

@media (max-width: 480px) {
  .skills__grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
```

Notes:
- Loading / empty / error messages set `grid-column: 1 / -1` so they span the whole grid when shown inside the `<ul>`.
- No JS changes yet — the grid will keep showing "Loading…" forever until Task 3 lands.

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: exits 0. No new imports, so this should just succeed.

- [ ] **Step 4: Smoke check in the browser**

```bash
npm run dev
```

Open `http://localhost:5173`, scroll to the Skills section. Expected:
- Section content sits on the **left** side now (was right).
- Waypoint visibly wider than the About/Contact text columns.
- Old pill-style grid is gone — "Loading…" appears in its place.
- No console errors.

- [ ] **Step 5: Stop for user commit**

Task 2 ready. Hand off.

---

### Task 3: `dom/skillsList.js` — fetch + dedupe + render (no tabs yet)

**Why now:** gets data on screen. Tabs are next; defer them so this task has a single concern.

**Files:**
- Create: `client/src/dom/skillsList.js`
- Modify: `client/src/main.js`

- [ ] **Step 1: Create `client/src/dom/skillsList.js`**

```js
import { supabase } from '../lib/supabase.js';

const CATEGORY_ORDER = ['frameworks', 'languages', 'apis', 'testing', 'databases', 'tools', 'other'];

let unionMap = new Map(); // key = name.toLowerCase()

export async function initSkillsList() {
  const grid = document.querySelector('#skills-grid');
  if (!grid) return;

  const [skillsRes, projectsRes] = await Promise.all([
    supabase.from('skills').select('*').order('sort_order').order('name'),
    supabase.from('projects').select('tech_stack,tags').eq('published', true),
  ]);

  if (skillsRes.error || projectsRes.error) {
    grid.removeAttribute('aria-busy');
    grid.innerHTML = `<li class="skills__error">Couldn't load skills — refresh to try again.</li>`;
    return;
  }

  unionMap = buildUnion(skillsRes.data ?? [], projectsRes.data ?? []);
  renderGrid();
}

function buildUnion(skills, projects) {
  const map = new Map();
  for (const s of skills) {
    const trimmed = String(s.name ?? '').trim();
    if (!trimmed) continue;
    map.set(trimmed.toLowerCase(), {
      name: trimmed,
      category: s.category,
      icon_url: s.icon_url ?? null,
      sort_order: s.sort_order ?? 0,
    });
  }
  for (const p of projects) {
    const strings = [...(p.tech_stack ?? []), ...(p.tags ?? [])];
    for (const raw of strings) {
      const name = String(raw ?? '').trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (map.has(key)) continue;
      map.set(key, { name, category: 'other', icon_url: null, sort_order: 0 });
    }
  }
  return map;
}

function sortFn(a, b) {
  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
  return a.name.localeCompare(b.name);
}

function renderGrid() {
  const grid = document.querySelector('#skills-grid');
  if (!grid) return;
  grid.removeAttribute('aria-busy');

  if (!unionMap.size) {
    grid.innerHTML = `<li class="skills__empty">No skills yet.</li>`;
    return;
  }

  const items = [...unionMap.values()].sort(sortFn);
  grid.innerHTML = items.map(card).join('');
  attachIconFallbacks(grid);
}

function card(s) {
  const initial = s.name.charAt(0).toUpperCase();
  const icon = s.icon_url
    ? `<img src="${esc(s.icon_url)}" alt="" width="48" height="48" loading="lazy" data-fallback="${esc(initial)}" />`
    : `<div class="skills__card-fallback">${esc(initial)}</div>`;
  return `
    <li class="skills__card">
      ${icon}
      <span class="skills__card-name">${esc(s.name)}</span>
    </li>
  `;
}

function attachIconFallbacks(root) {
  root.querySelectorAll('img[data-fallback]').forEach(img => {
    img.addEventListener('error', () => {
      const div = document.createElement('div');
      div.className = 'skills__card-fallback';
      div.textContent = img.dataset.fallback;
      img.replaceWith(div);
    }, { once: true });
  });
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// CATEGORY_ORDER is exported for Task 4 (tab strip).
export { CATEGORY_ORDER };
```

Notes:
- `attachIconFallbacks` swaps broken `<img>` for a monochrome rounded initial. `{ once: true }` keeps the listener from firing twice.
- The exported `CATEGORY_ORDER` is unused inside the file right now; it's exported for Task 4 to import. (YAGNI exception: it's literally one line and the alternative is moving the constant in Task 4, which churns this file again. Leave it.)
- All names are trimmed before being added to the map — matches the spec's "Edge cases → Trimming" rule.

- [ ] **Step 2: Wire `initSkillsList()` into `main.js`**

In `client/src/main.js`, find the import block around lines 28–31 and add the new import:

Old:
```js
import { initSectionObserver } from './dom/sectionObserver.js';
import { initContactForm } from './dom/contactForm.js';
import { initProjectsList } from './dom/projectsList.js';
```

New:
```js
import { initSectionObserver } from './dom/sectionObserver.js';
import { initContactForm } from './dom/contactForm.js';
import { initProjectsList } from './dom/projectsList.js';
import { initSkillsList } from './dom/skillsList.js';
```

Then in the same file find the init call block near lines 113–115:

Old:
```js
initSectionObserver();
initContactForm();
initProjectsList();
```

New:
```js
initSectionObserver();
initContactForm();
initProjectsList();
initSkillsList();
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: exits 0.

- [ ] **Step 4: Smoke check in browser**

`npm run dev`, open `http://localhost:5173`, scroll to Skills. Expected (with the `skills` table currently empty):
- Brief "Loading…" then either "No skills yet." (if no published projects with tech_stack/tags) or a flat grid populated entirely from project tech_stack + tags (everything will be in the `other` category, displayed as one big flat grid — tabs come next task).
- No console errors.

If you want to see a populated grid, add 2–3 rows directly in Supabase Studio Table Editor (`skills` table): e.g. `(React, frameworks, https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/react/react-original.svg, 0)`. Refresh — the cards should appear.

- [ ] **Step 5: Stop for user commit**

Task 3 ready.

---

### Task 4: Tab strip + filtering + Other-hidden-when-empty

**Files:**
- Modify: `client/src/dom/skillsList.js`

- [ ] **Step 1: Add tab state + label map + tab render to `skillsList.js`**

At the top of `skillsList.js`, just below the existing `CATEGORY_ORDER` constant declaration, add:

```js
const CATEGORY_LABELS = {
  frameworks: 'Frameworks',
  languages: 'Languages',
  apis: 'APIs',
  testing: 'Testing',
  databases: 'Databases',
  tools: 'Tools / DevOps',
  other: 'Other',
};
```

Below the `let unionMap = new Map();` line, add:

```js
let activeTab = 'all';
```

- [ ] **Step 2: Replace `initSkillsList`'s success block to also render tabs + attach handler**

In `initSkillsList`, after `unionMap = buildUnion(...)`, change the body from:

```js
  unionMap = buildUnion(skillsRes.data ?? [], projectsRes.data ?? []);
  renderGrid();
}
```

to:

```js
  unionMap = buildUnion(skillsRes.data ?? [], projectsRes.data ?? []);
  renderTabs();
  renderGrid();
  attachTabHandler();
}
```

- [ ] **Step 3: Add the tab-render + filter helpers**

Below the existing `sortFn` function in `skillsList.js`, add:

```js
function hasOther() {
  for (const s of unionMap.values()) {
    if (s.category === 'other') return true;
  }
  return false;
}

function renderTabs() {
  const tabs = document.querySelector('#skills-tabs');
  if (!tabs) return;
  if (!unionMap.size) {
    tabs.hidden = true;
    tabs.innerHTML = '';
    return;
  }
  tabs.hidden = false;

  const keys = ['all', 'frameworks', 'languages', 'apis', 'testing', 'databases', 'tools'];
  if (hasOther()) keys.push('other');

  tabs.innerHTML = keys.map(key => {
    const label = key === 'all' ? 'All' : CATEGORY_LABELS[key];
    const pressed = activeTab === key;
    return `<button type="button" class="skills__tab" data-tab="${esc(key)}" aria-pressed="${pressed}">${esc(label)}</button>`;
  }).join('');
}

function attachTabHandler() {
  const tabs = document.querySelector('#skills-tabs');
  if (!tabs) return;
  tabs.addEventListener('click', (e) => {
    const btn = e.target.closest('button.skills__tab');
    if (!btn) return;
    activeTab = btn.dataset.tab;
    renderTabs();
    renderGrid();
  });
}

function visibleSkills() {
  const arr = [...unionMap.values()];
  if (activeTab === 'all') return arr.sort(sortFn);
  return arr.filter(s => s.category === activeTab).sort(sortFn);
}
```

- [ ] **Step 4: Switch `renderGrid` to use `visibleSkills`**

In `renderGrid`, replace:

```js
  const items = [...unionMap.values()].sort(sortFn);
  grid.innerHTML = items.map(card).join('');
  attachIconFallbacks(grid);
```

with:

```js
  const items = visibleSkills();
  if (!items.length) {
    grid.innerHTML = `<li class="skills__empty">No skills in this category.</li>`;
    return;
  }
  grid.innerHTML = items.map(card).join('');
  attachIconFallbacks(grid);
```

- [ ] **Step 5: Verify build**

```bash
npm run build
```

Expected: exits 0.

- [ ] **Step 6: Smoke check in browser**

`npm run dev`, open `http://localhost:5173`, scroll to Skills.

Expected:
- Tab strip is visible: **All · Frameworks · Languages · APIs · Testing · Databases · Tools** (and `Other` only if at least one project tag/tech isn't in the `skills` table).
- All tab is active by default (filled pill).
- Click each tab — the grid filters, active tab changes pill style.
- Clicking the active tab does not toggle off (unlike projects pills) — it stays active. That matches the spec.
- Empty categories show "No skills in this category."
- Other tab disappears as soon as you add a `skills` row matching every project tag/tech (verify by adding skill rows in Studio to cover the project strings, then refresh).

- [ ] **Step 7: Stop for user commit**

Task 4 ready.

---

### Task 5: Admin Projects/Skills nav split

**Why now:** the public side ships first (Tasks 1–4 = visible site improvement). Now turn to the admin pivot. This task ONLY splits the dashboard into two views — the new Skills view is a placeholder until Task 6.

**Files:**
- Modify: `client/src/admin/dashboard.js`
- Create: `client/src/admin/skillsAdmin.js` (placeholder)

- [ ] **Step 1: Create the `skillsAdmin.js` placeholder**

`client/src/admin/skillsAdmin.js`:

```js
// Skills admin view. Placeholder in Task 5 — list + delete land in Task 6,
// form lands in Task 7, scan-projects in Task 8.

export function renderSkillsAdmin(mountNode) {
  mountNode.innerHTML = `
    <header style="display:flex; justify-content:space-between; align-items:center;">
      <h1>Skills</h1>
      <div>
        <button id="new-skill">+ New skill</button>
      </div>
    </header>
    <p>Skills admin coming online — Task 6 wires the list.</p>
  `;
}
```

- [ ] **Step 2: Restructure `dashboard.js` to support two views**

Replace the entire contents of `client/src/admin/dashboard.js` with:

```js
import { supabase } from '../lib/supabase.js';
import { renderProjectForm } from './projectForm.js';
import { renderSkillsAdmin } from './skillsAdmin.js';

let cachedProjects = [];
let currentView = 'projects'; // 'projects' | 'skills'

export async function renderDashboard(mountNode) {
  mountNode.innerHTML = `
    <nav class="admin-nav" style="display:flex; gap:0.5rem; align-items:center; margin-bottom:1.5rem;">
      <button id="nav-projects" class="${currentView === 'projects' ? '' : 'secondary'}">Projects</button>
      <button id="nav-skills" class="${currentView === 'skills' ? '' : 'secondary'}">Skills</button>
      <div style="flex:1;"></div>
      <button id="signout" class="secondary">Sign out</button>
    </nav>
    <div id="view-mount"></div>
  `;

  mountNode.querySelector('#signout').addEventListener('click', async () => {
    await supabase.auth.signOut();
  });

  mountNode.querySelector('#nav-projects').addEventListener('click', () => {
    currentView = 'projects';
    renderDashboard(mountNode);
  });
  mountNode.querySelector('#nav-skills').addEventListener('click', () => {
    currentView = 'skills';
    renderDashboard(mountNode);
  });

  const view = mountNode.querySelector('#view-mount');
  if (currentView === 'projects') {
    await renderProjectsView(view);
  } else {
    renderSkillsAdmin(view);
  }
}

async function renderProjectsView(mountNode) {
  mountNode.innerHTML = `
    <header style="display:flex; justify-content:space-between; align-items:center;">
      <h1>Projects</h1>
      <div>
        <button id="new-project">+ New project</button>
      </div>
    </header>
    <div id="dashboard-error"></div>
    <div id="dashboard-body"><p>Loading…</p></div>
  `;

  mountNode.querySelector('#new-project').addEventListener('click', () => {
    renderProjectForm(mountNode, null, () => renderProjectsView(mountNode));
  });

  await loadAndRenderProjectsList(mountNode);
}

async function loadAndRenderProjectsList(mountNode) {
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

  cachedProjects = data;

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
    btn.addEventListener('click', () => handleProjectDelete(mountNode, btn.dataset.id, btn.dataset.title));
  });
  body.querySelectorAll('button[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const project = cachedProjects.find(p => p.id === btn.dataset.id);
      if (!project) return;
      renderProjectForm(mountNode, project, () => renderProjectsView(mountNode));
    });
  });
}

async function handleProjectDelete(mountNode, id, title) {
  if (!confirm(`Delete "${title}"?`)) return;
  const errorBox = mountNode.querySelector('#dashboard-error');
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) {
    errorBox.innerHTML = `<p class="error">Delete failed: ${escapeText(error.message)}</p>`;
    return;
  }
  await loadAndRenderProjectsList(mountNode);
}

function escapeText(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
```

Notes:
- `currentView` is a module-level let so a re-render via Projects/Skills click preserves it.
- The cancel button on the project form previously routed to `renderDashboard(mountNode)`, which would have reset to the top-level dashboard. The new pattern routes form cancellations back to `renderProjectsView(mountNode)` — same outcome (project list view), and avoids re-rendering the nav bar unnecessarily. This is intentional, not a regression.

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: exits 0.

- [ ] **Step 4: Smoke check in browser**

Run `npm run dev`, open `http://localhost:5173/admin.html` (or `/admin` per the existing Vite routing — whichever is the configured entry). Sign in as the owner GitHub account if not already.

Expected:
- Top nav row: **Projects** (filled button, current view) + **Skills** (secondary/outline button) + **Sign out** on the far right.
- Default view: Projects list, identical to before.
- Click Skills → header swaps to "Skills" + "+ New skill" button + the placeholder paragraph.
- Click Projects → back to the project list.
- Click Edit on a project → goes into edit form. Cancel returns to the project list (not the top nav).
- Sign out works.

- [ ] **Step 5: Stop for user commit**

Task 5 ready.

---

### Task 6: Skills admin list view (read + delete)

**Files:**
- Modify: `client/src/admin/skillsAdmin.js`

- [ ] **Step 1: Replace `skillsAdmin.js` placeholder with the full list view**

Overwrite `client/src/admin/skillsAdmin.js` with:

```js
import { supabase } from '../lib/supabase.js';

const CATEGORY_LABELS = {
  frameworks: 'Frameworks',
  languages: 'Languages',
  apis: 'APIs',
  testing: 'Testing',
  databases: 'Databases',
  tools: 'Tools / DevOps',
};

let cachedSkills = [];

export function renderSkillsAdmin(mountNode) {
  mountNode.innerHTML = `
    <header style="display:flex; justify-content:space-between; align-items:center;">
      <h1>Skills</h1>
      <div>
        <button id="new-skill">+ New skill</button>
        <button id="scan-projects" class="secondary">Scan projects for missing skills</button>
      </div>
    </header>
    <div id="skills-error"></div>
    <div id="scan-result"></div>
    <div id="skills-body"><p>Loading…</p></div>
  `;

  mountNode.querySelector('#new-skill').addEventListener('click', () => {
    // Form wired in Task 7.
    alert('Skill form not implemented yet — Task 7.');
  });
  mountNode.querySelector('#scan-projects').addEventListener('click', () => {
    // Scan wired in Task 8.
    alert('Scan not implemented yet — Task 8.');
  });

  loadAndRenderList(mountNode);
}

async function loadAndRenderList(mountNode) {
  const body = mountNode.querySelector('#skills-body');
  const errorBox = mountNode.querySelector('#skills-error');
  errorBox.innerHTML = '';

  const { data, error } = await supabase
    .from('skills')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    errorBox.innerHTML = `<p class="error">Failed to load skills: ${esc(error.message)}</p>`;
    body.innerHTML = '';
    return;
  }

  cachedSkills = data ?? [];

  if (!cachedSkills.length) {
    body.innerHTML = `<p>No skills yet. Click "+ New skill" to add one, or "Scan projects" to import names from existing projects.</p>`;
    return;
  }

  const rows = cachedSkills.map(s => `
    <tr>
      <td>
        ${s.icon_url
          ? `<img src="${esc(s.icon_url)}" alt="" width="24" height="24" style="display:block;" />`
          : `<div style="width:24px; height:24px; background:#1f2330; border-radius:4px;"></div>`}
      </td>
      <td><strong>${esc(s.name)}</strong></td>
      <td>${esc(CATEGORY_LABELS[s.category] ?? s.category)}</td>
      <td>${s.sort_order}</td>
      <td>
        <button class="secondary" data-action="edit" data-id="${s.id}">Edit</button>
        <button class="danger" data-action="delete" data-id="${s.id}" data-name="${esc(s.name)}">Delete</button>
      </td>
    </tr>
  `).join('');

  body.innerHTML = `
    <table>
      <thead>
        <tr><th>Icon</th><th>Name</th><th>Category</th><th>Order</th><th></th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  body.querySelectorAll('button[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => handleDelete(mountNode, btn.dataset.id, btn.dataset.name));
  });
  body.querySelectorAll('button[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => {
      // Edit wired in Task 7.
      alert('Skill form not implemented yet — Task 7.');
    });
  });
}

async function handleDelete(mountNode, id, name) {
  if (!confirm(`Delete "${name}"?`)) return;
  const errorBox = mountNode.querySelector('#skills-error');
  const { error } = await supabase.from('skills').delete().eq('id', id);
  if (error) {
    errorBox.innerHTML = `<p class="error">Delete failed: ${esc(error.message)}</p>`;
    return;
  }
  await loadAndRenderList(mountNode);
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
```

Notes:
- The `#new-skill` and edit buttons are placeholder `alert()` calls until Task 7 wires `skillForm.js`. This keeps each task small and shippable.
- `#scan-result` is reserved for Task 8's scan output. Leaving the empty div in now avoids restructuring HTML next task.

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: exits 0.

- [ ] **Step 3: Smoke check in browser**

Run `npm run dev`, navigate to `/admin.html`, click Skills tab.

Expected (assuming you added 2–3 test rows directly in Studio for Task 3's smoke test):
- Table appears: Icon (24px) · Name · Category · Order · Edit/Delete buttons.
- If empty: helpful "No skills yet" message.
- Click Edit → "Skill form not implemented yet — Task 7." alert. (Dismiss it. Per global guidance: avoid triggering more alerts.)
- Click Delete on a test skill → browser confirm → row disappears.
- Refresh public `/` Skills section — the deleted skill is gone.

- [ ] **Step 4: Stop for user commit**

Task 6 ready.

---

### Task 7: Skill form (create + edit + devicon helper)

**Files:**
- Create: `client/src/admin/skillForm.js`
- Modify: `client/src/admin/skillsAdmin.js`

- [ ] **Step 1: Create `client/src/admin/skillForm.js`**

```js
import { supabase } from '../lib/supabase.js';

const CATEGORIES = [
  { value: 'frameworks', label: 'Frameworks' },
  { value: 'languages',  label: 'Languages' },
  { value: 'apis',       label: 'APIs' },
  { value: 'testing',    label: 'Testing' },
  { value: 'databases',  label: 'Databases' },
  { value: 'tools',      label: 'Tools / DevOps' },
];

const DEVICON_URL = (slug) =>
  `https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/${slug}/${slug}-original.svg`;

// skill = null means "new skill". Otherwise it's the row being edited.
// initialName lets the scan-projects helper (Task 8) prepopulate name.
export function renderSkillForm(mountNode, skill, onDone, initialName = '') {
  const isEdit = !!skill;
  const initial = skill ?? {
    name: initialName,
    category: 'frameworks',
    icon_url: '',
    sort_order: 0,
  };

  mountNode.innerHTML = `
    <header style="display:flex; justify-content:space-between; align-items:center;">
      <h1>${isEdit ? 'Edit skill' : 'New skill'}</h1>
      <button id="cancel" class="secondary">Cancel</button>
    </header>
    <div id="form-error"></div>
    <form id="skill-form">
      <label for="name">Name</label>
      <input id="name" name="name" required value="${esc(initial.name)}" />

      <label for="category">Category</label>
      <select id="category" name="category" required>
        ${CATEGORIES.map(c =>
          `<option value="${c.value}" ${initial.category === c.value ? 'selected' : ''}>${esc(c.label)}</option>`
        ).join('')}
      </select>

      <label for="devicon-slug">Devicon slug (optional helper)</label>
      <input id="devicon-slug" type="text" placeholder="e.g. react, python, postgresql" />
      <p style="margin:4px 0 0; font-size:12px; color:var(--muted);">
        Type a slug from <a href="https://devicon.dev/" target="_blank" rel="noopener">devicon.dev</a>; the Icon URL below auto-fills.
      </p>

      <label for="icon_url">Icon URL</label>
      <input id="icon_url" name="icon_url" type="url" value="${esc(initial.icon_url ?? '')}" />
      <div style="margin-top:6px;">
        <img id="icon-preview" alt="" style="width:48px; height:48px; display:${initial.icon_url ? 'block' : 'none'};" ${initial.icon_url ? `src="${esc(initial.icon_url)}"` : ''} />
        <span id="icon-preview-error" class="error" style="display:none; font-size:12px;">Couldn't load icon at that URL.</span>
      </div>

      <label for="sort_order">Sort order (lower = earlier)</label>
      <input id="sort_order" name="sort_order" type="number" value="${initial.sort_order ?? 0}" />

      <div style="margin-top:24px;">
        <button type="submit" id="save">${isEdit ? 'Save changes' : 'Create skill'}</button>
      </div>
    </form>
  `;

  const slugInput = mountNode.querySelector('#devicon-slug');
  const urlInput = mountNode.querySelector('#icon_url');
  const preview = mountNode.querySelector('#icon-preview');
  const previewError = mountNode.querySelector('#icon-preview-error');

  function setPreview(url) {
    previewError.style.display = 'none';
    if (!url) {
      preview.removeAttribute('src');
      preview.style.display = 'none';
      return;
    }
    preview.src = url;
    preview.style.display = 'block';
  }

  preview.addEventListener('load', () => { previewError.style.display = 'none'; });
  preview.addEventListener('error', () => {
    preview.style.display = 'none';
    previewError.style.display = 'inline';
  });

  slugInput.addEventListener('input', () => {
    const slug = slugInput.value.trim().toLowerCase();
    if (!slug) return;
    const url = DEVICON_URL(slug);
    urlInput.value = url;
    setPreview(url);
  });

  urlInput.addEventListener('input', () => {
    setPreview(urlInput.value.trim());
  });

  mountNode.querySelector('#cancel').addEventListener('click', () => onDone());
  mountNode.querySelector('#skill-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleSubmit(mountNode, skill, onDone);
  });
}

async function handleSubmit(mountNode, existing, onDone) {
  const errorBox = mountNode.querySelector('#form-error');
  errorBox.innerHTML = '';

  const form = mountNode.querySelector('#skill-form');
  const fd = new FormData(form);

  const name = String(fd.get('name') ?? '').trim();
  if (!name) {
    errorBox.innerHTML = `<p class="error">Name is required.</p>`;
    return;
  }

  const row = {
    name,
    category: String(fd.get('category') ?? 'frameworks'),
    icon_url: nullIfBlank(fd.get('icon_url')),
    sort_order: Number(fd.get('sort_order') ?? 0) | 0,
  };

  if (existing) row.id = existing.id;

  const { error } = await supabase.from('skills').upsert(row).select().single();
  if (error) {
    if (error.code === '23505') {
      errorBox.innerHTML = `<p class="error">A skill named "${esc(name)}" already exists.</p>`;
    } else {
      errorBox.innerHTML = `<p class="error">Save failed: ${esc(error.message)}</p>`;
    }
    return;
  }
  onDone();
}

function nullIfBlank(raw) {
  const s = String(raw ?? '').trim();
  return s.length ? s : null;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
```

Notes:
- `renderSkillForm` accepts an optional `initialName` — used in Task 8 by the scan-projects helper.
- Postgres unique-violation error code is `23505` (matches the `name` unique constraint added in Task 1).
- Live preview keys off the `icon_url` input. Typing in the devicon-slug helper auto-fills `icon_url`, which triggers the preview update too.

- [ ] **Step 2: Wire the form into `skillsAdmin.js`**

In `client/src/admin/skillsAdmin.js`, add the import at the top:

```js
import { renderSkillForm } from './skillForm.js';
```

Replace the `#new-skill` placeholder handler block (the `alert(...)` call) with:

```js
  mountNode.querySelector('#new-skill').addEventListener('click', () => {
    renderSkillForm(mountNode, null, () => renderSkillsAdmin(mountNode));
  });
```

Replace the edit-button placeholder block — find:

```js
  body.querySelectorAll('button[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => {
      // Edit wired in Task 7.
      alert('Skill form not implemented yet — Task 7.');
    });
  });
```

and replace with:

```js
  body.querySelectorAll('button[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const skill = cachedSkills.find(s => s.id === btn.dataset.id);
      if (!skill) return;
      renderSkillForm(mountNode, skill, () => renderSkillsAdmin(mountNode));
    });
  });
```

(The scan-projects `alert` stays — it goes away in Task 8.)

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: exits 0.

- [ ] **Step 4: Smoke check in browser**

`npm run dev`, navigate to `/admin.html` → Skills tab.

Expected:
- Click **+ New skill** → form appears with Name, Category dropdown (6 options), Devicon slug helper, Icon URL, live preview (hidden), Sort order. Cancel returns to list.
- Type `react` in devicon-slug → Icon URL auto-fills to `https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/react/react-original.svg`. Preview image renders a React logo.
- Type a bogus slug like `asdfqwer` → URL fills, preview shows "Couldn't load icon at that URL."
- Submit a valid skill → back to list, new row appears.
- Edit a skill → form opens prefilled, save round-trips.
- Try to create a duplicate name → inline error: 'A skill named "X" already exists.'
- Public `/` Skills section picks up the new rows on refresh, in the correct category tab.

- [ ] **Step 5: Stop for user commit**

Task 7 ready.

---

### Task 8: Scan projects for missing skills

**Files:**
- Modify: `client/src/admin/skillsAdmin.js`

- [ ] **Step 1: Add the scan handler + result renderer to `skillsAdmin.js`**

Replace the `#scan-projects` placeholder handler block in `skillsAdmin.js` — find:

```js
  mountNode.querySelector('#scan-projects').addEventListener('click', () => {
    // Scan wired in Task 8.
    alert('Scan not implemented yet — Task 8.');
  });
```

and replace with:

```js
  mountNode.querySelector('#scan-projects').addEventListener('click', () => {
    handleScan(mountNode);
  });
```

Then add these two functions at the bottom of `skillsAdmin.js`, just above the trailing `esc` helper:

```js
async function handleScan(mountNode) {
  const result = mountNode.querySelector('#scan-result');
  const errorBox = mountNode.querySelector('#skills-error');
  errorBox.innerHTML = '';
  result.innerHTML = `<p style="color:var(--muted);">Scanning projects…</p>`;

  const { data: projects, error } = await supabase
    .from('projects')
    .select('tech_stack,tags')
    .eq('published', true);

  if (error) {
    result.innerHTML = '';
    errorBox.innerHTML = `<p class="error">Scan failed: ${esc(error.message)}</p>`;
    return;
  }

  const existing = new Set(cachedSkills.map(s => s.name.toLowerCase()));
  const seen = new Map(); // lowerName -> originalName (first occurrence wins)

  for (const p of projects ?? []) {
    const strings = [...(p.tech_stack ?? []), ...(p.tags ?? [])];
    for (const raw of strings) {
      const name = String(raw ?? '').trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (existing.has(key)) continue;
      if (seen.has(key)) continue;
      seen.set(key, name);
    }
  }

  renderScanResult(mountNode, [...seen.values()].sort((a, b) => a.localeCompare(b)));
}

function renderScanResult(mountNode, missing) {
  const result = mountNode.querySelector('#scan-result');
  if (!missing.length) {
    result.innerHTML = `<p style="color:var(--muted);">No missing skills — all project tech is in the skills table.</p>`;
    return;
  }

  result.innerHTML = `
    <p style="color:var(--muted); margin-top:1rem;">${missing.length} name${missing.length === 1 ? '' : 's'} from project tech_stack / tags not in the skills table:</p>
    <ul style="list-style:none; padding:0; display:flex; flex-direction:column; gap:0.4rem;">
      ${missing.map(name => `
        <li style="display:flex; gap:0.6rem; align-items:center;">
          <span style="flex:1;">${esc(name)}</span>
          <button class="secondary" data-action="add-missing" data-name="${esc(name)}">Add</button>
        </li>
      `).join('')}
    </ul>
  `;

  result.querySelectorAll('button[data-action="add-missing"]').forEach(btn => {
    btn.addEventListener('click', () => {
      renderSkillForm(mountNode, null, () => renderSkillsAdmin(mountNode), btn.dataset.name);
    });
  });
}
```

Notes:
- The scan reads from `cachedSkills` populated by `loadAndRenderList` — that runs on every `renderSkillsAdmin` mount, so the snapshot is fresh.
- Case-insensitive dedupe both ways (against existing skills + within scan results).
- Defaulting category to `frameworks` in the form (already the default — no extra wiring needed; `renderSkillForm` initializes `category: 'frameworks'` when `skill=null`).
- The result list lives in `#scan-result` and persists between scans (until a new scan or page change clears it). That's intentional — adding a skill returns you to the list view, scrolling past where the scan output was. Re-scan to refresh.

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: exits 0.

- [ ] **Step 3: Smoke check in browser**

`npm run dev`, navigate to `/admin.html` → Skills tab.

Expected:
- Click **Scan projects for missing skills** → either "No missing skills" if everything is already in the skills table, or a list of un-tracked names from project tech_stack/tags with an Add button next to each.
- Click Add → skill form opens with `name` prefilled and category defaulted to Frameworks. Save → back to the skills list, new row visible. Re-scan → that name no longer appears.
- Try a project with a tag like `web-design` not in the skills table → after re-scan it appears in the list.
- Empty case: if no projects have tech_stack/tags, the scan returns "No missing skills."

- [ ] **Step 4: Stop for user commit**

Task 8 ready.

---

### Task 9: Update `CLAUDE.md`

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the `dom/` bullet in the Project structure section**

In `CLAUDE.md`, find the `dom/` bullet (currently mentions `sectionObserver.js`, `contactForm.js`, `projectsList.js`). Replace with:

Old:
```
- `dom/` — DOM-only behavior (no Three.js, no markup): `sectionObserver.js`
  (dot active-state + section fade-in), `contactForm.js` (contact form
  state machine + fetch to `/api/contact`), `projectsList.js` (public
  projects fetch from Supabase + tag-pill filtering).
```

New:
```
- `dom/` — DOM-only behavior (no Three.js, no markup): `sectionObserver.js`
  (dot active-state + section fade-in), `contactForm.js` (contact form
  state machine + fetch to `/api/contact`), `projectsList.js` (public
  projects fetch from Supabase + tag-pill filtering), `skillsList.js`
  (public Skills section: union of skills table + project tech_stack/tags,
  tab strip + icon-card grid).
```

- [ ] **Step 2: Update the `admin/` bullet**

Find the `admin/` bullet and replace:

Old:
```
- `admin/` — admin-dashboard-only modules: `auth.js` (GitHub OAuth +
  owner-email gate), `dashboard.js` (list view + delete), `projectForm.js`
  (create/edit form, GitHub repo prefill, screenshot upload), and
  `styles/admin.css`. Loaded only by the `/admin.html` entry.
```

New:
```
- `admin/` — admin-dashboard-only modules: `auth.js` (GitHub OAuth +
  owner-email gate), `dashboard.js` (Projects/Skills top-nav + projects
  list/delete), `projectForm.js` (create/edit form, GitHub repo prefill,
  screenshot upload), `skillsAdmin.js` (skills list/delete + scan-projects
  helper), `skillForm.js` (create/edit skill with devicon slug helper +
  live preview), and `styles/admin.css`. Loaded only by the `/admin.html`
  entry.
```

- [ ] **Step 3: Move the "Currently building" entry to "Recently shipped"**

Find the `## Currently building` section:

```
## Currently building

*Nothing in progress.* Next up per the "Highlight picks" — the **AI chat
widget** powered by the Anthropic API. Spec / plan to be written when
work begins.
```

Replace with:

```
## Currently building

*Nothing in progress.* Next up per the "Highlight picks" — the **AI chat
widget** powered by the Anthropic API. Spec / plan to be written when
work begins.
```

(No change here — Currently building was already "nothing in progress" pointing at the AI chat widget. Leave as is.)

Now find the `## Recently shipped` section and insert a new entry at the top (above the 2026-05-14 scene redesign entry):

```
- **Skills section** (2026-05-21) — Replaced hardcoded `<ul>` with a
  dynamic, category-tabbed icon grid. Source = union of a new Supabase
  `skills` table (owner-managed via `/admin`) + every `tech_stack` /
  `tags` string from published projects. Devicon icons via jsDelivr;
  admin form has a "Devicon slug" helper that auto-builds the canonical
  URL. Admin dashboard gets a Projects/Skills top-nav toggle and a "scan
  projects for missing skills" one-click importer. Spec:
  `docs/superpowers/specs/2026-05-14-skills-section-design.md`. Plan:
  `docs/superpowers/plans/2026-05-14-skills-section.md`.
```

- [ ] **Step 4: Remove the now-stale 'Currently building' note**

(Already correct — the existing "Currently building" already says "Nothing in progress" and points at the AI chat widget. Skipped.)

- [ ] **Step 5: Verify build**

```bash
npm run build
```

Expected: exits 0. (Markdown change only — sanity-only check.)

- [ ] **Step 6: Stop for user commit**

Task 9 ready. Plan complete.

---

## Self-review checklist (done; issues fixed inline)

- **Spec coverage:**
  - Schema (`skills` table + RLS) → Task 1 ✓
  - Public scaffold + section--left flip + 36rem waypoint → Task 2 ✓
  - Union of skills + project tech_stack/tags, case-insensitive, skills-table casing wins → Task 3 `buildUnion` ✓
  - Trim names → Task 3 `buildUnion` ✓
  - Tab strip + All + 6 fixed + Other-when-nonempty → Task 4 ✓
  - Icon-card grid 4 cols, hover lift, 48px icons, name below, mobile 2 cols → Task 2 CSS ✓
  - Loading / empty / error states inline → Task 3 + Task 2 CSS ✓
  - Icon URL 404 → monochrome initial placeholder → Task 3 `attachIconFallbacks` + CSS `.skills__card-fallback` ✓
  - Admin Projects/Skills nav → Task 5 ✓
  - Skills admin list + delete confirm → Task 6 ✓
  - Skill form: name + category + devicon slug helper + icon URL + live preview + sort order → Task 7 ✓
  - Unique-violation surfaced inline → Task 7 (`23505` check) ✓
  - Scan projects helper with one-click Add prefilled → Task 8 ✓
  - CLAUDE.md update → Task 9 ✓

- **Placeholder scan:** No TBDs, no "TODO", no "appropriate error handling", no "similar to Task N". Every code-changing step has a complete code block.

- **Type/name consistency:**
  - `renderSkillsAdmin(mountNode)` defined in Task 5, called from Task 5 dashboard + Task 7 form `onDone` + Task 8 scan onDone → matches.
  - `renderSkillForm(mountNode, skill, onDone, initialName)` defined in Task 7, called from Task 7 new-skill + edit + Task 8 add-missing → matches.
  - `cachedSkills` declared in Task 6, used in Task 8 scan → matches.
  - `CATEGORY_LABELS` defined in both `skillsList.js` (Task 4) and `skillsAdmin.js` (Task 6) — intentional duplication: `dom/` modules can't import from `admin/` and vice versa, and the alternative (a shared `lib/skillCategories.js`) is over-engineering for two static maps. Accepted.
  - `#scan-result`, `#skills-error`, `#skills-body`, `#new-skill`, `#scan-projects`, `#devicon-slug`, `#icon_url`, `#icon-preview` IDs all match between markup and handlers.

- **Spec gaps:** Mobile (< 480px) collapses grid to 2 columns — covered by `@media (max-width: 480px)` in Task 2 CSS. Tabs wrap is covered by `flex-wrap: wrap` in `.skills__tabs`.
