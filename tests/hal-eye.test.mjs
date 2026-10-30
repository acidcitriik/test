import test from 'node:test';
import assert from 'node:assert/strict';
import {HAL_STAGE_ID,HAL_EYE_CALIBRATION,halEyeTarget} from '../src/hal-eye.js';
import {Match} from '../src/physics.js';

test('HAL occupies the existing final level and tracks the real puck without moving the table',()=>{
 assert.equal(HAL_STAGE_ID,'2502');
 assert.deepEqual([HAL_EYE_CALIBRATION.x,HAL_EYE_CALIBRATION.y],[836,165]);
 const cfg=new Match().cfg;
 const home=halEyeTarget({x:0,z:0},cfg);
 assert.deepEqual(home,{x:836,y:165});
 const left=halEyeTarget({x:cfg.width/2,z:0},cfg);
 const right=halEyeTarget({x:-cfg.width/2,z:0},cfg);
 assert.ok(left.x<home.x && right.x>home.x,'engine X-axis is inverted in screen space');
 const far=halEyeTarget({x:0,z:cfg.length/2},cfg);
 const near=halEyeTarget({x:0,z:-cfg.length/2},cfg);
 assert.ok(far.y<home.y && near.y>home.y);
 for(const p of [{x:999,z:999},{x:-999,z:-999}]){
  const t=halEyeTarget(p,cfg);
  assert.ok(Math.abs(t.x-home.x)<=HAL_EYE_CALIBRATION.maxDX);
  assert.ok(Math.abs(t.y-home.y)<=HAL_EYE_CALIBRATION.maxDY);
  assert.ok(Math.hypot(t.x-home.x,t.y-home.y)+HAL_EYE_CALIBRATION.spriteSize/2 < HAL_EYE_CALIBRATION.apertureRadius + 40);
 }
});
