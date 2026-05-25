import { supabase } from '../lib/supabase.js';
import { ProjectCard } from '../partials/ProjectCard.js';

export async function initProjectsPage(mountNode) {
  if (!mountNode) return;
  mountNode.innerHTML = `
    <div class="projects-page">
      <a class="projects-page__back" href="/">← Back to portfolio</a>
      <h1>Projects</h1>
      <ul id="projects-page-list" class="projects" aria-busy="true">
        <li class="projects__loading">Loading…</li>
      </ul>
    </div>
  `;
  const list = mountNode.querySelector('#projects-page-list');

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('published', true)
    .order('featured', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  list.removeAttribute('aria-busy');
  if (error) {
    list.innerHTML = `<li class="projects__error">Couldn't load projects — refresh to try again.</li>`;
    return;
  }
  const projects = data ?? [];
  if (!projects.length) {
    list.innerHTML = `<li class="projects__empty">No projects yet.</li>`;
    return;
  }
  list.innerHTML = projects.map(ProjectCard).join('');
}
