import * as THREE from 'three';
import {
  SECTIONS,
  SECTION_ORDER,
  PLANET_SPACING_Z,
  FAST_SCROLL_WINDOW_MS,
  FAST_SCROLL_SPEEDUP,
  ZOOM_OUT_DURATION,
  JUMP_OUT_DURATION,
  PAN_OUT_DURATION,
  PAN_IN_DURATION,
} from './config.js';

let planetsRail = null;
let currentSectionName = 'hero';

export const restingSpin = new THREE.Vector3(0, 0.3, 0);

let transitionState = 'idle'; // 'idle' | 'out' | 'in'
let transitionT = 0;
let pendingSection = null;
let lastSectionRequestAt = 0;
let isFastScroll = false;
const sectionQueue = [];

const outFrom = new THREE.Vector3();
const outTo = new THREE.Vector3();
let outDuration = PAN_OUT_DURATION;

export function setPlanetsRail(rail) {
  planetsRail = rail;
}

export function getCurrentSectionName() {
  return currentSectionName;
}

function configureTransition(fromName, toName) {
  pendingSection = toName;

  const fromIdx = SECTION_ORDER.indexOf(fromName);
  const toIdx = SECTION_ORDER.indexOf(toName);
  const goingBack = toIdx < fromIdx;
  const speed = isFastScroll ? FAST_SCROLL_SPEEDUP : 1;

  const toZ = toIdx * PLANET_SPACING_Z;
  const fromZ = planetsRail.position.z;

  outFrom.set(0, 0, fromZ);
  outTo.set(0, 0, toZ);
  outDuration = (goingBack ? ZOOM_OUT_DURATION : JUMP_OUT_DURATION) * speed;
}

function startNextTransition() {
  if (transitionState !== 'idle') return;
  if (sectionQueue.length === 0) return;

  const next = sectionQueue.shift();
  configureTransition(currentSectionName, next);
  transitionState = 'out';
  transitionT = 0;
}

export function setSection(name) {
  const cfg = SECTIONS[name];
  if (!cfg) return;
  if (name === currentSectionName && transitionState === 'idle' && sectionQueue.length === 0) return;

  const now = performance.now();
  isFastScroll = (now - lastSectionRequestAt) < FAST_SCROLL_WINDOW_MS;
  lastSectionRequestAt = now;

  const currentTarget =
    (sectionQueue.length > 0)
      ? sectionQueue[sectionQueue.length - 1]
      : (pendingSection ?? currentSectionName);

  const fromIdx = SECTION_ORDER.indexOf(currentTarget);
  const toIdx = SECTION_ORDER.indexOf(name);
  if (fromIdx === -1 || toIdx === -1) return;
  if (fromIdx === toIdx) return;

  const step = toIdx > fromIdx ? 1 : -1;
  for (let i = fromIdx + step; step > 0 ? i <= toIdx : i >= toIdx; i += step) {
    const s = SECTION_ORDER[i];
    if (s && s !== pendingSection) sectionQueue.push(s);
  }

  startNextTransition();
}

export function updateTransition(dt) {
  if (transitionState !== 'out') return;
  transitionT += dt;
  const p = Math.min(transitionT / outDuration, 1);
  const eased = p * p; // ease-in
  planetsRail.position.lerpVectors(outFrom, outTo, eased);
  if (p >= 1) {
    currentSectionName = pendingSection;
    pendingSection = null;
    const cfg = SECTIONS[currentSectionName];
    restingSpin.set(cfg.spin[0], cfg.spin[1], cfg.spin[2]);
    planetsRail.position.copy(outTo);
    transitionState = 'idle';
    startNextTransition();
  }
}
