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
