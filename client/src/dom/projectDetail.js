export async function initProjectDetail(mountNode, slug) {
  if (!mountNode) return;
  mountNode.innerHTML = `<p class="project-detail__state">Loading… (${slug || 'no slug'})</p>`;
}
