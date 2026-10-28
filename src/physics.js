import { chooseAITarget, createAIBrain, recordAIHit } from './ai.js';
// Local gameplay simulation. X/Z is the table plane; the Three.js scene is 3D.
// This deliberately does not depend on the renderer or frame rate.
export const DEFAULTS = Object.freeze({
  width: 5.8, length: 10, goalWidth: 2.05,
  paddleRadius: 0.37, puckRadius: 0.17,
  maxSpeed: 8.5, acceleration: 54, brake: 66,
  wallRestitution: 0.94, paddleRestitution: 0.96,
  friction: 0.25, drag: 0.09, spinDrag: 0.50,
  aiSpeed: 6.7, aiAcceleration: 36,
  tick: 1 / 120, scoreToWin: 7
});

export const clamp = (x, min, max) => Math.max(min, Math.min(max, x));
export const magnitude = (x, z) => Math.hypot(x, z);
const EPS = 1e-9;

// The input controls a target; it never directly sets paddle velocity or power.
// The same acceleration and norm-based speed limits apply to both movement axes.
export function moveToward(p, target, dt, cfg, ai = false) {
  const topSpeed = ai ? cfg.aiSpeed : cfg.maxSpeed;
  const acceleration = ai ? cfg.aiAcceleration : cfg.acceleration;
  const dx = target.x - p.x, dz = target.z - p.z, distance = magnitude(dx, dz);
  const desiredSpeed = Math.min(topSpeed, Math.sqrt(2 * cfg.brake * distance));
  const desiredX = distance > EPS ? dx / distance * desiredSpeed : 0;
  const desiredZ = distance > EPS ? dz / distance * desiredSpeed : 0;
  let ax = desiredX - p.vx, az = desiredZ - p.vz;
  const length = magnitude(ax, az);
  const limit = (distance < .025 ? cfg.brake : acceleration) * dt;
  if (length > limit) { ax *= limit / length; az *= limit / length; }
  p.vx += ax; p.vz += az;
  const speed = magnitude(p.vx, p.vz);
  if (speed > topSpeed) { p.vx *= topSpeed / speed; p.vz *= topSpeed / speed; }
  p.x += p.vx * dt;
  p.z += p.vz * dt;
  const margin = cfg.paddleRadius + .07;
  const boundX = clamp(p.x, -cfg.width / 2 + margin, cfg.width / 2 - margin);
  const boundZ = p.side === -1
    ? clamp(p.z, -cfg.length / 2 + margin, -margin / 2)
    : clamp(p.z, margin / 2, cfg.length / 2 - margin);
  if (p.x !== boundX) p.vx = 0;
  if (p.z !== boundZ) p.vz = 0;
  p.x = boundX; p.z = boundZ;
}

// Collision impulse of a disk against a driven paddle.
// Relative normal velocity controls restitution; tangential velocity creates spin.
// The paddle is motor-driven, so the external motor may supply energy.
export function collidePaddle(puck, paddle, cfg, mode = 'normal') {
  const dx = puck.x - paddle.x, dz = puck.z - paddle.z;
  const minDistance = cfg.puckRadius + cfg.paddleRadius;
  const distance = magnitude(dx, dz);
  if (distance >= minDistance) return false;
  const nx = distance > EPS ? dx / distance : 0;
  const nz = distance > EPS ? dz / distance : -paddle.side;
  puck.x += nx * (minDistance - distance + 1e-5);
  puck.z += nz * (minDistance - distance + 1e-5);
  const relativeNormal = (puck.vx - paddle.vx) * nx + (puck.vz - paddle.vz) * nz;
  if (relativeNormal >= -EPS) return false;
  const restitution = mode === 'rigid' ? .99 : mode === 'soft' ? .46
    : mode === 'grip' ? .79 : cfg.paddleRestitution;
  const friction = mode === 'grip' ? .92 : mode === 'soft' ? .60 : cfg.friction;
  const normalImpulse = -(1 + restitution) * relativeNormal;
  puck.vx += normalImpulse * nx;
  puck.vz += normalImpulse * nz;
  const tx = -nz, tz = nx, radius = cfg.puckRadius;
  const tangentialVelocity = (puck.vx - paddle.vx) * tx
    + (puck.vz - paddle.vz) * tz - puck.spin * radius;
  // Disk inertia I = (1/2)m*r^2; the effective tangential inverse mass = 3/m.
  const tangentImpulse = clamp(-tangentialVelocity / 3,
    -friction * normalImpulse, friction * normalImpulse);
  puck.vx += tangentImpulse * tx;
  puck.vz += tangentImpulse * tz;
  puck.spin -= 2 * tangentImpulse / radius;
  puck.lastImpact = { mode, normal: normalImpulse, tangent: tangentImpulse };
  return true;
}

// Apply friction impulse when the puck touches a rail.
// The resulting spin changes the angle of a subsequent rail bounce.
function bounceRail(p, normalAxis, normalSign, cfg) {
  const radius = cfg.puckRadius;
  const impactVelocity = Math.abs(normalAxis === 'x' ? p.vx : p.vz);
  if (normalAxis === 'x') p.vx = -normalSign * impactVelocity * cfg.wallRestitution;
  else p.vz = -normalSign * impactVelocity * cfg.wallRestitution;
  const tangentialVelocity = normalAxis === 'x'
    ? p.vz - normalSign * p.spin * radius
    : p.vx + normalSign * p.spin * radius;
  const maxFrictionImpulse = cfg.friction * (1 + cfg.wallRestitution) * impactVelocity;
  const impulse = clamp(-tangentialVelocity / 3, -maxFrictionImpulse, maxFrictionImpulse);
  if (normalAxis === 'x') {
    p.vz += impulse;
    p.spin -= normalSign * 2 * impulse / radius;
  } else {
    p.vx += impulse;
    p.spin += normalSign * 2 * impulse / radius;
  }
}

export function collideWalls(p, cfg) {
  const xLimit = cfg.width / 2 - cfg.puckRadius;
  if (p.x > xLimit) {
    p.x = xLimit;
    if (p.vx > 0) bounceRail(p, 'x', 1, cfg);
  }
  if (p.x < -xLimit) {
    p.x = -xLimit;
    if (p.vx < 0) bounceRail(p, 'x', -1, cfg);
  }
  const zLimit = cfg.length / 2 - cfg.puckRadius;
  if (Math.abs(p.z) > zLimit) {
    // A goal is an actual opening in the end rail.
    if (Math.abs(p.x) <= cfg.goalWidth / 2 - cfg.puckRadius) {
      return p.z > 0 ? -1 : 1;
    }
    if (p.z > zLimit) {
      p.z = zLimit;
      if (p.vz > 0) bounceRail(p, 'z', 1, cfg);
    } else {
      p.z = -zLimit;
      if (p.vz < 0) bounceRail(p, 'z', -1, cfg);
    }
  }
  return 0;
}

export class Match {
  constructor(overrides = {}) {
    this.cfg = { ...DEFAULTS, ...overrides };
    this.player = { x: 0, z: -3.8, vx: 0, vz: 0, side: -1 };
    this.ai = { x: 0, z: 3.8, vx: 0, vz: 0, side: 1 };
    this.aiBrain = createAIBrain();
    this.target = { x: 0, z: -3.8 };
    this.puck = { x: 0, z: 0, vx: 0, vz: 0, spin: 0, lastImpact: null };
    this.scores = [0, 0];
    this.state = 'ready';
    this.server = -1;
    this.time = 0;
    this.hits = 0;
    this.rally = 0;
    this.peakSpeed = 0;
    this.input = { left: false, right: false, leftPressed: -Infinity, rightPressed: -Infinity };
    this.events = [];
  }
  reset() { Object.assign(this, new Match({ ...this.cfg })); }
  serve() {
    if (this.state === 'over') return;
    this.puck.x = 0; this.puck.z = this.server * .75;
    this.puck.vx = (this.scores[0] + this.scores[1]) % 2 ? .65 : 0;
    this.puck.vz = -this.server * 3.1;
    this.puck.spin = 0; this.puck.lastImpact = null;
    Object.assign(this.player, { x: 0, z: -3.8, vx: 0, vz: 0 });
    Object.assign(this.ai, { x: 0, z: 3.8, vx: 0, vz: 0 });
    Object.assign(this.target, { x: 0, z: -3.8 });
    this.rally = 0; this.state = 'playing';
    this.aiBrain = createAIBrain();
    this.events.length = 0;
  }
  setButton(key, down) {
    if (key !== 'left' && key !== 'right') return;
    if (down && !this.input[key]) this.input[key + 'Pressed'] = this.time;
    this.input[key] = down;
  }
  impactMode() {
    if (this.input.left && this.input.right) return 'grip';
    if (this.input.left) return 'rigid';
    if (this.input.right) return 'soft';
    return 'normal';
  }
  record(event) {
    this.events.push({ ...event, time: this.time });
    if (this.events.length > 100) this.events.shift();
  }
  tick() {
    if (this.state !== 'playing') return;
    const cfg = this.cfg, dt = cfg.tick, puck = this.puck;
    this.time += dt;
    let goal = 0;
    // Move paddles and puck together at the same substep resolution to
    // prevent fast paddle motion from skipping collision opportunities.
    const maxMovement = Math.max(magnitude(puck.vx, puck.vz), cfg.maxSpeed, cfg.aiSpeed) * dt;
    const steps = clamp(Math.ceil(maxMovement / (cfg.puckRadius * .35)), 1, 24);
    const step = dt / steps;
    for (let k = 0; k < steps; k++) {
      moveToward(this.player, this.target, step, cfg);
      const aiTarget = chooseAITarget(puck, this.ai, this.player, cfg, this.aiBrain, this.time);
      moveToward(this.ai, aiTarget, step, cfg, true);
      puck.x += puck.vx * step;
      puck.z += puck.vz * step;
      for (const [paddle, label, mode] of [
        [this.player, 'player', this.impactMode()],
        [this.ai, 'ai', 'normal']
      ]) {
        if (collidePaddle(puck, paddle, cfg, mode)) {
          this.hits++; this.rally++;
          if (label === 'ai') recordAIHit(this.aiBrain, this.time);
          this.record({ type: 'impact', by: label, ...puck.lastImpact });
          puck.lastImpact = null;
        }
      }
      goal = collideWalls(puck, cfg);
      if (goal) break;
      puck.vx *= Math.exp(-cfg.drag * step);
      puck.vz *= Math.exp(-cfg.drag * step);
      puck.spin *= Math.exp(-cfg.spinDrag * step);
    }
    if (goal) {
      const scorer = goal === 1 ? 1 : 0;
      this.scores[scorer]++;
      this.record({ type: 'goal', scorer, scores: [...this.scores] });
      this.server = goal > 0 ? -1 : 1;
      this.state = Math.max(...this.scores) >= cfg.scoreToWin ? 'over' : 'ready';
      return;
    }
    const speed = magnitude(puck.vx, puck.vz);
    this.peakSpeed = Math.max(this.peakSpeed, speed);
    const maxSafeSpeed = 28; // protects numerical stability; not a scoring bonus
    if (speed > maxSafeSpeed) {
      puck.vx *= maxSafeSpeed / speed; puck.vz *= maxSafeSpeed / speed;
    }
  }
}
