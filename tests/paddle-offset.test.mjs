import test from 'node:test';
import assert from 'node:assert/strict';
import {
 DEFAULT_PADDLE_OFFSETS,OFFSET_MIN,OFFSET_MAX,
 normalizePaddleOffset,offsetSpriteY
} from '../src/paddle-offset.js';

test('paddle pixel shifts move paintings downward exactly with viewport scale',()=>{
 for(const scale of [.4,.6,1,1.5,2]){
  for(const type of ['player','ai']){
   const shifts={player:27,ai:11},origin=432.25;
   assert.equal(offsetSpriteY(origin,type,scale,shifts),origin+shifts[type]*scale);
   assert.equal(offsetSpriteY(origin,'puck',scale,shifts),origin,
    'puck must not move when paddle calibration changes');
  }
 }
});
test('user-defined signed offsets are integers with explicit safe limits',()=>{
 assert.equal(normalizePaddleOffset('23'),23);
 assert.equal(normalizePaddleOffset('-13.6'),-14);
 assert.equal(normalizePaddleOffset('500'),OFFSET_MAX);
 assert.equal(normalizePaddleOffset('-500'),OFFSET_MIN);
 assert.equal(normalizePaddleOffset('not a number',17),17);
 assert.equal(DEFAULT_PADDLE_OFFSETS.player,12);
 assert.equal(DEFAULT_PADDLE_OFFSETS.ai,12);
});
test('paddle correction never mutates the physical input position or the reference point',()=>{
 const offsets={player:12,ai:24};
 const p={x:100,y:240},frozen={...p};
 offsetSpriteY(p.y,'player',.5,offsets);
 assert.deepEqual(p,frozen);
 assert.deepEqual(offsets,{player:12,ai:24});
});
