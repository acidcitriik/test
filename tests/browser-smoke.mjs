// Optional browser smoke test. Run 'npm install --no-save playwright' first.
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { chromium } from 'playwright';

const root = resolve(import.meta.dirname, '..');
const contentTypes = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json' };
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
  assert.deepEqual(mobileErrors,[]);
  await mobile.close();
  console.log('Browser smoke passed:',JSON.stringify(state));
} finally {
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
