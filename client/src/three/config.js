import * as THREE from 'three';

export const SECTIONS = {
  hero: {
    // Neptune (unchanged — already outermost)
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
    // Saturn (was Earth) — ring moved here
    radius: 1.5, color: 0xe8d4a3, emissive: 0x3a2a10, emissiveIntensity: 0.25,
    roughness: 0.85, metalness: 0.05,
    offset: { x: 78 / 14, y: -22 / 14 },
    z: 60 / 14,
    rotSpeed: 0.007,
    haloColor: 0xe2b76c,
    haloOpacity: 0.45,
    ring: {
      inner: 1.9, outer: 2.8, color: 0xc9b48a, opacity: 0.75, tilt: 0.45,
      texturePath: '/assets/planets/saturn_ring.png',
    },
    texturePath: '/assets/planets/saturn.jpg',
  },
  skills: {
    // Jupiter (was Mars)
    radius: 1.85, color: 0xd1a36b, emissive: 0x3a2a10, emissiveIntensity: 0.25,
    roughness: 0.85, metalness: 0.05,
    offset: { x: -95 / 14, y: 28 / 14 },
    z: -90 / 14,
    rotSpeed: 0.006,
    haloColor: 0xe2b76c,
    haloOpacity: 0.45,
    texturePath: '/assets/planets/jupiter.jpg',
  },
  work: {
    // Mars (was Jupiter)
    radius: 1.4, color: 0xc1440e, emissive: 0x3a0a06, emissiveIntensity: 0.25,
    roughness: 0.85, metalness: 0.05,
    offset: { x: 62 / 14, y: 24 / 14 },
    z: -230 / 14,
    rotSpeed: 0.004,
    haloColor: 0xff5a3d,
    haloOpacity: 0.45,
    texturePath: '/assets/planets/mars.jpg',
  },
  contact: {
    // Earth (was Saturn) — no ring anymore
    radius: 1.5, color: 0x3a7bd5, emissive: 0x07254a, emissiveIntensity: 0.25,
    roughness: 0.85, metalness: 0.05,
    offset: { x: -55 / 14, y: -32 / 14 },
    z: -370 / 14,
    rotSpeed: 0.003,
    haloColor: 0x4ddc92,
    haloOpacity: 0.45,
    texturePath: '/assets/planets/earth.jpg',
  },
};

export const SECTION_ORDER = ['hero', 'about', 'skills', 'work', 'contact'];

// Camera Bezier control points. Quadratic curve: P(t) = (1-t)²P0 + 2(1-t)tP1 + t²P2.
// Swings left + up at midpoint, returns toward center near the sun zone.
export const CAMERA_BEZIER_P0 = new THREE.Vector3(0, 0, 25);
export const CAMERA_BEZIER_P1 = new THREE.Vector3(-21, 6, -17);
export const CAMERA_BEZIER_P2 = new THREE.Vector3(0, 0, -58.6);

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

// Background planets — not tied to any section. Rotate and drift through
// peripheral view. Textures load from /assets/planets/; a procedural
// fallback for Mercury lives in textures.js if its .jpg is ever missing.
export const BACKGROUND_PLANETS = [
  {
    // Uranus — between Neptune (hero, z=12.86) and Saturn (about, z=4.29)
    key: 'uranus',
    radius: 1.2,
    color: 0x9fd8e8, emissive: 0x1a4858, emissiveIntensity: 0.25,
    roughness: 0.85, metalness: 0.05,
    offset: { x: -3, y: 1 },
    z: 8.5,
    rotSpeed: 0.004,
    haloColor: 0x9fd8e8,
    haloOpacity: 0.4,
    texturePath: '/assets/planets/uranus.jpg',
    procedural: false,
  },
  {
    // Venus — between Earth (contact, z=-26.43) and the sun. Filename has the
    // existing typo "athmosphere" preserved.
    key: 'venus',
    radius: 1.0,
    color: 0xd8b67a, emissive: 0x3a2a10, emissiveIntensity: 0.25,
    roughness: 0.85, metalness: 0.05,
    offset: { x: 2, y: -1 },
    z: -32,
    rotSpeed: 0.005,
    haloColor: 0xd8b67a,
    haloOpacity: 0.4,
    texturePath: '/assets/planets/venus_athmosphere.jpg',
    procedural: false,
  },
  {
    // Mercury — closest to the sun.
    key: 'mercury',
    radius: 0.7,
    color: 0x8a8580, emissive: 0x2a2520, emissiveIntensity: 0.2,
    roughness: 0.95, metalness: 0.02,
    offset: { x: -1.5, y: 1.5 },
    z: -38,
    rotSpeed: 0.006,
    haloColor: 0x999999,
    haloOpacity: 0.3,
    texturePath: '/assets/planets/mercury.jpg',
    procedural: false,
  },
];
