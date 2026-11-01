import test from 'node:test';
import assert from 'node:assert/strict';
import { Match, DEFAULTS } from '../src/physics.js';
import { chooseAITarget, createAIBrain } from '../src/ai.js';

function scenario(puck, seconds=8) {
  const match=new Match({ scoreToWin:99 });
  match.serve();
  match.awaitingServe=false; // direct in-play scenario, not an opening faceoff
  Object.assign(match.puck,puck);
  const impacts=[],rails=[];
  let prevVx=match.puck.vx;
  for(let i=0;i<Math.ceil(seconds/match.cfg.tick) && match.state==='playing';i++){
    match.tick();
    if(prevVx * match.puck.vx < -0.25 && Math.abs(match.puck.x) > match.cfg.width/2-match.cfg.puckRadius-.12)
      rails.push({ time: match.time, z:match.puck.z });
    prevVx=match.puck.vx;
    for(const e of match.events)if(e.type==='impact' && e.by==='ai')
      impacts.push({ time:e.time,z:match.puck.z, vx:match.puck.vx,vz:match.puck.vz });
    match.events.length=0;
  }
  return {match,impacts,rails};
}

test('a fully stationary puck anywhere in the accessible AI half is actively touched',()=>{
  // This includes a nearly unreachable puck near the goal rail.
  for(const z of [0.4,1.0,2.0,3.3,4.3,4.6])
    for(const x of [-2.55,-1.2,0,1.2,2.55]) {
      const r=scenario({x,z,vx:0,vz:0},5);
      assert.ok(r.impacts.length > 0,
        `stalled puck x=${x} z=${z}; no AI hit within five seconds`);
    }
});
test('AI attacks a fast purely horizontal puck instead of waiting for a positive Z velocity',()=>{
  const r=scenario({x:-1.8,z:2,vx:6,vz:0},2.5);
  assert.ok(r.impacts.some(h=>h.time<1.5),'no early interception of a horizontal puck');
});
test('AI also recovers a slow horizontal puck that would eventually stop',()=>{
  const r=scenario({x:0.3,z:2.1,vx:0.32,vz:0},3);
  assert.ok(r.impacts.length>0, 'nearly stopped horizontal puck was ignored');
});
test('staged bank shot can bounce in the AI half and be followed by a second strike',()=>{
  const r=scenario({x:0,z:2,vx:0,vz:0},4);
  assert.ok(r.impacts.length>=2,'AI must not give up after one touch');
  const first=r.impacts[0],second=r.impacts.find(h=>h.time>first.time+.05);
  assert.ok(second,'no separate second touch');
  assert.ok(Math.abs(first.vx)>Math.abs(first.vz),
    'first touch should be a deliberate lateral/rail-directed strike');
  assert.ok(r.rails.some(b=>b.time>first.time && b.time<second.time && b.z>.2),
    'puck must reach a side rail on the AI half before the follow-up');
  assert.ok(second.z>.2,'second contact should occur before puck leaves AI half');
  assert.ok(second.vz < -2,'follow-up should be a direct return towards the player');
});
test('AI motor speed stays within physical limit while attempting multi-touch play',()=>{
  const m=new Match();m.serve();m.awaitingServe=false;Object.assign(m.puck,{x:0,z:2,vx:0,vz:0});
  for(let i=0;i<1200&&m.state==='playing';i++) {
    m.tick();
    assert.ok(Math.hypot(m.ai.vx,m.ai.vz)<=m.cfg.aiSpeed+1e-7);
    assert.ok(Number.isFinite(m.puck.spin));
  }
});
test('AI possession planning remains deterministic across runs',()=>{
  const x=new Match(),y=new Match();
  x.serve();y.serve();
  for(const m of [x,y]){m.awaitingServe=false;Object.assign(m.puck,{x:0,z:2,vx:0,vz:0});}
  for(let i=0;i<320;i++){ x.tick();y.tick(); }
  assert.deepEqual(x.aiBrain,y.aiBrain);
  assert.deepEqual(x.puck,y.puck);
  assert.deepEqual(x.ai,y.ai);
});
test('the AI can return to defence once the puck has left its half',()=>{
  const m=new Match(); m.serve();
  Object.assign(m.puck,{x:0,z:-2,vx:0,vz:-5});
  const target=chooseAITarget(m.puck,m.ai,m.player,DEFAULTS,createAIBrain(),m.time);
  assert.ok(target.z>3.2);
});
