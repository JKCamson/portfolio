import { initProjectDetail } from '../dom/projectDetail.js';

function resolveSlug() {
  const m = window.location.pathname.match(/\/projects\/([^/]+)\/?$/);
  if (m) return decodeURIComponent(m[1]);
  const q = new URLSearchParams(window.location.search).get('slug');
  return q ? q.trim() : '';
}

const mount = document.querySelector('#project-mount');
initProjectDetail(mount, resolveSlug());
