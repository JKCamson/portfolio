import { supabase } from '../lib/supabase.js';

const SLUG_RE = /^[a-z0-9-]+$/;

// project = null means "new project". Otherwise it's the row being edited.
export function renderProjectForm(mountNode, project, onDone) {
  const isEdit = !!project;
  const initial = project ?? {
    slug: '', title: '', summary: '', description: '',
    tech_stack: [], tags: [],
    demo_url: '', repo_url: '',
    sort_order: 0, featured: false, published: false,
    screenshot_url: null,
  };

  mountNode.innerHTML = `
    <header style="display:flex; justify-content:space-between; align-items:center;">
      <h1>${isEdit ? 'Edit project' : 'New project'}</h1>
      <button id="cancel" class="secondary">Cancel</button>
    </header>
    <div id="form-error"></div>
    <form id="project-form">
      <div style="background:rgba(110,168,254,0.06); border:1px solid var(--border); padding:12px 14px; border-radius:6px; margin-bottom:20px;">
        <label for="gh-repo" style="margin-top:0;">Prefill from GitHub (optional)</label>
        <div style="display:flex; gap:8px;">
          <input id="gh-repo" name="gh-repo" type="text" placeholder="owner/repo or https://github.com/owner/repo" style="flex:1;" />
          <button type="button" id="gh-fetch" class="secondary" style="white-space:nowrap;">Fetch</button>
        </div>
        <p id="gh-status" style="margin:8px 0 0; font-size:12px; color:var(--muted); min-height:1em;"></p>
      </div>

      <label for="title">Title</label>
      <input id="title" name="title" required value="${esc(initial.title)}" />

      <label for="slug">Slug (lowercase letters, digits, hyphens)</label>
      <input id="slug" name="slug" required pattern="[a-z0-9-]+" value="${esc(initial.slug)}" />

      <label for="summary">Summary (1–2 sentences)</label>
      <textarea id="summary" name="summary" rows="3" required>${esc(initial.summary)}</textarea>

      <label for="description">Description (optional, long-form)</label>
      <textarea id="description" name="description" rows="8">${esc(initial.description ?? '')}</textarea>

      <label for="tech_stack">Tech stack (comma-separated)</label>
      <input id="tech_stack" name="tech_stack" value="${esc((initial.tech_stack ?? []).join(', '))}" />

      <label for="tags">Tags (comma-separated, used for filtering)</label>
      <input id="tags" name="tags" value="${esc((initial.tags ?? []).join(', '))}" />

      <label for="demo_url">Demo URL</label>
      <input id="demo_url" name="demo_url" type="url" value="${esc(initial.demo_url ?? '')}" />

      <label for="repo_url">Repo URL</label>
      <input id="repo_url" name="repo_url" type="url" value="${esc(initial.repo_url ?? '')}" />

      <label for="sort_order">Sort order (lower = earlier)</label>
      <input id="sort_order" name="sort_order" type="number" value="${initial.sort_order}" />

      <label style="display:flex; gap:8px; align-items:center; text-transform:none; color:var(--fg); font-size:14px;">
        <input id="featured" name="featured" type="checkbox" style="width:auto;" ${initial.featured ? 'checked' : ''} />
        Featured (pin to front of public list)
      </label>

      <label style="display:flex; gap:8px; align-items:center; text-transform:none; color:var(--fg); font-size:14px;">
        <input id="published" name="published" type="checkbox" style="width:auto;" ${initial.published ? 'checked' : ''} />
        Published (visible on public site)
      </label>

      <label for="screenshot">Screenshot (jpg/png/webp, max 5 MB)</label>
      ${initial.screenshot_url ? `<img src="${esc(initial.screenshot_url)}" alt="" style="max-width:240px; display:block; margin-bottom:8px; border-radius:4px;" />` : ''}
      <input id="screenshot" name="screenshot" type="file" accept="image/jpeg,image/png,image/webp" />

      <div style="margin-top:24px;">
        <button type="submit" id="save">${isEdit ? 'Save changes' : 'Create project'}</button>
      </div>
    </form>
  `;

  mountNode.querySelector('#cancel').addEventListener('click', () => onDone());
  mountNode.querySelector('#project-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleSubmit(mountNode, project, onDone);
  });
  mountNode.querySelector('#gh-fetch').addEventListener('click', () => handleGitHubFetch(mountNode));
}

async function handleGitHubFetch(mountNode) {
  const input = mountNode.querySelector('#gh-repo');
  const status = mountNode.querySelector('#gh-status');
  const button = mountNode.querySelector('#gh-fetch');

  const parsed = parseRepoInput(input.value);
  if (!parsed) {
    status.textContent = 'Expected "owner/repo" or a GitHub URL.';
    status.style.color = 'var(--danger)';
    return;
  }

  button.disabled = true;
  status.style.color = 'var(--muted)';
  status.textContent = `Fetching ${parsed.owner}/${parsed.repo}…`;

  try {
    const base = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`;
    const [repoRes, langRes] = await Promise.all([fetch(base), fetch(`${base}/languages`)]);
    if (repoRes.status === 404) throw new Error(`Repo ${parsed.owner}/${parsed.repo} not found (or private).`);
    if (!repoRes.ok) throw new Error(`GitHub API ${repoRes.status}: ${repoRes.statusText}`);
    const data = await repoRes.json();
    const languages = langRes.ok ? Object.keys(await langRes.json()) : [];

    applyGitHubData(mountNode, data, languages);
    status.textContent = `Prefilled from ${data.full_name}. Edit anything before saving.`;
  } catch (err) {
    status.style.color = 'var(--danger)';
    status.textContent = err.message;
  } finally {
    button.disabled = false;
  }
}

function parseRepoInput(raw) {
  const cleaned = String(raw ?? '').trim().replace(/\.git$/, '').replace(/\/+$/, '');
  if (!cleaned) return null;
  const parts = cleaned.split('/').filter(Boolean);
  if (parts.length < 2) return null;
  return { owner: parts[parts.length - 2], repo: parts[parts.length - 1] };
}

function applyGitHubData(mountNode, data, languages = []) {
  const setIf = (selector, value) => {
    if (value == null || value === '') return;
    mountNode.querySelector(selector).value = value;
  };

  const repoName = data.name ?? '';
  const slug = repoName.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  const title = repoName.split(/[-_\s]+/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(' ');

  setIf('#title', title);
  setIf('#slug', slug);
  setIf('#summary', data.description);
  setIf('#repo_url', data.html_url);
  setIf('#demo_url', data.homepage);

  // tech_stack = languages (HTML/CSS/JS/etc., from /languages endpoint).
  // tags = topics set on the GitHub repo (e.g. ux-design, web, portfolio).
  if (languages.length) setIf('#tech_stack', languages.join(', '));
  if (data.topics?.length) setIf('#tags', data.topics.join(', '));
}

async function handleSubmit(mountNode, existing, onDone) {
  const errorBox = mountNode.querySelector('#form-error');
  errorBox.innerHTML = '';

  const form = mountNode.querySelector('#project-form');
  const fd = new FormData(form);

  const slug = String(fd.get('slug') ?? '').trim();
  if (!SLUG_RE.test(slug)) {
    errorBox.innerHTML = `<p class="error">Slug must be lowercase letters, digits, and hyphens only.</p>`;
    return;
  }

  const file = fd.get('screenshot');
  const hasNewFile = file && file instanceof File && file.size > 0;

  let screenshot_url = existing?.screenshot_url ?? null;
  let oldFilename = null;
  if (existing?.screenshot_url) {
    const m = existing.screenshot_url.match(/\/project-screenshots\/(.+)$/);
    if (m) oldFilename = m[1];
  }

  if (hasNewFile) {
    if (file.size > 5 * 1024 * 1024) {
      errorBox.innerHTML = `<p class="error">Image too large (max 5 MB).</p>`;
      return;
    }
    const ext = extFromMime(file.type);
    if (!ext) {
      errorBox.innerHTML = `<p class="error">Unsupported image type. Use JPG, PNG, or WebP.</p>`;
      return;
    }
    const filename = `${slug}.${ext}`;

    const upload = await supabase.storage
      .from('project-screenshots')
      .upload(filename, file, { upsert: true, contentType: file.type });

    if (upload.error) {
      errorBox.innerHTML = `<p class="error">Upload failed: ${esc(upload.error.message)}</p>`;
      return;
    }

    screenshot_url = supabase.storage
      .from('project-screenshots')
      .getPublicUrl(filename).data.publicUrl;

    if (existing && oldFilename && oldFilename !== filename) {
      const cleanup = await supabase.storage.from('project-screenshots').remove([oldFilename]);
      if (cleanup.error) {
        console.warn('Old screenshot cleanup failed (non-fatal):', cleanup.error.message);
      }
    }
  }

  const row = {
    slug,
    title: String(fd.get('title') ?? '').trim(),
    summary: String(fd.get('summary') ?? '').trim(),
    description: nullIfBlank(fd.get('description')),
    tech_stack: splitList(fd.get('tech_stack')),
    tags: splitList(fd.get('tags')),
    demo_url: nullIfBlank(fd.get('demo_url')),
    repo_url: nullIfBlank(fd.get('repo_url')),
    sort_order: Number(fd.get('sort_order') ?? 0) | 0,
    featured: fd.get('featured') === 'on',
    published: fd.get('published') === 'on',
    screenshot_url,
  };

  if (existing) row.id = existing.id;

  const { error } = await supabase.from('projects').upsert(row).select().single();
  if (error) {
    errorBox.innerHTML = `<p class="error">Save failed: ${esc(error.message)}</p>`;
    return;
  }
  onDone();
}

function extFromMime(mime) {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return null;
}

function splitList(raw) {
  return String(raw ?? '').split(',').map(s => s.trim()).filter(Boolean);
}

function nullIfBlank(raw) {
  const s = String(raw ?? '').trim();
  return s.length ? s : null;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
