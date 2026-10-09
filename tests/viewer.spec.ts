import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';
import { demoBytes, validateFile, maxBytes } from '../src/files';
test('validation rejects unsupported, empty and oversized files', () => {
  expect(() => validateFile({name:'scene.obj',size:32})).toThrow('Choose');
  expect(() => validateFile({name:'scene.splat',size:0})).toThrow('empty');
  expect(() => validateFile({name:'scene.ply',size:maxBytes+1})).toThrow('256');
  expect(() => validateFile({name:'SCENE.SPLAT',size:32})).not.toThrow();
  expect(demoBytes().length).toBe(2048*32);
});
test('renders synthetic local file, supports controls and preserves scene on bad input', async ({page}) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const external: string[] = []; page.on('request', r => { if (!r.url().startsWith(new URL(process.env.VIEWER_URL ?? 'http://127.0.0.1:5173').origin) && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) external.push(r.url()); });
  await page.goto('./');
  await page.locator('#file').setInputFiles({name:'fixture.splat',mimeType:'application/octet-stream',buffer:Buffer.from(demoBytes())});
  await expect(page.locator('#status')).toContainText('loaded');
  await expect(page.locator('#stats')).toContainText('2,048');
  const canvas = page.locator('canvas');
  await expect.poll(async () => {
    const png = PNG.sync.read(await canvas.screenshot()); let colorful = 0;
    for(let i=0;i<png.data.length;i+=4) { const [r,g,b] = png.data.subarray(i,i+3); if(Math.max(r,g,b)-Math.min(r,g,b)>45 && Math.max(r,g,b)>100) colorful++; }
    return colorful;
  },{timeout:30000}).toBeGreaterThan(1000);
  const before = await canvas.screenshot(); const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5); await page.mouse.down(); await page.mouse.move(box.x+box.width*.7,box.y+box.height*.6,{steps:12}); await page.mouse.up();
  await expect.poll(async () => (await canvas.screenshot()).equals(before)).toBe(false);
  await page.mouse.wheel(0,100); await page.getByRole('button',{name:'Reset camera'}).click();
  await page.getByLabel('Auto rotate').check(); await page.getByLabel('Auto rotate').uncheck();
  await page.locator('#file').setInputFiles({name:'bad.splat',mimeType:'application/octet-stream',buffer:Buffer.from([1,2,3])});
  await expect(page.locator('#status')).toContainText('Unable'); await expect(page.locator('#name')).toHaveText('fixture.splat');
  await page.screenshot({path:'test-results/viewer-desktop.png',fullPage:true});
  expect(errors).toEqual([]); expect(external).toEqual([]);
});
test('demo and drag-drop work on a narrow viewport', async ({page}) => {
  await page.setViewportSize({width:390,height:844}); await page.goto('./'); await page.getByRole('button',{name:'Explore demo'}).click(); await expect(page.locator('#status')).toContainText('loaded');
  await page.evaluate(bytes => { const dt=new DataTransfer(); dt.items.add(new File([new Uint8Array(bytes)],'dropped.splat')); window.dispatchEvent(new DragEvent('drop',{dataTransfer:dt})); },Array.from(demoBytes()));
  await expect(page.locator('#name')).toHaveText('dropped.splat'); await page.screenshot({path:'test-results/viewer-mobile.png',fullPage:true});
});
