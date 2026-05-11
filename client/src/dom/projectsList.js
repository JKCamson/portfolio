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
