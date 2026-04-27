import * as THREE from 'three';
import { scene, camera, renderer } from './scene.js';
import { getCurrentSectionName, restingSpin, updateTransition } from './transitions.js';

const clock = new THREE.Clock();

export function startRenderLoop({ planetsBySection, stars }) {
  function animate() {
    const dt = Math.min(clock.getDelta(), 0.05);

    const activePlanet = planetsBySection[getCurrentSectionName()];
    if (activePlanet) {
      activePlanet.rotation.x += restingSpin.x * dt;
      activePlanet.rotation.y += restingSpin.y * dt;
      activePlanet.rotation.z += restingSpin.z * dt;
    }

    updateTransition(dt);

    stars.rotation.y += dt * 0.02;

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();
}
