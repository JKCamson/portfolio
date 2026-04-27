# Server

Backend for the portfolio site. **Empty for now** — no backend code has
been added yet. This folder exists so the boundary between frontend and
backend is obvious from the repo root.

Reserved for things like:
- Contact form handler (e.g. accepting POST from `client/src/components/Contact.js`).
- Projects / blog API (CMS-driven content).
- Auth endpoints if any admin tooling is added.

When work begins:

1. Add a `server/package.json` with the chosen runtime (Node + Express,
   Fastify, etc.).
2. Add `server/src/` with the entry file (e.g. `index.js`).
3. Update root `package.json` to add scripts that delegate into
   `server/`, e.g. `"dev:server": "npm --prefix server run dev"` and a
   combined `"dev:all"` that runs both client and server in parallel.
