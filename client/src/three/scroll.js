let smoothScroll = 0;

export function getSmoothedScroll() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const target = max > 0 ? window.scrollY / max : 0;
  smoothScroll += (target - smoothScroll) * 0.07;
  return smoothScroll;
}
