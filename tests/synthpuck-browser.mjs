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
 assert.equal(await splash.locator('svg').count(),0,'No vector SVG on splash');
 assert.equal(await splash.locator('.studio-image').count(),1);
 await splash.locator('.studio-image').evaluate(img=>img.decode());
 assert.ok((await splash.locator('.studio-image').evaluate(img=>img.naturalWidth))>=600,'Raster studio image loads');
 await splash.screenshot({path:'synthpuck-studio-preview.png'});
 await splash.waitForFunction(()=>window.__synthpuck?.snapshot().screen==='menu',{timeout:7000});
 await splash.close();
 await page.goto(base+'?skipSplash=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__synthpuck?.snapshot().screen==='menu');
 assert.equal(await page.title(),'SYNTHPUCK — PiperadeGames');
 await page.waitForFunction(()=>document.documentElement.dataset.uiArt==='loaded');
 assert.equal(await page.locator('svg').count(),0,'No SVG in the active title screen');
 const menuBg=await page.locator('.menu-image').evaluate(el=>getComputedStyle(el).backgroundImage);
 assert.ok(menuBg.includes('menu-hud.avif'),'Title/menu uses raster atlas');
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
 assert.ok(scoreBox.width>105&&scoreBox.height<120,
   `HUD scoreboard must remain on one horizontal row: ${JSON.stringify(scoreBox)}`);
 const scoreFlow=await page.locator('#score').evaluate(el=>({display:getComputedStyle(el).display,content:el.innerText,spanTop:el.querySelector('span').getBoundingClientRect().top,parentTop:el.getBoundingClientRect().top,parentHeight:el.getBoundingClientRect().height}));
 assert.equal(scoreFlow.display,'flex','Scoreboard must not inherit grid layout');
 assert.ok(scoreFlow.spanTop>=scoreFlow.parentTop&&scoreFlow.spanTop<scoreFlow.parentTop+scoreFlow.parentHeight,'Colon stays inside HUD score plate');
 const painted=await page.evaluate(()=>{
  const selectors=['#score','.hud-left','.hud-right','#pauseButton','#fighterName'];
  return selectors.map(selector=>({selector,bg:getComputedStyle(document.querySelector(selector)).backgroundImage}));
 });
 assert.ok(painted.every(entry=>entry.bg.startsWith('url(')),'HUD and button panels are raster-painted: '+JSON.stringify(painted));
 assert.equal(await page.locator('svg').count(),0,'No in-game vector graphics');
 const geometry=await page.evaluate(()=>({left:__synthpuck.project(1,0),right:__synthpuck.project(-1,0),radius:__synthpuck.projectedRadius(0,0,.37)}));
 assert.ok(geometry.left.x<geometry.right.x,'right is negative engine X');
 assert.ok(geometry.radius.rx>20,'paddles must be visible');
 const calibrated=await page.evaluate(()=>{
  const api=__synthpuck,table=api.calibration;
  const xy=(x,z)=>api.project(x,z);
  return {table,far:[xy(2.9,5),xy(-2.9,5)],middle:xy(0,0),near:[xy(2.9,-5),xy(-2.9,-5)],
   player:api.spriteGeometry('player',0,-3.6),
   ai:api.spriteGeometry('ai',0,3.6),
   puck:api.spriteGeometry('puck',0,0)};
 });
 assert.deepEqual(calibrated.table.near,{y:770,left:225,right:1450});
 assert.deepEqual(calibrated.table.far,{y:390,left:680,right:992});
 assert.ok(Math.abs(calibrated.middle.y-544)<1,'Puck center follows painted midline');
 assert.ok(calibrated.far.every(p=>p.y===390),'Invisible back rail stays on painted far edge');
 assert.ok(calibrated.near.every(p=>p.y===770),'Invisible near rail stays on painted near edge');
 for(const [name,spr] of Object.entries({player:calibrated.player,ai:calibrated.ai,puck:calibrated.puck})){
  assert.ok(spr.x>0&&spr.y>0&&spr.width>5&&spr.height>5,name+' fully visible');
  assert.ok(spr.x+spr.width<1672&&spr.y+spr.height<941,name+' stays on screen');
 }

 await page.screenshot({path:'synthpuck-arcade-preview.png'});
 await page.keyboard.press('Escape');
  await page.waitForFunction(()=>__synthpuck.snapshot().screen==='pause');
 assert.equal((await page.evaluate(()=>__synthpuck.snapshot())).screen,'pause');
 await page.getByRole('button',{name:'RETOUR AU MENU'}).click();
 assert.equal(await page.locator('#fighterName').isHidden(),true,'No character name over menus');
 await page.getByRole('button',{name:'ENTRAÎNEMENT'}).click();
 assert.equal(await page.locator('.roster-card').count(),7);
 await page.screenshot({path:'synthpuck-character-select-preview.png'});
 assert.equal(await page.locator('svg').count(),0,'No SVG in character selection');
 for(const id of ['mute','chonk','simous','mamouda','diamond','stal','2502']){
  await page.locator(`[data-character="${id}"]`).click();
  assert.equal(await page.locator('.roster-card.selected').getAttribute('data-character'),id);
  assert.equal(await page.locator('.stat-line').count(),4);
  await page.getByRole('button',{name:'COMMENCER L’ENTRAÎNEMENT'}).click();
  await page.waitForFunction(()=>__synthpuck.snapshot().ready);
  const snap=await page.evaluate(()=>__synthpuck.snapshot());
  assert.equal(snap.mode,'training');assert.equal(snap.stage,'training');
  assert.equal(snap.opponent,id);assert.equal(snap.state,'playing');
  assert.match(await page.locator('#hudStage').innerText(),/^GRID 00 · /);
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>__synthpuck.snapshot().screen==='pause');
  await page.getByRole('button',{name:'RETOUR AU MENU'}).click();
  await page.getByRole('button',{name:'ENTRAÎNEMENT'}).click();
 }
 await page.locator('[data-character="2502"]').click();
 await page.getByRole('button',{name:'COMMENCER L’ENTRAÎNEMENT'}).click();
 await page.waitForFunction(()=>__synthpuck.snapshot().ready);
 await page.screenshot({path:'synthpuck-training-preview.png'});
 assert.equal(await page.locator('svg').count(),0,'No SVG in the training arena');
 // Verify that the complete table is visible on phones and wide screens;
 // the same world-to-stage projection must be used for all eight arenas.
 for(const viewport of [{width:390,height:844},{width:844,height:390},{width:1672,height:941}]){
  await page.setViewportSize(viewport);
  await page.waitForFunction(v=>{
   const size=window.__synthpuck.snapshot().viewport;
   return size.width===v.width&&size.height===v.height;
  },viewport);
  if(viewport.width===844)await page.screenshot({path:'synthpuck-landscape-preview.png'});
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
 const artScan=await page.evaluate(async()=>{
  const load=src=>new Promise((done,fail)=>{const i=new Image();i.onload=()=>done(i);i.onerror=fail;i.src=src;});
  const stage=await load('./assets/stages/training.webp');
  const canvas=document.createElement('canvas');canvas.width=stage.width;canvas.height=stage.height;
  const c=canvas.getContext('2d',{willReadFrequently:true});c.drawImage(stage,0,0);
  const px=c.getImageData(0,0,canvas.width,canvas.height).data;
  const rows=[300,350,375,400,425,450,500,550,600,650,700,750,775,800].map(y=>{
   const found=[];let run=-1;
   for(let x=160;x<1512;x++){
    const k=(y*canvas.width+x)*4;const r=px[k],g=px[k+1],b=px[k+2];
    const on=g>130&&b>150&&g>r*1.25&&b>r*1.35;
    if(on&&run<0)run=x;
    if((!on||x===1511)&&run>=0){if(x-run>3)found.push([run,x-1]);run=-1;}
   }
   return {y,segments:found};
  });
  const sprite=await load('./assets/mamouda/sprites.webp');
  canvas.width=sprite.width;canvas.height=sprite.height;c.drawImage(sprite,0,0);
  const s=c.getImageData(0,0,canvas.width,canvas.height).data;
  const crop=[[6,8,232,137],[258,8,232,137],[10,164,90,60]];
  const spriteEdges=crop.map(([x,y,w,h])=>{
   let edge=[0,0,0,0],minX=w,minY=h,maxX=-1,maxY=-1;
   for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++){
    if(s[((y+yy)*canvas.width+x+xx)*4+3]<64)continue;
    minX=Math.min(minX,xx);minY=Math.min(minY,yy);maxX=Math.max(maxX,xx);maxY=Math.max(maxY,yy);
    if(xx===0)edge[0]++;if(xx===w-1)edge[1]++;if(yy===0)edge[2]++;if(yy===h-1)edge[3]++;
   }
   return {bounds:[minX,minY,maxX,maxY],edge};
  });
  return {rows,sprite:{w:sprite.width,h:sprite.height,spriteEdges}};
 });
 assert.equal(artScan.sprite.w,512);
 assert.equal(artScan.sprite.h,350);
 for(const obj of artScan.sprite.spriteEdges){
  assert.deepEqual(obj.edge,[0,0,0,0],'No atlas sprite touches its crop edges');
 }

 assert.deepEqual(errors,[],'No JS exceptions');
 assert.deepEqual(badAssets,[],'All assets must load');
 await page.close();
 console.log('SYNTHPUCK browser verified: logo/title/menu, 7 portraits/stats/AI, arcade, training, physics projection, pause, assets.');
} finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}