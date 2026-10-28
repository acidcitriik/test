// Tactical 2D agent. The agent can only command a target position.
// The motor, collisions, impulse, restitution and puck movement live in physics.js.
const clampAI = (v, a, b) => Math.max(a, Math.min(b, v));
const speedOf = p => Math.hypot(p.vx, p.vz);

export function predictRailX(puck, seconds, cfg) {
  const xLimit = cfg.width / 2 - cfg.puckRadius;
  const travel = seconds <= 0 ? 0 :
    Math.abs(cfg.drag) < 1e-8 ? seconds : (1 - Math.exp(-cfg.drag * seconds)) / cfg.drag;
  const projected = puck.x + puck.vx * travel;
  const period = 4 * xLimit;
  const offset = ((projected + xLimit) % period + period) % period;
  return offset <= 2 * xLimit ? offset - xLimit : 3 * xLimit - offset;
}

export function createAIBrain() {
  return {
    phase: 'defend', phaseAt: 0, lastImpact: -Infinity,
    possessionHits: 0, bankAttempts: 0, lastBankAt: -Infinity,
    bankSide: 1, lastPuckOnAIHalf: false
  };
}

function setPhase(brain, phase, now) {
  if (brain && brain.phase !== phase) {
    brain.phase = phase; brain.phaseAt = now;
  }
}

export function recordAIHit(brain, time) {
  brain.possessionHits += 1;
  brain.lastImpact = time;
  if (brain.phase === 'bankStrike') {
    brain.lastBankAt = time;
    setPhase(brain, 'follow', time);
  } else {
    setPhase(brain, 'follow', time);
  }
}

// Pure geometric decision with a small deterministic tactical memory, but no
// velocity injection, teleportation or invented contact/power bonuses.
export function chooseAITarget(puck, ai, player, cfg, brain = null, now = 0) {
  const minZ = cfg.paddleRadius + .08;
  const maxZ = cfg.length / 2 - minZ;
  const minX = -cfg.width / 2 + minZ;
  const maxX = -minX;
  const limitX = cfg.width / 2 - cfg.puckRadius;
  const speed = speedOf(puck);
  const horizontal = Math.abs(puck.vz) < Math.max(.48, Math.abs(puck.vx) * .32);
  const slow = speed < 1.15;
  const onOwnHalf = puck.z > .14;
  const outgoing = puck.vz < -1.5 && !horizontal && !slow;
  const deep = puck.z > 4.10;

  if (brain && !brain.lastPuckOnAIHalf && onOwnHalf) {
    brain.possessionHits = 0;
    if (brain.phase === 'follow') setPhase(brain, 'defend', now);
  }
  if (brain) brain.lastPuckOnAIHalf = onOwnHalf;

  // Truly outgoing shots are no longer actively pursued. A banked ball, a
  // horizontal ball and a nearly stopped ball can all be recovered repeatedly.
  if (!onOwnHalf && puck.vz <= 0) {
    setPhase(brain, 'defend', now);
    return { x: 0, z: 3.52 };
  }
  if (outgoing && puck.z < 2.1) {
    setPhase(brain, 'defend', now);
    return { x: 0, z: 3.52 };
  }

  // Intentionally set up a side-rail play on an accessible nearly stationary
  // puck. Approach from behind and to the side, THEN strike. If the puck
  // starts moving, stop preparing and intercept it immediately.
  const bankable = onOwnHalf && slow &&
    puck.z > 1.05 && puck.z < 3.30 && Math.abs(puck.x) < 1.60;
  const canPlanBank = brain && bankable && brain.possessionHits === 0 &&
    brain.bankAttempts === 0 && now - brain.lastImpact > .25;
  if (canPlanBank) {
    brain.bankAttempts += 1;
    brain.bankSide = puck.x > .6 ? 1 : puck.x < -.6 ? -1 : (player.x >= 0 ? -1 : 1);
    setPhase(brain, 'bankSetup', now);
  }
  if (brain?.phase === 'bankSetup' || brain?.phase === 'bankStrike') {
    if (!bankable || now - brain.phaseAt > 2.0) {
      setPhase(brain, 'collect', now);
    } else {
      const side = brain.bankSide;
      // Staging point is OUTSIDE contact range (paddle + puck radii = .54).
      const staging = {
        x: clampAI(puck.x - side * .78, minX, maxX),
        z: clampAI(puck.z + .78, minZ, maxZ)
      };
      if (brain.phase === 'bankSetup') {
        const distance = Math.hypot(ai.x - staging.x, ai.z - staging.z);
        const velocity = speedOf(ai);
        if (distance < .13 && velocity < 1.1) setPhase(brain, 'bankStrike', now);
        else return staging;
      }
      // Contact is primarily side-on, producing a rail-directed bank
      // using the motor's actual current velocity and contact normal.
      return {
        x: clampAI(puck.x + side * .16, minX, maxX),
        z: clampAI(puck.z + .06, minZ, maxZ)
      };
    }
  }

  // Recover the puck even when vz is zero, negative or the full
  // velocity points across the width. Never wait for an incoming vz.
  if (onOwnHalf && (slow || horizontal || puck.vz > -.30)) {
    if (brain?.phase !== 'follow') setPhase(brain, 'collect', now);
  } else {
    if (brain?.phase !== 'follow') setPhase(brain, 'intercept', now);
  }

  // Avoid chasing a puck that is behind our paddle into our own goal.
  // Move around its side to get behind before initiating another stroke.
  if (puck.z > ai.z + .42 && puck.z < maxZ - .54 && (slow || horizontal)) {
    const side = puck.x > 0 ? -1 : 1;
    return {
      x: clampAI(puck.x + side * .90, minX, maxX),
      z: clampAI(puck.z + .69, minZ, maxZ)
    };
  }

  // Estimate actual reachable interception time from motor speed and distance.
  // On horizontal approaches we lead the puck rather than chasing its
  // current X position, and reflect the estimate at the side rails.
  const targetZ = !onOwnHalf
    ? clampAI(1.2 + Math.max(0, puck.vz - 3) * .23, 1.2, 3.0)
    : deep ? 4.0
    : clampAI(puck.z + (horizontal ? .12 : slow ? .23 : .30), minZ, maxZ);
  const range = Math.hypot(puck.x - ai.x, targetZ - ai.z);
  const motorTime = clampAI(range / Math.max(1, cfg.aiSpeed) * .65, .06, .55);
  const planeTime = puck.vz > .15
    ? clampAI((targetZ - puck.z - cfg.paddleRadius) / Math.max(.4, puck.vz), 0, .85)
    : motorTime;
  const leadTime = horizontal || slow ? motorTime : planeTime;
  const projectedX = predictRailX(puck, leadTime, cfg);

  // Small intentional misalignment creates angled, physically authentic
  // strokes, including follow-up contacts after side-rail returns.
  const offset = slow || horizontal ? (player.x > 0 ? .07 : -.07) : 0;
  return { x: clampAI(projectedX + offset, minX, maxX), z: targetZ };
}
