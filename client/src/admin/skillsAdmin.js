import { supabase } from '../lib/supabase.js';
import { renderSkillForm } from './skillForm.js';

const CATEGORY_LABELS = {
  frameworks: 'Frameworks',
  languages: 'Languages',
  apis: 'APIs',
  testing: 'Testing',
  databases: 'Databases',
  tools: 'Tools / DevOps',
};

let cachedSkills = [];

export function renderSkillsAdmin(mountNode) {
  mountNode.innerHTML = `
    <header style="display:flex; justify-content:space-between; align-items:center;">
      <h1>Skills</h1>
      <div>
        <button id="new-skill">+ New skill</button>
        <button id="scan-projects" class="secondary">Scan projects for missing skills</button>
      </div>
    </header>
    <div id="skills-error"></div>
    <div id="scan-result"></div>
    <div id="skills-body"><p>Loading…</p></div>
  `;

  mountNode.querySelector('#new-skill').addEventListener('click', () => {
    renderSkillForm(mountNode, null, () => renderSkillsAdmin(mountNode));
  });
  mountNode.querySelector('#scan-projects').addEventListener('click', () => {
    // Scan wired in Task 8.
    alert('Scan not implemented yet — Task 8.');
  });

  loadAndRenderList(mountNode);
}

async function loadAndRenderList(mountNode) {
  const body = mountNode.querySelector('#skills-body');
  const errorBox = mountNode.querySelector('#skills-error');
  errorBox.innerHTML = '';

  const { data, error } = await supabase
    .from('skills')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    errorBox.innerHTML = `<p class="error">Failed to load skills: ${esc(error.message)}</p>`;
    body.innerHTML = '';
    return;
  }

  cachedSkills = data ?? [];

  if (!cachedSkills.length) {
    body.innerHTML = `<p>No skills yet. Click "+ New skill" to add one, or "Scan projects" to import names from existing projects.</p>`;
    return;
  }

  const rows = cachedSkills.map(s => `
    <tr>
      <td>
        ${s.icon_url
          ? `<img src="${esc(s.icon_url)}" alt="" width="24" height="24" style="display:block;" />`
          : `<div style="width:24px; height:24px; background:#1f2330; border-radius:4px;"></div>`}
      </td>
      <td><strong>${esc(s.name)}</strong></td>
      <td>${esc(CATEGORY_LABELS[s.category] ?? s.category)}</td>
      <td>${s.sort_order}</td>
      <td>
        <button class="secondary" data-action="edit" data-id="${s.id}">Edit</button>
        <button class="danger" data-action="delete" data-id="${s.id}" data-name="${esc(s.name)}">Delete</button>
      </td>
    </tr>
  `).join('');

  body.innerHTML = `
    <table>
      <thead>
        <tr><th>Icon</th><th>Name</th><th>Category</th><th>Order</th><th></th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  body.querySelectorAll('button[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => handleDelete(mountNode, btn.dataset.id, btn.dataset.name));
  });
  body.querySelectorAll('button[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const skill = cachedSkills.find(s => s.id === btn.dataset.id);
      if (!skill) return;
      renderSkillForm(mountNode, skill, () => renderSkillsAdmin(mountNode));
    });
  });
}

async function handleDelete(mountNode, id, name) {
  if (!confirm(`Delete "${name}"?`)) return;
  const errorBox = mountNode.querySelector('#skills-error');
  const { error } = await supabase.from('skills').delete().eq('id', id);
  if (error) {
    errorBox.innerHTML = `<p class="error">Delete failed: ${esc(error.message)}</p>`;
    return;
  }
  await loadAndRenderList(mountNode);
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
