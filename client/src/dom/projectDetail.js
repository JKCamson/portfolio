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
