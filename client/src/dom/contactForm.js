const FALLBACK_EMAIL = 'jkylecadap@gmail.com';

export function initContactForm() {
  const form = document.querySelector('#contact-form');
  if (!form) return;

  const status = form.querySelector('.cf-status');
  const submitBtn = form.querySelector('.cf-submit');
  const turnstileEl = form.querySelector('.cf-turnstile');

  // Explicit Turnstile rendering — implicit auto-render only catches
  // .cf-turnstile divs present at api.js load time. Our form is mounted
  // dynamically, so we render manually once api.js exposes window.turnstile.
  function renderTurnstile(attempts = 0) {
    if (!turnstileEl) return;
    if (turnstileEl.dataset.rendered === 'true') return;
    if (window.turnstile && typeof window.turnstile.render === 'function') {
      try {
        window.turnstile.render(turnstileEl, {
          sitekey: turnstileEl.dataset.sitekey,
        });
        turnstileEl.dataset.rendered = 'true';
      } catch (err) {
        console.error('Turnstile render error:', err);
      }
      return;
    }
    if (attempts < 50) {
      setTimeout(() => renderTurnstile(attempts + 1), 100);
    } else {
      console.error('Turnstile api.js never loaded after 5s');
    }
  }
  renderTurnstile();

  function setStatus(text, kind = 'info') {
    if (!status) return;
    status.textContent = text;
    status.dataset.kind = kind;
  }

  function setBusy(busy) {
    if (!submitBtn) return;
    submitBtn.disabled = busy;
    submitBtn.textContent = busy ? 'Sending…' : 'Send';
  }

  function clearFieldErrors() {
    form.querySelectorAll('.cf-field-error').forEach((el) => el.remove());
    form.querySelectorAll('.cf-field--invalid').forEach((el) => el.classList.remove('cf-field--invalid'));
  }

  function showFieldErrors(fieldErrors) {
    clearFieldErrors();
    for (const [fieldName, message] of Object.entries(fieldErrors || {})) {
      const input = form.querySelector(`[name="${fieldName}"]`);
      if (!input) continue;
      const fieldEl = input.closest('.cf-field') ?? input;
      fieldEl.classList.add('cf-field--invalid');
      const err = document.createElement('span');
      err.className = 'cf-field-error';
      err.textContent = message;
      fieldEl.appendChild(err);
    }
  }

  function showSuccess() {
    form.innerHTML = `
      <p class="cf-success">Message sent. I'll get back to you soon.</p>
    `;
  }

  function showFallback(prefix) {
    setStatus(
      `${prefix} You can also email me directly: ${FALLBACK_EMAIL}`,
      'error'
    );
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFieldErrors();
    setStatus('', 'info');

    const fd = new FormData(form);
    const payload = {
      name: String(fd.get('name') || '').trim(),
      email: String(fd.get('email') || '').trim(),
      message: String(fd.get('message') || '').trim(),
      company: String(fd.get('company') || ''),
      turnstileToken: String(fd.get('cf-turnstile-response') || ''),
    };

    if (!payload.turnstileToken) {
      setStatus("Hold on — verifying you're human. Try again in a second.", 'error');
      return;
    }

    setBusy(true);
    setStatus('Sending…', 'info');

    let response;
    try {
      response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error('Network error:', err);
      setBusy(false);
      showFallback("Network problem — couldn't reach the server.");
      return;
    }

    let data = null;
    try {
      data = await response.json();
    } catch {
      // Non-JSON response — treat as server error
    }

    setBusy(false);

    if (response.ok && data?.ok) {
      showSuccess();
      return;
    }

    if (response.status === 400 && data?.fieldErrors) {
      showFieldErrors(data.fieldErrors);
      setStatus('Please fix the highlighted fields.', 'error');
      return;
    }

    if (response.status === 403) {
      setStatus("Couldn't verify you're human. Refresh the page and try again.", 'error');
      return;
    }

    showFallback('Something broke on our end.');
  });
}
