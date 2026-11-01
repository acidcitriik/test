import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS,MAX_PUCK_SPEED,collidePaddle,collideWalls} from '../src/physics.js';
test('stopped paddle cannot transfer residual filtered motion',()=>{
 const hit=stroke=>{const p={x:0,z:.5,vx:0,vz:-10,spin:0};collidePaddle(p,{x:0,z:0,vx:0,vz:0,side:-1,stroke},DEFAULTS);return p;};
 const a=hit({vx:0,vz:7.43,commitment:0}), b=hit({vx:0,vz:0,commitment:0});
 assert.equal(a.vx,b.vx);assert.equal(a.vz,b.vz);
});
test('reversed paddle cannot propel puck in stale direction',()=>{
 const p={x:0,z:.5,vx:0,vz:-1,spin:0};
 collidePaddle(p,{x:0,z:0,vx:0,vz:-5,side:-1,stroke:{vx:0,vz:8,commitment:1}},DEFAULTS);
 const reference={x:0,z:.5,vx:0,vz:-1,spin:0};
 collidePaddle(reference,{x:0,z:0,vx:0,vz:0,side:-1,stroke:{vx:0,vz:0,commitment:1}},DEFAULTS);
 assert.equal(p.vz,reference.vz);
});
test('collision speed limit applies immediately to paddles and rails',()=>{
 const p={x:0,z:.5,vx:0,vz:-27,spin:0};
 collidePaddle(p,{x:0,z:0,vx:0,vz:8.5,side:-1},DEFAULTS);
 assert.ok(Math.hypot(p.vx,p.vz)<=MAX_PUCK_SPEED+1e-9);assert.equal(p.lastImpact.capped,true);
 const r={x:DEFAULTS.width/2,z:0,vx:27,vz:0,spin:500};collideWalls(r,DEFAULTS);
 assert.ok(Math.hypot(r.vx,r.vz)<=MAX_PUCK_SPEED+1e-9);
});
