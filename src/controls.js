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


// Touch swipes use relative movement, like the mouse. Scaling by the actual
// canvas CSS size keeps a similar feel in portrait and landscape orientations.
// Keeping touch conversion separate preserves the desktop mouse response.
export function moveTargetWithTouch(target, deltaX, deltaY, viewportWidth, viewportHeight, sensitivity, cfg) {
  const width = Math.max(1, viewportWidth);
  const height = Math.max(1, viewportHeight);
  const scaleX = cfg.width * 1.35 * sensitivity / width;
  const scaleZ = (cfg.length / 2) * 1.8 * sensitivity / height;
  return {
    x: clamp(target.x - deltaX * scaleX, -cfg.width / 2 + .48, cfg.width / 2 - .48),
    z: clamp(target.z - deltaY * scaleZ, -cfg.length / 2 + .5, -.22)
  };
}
