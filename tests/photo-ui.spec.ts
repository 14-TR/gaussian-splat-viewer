import {test,expect} from '@playwright/test';
test('experimental entry retains viewer and photo page fits a phone viewport',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('./');
 await expect(page.getByRole('button',{name:'Open scene'})).toBeVisible();
 const link=page.getByRole('link',{name:'Experimental: Create from photos'});await expect(link).toBeVisible();await link.click();
 await expect(page.getByRole('heading',{name:'Experimental: Create from photos'})).toBeVisible();
 await expect(page.locator('body')).toContainText('3–6 JPEG or PNG');await expect(page.locator('body')).toContainText('24 MiB');await expect(page.locator('body')).toContainText('WebGPU');await expect(page.locator('body')).toContainText('no photos are uploaded');
 await expect(page.locator('#train')).toBeDisabled();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/photo-ui-phone.png',fullPage:true});
 await page.getByRole('link',{name:'Back to splat viewer'}).click();await expect(page.locator('#open')).toBeVisible();
});
