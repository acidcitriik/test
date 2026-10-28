import test from 'node:test';
import assert from 'node:assert/strict';
import { Match, DEFAULTS, prepareDirectMove, applyDirectMove, moveToward } from '../src/physics.js';

test('player snaps to mouse target in one simulation tick, with no smoothing', () => {
  const m = new Match();
  m.serve();
  Object.assign(m.target, {x:1.5,z:-1.65});
  m.tick();
  assert.ok(Math.abs(m.player.x-m.target.x)<1e-9);
  assert.ok(Math.abs(m.player.z-m.target.z)<1e-9);
});
test('direct control reverses direction without a delayed acceleration phase', () => {
  const m=new Match(); m.serve();
  m.target.x=1.2;m.tick();
  assert.ok(Math.abs(m.player.x-1.2)<1e-9);
  m.target.x=-1.2;m.tick();
  assert.ok(Math.abs(m.player.x+1.2)<1e-9);
  assert.ok(m.player.vx<0);
});
test('contact velocity is bounded independent of mouse displacement', () => {
  const m=new Match();m.serve();
  m.target.x=2.4; m.target.z=-.24; m.tick();
  assert.ok(Math.hypot(m.player.vx,m.player.vz)<=m.cfg.maxSpeed+1e-8);
  const stationary=prepareDirectMove(m.player,m.target,m.cfg.tick,m.cfg);
  assert.equal(stationary.vx,0);assert.equal(stationary.vz,0);
});
test('direct input targets remain confined to the player half',()=>{
  const m=new Match(); m.serve();
  Object.assign(m.target,{x:1e6,z:1e6});m.tick();
  assert.ok(m.player.x<=m.cfg.width/2-m.cfg.paddleRadius-.07+1e-9);
  assert.ok(m.player.z<0);
});
test('a large direct motion cannot tunnel through a stationary serve puck',()=>{
  const m=new Match();m.serve();
  assert.equal(m.awaitingServe,true);
  m.target.z=-.5;
  m.tick();
  assert.equal(m.awaitingServe,false);
  assert.ok(m.events.some(e=>e.type==='impact'&&e.by==='player'));
  assert.ok(m.puck.vz>0);
});
test('AI movement still obeys speed and acceleration limits',()=>{
  const m=new Match();m.server=1;m.serve();
  for(let i=0;i<150;i++){
    m.tick();
    assert.ok(Math.hypot(m.ai.vx,m.ai.vz)<=m.cfg.aiSpeed+1e-8);
  }
});
