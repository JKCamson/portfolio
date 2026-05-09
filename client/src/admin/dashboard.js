import { supabase } from '../lib/supabase.js';

export async function renderDashboard(mountNode) {
  mountNode.innerHTML = `
    <header style="display:flex; justify-content:space-between; align-items:center;">
      <h1>Projects</h1>
      <div>
        <button id="new-project">+ New project</button>
        <button id="signout" class="secondary">Sign out</button>
      </div>
    </header>
    <div id="dashboard-error"></div>
    <div id="dashboard-body"><p>Loading…</p></div>
  `;

  mountNode.querySelector('#signout').addEventListener('click', async () => {
    await supabase.auth.signOut();
  });

  mountNode.querySelector('#new-project').addEventListener('click', () => {
    // Wired in Task 9.
    alert('New-project form lands in Task 9.');
  });

  await loadAndRenderList(mountNode);
}

async function loadAndRenderList(mountNode) {
  const body = mountNode.querySelector('#dashboard-body');
  const errorBox = mountNode.querySelector('#dashboard-error');
  errorBox.innerHTML = '';

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('featured', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    errorBox.innerHTML = `<p class="error">Failed to load: ${escapeText(error.message)}</p>`;
    body.innerHTML = '';
    return;
  }

  if (!data.length) {
    body.innerHTML = `<p>No projects yet. Click "+ New project" to add one.</p>`;
    return;
  }

  const rows = data.map(p => `
    <tr>
      <td>
        ${p.screenshot_url
          ? `<img src="${escapeText(p.screenshot_url)}" alt="" style="width:64px; height:40px; object-fit:cover; border-radius:3px;" />`
          : `<div style="width:64px; height:40px; background:#1f2330; border-radius:3px;"></div>`}
      </td>
      <td><strong>${escapeText(p.title)}</strong><br/><span style="color:var(--muted)">${escapeText(p.slug)}</span></td>
      <td>${p.published ? 'Published' : 'Draft'}</td>
      <td>${p.featured ? '★' : ''}</td>
      <td>${p.sort_order}</td>
      <td>
        <button class="secondary" data-action="edit" data-id="${p.id}">Edit</button>
        <button class="danger" data-action="delete" data-id="${p.id}" data-title="${escapeText(p.title)}">Delete</button>
      </td>
    </tr>
  `).join('');

  body.innerHTML = `
    <table>
      <thead>
        <tr><th>Image</th><th>Project</th><th>Status</th><th>★</th><th>Order</th><th></th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  body.querySelectorAll('button[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => handleDelete(mountNode, btn.dataset.id, btn.dataset.title));
  });
  body.querySelectorAll('button[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => {
      // Wired in Task 9.
      alert('Edit form lands in Task 9.');
    });
  });
}

async function handleDelete(mountNode, id, title) {
  if (!confirm(`Delete "${title}"?`)) return;
  const errorBox = mountNode.querySelector('#dashboard-error');
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) {
    errorBox.innerHTML = `<p class="error">Delete failed: ${escapeText(error.message)}</p>`;
    return;
  }
  await loadAndRenderList(mountNode);
}

function escapeText(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
