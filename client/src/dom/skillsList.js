import { supabase } from '../lib/supabase.js';

const CATEGORY_ORDER = ['frameworks', 'languages', 'apis', 'testing', 'databases', 'tools'];

const CATEGORY_LABELS = {
  frameworks: 'Frameworks',
  languages: 'Languages',
  apis: 'APIs',
  testing: 'Testing',
  databases: 'Databases',
  tools: 'Tools / DevOps',
};

let skills = [];
let activeTab = 'all';

export async function initSkillsList() {
  const grid = document.querySelector('#skills-grid');
  if (!grid) return;

  const { data, error } = await supabase
    .from('skills')
    .select('*')
    .order('sort_order')
    .order('name');

  if (error) {
    grid.removeAttribute('aria-busy');
    grid.innerHTML = `<li class="skills__error">Couldn't load skills — refresh to try again.</li>`;
    return;
  }

  skills = (data ?? [])
    .map((s) => ({
      name: String(s.name ?? '').trim(),
      category: s.category,
      icon_url: s.icon_url ?? null,
      sort_order: s.sort_order ?? 0,
    }))
    .filter((s) => s.name);

  renderTabs();
  renderGrid();
  attachTabHandler();
}

function sortFn(a, b) {
  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
  return a.name.localeCompare(b.name);
}

function renderTabs() {
  const tabs = document.querySelector('#skills-tabs');
  if (!tabs) return;
  if (!skills.length) {
    tabs.hidden = true;
    tabs.innerHTML = '';
    return;
  }
  tabs.hidden = false;

  const keys = ['all', ...CATEGORY_ORDER];
  tabs.innerHTML = keys.map((key) => {
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
  const arr = [...skills];
  if (activeTab === 'all') return arr.sort(sortFn);
  return arr.filter((s) => s.category === activeTab).sort(sortFn);
}

function renderGrid() {
  const grid = document.querySelector('#skills-grid');
  if (!grid) return;
  grid.removeAttribute('aria-busy');

  if (!skills.length) {
    grid.innerHTML = `<li class="skills__empty">No skills yet.</li>`;
    return;
  }

  const items = visibleSkills();
  if (!items.length) {
    grid.innerHTML = `<li class="skills__empty">No skills in this category.</li>`;
    return;
  }
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
  root.querySelectorAll('img[data-fallback]').forEach((img) => {
    img.addEventListener('error', () => {
      const div = document.createElement('div');
      div.className = 'skills__card-fallback';
      div.textContent = img.dataset.fallback;
      img.replaceWith(div);
    }, { once: true });
  });
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
