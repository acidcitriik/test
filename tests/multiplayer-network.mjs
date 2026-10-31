import {WebSocket} from 'ws';
import assert from 'node:assert/strict';
const a=new WebSocket('ws://localhost:3000'),b=new WebSocket('ws://localhost:3000'),c=new WebSocket('ws://localhost:3000');
const wait=(w,type)=>new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Timeout '+type)),4000);function f(raw){const d=JSON.parse(raw);if(d.type===type){clearTimeout(t);w.off('message',f);resolve(d);}}w.on('message',f);});
try{
await Promise.all([a,b,c].map(w=>new Promise(r=>w.on('open',r))));
let p=wait(a,'lobby');a.send(JSON.stringify({type:'create'}));const {code}=await p;
const starts=Promise.all([wait(a,'start'),wait(b,'start')]);b.send(JSON.stringify({type:'join',code}));const slots=await starts;assert.deepEqual(slots.map(x=>x.slot),[0,1]);
p=wait(c,'error');c.send(JSON.stringify({type:'join',code}));await p;
b.send(JSON.stringify({type:'input',x:1,z:-3,left:true}));
let state;for(let i=0;i<4;i++){state=await wait(a,'state');if(state.ai.x===-1)break;}assert.equal(state.ai.x,-1);assert.equal(state.ai.z,3);
p=wait(a,'left');b.close();await p;
assert.equal((await fetch('http://localhost:3000/')).status,200);assert.equal((await fetch('http://localhost:3000/package.json')).status,404);
console.log('PASS: create, join, full room rejection, second player movement, disconnect, HTTP');
}finally{a.close();b.close();c.close();}
