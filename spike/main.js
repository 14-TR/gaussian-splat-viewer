import { fixture } from './fixture.js';
const el=id=>document.getElementById(id);let files=[], worker, timer, generation=0;
window.spikeResult=null;
function status(text){el('status').textContent=text}
function stop(){generation++;worker?.terminate();worker=null;clearTimeout(timer);el('cancel').disabled=true;el('run').disabled=!files.length;el('photos').disabled=false;el('fixture').disabled=false}
async function select(next){
 if(next.length<3||next.length>6)throw Error('Select 3–6 photos.');
 if(next.reduce((n,f)=>n+f.size,0)>24*1024*1024)throw Error('Photo set exceeds 24 MiB.');
 if(next.some(f=>!['image/png','image/jpeg'].includes(f.type)))throw Error('Use JPEG or PNG photos.');
 window.spikeResult=null;files=next;el('run').disabled=false;el('images').replaceChildren();
 for(const f of files){const img=document.createElement('img');const url=URL.createObjectURL(f);img.src=url;img.width=160;img.onload=()=>URL.revokeObjectURL(url);el('images').append(img)}
 status(`${files.length} photos selected. Set the approximate resized-image focal length before reconstructing.`);
}
el('photos').onchange=async e=>{try{await select([...e.target.files])}catch(e){status(e.message)}};
el('fixture').onclick=async()=>{try{const data=await fixture();el('focal').value=data.focal;window.fixtureTruth=data.truth;await select(data.files)}catch(e){status(e.message)}};
el('run').onclick=async()=>{
 try {
  const focal=Number(el('focal').value);if(!Number.isFinite(focal)||focal<50||focal>2000)throw Error('Focal length must be 50–2000 pixels.');
  el('run').disabled=true;el('photos').disabled=true;el('fixture').disabled=true;el('cancel').disabled=false;window.spikeResult=null;
  const token=++generation;const images=[];
  for(const file of files){const bitmap=await createImageBitmap(file);const scale=Math.min(1,512/Math.max(bitmap.width,bitmap.height));const canvas=new OffscreenCanvas(Math.round(bitmap.width*scale),Math.round(bitmap.height*scale));const context=canvas.getContext('2d');context.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();if(token!==generation)return;const pixels=context.getImageData(0,0,canvas.width,canvas.height);images.push({name:file.name,width:canvas.width,height:canvas.height,data:pixels.data.buffer})}
  if(images.some(i=>i.width!==images[0].width||i.height!==images[0].height))throw Error('This bounded spike requires equal image dimensions.');
  if(token!==generation)return;
  status('Loading local OpenCV WASM worker…');worker=new Worker(new URL('./pose.worker.js',import.meta.url),{type:'module'});
  timer=setTimeout(()=>{stop();status('Stopped: 90-second reconstruction budget exceeded.');window.spikeResult={error:'timeout'}},90000);
  worker.onmessage=e=>{if(e.data.stage)status(e.data.stage);else{window.spikeResult=e.data;status(JSON.stringify(e.data,null,2));stop()}};
  worker.onerror=e=>{window.spikeResult={error:e.message};status(e.message);stop()};
  worker.postMessage({images,focal},images.map(i=>i.data));
 }catch(e){stop();status(e.message);window.spikeResult={error:e.message}}
};
el('cancel').onclick=()=>{stop();status('Cancelled. No photos were uploaded.');window.spikeResult={cancelled:true}};

const download=document.createElement('button');download.textContent='Export reconstruction JSON';document.body.append(download);download.onclick=()=>{if(!window.spikeResult?.ok){status('Reconstruct cameras successfully before exporting.');return}const blob=new Blob([JSON.stringify(window.spikeResult,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='camera-reconstruction.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
