import assert from 'node:assert/strict';
import {lobbyMarkup,renderOnlineSections} from '../src/online-ui.js';

const label=(name,action)=>'<button data-action="'+action+'">'+name+'</button>';
const markup=lobbyMarkup(label);
for(const selector of ['id="onlinePlayers"','id="onlineInvites"','id="onlineOutgoing"','id="roomCode"'])
  assert.ok(markup.includes(selector),'Missing lobby component '+selector);
assert.ok(!markup.includes('relayAccess'),'TURN private code must never be requested');

const slots=Object.fromEntries(['onlinePlayers','onlineInvites','onlineOutgoing'].map(id=>[id,{innerHTML:''}]));
const before=globalThis.document;
globalThis.document={getElementById:id=>slots[id]||null};
try{
  renderOnlineSections({players:[],incoming:[],outgoing:[],message:''},false);
  assert.ok(slots.onlinePlayers.innerHTML.includes('SE CONNECTER'));
  const opponent='<img src=x onerror=alert(1)>';
  renderOnlineSections({
    players:[{user_id:'11111111-1111-1111-1111-111111111111',nickname:opponent,status:'available'},
      {user_id:'22222222-2222-2222-2222-222222222222',nickname:'Occupé',status:'busy'}],
    incoming:[{id:'33333333-3333-3333-3333-333333333333',sender_nickname:opponent}],
    outgoing:[{id:'4'}],message:''
  },true);
  assert.ok(slots.onlinePlayers.innerHTML.includes('&lt;img'));
  assert.ok(!slots.onlinePlayers.innerHTML.includes('<img'));
  assert.ok(slots.onlinePlayers.innerHTML.includes('EN PARTIE'));
  assert.ok(slots.onlinePlayers.innerHTML.includes('disabled'));
  assert.ok(slots.onlineInvites.innerHTML.includes('ACCEPTER'));
  assert.ok(slots.onlineInvites.innerHTML.includes('REFUSER'));
  assert.ok(slots.onlineOutgoing.innerHTML.includes('en attente'));
}finally{globalThis.document=before;}
console.log('Online lobby rendering, invitation controls and nickname HTML escaping verified.');
