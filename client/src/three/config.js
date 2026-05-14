import * as THREE from 'three';

export const SECTIONS = {
  hero: {
    radius: 1.7, color: 0x4166f5, emissive: 0x081330, emissiveIntensity: 0.25,
    roughness: 0.85, metalness: 0.05,
    offset: { x: -65 / 14, y: 12 / 14 },
    z: 180 / 14,
    rotSpeed: 0.005,
    haloColor: 0x4a7cff,
    haloOpacity: 0.45,
    texturePath: '/assets/planets/neptune.jpg',
  },
  about: {
    radius: 1.5, color: 0x3a7bd5, emissive: 0x07254a, emissiveIntensity: 0.25,
    roughness: 0.85, metalness: 0.05,
    offset: { x: 78 / 14, y: -22 / 14 },
    z: 60 / 14,
    rotSpeed: 0.003,
    haloColor: 0x4ddc92,
    haloOpacity: 0.45,
    texturePath: '/assets/planets/earth.jpg',
  },
  skills: {
    radius: 1.4, color: 0xc1440e, emissive: 0x3a0a06, emissiveIntensity: 0.25,
    roughness: 0.85, metalness: 0.05,
    offset: { x: -95 / 14, y: 28 / 14 },
    z: -90 / 14,
    rotSpeed: 0.004,
    haloColor: 0xff5a3d,
    haloOpacity: 0.45,
    texturePath: '/assets/planets/mars.jpg',
  },
  work: {
    radius: 1.85, color: 0xd1a36b, emissive: 0x3a2a10, emissiveIntensity: 0.25,
    roughness: 0.85, metalness: 0.05,
    offset: { x: 62 / 14, y: 24 / 14 },
    z: -230 / 14,
    rotSpeed: 0.006,
    haloColor: 0xe2b76c,
    haloOpacity: 0.45,
    texturePath: '/assets/planets/jupiter.jpg',
  },
  contact: {
    radius: 1.5, color: 0xe8d4a3, emissive: 0x3a2a10, emissiveIntensity: 0.25,
    roughness: 0.85, metalness: 0.05,
    offset: { x: -55 / 14, y: -32 / 14 },
    z: -370 / 14,
    rotSpeed: 0.007,
    haloColor: 0xe2b76c,
    haloOpacity: 0.45,
    ring: {
      inner: 1.9, outer: 2.8, color: 0xc9b48a, opacity: 0.75, tilt: 0.45,
      texturePath: '/assets/planets/saturn_ring.png',
    },
    texturePath: '/assets/planets/saturn.jpg',
  },
};

export const SECTION_ORDER = ['hero', 'about', 'skills', 'work', 'contact'];

// Camera sweep
export const CAMERA_START_Z = 350 / 14;
export const CAMERA_END_Z = -540 / 14;

// Sun — far + upper-right offset so the contact section isn't blown out
export const SUN_POSITION = new THREE.Vector3(420 / 14, 260 / 14, -1600 / 14);
export const SUN_RADIUS = 170 / 14;
export const SUN_GLOW_SCALE = 1300 / 14;
export const SUN_CORONA_SCALE = 2200 / 14;
export const SUN_TEXTURE_PATH = '/assets/planets/sun.jpg';

// Skybox (Milky Way backdrop behind the procedural starfield)
export const MILKYWAY_TEXTURE_PATH = '/assets/planets/stars_milkyway.jpg';
export const SKYBOX_RADIUS = 200;
export const SKYBOX_OPACITY = 0.45;
