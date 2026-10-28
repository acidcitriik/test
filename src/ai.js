// Deterministic two-axis opponent. Only chooses a destination;
// the physical acceleration/speed limits are enforced by moveToward().
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

// First-order rail reflection forecast. Enough to intercept bank shots without
// pretending to predict changes in spin or future paddle collisions.
export function predictRailX(puck, seconds, cfg) {
  const xLimit = cfg.width / 2 - cfg.puckRadius;
  const travel = seconds <= 0 ? 0 : (1 - Math.exp(-cfg.drag * seconds)) / Math.max(cfg.drag, 1e-6);
  let x = puck.x + puck.vx * travel;
  // Fold the projected position inside the legal rail interval.
  const span = xLimit * 2;
  const folded = ((x + xLimit) % (span * 2) + span * 2) % (span * 2);
  return folded <= span ? folded - xLimit : span * 2 - folded - xLimit;
}

export function chooseAITarget(puck, ai, player, cfg) {
  const minZ = cfg.paddleRadius + 0.08;
  const maxZ = cfg.length / 2 - minZ;
  const limitX = cfg.width / 2 - minZ;
  const inbound = puck.vz > 0.15;
  const inReach = puck.z > 0.35;
  const receding = puck.vz < -0.35;

  // Recovery: don't chase a puck deeply into the player's half.
  // Leave the centre line available so the opponent can return it.
  if (!inReach && receding) {
    return { x: clamp(puck.x * 0.15, -0.6, 0.6), z: 3.55 };
  }
  if (!inReach && !inbound) {
    return { x: 0, z: 3.55 };
  }

  // On a slow shot, challenge the puck near the centre line. On a powerful
  // incoming shot, stay deeper to preserve a reasonable defensive window.
  const incomingSpeed = Math.max(0, puck.vz);
  let targetZ;
  if (!inReach) {
    targetZ = clamp(1.25 + Math.max(0, incomingSpeed - 3) * 0.30, 1.25, 3.10);
  } else {
    // To send the puck back toward the player, stay behind it (positive Z).
    // The target is intentionally closer than the contact radius: the physical
    // paddle approaches to strike rather than merely shadowing it sideways.
    const standoff = 0.25 + Math.min(incomingSpeed, 10) * 0.015;
    targetZ = clamp(puck.z + standoff, minZ, maxZ);
    // When the puck has almost passed us, retreat to defend the goal mouth.
    if (puck.z > ai.z + 0.45 && inbound) targetZ = clamp(puck.z + 0.7, minZ, maxZ);
  }

  // Forecast where the puck meets the chosen Z attack/defence plane,
  // accounting for side-wall bank shots.
  let timeToPlane = 0;
  if (inbound) timeToPlane = clamp((targetZ - puck.z - cfg.paddleRadius) /
    Math.max(puck.vz, 0.4), 0, 1.1);
  else if (inReach) timeToPlane = clamp(Math.abs(ai.z - puck.z) /
    Math.max(2, Math.hypot(puck.vx, puck.vz)), 0, 0.4);

  const predictedX = predictRailX(puck, timeToPlane, cfg);
  // Small deliberate offset produces oblique, physically simulated returns;
  // no shot force or velocity is injected by the AI.
  const aimAwayFromPlayer = player.x >= 0 ? -1 : 1;
  const contactOffset = inReach && Math.abs(puck.vz) < 6 ? 0.08 * aimAwayFromPlayer : 0;
  return {
    x: clamp(predictedX + contactOffset, -limitX, limitX),
    z: targetZ
  };
}
