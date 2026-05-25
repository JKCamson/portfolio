import { supabase } from '../lib/supabase.js';
import { ProjectCard } from '../partials/ProjectCard.js';

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
  list.removeAttribute('aria-busy');
  if (!projects.length) {
    list.innerHTML = `<li class="projects__empty">No projects yet</li>`;
    return;
  }
  list.innerHTML = projects.map(ProjectCard).join('');
}
