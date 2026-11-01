import test from 'node:test';
import assert from 'node:assert/strict';
import {Match} from '../src/physics.js';
import {createAIBrain,chooseAITarget} from '../src/ai.js';
import {chooseCharacterAITarget} from '../src/ai-profiles.js';
import {getCharacter,matchConfiguration} from '../src/roster.js';

function advance(m, seconds) {
  for (let i=0;i<Math.ceil(seconds/m.cfg.tick) && m.state==='playing';i++) m.tick();
}

test('opening round: neutral stationary puck, no 10-second service penalty',()=>{
  const m=new Match({aiSpeed:0});m.serve();
  assert.equal(m.server,0);
  assert.deepEqual([m.puck.x,m.puck.z,m.puck.vx,m.puck.vz],[0,0,0,0]);
  advance(m,12);
  assert.equal(m.state,'playing');
  assert.equal(m.awaitingServe,true);
  assert.equal(m.events.some(e=>e.type==='timeout'),false);
});

test('centre opening can be won by either actual paddle without a scripted impulse',()=>{
  const human=new Match({aiSpeed:0});human.serve();human.target.z=-.22;
  advance(human,1);
  assert.ok(human.events.some(e=>e.type==='serve'&&e.by==='player'));
  const mute=new Match(matchConfiguration(getCharacter('mute')));mute.serve();
  advance(mute,5);
  assert.ok(mute.events.some(e=>e.type==='serve'&&e.by==='ai'),'Mute must physically reach the neutral puck');
});

test('missing the 10-second post-goal serve changes server with no extra point',()=>{
  const m=new Match();m.serve();
  Object.assign(m.puck,{x:0,z:4.81,vx:0,vz:10});
  advance(m,.1);
  assert.equal(m.state,'ready');
  assert.deepEqual(m.scores,[1,0]);
  assert.equal(m.server,1);
  m.serve();m.cfg.aiSpeed=0;
  advance(m,10.1);
  assert.equal(m.state,'ready');
  assert.equal(m.server,-1);
  assert.deepEqual(m.scores,[1,0]);
  assert.ok(m.events.some(e=>e.type==='timeout'&&e.reason==='serve'&&e.offender===1));
});

test('a legal service before 10 seconds starts the rally',()=>{
  const m=new Match();m.server=-1;m.serve();m.target.z=-2.35;
  advance(m,.5);
  assert.equal(m.awaitingServe,false);
  assert.equal(m.state,'playing');
  assert.ok(m.events.some(e=>e.type==='serve'&&e.by==='player'));
});

test('the human fails to return after 7 seconds: AI serves without scoring',()=>{
  const m=new Match({aiSpeed:0});m.serve();m.awaitingServe=false;
  Object.assign(m.puck,{x:0,z:-2,vx:0,vz:0});
  advance(m,7.2);
  assert.equal(m.state,'ready');assert.equal(m.server,1);
  assert.deepEqual(m.scores,[0,0]);
  assert.ok(m.events.some(e=>e.type==='timeout'&&e.reason==='return'&&e.offender===-1));
});

test('the AI fails to return after 7 seconds: human serves without scoring',()=>{
  const m=new Match({aiSpeed:0});m.serve();m.awaitingServe=false;
  Object.assign(m.puck,{x:0,z:2,vx:0,vz:0});
  advance(m,7.2);
  assert.equal(m.state,'ready');assert.equal(m.server,-1);
  assert.deepEqual(m.scores,[0,0]);
});

test('centre crossing resets the 7-second clock, repeated movement within one half cannot',()=>{
  const m=new Match({aiSpeed:0});m.serve();m.awaitingServe=false;
  Object.assign(m.puck,{x:0,z:-2,vx:0,vz:0});
  advance(m,6.1);
  assert.equal(m.state,'playing');
  Object.assign(m.puck,{z:2,vx:0,vz:0});
  advance(m,1.2);
  assert.equal(m.state,'playing');assert.equal(m.possessionSide,1);
  advance(m,6.1);
  assert.equal(m.state,'ready');assert.equal(m.server,-1);
});

test('Mute pursues a horizontal puck close to the midline',()=>{
  const m=new Match(matchConfiguration(getCharacter('mute')));
  const puck={x:1.4,z:.08,vx:.5,vz:0,spin:0};
  const target=chooseCharacterAITarget(puck,m.ai,m.player,m.cfg,createAIBrain(),1);
  const normal=chooseAITarget(puck,m.ai,m.player,m.cfg,createAIBrain(),1);
  assert.ok(target.z<1,'Mute must not wait by her goal');
  assert.ok(target.z<=normal.z+.01);
});

test('Chonk preserves rear-side staging, freeing a puck trapped near a corner',()=>{
  const m=new Match(matchConfiguration(getCharacter('chonk')));
  const puck={x:0,z:3.8,vx:0,vz:0,spin:0};
  const brain=createAIBrain();
  const target=chooseCharacterAITarget(puck,{...m.ai,z:2.3},m.player,m.cfg,brain,0);
  assert.equal(brain.phase,'rearSideStage');
  assert.ok(target.z<puck.z,'Chonk must reach the flank before sweeping');
  assert.notEqual(target.x,puck.x);
});
