import * as THREE from 'three';

// Per-section: planet config + texture path. Solid color shows briefly until the
// texture loads, then the sphere upgrades in place.
export const SECTIONS = {
  hero: {
    radius: 1.7, color: 0x4166f5, emissive: 0x081330, emissiveIntensity: 0.1,
    roughness: 0.7, metalness: 0.05, spin: [0, 0.3, 0],
    texturePath: '/assets/planets/neptune.jpg',
  },
  about: {
    radius: 1.5, color: 0x3a7bd5, emissive: 0x07254a, emissiveIntensity: 0.15,
    roughness: 0.55, metalness: 0.05, spin: [0, 0.5, 0],
    texturePath: '/assets/planets/earth.jpg',
  },
  skills: {
    radius: 1.4, color: 0xc1440e, emissive: 0x000000, emissiveIntensity: 0,
    roughness: 0.9, metalness: 0.0, spin: [0, 0.45, 0],
    texturePath: '/assets/planets/mars.jpg',
  },
  work: {
    radius: 1.85, color: 0xd1a36b, emissive: 0x000000, emissiveIntensity: 0,
    roughness: 0.7, metalness: 0.0, spin: [0, 0.3, 0],
    texturePath: '/assets/planets/jupiter.jpg',
  },
  contact: {
    radius: 1.5, color: 0xe8d4a3, emissive: 0x000000, emissiveIntensity: 0,
    roughness: 0.7, metalness: 0.0, spin: [0, 0.35, 0],
    ring: {
      inner: 1.9, outer: 2.8, color: 0xc9b48a, opacity: 0.75, tilt: 0.45,
      texturePath: '/assets/planets/saturn_ring.png',
    },
    texturePath: '/assets/planets/saturn.jpg',
  },
};

export const SECTION_ORDER = ['hero', 'about', 'skills', 'work', 'contact'];

// Rail layout
export const PLANET_SPACING_Z = 18;
export const AXIAL_TILT_RAD = THREE.MathUtils.degToRad(23.5);

// Transition timing
export const PAN_OUT_DURATION = 0.5;
export const PAN_IN_DURATION = 0.6;
export const ZOOM_OUT_DURATION = 0.35;
export const ZOOM_IN_DURATION = 0.35;
export const JUMP_THROUGH_Z = 2;
export const JUMP_IN_FROM_Z = -12;
export const JUMP_OUT_DURATION = 0.22;
export const JUMP_IN_DURATION = 0.4;
export const FAST_SCROLL_WINDOW_MS = 250;
export const FAST_SCROLL_SPEEDUP = 0.65;
export const ZOOM_AWAY_Z = -25;
