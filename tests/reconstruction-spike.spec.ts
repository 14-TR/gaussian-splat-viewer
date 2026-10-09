import { test, expect } from '@playwright/test';
test.skip(!!process.env.VIEWER_URL, 'The reconstruction spike is dev-only and is not deployed to Pages.');
test('image-derived feature tracks reconstruct cameras without receiving ground-truth poses', async ({page}) => {
  const requests: string[]=[];
  page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:5173') && !r.url().startsWith('blob:') && !r.url().startsWith('data:'))requests.push(r.url());expect(r.method()).not.toBe('POST');});
  await page.goto('./spike/index.html');
  await page.locator('#fixture').click();await page.locator('#run').click();
  await page.waitForFunction(()=>!!(window as any).spikeResult,{timeout:100000});
  const result=await page.evaluate(()=>(window as any).spikeResult);
  expect(result.error).toBeUndefined();expect(result.ok).toBe(true);
  expect(result.cameras).toHaveLength(4);expect(result.points).toHaveLength(100);
  expect(result.featureCounts.every((n:number)=>n>=40)).toBe(true);expect(result.reprojectionError).toBeLessThan(1);
  // Validate recovered camera spacing, up to global scale; source poses are used only here, after reconstruction.
  const centers=result.cameraCenters as number[][];
  const distance=(a:number[],b:number[])=>Math.hypot(...a.map((v,i)=>v-b[i]));
  const total=distance(centers[3],centers[0]);
  expect(distance(centers[1],centers[0])/total).toBeCloseTo(1/3,1);
  expect(distance(centers[2],centers[0])/total).toBeCloseTo(2/3,1);
  expect(result.points.flat().every(Number.isFinite)).toBe(true);expect(requests).toEqual([]);
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export reconstruction JSON'}).click();
  const download=await downloadPromise;await download.saveAs('test-results/camera-reconstruction.json');
  await page.screenshot({path:'test-results/camera-spike.png',fullPage:true});
  // A real hardware limit must block before engine startup instead of exporting a blank scene.
  await page.evaluate(()=>Object.defineProperty(navigator,'gpu',{configurable:true,value:{requestAdapter:async()=>({limits:{maxStorageBuffersPerShaderStage:10}})}}));
  await page.locator('#train').click();
  await expect(page.locator('#status')).toContainText('supports 10');
  expect((await page.evaluate(()=>(window as any).trainingResult)).error).toContain('needs at least 12');
  await expect(page.locator('#export-ply')).toBeDisabled();
  await expect(page.locator('#trained-viewer')).toBeHidden();
  expect(await page.evaluate(async()=>{try{const root=await navigator.storage.getDirectory();const dir=await root.getDirectoryHandle('gaussian-browser-jobs');const names=[];for await(const name of (dir as any).keys())names.push(name);return names}catch{return []}})).toEqual([]);
});
test('rejects empty texture and cancels processing without creating output',async({page})=>{
  await page.goto('./spike/index.html');
  const png=await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=512;c.height=384;const b=await new Promise<Blob>(r=>c.toBlob(x=>r(x!),'image/png'));return Array.from(new Uint8Array(await b.arrayBuffer()))});
  await page.locator('#photos').setInputFiles([0,1,2].map(i=>({name:`blank-${i}.png`,mimeType:'image/png',buffer:Buffer.from(png)})));
  await page.locator('#run').click();await page.waitForFunction(()=>!!(window as any).spikeResult,{timeout:100000});
  expect((await page.evaluate(()=>(window as any).spikeResult)).error).toContain('Insufficient texture');
  await page.locator('#fixture').click();await page.locator('#run').click();await page.locator('#cancel').click();
  await expect(page.locator('#status')).toContainText('Cancelled');
  expect(await page.evaluate(()=>(window as any).spikeResult)).toEqual({cancelled:true});
});
