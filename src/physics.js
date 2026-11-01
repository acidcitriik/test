import { createAIBrain, recordAIHit } from './ai.js';
import {chooseCharacterAITarget} from './ai-profiles.js';
// Local gameplay simulation. X/Z is the table plane; the Three.js scene is 3D.
// This deliberately does not depend on the renderer or frame rate.
export const DEFAULTS = Object.freeze({
  width: 5.8, length: 10, goalWidth: 2.05,
  paddleRadius: 0.37, puckRadius: 0.17,
  maxSpeed: 8.5, acceleration: 54, brake: 66,
  wallRestitution: 0.94, paddleRestitution: 0.96,
  friction: 0.25, paddleGrip: 0.65, wallFriction: 0.32, gestureTransfer: 0.40, drag: 0.09, spinDrag: 0.32,
  aiSpeed: 6.7, aiAcceleration: 36,
  normalHitMaxSpeed: 16, smashEffectMinSpeed: 14, smashEffectMinIntensity: .5,
  tick: 1 / 120, scoreToWin: 7
});

export const clamp = (x, min, max) => Math.max(min, Math.min(max, x));
export const magnitude = (x, z) => Math.hypot(x, z);
const EPS = 1e-9;
export const MAX_PUCK_SPEED = 28;
function limitPuckSpeed(puck, limit = MAX_PUCK_SPEED) {
  const speed = magnitude(puck.vx, puck.vz);
  if (speed <= limit) return false;
  puck.vx *= limit / speed; puck.vz *= limit / speed;
  return true;
}

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

// Direct local input: the player visually reaches the target in the very
// next physics tick, without a motor lag, interpolation or acceleration.
// Contact velocity alone is capped at cfg.maxSpeed, so moving a high-DPI mouse
// cannot create arbitrarily energetic strikes. The paddle is deliberately
// allowed to move farther than vmax*dt; this is an arcade-control trade-off.
export function prepareDirectMove(p, target, dt, cfg) {
  const margin = cfg.paddleRadius + .07;
  const x = clamp(target.x, -cfg.width/2+margin, cfg.width/2-margin);
  const z = clamp(target.z, -cfg.length/2+margin, -margin/2);
  // Ignore sub-nanometric floating-point residue after reaching the target.
  const dx = Math.abs(x-p.x)<1e-9 ? 0 : x-p.x;
  const dz = Math.abs(z-p.z)<1e-9 ? 0 : z-p.z;
  const rawSpeed = magnitude(dx,dz)/dt;
  const factor = rawSpeed > cfg.maxSpeed ? cfg.maxSpeed/rawSpeed : 1;
  return { fromX:p.x, fromZ:p.z, dx, dz,
    vx:dx/dt*factor, vz:dz/dt*factor, distance:magnitude(dx,dz) };
}
export function applyDirectMove(p, move, progress) {
  p.x = move.fromX + move.dx * progress;
  p.z = move.fromZ + move.dz * progress;
  p.vx = move.vx; p.vz = move.vz;
}

// Short motion memory belongs to the physical paddle, never to a mouse event.
// A reversal starts a new stroke; stopping dissipates preparation quickly.
export function updateStroke(p, dt, cfg) {
  const previous = p.stroke ?? {vx:0, vz:0, speed:0, run:0};
  const alpha = 1 - Math.exp(-dt / .035);
  const vx = previous.vx + (p.vx - previous.vx) * alpha;
  const vz = previous.vz + (p.vz - previous.vz) * alpha;
  const speed = magnitude(vx, vz);
  const acceleration = (speed - previous.speed) / dt;
  const aligned = p.vx * previous.vx + p.vz * previous.vz > 0;
  // Only travel at the current pace counts: a slow approach cannot bank power.
  const retention = aligned ? Math.exp(-dt / .10) * Math.min(1, speed / Math.max(previous.speed, EPS)) : 0;
  const run = previous.run * retention + Math.min(magnitude(p.vx,p.vz), cfg.maxSpeed) * dt
    * clamp((speed - 1) / 3, 0, 1);
  const pace = clamp((speed - 1.5) / 4.5, 0, 1);
  const preparation = clamp(run / .30, 0, 1);
  // Acceleration contributes only after actual travel, never as an impulse spike.
  const commitment = clamp(pace * preparation * (1 + .20 * clamp(acceleration / 60, -1, 1)), 0, 1);
  // Measure a short backswing towards the player's own end. Its contribution
  // fades with time, so an old movement cannot be saved for a later strike.
  const backswing = Math.min(.55, (previous.backswing ?? 0) * Math.exp(-dt / .55)
    + Math.max(0, p.vz * (p.side ?? -1)) * dt);
  const approach = clamp(-p.vz * (p.side ?? -1) / 5, 0, 1);
  const smash = clamp(backswing / .22, 0, 1) * approach * commitment;
  p.stroke = {vx,vz,speed,acceleration,run,commitment,backswing,smash};
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
  // Finite drive response: a light nudge transfers only part of the paddle
  // speed, while a deliberate stroke progressively engages the full drive.
  // This models a heavier disk without changing direct pointer positioning.
  const strokeSpeed = magnitude(paddle.vx, paddle.vz);
  const driveBlend = clamp((strokeSpeed - 1.5) / 4.5, 0, 1);
  const commitment = paddle.stroke?.commitment ?? driveBlend * driveBlend * (3 - 2 * driveBlend);
  // A prepared, accelerating forward stroke can hit harder; gentle touches
  // retain their existing response. Future motion never changes a past hit.
  const smash = paddle.stroke?.smash ?? 0;
  const drive = (.45 + .55 * commitment) * (1 + .45 * smash);
  // The measured gesture cannot push after the paddle stops or reverses.
  // Project the filtered speed onto the current movement direction and cap it
  // at the actual speed, so stale momentum cannot supply energy at contact.
  const filteredX = paddle.stroke?.vx ?? paddle.vx;
  const filteredZ = paddle.stroke?.vz ?? paddle.vz;
  const along = strokeSpeed > EPS ? clamp((filteredX * paddle.vx + filteredZ * paddle.vz) / strokeSpeed, 0, strokeSpeed) : 0;
  const driveX = strokeSpeed > EPS ? paddle.vx / strokeSpeed * along * drive : 0;
  const driveZ = strokeSpeed > EPS ? paddle.vz / strokeSpeed * along * drive : 0;
  const relativeNormal = (puck.vx - driveX) * nx + (puck.vz - driveZ) * nz;
  if (relativeNormal >= -EPS) return false;
  const fullRestitution = mode === 'rigid' ? .99 : mode === 'soft' ? .46
    : mode === 'grip' ? .79 : cfg.paddleRestitution;
  // Gentle contacts push rather than spring away. Blend continuously into
  // full restitution for deliberate strikes; no minimum launch impulse.
  const contactSpeed = -relativeNormal;
  const touchBlend = clamp((contactSpeed - .35) / 3.65, 0, 1);
  const smoothBlend = touchBlend * touchBlend * (3 - 2 * touchBlend);
  const restitution = fullRestitution * (.12 + .88 * smoothBlend);
  const friction = mode === 'grip' ? .92 : mode === 'soft' ? .60 : cfg.paddleGrip;
  const normalImpulse = -(1 + restitution) * relativeNormal;
  puck.vx += normalImpulse * nx;
  puck.vz += normalImpulse * nz;
  const tx = -nz, tz = nx, radius = cfg.puckRadius;
  const tangentialVelocity = (puck.vx - driveX) * tx
    + (puck.vz - driveZ) * tz - puck.spin * radius;
  // Disk inertia I = (1/2)m*r^2; the effective tangential inverse mass = 3/m.
  // A driven paddle carries a lateral stroke through the contact patch.
  // Keep its contribution bounded by contact pressure, including on glancing hits.
  const gesture = (driveX * tx + driveZ * tz) * cfg.gestureTransfer * (.25 + .75 * smoothBlend);
  const tangentImpulse = clamp(-tangentialVelocity / 3 + gesture,
    -friction * normalImpulse, friction * normalImpulse);
  puck.vx += tangentImpulse * tx;
  puck.vz += tangentImpulse * tz;
  puck.spin -= 2 * tangentImpulse / radius;
  // High outgoing speeds require a prepared smash, regardless of player or AI.
  // Blend the limit for qualified strokes instead of a sudden power jump.
  const smashPower = clamp((smash - cfg.smashEffectMinIntensity) / (1 - cfg.smashEffectMinIntensity), 0, 1);
  const speedLimit = cfg.normalHitMaxSpeed + (MAX_PUCK_SPEED - cfg.normalHitMaxSpeed) * smashPower;
  const capped = limitPuckSpeed(puck, speedLimit);
  if (smash >= cfg.smashEffectMinIntensity && magnitude(puck.vx, puck.vz) >= cfg.smashEffectMinSpeed) puck.smashActive = true;
  if (magnitude(puck.vx, puck.vz) < cfg.smashEffectMinSpeed) puck.smashActive = false;
  puck.lastImpact = { mode, normal: normalImpulse, tangent: tangentImpulse, capped, smash, speedLimit };
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
  const maxFrictionImpulse = cfg.wallFriction * (1 + cfg.wallRestitution) * impactVelocity;
  const impulse = clamp(-tangentialVelocity / 3, -maxFrictionImpulse, maxFrictionImpulse);
  if (normalAxis === 'x') {
    p.vz += impulse;
    p.spin -= normalSign * 2 * impulse / radius;
  } else {
    p.vx += impulse;
    p.spin += normalSign * 2 * impulse / radius;
  }
  limitPuckSpeed(p);
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
    this.puck = { x: 0, z: -2.35, vx: 0, vz: 0, spin: 0, angle: 0, smashActive: false, lastImpact: null }; // visible pre-serve rest position
    this.scores = [0, 0];
    this.state = 'ready';
    this.server = -1; // first engagement belongs to the player
    this.awaitingServe = false;
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
    // A real engagement: a stationary puck on the server's half.
    // Neither player nor AI receives a pre-programmed impulse.
    this.puck.x = 0; this.puck.z = this.server * 2.35;
    this.puck.vx = 0; this.puck.vz = 0;
    this.puck.spin = 0; this.puck.angle = 0; this.puck.smashActive = false; this.puck.lastImpact = null;
    Object.assign(this.player, { x: 0, z: -3.8, vx: 0, vz: 0 });
    Object.assign(this.ai, { x: 0, z: 3.8, vx: 0, vz: 0 });
    Object.assign(this.target, { x: 0, z: -3.8 });
    this.player.stroke = null; this.ai.stroke = null;
    if (this.cfg.telemetry) this.roundLog = {schema:1, units:{distance:'table unit',time:'second',speed:'table unit/s',spin:'rad/s',impulse:'per unit puck mass',force:'not measured; contact duration is not modeled'},config:{...this.cfg},startTime:this.time,initialScores:[...this.scores],samples:[],contacts:[],peakSpeed:0,truncated:false};
    this.rally = 0; this.state = 'playing';
    this.awaitingServe = true;
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
  logContact(event,offset=0){
    if(this.roundLog.contacts.length<20000)this.roundLog.contacts.push({time:this.time-this.cfg.tick+offset,...event});
    else this.roundLog.truncated=true;
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
    // A player command has zero artificial following delay. Sweep between
    // old and new positions so the disk cannot teleport THROUGH the puck.
    const direct = prepareDirectMove(this.player, this.target, dt, cfg);
    const remote = this.remoteTarget ? prepareDirectMove(
      {x:-this.ai.x,z:-this.ai.z}, this.remoteTarget, dt, cfg) : null;
    const maxMovement = Math.max(magnitude(puck.vx,puck.vz)*dt,
      cfg.aiSpeed*dt, direct.distance, remote?.distance ?? 0);
    const steps = clamp(Math.ceil(maxMovement / (cfg.puckRadius * .30)), 1, 128);
    const step = dt / steps;
    for (let k = 0; k < steps; k++) {
      applyDirectMove(this.player, direct, (k+1)/steps);
      const aiTarget = this.awaitingServe && this.server === 1
        ? { x: puck.x, z: Math.max(cfg.paddleRadius + .08, puck.z - .52) }
        : chooseCharacterAITarget(puck, this.ai, this.player, cfg, this.aiBrain, this.time);
      if(remote){const p={};applyDirectMove(p,remote,(k+1)/steps);Object.assign(this.ai,{x:-p.x,z:-p.z,vx:-p.vx,vz:-p.vz});}
      else moveToward(this.ai, aiTarget, step, cfg, true);
      updateStroke(this.player, step, cfg);
      if (remote) updateStroke(this.ai, step, cfg);
      puck.angle = ((puck.angle ?? 0) + puck.spin * step) % (2 * Math.PI);
      puck.x += puck.vx * step;
      puck.z += puck.vz * step;
      for (const [paddle, label, mode] of [
        [this.player, 'player', this.impactMode()],
        [this.ai, 'ai', this.remoteMode ?? 'normal']
      ]) {
        const before = this.roundLog ? {...puck} : null;
        if (collidePaddle(puck, paddle, cfg, mode)) {
          if (this.roundLog) {
            const dot=before.vx*puck.vx+before.vz*puck.vz;
            const lengths=magnitude(before.vx,before.vz)*magnitude(puck.vx,puck.vz);
            this.logContact({type:'paddle',by:label,mode,before,after:{...puck},paddle:{...paddle,stroke:paddle.stroke?{...paddle.stroke}:null},directionChangeDegrees:lengths>EPS?Math.acos(clamp(dot/lengths,-1,1))*180/Math.PI:null,impulse:{...puck.lastImpact}},k*step);
          }
          if (this.awaitingServe) {
            this.awaitingServe = false;
            this.record({ type: 'serve', by: label });
          }
          this.hits++; this.rally++;
          if (label === 'ai') recordAIHit(this.aiBrain, this.time);
          this.record({ type: 'impact', by: label, ...puck.lastImpact });
          puck.lastImpact = null;
        }
      }
      const beforeRail=this.roundLog?{...puck}:null;
      goal = collideWalls(puck, cfg);
      if(beforeRail&&(beforeRail.vx!==puck.vx||beforeRail.vz!==puck.vz))this.logContact({type:'rail',before:beforeRail,after:{...puck},deltaVelocity:{x:puck.vx-beforeRail.vx,z:puck.vz-beforeRail.vz},deltaSpin:puck.spin-beforeRail.spin},k*step);
      if(this.roundLog)this.roundLog.peakSpeed=Math.max(this.roundLog.peakSpeed,magnitude(puck.vx,puck.vz));
      if (magnitude(puck.vx,puck.vz) < cfg.smashEffectMinSpeed) puck.smashActive = false;
      if (goal) break;
      puck.vx *= Math.exp(-cfg.drag * step);
      puck.vz *= Math.exp(-cfg.drag * step);
      puck.spin *= Math.exp(-cfg.spinDrag * step);
      if (magnitude(puck.vx,puck.vz) < cfg.smashEffectMinSpeed) puck.smashActive = false;
    }
    if(this.roundLog){
      const log=this.roundLog;
      if(log.samples.length<72000)log.samples.push({time:this.time,puck:{...puck},player:{...this.player,stroke:this.player.stroke?{...this.player.stroke}:null},ai:{...this.ai},target:{...this.target},mode:this.impactMode()});else log.truncated=true;
    }
    if (goal) {
      const scorer = goal === 1 ? 1 : 0;
      this.scores[scorer]++;
      if(this.roundLog)Object.assign(this.roundLog,{endTime:this.time,scorer,scores:[...this.scores],hits:this.rally});
      this.record({ type: 'goal', scorer, scores: [...this.scores] });
      this.server = goal > 0 ? -1 : 1;
      this.state = Math.max(...this.scores) >= cfg.scoreToWin ? 'over' : 'ready';
      return;
    }
    const speed = magnitude(puck.vx, puck.vz);
    this.peakSpeed = Math.max(this.peakSpeed, speed);
    limitPuckSpeed(puck);
  }
}
