import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseAITarget, predictRailX} from '../src/ai.js';
import {Match, DEFAULTS} from '../src/physics.js';

const cfg = {...DEFAULTS}, player = {x:0,z:-3.8,vx:0,vz:0,side:-1};
const ai = {x:0,z:3.8,vx:0,vz:0,side:1};
test('AI advances toward an accessible slow puck instead of sliding sideways only',()=>{
  const aim=chooseAITarget({x:.7,z:1.2,vx:0,vz:-.8,spin:0},ai,player,cfg);
  assert.ok(aim.z<2.0, 'AI should advance from home to strike');
});
test('AI recovers toward its goal when the puck leaves its half',()=>{
  const aim=chooseAITarget({x:.1,z:-2,vx:1,vz:-4,spin:0}, {...ai,z:1.1},player,cfg);
  assert.ok(aim.z>3.3, 'AI should retreat from centre');
});
test('AI anticipates a bank shot on the side rail',()=>{
  const puck={x:2.5,z:0,vx:3,vz:2,spin:0};
  const projected=predictRailX(puck, .5, cfg);
  assert.ok(projected<2.5,'projected puck must reflect from the right rail');
  const target=chooseAITarget(puck,ai,player,cfg);
  assert.ok(Number.isFinite(target.x) && Number.isFinite(target.z));
});
test('AI target is physically attainable inside its half',()=>{
  for(let x=-6;x<=6;x+=.5)for(let z=-6;z<=6;z+=1){
    const aim=chooseAITarget({x,z,vx:x*.2,vz:z*.3,spin:0},ai,player,cfg);
    assert.ok(aim.x>=-cfg.width/2 && aim.x<=cfg.width/2);
    assert.ok(aim.z>0 && aim.z<cfg.length/2);
  }
});
test('actual AI paddle moves forward, backward and strikes puck',()=>{
  const m=new Match();m.serve();
  // This test measures a live exchange, not the new stationary player serve.
  Object.assign(m.puck,{x:0,z:0,vx:0,vz:4});m.awaitingServe=false;
  let smallest=m.ai.z, largest=m.ai.z, minVz=0,maxVz=0, aiHits=0, prevHits=0;
  for(let i=0;i<1800 && m.state==='playing';i++){
    m.target.z=-3.7;
    m.tick();
    smallest=Math.min(smallest,m.ai.z);largest=Math.max(largest,m.ai.z);
    minVz=Math.min(minVz,m.ai.vz);maxVz=Math.max(maxVz,m.ai.vz);
    aiHits+=m.events.filter(e=>e.type==='impact'&&e.by==='ai').length;
    m.events.length=0;
  }
  assert.ok(largest-smallest>1.0,'AI must significantly travel along Z');
  assert.ok(minVz<-1,'AI must be able to move forward');
  assert.ok(maxVz>1,'AI must be able to retreat');
  assert.ok(aiHits>=1,'AI must physically hit the puck');
});
test('AI decisions are deterministic with identical starting states',()=>{
  const a=new Match(),b=new Match();a.serve();b.serve();
  for(let i=0;i<240;i++){a.tick();b.tick();}
  assert.deepEqual(a.ai,b.ai);
  assert.deepEqual(a.puck,b.puck);
});
