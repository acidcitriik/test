// Optional browser smoke test. Run 'npm install --no-save playwright' first.
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { chromium } from 'playwright';

const root = resolve(import.meta.dirname, '..');
const contentTypes = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json', '.svg':'image/svg+xml; charset=utf-8', '.webp':'image/webp' };
const server = http.createServer(async(req,res)=>{
  try {
    const pathname=new URL(req.url,'http://localhost').pathname;
    const file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!file.startsWith(root+sep))throw Error('Forbidden');
    const data=await readFile(file);
    res.writeHead(200,{'Content-Type':contentTypes[extname(file)]||'application/octet-stream'});
    res.end(data);
  }catch(e){res.writeHead(404);res.end('Not found');}
});
let browser;
try {
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const port=server.address().port;
  browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1366,height:768}});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:'+port+'/',{waitUntil:'networkidle'});
  await page.locator('#game').waitFor();
  await page.getByRole('button',{name:'JOUER'}).click();
  await page.waitForFunction(()=>document.pointerLockElement?.id==='game');
  const locked=await page.evaluate(()=>document.pointerLockElement?.id);
  assert.equal(locked,'game','mouse must be captured for actual play');
  const desktopCamera=await page.evaluate(()=>window.__gameDiagnostics.camera());
  assert.ok(Math.abs(desktopCamera.y-7.2)<1e-8);
  assert.ok(Math.abs(desktopCamera.z+10.9)<1e-8);

  // The contact HUD is frame-driven: wait for an actual frame instead of
  // assuming 40 ms is enough on a software-rendered GitHub runner.
  await page.mouse.down({button:'right'});
  await page.waitForFunction(()=>document.querySelector('#contact')?.textContent==='AMORTI',null,{timeout:2500});
  await page.mouse.up({button:'right'});
  const initial=await page.evaluate(()=>window.__gameDiagnostics.player());
  await page.mouse.move(890,550);
  // Headless Chromium can coalesce/suppress actual mouse deltas under
  // pointer lock. Dispatch one deterministic relative delta through the
  // same production event listener to test zero-lag follow behavior.
  await page.evaluate(() => {
    const event = new MouseEvent('mousemove', { bubbles:true });
    Object.defineProperty(event,'movementX',{value:90});
    Object.defineProperty(event,'movementY',{value:-40});
    document.dispatchEvent(event);
  });
  await page.waitForFunction(previous => {
    const player=window.__gameDiagnostics.player();
    return Math.abs(player.x-previous.x)>0.02 || Math.abs(player.z-previous.z)>0.02;
  },initial,{timeout:2500});
  const position=await page.evaluate(()=>({
    player:window.__gameDiagnostics.player(),
    target:window.__gameDiagnostics.target()
  }));
  assert.ok(Math.abs(position.player.x-position.target.x)<1e-5,
    'horizontal player paddle must reach mouse target with zero software follow lag');
  assert.ok(Math.abs(position.player.z-position.target.z)<1e-5,
    'forward/back paddle must reach mouse target with zero software follow lag');
  await page.waitForTimeout(200);
  const state=await page.evaluate(()=>({
    overlay:getComputedStyle(document.querySelector('#overlay')).display,
    score:document.querySelector('#score').textContent,
    puck:document.querySelector('#puckSpeed').textContent,
    canvasWidth:document.querySelector('#game').width,
    error:document.querySelector('#error').textContent
  }));
  assert.equal(state.overlay,'none','play overlay should close');
  assert.ok(state.canvasWidth>0,'WebGL canvas should be initialized');
  assert.ok(/m\/s/.test(state.puck),'telemetry should update');
  assert.equal(state.error,'','startup error overlay should be empty');
  assert.deepEqual(errors,[], 'browser console should have no JavaScript page errors');
  // Mobile emulation: touch must start without pointer lock and move the paddle.
  const mobile=await browser.newPage({
    viewport:{width:390,height:844},deviceScaleFactor:1,
    isMobile:true,hasTouch:true
  });
  const mobileErrors=[];
  mobile.on('pageerror',e=>mobileErrors.push(e.message));
  await mobile.goto('http://127.0.0.1:'+port+'/',{waitUntil:'networkidle'});
  await mobile.locator('#play').click();
  await mobile.waitForFunction(()=>getComputedStyle(document.querySelector('#overlay')).display==='none');
  assert.equal(await mobile.evaluate(()=>document.pointerLockElement),null);
  assert.equal(await mobile.locator('#mobileControls').evaluate(e=>getComputedStyle(e).display),'flex');
  const mobileCamera=await mobile.evaluate(()=>window.__gameDiagnostics.camera());
  assert.ok(Math.abs(mobileCamera.downwardAngleDegrees-desktopCamera.downwardAngleDegrees-20)<1e-6,
    'touch camera must look 20 degrees more downward than desktop');
  assert.ok(mobileCamera.y>desktopCamera.y&&mobileCamera.z>desktopCamera.z,
    'touch camera should rise and move toward the table without changing the target');
  assert.ok(Math.abs(mobileCamera.tableNearEdgeFraction-.8)<.006,
    'mobile portrait: near table edge should leave 20% of screen clear');
  assert.ok(mobileCamera.tableFarEdgeFraction>0&&mobileCamera.tableFarEdgeFraction<.8,
    'mobile portrait: far end of table must remain on screen');

  await mobile.locator('[data-touch-mode="grip"]').click();
  await mobile.waitForFunction(()=>document.querySelector('#contact')?.textContent==='ADHÉRENCE');
  // Real Chromium touch gestures: synthetic PointerEvents did not exercise
  // native TouchEvent delivery on Android, masking mobile regressions.
  const startTouch=await mobile.evaluate(()=>window.__gameDiagnostics.target());
  const cdp=await mobile.context().newCDPSession(mobile);
  await cdp.send('Input.dispatchTouchEvent',{
    type:'touchStart',touchPoints:[{x:180,y:550,id:1}]
  });
  for(let step=1;step<=6;step++){
    await cdp.send('Input.dispatchTouchEvent',{
      type:'touchMove',
      touchPoints:[{x:180+10*step,y:550-12*step,id:1}]
    });
  }
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await mobile.waitForFunction(initial=>{
    const t=window.__gameDiagnostics.target();
    return t.x<initial.x-0.05 && t.z>initial.z+0.05;
  },startTouch,{timeout:4000});
  await mobile.waitForFunction(()=>{
    const p=window.__gameDiagnostics.player(),t=window.__gameDiagnostics.target();
    return Math.abs(p.x-t.x)<1e-5&&Math.abs(p.z-t.z)<1e-5;
  },null,{timeout:4000});
  const finalTouch=await mobile.evaluate(()=>({player:window.__gameDiagnostics.player(),target:window.__gameDiagnostics.target()}));
  assert.ok(finalTouch.target.x<startTouch.x,'swipe to the right should move the paddle screen-right');
  assert.ok(finalTouch.target.z>startTouch.z,'swipe upward should advance the paddle');
  await cdp.detach();
  await mobile.locator('#mobilePause').click();
  assert.equal(await mobile.locator('#overlay').evaluate(e=>getComputedStyle(e).display),'grid');
  // Rotation or window resize must recompute the free bottom fifth.
  await mobile.setViewportSize({width:844,height:390});
  const landscapeCamera=await mobile.evaluate(()=>window.__gameDiagnostics.camera());
  assert.ok(Math.abs(landscapeCamera.tableNearEdgeFraction-.8)<.006,
    'mobile landscape: bottom 20% must remain below the table');
  assert.ok(Math.abs(landscapeCamera.downwardAngleDegrees-mobileCamera.downwardAngleDegrees)<1e-6,
    'rotation must preserve the raised camera angle');
  assert.deepEqual(mobileErrors,[]);
  await mobile.close();
  // Opt-in 2.5D stage must load both layers and preserve basic playability.
  const stage=await browser.newPage({viewport:{width:1366,height:768}});
  const stageErrors=[], failedResources=[];
  stage.on('pageerror',e=>stageErrors.push(e.message));
  stage.on('response',r=>{if(r.status()>=400)failedResources.push(r.url());});
  await stage.goto('http://127.0.0.1:'+port+'/?stage=mamouda',{waitUntil:'networkidle'});
  await stage.waitForFunction(()=>window.__stageDiagnostics?.ready(),null,{timeout:30000});
  const stageInfo=await stage.evaluate(()=>({
    name:window.__stageDiagnostics.name,
    layers:window.__stageDiagnostics.backgroundLayers(),
    ready:window.__stageDiagnostics.ready()
  }));
  assert.deepEqual(stageInfo,{name:'mamouda',layers:2,ready:true},
    'Mamouda must have two loaded visual background layers');
  assert.deepEqual(failedResources,[], 'Mamouda assets must be reachable');
  await stage.locator('#play').click();
  await stage.waitForFunction(()=>document.pointerLockElement?.id==='game');
  await stage.screenshot({path:'mamouda-preview.png'});
  assert.deepEqual(stageErrors,[],'Mamouda stage must not produce JS errors');
  await stage.close();
  // Illustrated variant: actual embedded painting, no duplicate painted table.
  const painted=await browser.newPage({viewport:{width:1366,height:768}});
  const paintedErrors=[],paintedFailed=[];
  painted.on('pageerror',error=>paintedErrors.push(error.message));
  painted.on('response',response=>{if(response.status()>=400)paintedFailed.push(response.url());});
  await painted.goto('http://127.0.0.1:'+port+'/?stage=mamouda-painted',{waitUntil:'networkidle'});
  await painted.waitForFunction(()=>window.__stageDiagnostics?.ready(),null,{timeout:12000});
  const paintedInfo=await painted.evaluate(()=>({
    name:window.__stageDiagnostics.name,
    layers:window.__stageDiagnostics.backgroundLayers(),
    ready:window.__stageDiagnostics.ready()
  }));
  assert.deepEqual(paintedInfo,{name:'mamouda-painted',layers:1,ready:true},
    'Illustrated Mamouda must load the raster painting');
  assert.deepEqual(paintedFailed,[],'painted assets must load without HTTP errors');
  await painted.locator('#play').click();
  await painted.waitForFunction(()=>document.pointerLockElement?.id==='game');
  await painted.screenshot({path:'mamouda-painted-preview.png'});
  assert.deepEqual(paintedErrors,[],'illustrated scene must not throw JS errors');
  await painted.close();
  // Final approved image: the 3D table is NOT painted on the screen.
  // Its authoritative XZ physics remains active; mobile props are
  // projected onto the illustrated plane.
  const illustrated=await browser.newPage({viewport:{width:1366,height:768}});
  const illustratedErrors=[],illustratedFailures=[];
  illustrated.on('pageerror',error=>illustratedErrors.push(error.message));
  illustrated.on('response',response=>{
    if(response.status()>=400)illustratedFailures.push(response.url());
  });
  await illustrated.goto('http://127.0.0.1:'+port+'/?stage=mamouda-final',
    {waitUntil:'networkidle'});
  await illustrated.waitForFunction(()=>window.__stageDiagnostics?.ready(),null,{timeout:15000});
  const finalInfo=await illustrated.evaluate(()=>({
    name:window.__stageDiagnostics.name,
    ready:window.__stageDiagnostics.ready(),
    layers:window.__stageDiagnostics.backgroundLayers(),
    images:document.querySelectorAll('[data-mamouda-illustrated="true"] img').length,
    canvasInvisible:getComputedStyle(document.querySelector('#game')).opacity==='0',
    farLeft:window.__stageDiagnostics.projected(2.9,5),
    nearRight:window.__stageDiagnostics.projected(-2.9,-5),
    screenLeft:window.__stageDiagnostics.projected(1,0),
    screenRight:window.__stageDiagnostics.projected(-1,0)
  }));
  assert.equal(finalInfo.name,'mamouda-final');
  assert.equal(finalInfo.ready,true);
  assert.equal(finalInfo.layers,2);
  assert.equal(finalInfo.canvasInvisible,true);
  assert.ok(finalInfo.screenRight.x>finalInfo.screenLeft.x, 'negative world X must be screen-right');
  assert.ok(finalInfo.farLeft.x<finalInfo.nearRight.x &&
    finalInfo.farLeft.y<finalInfo.nearRight.y,
    'table projection must respect image perspective');
  assert.deepEqual(illustratedFailures,[],'illustrated assets must be reachable');
  await illustrated.locator('#play').click();
  await illustrated.waitForFunction(()=>document.pointerLockElement?.id==='game');
  const before=await illustrated.evaluate(()=>window.__gameDiagnostics.target());
  await illustrated.evaluate(()=>{
    const event=new MouseEvent('mousemove',{bubbles:true});
    Object.defineProperty(event,'movementX',{value:75});
    Object.defineProperty(event,'movementY',{value:-30});
    document.dispatchEvent(event);
  });
  await illustrated.waitForFunction(initial=>{
    const t=window.__gameDiagnostics.target();
    return Math.abs(t.x-initial.x)>.02||Math.abs(t.z-initial.z)>.02;
  },before,{timeout:4000});
  const moved=await illustrated.evaluate(()=>{
    const after=window.__gameDiagnostics.target();
    const beforeProjection=window.__stageDiagnostics.projected(0,-2);
    const afterProjection=window.__stageDiagnostics.projected(after.x,after.z);
    return {target:after,afterProjection,beforeProjection};
  });
  assert.ok(moved.target.x<before.x, 'right mouse motion moves world X negative');
  assert.ok(moved.afterProjection.x>moved.beforeProjection.x,
    'right mouse motion visually moves mallet right, not left');
  await illustrated.screenshot({path:'mamouda-final-preview.png'});
  assert.deepEqual(illustratedErrors,[], 'final arena must not throw JS errors');
  await illustrated.close();
  console.log('Browser smoke passed:',JSON.stringify(state),
    'Mamouda:',JSON.stringify(stageInfo),'Painted:',JSON.stringify(paintedInfo));
} finally {
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
