# Skills Section — Design (2026-05-14)

**Date:** 2026-05-14
**Status:** Approved (pending user spec review)
**Owner:** John Kyle Camson

## Goal

Replace the hardcoded `<ul>` in `Skills.js` with a dynamic, category-tabbed grid of icon cards. The displayed skill set is the **union** of two sources:

1. A new Supabase `skills` table that the owner manages via `/admin` (name, category, icon URL, sort order).
2. Every `tech_stack` and `tags` string from every published project, normalized.

Project-derived names that aren't in the `skills` table render under an **Other** tab (which itself only appears when at least one such item exists).

## Why this shape

- **Auto-discovery from projects** means new tech mentioned in a project shows up on the Skills section automatically — no manual upkeep just to keep the lists in sync.
- **Admin-managed skills table** lets you add standalone skills that aren't tied to any project, and gives every entry a proper category + icon.
- **devicon CDN** keeps the icon library 50+ entries strong without putting any binary in the repo.
- **Tabs + grid** matches the projects-list pill pattern already in use, so the UI vocabulary stays consistent.

## Non-goals

- No icon upload UI. The icon source is devicon (or any other URL you paste in manually). A future iteration could add a Supabase Storage `skill-icons` bucket if devicon coverage becomes limiting.
- No drag-to-reorder. Sort order is set via a numeric input in the admin form.
- No nested categories or per-skill description text. One name + one category + one icon per row.
- No frontend "scan projects" UI for visitors. The "scan" tool lives only in `/admin`.
- No admin auth changes. The existing GitHub-OAuth-gated `/admin` covers skills CRUD too.

## Schema

Add to Supabase (committed reference in `supabase/schema.sql`):

```sql
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

Notes:
- `category` is a constrained text field — not an enum type — so adding a new category later is a one-line SQL change (just edit the check constraint).
- `'other'` is **not** in the check constraint. The Other tab is purely a runtime artifact for un-categorized project strings — those don't exist as rows in the `skills` table.
- `name` is `unique` and case-sensitive. Matching against project strings is done case-insensitively on the client (see Data flow below).
- `icon_url` is the full URL to an SVG. For devicon entries, this is `https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/<slug>/<slug>-original.svg`. The admin form has a "Devicon slug" helper that auto-builds this URL as you type — but the underlying storage is always a full URL, so you can paste a custom one.

Reuses the existing `set_updated_at()` trigger function from the projects schema.

## Categories

| Key | Display label |
|---|---|
| `frameworks` | Frameworks |
| `languages` | Languages |
| `apis` | APIs |
| `testing` | Testing |
| `databases` | Databases |
| `tools` | Tools / DevOps |
| `other` (runtime only) | Other |

Tab order on the public site: **All** → the 6 fixed categories → **Other** (only if non-empty). The check constraint in the schema enforces the 6 fixed keys; the Other tab is computed client-side.

## Data flow

Browser-side, on `Skills.js` mount:

1. **Fetch in parallel:**
   ```js
   const [skillsRes, projectsRes] = await Promise.all([
     supabase.from('skills').select('*').order('sort_order').order('name'),
     supabase.from('projects').select('tech_stack,tags').eq('published', true),
   ]);
   ```
2. **Normalize names:** build a lowercased lookup `Map<lowerName, { name, category, icon_url }>` seeded from the `skills` table.
3. **Walk projects:** for each project's `tech_stack` and `tags`, for each string `s`:
   - If `s.toLowerCase()` is already in the map, ignore (skills table wins — it has the category + icon).
   - Else add `{ name: s, category: 'other', icon_url: null }` keyed by `s.toLowerCase()`.
4. **Group by category:** produce one array per category key, sorted by `(sort_order ASC, name ASC)`. `other` rows have `sort_order=0`, so they sort alphabetically.
5. **Render tabs:** All + 6 fixed + Other-if-nonempty. The active tab's grid renders 4 columns of icon cards.

## Files

**Created:**
- `client/src/dom/skillsList.js` — fetch + dedupe + render + tab-click handling (mirrors `dom/projectsList.js`).
- `client/src/admin/skillsAdmin.js` — admin list/edit view for skills (mirrors `admin/dashboard.js` for projects, but smaller).
- `client/src/admin/skillForm.js` — create/edit form (mirrors `admin/projectForm.js`).

**Modified:**
- `supabase/schema.sql` — add `skills` table + RLS.
- `client/src/components/Skills.js` — replace hardcoded `<ul class="skills-grid">` with empty containers; change `.section--right` to `.section--left`.
- `client/src/styles/components/skills.css` — replace pill-style grid with the icon-card grid + tab styles; widen the Skills waypoint to 36rem.
- `client/src/admin/dashboard.js` — add navigation between Projects view and new Skills view at the top of the page.
- `client/src/main.js` — call `initSkillsList()` after mount, alongside the existing `initProjectsList()`.
- `CLAUDE.md` — current scene mentions need no change (planet bindings unchanged). Project structure section adds `skillsAdmin.js` + `skillForm.js` + `skillsList.js`.

**Untouched:**
- All Three.js scene code. Jupiter's offset and section binding stay as-is; only the HTML content layout flips from right to left.
- `client/src/lib/supabase.js` (shared client).

## Public component shape

```html
<section id="skills" data-spin="skills" class="section section--left">
  <div class="waypoint">
    <p class="eyebrow">02</p>
    <h2>Skills</h2>
    <div class="divider"></div>
    <div id="skills-tabs" class="skills__tabs" hidden></div>
    <div id="skills-grid" class="skills__grid" aria-busy="true">
      <p class="skills__loading">Loading…</p>
    </div>
  </div>
</section>
```

CSS sketch (real values land during implementation):

```css
#skills .waypoint { max-width: min(36rem, calc(100vw - 10rem)); }

.skills__tabs {
  display: flex; flex-wrap: wrap; gap: 0.4rem;
  margin: 1rem 0 1.25rem;
}
.skills__tab {
  /* same shape as .projects__pill — 999px radius, transparent bg,
     0.15 border, aria-pressed=true gets 0.55 border + 0.12 bg fill */
}
.skills__grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem;
}
.skills__card {
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 0.6rem;
  padding: 1.1rem 0.6rem;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  transition: border-color 0.15s, background 0.15s, transform 0.15s;
}
.skills__card:hover {
  border-color: rgba(255,255,255,0.25);
  background: rgba(255,255,255,0.06);
  transform: translateY(-2px);
}
.skills__card img { width: 48px; height: 48px; }
.skills__card-name { font-size: 0.8125rem; color: rgba(255,255,255,0.85); text-align: center; line-height: 1.2; }
```

On narrow viewports (< 480px) the grid collapses to 2 columns via a media query.

Loading / empty / error states render in the grid area as inline text — no card styling — same pattern as the projects list.

## Admin shape

The `/admin` dashboard currently has a single Projects list at root. After this task, the dashboard root renders a small top-of-page navigation:

```
Projects  |  Skills           [Sign out]
```

Clicking switches the body between the existing projects view and a new skills view. Each view manages its own state; no shared state.

**Skills view:**

- Header: "Skills" + "+ New skill" + a secondary "Scan projects for missing skills" button.
- Table: Icon (24px preview) · Name · Category · Sort order · Edit/Delete.
- Click Edit or + New → opens `skillForm` inline (same pattern as projectForm).

**Skill form:**

- Title (required, also feeds `name`).
- Category (required, dropdown of 6 fixed values).
- Devicon slug (optional helper — types build the canonical `https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/<slug>/<slug>-original.svg` into a hidden `icon_url` field below).
- Icon URL (text input — full URL; pre-populated by the devicon slug helper but freely editable for non-devicon icons).
- Live preview: an `<img>` next to the icon URL field showing the actual image at 48px. `onerror` swaps to a "Couldn't load" badge.
- Sort order (number, default 0).

**Scan projects:**

- One-click button. On click: fetches `projects.select('tech_stack, tags').eq('published', true)`, flattens + dedupes case-insensitively, subtracts names already in `skills` (case-insensitive), and lists the remainder.
- Each item in the list has a single button: "Add" → opens the skill form pre-populated with the project's original casing as `name`, and category defaulted to `frameworks` (most common). Sort order 0. Save = same as normal create.
- The button is only enabled when the projects scan turns up at least one missing name.

## Error handling

- **Supabase fetch fails:** the grid shows `Couldn't load skills — refresh to try again.` in the projects-error color. No retry button (matches projects-list precedent).
- **Empty union (no skills + no published projects):** grid shows `No skills yet.` — header + divider stay visible so the section doesn't collapse.
- **Icon URL 404s:** the `<img>` `onerror` handler swaps the broken icon for a neutral monochrome placeholder (a 48px rounded square with the first letter of the skill name).
- **Skill name collision in admin:** Supabase returns a unique-violation error; the form surfaces it inline ("A skill named X already exists.")
- **Delete confirms:** browser-native `confirm("Delete X?")` — same as projects.

## Edge cases

- **Case variations in project strings.** "React", "react", and "REACT" in different projects collapse to a single union entry. The displayed casing prefers the `skills` table row; if no skills row exists, it falls back to the first occurrence found in projects (deterministic by project sort order).
- **Empty `tech_stack` / `tags` arrays.** Skipped — no entries added to the union from that project.
- **Trimming.** All names are trimmed before normalization. `" React "` and `"React"` collapse to one entry.
- **Admin scan when nothing is missing.** The Scan button stays visible but the result section reads `No missing skills — all project tech is in the skills table.`
- **Removing a skill row that's also in project tech_stack.** The name reappears in the Other bucket on the public site. No special handling needed.

## Verification (manual smoke tests)

1. Public `/` Skills section renders with All tab active. 4-column grid, icon + name per card. Hover lifts each card.
2. Click each tab — content filters correctly, active tab gets the filled pill style.
3. Other tab appears only when a project has a tag/tech that isn't in `skills` table; disappears the moment a skills row is created for it.
4. Loading state shows briefly, then the grid renders.
5. Empty database state: header + divider + "No skills yet." message.
6. `/admin` shows Projects + Skills nav at top. Clicking Skills switches view without page reload.
7. Create a skill — appears immediately in the admin list and on `/` after refresh.
8. Edit the skill — name, category, icon_url, sort_order all save round-trip.
9. Delete the skill — disappears from `/` after refresh.
10. Scan projects with a project containing an unknown tech_stack item — clicking "Add" opens the form pre-populated.
11. Sign in as a non-owner GitHub account — `/admin` still gates correctly.
12. Mobile (< 480px) collapses grid to 2 columns; tabs wrap as needed.

## Implementation order (high level)

1. **Schema** — add `skills` table to Supabase + commit reference SQL.
2. **Public component scaffold** — `Skills.js` HTML update, `skills.css` rewrite, `skillsList.js` first pass (fetch + render without tabs).
3. **Tabs + filtering** — wire the tabs and Other-tab-hidden logic.
4. **Admin Projects/Skills nav** — restructure dashboard.js with the top toggle.
5. **Skills admin list + form** — CRUD pages.
6. **Scan-projects feature** — the helper button.
7. **CLAUDE.md update** — mark shipped.

Each step independently builds and is visually testable in dev.
