import test from 'node:test';
import assert from 'node:assert/strict';
import {Match, DEFAULTS, moveToward, collidePaddle, collideWalls} from '../src/physics.js';

test('paddle obeys vector speed limit',()=>{
 const cfg={...DEFAULTS};const p={x:0,z:-3,vx:0,vz:0,side:-1};
 for(let i=0;i<100;i++){moveToward(p,{x:2,z:-1},cfg.tick,cfg);assert.ok(Math.hypot(p.vx,p.vz)<=cfg.maxSpeed+1e-9);}
});
test('paddle stays on its own half of table',()=>{
 const cfg={...DEFAULTS};const p={x:0,z:-3,vx:0,vz:0,side:-1};
 for(let i=0;i<500;i++)moveToward(p,{x:100,z:100},cfg.tick,cfg);
 assert.ok(p.x<=cfg.width/2-cfg.paddleRadius);assert.ok(p.z<0);
});
test('normal collision sends puck away from incoming paddle',()=>{
 const cfg={...DEFAULTS};
 const puck={x:0,z:.4,vx:0,vz:-1,spin:0},pad={x:0,z:0,vx:0,vz:2,side:-1};
 const hit=collidePaddle(puck,pad,cfg);
 assert.equal(hit,true);assert.ok(puck.vz>0);
});
test('off-axis friction generates spin',()=>{
 const cfg={...DEFAULTS};
 const puck={x:.2,z:.4,vx:0,vz:-1,spin:0},pad={x:0,z:0,vx:2,vz:2,side:-1};
 collidePaddle(puck,pad,cfg,'grip');assert.ok(Math.abs(puck.spin)>0.01);
});
test('side walls reflect the puck',()=>{
 const cfg={...DEFAULTS},p={x:cfg.width/2,z:0,vx:3,vz:0,spin:0};
 assert.equal(collideWalls(p,cfg),0);assert.ok(p.vx<0);
});
test('the open goal returns scorer',()=>{
 const cfg={...DEFAULTS},p={x:0,z:cfg.length/2+1,vx:0,vz:4,spin:0};
 assert.equal(collideWalls(p,cfg),-1);
});
test('match scores and stops at point limit',()=>{
 const m=new Match({scoreToWin:1});m.serve();
 m.puck.z=m.cfg.length/2-.02;m.puck.vz=18;m.puck.x=0;
 for(let i=0;i<20&&m.state==='playing';i++)m.tick();
 assert.equal(m.scores[0],1);assert.equal(m.state,'over');
});
test('same initial state and inputs produce identical state on one runtime',()=>{
 const a=new Match(),b=new Match();a.serve();b.serve();
 for(let i=0;i<250;i++){a.target.x=b.target.x=Math.sin(i/30);a.tick();b.tick();}
 assert.deepEqual(a.scores,b.scores);
 for(const key of ['x','z','vx','vz','spin'])assert.equal(a.puck[key],b.puck[key]);
});
