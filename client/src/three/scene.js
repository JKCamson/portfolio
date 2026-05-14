import * as THREE from 'three';
import { CAMERA_BEZIER_P0, SUN_POSITION } from './config.js';

const canvas = document.querySelector('#bg');

export const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x05020a, 0.0008);

export const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  5000
);
camera.position.copy(CAMERA_BEZIER_P0);

export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x02030a, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;

scene.add(new THREE.AmbientLight(0x222244, 0.55));
const sunLight = new THREE.PointLight(0xffd599, 4.5, 3000, 1.4);
sunLight.position.copy(SUN_POSITION);
scene.add(sunLight);

export function attachResizeHandler() {
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}
