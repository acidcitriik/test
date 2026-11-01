import test from 'node:test';
import assert from 'node:assert/strict';
import {Match} from '../src/physics.js';
test('HAL visibly retreats and strikes a stationary serve using the shared smash rules',()=>{
 const m=new Match({aiStyle:'adaptive',aiSpeed:6.9,aiAcceleration:49,telemetry:true});m.serve();m.server=1;m.serve();
 const initial=m.ai.z;let furthest=initial;
 for(let i=0;i<360&&!m.roundLog.contacts.some(e=>e.type==='paddle'&&e.by==='ai');i++){m.tick();furthest=Math.max(furthest,m.ai.z);}
 const hit=m.roundLog.contacts.find(e=>e.type==='paddle'&&e.by==='ai');
 assert.ok(furthest>initial+.2);assert.ok(hit);assert.ok(hit.impulse.smash>=.5);assert.ok(Math.hypot(hit.after.vx,hit.after.vz)>16);assert.equal(hit.after.smashActive,true);
});
test('AI does not retreat into a preparation against a fast incoming puck',()=>{
 const m=new Match({aiStyle:'adaptive',aiSpeed:6.9,aiAcceleration:49});m.serve();Object.assign(m.puck,{x:0,z:2,vx:0,vz:8});m.tick();assert.equal(m.aiSmash.phase,'idle');
});
