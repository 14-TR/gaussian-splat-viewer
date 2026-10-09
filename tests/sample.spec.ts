import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
test('one-tap real sample renders at phone size with touch orbit and pinch/pan', async ({ page, context }) => {
  test.setTimeout(120000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const failed: string[] = []; page.on('response', r => { if(r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
  await page.goto('./');
  await page.getByRole('button', { name: 'Explore houseplant' }).tap();
  await expect(page.locator('#stats')).toContainText('28,412', { timeout: 30000 });
  const canvas = page.locator('canvas'); await canvas.scrollIntoViewIfNeeded();
  await expect.poll(async () => {
    const png = PNG.sync.read(await canvas.screenshot()); let green = 0;
    for(let i=0;i<png.data.length;i+=4) { const [r,g,b] = png.data.subarray(i,i+3); if(g>r*1.15 && g>b*1.15 && g>45) green++; }
    return green;
  }, { timeout: 30000 }).toBeGreaterThan(500);
  const before = await canvas.screenshot({path:'test-results/houseplant-initial.png'});
  const box = (await canvas.boundingBox())!;
  const x=box.x+box.width/2, y=Math.max(100, Math.min(box.y+box.height/2,700));
  const client = await context.newCDPSession(page);
  await client.send('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:[{x,y,id:1}]});
  for(let i=1;i<=2;i++) await client.send('Input.dispatchTouchEvent', {type:'touchMove',touchPoints:[{x:x+i*40,y:y+i*2,id:1}]});
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect.poll(async () => (await canvas.screenshot()).equals(before), {timeout:30000}).toBe(false);
  const orbited = await canvas.screenshot();
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-30,y,id:1},{x:x+30,y,id:2}]});
  for(let i=1;i<=2;i++) await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-30-i*15,y:y+i*4,id:1},{x:x+30+i*15,y:y+i*4,id:2}]});
  await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect.poll(async () => (await canvas.screenshot()).equals(orbited), {timeout:30000}).toBe(false);
  await page.screenshot({path:'test-results/houseplant-phone.png',fullPage:true});
  expect(errors).toEqual([]); expect(failed).toEqual([]);
});
