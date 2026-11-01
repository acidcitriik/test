import test from 'node:test';
import assert from 'node:assert/strict';
import {Match} from '../src/physics.js';
import {
 randomReadyDelayMs,chooseRoundSplash,SPLASH_FILES,
 GO_DURATION_MS,GOAL_DURATION_MS,RESULT_DURATION_MS
} from '../src/round-presentation.js';

test('opening announcement delay is randomized only between 1 and 4 seconds',()=>{
 assert.equal(randomReadyDelayMs(()=>0),1000);
 assert.equal(randomReadyDelayMs(()=>.5),2500);
 assert.equal(randomReadyDelayMs(()=>.9999),4000);
 assert.equal(randomReadyDelayMs(()=>1),4000);
 assert.equal(randomReadyDelayMs(()=>-1),1000);
 assert.ok(GO_DURATION_MS>0&&GOAL_DURATION_MS>0&&RESULT_DURATION_MS>0);
});
test('the correct splash has precedence on goal, smash and seventh score',()=>{
 const goal={type:'goal',scorer:0,smash:false};
 const smash={...goal,smash:true};
 assert.equal(chooseRoundSplash(goal,[1,0]),'goal');
 assert.equal(chooseRoundSplash(smash,[2,1]),'smash');
 assert.equal(chooseRoundSplash(smash,[7,4]),'win');
 assert.equal(chooseRoundSplash(goal,[4,7]),'lose');
 assert.equal(chooseRoundSplash({type:'timeout',reason:'return'},[0,0]),null);
 assert.deepEqual(Object.keys(SPLASH_FILES).sort(),['ready','go','goal','smash','win','lose'].sort());
});
test('goal event remembers smash at moment of scoring before new serve resets it',()=>{
 const match=new Match({aiSpeed:0});match.serve();
 match.awaitingServe=false;
 Object.assign(match.puck,{x:0,z:4.88,vx:0,vz:27,smashActive:true});
 for(let n=0;n<15&&match.state==='playing';n++)match.tick();
 const goal=match.events.findLast(event=>event.type==='goal');
 assert.ok(goal,'A fast puck crossing the far goal should score');
 assert.equal(goal.scorer,0);
 assert.equal(goal.smash,true);
 assert.equal(chooseRoundSplash(goal,match.scores),'smash');
 const score=[...match.scores];
 match.serve();
 assert.deepEqual(match.scores,score,'Auto-engagement must not affect score');
 assert.equal(match.puck.smashActive,false,'A new puck starts in normal mode');
 assert.equal(match.state,'playing');
});
test('seventh goal is terminal and uses result splash instead of GOAL or SMASH',()=>{
 for(const scorer of [0,1]){
  const match=new Match({aiSpeed:0});match.serve();match.awaitingServe=false;
  match.scores[scorer]=6;
  Object.assign(match.puck,{x:0,z:scorer===0?4.88:-4.88,vx:0,vz:scorer===0?28:-28,smashActive:true});
  for(let n=0;n<15&&match.state==='playing';n++)match.tick();
  const goal=match.events.findLast(event=>event.type==='goal');
  assert.ok(goal,'Goal scored');
  assert.equal(goal.smash,true);
  assert.equal(match.state,'over');
  assert.equal(chooseRoundSplash(goal,match.scores),scorer===0?'win':'lose');
 }
});
