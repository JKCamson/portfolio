import { CAMERA_START_Z, CAMERA_END_Z, SUN_GLOW_SCALE, SUN_CORONA_SCALE } from './config.js';
import { getSmoothedScroll } from './scroll.js';

export function startRenderLoop({ scene, camera, renderer, planets, sun, stars, dust }) {
  function animate() {
    const t = getSmoothedScroll();
    camera.position.z = CAMERA_START_Z + (CAMERA_END_Z - CAMERA_START_Z) * t;

    const time = Date.now() * 0.0001;
    camera.position.x = Math.sin(time) * 0.4;
    camera.position.y = Math.cos(time * 0.7) * 0.3;
    camera.lookAt(0, 0, sun.group.position.z);

    planets.forEach((p) => { p.mesh.rotation.y += p.rotSpeed; });

    const pulse = 1 + Math.sin(Date.now() * 0.0011) * 0.04;
    sun.glow.scale.set(SUN_GLOW_SCALE * pulse, SUN_GLOW_SCALE * pulse, 1);
    sun.corona.scale.set(SUN_CORONA_SCALE * pulse, SUN_CORONA_SCALE * pulse, 1);
    sun.glowMat.opacity = 0.55 + Math.max(0, Math.min(1, t)) * 0.15;

    stars.rotation.y += 0.00008;
    dust.rotation.y -= 0.00004;

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();
}
