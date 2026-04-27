# Pages

Placeholder for future multi-page setup. Vite multi-page apps put HTML
files at the project root (`client/`); each HTML file gets its own JS
entry.

When adding a second page (e.g. blog, projects):

1. Create `client/<page>.html` with its own mount points.
2. Create a per-page entry like `client/src/pages/blog.js` that imports
   the components and styles it needs.
3. Reference the entry from the HTML file with
   `<script type="module" src="/src/pages/blog.js"></script>`.
4. Update `vite.config.js` `build.rollupOptions.input` if you want the
   build to produce both pages.
