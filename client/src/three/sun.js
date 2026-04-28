import * as THREE from 'three';

export function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,228,170,1)');
  g.addColorStop(0.18, 'rgba(255,180,80,0.65)');
  g.addColorStop(0.45, 'rgba(255,110,40,0.22)');
  g.addColorStop(1, 'rgba(255,80,20,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

const sharedGlowTexture = makeGlowTexture();

export function getSharedGlowTexture() {
  return sharedGlowTexture;
}

export function createSun({ position, radius, glowScale, coronaScale }) {
  const group = new THREE.Group();
  group.position.copy(position);

  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 64, 64),
    new THREE.MeshBasicMaterial({ color: 0xffd07a })
  );
  group.add(sphere);

  const glowMat = new THREE.SpriteMaterial({
    map: sharedGlowTexture,
    color: 0xffcb6b,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const glow = new THREE.Sprite(glowMat);
  glow.scale.set(glowScale, glowScale, 1);
  group.add(glow);

  const coronaMat = new THREE.SpriteMaterial({
    map: sharedGlowTexture,
    color: 0xff8a2a,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.5,
  });
  const corona = new THREE.Sprite(coronaMat);
  corona.scale.set(coronaScale, coronaScale, 1);
  group.add(corona);

  return { group, glow, corona, glowMat };
}
