import { supabase } from '../lib/supabase.js';
import { ProjectCard } from '../partials/ProjectCard.js';

export async function initProjectsList() {
  const list = document.querySelector('#projects-list');
  if (!list) return;

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('published', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  list.removeAttribute('aria-busy');
  if (error) {
    list.innerHTML = `<li class="projects__error">Couldn't load projects — refresh to try again.</li>`;
    return;
  }

  const all = data ?? [];
  const featured = all.filter((p) => p.featured);
  const teaser = featured.length ? featured : all.slice(0, 3);

  if (!teaser.length) {
    list.innerHTML = `<li class="projects__empty">No projects yet</li>`;
    return;
  }
  list.innerHTML = teaser.map(ProjectCard).join('');
}
