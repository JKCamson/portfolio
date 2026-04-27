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
