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
  await page.mouse.move(890,550);
  await page.waitForFunction(()=>Number.parseFloat(document.querySelector('#paddleSpeed').textContent)>0,null,{timeout:2500});
  const moving=await page.evaluate(()=>Number.parseFloat(document.querySelector('#paddleSpeed').textContent));
  assert.ok(moving > 0, 'relative mouse movement must accelerate the paddle');
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
  console.log('Browser smoke passed:',JSON.stringify(state));
} finally {
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
