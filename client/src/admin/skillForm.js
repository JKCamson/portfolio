import { supabase } from '../lib/supabase.js';

const CATEGORIES = [
  { value: 'frameworks', label: 'Frameworks' },
  { value: 'languages',  label: 'Languages' },
  { value: 'apis',       label: 'APIs' },
  { value: 'testing',    label: 'Testing' },
  { value: 'databases',  label: 'Databases' },
  { value: 'tools',      label: 'Tools / DevOps' },
];

const DEVICON_URL = (slug) =>
  `https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/${slug}/${slug}-original.svg`;

// skill = null means "new skill". Otherwise it's the row being edited.
// initialName lets the scan-projects helper (Task 8) prepopulate name.
export function renderSkillForm(mountNode, skill, onDone, initialName = '') {
  const isEdit = !!skill;
  const initial = skill ?? {
    name: initialName,
    category: 'frameworks',
    icon_url: '',
    sort_order: 0,
  };

  mountNode.innerHTML = `
    <header style="display:flex; justify-content:space-between; align-items:center;">
      <h1>${isEdit ? 'Edit skill' : 'New skill'}</h1>
      <button id="cancel" class="secondary">Cancel</button>
    </header>
    <div id="form-error"></div>
    <form id="skill-form">
      <label for="name">Name</label>
      <input id="name" name="name" required value="${esc(initial.name)}" />

      <label for="category">Category</label>
      <select id="category" name="category" required>
        ${CATEGORIES.map(c =>
          `<option value="${c.value}" ${initial.category === c.value ? 'selected' : ''}>${esc(c.label)}</option>`
        ).join('')}
      </select>

      <label for="devicon-slug">Devicon slug (optional helper)</label>
      <input id="devicon-slug" type="text" placeholder="e.g. react, python, postgresql" />
      <p style="margin:4px 0 0; font-size:12px; color:var(--muted);">
        Type a slug from <a href="https://devicon.dev/" target="_blank" rel="noopener">devicon.dev</a>; the Icon URL below auto-fills.
      </p>

      <label for="icon_url">Icon URL</label>
      <input id="icon_url" name="icon_url" type="url" value="${esc(initial.icon_url ?? '')}" />
      <div style="margin-top:6px;">
        <img id="icon-preview" alt="" style="width:48px; height:48px; display:${initial.icon_url ? 'block' : 'none'};" ${initial.icon_url ? `src="${esc(initial.icon_url)}"` : ''} />
        <span id="icon-preview-error" class="error" style="display:none; font-size:12px;">Couldn't load icon at that URL.</span>
      </div>

      <label for="sort_order">Sort order (lower = earlier)</label>
      <input id="sort_order" name="sort_order" type="number" value="${initial.sort_order ?? 0}" />

      <div style="margin-top:24px;">
        <button type="submit" id="save">${isEdit ? 'Save changes' : 'Create skill'}</button>
      </div>
    </form>
  `;

  const slugInput = mountNode.querySelector('#devicon-slug');
  const urlInput = mountNode.querySelector('#icon_url');
  const preview = mountNode.querySelector('#icon-preview');
  const previewError = mountNode.querySelector('#icon-preview-error');

  function setPreview(url) {
    previewError.style.display = 'none';
    if (!url) {
      preview.removeAttribute('src');
      preview.style.display = 'none';
      return;
    }
    preview.src = url;
    preview.style.display = 'block';
  }

  preview.addEventListener('load', () => { previewError.style.display = 'none'; });
  preview.addEventListener('error', () => {
    preview.style.display = 'none';
    previewError.style.display = 'inline';
  });

  slugInput.addEventListener('input', () => {
    const slug = slugInput.value.trim().toLowerCase();
    if (!slug) return;
    const url = DEVICON_URL(slug);
    urlInput.value = url;
    setPreview(url);
  });

  urlInput.addEventListener('input', () => {
    setPreview(urlInput.value.trim());
  });

  mountNode.querySelector('#cancel').addEventListener('click', () => onDone());
  mountNode.querySelector('#skill-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleSubmit(mountNode, skill, onDone);
  });
}

async function handleSubmit(mountNode, existing, onDone) {
  const errorBox = mountNode.querySelector('#form-error');
  errorBox.innerHTML = '';

  const form = mountNode.querySelector('#skill-form');
  const fd = new FormData(form);

  const name = String(fd.get('name') ?? '').trim();
  if (!name) {
    errorBox.innerHTML = `<p class="error">Name is required.</p>`;
    return;
  }

  const row = {
    name,
    category: String(fd.get('category') ?? 'frameworks'),
    icon_url: nullIfBlank(fd.get('icon_url')),
    sort_order: Number(fd.get('sort_order') ?? 0) | 0,
  };

  if (existing) row.id = existing.id;

  const { error } = await supabase.from('skills').upsert(row).select().single();
  if (error) {
    if (error.code === '23505') {
      errorBox.innerHTML = `<p class="error">A skill named "${esc(name)}" already exists.</p>`;
    } else {
      errorBox.innerHTML = `<p class="error">Save failed: ${esc(error.message)}</p>`;
    }
    return;
  }
  onDone();
}

function nullIfBlank(raw) {
  const s = String(raw ?? '').trim();
  return s.length ? s : null;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
