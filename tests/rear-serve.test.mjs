import test from 'node:test';
import assert from 'node:assert/strict';
import { Match, DEFAULTS } from '../src/physics.js';
import { chooseAITarget, createAIBrain } from '../src/ai.js';

function simulateBehind({x,z,vx=0,vz=0,aiZ=2.25}, seconds=4) {
  const m=new Match({scoreToWin:99});m.serve();
  Object.assign(m.ai,{x:0,z:aiZ,vx:0,vz:0});
  Object.assign(m.puck,{x,z,vx,vz,spin:0});
  const impacts=[];let rearBounce=false,atRear=false;
  for(let i=0;i<seconds*120&&m.state==='playing';i++) {
    const prevVz=m.puck.vz;
    m.tick();
    if(prevVz>0.15&&m.puck.vz<-.15&&m.puck.z>4.7)rearBounce=true;
    for(const event of m.events)if(event.type==='impact'&&event.by==='ai')
      impacts.push({time:event.time,x:m.puck.x,z:m.puck.z,vx:m.puck.vx,vz:m.puck.vz});
    m.events.length=0;
  }
  return {m,impacts,rearBounce};
}

test('opening duel starts with a stationary neutral puck at the centre',()=>{
  const m=new Match();
  assert.equal(m.server,0);
  m.serve();
  assert.equal(m.awaitingServe,true);
  assert.equal(m.puck.z,0);
  assert.equal(m.puck.vx,0);assert.equal(m.puck.vz,0);
  for(let i=0;i<240 && m.awaitingServe;i++)m.tick();
  assert.equal(m.awaitingServe,false,'AI should physically contest the central puck');
  assert.ok(m.events.some(e=>e.type==='serve'&&e.by==='ai'));
  assert.equal(m.scores[0]+m.scores[1],0);
});

test('player must hit the stationary puck to engage, no artificial velocity',()=>{
  const m=new Match();m.serve();m.target.z=-.22;
  for(let i=0;i<360&&m.awaitingServe;i++)m.tick();
  assert.equal(m.awaitingServe,false,'player should physically reach the puck');
  assert.ok(m.events.some(e=>e.type==='serve'&&e.by==='player'));
  assert.ok(m.events.some(e=>e.type==='impact'&&e.by==='player'));
});

test('AI also engages a stationary puck through the same collision system',()=>{
  const m=new Match();m.server=1;m.serve();
  assert.equal(m.puck.z,2.35);
  assert.equal(Math.hypot(m.puck.vx,m.puck.vz),0);
  for(let i=0;i<360&&m.awaitingServe;i++)m.tick();
  assert.equal(m.awaitingServe,false,'AI must serve within three seconds');
  assert.ok(m.events.some(e=>e.type==='serve'&&e.by==='ai'));
  assert.ok(m.puck.vz<0,'AI should physically send the puck toward the player');
});

test('a ball behind AI and outside the goal mouth can be cleared toward the rear rail',()=>{
  const r=simulateBehind({x:1.95,z:3.8,vx:0,vz:0});
  assert.ok(r.impacts.length>0,'AI failed to recover');
  assert.ok(r.impacts[0].vz>1,'AI should initially strike towards +Z, not shadow X');
  assert.equal(r.rearBounce,true,'puck must reflect off actual rear band');
  assert.equal(r.m.scores[0],0,'AI must not shoot the puck into its own goal');
});

test('AI recovers a horizontally moving puck that passed behind the paddle',()=>{
  const r=simulateBehind({x:2,z:3.7,vx:-2.1,vz:0,aiZ:2.55},3.5);
  assert.ok(r.impacts.length>0,'behind horizontal puck was ignored');
  assert.ok(r.impacts[0].time<2.5,'rear recovery took too long');
});

test('AI never chooses a rear-band drive directly through its open goal',()=>{
  const m=new Match();m.serve();
  Object.assign(m.ai,{x:0,z:2.3,vx:0,vz:0});
  const goalPuck={x:0,z:3.8,vx:0,vz:0,spin:0};
  const brain=createAIBrain();
  const target=chooseAITarget(goalPuck,m.ai,m.player,DEFAULTS,brain,0);
  assert.equal(brain.phase,'rearSideStage');
  assert.equal(brain.rearMode,'side');
  assert.notEqual(brain.phase,'rearDrive');
  const r=simulateBehind({x:0,z:3.8,vx:0,vz:0,aiZ:2.3},2.5);
  assert.ok(r.impacts.length>0,'central behind puck was not played');
  assert.equal(r.m.scores[0],0,'AI must not score against itself');
});

test('end zone puck can still be recovered without teleportation',()=>{
  for(const x of [-2,0,2]){
    const r=simulateBehind({x,z:4.6,vx:0,vz:0,aiZ:3.8},3);
    assert.ok(r.impacts.length>0,`never recovered rear puck at x=${x}`);
    assert.ok(Math.hypot(r.m.ai.vx,r.m.ai.vz)<=DEFAULTS.aiSpeed+1e-7);
  }
});
