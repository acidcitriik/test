import test from 'node:test';
import assert from 'node:assert/strict';
import {Match} from '../src/physics.js';

test('second human controls the far paddle with the same direct movement rules',()=>{
  const m=new Match();m.serve();m.remoteTarget={x:1,z:-3};m.tick();
  assert.equal(m.ai.x,-1);assert.equal(m.ai.z,3);
  assert.equal(m.player.x,0);
  m.remoteTarget={x:100,z:100};m.tick();
  assert.ok(m.ai.x>=-m.cfg.width/2+m.cfg.paddleRadius);
  assert.ok(m.ai.z>0);
});
