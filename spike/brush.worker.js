import init,{BrushApp,BrushMessageKind} from './brush-pkg/brush_js.js';
import {writeDataset} from './dataset.js';
self.onmessage=async({data:{files,reconstruction,jobId,steps=400}})=>{
  let app,training,snapshot,parent;
  const metrics=[];let actualIter=0;
  try{
    if(!navigator.gpu)throw Error('WebGPU is unavailable in this browser worker.');
    const adapter=await navigator.gpu.requestAdapter();if(!adapter)throw Error('No WebGPU adapter was found. Use a supported desktop browser with hardware acceleration.');
    if(adapter.limits.maxStorageBuffersPerShaderStage<12)throw Error(`This Brush build needs at least 12 storage buffers per shader stage; your WebGPU adapter supports ${adapter.limits.maxStorageBuffersPerShaderStage}. Camera reconstruction remains available. Training is blocked on this browser/device.`);
    self.postMessage({stage:'Preparing temporary local camera dataset…'});
    const root=await navigator.storage.getDirectory();parent=await root.getDirectoryHandle('gaussian-browser-jobs',{create:true});const directory=await parent.getDirectoryHandle(jobId,{create:true});
    const info=await writeDataset(directory,files,reconstruction);
    self.postMessage({stage:'Initializing Brush WebGPU training…'});
    // Current CubeCL WGSL omits the browser's required subgroup extension directive.
    // Add only the missing declaration; kernels and optimization remain upstream Brush.
    const createShaderModule=GPUDevice.prototype.createShaderModule;
    GPUDevice.prototype.createShaderModule=function(descriptor){
      const code=descriptor.code,count=(code.match(/var<storage,/g)||[]).length;
      if(count>this.limits.maxStorageBuffersPerShaderStage)throw Error(`Brush kernel ${descriptor.label} needs ${count} storage buffers; this device permits ${this.limits.maxStorageBuffersPerShaderStage}.`);
      return createShaderModule.call(this,{...descriptor,code:code.includes('subgroup')&&!code.includes('enable subgroups;')?`enable subgroups;\n${code}`:code});
    };
    await init({module_or_path:new URL('./brush-pkg/brush_js_bg.wasm',import.meta.url)});app=new BrushApp();
    const device=await adapter.requestDevice({requiredFeatures:['shader-f16','subgroups','timestamp-query'].filter(f=>adapter.features.has(f)),requiredLimits:{maxStorageBuffersPerShaderStage:adapter.limits.maxStorageBuffersPerShaderStage,maxStorageBufferBindingSize:Math.min(256*1024*1024,adapter.limits.maxStorageBufferBindingSize),maxBufferSize:Math.min(256*1024*1024,adapter.limits.maxBufferSize),maxComputeWorkgroupStorageSize:adapter.limits.maxComputeWorkgroupStorageSize}});
    device.lost.then(info=>self.postMessage({error:`WebGPU device lost: ${info.reason}: ${info.message}`}));
    app.initExisting(adapter,device,device.queue);
    training=app.startTrainingFromDirectory(directory,async config=>({...config,'total-train-iters':Math.min(400,Math.max(50,steps)),'max-splats':2000,'max-resolution':256,'max-scene-batch-cache-size':64*1024*1024,'eval-split-every':4,'eval-every':50,'sh-degree':0,'refine-every':50,'growth-stop-iter':350,'lpips-loss-weight':0,'background-noise-strength':0,'mean-noise-weight':0,'rerun-enabled':false}));
    let initialBytes,done=false,loaded;
    while(!done){
      const messages=await training.trainSteps(5);if(!messages.length)break;
      for(const message of messages){
        if(message.kind===BrushMessageKind.DatasetLoaded)loaded={trainViews:message.trainViews,evalViews:message.evalViews};
        if(message.kind===BrushMessageKind.TrainStep){actualIter=message.iter;self.postMessage({stage:`Training Gaussians: ${actualIter}/${steps}`,iter:actualIter})}
        if(message.kind===BrushMessageKind.EvalResult){const value={iter:message.iter,psnr:message.psnr,ssim:message.ssim};metrics.push(value);self.postMessage({stage:`Held-out evaluation at ${value.iter}: ${value.psnr?.toFixed(2)} dB PSNR`,metric:value})}
        if(message.kind===BrushMessageKind.Warning)self.postMessage({stage:`Brush warning: ${message.text}`});
        if(message.kind===BrushMessageKind.DoneTraining)done=true;
        message.free();
      }
      if(!initialBytes){snapshot=training.currentSplats();if(snapshot){initialBytes=await snapshot.exportPly();snapshot.free();snapshot=null}}
    }
    if(actualIter<50)throw Error(`Training ended before its minimum step budget: ${actualIter}.`);
    if(metrics.length>1&&metrics.at(-1).psnr<=metrics[0].psnr+.01)throw Error('Training did not improve held-out PSNR; no trained output is offered.');
    snapshot=training.currentSplats();if(!snapshot||!snapshot.numSplats||snapshot.numSplats>2000)throw Error('No valid bounded trained splats were produced.');
    self.postMessage({stage:'Exporting trained Gaussian PLY through Brush…'});
    const bytes=await snapshot.exportPly(),count=snapshot.numSplats;
    if(!bytes.length)throw Error('Brush exported an empty PLY.');
    self.postMessage({ok:true,bytes:bytes.buffer,initialBytes:initialBytes.buffer,numSplats:count,iterations:actualIter,metrics,dataset:info,loaded,source:'Actual Brush WebGPU training from reconstructed camera dataset'},[bytes.buffer,initialBytes.buffer]);
  }catch(e){self.postMessage({error:e instanceof Error?e.message:String(e),stage:'Gaussian training failed',iterations:actualIter,metrics})}
  finally{snapshot?.free();training?.free();app?.free();try{await parent?.removeEntry(jobId,{recursive:true})}catch{}}
};
