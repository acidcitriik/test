import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS,collidePaddle,collideWalls,Match,updateStroke} from '../src/physics.js';
test('opposite lateral strokes steer and spin in opposite directions',()=>{
 const hit=vx=>{const p={x:0,z:.5,vx:0,vz:-2,spin:0};collidePaddle(p,{x:0,z:0,vx,vz:3,side:-1},DEFAULTS);return p;};
 const a=hit(4),b=hit(-4),flat=hit(0);
 assert.ok(a.vx>flat.vx&&b.vx<flat.vx);
 assert.ok(a.spin*b.spin<0);
 assert.ok(Math.abs(a.vx)>4/3);
});
test('spin changes rail rebound and rail friction cannot add energy',()=>{
 for(const axis of ['x','z'])for(const sign of [-1,1]){
 const bounce=spin=>{const p={x:axis==='x'?sign*3:2,z:axis==='z'?sign*5:0,vx:axis==='x'?sign*4:0,vz:axis==='z'?sign*4:0,spin};const energy=p.vx**2+p.vz**2+.5*DEFAULTS.puckRadius**2*p.spin**2;collideWalls(p,DEFAULTS);assert.ok(p.vx**2+p.vz**2+.5*DEFAULTS.puckRadius**2*p.spin**2<=energy+1e-8);return axis==='x'?p.vz:p.vx;};
 assert.ok(bounce(20)*bounce(-20)<0);
 }
});
test('visible orientation follows spin and resets at serve',()=>{
 const m=new Match();m.serve();m.puck.spin=10;m.tick();assert.ok(m.puck.angle>0);m.serve();assert.equal(m.puck.angle,0);
});

test('gentle touches push softly while firm strokes retain power',()=>{
 const hit=speed=>{const p={x:0,z:.5,vx:0,vz:0,spin:0};collidePaddle(p,{x:0,z:0,vx:0,vz:speed,side:-1},DEFAULTS);return p.vz;};
 assert.ok(hit(.2)<.25);
 assert.ok(hit(1)<1.4);
 assert.ok(hit(7)>13);
 let previous=0;
 for(let speed=.05;speed<6;speed+=.05){const next=hit(speed);assert.ok(next>previous);previous=next;}
});

test('a slow push transfers less speed than the paddle for close control',()=>{
 for(const speed of [.1,.3,.6,1,1.5]){
  const p={x:0,z:.5,vx:0,vz:0,spin:0};
  collidePaddle(p,{x:0,z:0,vx:0,vz:speed,side:-1},DEFAULTS);
  assert.ok(p.vz>0 && p.vz<speed*.65);
 }
});

test('a sustained fast stroke builds power while a brief twitch does not',()=>{
 const p={vx:8,vz:0};updateStroke(p,DEFAULTS.tick,DEFAULTS);
 const brief=p.stroke.commitment;
 for(let i=0;i<18;i++)updateStroke(p,DEFAULTS.tick,DEFAULTS);
 assert.ok(p.stroke.commitment>brief+.5);
 p.vx=-8;updateStroke(p,DEFAULTS.tick,DEFAULTS);
 assert.ok(p.stroke.commitment<.2);
});
test('stroke preparation decays on stopping and stays bounded',()=>{
 const p={vx:8,vz:0};
 for(let i=0;i<30;i++)updateStroke(p,DEFAULTS.tick,DEFAULTS);
 p.vx=0;
 for(let i=0;i<60;i++)updateStroke(p,DEFAULTS.tick,DEFAULTS);
 assert.ok(p.stroke.commitment<.01);
 assert.ok(p.stroke.speed<.01);
});
