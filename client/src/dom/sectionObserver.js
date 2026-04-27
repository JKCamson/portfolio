import { setSection } from '../three/transitions.js';

export function initSectionObserver() {
  const sections = document.querySelectorAll('section[data-spin]');
  const dots = document.querySelectorAll('.dots a');

  sections.forEach((s, i) => { if (i > 0) s.classList.add('pending'); });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.remove('pending');
        const name = entry.target.dataset.spin;
        setSection(name);
        dots.forEach((d) => d.classList.toggle('active', d.dataset.target === name));
      }
    });
  }, { threshold: 0.4 });

  sections.forEach((s) => observer.observe(s));
}
