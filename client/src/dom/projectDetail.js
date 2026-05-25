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

  let shots = [];
  const shotsRes = await supabase
    .from('project_screenshots')
    .select('*')
    .eq('project_id', project.id)
    .order('sort_order')
    .order('created_at');
  if (!shotsRes.error) shots = shotsRes.data ?? [];

  render(mountNode, project, shots);
}

function renderNotFound(mountNode) {
  mountNode.innerHTML = `
    <div class="project-detail">
      <a class="project-detail__back" href="/">← Back to portfolio</a>
      <p class="project-detail__state">Project not found.</p>
    </div>`;
}

function render(mountNode, p, shots) {
  document.title = `${p.title} — Portfolio`;
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

  const gallery = shots.length ? renderGallery(shots) : '';

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
      ${gallery}
      ${tech}
    </div>
  `;
  if (shots.length) attachLightbox(mountNode);
}

function paragraphs(text) {
  return String(text)
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${esc(block).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function renderGallery(shots) {
  return `
    <h2 class="project-detail__gallery-heading">Screenshots</h2>
    <ul class="project-detail__gallery">
      ${shots.map((s) => `
        <li class="project-detail__shot">
          <img src="${esc(s.url)}" alt="${esc(s.caption ?? '')}" loading="lazy"
               data-full="${esc(s.url)}" data-caption="${esc(s.caption ?? '')}" />
          ${s.caption ? `<span class="project-detail__caption">${esc(s.caption)}</span>` : ''}
        </li>
      `).join('')}
    </ul>
  `;
}

function attachLightbox(root) {
  const overlay = document.createElement('div');
  overlay.className = 'lightbox';
  overlay.hidden = true;
  overlay.innerHTML = `
    <button class="lightbox__close" type="button" aria-label="Close">×</button>
    <img class="lightbox__img" alt="" />
    <span class="lightbox__caption"></span>
  `;
  document.body.appendChild(overlay);
  const img = overlay.querySelector('.lightbox__img');
  const cap = overlay.querySelector('.lightbox__caption');

  const open = (src, caption) => {
    img.src = src;
    cap.textContent = caption || '';
    overlay.hidden = false;
  };
  const close = () => {
    overlay.hidden = true;
    img.removeAttribute('src');
  };

  root.querySelectorAll('.project-detail__shot img[data-full]').forEach((el) => {
    el.addEventListener('click', () => open(el.dataset.full, el.dataset.caption));
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.classList.contains('lightbox__close')) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.hidden) close();
  });
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
