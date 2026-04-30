# Contact Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `mailto:` link in `Contact.js` with a real working contact form that emails the owner via Resend, sends an auto-reply to the sender, and rejects bots with honeypot + Cloudflare Turnstile. Deploys on Vercel from a single `git push`.

**Architecture:** Single Vercel serverless function at `api/contact.js`. Frontend posts JSON to `/api/contact`. Function validates with Zod, checks honeypot, verifies Turnstile, sends two emails via Resend, returns `{ ok: true|false }`. The frontend's submit handler lives in `client/src/dom/contactForm.js` (markup-only `Contact.js` follows the codebase's existing component / behavior split).

**Tech Stack:** Vercel serverless functions (Node 20), Resend SDK, Zod, Cloudflare Turnstile (invisible widget). Frontend stays vanilla Vite + Three.js — no framework added.

**Verification approach:** No automated tests in this iteration. After every code-changing step, verification is one of: `npm run build` (catches imports / syntax / build wiring), a `curl` against `vercel dev` (catches API behavior), or a visual / form-submission check in the browser. The final task is a production smoke test the user runs against the deployed domain.

**User commit policy:** The user handles git commits. Subagents and the user **do NOT** run `git add` / `git commit` as part of this plan. Steps end at "edit files → verify". The user commits at whatever cadence they like.

**Reference:** Full design at `docs/superpowers/specs/2026-04-29-contact-form-design.md`.

---

## Task 1: Repo + Vercel setup

Establish the Vercel monorepo configuration: add `vercel.json`, switch root `package.json` to ESM, install root-level dependencies (Resend, Zod), add the `dev:full` script, create `.env.example`, ensure `.env.local` is gitignored, delete the empty `server/` placeholder.

**Files:**
- Create: `vercel.json`
- Create: `.env.example`
- Create: `client/vite.config.js`
- Modify: `package.json` (root)
- Modify: `.gitignore` (add `.env.local` if not already covered)
- Delete: `server/README.md` and the `server/` directory

- [ ] **Step 1: Create `vercel.json` at repo root**

```json
{
  "framework": "vite",
  "buildCommand": "npm --prefix client run build",
  "outputDirectory": "client/dist",
  "functions": {
    "api/**/*.js": { "maxDuration": 10 }
  }
}
```

- [ ] **Step 2: Update root `package.json`**

Replace contents with:

```json
{
  "name": "portfolio",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "npm --prefix client run dev",
    "dev:full": "vercel dev",
    "build": "npm --prefix client run build",
    "preview": "npm --prefix client run preview"
  },
  "dependencies": {
    "resend": "^4.0.1",
    "zod": "^3.23.8"
  }
}
```

The `"type": "module"` lets `api/*.js` use `import` / `export default` (the standard Vercel handler shape).

- [ ] **Step 3: Install root dependencies**

Run from repo root:
```bash
npm install
```
Expected: `node_modules/` created at root with `resend` and `zod`. No errors.

- [ ] **Step 4: Create `.env.example`**

```bash
# Resend (https://resend.com/api-keys)
RESEND_API_KEY=re_replace_me

# Cloudflare Turnstile (https://dash.cloudflare.com/?to=/:account/turnstile)
TURNSTILE_SECRET_KEY=replace_me
VITE_TURNSTILE_SITE_KEY=1x00000000000000000000BB

# Email addresses
OWNER_EMAIL=jkylecadap@gmail.com
SENDER_EMAIL=onboarding@resend.dev
```

`SENDER_EMAIL` defaults to Resend's onboarding address so dev works before you've verified your own domain. Switch to `noreply@yourdomain.com` once domain DNS is set (Task 12). The Turnstile site key default is Cloudflare's "always-pass invisible" test key.

- [ ] **Step 5: Ensure `.env.local` is gitignored**

Read current `.gitignore` and confirm it contains `*.local` or add `.env.local`. The existing `.gitignore` already has `*.local` so nothing to add — but if it's missing, append:

```
.env.local
```

- [ ] **Step 6: Create `client/vite.config.js`**

This makes Vite read `.env.local` from the repo root (where `vercel dev` also reads it), so client-side `VITE_*` variables and server-side variables share a single source of truth.

```js
import { defineConfig } from 'vite';

export default defineConfig({
  envDir: '..',
});
```

- [ ] **Step 7: Delete the `server/` directory**

```bash
rm -rf server
```

- [ ] **Step 8: Verify build still works**

```bash
npm run build
```
Expected: Vite builds successfully, output to `client/dist/`. No errors.

---

## Task 2: API skeleton — `api/contact.js` returning a stub response

Create the serverless function file with the simplest valid handler. No validation, no email yet — just confirms the routing works.

**Files:**
- Create: `api/contact.js`

- [ ] **Step 1: Create `api/contact.js`**

```js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  return res.status(200).json({ ok: true, stub: true });
}
```

- [ ] **Step 2: Install Vercel CLI globally if not already present**

Run:
```bash
vercel --version
```
If the command isn't found, install it:
```bash
npm install -g vercel
```

- [ ] **Step 3: Start the dev server with `vercel dev`**

Run from repo root:
```bash
npm run dev:full
```

First time, Vercel CLI may prompt to log in and link the project. Follow the prompts (link to a new Vercel project — name it `portfolio` or whatever you prefer). After linking, `vercel dev` runs Vite + serverless on the same port (default `3000`).

- [ ] **Step 4: Smoke test the endpoint with curl**

In a second terminal:
```bash
curl -X POST http://localhost:3000/api/contact \
  -H 'content-type: application/json' \
  -d '{}'
```
Expected response:
```
{"ok":true,"stub":true}
```

Then test the method guard:
```bash
curl -X GET http://localhost:3000/api/contact
```
Expected: HTTP 405 with `{"ok":false,"error":"Method not allowed"}`.

- [ ] **Step 5: Stop the dev server (Ctrl+C)**

---

## Task 3: API validation with Zod

Add input validation. Reject malformed payloads with 400 + field errors. Honeypot field is permissive at validation time so bots don't learn from a 400.

**Files:**
- Modify: `api/contact.js`

- [ ] **Step 1: Replace `api/contact.js` with the validation version**

```js
import { z } from 'zod';

const ContactSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(200),
  message: z.string().min(1).max(5000),
  company: z.string().max(200).optional(),
  turnstileToken: z.string().min(1),
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const parsed = ContactSchema.safeParse(req.body);
  if (!parsed.success) {
    const fieldErrors = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return res.status(400).json({ ok: false, fieldErrors });
  }

  return res.status(200).json({ ok: true, validated: true });
}
```

- [ ] **Step 2: Restart the dev server**

```bash
npm run dev:full
```

- [ ] **Step 3: Smoke test validation paths**

Empty body — should fail validation:
```bash
curl -X POST http://localhost:3000/api/contact \
  -H 'content-type: application/json' \
  -d '{}'
```
Expected: HTTP 400 with `fieldErrors` listing missing fields.

Invalid email:
```bash
curl -X POST http://localhost:3000/api/contact \
  -H 'content-type: application/json' \
  -d '{"name":"Test","email":"not-an-email","message":"hi","turnstileToken":"x"}'
```
Expected: HTTP 400 with `fieldErrors.email`.

Valid payload:
```bash
curl -X POST http://localhost:3000/api/contact \
  -H 'content-type: application/json' \
  -d '{"name":"Test","email":"test@example.com","message":"hi","turnstileToken":"x"}'
```
Expected: HTTP 200 with `{"ok":true,"validated":true}`.

- [ ] **Step 4: Stop the dev server**

---

## Task 4: API honeypot check

Silently drop submissions where the honeypot field is filled. Return `200 { ok: true }` so bots think they succeeded.

**Files:**
- Modify: `api/contact.js`

- [ ] **Step 1: Add the honeypot check after validation**

Replace the line `return res.status(200).json({ ok: true, validated: true });` in `api/contact.js` with:

```js
  // Honeypot — bots fill all fields. Real users never touch this.
  if (parsed.data.company && parsed.data.company.length > 0) {
    return res.status(200).json({ ok: true });
  }

  return res.status(200).json({ ok: true, validated: true });
```

- [ ] **Step 2: Restart the dev server**

```bash
npm run dev:full
```

- [ ] **Step 3: Smoke test the honeypot**

Honeypot filled (bot behavior):
```bash
curl -X POST http://localhost:3000/api/contact \
  -H 'content-type: application/json' \
  -d '{"name":"Bot","email":"bot@example.com","message":"spam","company":"Bot Inc","turnstileToken":"x"}'
```
Expected: HTTP 200 with `{"ok":true}` (no `validated: true` — that's the honeypot path).

Honeypot empty (real user):
```bash
curl -X POST http://localhost:3000/api/contact \
  -H 'content-type: application/json' \
  -d '{"name":"Real","email":"real@example.com","message":"hi","turnstileToken":"x"}'
```
Expected: HTTP 200 with `{"ok":true,"validated":true}`.

- [ ] **Step 4: Stop the dev server**

---

## Task 5: API Turnstile verification

Verify the Turnstile token with Cloudflare. Use Cloudflare's documented test secret keys for local dev.

**Files:**
- Modify: `api/contact.js`

- [ ] **Step 1: Add Turnstile verify before the success response**

Replace `api/contact.js` entirely with:

```js
import { z } from 'zod';

const ContactSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(200),
  message: z.string().min(1).max(5000),
  company: z.string().max(200).optional(),
  turnstileToken: z.string().min(1),
});

async function verifyTurnstile(token) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) throw new Error('TURNSTILE_SECRET_KEY not set');

  const body = new URLSearchParams({ secret, response: token });
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body,
  });
  const data = await r.json();
  return Boolean(data?.success);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const parsed = ContactSchema.safeParse(req.body);
  if (!parsed.success) {
    const fieldErrors = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return res.status(400).json({ ok: false, fieldErrors });
  }

  if (parsed.data.company && parsed.data.company.length > 0) {
    return res.status(200).json({ ok: true });
  }

  let humanVerified = false;
  try {
    humanVerified = await verifyTurnstile(parsed.data.turnstileToken);
  } catch (err) {
    console.error('Turnstile verify error:', err);
    return res.status(500).json({ ok: false, error: 'Verification service unavailable' });
  }
  if (!humanVerified) {
    return res.status(403).json({ ok: false, error: 'Verification failed' });
  }

  return res.status(200).json({ ok: true, verified: true });
}
```

- [ ] **Step 2: Add Turnstile test secret to `.env.local`**

Create or edit `.env.local` at repo root (gitignored). Add:

```bash
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
VITE_TURNSTILE_SITE_KEY=1x00000000000000000000BB
RESEND_API_KEY=re_replace_with_real_key_in_step_below
OWNER_EMAIL=jkylecadap@gmail.com
SENDER_EMAIL=onboarding@resend.dev
```

`1x0000000000000000000000000000000AA` is Cloudflare's **always-pass** test secret. The site key `1x00000000000000000000BB` is the always-pass invisible-widget test site key.

- [ ] **Step 3: Restart the dev server**

```bash
npm run dev:full
```

- [ ] **Step 4: Smoke test always-pass**

```bash
curl -X POST http://localhost:3000/api/contact \
  -H 'content-type: application/json' \
  -d '{"name":"Real","email":"real@example.com","message":"hi","turnstileToken":"any-string-works-with-test-key"}'
```
Expected: HTTP 200 with `{"ok":true,"verified":true}`.

- [ ] **Step 5: Smoke test always-fail**

Temporarily change `TURNSTILE_SECRET_KEY` in `.env.local` to:
```
TURNSTILE_SECRET_KEY=2x0000000000000000000000000000000AA
```
Restart `vercel dev`. Then:
```bash
curl -X POST http://localhost:3000/api/contact \
  -H 'content-type: application/json' \
  -d '{"name":"Real","email":"real@example.com","message":"hi","turnstileToken":"any"}'
```
Expected: HTTP 403 with `{"ok":false,"error":"Verification failed"}`.

Switch the secret back to the always-pass value (`1x0000000000000000000000000000000AA`) and restart before continuing.

- [ ] **Step 6: Stop the dev server**

---

## Task 6: API Resend integration — owner notification

Send an email to the owner when a valid submission arrives. No auto-reply yet.

**Files:**
- Modify: `api/contact.js`

- [ ] **Step 1: Sign up for Resend and get an API key**

Go to https://resend.com → sign up → Dashboard → API Keys → Create new API key (full access, named `portfolio-dev`). Copy the key (starts with `re_`).

- [ ] **Step 2: Update `.env.local` with the real Resend API key**

Edit `.env.local`:
```bash
RESEND_API_KEY=re_your_real_dev_key_here
```

- [ ] **Step 3: Update `api/contact.js` to send the owner notification**

Replace `api/contact.js` with:

```js
import { z } from 'zod';
import { Resend } from 'resend';

const ContactSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(200),
  message: z.string().min(1).max(5000),
  company: z.string().max(200).optional(),
  turnstileToken: z.string().min(1),
});

async function verifyTurnstile(token) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) throw new Error('TURNSTILE_SECRET_KEY not set');
  const body = new URLSearchParams({ secret, response: token });
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body,
  });
  const data = await r.json();
  return Boolean(data?.success);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const parsed = ContactSchema.safeParse(req.body);
  if (!parsed.success) {
    const fieldErrors = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return res.status(400).json({ ok: false, fieldErrors });
  }

  const { name, email, message, company, turnstileToken } = parsed.data;

  if (company && company.length > 0) {
    return res.status(200).json({ ok: true });
  }

  let humanVerified = false;
  try {
    humanVerified = await verifyTurnstile(turnstileToken);
  } catch (err) {
    console.error('Turnstile verify error:', err);
    return res.status(500).json({ ok: false, error: 'Verification service unavailable' });
  }
  if (!humanVerified) {
    return res.status(403).json({ ok: false, error: 'Verification failed' });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const ownerEmail = process.env.OWNER_EMAIL;
  const senderEmail = process.env.SENDER_EMAIL;

  try {
    await resend.emails.send({
      from: senderEmail,
      to: ownerEmail,
      replyTo: email,
      subject: `Portfolio contact from ${name}`,
      text: `From: ${name} <${email}>\n\n${message}`,
    });
  } catch (err) {
    console.error('Owner email send error:', err);
    return res.status(500).json({ ok: false, error: 'Something went wrong.' });
  }

  return res.status(200).json({ ok: true });
}
```

- [ ] **Step 4: Restart the dev server**

```bash
npm run dev:full
```

- [ ] **Step 5: Send a test message via curl**

```bash
curl -X POST http://localhost:3000/api/contact \
  -H 'content-type: application/json' \
  -d '{"name":"Local Test","email":"jkylecadap@gmail.com","message":"hello from local dev","turnstileToken":"x"}'
```
Expected: HTTP 200 with `{"ok":true}`. Within ~10 seconds, an email arrives at `jkylecadap@gmail.com` with subject "Portfolio contact from Local Test".

If no email arrives, check:
- Resend Dashboard → Emails → most recent — was the send recorded? What's the status?
- Vercel function logs (`vercel dev` terminal output) — any errors logged?
- The `from` address — Resend's onboarding sender (`onboarding@resend.dev`) is what works without a verified domain.

- [ ] **Step 6: Stop the dev server**

---

## Task 7: API auto-reply email

Send a second email to the original sender confirming receipt. If the auto-reply fails but the owner email succeeded, log and still return success — the message reached the owner, that's the contract.

**Files:**
- Modify: `api/contact.js`

- [ ] **Step 1: Add the auto-reply send after the owner notification**

Replace the entire `try { ... await resend.emails.send({ from: senderEmail, to: ownerEmail, ... }); } catch ...` block with:

```js
  try {
    await resend.emails.send({
      from: senderEmail,
      to: ownerEmail,
      replyTo: email,
      subject: `Portfolio contact from ${name}`,
      text: `From: ${name} <${email}>\n\n${message}`,
    });
  } catch (err) {
    console.error('Owner email send error:', err);
    return res.status(500).json({ ok: false, error: 'Something went wrong.' });
  }

  // Auto-reply — best-effort. If it fails, we still consider the submission successful
  // because the owner already got the message.
  try {
    await resend.emails.send({
      from: senderEmail,
      to: email,
      subject: 'Thanks for reaching out',
      text: `Hi ${name},\n\nI got your message and will get back to you soon.\n\n— John Kyle`,
    });
  } catch (err) {
    console.error('Auto-reply send error (non-fatal):', err);
  }
```

- [ ] **Step 2: Restart the dev server**

```bash
npm run dev:full
```

- [ ] **Step 3: Send a test message and verify both emails**

```bash
curl -X POST http://localhost:3000/api/contact \
  -H 'content-type: application/json' \
  -d '{"name":"Test Sender","email":"jkylecadap+test@gmail.com","message":"testing auto-reply","turnstileToken":"x"}'
```

Expected:
- HTTP 200 with `{"ok":true}`.
- Owner email arrives at `jkylecadap@gmail.com`.
- Auto-reply arrives at `jkylecadap+test@gmail.com` (the `+test` is a Gmail alias — same inbox, different "to" address).

If using a real second address, replace the `email` field with that address.

- [ ] **Step 4: Stop the dev server**

---

## Task 8: Frontend — `Contact.js` form markup

Replace the email-as-heading with a form that includes name / email / message inputs, the honeypot field, the Turnstile widget div, and a submit button + status region.

**Files:**
- Modify: `client/src/components/Contact.js`

- [ ] **Step 1: Replace `client/src/components/Contact.js`**

```js
export const Contact = () => `
  <section id="contact" data-spin="contact" class="section section--centered">
    <p class="eyebrow">Contact</p>
    <h2 class="contact-heading">Get in touch</h2>
    <form id="contact-form" class="contact-form" novalidate>
      <label class="cf-field">
        <span class="cf-label">Your name</span>
        <input name="name" type="text" required maxlength="100" autocomplete="name" />
      </label>
      <label class="cf-field">
        <span class="cf-label">Email</span>
        <input name="email" type="email" required maxlength="200" autocomplete="email" />
      </label>
      <label class="cf-field">
        <span class="cf-label">Message</span>
        <textarea name="message" required maxlength="5000" rows="5"></textarea>
      </label>
      <input name="company" type="text" tabindex="-1" autocomplete="off" class="cf-hp" aria-hidden="true" />
      <div class="cf-turnstile" data-sitekey="${import.meta.env.VITE_TURNSTILE_SITE_KEY}"></div>
      <button type="submit" class="cf-submit">Send</button>
      <p class="cf-status" role="status" aria-live="polite"></p>
    </form>
  </section>
`;
```

The `${import.meta.env.VITE_TURNSTILE_SITE_KEY}` is interpolated at build time by Vite. Without that env var set, the data attribute will be the literal string `undefined` and Turnstile will refuse to render — that's why setting `.env.local` in Task 5 mattered.

- [ ] **Step 2: Verify the build still passes**

```bash
npm run build
```
Expected: success. The build will inline the env var into the rendered HTML strings.

- [ ] **Step 3: Visual check (optional, no behavior yet)**

```bash
npm run dev
```
Open `http://localhost:5173`, scroll to the contact section. The form should render (it's unstyled — Task 11 fixes that), the Turnstile widget div should be present (it won't show anything yet because we haven't added the Cloudflare script), submit does nothing yet. Stop the dev server.

---

## Task 9: Frontend — Turnstile script tag

Add Cloudflare's Turnstile script to `index.html` so the widget can render itself into `.cf-turnstile` divs.

**Files:**
- Modify: `client/index.html`

- [ ] **Step 1: Add the Turnstile script tag inside `<head>`**

Open `client/index.html` and replace the `<head>` block. The current head looks like:

```html
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Portfolio</title>
    <link rel="stylesheet" href="/src/styles/main.css" />
</head>
```

Add the Turnstile script right after the stylesheet link:

```html
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Portfolio</title>
    <link rel="stylesheet" href="/src/styles/main.css" />
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
</head>
```

- [ ] **Step 2: Visual check**

```bash
npm run dev
```
Open `http://localhost:5173`, scroll to the contact section. With the always-pass test site key, the invisible Turnstile widget will render but stay invisible. To confirm it loaded: open DevTools Console and run:

```js
document.querySelectorAll('input[name="cf-turnstile-response"]').length
```
Expected: `1` (Turnstile injected its hidden response field). If the result is `0`, the script didn't load — check Network tab for the `api.js` request, check `data-sitekey` is a valid value (not `undefined`).

Stop the dev server.

---

## Task 10: Frontend — `dom/contactForm.js` state machine

Implement the submit handler with the four-state machine (idle / submitting / success / error). Wire it from `main.js`.

**Files:**
- Create: `client/src/dom/contactForm.js`
- Modify: `client/src/main.js`

- [ ] **Step 1: Create `client/src/dom/contactForm.js`**

```js
const FALLBACK_EMAIL = 'jkylecadap@gmail.com';

export function initContactForm() {
  const form = document.querySelector('#contact-form');
  if (!form) return;

  const status = form.querySelector('.cf-status');
  const submitBtn = form.querySelector('.cf-submit');

  function setStatus(text, kind = 'info') {
    if (!status) return;
    status.textContent = text;
    status.dataset.kind = kind; // 'info' | 'error' | 'success'
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
      setStatus('Hold on — verifying you\'re human. Try again in a second.', 'error');
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
      showFallback('Network problem — couldn\'t reach the server.');
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
      setStatus('Couldn\'t verify you\'re human. Refresh the page and try again.', 'error');
      return;
    }

    showFallback('Something broke on our end.');
  });
}
```

- [ ] **Step 2: Wire `initContactForm` from `client/src/main.js`**

Open `client/src/main.js`. Add the import near the other DOM imports:

```js
import { initContactForm } from './dom/contactForm.js';
```

Then add a call **after** `initSectionObserver();` (so the form is in the DOM by the time the handler attaches):

```js
initSectionObserver();
initContactForm();
```

- [ ] **Step 3: Verify the build**

```bash
npm run build
```
Expected: success.

- [ ] **Step 4: Full end-to-end test with `vercel dev`**

```bash
npm run dev:full
```

Open `http://localhost:3000`, scroll to the contact section, fill the form with real-looking values, submit. Expected:

- Send button disables, label changes to "Sending…".
- Within a few seconds: form is replaced with "Message sent. I'll get back to you soon."
- Email arrives at `jkylecadap@gmail.com`.
- Auto-reply arrives at the email you entered.

Test the validation path: fill an obviously invalid email (e.g. `bad`), submit. Expected: `cf-field--invalid` class on the email field, an error span below it, status text "Please fix the highlighted fields.".

Test the network-error path (optional): in DevTools Network tab, set throttling to "Offline" or block the `/api/contact` request, then submit. Expected: fallback message with the direct email.

Stop the dev server.

---

## Task 11: Frontend — CSS for the form

Style the new form to match the rest of the contact section's centered, light-typography aesthetic.

**Files:**
- Modify: `client/src/styles/components/contact.css`

- [ ] **Step 1: Replace `client/src/styles/components/contact.css`**

```css
.contact-heading {
  margin-top: 0.25rem;
  margin-bottom: 1.75rem;
}

.contact-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  max-width: 28rem;
  margin: 0 auto;
  text-align: left;
}

.cf-field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.cf-label {
  font-size: 0.625rem;
  letter-spacing: 0.4em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.4);
}

.cf-field input,
.cf-field textarea {
  width: 100%;
  padding: 0.7rem 0.9rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.9);
  font-family: inherit;
  font-size: 0.95rem;
  letter-spacing: -0.005em;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.cf-field input:focus,
.cf-field textarea:focus {
  outline: none;
  border-color: var(--accent);
  background: rgba(255, 255, 255, 0.06);
}

.cf-field textarea {
  resize: vertical;
  min-height: 7rem;
}

.cf-field--invalid input,
.cf-field--invalid textarea {
  border-color: rgba(255, 110, 90, 0.7);
}

.cf-field-error {
  font-size: 0.75rem;
  color: rgba(255, 140, 120, 0.85);
  margin-top: 0.1rem;
}

.cf-hp {
  display: none !important;
}

.cf-turnstile {
  min-height: 0;
}

.cf-submit {
  align-self: center;
  margin-top: 0.5rem;
  padding: 0.7rem 2rem;
  background: var(--accent);
  color: #0a0a0f;
  border: 0;
  border-radius: 8px;
  font-family: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: opacity 0.2s ease, transform 0.1s ease;
}

.cf-submit:hover {
  opacity: 0.9;
}

.cf-submit:active {
  transform: scale(0.98);
}

.cf-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cf-status {
  font-size: 0.8125rem;
  text-align: center;
  min-height: 1.2em;
  color: rgba(255, 255, 255, 0.55);
}

.cf-status[data-kind="error"] {
  color: rgba(255, 140, 120, 0.9);
}

.cf-status[data-kind="success"] {
  color: rgba(140, 220, 160, 0.9);
}

.cf-success {
  font-size: 1rem;
  letter-spacing: -0.005em;
  color: rgba(255, 255, 255, 0.85);
  text-align: center;
}
```

- [ ] **Step 2: Verify the build**

```bash
npm run build
```
Expected: success.

- [ ] **Step 3: Visual check**

```bash
npm run dev:full
```
Open `http://localhost:3000`, scroll to contact. The form should look:
- Centered, max width ~28rem.
- Inputs with subtle dark background, thin border, rounded corners.
- Labels in tiny uppercase letter-spaced text above each input.
- Send button in accent color (the `--accent` CSS var).
- Honeypot field invisible (no visual trace).

Submit a test message; the success state should also be styled correctly. Stop the dev server.

---

## Task 12: Update `AGENTS.md` and `CLAUDE.md`

Reflect the new `api/` convention, dev workflow, and "currently building" status.

**Files:**
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update `AGENTS.md` — replace the "Backend code" row in the "Where does X go?" table**

Find this line in `AGENTS.md`:
```markdown
| Backend code (API, mailer, DB) | `server/...` | Scaffold `server/package.json` first. Update root scripts. |
```

Replace with:
```markdown
| Backend code (API endpoint) | `api/<name>.js` (repo root) | One file = one HTTP endpoint = one Vercel serverless function. Vercel auto-detects `api/` and deploys each file as `/api/<name>`. |
```

- [ ] **Step 2: Update `AGENTS.md` — add `api/` conventions section**

Find the "Conventions per folder" section. Add a new sub-section after the existing `utils/` block (or between `dom/` and `styles/` — wherever fits the document's flow):

```markdown
### `api/`
- Each `api/<name>.js` is a Vercel serverless function. Default export is the handler: `export default async function handler(req, res) { ... }`.
- One responsibility per file. Don't co-mingle endpoints — `api/contact.js` and `api/projects.js` stay separate.
- Always validate input with a Zod schema at the top of the handler. Validation failures → `400 { ok: false, fieldErrors: { ... } }`.
- Always return JSON in the shape `{ ok: boolean, ...payload }`. Never leak internal error details — log via `console.error` (visible in Vercel dashboard logs) and return a generic message.
- Read secrets via `process.env.<NAME>`. Add new keys to `.env.example` and to Vercel project settings.
```

- [ ] **Step 3: Update `AGENTS.md` — replace the `server/` row in the table and the "Server" sub-section**

Find the row:
```markdown
| Backend code (API, mailer, DB) | `server/...` | Scaffold `server/package.json` first. Update root scripts. |
```

(This was already replaced in Step 1 — confirm it's gone.)

Find the "Server" sub-section under "Conventions per folder":
```markdown
### `server/`
- Currently empty. When you start backend work, read `server/README.md` first.
- The frontend never imports from `server/`. Cross the boundary only via `fetch()` to API endpoints.
```

Replace with (or delete if no longer relevant):
```markdown
### `server/` (removed)
The previous `server/` placeholder was replaced by Vercel-style `api/` at the repo root. See the `api/` section above.
```

- [ ] **Step 4: Update `AGENTS.md` — verification section**

Find the "Verification" section. Replace its content with:

```markdown
## Verification

This project has no automated test suite. After **every** non-trivial change:

```bash
npm run build         # from repo root — fails fast on import / syntax / build wiring
npm run dev           # frontend only (Vite at :5173) — for visual / scene work
npm run dev:full      # vercel dev — full stack (functions + Vite at :3000) — for API / form work
```

If you can't run a browser, at minimum confirm `npm run build` exits 0 before declaring work complete.
```

- [ ] **Step 5: Update `CLAUDE.md` — "Currently building" section**

Find the "## Currently building" section in `CLAUDE.md`. Replace its content with:

```markdown
## Currently building

**Contact form (server-side)** — *in progress.*

Spec: `docs/superpowers/specs/2026-04-29-contact-form-design.md`
Plan: `docs/superpowers/plans/2026-04-29-contact-form.md`

Architecture: Vercel serverless function at `api/contact.js`. Frontend posts JSON to `/api/contact`. Function validates with Zod, checks honeypot, verifies Cloudflare Turnstile token, sends owner notification + auto-reply via Resend. Send-and-forget — no DB. Local dev: `npm run dev:full` (requires Vercel CLI).
```

- [ ] **Step 6: Update `CLAUDE.md` — "Project structure" section**

Find the line in the "## Project structure" section:
```markdown
Repo is split into `client/` (frontend) and `server/` (backend
placeholder). Inside `client/src/`:
```

Replace with:
```markdown
Repo has `client/` (Vite frontend) and `api/` (Vercel serverless
functions; one file = one endpoint). Inside `client/src/`:
```

- [ ] **Step 7: Verify the build still passes**

```bash
npm run build
```
Expected: success (these are doc edits — build shouldn't break, but check anyway).

---

## Task 13: User-driven — domain, DNS, production deploy, smoke test

Everything up to this point works in local dev with Resend's onboarding sender and Cloudflare Turnstile test keys. This task moves to real production: a real domain, real DNS, real keys.

**This task is for the user, not subagents** — it requires interactive purchases, dashboard logins, and DNS waits.

- [ ] **Step 1: Buy a domain**

At Cloudflare Registrar (https://dash.cloudflare.com → Registrar) — at-cost pricing, free Cloudflare DNS included. Or Namecheap if you prefer. Cost: ~$10–15/year for a `.dev` / `.com` / etc.

- [ ] **Step 2: Add the domain to Vercel**

Vercel Dashboard → your project → Settings → Domains → Add Domain → enter the domain. Vercel shows DNS records (A / CNAME) to add at your registrar. If using Cloudflare DNS, set the proxy status to **DNS-only** (gray cloud) for the records Vercel asks for, otherwise SSL won't issue properly.

Wait for Vercel to mark the domain as "Configured" (usually < 5 min).

- [ ] **Step 3: Add the domain to Resend**

Resend Dashboard → Domains → Add Domain → enter the domain. It generates 2 required DNS records:
- 1 SPF record: `TXT @` value `"v=spf1 include:_spf.resend.com ~all"`
- 1 DKIM record: `TXT resend._domainkey` value (long string Resend gives you)

Copy each into Cloudflare DNS (or your registrar's DNS). Both records are DNS-only, no proxy.

Wait for Resend to mark the domain as "Verified" (usually < 5 min, sometimes up to 24h).

- [ ] **Step 4: Create a Cloudflare Turnstile site**

Cloudflare Dashboard → Turnstile → Add Site:
- Domain: your new domain
- Widget Mode: **Invisible**
- Pre-clearance: leave default

Save. Copy the **Site Key** (public, starts with `0x...`) and **Secret Key** (private, starts with `0x...`).

- [ ] **Step 5: Set production environment variables in Vercel**

Vercel Dashboard → your project → Settings → Environment Variables. Add (set to Production, optionally also Preview):

| Key | Value |
|---|---|
| `RESEND_API_KEY` | A new Resend API key with full access (named `portfolio-prod`) |
| `TURNSTILE_SECRET_KEY` | Real secret from Step 4 |
| `VITE_TURNSTILE_SITE_KEY` | Real site key from Step 4 |
| `OWNER_EMAIL` | `jkylecadap@gmail.com` |
| `SENDER_EMAIL` | `noreply@yourdomain.com` |

- [ ] **Step 6: Trigger a production deploy**

Push the branch you've been working on (or merge to `main` if that's your main deploy branch). Vercel auto-deploys.

- [ ] **Step 7: Production smoke test**

Open `https://yourdomain.com` in a browser. Scroll to contact, fill the form with a real test address, submit. Expected:

- Form transitions through Sending → Success.
- Email arrives at `jkylecadap@gmail.com` from `noreply@yourdomain.com`.
- Auto-reply arrives at the test address from `noreply@yourdomain.com`.

If something fails:
- **Email never arrives** — check Resend Dashboard → Emails for the send and its status. Common cause: domain not yet verified.
- **403 from Turnstile** — verify the Turnstile site/secret keys match the keys in Vercel env. Confirm the domain in Cloudflare Turnstile site config matches the actual deployed domain.
- **500 errors** — check Vercel Dashboard → your project → Functions → contact → Logs.

- [ ] **Step 8: Once verified, update `CLAUDE.md`**

Move "Contact form" out of "Currently building" and into a new "## Recently shipped" section (or similar):

```markdown
## Recently shipped

- **Contact form** (2026-04-?? — fill in deploy date) — `api/contact.js`, Resend, Turnstile. Spec: `docs/superpowers/specs/2026-04-29-contact-form-design.md`.
```

Update the "Currently building" line to point at the next feature (likely the AI chat widget per the roadmap).

---

## After all tasks

The contact form is shipped. The next features in the roadmap (AI chat, projects-from-DB, analytics) reuse the same patterns established here:

- New endpoint → `api/<name>.js` with Zod validation + structured error responses.
- New frontend behavior → `dom/<name>.js`.
- New env vars → `.env.example` + Vercel project settings.
- Local dev: `npm run dev:full`.
- Deploy: `git push`.
