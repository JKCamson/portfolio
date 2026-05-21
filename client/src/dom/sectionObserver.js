export function initSectionObserver() {
  const sections = document.querySelectorAll('section[data-spin]');
  const dots = document.querySelectorAll('.dots a');

  sections.forEach((s, i) => { if (i > 0) s.classList.add('pending'); });

  // Reveal a section as soon as any part enters the viewport. A fractional
  // threshold can't be reached by sections taller than ~2.5x the viewport
  // (e.g. the skills grid), which would leave them stuck at opacity 0.
  const reveal = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.remove('pending');
        reveal.unobserve(entry.target);
      }
    });
  }, { threshold: 0 });

  // Mark the active dot by whichever section sits in the viewport's center
  // band — height-independent, so tall sections highlight correctly too.
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const name = entry.target.dataset.spin;
        dots.forEach((d) => d.classList.toggle('active', d.dataset.target === name));
      }
    });
  }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });

  sections.forEach((s) => { reveal.observe(s); spy.observe(s); });
}
