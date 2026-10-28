import test from 'node:test';
import assert from 'node:assert/strict';
import { moveTargetWithMouse, moveTargetWithTouch } from '../src/controls.js';
import { DEFAULTS, Match } from '../src/physics.js';

const start={x:0,z:-3.8};
test('touch swipe right maps to screen right and swipe up advances toward opponent',()=>{
  const t=moveTargetWithTouch(start,100,-100,390,844,1,DEFAULTS);
  assert.ok(t.x<0);assert.ok(t.z>start.z);
});
test('touch drag clamps to playable half even on extreme input',()=>{
  const t=moveTargetWithTouch(start,-100000,-100000,390,844,2.5,DEFAULTS);
  assert.ok(t.x<=DEFAULTS.width/2-.48+1e-9);
  assert.equal(t.z,-.22);
});
test('touch drag has orientation-aware sizing without changing mouse mapping',()=>{
  const before=moveTargetWithMouse(start,100,-100,1,DEFAULTS);
  moveTargetWithTouch(start,40,60,390,844,1,DEFAULTS);
  const after=moveTargetWithMouse(start,100,-100,1,DEFAULTS);
  assert.deepEqual(after,before);
});
test('touch target uses the same immediate player physics as desktop',()=>{
  const m=new Match();m.serve();
  Object.assign(m.target,moveTargetWithTouch(m.target,60,-90,390,844,1,m.cfg));
  m.tick();
  assert.ok(Math.abs(m.player.x-m.target.x)<1e-9);
  assert.ok(Math.abs(m.player.z-m.target.z)<1e-9);
});
