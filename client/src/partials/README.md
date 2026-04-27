# Partials

Small reusable HTML atoms — buttons, cards, badges, icons. Each file
exports a function that takes props and returns an HTML string.

Use these inside `components/` (full sections) or any future page.

Example:

```js
// Button.js
export const Button = ({ href = '#', label, variant = 'primary' }) => `
  <a class="btn btn--${variant}" href="${href}">${label}</a>
`;
```

Style each partial in `client/src/styles/partials/<name>.css` and add an
`@import` line in `client/src/styles/main.css`.
