import test from 'node:test';
import assert from 'node:assert/strict';
import {TABLE_CALIBRATION,solveHomography,createTableProjection} from '../src/table-projection.js';
import {Match} from '../src/physics.js';

const close=(actual,expected,label,tolerance=1e-6)=>{
 assert.ok(Math.abs(actual-expected)<=tolerance,
  label+': expected '+expected+', got '+actual);
};
const projection=createTableProjection(5.8,10);
const project=projection.project;
const corners=[
  [2.9,5,640,405],[-2.9,5,1032,405],
  [2.9,0,475,554],[-2.9,0,1201,554],
  [2.9,-5,200,816],[-2.9,-5,1475,816]
];

test('four measured artwork corners map onto original HAL table',()=>{
 for(const [x,z,px,py] of corners.filter(c=>c[1]!==0)){
  const p=project(x,z);close(p.x,px,'corner X');close(p.y,py,'corner Y');
 }
});
test('artistic centre line matches as well without moving either end',()=>{
 for(const [x,z,px,py] of corners.filter(c=>c[1]===0)){
  const p=project(x,z);close(p.x,px,'centre X');close(p.y,py,'centre Y');
 }
 close(project(0,0).y,TABLE_CALIBRATION.center.y,'centre puck Y');
});
test('homography is a genuine projective matrix, not a 3-line polynomial',()=>{
 assert.equal(projection.matrix.length,9);
 close(projection.matrix[8],1,'normalized H33');
 const h=solveHomography(
   [[0,0],[1,0],[1,1],[0,1]],
   [[0,0],[2,0],[2,2],[0,2]]);
 close(h[0],2,'H11');close(h[4],2,'H22');
 assert.ok(projection.centreVirtualZ<0,'source art requires longitudinal correction');
});
test('projected table rails are continuous, centred, and never cross',()=>{
 let lastY=-Infinity,prevWidth=0;
 for(let z=5;z>=-5;z-=.025){
  const a=project(2.9,z),b=project(-2.9,z),c=project(0,z);
  assert.ok(a.x<b.x,'left rail must stay to left of right rail');
  assert.ok(a.x<c.x&&c.x<b.x,'centered puck must stay between rails');
  assert.ok(Math.abs(a.y-b.y)<1e-5,'both rails must be level');
  assert.ok(a.y>lastY,'projected depth must grow towards camera');
  if(prevWidth)assert.ok(b.x-a.x>=prevWidth-.03,'projected width must grow towards camera');
  lastY=a.y;prevWidth=b.x-a.x;
 }
});
test('local radii remain nonzero and increase toward the player',()=>{
 const near=project(.37,-3.5).x-project(-.37,-3.5).x;
 const far=project(.37,3.5).x-project(-.37,3.5).x;
 assert.ok(Math.abs(near)>Math.abs(far)*1.4);
});
test('projection never changes the simulated table or sprite physics',()=>{
 const before=new Match();
 const cfg={...before.cfg},puck={...before.puck};
 createTableProjection(before.cfg.width,before.cfg.length).project(0,0);
 assert.deepEqual(before.cfg,cfg);assert.deepEqual(before.puck,puck);
});
