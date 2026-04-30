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
