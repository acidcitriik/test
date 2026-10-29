import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';
const root=resolve(import.meta.dirname,'..');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
 try{const p=new URL(req.url,'http://localhost').pathname;
  const f=resolve(root,'.'+(p==='/'?'/index.html':p));if(!f.startsWith(root+sep))throw Error('Forbidden');
  const bytes=await readFile(f);res.writeHead(200,{'Content-Type':types[extname(f)]||'application/octet-stream'});res.end(bytes);
 }catch(err){res.writeHead(404);res.end(String(err.message));}
});
let browser;
try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1672,height:941}});
 const errors=[],badAssets=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400&&r.url().includes('127.0.0.1'))badAssets.push(r.url());});
 const base=`http://127.0.0.1:${server.address().port}/`;
 const splash=await browser.newPage({viewport:{width:1280,height:720}});
 await splash.goto(base,{waitUntil:'domcontentloaded'});
 await splash.waitForFunction(()=>window.__synthpuck?.snapshot().screen==='splash');
 assert.equal(await splash.locator('svg.logo').count(),1);
 await splash.screenshot({path:'synthpuck-studio-preview.png'});
 await splash.waitForFunction(()=>window.__synthpuck?.snapshot().screen==='menu',{timeout:7000});
 await splash.close();
 await page.goto(base+'?skipSplash=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__synthpuck?.snapshot().screen==='menu');
 assert.equal(await page.title(),'SYNTHPUCK — PiperadeGames');
 await page.screenshot({path:'synthpuck-title-preview.png'});
 assert.equal(await page.locator('.menu button').count(),4);
 assert.equal(await page.getByRole('button',{name:/OPTIONS/}).isDisabled(),true);
 assert.equal(await page.getByRole('button',{name:/EXIT/}).isDisabled(),true);
 await page.getByRole('button',{name:'ARCADE'}).click();
 assert.equal((await page.evaluate(()=>__synthpuck.snapshot())).opponent,'mute');
 assert.equal(await page.locator('.stat-line').count(),4);
 await page.getByRole('button',{name:'LANCER LE DUEL'}).click();
 await page.waitForFunction(()=>__synthpuck.snapshot().ready);
 await page.waitForFunction(()=>__synthpuck.snapshot().screen==='playing');
 const first=await page.evaluate(()=>__synthpuck.snapshot());
 assert.equal(first.stage,'mute');assert.equal(first.mode,'arcade');
 assert.equal(first.state,'playing');assert.equal(first.aiStyle,'guard');
 const scoreBox=await page.locator('#score').boundingBox();
 assert.ok(scoreBox.width>150&&scoreBox.height<120,
   `HUD scoreboard must remain on one horizontal row: ${JSON.stringify(scoreBox)}`);
 const geometry=await page.evaluate(()=>({left:__synthpuck.project(1,0),right:__synthpuck.project(-1,0),radius:__synthpuck.projectedRadius(0,0,.37)}));
 assert.ok(geometry.left.x<geometry.right.x,'right is negative engine X');
 assert.ok(geometry.radius.rx>20,'paddles must be visible');
 await page.screenshot({path:'synthpuck-arcade-preview.png'});
 await page.keyboard.press('Escape');
  await page.waitForFunction(()=>__synthpuck.snapshot().screen==='pause');
 assert.equal((await page.evaluate(()=>__synthpuck.snapshot())).screen,'pause');
 await page.getByRole('button',{name:'RETOUR AU MENU'}).click();
 assert.equal(await page.locator('#fighterName').isHidden(),true,'No character name over menus');
 await page.getByRole('button',{name:'ENTRAÎNEMENT'}).click();
 assert.equal(await page.locator('.roster-card').count(),7);
 await page.screenshot({path:'synthpuck-character-select-preview.png'});
 for(const id of ['mute','chonk','simous','mamouda','diamond','stal','2502']){
  await page.locator(`[data-character="${id}"]`).click();
  assert.equal(await page.locator('.roster-card.selected').getAttribute('data-character'),id);
  assert.equal(await page.locator('.stat-line').count(),4);
  await page.getByRole('button',{name:'COMMENCER L’ENTRAÎNEMENT'}).click();
  await page.waitForFunction(()=>__synthpuck.snapshot().ready);
  const snap=await page.evaluate(()=>__synthpuck.snapshot());
  assert.equal(snap.mode,'training');assert.equal(snap.stage,'training');
  assert.equal(snap.opponent,id);assert.equal(snap.state,'playing');
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>__synthpuck.snapshot().screen==='pause');
  await page.getByRole('button',{name:'RETOUR AU MENU'}).click();
  await page.getByRole('button',{name:'ENTRAÎNEMENT'}).click();
 }
 await page.locator('[data-character="2502"]').click();
 await page.getByRole('button',{name:'COMMENCER L’ENTRAÎNEMENT'}).click();
 await page.waitForFunction(()=>__synthpuck.snapshot().ready);
 await page.screenshot({path:'synthpuck-training-preview.png'});
 // Verify that the complete table is visible on phones and wide screens;
 // the same world-to-stage projection must be used for all eight arenas.
 for(const viewport of [{width:390,height:844},{width:844,height:390},{width:1672,height:941}]){
  await page.setViewportSize(viewport);
  const points=await page.evaluate(()=>[
   __synthpuck.project(-2.9,-5),__synthpuck.project(2.9,-5),
   __synthpuck.project(-2.9,5),__synthpuck.project(2.9,5)
  ]);
  assert.ok(points.every(p=>p.x>=0&&p.x<=viewport.width&&p.y>=0&&p.y<=viewport.height),
   `Table must be fully framed at ${viewport.width}x${viewport.height}: ${JSON.stringify(points)}`);
 }
 const assets=await page.evaluate(async()=>{
  const ids=['mute','chonk','simous','mamouda','diamond','stal','2502','training'];
  const load=src=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve([image.naturalWidth,image.naturalHeight]);image.onerror=reject;image.src=src;});
  return await Promise.all(ids.map(async id=>({id,dim:await load('./assets/stages/'+id+'.webp')})));
 });
 assert.ok(assets.every(a=>a.dim[0]===1672&&a.dim[1]===941),
  'Eight backgrounds share one calibrated 1672×941 geometry: '+JSON.stringify(assets));
 assert.deepEqual(errors,[],'No JS exceptions');
 assert.deepEqual(badAssets,[],'All assets must load');
 await page.close();
 console.log('SYNTHPUCK browser verified: logo/title/menu, 7 portraits/stats/AI, arcade, training, physics projection, pause, assets.');
} finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}