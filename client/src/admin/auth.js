import { supabase } from '../lib/supabase.js';

const OWNER_EMAIL = 'jkylecadap@gmail.com';

export function initAdmin(mountNode) {
  let currentSession = null;

  async function refreshAndRender() {
    const { data: { session } } = await supabase.auth.getSession();
    currentSession = session;
    render(mountNode, session);
  }

  supabase.auth.onAuthStateChange((_event, session) => {
    currentSession = session;
    render(mountNode, session);
  });

  refreshAndRender();
}

function render(mountNode, session) {
  if (!session) return renderSignIn(mountNode);
  if (session.user.email !== OWNER_EMAIL) return renderUnauthorized(mountNode);
  renderDashboardLoading(mountNode);
  // dashboard.js will be wired in Task 8.
  import('./dashboard.js').then(({ renderDashboard }) => renderDashboard(mountNode));
}

function renderSignIn(mountNode) {
  mountNode.innerHTML = `
    <h1>Admin</h1>
    <p>Sign in with the owner GitHub account to continue.</p>
    <button id="signin-github">Sign in with GitHub</button>
  `;
  mountNode.querySelector('#signin-github').addEventListener('click', async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
    if (error) {
      mountNode.insertAdjacentHTML('beforeend', `<p class="error">Sign-in failed: ${escapeText(error.message)}</p>`);
    }
  });
}

function renderUnauthorized(mountNode) {
  mountNode.innerHTML = `
    <h1>Not authorized</h1>
    <p>This Google/GitHub account is not the owner. Sign out and try again.</p>
    <button id="signout">Sign out</button>
  `;
  mountNode.querySelector('#signout').addEventListener('click', async () => {
    await supabase.auth.signOut();
  });
}

function renderDashboardLoading(mountNode) {
  mountNode.innerHTML = `<p>Loading dashboard…</p>`;
}

function escapeText(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
