import assert from 'node:assert/strict';
import test from 'node:test';
import {ROSTER,matchConfiguration,STAT_NAMES} from '../src/roster.js';
import {ARCADE_ORDER,nextArcadeLevel,stageIdFor} from '../src/campaign.js';
import {chooseCharacterAITarget} from '../src/ai-profiles.js';
import {Match} from '../src/physics.js';

const expected=['mute','chonk','simous','mamouda','diamond','stal','2502'];
test('arcade sequence and win/loss transitions cover exactly seven opponents',()=>{
 assert.deepEqual(ARCADE_ORDER,expected);
 assert.equal(ROSTER.length,7);
 assert.deepEqual(ROSTER.map(c=>c.arena),['USS SULACO','INFERNO','SALOON 1885','CAPSULE BAR','FHLOSTON PARADISE','NEBUCHADNEZZAR','SECTION 9 · 九課']);
 for(let i=0;i<7;i++){
  assert.deepEqual(nextArcadeLevel(i,false),{type:'retry',index:i});
  const next=nextArcadeLevel(i,true);
  if(i<6){assert.equal(next.type,'next');assert.equal(next.id,expected[i+1]);assert.equal(next.index,i+1);}
  else assert.equal(next.type,'complete');
 }
});
test('each character has four defined 5-step stat bars and unique personality',()=>{
 assert.equal(STAT_NAMES.length,4);
 assert.equal(new Set(ROSTER.map(c=>c.style)).size,7);
 ROSTER.forEach(c=>{
  assert.deepEqual(c.stats.length,4);
  c.stats.forEach(value=>assert.ok(Number.isInteger(value)&&value>=0&&value<=5));
  const cfg=matchConfiguration(c);
  assert.equal(cfg.aiStyle,c.style);
  assert.equal(cfg.scoreToWin,7);
  assert.ok(new Match(cfg).cfg.aiSpeed===c.aiSpeed);
 });
});
test('difficulty increases monotonically; training always uses GRID 00',()=>{
 for(let i=1;i<7;i++){
  assert.ok(ROSTER[i].aiSpeed>ROSTER[i-1].aiSpeed);
  assert.ok(ROSTER[i].aiAcceleration>ROSTER[i-1].aiAcceleration);
 }
 ROSTER.forEach(c=>{
  assert.equal(stageIdFor('training',c.id),'training');
  assert.equal(stageIdFor('arcade',c.id),c.id);
 });
});
test('character-specific targets stay on the proper half with no teleporting or puck injection',()=>{
 const puck={x:.6,z:1.8,vx:.12,vz:.18}, ai={x:0,z:3.4,vx:0,vz:0}, player={x:.2,z:-3.6};
 for(const c of ROSTER){
  const cfg=new Match(matchConfiguration(c)).cfg;
  const result=chooseCharacterAITarget({...puck},{...ai},{...player},cfg,null,2.2);
  assert.ok(result.x>=-cfg.width/2&&result.x<=cfg.width/2,c.id);
  assert.ok(result.z>0&&result.z<=cfg.length/2,c.id);
  assert.equal(puck.x,.6);assert.equal(puck.z,1.8);
 }
});
// Horizontal puck on the AI half must be actively intercepted, even with vz=0.
test('AI leads a horizontal puck instead of abandoning the rally',()=>{
 const cfg=new Match(matchConfiguration(ROSTER[0])).cfg;
 const brain={phase:'defend',phaseAt:0,lastImpact:-Infinity,possessionHits:0,bankAttempts:0,lastBankAt:-Infinity,bankSide:1,lastPuckOnAIHalf:true};
 const puck={x:-1.3,z:2.4,vx:2.3,vz:0,spin:0};
 const ai={x:0,z:3.8,vx:0,vz:0,side:1};
 const target=chooseCharacterAITarget(puck,ai,{x:0,z:-3.8},cfg,brain,1);
 assert.equal(brain.phase,'collect');
 assert.ok(target.z>puck.z && target.z<puck.z+.6,'AI positions on goal-side of sideways puck');
 assert.ok(target.x>puck.x,'AI leads the sideways puck rather than chasing its present position');
});
