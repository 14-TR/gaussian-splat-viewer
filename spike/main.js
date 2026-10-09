import { fixture } from './fixture.js';
const el=id=>document.getElementById(id);let files=[], worker, timer, generation=0;
window.spikeResult=null;
function status(text){el('status').textContent=text}
function stop(){generation++;worker?.terminate();worker=null;clearTimeout(timer);el('cancel').disabled=true;el('run').disabled=!files.length;el('photos').disabled=false;el('fixture').disabled=false}
async function select(next){
 if(next.length<3||next.length>6)throw Error('Select 3–6 photos.');
 if(next.reduce((n,f)=>n+f.size,0)>24*1024*1024)throw Error('Photo set exceeds 24 MiB.');
 if(next.some(f=>!['image/png','image/jpeg'].includes(f.type)))throw Error('Use JPEG or PNG photos.');
 window.spikeResult=null;window.trainingResult=null;trainedBlob=null;plyButton.disabled=true;preview.style.display='none';files=next;el('run').disabled=false;el('images').replaceChildren();
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

const trainButton=document.createElement('button');trainButton.id='train';trainButton.textContent='Train Gaussians from reconstructed cameras';document.body.append(trainButton);
const plyButton=document.createElement('button');plyButton.id='export-ply';plyButton.textContent='Export trained PLY';plyButton.disabled=true;document.body.append(plyButton);
const preview=document.createElement('iframe');preview.id='trained-viewer';preview.title='Trained Gaussian splats in Spark';preview.style.cssText='width:100%;height:800px;border:0;display:none';document.body.append(preview);
let trainedBlob;
window.trainingResult=null;
const originalCancel=el('cancel').onclick;
el('cancel').onclick=()=>{const reconstruction=window.spikeResult;if(trainButton.disabled){originalCancel();window.spikeResult=reconstruction}else originalCancel();window.trainingResult={cancelled:true};trainButton.disabled=false;known.disabled=false};
trainButton.onclick=async()=>{
 if(!window.spikeResult?.ok){status('Reconstruct cameras successfully before training.');return}
 if(!navigator.gpu){status('Training requires WebGPU.');return}
 try{
  window.trainingResult=null;trainedBlob=null;plyButton.disabled=true;preview.style.display='none';el('run').disabled=true;el('fixture').disabled=true;el('photos').disabled=true;const token=++generation;trainButton.disabled=true;known.disabled=true;el('cancel').disabled=false;
  const adapter=await navigator.gpu.requestAdapter();
  if(token!==generation)return;
  if(!adapter)throw Error('No WebGPU adapter is available. Use hardware acceleration in a supported browser.');
  const limit=adapter.limits.maxStorageBuffersPerShaderStage;
  if(limit<8)throw Error(`Training blocked: Splat.js needs at least 8 storage buffers per shader stage; this browser/device supports ${limit}. Camera reconstruction remains available.`);
  const reconstruction=window.spikeResult;trainButton.disabled=true;known.disabled=true;plyButton.disabled=true;preview.style.display='none';trainedBlob=null;window.trainingResult=null;el('run').disabled=true;el('fixture').disabled=true;el('photos').disabled=true;el('cancel').disabled=false;
  status('Starting bounded local Gaussian training…');
  worker=new Worker(new URL('./train.worker.js',import.meta.url),{type:'module'});
  timer=setTimeout(()=>{stop();trainButton.disabled=false;known.disabled=false;status('Training stopped at its 180-second budget.');window.trainingResult={error:'timeout'}},180000);
  worker.onerror=e=>{stop();trainButton.disabled=false;known.disabled=false;status(`Training engine error: ${e.message}`);window.trainingResult={error:e.message}};
  worker.onmessage=async({data})=>{
   if(data.ok){
    const bytes=new Uint8Array(data.bytes);trainedBlob=new Blob([bytes],{type:'application/octet-stream'});plyButton.disabled=false;
    window.trainingResult={...data,bytes,initialBytes:new Uint8Array(data.initialBytes)};
    status(`Trained ${data.numSplats} Gaussians for ${data.iterations} iterations. Loading exported PLY into Spark…\n${JSON.stringify(data.metrics,null,2)}`);
    stop();trainButton.disabled=false;known.disabled=false;preview.style.display='block';
    preview.onload=()=>preview.contentWindow.postMessage({bytes,reconstruction},location.origin);
    preview.src='./viewer.html';
   }else if(data.error){window.trainingResult=data;status(`Gaussian training failed: ${data.error}`);stop();trainButton.disabled=false;known.disabled=false}
   else if(data.stage)status(data.stage);
  };
  worker.postMessage({files,reconstruction,steps:Math.round(Math.min(4000,Math.max(50,Number(el('steps').value)||4000))/50)*50});
 }catch(e){stop();trainButton.disabled=false;known.disabled=false;status(e.message);window.trainingResult={error:e.message}}
};
plyButton.onclick=()=>{if(!trainedBlob)return;const url=URL.createObjectURL(trainedBlob),a=document.createElement('a');a.href=url;a.download='trained-reconstruction.ply';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};

const known=document.createElement('button');known.id='known';known.textContent='Test known-camera training';document.body.append(known);known.onclick=async()=>{const data=await fixture();await select(data.files);el('focal').value=data.focal;const cameras=data.truth.x.map(x=>({rotation:[1,0,0,0,-1,0,0,0,-1],translation:[-x,0,4]}));const points=[];for(const [x,y,z] of [[-.85,.1,0],[.85,.25,-.6],[0,-.65,.3]])for(let u=0;u<24;u++)for(let v=0;v<24;v++)points.push([x+(u/23-.5)*1.4,y+(v/23-.5)*1.5,z]);window.spikeResult={ok:true,cameras,cameraCenters:data.truth.x.map(x=>[x,0,4]),points,intrinsics:{focal:data.focal,cx:256,cy:192},knownCameras:true,width:512,height:384};trainButton.click()};
