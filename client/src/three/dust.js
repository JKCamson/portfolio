import * as THREE from 'three';

export function createDust(count = 600) {
  const geom = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 21 + Math.random() * 57;            // /14 of test.tsx 300..1100
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi) - 14;  // /14 of test.tsx -200
    const warm = Math.random();
    colors[i * 3 + 0] = 0.6 + warm * 0.4;
    colors[i * 3 + 1] = 0.3 + warm * 0.3;
    colors[i * 3 + 2] = 0.5 + (1 - warm) * 0.3;
  }
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 1.0,                                     // /14 of test.tsx 14
    vertexColors: true,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.07,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Points(geom, mat);
}
