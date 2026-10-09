import { createGpu, createTrainer, seed, initGaussians, gaussiansToPly, bakeOpacityCompensation } from 'splat.js';
// OpenCV and Splat.js both use row-major world-to-camera R,t: X right, Y down, Z forward.
self.onmessage=async({data:{files,reconstruction,steps}})=>{
 let gpu;
 try{
  const start=performance.now(),images=[];
  for(const file of files){const bm=await createImageBitmap(file),s=Math.min(1,256/Math.max(bm.width,bm.height));const cv=new OffscreenCanvas(Math.round(bm.width*s),Math.round(bm.height*s)),ctx=cv.getContext('2d');ctx.drawImage(bm,0,0,cv.width,cv.height);bm.close();const rgba=ctx.getImageData(0,0,cv.width,cv.height).data,rgb=new Float32Array(cv.width*cv.height*3);for(let i=0;i<cv.width*cv.height;i++)for(let c=0;c<3;c++)rgb[i*3+c]=rgba[i*4+c]/255;images.push({tw:cv.width,th:cv.height,rgb})}
  const scale=images[0].tw/reconstruction.width;
  const cams=reconstruction.cameras.map((c,imgIdx)=>({R:c.rotation,t:c.translation,imgIdx,f:reconstruction.intrinsics.focal*scale,cx:reconstruction.intrinsics.cx*scale,cy:reconstruction.intrinsics.cy*scale}));
  const points=reconstruction.points.map(X=>{const c=cams[0],p=[0,1,2].map(j=>c.R[j*3]*X[0]+c.R[j*3+1]*X[1]+c.R[j*3+2]*X[2]+c.t[j]);const x=Math.max(0,Math.min(images[0].tw-1,Math.round(c.f*p[0]/p[2]+c.cx))),y=Math.max(0,Math.min(images[0].th-1,Math.round(c.f*p[1]/p[2]+c.cy)));return {X,rgb:Array.from(images[0].rgb.slice((y*images[0].tw+x)*3,(y*images[0].tw+x)*3+3))}});
  const model=reconstruction.knownCameras ? initGaussians(points,0,2000) : seed(points,{initTarget:2000,maxGaussians:2000});
  gpu=await createGpu();let error;gpu.device.addEventListener('uncapturederror',e=>{error=e.error.message});gpu.onLost=info=>{error=info.message||'GPU device lost'};
  gpu.device.pushErrorScope('validation');
  const trainer=await createTrainer({gpu,shDeg:0,maxSplats:2000,maxIters:steps,entriesCap:200000,compact:false,mipComp:true,blobRatio:4});
  trainer.setup(model,cams,images,256,192,model.radius);trainer.holdout=cams.length-1;
  const validation=await gpu.device.popErrorScope();if(validation)throw Error(validation.message);
  const setupMs=performance.now()-start,metrics=[];
  const exportModel=async()=>{const m=await trainer.readGaussians();if(!m.data.every(Number.isFinite))throw Error('Non-finite Gaussian parameters');const baked=bakeOpacityCompensation(m.data,m.n,cams[0].f,reconstruction.cameraCenters.flat(),trainer.dilate);return new Uint8Array(await gaussiansToPly(baked,m.n,m.sh,m.shK,m.dc).arrayBuffer())};
  const initialBytes=await exportModel();const initialParams=(await trainer.readGaussians()).data;
  const trainStart=performance.now();
  for(let i=0;i<=steps;i+=50){if(i)for(let k=0;k<50;k++)trainer.stepOnce();await gpu.device.queue.onSubmittedWorkDone();if(error)throw Error(error);metrics.push({iteration:trainer.iter,psnr:await trainer.evalCamPsnr(trainer.holdout)});self.postMessage({stage:`Splat.js: ${trainer.iter}/${steps} iterations; held-out PSNR ${metrics.at(-1).psnr.toFixed(2)} dB`})}
  const trainMs=performance.now()-trainStart,finalParams=(await trainer.readGaussians()).data;
  const parameterDelta=finalParams.reduce((sum,v,i)=>sum+Math.abs(v-initialParams[i]),0);
  if(!(parameterDelta>0)||!metrics.every(m=>Number.isFinite(m.psnr))||metrics.at(-1).psnr<=metrics[0].psnr+.01)throw Error(`Training quality failed: parameter delta ${parameterDelta}, held-out PSNR ${metrics[0].psnr} → ${metrics.at(-1).psnr}`);
  const bytes=await exportModel();
  let gpuProfile;try{gpuProfile=await trainer.profileSteps(10)}catch(e){gpuProfile={error:e.message}}
  self.postMessage({ok:true,engine:'Splat.js',iterations:steps,numSplats:trainer.n,metrics,parameterDelta,timing:{setupMs,trainMs},gpuProfile,intrinsics:cams[0],device:{description:gpu.info.description,maxStorageBuffersPerShaderStage:gpu.device.limits.maxStorageBuffersPerShaderStage},bytes:bytes.buffer,initialBytes:initialBytes.buffer},[bytes.buffer,initialBytes.buffer]);
 }catch(e){self.postMessage({error:e.message||String(e)})}finally{gpu?.dispose()}
};
