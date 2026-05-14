import * as THREE from 'three';

export const textures = {}; // { sectionName: { sphere?, ring? } }

export function ensureEntry(name) {
  if (!textures[name]) textures[name] = {};
  return textures[name];
}

const textureLoader = new THREE.TextureLoader();

export function loadTexture(path, onSuccess) {
  textureLoader.load(
    path,
    (tex) => { tex.colorSpace = THREE.SRGBColorSpace; onSuccess(tex); },
    undefined,
    () => { /* missing — keep solid color */ }
  );
}

let cachedMercuryTexture = null;

export function getMercuryTexture() {
  if (cachedMercuryTexture) return cachedMercuryTexture;

  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d');

  // Base grey
  ctx.fillStyle = '#8a8580';
  ctx.fillRect(0, 0, 512, 256);

  // Crater-like darker blobs
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 256;
    const r = 6 + Math.random() * 30;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, '#5a5550');
    grad.addColorStop(1, 'transparent');
    ctx.globalAlpha = 0.2 + Math.random() * 0.4;
    ctx.beginPath();
    ctx.fillStyle = grad;
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  cachedMercuryTexture = tex;
  return tex;
}
