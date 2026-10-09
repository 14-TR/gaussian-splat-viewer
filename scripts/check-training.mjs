import { chromium } from '@playwright/test';
import { mkdir,writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import {PNG} from 'pngjs';
const browser=await chromium.launch({headless:false});
try {
 const page=await browser.newPage();
 const external=[];page.on('request',r=>{if(r.method()==='POST'||(!r.url().startsWith('http://127.0.0.1:5173')&&!r.url().startsWith('blob:')&&!r.url().startsWith('data:')))external.push(r.url())});
 page.on('console',m=>console.log('console',m.type(),m.text()));
 page.on('pageerror',e=>console.log('pageerror',e.message));
 await page.goto('http://127.0.0.1:5173/gaussian-splat-viewer/spike/index.html');
 await page.locator('#fixture').click();await page.locator('#run').click();
 await page.waitForFunction(()=>!!window.spikeResult,null,{timeout:100000});
 console.log('pose',await page.evaluate(()=>({ok:window.spikeResult.ok,error:window.spikeResult.error})));
 await page.locator('#train').click();
 const poll=setInterval(async()=>console.log('status',await page.locator('#status').textContent().catch(()=>'')),10000);
 await page.waitForFunction(()=>!!window.trainingResult,null,{timeout:200000}).finally(()=>clearInterval(poll));
 const result=await page.evaluate(()=>({...window.trainingResult,bytes:Array.from(window.trainingResult.bytes||[]),initialBytes:Array.from(window.trainingResult.initialBytes||[])}));
 if(!result.ok){await mkdir('test-results',{recursive:true});await writeFile('test-results/training-blocker.json',JSON.stringify(result,null,2));await page.screenshot({path:'test-results/training-blocker.png',fullPage:true})}
 assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.iterations,400);assert(result.numSplats>0&&result.numSplats<=2000);
 assert(!Buffer.from(result.bytes).equals(Buffer.from(result.initialBytes)),'Optimization must change exported Gaussian parameters');
 assert(result.metrics.length>=2,'Require real held-out evaluations');
 assert(result.metrics.at(-1).psnr>result.metrics[0].psnr+.01,'Held-out PSNR must improve');
 const ply=Buffer.from(result.bytes),headerEnd=ply.indexOf('end_header\n')+11,header=ply.subarray(0,headerEnd).toString();
 assert(header.includes('format binary_little_endian 1.0'));
 assert.equal(Number(header.match(/element vertex (\d+)/)?.[1]),result.numSplats);
 for(const name of ['x','y','z','scale_0','scale_1','scale_2','opacity','rot_0','rot_1','rot_2','rot_3','f_dc_0','f_dc_1','f_dc_2'])assert(header.includes(`property float ${name}\n`));
 assert.equal(ply.length-headerEnd,result.numSplats*14*4);
 for(let row=0;row<result.numSplats;row++){const values=Array.from({length:14},(_,i)=>ply.readFloatLE(headerEnd+(row*14+i)*4));assert(values.every(Number.isFinite),'Exported parameters must be finite');assert(Math.abs(Math.hypot(...values.slice(7,11))-1)<.01,'Exported quaternions must be normalized')}
 await mkdir('test-results',{recursive:true});
 await writeFile('test-results/trained-reconstruction.ply',Buffer.from(result.bytes));
 await writeFile('test-results/initial-reconstruction.ply',Buffer.from(result.initialBytes));
 delete result.bytes;delete result.initialBytes;console.log('RESULT',JSON.stringify(result));
 await writeFile('test-results/training-result.json',JSON.stringify(result,null,2));
 const viewer=page.frameLocator('#trained-viewer');
 await viewer.locator('#status').filter({hasText:'loaded'}).waitFor({timeout:30000});
 const canvas=viewer.locator('canvas');const before=await canvas.screenshot({path:'test-results/trained-render.png'});
 const png=PNG.sync.read(before);let colorful=0;for(let i=0;i<png.data.length;i+=4){const [r,g,b]=png.data.subarray(i,i+3);if(Math.max(r,g,b)-Math.min(r,g,b)>25&&Math.max(r,g,b)>70)colorful++}
 assert(colorful>1000,`Expected rendered scene pixels, got ${colorful}`);
 await canvas.scrollIntoViewIfNeeded();const box=await canvas.boundingBox();await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.7,box.y+box.height*.6,{steps:12});await page.mouse.up();
 await page.waitForTimeout(500);assert(!(await canvas.screenshot()).equals(before),'Orbit must change trained-scene rendering');
 result.rendering={colorfulPixels:colorful,orbitChanged:true};
 assert.deepEqual(external,[],'Photos and training must stay local');
 await writeFile('test-results/training-result.json',JSON.stringify(result,null,2));
 await page.screenshot({path:'test-results/training.png',fullPage:true});
 console.log('PASS actual Gaussian optimization, canonical PLY export, Spark pixels and orbit');
} finally {await browser.close()}
