import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const access=process.env.SYNTHPUCK_RELAY_ACCESS;
if(!access)throw Error('Set SYNTHPUCK_RELAY_ACCESS for this private integration test.');
const endpoint='https://synthpuck-turn.acidcitriik.workers.dev/';
const headers={Origin:'https://acidcitriik.github.io','X-Synthpuck-Access':access,'Content-Type':'application/json'};
const denied=await fetch(endpoint,{method:'POST',headers:{...headers,'X-Synthpuck-Access':'incorrect'},body:'{}'});
assert.equal(denied.status,401,'wrong access code must be rejected');
const response=await fetch(endpoint,{method:'POST',headers,body:'{}'});
assert.equal(response.status,200);const config=await response.json();
assert.ok(config.iceServers.some(s=>[s.urls].flat().includes('turns:turn.cloudflare.com:443?transport=tcp')));
config.iceServers=config.iceServers.filter(s=>s.username&&s.credential).map(s=>({...s,urls:['turns:turn.cloudflare.com:443?transport=tcp']}));
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
  const context=await browser.newContext();
  // Keep the app local while exercising real Cloudflare TURN and PeerJS.
  await context.route(endpoint,async route=>route.fulfill({status:200,headers:{'Access-Control-Allow-Origin':'*','Content-Type':'application/json'},body:JSON.stringify(config)}));
  const source=await readFile('src/ice-config.js','utf8');
  await context.route('**/src/ice-config.js',route=>route.fulfill({contentType:'text/javascript',body:source.replaceAll("iceTransportPolicy:'all'","iceTransportPolicy:'relay'")}));
  const a=await context.newPage(),b=await context.newPage(),errors=[];
  for(const page of [a,b]){
    page.on('pageerror',e=>errors.push(e.message));await page.goto('http://localhost:3000');
    await page.locator('#panel').click();await page.getByRole('button',{name:'MULTIJOUEUR',exact:true}).click();
    await page.locator('#relayAccess').fill(access);
  }
  await a.getByRole('button',{name:'CRÉER UNE PARTIE',exact:true}).click();
  await a.waitForFunction(()=>document.querySelector('#lobbyStatus')?.textContent.includes('Code :'));
  const code=(await a.locator('#lobbyStatus').textContent()).match(/Code : (\S+)/)[1];
  await b.locator('#roomCode').fill(code);await b.getByRole('button',{name:'REJOINDRE',exact:true}).click();
  for(const page of [a,b]){
    await page.waitForFunction(()=>window.__synthpuck.snapshot().screen==='playing',{timeout:35000});
    await page.waitForFunction(()=>document.querySelector('#connectionLog')?.textContent.includes('"local":"relay"'));
  }
  assert.deepEqual(errors,[]);console.log('PASS: Worker authentication, temporary credentials, TLS/443 fallback and two-player match with forced TURN relay.');
}finally{await browser.close();}
