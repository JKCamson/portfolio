import * as THREE from 'three';
import { SECTIONS } from './config.js';
import { textures } from './textures.js';

function remapRingUVs(geom, inner, outer) {
  const pos = geom.attributes.position;
  const uv = geom.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const r = Math.sqrt(x * x + y * y);
    uv.setXY(i, (r - inner) / (outer - inner), 1);
  }
  uv.needsUpdate = true;
}

function addRingTo(group, ringCfg, ringTex) {
  const geom = new THREE.RingGeometry(ringCfg.inner, ringCfg.outer, 128);
  // Always remap UVs: ring textures load async, so the mesh is often created before the map exists.
  remapRingUVs(geom, ringCfg.inner, ringCfg.outer);
  const mat = new THREE.MeshBasicMaterial({
    map: ringTex || null,
    color: ringTex ? 0xffffff : ringCfg.color,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: ringTex ? 1 : ringCfg.opacity,
    alphaTest: ringTex ? 0.05 : 0,
  });
  const ring = new THREE.Mesh(geom, mat);
  ring.rotation.x = Math.PI * ringCfg.tilt;
  ring.userData.ringMat = mat;
  group.add(ring);
}

export function buildPlanet(name) {
  const cfg = SECTIONS[name];
  const tex = textures[name] || {};
  const group = new THREE.Group();

  group.name = `planet:${name}`;

  const sphereMat = new THREE.MeshStandardMaterial({
    map: tex.sphere || null,
    color: tex.sphere ? 0xffffff : cfg.color,
    emissive: cfg.emissive,
    emissiveIntensity: cfg.emissiveIntensity,
    roughness: cfg.roughness,
    metalness: cfg.metalness,
  });
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(cfg.radius, 64, 64),
    sphereMat
  );
  sphere.userData.sphereMat = sphereMat;
  group.add(sphere);

  if (cfg.ring) addRingTo(group, cfg.ring, tex.ring);

  return group;
}

export function applySphereTextureToPlanet(planet, cfg, tex) {
  planet.traverse((obj) => {
    const mat = obj?.userData?.sphereMat;
    if (mat) {
      mat.map = tex || null;
      mat.color.set(tex ? 0xffffff : cfg.color);
      mat.needsUpdate = true;
    }
  });
}

export function applyRingTextureToPlanet(planet, ringCfg, tex) {
  planet.traverse((obj) => {
    const mat = obj?.userData?.ringMat;
    if (mat) {
      mat.map = tex || null;
      mat.color.set(tex ? 0xffffff : ringCfg.color);
      mat.opacity = tex ? 1 : ringCfg.opacity;
      mat.alphaTest = tex ? 0.05 : 0;
      mat.needsUpdate = true;
    }
  });
}
