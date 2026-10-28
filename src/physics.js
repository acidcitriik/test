export const DEFAULTS = Object.freeze({
  width: 5.8, length: 10, goalWidth: 2.05,
  paddleRadius: 0.37, puckRadius: 0.17,
  maxSpeed: 8.5, acceleration: 54, brake: 66,
  wallRestitution: 0.94, paddleRestitution: 0.96,
  friction: 0.25, drag: 0.09, spinDrag: 0.50,
  aiSpeed: 6.7, aiAcceleration: 36,
  tick: 1 / 120, scoreToWin: 7
});
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const magnitude = (x, z) => Math.hypot(x, z);
export function moveToward(p, target, dt, cfg, ai = false) {
  const vmax = ai ? cfg.aiSpeed : cfg.maxSpeed;
  const amax = ai ? cfg.aiAcceleration : cfg.acceleration;
  const dx = target.x - p.x, dz = target.z - p.z;
  const dist = magnitude(dx, dz);
  const desiredSpeed = Math.min(vmax, Math.sqrt(2 * cfg.brake * dist));
  const desiredX = dist > 1e-8 ? dx / dist * desiredSpeed : 0;
  const desiredZ = dist > 1e-8 ? dz / dist * desiredSpeed : 0;
  let ax = desiredX - p.vx, az = desiredZ - p.vz;
  const alen = magnitude(ax, az);
  const limit = (dist < 0.03 ? cfg.brake : amax) * dt;
  if (alen > limit) { ax *= limit / alen; az *= limit / alen; }
  p.vx += ax; p.vz += az;
  const speed = magnitude(p.vx, p.vz);
  if (speed > vmax) { p.vx *= vmax / speed; p.vz *= vmax / speed; }
  p.x += p.vx * dt;
  p.z += p.vz * dt;
  const margin = cfg.paddleRadius + 0.08;
  const nx = clamp(p.x, -cfg.width/2 + margin, cfg.width/2 - margin);
  const nz = clamp(p.z, p.side < 0 ? -cfg.length/2 + margin : margin * .5,
    p.side < 0 ? -margin * .5 : cfg.length/2 - margin);
  if (nx !== p.x) p.vx = 0;
  if (nz !== p.z) p.vz = 0;
  p.x = nx; p.z = nz;
}
export function collidePaddle(puck, paddle, cfg, mode = 'normal') {
  const dx = puck.x - paddle.x, dz = puck.z - paddle.z;
  let dist = magnitude(dx, dz);
  const minDist = cfg.puckRadius + cfg.paddleRadius;
  if (dist >= minDist) return false;
  const nx = dist > 1e-8 ? dx / dist : 0;
  const nz = dist > 1e-8 ? dz / dist : (paddle.side < 0 ? 1 : -1);
  dist = Math.max(dist, 1e-8);
  puck.x += nx * (minDist - dist + 1e-5);
  puck.z += nz * (minDist - dist + 1e-5);
  const tx = -nz, tz = nx;
  const radius = cfg.puckRadius;
  // The paddle is modeled as a driven body with prescribed velocity.
  const relN = (puck.vx - paddle.vx) * nx + (puck.vz - paddle.vz) * nz;
  if (relN >= 0) return true;
  const restitution = mode === 'rigid' ? 0.99 : mode === 'soft' ? .46 : mode === 'grip' ? .79 : cfg.paddleRestitution;
  const impulseN = -(1 + restitution) * relN;
  puck.vx += impulseN * nx;
  puck.vz += impulseN * nz;
  const tangential = (puck.vx - paddle.vx) * tx + (puck.vz - paddle.vz) * tz - puck.spin * radius;
  const effective = 1 + 2; // solid disk, I = 1/2*m*r²
  const friction = mode === 'grip' ? .93 : mode === 'soft' ? .65 : cfg.friction;
  const impulseT = clamp(-tangential / effective, -friction * impulseN, friction * impulseN);
  puck.vx += impulseT * tx;
  puck.vz += impulseT * tz;
  puck.spin -= 2 * impulseT / radius;
  puck.lastImpact = { mode, normal: impulseN, tangent: impulseT };
  return true;
}
export function collideWalls(p, cfg) {
  const xLimit = cfg.width/2 - cfg.puckRadius;
  if (p.x > xLimit) { p.x = xLimit; p.vx = -Math.abs(p.vx)*cfg.wallRestitution; p.spin *= .93; }
  if (p.x < -xLimit) { p.x = -xLimit; p.vx = Math.abs(p.vx)*cfg.wallRestitution; p.spin *= .93; }
  const zLimit = cfg.length/2 - cfg.puckRadius;
  if (Math.abs(p.z) > zLimit) {
    if (Math.abs(p.x) < cfg.goalWidth/2 - cfg.puckRadius*.2) return p.z > 0 ? -1 : 1;
    if (p.z > zLimit) { p.z = zLimit; p.vz = -Math.abs(p.vz)*cfg.wallRestitution; }
    else { p.z = -zLimit; p.vz = Math.abs(p.vz)*cfg.wallRestitution; }
    // Spin affects rebound from the end wall via tangential friction.
    const sign = p.z > 0 ? 1 : -1;
    const tangent = p.vx + p.spin * cfg.puckRadius * sign;
    const correction = clamp(-tangent * cfg.friction / 3, -2, 2);
    p.vx += correction;
    p.spin += (correction * sign) / cfg.puckRadius;
  }
  return 0;
}
export class Match {
  constructor(overrides={}) {
    this.cfg={...DEFAULTS,...overrides};
    this.player={x:0,z:-3.8,vx:0,vz:0,side:-1};
    this.ai={x:0,z:3.8,vx:0,vz:0,side:1};
    this.target={x:0,z:-3.8};
    this.puck={x:0,z:0,vx:0,vz:0,spin:0,lastImpact:null};
    this.scores=[0,0]; this.state='ready'; this.server=-1;
    this.time=0; this.hits=0; this.rally=0;
    this.input={left:false,right:false,leftPressed:Infinity,rightPressed:Infinity};
    this.events=[];
  }
  reset() { const cfg=this.cfg; Object.assign(this,new Match(cfg)); }
  serve() {
    if(this.state==='over')return;
    this.puck.x=0; this.puck.z=this.server*.75;
    this.puck.vx=0; this.puck.vz=-this.server*3.1; this.puck.spin=0;
    this.player.x=0;this.player.z=-3.8;this.player.vx=this.player.vz=0;
    this.ai.x=0;this.ai.z=3.8;this.ai.vx=this.ai.vz=0;
    this.target.x=0;this.target.z=-3.8;
    this.state='playing';this.rally=0;
  }
  setButton(key,on) {
    if (on && !this.input[key]) this.input[key+'Pressed']=this.time;
    this.input[key]=on;
  }
  impactMode() {
    const i=this.input;
    if (i.left && i.right) return 'grip';
    if (i.left) return 'rigid';
    if (i.right) return 'soft';
    return 'normal';
  }
  tick() {
    if(this.state!=='playing')return;
    const cfg=this.cfg, dt=cfg.tick;
    this.time+=dt;
    moveToward(this.player,this.target,dt,cfg);
    let aimX=0, aimZ=3.7;
    const puck=this.puck;
    if(puck.vz>0 || puck.z>1.3){
      const timeTo = Math.max(.05,(3.6-puck.z)/Math.max(.5,puck.vz));
      aimX=clamp(puck.x+puck.vx*timeTo*.77,-cfg.width/2+.5,cfg.width/2-.5);
      aimZ=clamp(puck.z>2.4?puck.z+.43:3.2, .55,4.4);
    }
    moveToward(this.ai,{x:aimX,z:aimZ},dt,cfg,true);
    // Small substeps reduce tunneling for the tested velocity ranges.
    const speed=magnitude(puck.vx,puck.vz);
    const steps=clamp(Math.ceil(speed*dt/(cfg.puckRadius*.42)),1,20);
    const subDt=dt/steps;
    for(let k=0;k<steps;k++){
      puck.x+=puck.vx*subDt;puck.z+=puck.vz*subDt;
      let hit=collidePaddle(puck,this.player,cfg,this.impactMode());
      if(hit && puck.lastImpact) {this.hits++;this.rally++;this.events.push({type:'impact',by:'player',time:this.time,...puck.lastImpact});puck.lastImpact=null;}
      hit=collidePaddle(puck,this.ai,cfg,'normal');
      if(hit && puck.lastImpact) {this.hits++;this.rally++;this.events.push({type:'impact',by:'ai',time:this.time,...puck.lastImpact});puck.lastImpact=null;}
      const goal=collideWalls(puck,cfg);
      if(goal!==0){
        const scorer=goal===1?1:0;
        this.scores[scorer]++;
        this.events.push({type:'goal',scorer,score:[...this.scores],time:this.time});
        this.state=Math.max(...this.scores)>=cfg.scoreToWin?'over':'ready';
        this.server=goal>0?-1:1;
        return;
      }
      puck.vx*=Math.exp(-cfg.drag*subDt);
      puck.vz*=Math.exp(-cfg.drag*subDt);
      puck.spin*=Math.exp(-cfg.spinDrag*subDt);
    }
    const maxPuck=28,actual=magnitude(puck.vx,puck.vz);
    if(actual>maxPuck){puck.vx*=maxPuck/actual;puck.vz*=maxPuck/actual;}
  }
}