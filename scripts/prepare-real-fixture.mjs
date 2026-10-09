// Run with the licensed original photo directory; never fetch or upload inputs.
import {chromium} from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const source=process.argv[2];if(!source)throw Error('Usage: node scripts/prepare-real-fixture.mjs /path/to/licensed/originals');
const expected={
 '01':'49cc69b7e2e8999252c71536cc5a8a0ee32ae25d56d896969542653fa93e4858',
 '02':'a0921ae9729fb92088f8335ed80cfcdede56a974dc07dc9501ab9eea37875d7a',
 '03':'3aae3bbf830469ea8711915545627692b9655de9f881fa0b9a128543b8fb4be1'};
await mkdir('tests/fixtures/skull',{recursive:true});const browser=await chromium.launch();
try{const page=await browser.newPage();for(const name of Object.keys(expected)){
 const bytes=await readFile(`${source}/${name}.JPG`);if(createHash('sha256').update(bytes).digest('hex')!==expected[name])throw Error(`Unexpected source image ${name}`);
 const resized=await page.evaluate(async data=>{const bitmap=await createImageBitmap(new Blob([new Uint8Array(data)]));const canvas=new OffscreenCanvas(1024,Math.round(bitmap.height*1024/bitmap.width));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();return Array.from(new Uint8Array(await(await canvas.convertToBlob({type:'image/png'})).arrayBuffer()))},Array.from(bytes));
 await writeFile(`tests/fixtures/skull/${name}.png`,new Uint8Array(resized));console.log(`${name}: resized to 1024 px, ${resized.length} bytes`);
}}finally{await browser.close()}
