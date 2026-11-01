import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';
import {SPRITE_ART} from '../src/synthpuck-sprite-art.js';
const root=resolve(import.meta.dirname,'..');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.avif':'image/avif','.png':'image/png','.svg':'image/svg+xml'};
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
 assert.ok((await splash.locator('.studio-image').evaluate(img=>img.naturalWidth))>=1600,'The original single-pepper studio logo has a full HD-resolution raster');
 assert.ok((await splash.locator('.studio-image').getAttribute('src')).includes('studio-splash-hd.avif'),'Splash must use the improved version of the original logo');
 await splash.screenshot({path:'synthpuck-studio-preview.png'});
 await splash.waitForFunction(()=>window.__synthpuck?.snapshot().screen==='menu',{timeout:7000});
 await splash.close();
 await page.goto(base+'?skipSplash=1',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__synthpuck?.snapshot().screen==='menu');
 assert.equal(await page.title(),'SYNTHPUCK — PiperadeGames');
 await page.waitForFunction(()=>document.documentElement.dataset.uiArt==='loaded');
 assert.equal(await page.locator('svg').count(),0,'No SVG in the active title screen');
 const menuBg=await page.locator('.menu-image').evaluate(el=>getComputedStyle(el).backgroundImage);
 assert.ok(menuBg.includes('menu-hud.avif')||menuBg.includes('menu-hd.avif'),'The title/menu must retain the validated HD painted artwork');
 const menuResolution=await page.evaluate(()=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve([i.naturalWidth,i.naturalHeight]);i.onerror=reject;i.src='./assets/ui/menu-hd.avif';}));
 assert.deepEqual(menuResolution,[1672,941],'Full-resolution menu image must load without stretching a small atlas');
 await page.screenshot({path:'synthpuck-title-preview.png'});
 assert.equal(await page.locator('.menu-main-buttons button').count(),3,'Three primary game modes');
 assert.equal(await page.locator('.menu-secondary-buttons button').count(),2,'Two centered secondary options');
 assert.equal(await page.getByRole('button',{name:'ONLINE',exact:true}).isDisabled(),false);
 await page.getByRole('button',{name:'OPTIONS',exact:true}).click();
 assert.equal(await page.evaluate(()=>__synthpuck.snapshot().screen),'options');
 await page.getByRole('button',{name:'ENREGISTRER',exact:true}).click();
 await page.getByRole('button',{name:'← MENU',exact:true}).click();
 await page.getByRole('button',{name:'ONLINE',exact:true}).click();
 assert.equal(await page.evaluate(()=>__synthpuck.snapshot().screen),'lobby');
 assert.equal(await page.locator('#relayAccess').count(),0,'Players never enter a private TURN access code');
 assert.equal(await page.locator('#onlinePlayers').count(),1);
 assert.equal(await page.locator('#onlineInvites').count(),1);
 await page.getByRole('button',{name:'← MENU',exact:true}).click();
 await page.getByRole('button',{name:'ARCADE'}).click();
 assert.equal((await page.evaluate(()=>__synthpuck.snapshot())).opponent,'mute');
 assert.equal(await page.locator('.stat-line').count(),4);
 await page.getByRole('button',{name:'LANCER LE DUEL'}).click();
 await page.waitForFunction(()=>__synthpuck.snapshot().ready);
 await page.waitForFunction(()=>__synthpuck.snapshot().screen==='playing');
 await page.waitForFunction(()=>Object.values(__synthpuck.snapshot().spriteSizes).length===3 && Object.values(__synthpuck.snapshot().spriteSizes).every(([w,h])=>w>0&&h>0));
 assert.deepEqual((await page.evaluate(()=>__synthpuck.snapshot().spriteSizes)),{player:[674,482],puck:[549,361],ai:[672,482]},'All three HD approved sprites load at full resolution');
 const first=await page.evaluate(()=>__synthpuck.snapshot());
 assert.equal(first.stage,'mute');assert.equal(first.mode,'arcade');
 assert.equal(first.state,'playing');assert.equal(first.aiStyle,'guard');
 assert.equal(first.opponentHeightNative,240,'Full-resolution opponents have stage-calibrated presence behind the far rail');
 const hdPortraits=await page.evaluate(async()=>{
  const ids=['mute','chonk','simous','mamouda','diamond','stal'];
  return Promise.all(ids.map(id=>new Promise((resolve,reject)=>{
   const img=new Image();
   img.onload=()=>{
    const can=document.createElement('canvas');can.width=1;can.height=1;
    const brush=can.getContext('2d');brush.drawImage(img,0,0);
    resolve({id,width:img.naturalWidth,height:img.naturalHeight,
      transparentCorner:brush.getImageData(0,0,1,1).data[3]===0});
   };
   img.onerror=reject;
   img.src='./assets/characters/'+id+'.webp?v=fighters-hd-20261031';
  })));
 });
 assert.ok(hdPortraits.every(p=>p.width===1086 && p.height===1448 && p.transparentCorner),
  'Six newly approved 1086x1448 HD portraits must be genuinely transparent: '+JSON.stringify(hdPortraits));
 assert.equal(await page.locator('#fighterName').isHidden(),true,'Do not stack a redundant fighter name below the score');
 const hudPlacement=await page.evaluate(()=>{
   const hud=document.querySelector('#hud').getBoundingClientRect();
   const left=document.querySelector('.hud-left').getBoundingClientRect();
   const right=document.querySelector('.hud-right').getBoundingClientRect();
   const score=document.querySelector('#score').getBoundingClientRect();
   const {left:stageLeft,width:stageWidth}=__synthpuck.snapshot().arenaFrame;
   const textInside=sel=>{const a=document.querySelector(sel).getBoundingClientRect();return a.top>=hud.top && a.bottom<=hud.bottom;};
   return {hudLeft:hud.left,left:left.left,right:right.right,scoreCenter:score.left+score.width/2,stageLeft,stageWidth,
    smallLeftInside:textInside('.hud-left small'),smallRightInside:textInside('.hud-right small')};
 });
 assert.ok(hudPlacement.left>=hudPlacement.stageLeft,'The left HUD panel must stay within the visible game arena');
 assert.ok(hudPlacement.right<=hudPlacement.stageLeft+hudPlacement.stageWidth,'The right HUD panel must stay within the visible game arena');
 assert.ok(Math.abs(hudPlacement.scoreCenter-(hudPlacement.stageLeft+hudPlacement.stageWidth/2))<12,'Score must align with the center of the painted table');
 assert.ok(hudPlacement.smallLeftInside&&hudPlacement.smallRightInside,'HUD category labels must no longer float above the entire HUD');
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
 assert.ok(painted.every(entry=>entry.bg.startsWith('url(') && !entry.bg.includes('data:image')),'The HUD uses separate high-res painted assets, not enlarged base64 atlases: '+JSON.stringify(painted));
 assert.ok(painted.some(entry=>entry.bg.includes('panel-red.webp')),'The scoreboard uses the new full-resolution red plate');
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
 assert.deepEqual(calibrated.table.near,{y:816,left:200,right:1475});
 assert.deepEqual(calibrated.table.far,{y:405,left:632,right:1040});
 assert.deepEqual(calibrated.table.center,{y:554,left:475,right:1201});
 const close=(value,expected,label)=>assert.ok(Math.abs(value-expected)<.015,
   label+' expected '+expected+', got '+value);
 close(calibrated.middle.y,554,'Center line preserved');
 for(const [name,actual,expected] of [
   ['Far left',calibrated.far[0],[632,405]],
   ['Far right',calibrated.far[1],[1040,405]],
   ['Near left',calibrated.near[0],[200,816]],
   ['Near right',calibrated.near[1],[1475,816]]
 ]){ close(actual.x,expected[0],name+' X');close(actual.y,expected[1],name+' Y'); }
 for(const [name,x,expected] of [
  ['Center left',2.9,475],['Center right',-2.9,1201]
 ])close((await page.evaluate(x=>__synthpuck.project(x,0),x)).x,expected,name);
 const rearCurve=await page.evaluate(()=>[4.75,3.75,2.5,0,-2.5,-5].map(z=>{
   const x=__synthpuck.project(2.9,z);
   const y=__synthpuck.project(-2.9,z);
   return {z,left:x.x,right:y.x,height:x.y,symmetricHeight:y.y};
 }));
 assert.ok(rearCurve.every(p=>p.left<p.right&&Math.abs(p.height-p.symmetricHeight)<.015),'Projected rail stays planar');
 assert.ok(rearCurve.every((p,i)=>i===0||p.height>rearCurve[i-1].height),
   'Perspective is monotonic toward the viewer');
 // A sprite's painted contact disk must agree with the projected collider,
 // independent of whether its head/upper surface extends above the table.
 const contact=await page.evaluate(()=>({
   cases:['player','puck','ai'].flatMap(type=>[-3.8,0,3.8].map(z=>({
     type,z,center:__synthpuck.project(0,z),sprite:__synthpuck.spriteGeometry(type,0,z)
   }))),
   nearRail:__synthpuck.project(0,-5).y,
   offsets:__synthpuck.snapshot().paddleOffsets,
   scale:__synthpuck.snapshot().arenaFrame.width/1672,
   nearCases:[
     {type:'player',z:-4.56},{type:'puck',z:-4.83}
   ].map(({type,z})=>({type,z,box:__synthpuck.spriteGeometry(type,0,z)}))
 }));
 for(const entry of contact.cases){
   const art=SPRITE_ART[entry.type],g=entry.sprite,p=entry.center;
   close(g.x+g.width/2,p.x,entry.type+' contact X');
   const shifted=entry.type==='puck'?0:contact.offsets[entry.type]*contact.scale;
   close(g.y+g.height*art.anchor,p.y+shifted,entry.type+' configured visual Y');
 }
 for(const entry of contact.nearCases){
   const art=SPRITE_ART[entry.type],g=entry.box;
   const shift=entry.type==='puck'?0:contact.offsets[entry.type]*contact.scale;
   assert.ok(g.y+g.height*art.inkBottom<=contact.nearRail+2.015+shift,
     entry.type+' visual foot must respect the front bumper plus chosen offset');
 }
 for(const [name,spr] of Object.entries({player:calibrated.player,ai:calibrated.ai,puck:calibrated.puck})){
  assert.ok(spr.x>0&&spr.y>0&&spr.width>5&&spr.height>5,name+' fully visible');
  assert.ok(spr.x+spr.width<1672&&spr.y+spr.height<941,name+' stays on screen');
 }

 await page.screenshot({path:'synthpuck-arcade-preview.png'});
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>__synthpuck.snapshot().screen==='pause');
 assert.equal((await page.evaluate(()=>__synthpuck.snapshot())).screen,'pause');
 assert.equal(await page.locator('[data-pause-level]').count(),7,'Pause offers all seven Arcade stages');
 assert.equal(await page.locator('[data-pause-level="0"]').getAttribute('aria-current'),'step','Current stage is highlighted');
 await page.screenshot({path:'synthpuck-pause-levels-preview.png'});
 // Calibration must be adjustable at an exact native-pixel offset with the
 // collision centres and puck completely unchanged.
 await page.getByRole('button',{name:'CALER LES RAQUETTES'}).click();
 await page.waitForFunction(()=>__synthpuck.snapshot().screen==='calibration');
 const beforeOffsets=await page.evaluate(()=>({
  offsets:__synthpuck.snapshot().paddleOffsets,
  player:__synthpuck.spriteGeometry('player',0,-3.8),
  ai:__synthpuck.spriteGeometry('ai',0,3.8),
  puck:__synthpuck.spriteGeometry('puck',0,0),
  collision:__synthpuck.project(0,-3.8),
  scale:__synthpuck.snapshot().arenaFrame.width/1672
 }));
 assert.equal(beforeOffsets.offsets.player,12);
 assert.equal(beforeOffsets.offsets.ai,12);
 await page.locator('#offset-number-player').fill('22');
 await page.locator('#offset-number-ai').fill('31');
 await page.waitForFunction(()=>{
  const p=__synthpuck.snapshot().paddleOffsets;
  return p.player===22&&p.ai===31;
 });
 const afterOffsets=await page.evaluate(()=>({
  player:__synthpuck.spriteGeometry('player',0,-3.8),
  ai:__synthpuck.spriteGeometry('ai',0,3.8),
  puck:__synthpuck.spriteGeometry('puck',0,0),
  collision:__synthpuck.project(0,-3.8),
  savedPlayer:localStorage.getItem('synthpuck.spriteOffset.player'),
  savedAi:localStorage.getItem('synthpuck.spriteOffset.ai'),
  playerLabel:document.querySelector('#offset-label-player').textContent,
  aiLabel:document.querySelector('#offset-label-ai').textContent
 }));
 assert.ok(Math.abs(afterOffsets.player.y-beforeOffsets.player.y-10*beforeOffsets.scale)<.0001,
  'Player sprite must descend EXACTLY 10 additional native pixels');
 assert.ok(Math.abs(afterOffsets.ai.y-beforeOffsets.ai.y-19*beforeOffsets.scale)<.0001,
  'AI sprite must descend EXACTLY 19 additional native pixels');
 assert.deepEqual(afterOffsets.puck,beforeOffsets.puck,'Puck remains unaffected by paddle calibration');
 assert.deepEqual(afterOffsets.collision,beforeOffsets.collision,'Physics projection remains fixed');
 assert.equal(afterOffsets.savedPlayer,'22');
 assert.equal(afterOffsets.savedAi,'31');
 assert.equal(afterOffsets.playerLabel,'+22 px');
 assert.equal(afterOffsets.aiLabel,'+31 px');
 await page.getByRole('button',{name:'RETOUR PAUSE'}).click();
 await page.waitForFunction(()=>__synthpuck.snapshot().screen==='pause');
 await page.getByRole('button',{name:'Niveau 04 : MAMOUDA'}).click();
 await page.waitForFunction(()=>__synthpuck.snapshot().screen==='playing'&&__synthpuck.snapshot().stage==='mamouda');
 const jumped=await page.evaluate(()=>__synthpuck.snapshot());
 assert.equal(jumped.mode,'arcade');
 assert.equal(jumped.level,3);
 assert.equal(jumped.opponent,'mamouda');
 assert.deepEqual(jumped.score,[0,0],'Skipping to a stage starts a fresh duel');
 assert.equal(jumped.state,'playing');
 assert.equal(await page.locator('#hudLevel').innerText(),'04 / 07');
 assert.match(await page.locator('#hudStage').innerText(),/MAMOUDA/);
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>__synthpuck.snapshot().screen==='pause');
 assert.equal(await page.locator('[data-pause-level="3"]').getAttribute('aria-current'),'step');
 await page.getByRole('button',{name:'Niveau 01 : MUTE'}).click();
 await page.waitForFunction(()=>__synthpuck.snapshot().screen==='playing'&&__synthpuck.snapshot().stage==='mute');
 assert.equal((await page.evaluate(()=>__synthpuck.snapshot())).level,0,'Stage selection works in both directions');
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>__synthpuck.snapshot().screen==='pause');
 await page.getByRole('button',{name:'RETOUR AU MENU'}).click();
 assert.equal(await page.locator('#fighterName').isHidden(),true,'No character name over menus');
 await page.getByRole('button',{name:'ENTRAÎNEMENT'}).click();
 assert.equal(await page.locator('.roster-card').count(),7);
 assert.equal(await page.locator('[data-character="2502"] strong').innerText(),'HAL');
 await page.screenshot({path:'synthpuck-character-select-preview.png'});
 assert.equal(await page.locator('svg').count(),0,'No SVG in character selection');
 for(const id of ['mute','chonk','simous','mamouda','diamond','stal','2502']){
  await page.locator(`[data-character="${id}"]`).click();
  assert.equal(await page.locator('.roster-card.selected').getAttribute('data-character'),id);
  assert.equal(await page.locator('.stat-line').count(),4);
  await page.getByRole('button',{name:'COMMENCER L’ENTRAÎNEMENT'}).click();
  await page.waitForFunction(()=>__synthpuck.snapshot().ready);
  if(id!=='2502')await page.screenshot({path:`synthpuck-opponent-${id}-preview.png`});
  const snap=await page.evaluate(()=>__synthpuck.snapshot());
  assert.equal(snap.mode,'training');assert.equal(snap.stage,'training');
  assert.equal(snap.opponent,id);assert.equal(snap.state,'playing');
  assert.match(await page.locator('#hudStage').innerText(),/^GRID 00 · /);
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>__synthpuck.snapshot().screen==='pause');
  assert.equal(await page.locator('[data-pause-level]').count(),0,'Training pause does not jump into Arcade');
  await page.getByRole('button',{name:'RETOUR AU MENU'}).click();
  await page.getByRole('button',{name:'ENTRAÎNEMENT'}).click();
 }
 await page.locator('[data-character="2502"]').click();
 await page.getByRole('button',{name:'COMMENCER L’ENTRAÎNEMENT'}).click();
 await page.waitForFunction(()=>__synthpuck.snapshot().ready);
 await page.screenshot({path:'synthpuck-training-preview.png'});
 assert.equal((await page.evaluate(()=>__synthpuck.snapshot())).halEyePosition,null,'Training uses the neutral backdrop');
 assert.equal(await page.locator('svg').count(),0,'No SVG in the training arena');
 // Verify that the complete table is visible on phones and wide screens;
 // the same world-to-stage projection must be used for all eight arenas.
 for(const viewport of [{width:390,height:844},{width:844,height:390},{width:1780,height:800},{width:1672,height:941}]){
  await page.setViewportSize(viewport);
  await page.waitForFunction(v=>{
   const size=window.__synthpuck.snapshot().viewport;
   return size.width===v.width&&size.height===v.height;
  },viewport);
  if(viewport.width===844)await page.screenshot({path:'synthpuck-landscape-preview.png'});
  if(viewport.width===1780){
    await page.screenshot({path:'synthpuck-wide-hud-preview.png'});
    const boxes=await page.evaluate(()=>{
      const stage=__synthpuck.snapshot().arenaFrame;
      const left=document.querySelector('.hud-left').getBoundingClientRect();
      const right=document.querySelector('.hud-right').getBoundingClientRect();
      return {stage,left:left.left,right:right.right};
    });
    assert.ok(boxes.left>=boxes.stage.left,'Wide screen HUD must not overflow left black bar');
    assert.ok(boxes.right<=boxes.stage.left+boxes.stage.width,'Wide screen HUD must not overflow right black bar');
  }
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
  // Validate the three NEW approved full transparent sprites rather than the
  // old Mamouda atlas. Pixel margins prevent cut handles/puck/rims.
  const urls=(await import('./src/synthpuck-sprite-art.js')).SPRITE_URLS;
  const spriteEdges=[];
  for(const type of ['player','puck','ai']){
   const sprite=await load(urls[type]);
   canvas.width=sprite.width;canvas.height=sprite.height;c.drawImage(sprite,0,0);
   const a=c.getImageData(0,0,canvas.width,canvas.height).data;
   const edge=[0,0,0,0];
   for(let y=0;y<canvas.height;y++){
    if(a[(y*canvas.width)*4+3]>16)edge[0]++;
    if(a[(y*canvas.width+canvas.width-1)*4+3]>16)edge[1]++;
   }
   for(let x=0;x<canvas.width;x++){
    if(a[x*4+3]>16)edge[2]++;
    if(a[((canvas.height-1)*canvas.width+x)*4+3]>16)edge[3]++;
   }
   spriteEdges.push({type,width:sprite.width,height:sprite.height,edge});
  }
  return {rows,spriteEdges};
 });
 assert.equal(artScan.spriteEdges.length,3);
 for(const sprite of artScan.spriteEdges){
  assert.ok(sprite.width>=540 && sprite.height>=350, sprite.type+' must retain HD source detail');
  assert.deepEqual(sprite.edge,[0,0,0,0],sprite.type+' must have transparent safety margins on every side');
 }

 assert.deepEqual(errors,[],'No JS exceptions');
 assert.deepEqual(badAssets,[],'All assets must load');
 await page.close();
 console.log('SYNTHPUCK browser verified: logo/title/menu, 7 portraits/stats/AI, arcade, training, physics projection, pause, assets.');
} finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}

