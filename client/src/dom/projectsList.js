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
