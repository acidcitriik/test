import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GREEN_DEBUG_OVERLAY} from '../src/green-debug-overlay.js';

test('all green overlays share a translucent palette and no opaque alpha',()=>{
 const expected={
   playerFill:.16,aiFill:.16,puckFill:.22,
   colliderOutline:.42,colliderIndicator:.42,tableRails:.24
 };
 assert.deepEqual(Object.keys(GREEN_DEBUG_OVERLAY).sort(),Object.keys(expected).sort());
 for(const [kind,color] of Object.entries(GREEN_DEBUG_OVERLAY)){
   const m=/^rgba\((\d+),(\d+),(\d+),(0(?:\.\d+)?|1(?:\.0+)?)\)$/.exec(color);
   assert.ok(m,`${kind} must use an explicit RGBA value`);
   assert.deepEqual(m.slice(1,4).map(Number),[57,255,106],`${kind} hue unchanged`);
   const alpha=Number(m[4]);
   assert.ok(alpha>0 && alpha<1,`${kind} must be partially transparent`);
   assert.equal(alpha,expected[kind],`${kind} intended diagnostic opacity`);
 }
});
test('all green collision and table outline drawing sites use translucent palette',async()=>{
 const source=await readFile(new URL('../src/synthpuck.js',import.meta.url),'utf8');
 assert.ok(source.includes('ctx.strokeStyle=GREEN_DEBUG_OVERLAY.tableRails'));
 assert.ok(source.includes('ctx.strokeStyle=GREEN_DEBUG_OVERLAY.colliderOutline'));
 assert.ok(source.includes('ctx.fillStyle=GREEN_DEBUG_OVERLAY.colliderIndicator'));
 assert.ok(source.includes('GREEN_DEBUG_OVERLAY[type===\'puck\'?\'puckFill\''));
 assert.equal(/#(?:16e65b|39ff75|B4FF88)/i.test(source),false,
  'No old opaque green debug stroke or fill must remain');
});
