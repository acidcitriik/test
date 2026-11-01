import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS,collidePaddle} from '../src/physics.js';
const speed=p=>Math.hypot(p.vx,p.vz);
function hit(smash, side=-1){const p={x:0,z:-side*.5,vx:0,vz:side*20,spin:0};collidePaddle(p,{x:0,z:0,vx:0,vz:-side*8,side,stroke:{vx:0,vz:-side*8,commitment:1,smash}},DEFAULTS);return p;}
test('ordinary impacts for both sides are slower than a strong smash',()=>{
 for(const side of [-1,1]){const ordinary=hit(0,side),smash=hit(1,side);assert.ok(speed(ordinary)<=DEFAULTS.normalHitMaxSpeed+1e-9);assert.ok(speed(smash)>speed(ordinary)+5);assert.equal(ordinary.lastImpact.speedLimit,16);}
});
test('partially prepared strikes increase the limit smoothly',()=>{
 const a=hit(.5),b=hit(.75),c=hit(1);assert.ok(speed(a)<speed(b)&&speed(b)<speed(c));
});
