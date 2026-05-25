const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const ProjectCard = (p) => {
  const detailHref = `/projects/${esc(p.slug)}`;
  const media = p.screenshot_url
    ? `<img src="${esc(p.screenshot_url)}" alt="${esc(p.title)} screenshot" loading="lazy" />`
    : `<div class="projects__media-fallback"></div>`;
  return `
    <li class="projects__card">
      <a class="projects__media" href="${detailHref}">${media}</a>
      <h3><a class="projects__title-link" href="${detailHref}">${esc(p.title)}</a></h3>
      <p>${esc(p.summary)}</p>
      ${p.tech_stack?.length
        ? `<ul class="projects__tech">${p.tech_stack.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`
        : ''}
      <div class="projects__links">
        ${p.demo_url ? `<a href="${esc(p.demo_url)}" target="_blank" rel="noopener">Demo</a>` : ''}
        ${p.repo_url ? `<a href="${esc(p.repo_url)}" target="_blank" rel="noopener">Code</a>` : ''}
      </div>
    </li>
  `;
};
