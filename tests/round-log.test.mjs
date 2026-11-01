import test from 'node:test';
import assert from 'node:assert/strict';
import {Match} from '../src/physics.js';
test('arcade log captures contacts, goal and resets for the next exchange',()=>{
 const m=new Match({telemetry:true});m.serve();
 Object.assign(m.puck,{x:0,z:-3.3,vx:0,vz:-2});m.tick();
 assert.ok(m.roundLog.contacts.some(e=>e.type==='paddle'&&e.before&&e.after&&e.impulse));
 const saved=m.roundLog;
 Object.assign(m.puck,{x:0,z:4.9,vx:0,vz:4});m.tick();
 assert.equal(m.state,'ready');assert.ok(saved.endTime);assert.ok(saved.peakSpeed>0);assert.ok(saved.samples.length);
 m.serve();assert.notEqual(m.roundLog,saved);assert.equal(m.roundLog.samples.length,0);assert.ok(saved.contacts.length);
});
test('logging does not alter simulation',()=>{
 const a=new Match(),b=new Match({telemetry:true});a.serve();b.serve();
 for(let i=0;i<240;i++){for(const m of [a,b]){m.target.z=-1;m.tick();}}
 assert.deepEqual(a.puck,b.puck);assert.deepEqual(a.scores,b.scores);
});
