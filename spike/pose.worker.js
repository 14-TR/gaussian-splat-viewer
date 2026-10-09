import { createOpenCV, matFromArray, matFromImageData } from '@banou/opencv-wasm';
import wasmUrl from '@banou/opencv-wasm/opencv_js.wasm?url';
self.onmessage=async ({data:{images,focal}})=>{
 const started=performance.now();let cv,stage='runtime initialization';const progress=text=>{stage=text;self.postMessage({stage})};const owned=[];const own=x=>{if(!x)throw Error('Native object creation failed');owned.push(x);return x};
 try {
  cv=await createOpenCV({wasmUrl,print:s=>console.log(s),printErr:s=>console.warn(s)});
  const sift=own(cv.SIFT.create(1500));const features=[];
  for(const [i,image] of images.entries()){
   progress(`Extracting SIFT features ${i+1}/${images.length}`);
   const rgba=own(matFromImageData(cv,new ImageData(new Uint8ClampedArray(image.data),image.width,image.height))),gray=own(new cv.Mat()),kp=own(new cv.KeyPointVector()),desc=own(new cv.Mat()),mask=own(new cv.Mat());
   cv.cvtColor(rgba,gray,cv.COLOR_RGBA2GRAY);sift.detectAndCompute(gray,mask,kp,desc);
   const points=Array.from({length:kp.size()},(_,j)=>{const k=kp.get(j);const p={x:k.pt.x,y:k.pt.y};k.delete?.();return p});
   features.push({points,desc});if(points.length<40)throw Error(`Insufficient texture in image ${i+1}: ${points.length} features.`);
  }
  const matcher=own(cv.BFMatcher.create(cv.NORM_L2,false));
  function match(a,b){const pairs=own(new cv.DMatchVectorVector());matcher.knnMatch(a.desc,b.desc,pairs,2);const result=new Map();for(let i=0;i<pairs.size();i++){const pair=pairs.get(i);if(pair.size()>=2){const first=pair.get(0),second=pair.get(1);if(first.distance<.7*second.distance)result.set(first.queryIdx,first.trainIdx);first.delete?.();second.delete?.()}pair.delete()}return result}
  const maps=[];
  for(let view=1;view<features.length;view++){
   progress(`Matching and rejecting outliers 1 ↔ ${view+1}`);
   const forward=match(features[0],features[view]),reverse=match(features[view],features[0]);const pairs=[...forward].filter(([a,b])=>reverse.get(b)===a);if(pairs.length<30)throw Error(`Only ${pairs.length} reciprocal matches for image ${view+1}.`);
   const a=own(matFromArray(cv,pairs.length,1,cv.CV_32FC2,pairs.flatMap(([i])=>[features[0].points[i].x,features[0].points[i].y]))),b=own(matFromArray(cv,pairs.length,1,cv.CV_32FC2,pairs.flatMap(([,j])=>[features[view].points[j].x,features[view].points[j].y]))),mask=own(new cv.Mat());
   own(cv.findFundamentalMat(a,b,cv.FM_RANSAC,1.5,.999,2000,mask));if(mask.empty())throw Error(`Geometric verification failed for image ${view+1}.`);
   maps.push(new Map(pairs.filter((_,i)=>mask.data[i])));
  }
  const anchors=[...maps[0].keys()].filter(i=>maps.every(m=>m.has(i))).slice(0,100);if(anchors.length<30)throw Error(`Only ${anchors.length} tracks survive across all images; this spike needs 30.`);
  progress(`Reconstructing ${images.length} cameras from ${anchors.length} matched tracks`);
  const tracks=own(new cv.MatVector());
  for(let view=0;view<images.length;view++){const coords=anchors.map(i=>features[view].points[view?maps[view-1].get(i):i]);const matrix=own(matFromArray(cv,2,anchors.length,cv.CV_64FC1,[...coords.map(p=>p.x),...coords.map(p=>p.y)]));tracks.push_back(matrix)}
  const options=own(new cv.sfm.libmv_ReconstructionOptions(0,1,0,0,-1));
  const intrinsics=own(new cv.sfm.libmv_CameraIntrinsicsOptions(0,focal,focal,images[0].width/2,images[0].height/2));
  const reconstruction=own(cv.sfm.SFMLibmvEuclideanReconstruction.create(intrinsics,options));reconstruction.run(tracks); progress('Reading reconstructed cameras and points');
  const rotations=own(new cv.MatVector()),translations=own(new cv.MatVector()),points=own(new cv.MatVector());reconstruction.getCameras(rotations,translations);reconstruction.getPoints(points);
  const cameras=[];for(let i=0;i<rotations.size();i++){const r=own(rotations.get(i)),t=own(translations.get(i));cameras.push({rotation:[...r.data64F],translation:[...t.data64F]})}
  const xyz=[];for(let i=0;i<points.size();i++)xyz.push([...own(points.get(i)).data64F]);
  const centers=cameras.map(({rotation:r,translation:t})=>[0,1,2].map(j=>-(r[j]*t[0]+r[j+3]*t[1]+r[j+6]*t[2])));
  const baseline=Math.max(...centers.map(c=>Math.hypot(...c.map((v,j)=>v-centers[0][j]))));
  const error=reconstruction.getError();if(cameras.length!==images.length||xyz.length<30||!xyz.every(p=>p.length===3&&p.every(Number.isFinite))||!Number.isFinite(error)||error>3||!Number.isFinite(baseline)||baseline<1e-6||!cameras.every(c=>[...c.rotation,...c.translation].every(Number.isFinite)))throw Error(`Reconstruction quality failed: ${cameras.length} cameras, ${xyz.length} points, ${error} pixel error.`);
  self.postMessage({ok:true,elapsedMs:performance.now()-started,width:images[0].width,height:images[0].height,featureCounts:features.map(f=>f.points.length),tracks:anchors.length,reprojectionError:error,cameras,cameraCenters:centers,points:xyz,intrinsics:{focal,cx:images[0].width/2,cy:images[0].height/2},note:'Camera reconstruction only; no Gaussian training yet.'});
 }catch(e){let error=e instanceof Error?e.message:String(e);if(typeof e==='number'&&cv)try{error=cv.exceptionFromPtr(e).msg}catch{}self.postMessage({error,failedStage:stage})}
 finally{for(const o of owned.reverse())try{if(!o.isDeleted())o.delete()}catch{}}
};
