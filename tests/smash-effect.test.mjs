import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS,collidePaddle,Match} from '../src/physics.js';
test('smash effect needs a qualifying smash and speed',()=>{
 const hit=smash=>{const puck={x:0,z:.5,vx:0,vz:0,spin:0};collidePaddle(puck,{x:0,z:0,vx:0,vz:8.5,side:-1,stroke:{vx:0,vz:8.5,commitment:1,smash}},DEFAULTS);return puck;};
 assert.equal(hit(1).smashActive,true);assert.notEqual(hit(0).smashActive,true);
});
test('smash effect ends on slowdown and resets at next serve',()=>{
 const m=new Match();m.serve();m.puck.smashActive=true;m.puck.vx=DEFAULTS.smashEffectMinSpeed-.1;m.tick();assert.equal(m.puck.smashActive,false);
 m.puck.smashActive=true;m.serve();assert.equal(m.puck.smashActive,false);
});
