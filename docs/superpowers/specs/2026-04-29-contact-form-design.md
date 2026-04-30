# Contact Form — Design

**Date:** 2026-04-29
**Status:** Approved (pending spec review)
**Owner:** John Kyle Camson

## Goal

Replace the current `mailto:` link in the Contact section with a real working contact form. Submissions are emailed to the owner via Resend, with an auto-reply to the sender. Spam is blocked by an invisible honeypot + Cloudflare Turnstile. The whole stack (frontend + serverless function) deploys on Vercel from a single `git push`.

This is the first feature using the `server/` half of the repo. It establishes the patterns (env vars, function structure, local dev workflow) that future server-side features (projects-from-DB, AI chat, analytics) will reuse.

## Non-Goals

- No database. Send-and-forget. Resend's dashboard is the audit trail.
- No admin inbox / message store. Defer until projects-from-DB feature lands and we already have a DB.
- No rate limiting in v1. Honeypot + Turnstile is enough for a portfolio's traffic profile. Add Vercel KV–backed rate limiting later if abuse appears.
- No framework migration (Next.js / Astro). Decision locked: stay on Vite + vanilla JS.
- No tests in this iteration. Verification is manual. A Vitest suite can be added after the form ships.
- No internationalization. English only.

## Locked Decisions (from brainstorming)

| # | Decision | Choice |
|---|---|---|
| 1 | Hosting | Vercel — static Vite build + serverless functions |
| 2 | Domain | User buys one (~$12/yr), points it at the Vercel project |
| 3 | Email provider | Resend (3,000 emails/mo free, simple SDK) |
| 4 | Storage | Send-and-forget, no DB |
| 5 | Spam protection | Honeypot field + Cloudflare Turnstile (invisible) |
| 6 | Frontend UX | Inline form on `#contact` section |

## Architecture

### File layout (after this feature lands)

```
portfolio/
├── api/                                 ← NEW — Vercel serverless functions
│   └── contact.js                       ← POST /api/contact handler
├── client/                              ← unchanged
│   ├── public/
│   ├── src/
│   │   ├── components/Contact.js        ← updated: form replaces email-as-heading
│   │   ├── dom/contactForm.js           ← NEW — submit handler + UX state machine
│   │   └── styles/components/contact.css ← updated for form styling
│   ├── index.html
│   └── package.json
├── docs/
├── .env.local                           ← NEW — dev secrets, gitignored
├── .env.example                         ← NEW — committed template
├── package.json                         ← root, adds dev:full script + serverless deps
├── vercel.json                          ← NEW — build/output config for monorepo
├── AGENTS.md                            ← updated — server/ → api/ convention
└── CLAUDE.md                            ← updated — current scene + currently-building note
```

The empty `server/` placeholder folder is removed. Future serverless functions live in `api/`. If a future feature ever needs a long-running Node service (websocket server, cron worker), we'll re-introduce a different folder then.

### Why `api/` at the repo root

- Vercel auto-detects `api/*.js` at the deployment root and treats each file as a serverless function.
- Keeping `api/` separate from `client/` preserves the conceptual frontend/backend boundary that `AGENTS.md` calls out.
- Functions and frontend deploy together on the same `git push`. No separate CI / deploy targets.

### Why `dom/contactForm.js` (and not `components/`)

- Component files in `components/` return HTML strings only — no behavior. This convention is in `AGENTS.md`.
- Form submission, fetch calls, and UI state transitions are DOM behavior — same category as `dom/sectionObserver.js`.
- Keeps each file focused: markup in `Contact.js`, styling in `contact.css`, behavior in `dom/contactForm.js`.

## Component responsibilities

### `client/src/components/Contact.js`

Returns the section markup. Replaces the current `<h2 class="contact-heading"><a href="mailto:...">` with a form.

```html
<section id="contact" data-spin="contact" class="section section--centered">
  <p class="eyebrow">Contact</p>
  <h2 class="contact-heading">Get in touch</h2>
  <form id="contact-form" class="contact-form" novalidate>
    <input name="name" type="text" placeholder="Your name" required maxlength="100" />
    <input name="email" type="email" placeholder="you@example.com" required maxlength="200" />
    <textarea name="message" placeholder="What's on your mind?" required maxlength="5000" rows="5"></textarea>
    <input name="company" type="text" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true" />
    <div class="cf-turnstile" data-sitekey="${import.meta.env.VITE_TURNSTILE_SITE_KEY}"></div>
    <button type="submit">Send</button>
    <p class="contact-status" role="status" aria-live="polite"></p>
  </form>
</section>
```

The `name="company"` field is the honeypot. It's hidden via CSS (`.hp { display: none }`) and has `tabindex="-1"` so it's never focused by keyboard. Real users never fill it. Bots that auto-fill every field will fill it and get silently dropped.

The Turnstile widget mounts to `<div class="cf-turnstile">` once the Cloudflare script loads. The script tag is added to `index.html`'s `<head>`:

```html
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
```

### `client/src/dom/contactForm.js`

Owns the submission state machine. Exports `initContactForm()` called once from `main.js` after the components are mounted.

States: **idle** → **submitting** → **success** | **error**

Responsibilities:
- Attach `submit` listener to `#contact-form`.
- On submit: prevent default, validate client-side (non-empty fields, basic email format), set state to `submitting` (disable button, set "Sending…").
- Read Turnstile token from the rendered widget (the widget exposes a hidden input named `cf-turnstile-response`).
- POST `JSON.stringify({ name, email, message, company, turnstileToken })` to `/api/contact`.
- On `200 { ok: true }`: set state to `success`, replace form with thank-you message.
- On `400 { ok: false, fieldErrors }`: show field-level errors, return to `idle`.
- On `403`: show "Couldn't verify you're human. Refresh and try again."
- On `500` / network: show "Something broke — email me directly: jkylecadap@gmail.com" with a `mailto:` fallback link.

The fallback `mailto:` is critical — if the form ever breaks, the visitor still has a path to reach you.

### `api/contact.js`

The serverless function. Vercel runs Node 20 by default. Exports a default handler in the standard Vercel form: `export default async function handler(req, res) { ... }`.

Logic order:

1. **Method check** — only `POST`. Anything else → `405`.
2. **Parse body** as JSON. Malformed → `400`.
3. **Validate shape** with Zod schema (note: `company` is permissive on purpose — we don't want bots to learn from a 400 response that the field is a trap):
   ```js
   z.object({
     name: z.string().min(1).max(100),
     email: z.string().email().max(200),
     message: z.string().min(1).max(5000),
     company: z.string().max(200).optional(),     // honeypot — accepted at validation, checked next
     turnstileToken: z.string().min(1),
   })
   ```
   Validation failure → `400 { ok: false, fieldErrors: { ... } }`.
4. **Honeypot** — if `body.company` is a non-empty string, return `200 { ok: true }` without sending. Bots think they succeeded; they don't get a signal that they were caught.
5. **Turnstile verify** — `POST https://challenges.cloudflare.com/turnstile/v0/siteverify` with `secret=TURNSTILE_SECRET_KEY` + `response=turnstileToken`. If `success !== true`, return `403 { ok: false, error: 'Verification failed' }`.
6. **Send email to owner** via Resend:
   ```js
   await resend.emails.send({
     from: SENDER_EMAIL,                       // noreply@yourdomain.com
     to: OWNER_EMAIL,                          // jkylecadap@gmail.com
     replyTo: body.email,                      // so reply goes to the sender, not noreply
     subject: `Portfolio contact from ${body.name}`,
     text: `From: ${body.name} <${body.email}>\n\n${body.message}`,
   });
   ```
7. **Send auto-reply** to sender via Resend:
   ```js
   await resend.emails.send({
     from: SENDER_EMAIL,
     to: body.email,
     subject: 'Thanks for reaching out',
     text: `Hi ${body.name},\n\nI got your message and will get back to you soon.\n\n— John Kyle`,
   });
   ```
   If the auto-reply fails but the owner notification succeeded, log the failure and still return success — the user's message reached you, that's the contract.
8. **Return** `200 { ok: true }`.

Wrap steps 6–7 in `try/catch`. Any thrown error → log via `console.error` (Vercel function logs surface this in the dashboard) → return `500 { ok: false, error: 'Something went wrong.' }`. Never leak internal error details to the client.

Target file size: < 100 lines.

### `vercel.json`

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

Tells Vercel where to find the static build and which directory holds functions. `framework: "vite"` ensures Vite's preset rules apply on top of the explicit overrides. `maxDuration: 10` keeps us on the hobby tier.

## Environment variables

| Key | Public? | Where set | Example |
|---|---|---|---|
| `RESEND_API_KEY` | secret | `.env.local` + Vercel env | `re_dev_...` / `re_live_...` |
| `TURNSTILE_SECRET_KEY` | secret | `.env.local` + Vercel env | Cloudflare prod / test secret |
| `VITE_TURNSTILE_SITE_KEY` | public | `.env.local` + Vercel env (with `VITE_` prefix exposes it to client bundle) | Cloudflare prod / test site key |
| `OWNER_EMAIL` | secret-ish | `.env.local` + Vercel env | `jkylecadap@gmail.com` |
| `SENDER_EMAIL` | secret-ish | `.env.local` + Vercel env | `noreply@yourdomain.com` |

`.env.example` (committed) lists every key with a placeholder. `.env.local` (gitignored) holds the actual values for `vercel dev`. Vercel production reads from project Settings → Environment Variables.

The `VITE_` prefix matters: it's how Vite decides which env vars are baked into the client bundle. Without the prefix, the var is server-only.

For dev, use Cloudflare's documented Turnstile **test keys** — they're public, official, and always behave the same way:

| Site key (frontend) | Behavior |
|---|---|
| `1x00000000000000000000AA` | Always passes (visible widget) |
| `2x00000000000000000000AB` | Always fails |
| `1x00000000000000000000BB` | Always passes (invisible widget) |

| Secret key (server) | Behavior |
|---|---|
| `1x0000000000000000000000000000000AA` | Always passes |
| `2x0000000000000000000000000000000AA` | Always fails |
| `3x0000000000000000000000000000000AA` | Token already spent (i.e., always fails on second use) |

Use the always-pass pair in `.env.local` for normal dev, swap to always-fail to test the 403 error path.

## Domain + DNS setup (one-time, ~30 min)

Order matters because each step depends on the prior:

1. **Buy domain** at Cloudflare Registrar (at-cost, Cloudflare DNS included) or Namecheap.
2. **Add to Vercel** — Project Settings → Domains → enter the domain. Vercel shows DNS records (A / AAAA / CNAME) to add at the registrar. If using Cloudflare DNS, set proxy status to DNS-only for the records Vercel needs.
3. **Add to Resend** — Resend Dashboard → Domains → Add. Generates 2 mandatory records (SPF `TXT @`, DKIM `TXT resend._domainkey`) and 1 optional (MX, only needed for receiving). Copy each into Cloudflare DNS.
4. **Wait for verification** — usually < 5 min. Resend marks domain "Verified" when SPF + DKIM check out.
5. **Add Turnstile site** — Cloudflare Dashboard → Turnstile → Add site. Choose "Invisible" widget mode. Copy Site Key (public, frontend env) and Secret Key (private, server env).
6. **Set `SENDER_EMAIL`** = `noreply@yourdomain.com` in `.env.local` and Vercel.

Until step 4 completes, Resend will refuse to send "from" your domain. We can use Resend's onboarding sender (e.g., `onboarding@resend.dev`) for early local dev to unblock testing.

## Local dev workflow

Two scripts in root `package.json`:

```json
{
  "scripts": {
    "dev": "npm --prefix client run dev",
    "dev:full": "vercel dev",
    "build": "npm --prefix client run build",
    "preview": "npm --prefix client run preview"
  }
}
```

| Command | What runs | When to use |
|---|---|---|
| `npm run dev` | Vite at `localhost:5173` | Three.js / CSS / component changes only. Form posts will fail — that's fine. |
| `npm run dev:full` | `vercel dev` — Vite + serverless functions on the same port | Working on the form / function. Mirrors production exactly. |

`vercel dev` requires `npm i -g vercel` once. The CLI auto-detects `vercel.json`, runs Vite as the dev server, and proxies `/api/*` to local serverless function instances. It auto-loads `.env.local`.

## Error handling and UX states

The form's status region (`<p class="contact-status" aria-live="polite">`) communicates state to all users including screen readers.

| State | UI | Status text | Trigger |
|---|---|---|---|
| idle | Form visible, button "Send", enabled | "" | Default |
| submitting | Button disabled, label "Sending…" | "Sending…" | Submit fired, fetch in flight |
| success | Form replaced with thank-you message | "Message sent. I'll get back to you soon." | `200 { ok: true }` |
| error: validation | Inline errors under fields, button re-enabled | "Please fix the highlighted fields." | `400` with `fieldErrors` |
| error: turnstile | Form re-enabled | "Couldn't verify you're human. Refresh and try again." | `403` |
| error: server | Form re-enabled, fallback `mailto:` link visible | "Something broke. Email me directly: jkylecadap@gmail.com" | `500` or network failure |

The fallback `mailto:` is rendered as a regular link inside the status text — it's the safety net if the API ever fails.

## Spam protection — implementation details

### Honeypot

- Hidden input: `<input name="company" type="text" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true" />`.
- CSS: `.hp { display: none !important; }`.
- Server: if `body.company` is non-empty, return `200 { ok: true }` and exit. Don't send email. Don't return an error — bots inspect responses and learn to avoid the trap if they see one.

### Turnstile

- Frontend script tag (in `index.html` `<head>`):
  ```html
  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
  ```
- Widget div in the form: `<div class="cf-turnstile" data-sitekey="<KEY>"></div>`. Cloudflare's script auto-renders into all `.cf-turnstile` divs.
- The site key value comes from `import.meta.env.VITE_TURNSTILE_SITE_KEY` — `Contact.js` accepts the key as a closure variable (or `Contact.js` reads `import.meta.env` directly since it runs in client bundle context).
- On submit, JS reads `formData.get('cf-turnstile-response')` (Turnstile injects this hidden input automatically) and sends as `turnstileToken`.
- Server verifies via `POST https://challenges.cloudflare.com/turnstile/v0/siteverify` with form-encoded body `secret=<SECRET>&response=<token>`. Response JSON has `success: boolean`.

### Why both?

Honeypot catches naïve bots that don't render JavaScript (very high volume, very low cost to defeat). Turnstile catches sophisticated bots that *do* execute JavaScript. Both together: ~99.9% of attempted spam bounces.

## Future-proofing

The patterns this feature establishes are reused by every later server-side feature:

- **Folder structure:** new endpoints go in `api/<name>.js`. Single file = single endpoint. No router boilerplate.
- **Env vars:** every secret in Vercel project settings; documented in `.env.example`.
- **Validation:** Zod schemas at the top of each handler. Same pattern across the codebase.
- **Error contract:** every endpoint returns `{ ok: boolean, ...payload }`. Never leak internal errors. Always log to `console.error`.
- **Frontend pattern:** `dom/<feature>Form.js` or `dom/load<Resource>.js` modules call `fetch('/api/<endpoint>')`. Same shape every time.

Specifically for the dynamic-projects feature mentioned in the user's goals:

- `api/projects.js` (GET) returns project list from a future DB, same handler shape.
- `client/src/dom/loadProjects.js` calls it on page load and renders into `components/Work.js`'s container.
- Two paths: rebuild-on-push (data lives in repo, projects update on commit) or DB-backed (admin dashboard updates DB, site reads on request). Decision deferred. The contact form sets up the *infrastructure* for either path.

## AGENTS.md updates required

The "Where does X go?" table in `AGENTS.md` currently says backend goes to `server/`. After this feature:

- "Backend code (API endpoints)" → `api/<name>.js` (one file = one HTTP endpoint = serverless function).
- Add to "Conventions per folder": `api/` section describing the handler shape, env var pattern, error contract.
- Update "What NOT to do": don't put long-running processes in `api/` (each function invocation is short-lived). If we ever need persistent state, that's a different folder and a different platform decision.
- Update local dev workflow: `npm run dev` (frontend only) vs `npm run dev:full` (with serverless).

## CLAUDE.md updates required

- "Currently building" → "Currently building: contact form (in progress)" with a pointer to this spec.
- Once complete: update "Currently building" to the next feature, move contact-form to a "Recently shipped" section.

## Verification (no automated tests yet)

Manual smoke test sequence after each implementation step:

1. **Function unit smoke** — `vercel dev` running, `curl -X POST localhost:3000/api/contact -H 'content-type: application/json' -d '{"name":"Test","email":"test@example.com","message":"hi","turnstileToken":"<test-token>"}'` → see expected response.
2. **Local integration** — open `localhost:3000`, fill form, hit Send. Email arrives at `jkylecadap@gmail.com`. Auto-reply arrives at the test sender address.
3. **Validation paths** — empty fields / invalid email / 6,000-char message → see appropriate error states.
4. **Honeypot** — temporarily un-hide the field, fill it, submit → server returns 200 but no email arrives in the inbox.
5. **Turnstile failure** — pass a bogus token (or use Cloudflare's "always-fail" test key) → server returns 403, frontend shows the right error.
6. **Production smoke** — after first deploy: same end-to-end test against `https://yourdomain.com` → emails actually arrive in your real inbox.

## Implementation order (informs the plan)

Build order is shaped by dependency:

1. Vercel + repo setup: `vercel.json`, root scripts, `.env.example`, delete `server/`. Validate with `npm run build`.
2. Create `api/contact.js` skeleton (returns hardcoded `{ ok: true }`). Validate with `vercel dev` + `curl`.
3. Add Zod validation to handler. Validate via `curl` with bad/good payloads.
4. Wire Resend integration (owner email only first). Validate with `curl` + check inbox.
5. Add auto-reply email. Validate with `curl` + check both inboxes.
6. Add Turnstile server-side verify. Validate with Cloudflare test keys (always-pass + always-fail).
7. Update `Contact.js` markup with form fields, honeypot, Turnstile div. Add Turnstile script to `index.html`.
8. Implement `dom/contactForm.js` state machine. Wire from `main.js`. Visual smoke test in browser.
9. Update CSS in `styles/components/contact.css` for the new form.
10. Update `AGENTS.md` and `CLAUDE.md` with new conventions and "currently building" status.
11. (User-driven) Buy domain. Add to Vercel + Resend + Cloudflare Turnstile. Set production env vars. Deploy. Production smoke test.

Steps 1–10 can happen against Resend's onboarding sender (no domain). Step 11 unblocks "from your own domain" in production. The frontend shouldn't need code changes between dev and prod — env vars handle the swap.

## Risks / Trade-offs

- **Domain delay blocks production go-live.** DNS propagation is typically minutes but can be 24h. Build with onboarding sender so dev work isn't blocked. Switch sender via env var only.
- **Turnstile widget script latency.** If Cloudflare's CDN is slow, Send button briefly errors before the widget loads. Mitigation: button stays disabled until widget reports ready (token available). Acceptable trade-off.
- **No rate limiting in v1.** A determined attacker could submit thousands of valid Turnstile-passing forms. Resend's free tier is 3,000/mo, so ~1 hr of attack exhausts the quota and you stop receiving anything. If this happens once, immediately add Vercel KV rate limiting. We can also add a Resend hard-cap per day in their dashboard.
- **No tests.** Refactors of the form will require manual re-verification. Acceptable for v1; add Vitest after the form proves itself.
- **Removing `server/` breaks the convention from the 2026-04-27 restructure.** Net positive — Vercel-idiomatic `api/` is what the site actually uses. Documented in `AGENTS.md` update.

## Reference

- Brainstorming dialogue: this conversation (2026-04-29).
- Earlier specs:
  - `docs/superpowers/specs/2026-04-27-portfolio-restructure-design.md`
  - `docs/superpowers/specs/2026-04-28-scene-redesign-design.md`
- External:
  - Resend docs: https://resend.com/docs
  - Cloudflare Turnstile docs: https://developers.cloudflare.com/turnstile/
  - Vercel serverless functions: https://vercel.com/docs/functions
