import * as THREE from 'three';

export function createSkybox({ radius = 200, opacity = 0.5 } = {}) {
  const geom = new THREE.SphereGeometry(radius, 64, 32);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.BackSide,
    transparent: true,
    opacity,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.renderOrder = -1;
  mesh.userData.skyboxMat = mat;
  return mesh;
}

export function applySkyboxTexture(skybox, tex) {
  const mat = skybox?.userData?.skyboxMat;
  if (!mat) return;
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.x = -1; // un-mirror the equirectangular wrap on BackSide
  mat.map = tex;
  mat.needsUpdate = true;
}
