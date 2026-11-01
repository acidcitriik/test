import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS,updateStroke,collidePaddle} from '../src/physics.js';
const dt=DEFAULTS.tick;
function makeStroke(prepared,side=-1){
 const p={x:0,z:0,vx:0,vz:0,side};
 if(prepared){p.vz=side*5;for(let i=0;i<12;i++)updateStroke(p,dt,DEFAULTS);}
 p.vz=-side*8;for(let i=0;i<14;i++)updateStroke(p,dt,DEFAULTS);return p;
}
test('backswing and forward stroke deliver a stronger smash for either side',()=>{
 for(const side of [-1,1]){
  const base=makeStroke(false,side),prepared=makeStroke(true,side);
  const impact=p=>{const puck={x:0,z:-side*.5,vx:0,vz:0,spin:0};assert.ok(collidePaddle(puck,p,DEFAULTS));return Math.hypot(puck.vx,puck.vz);};
  assert.ok(prepared.stroke.smash>0);assert.ok(impact(prepared)>impact(base));
 }
});
test('backswing fades during a pause and slow gestures do not smash',()=>{
 const p=makeStroke(true);p.vz=0;for(let i=0;i<600;i++)updateStroke(p,dt,DEFAULTS);
 assert.ok(p.stroke.backswing<.001);assert.equal(p.stroke.smash,0);
 p.vz=1;for(let i=0;i<20;i++)updateStroke(p,dt,DEFAULTS);assert.equal(p.stroke.smash,0);
});
