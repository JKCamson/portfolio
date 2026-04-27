import * as THREE from 'three';

const canvas = document.querySelector('#bg');

export const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0a0a0f, 12, 28);

export const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 0, 6);

export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

// Lights — neutral key + soft fill
scene.add(new THREE.AmbientLight(0xffffff, 0.45));
const sunLight = new THREE.DirectionalLight(0xffffff, 1.6);
sunLight.position.set(5, 3, 4);
scene.add(sunLight);
const fillLight = new THREE.PointLight(0x7c8cff, 18, 30);
fillLight.position.set(-5, -2, 3);
scene.add(fillLight);

export function attachResizeHandler() {
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}
