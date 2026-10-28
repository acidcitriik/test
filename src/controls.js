import { clamp } from './physics.js';

// The camera faces +Z from the player's near side. In this perspective,
// screen-right is world -X, so horizontal mouse movement must be inverted.
// The vertical mapping was already correct: mouse-up moves toward +Z.
export function moveTargetWithMouse(target, deltaX, deltaY, sensitivity, cfg) {
  const step = 0.005 * sensitivity;
  return {
    x: clamp(target.x - deltaX * step, -cfg.width / 2 + .48, cfg.width / 2 - .48),
    z: clamp(target.z - deltaY * step, -cfg.length / 2 + .5, -.22)
  };
}
