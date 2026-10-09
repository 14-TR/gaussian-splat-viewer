import { createOpenCV, matFromArray, matFromImageData } from '@banou/opencv-wasm';
import wasmUrl from '@banou/opencv-wasm/opencv_js.wasm?url';
self.onmessage=async ({data:{images,focal}})=>{
 const started=performance.now();let cv,stage='runtime initialization';const diagnostics={features:[],pairs:[]};const progress=text=>{stage=text;self.postMessage({stage})};const owned=[];const own=x=>{if(!x)throw Error('Native object creation failed');owned.push(x);return x};
 try {
  cv=await createOpenCV({wasmUrl,print:s=>console.log(s),printErr:s=>console.warn(s)});
  const sift=own(cv.SIFT.create(Math.max(images[0].width,images[0].height)>512?4000:1500));const features=[];
  for(const [i,image] of images.entries()){
   progress(`Extracting SIFT features ${i+1}/${images.length}`);
   const rgba=own(matFromImageData(cv,new ImageData(new Uint8ClampedArray(image.data),image.width,image.height))),gray=own(new cv.Mat()),kp=own(new cv.KeyPointVector()),desc=own(new cv.Mat()),mask=own(new cv.Mat());
   cv.cvtColor(rgba,gray,cv.COLOR_RGBA2GRAY);sift.detectAndCompute(gray,mask,kp,desc);
   const points=Array.from({length:kp.size()},(_,j)=>{const k=kp.get(j);const p={x:k.pt.x,y:k.pt.y};k.delete?.();return p});
   features.push({points,desc});diagnostics.features.push({name:image.name,count:points.length});if(points.length<40)throw Error(`Insufficient texture in image ${i+1}: ${points.length} features.`);
  }
  const matcher=own(cv.BFMatcher.create(cv.NORM_L2,false));
  function match(a,b){const pairs=own(new cv.DMatchVectorVector());matcher.knnMatch(a.desc,b.desc,pairs,2);const result=new Map();for(let i=0;i<pairs.size();i++){const pair=pairs.get(i);if(pair.size()>=2){const first=pair.get(0),second=pair.get(1);if(first.distance<.7*second.distance)result.set(first.queryIdx,first.trainIdx);first.delete?.();second.delete?.()}pair.delete()}return result}
  // Match every pair once. Choose the anchor with the most geometrically verified
  // tracks across the selected views, instead of assuming the first photo is central.
  const graph=features.map(()=>new Map());
  for(let from=0;from<features.length;from++)for(let to=from+1;to<features.length;to++){
   progress(`Matching and rejecting outliers ${from+1} ↔ ${to+1}`);
   const forward=match(features[from],features[to]),reverse=match(features[to],features[from]);
   const pairs=[...forward].filter(([a,b])=>reverse.get(b)===a);
   const diagnostic={from:images[from].name,to:images[to].name,reciprocal:pairs.length,inliers:0};diagnostics.pairs.push(diagnostic);
   let verified=[];
   if(pairs.length>=8){
    const a=own(matFromArray(cv,pairs.length,1,cv.CV_32FC2,pairs.flatMap(([i])=>[features[from].points[i].x,features[from].points[i].y]))),b=own(matFromArray(cv,pairs.length,1,cv.CV_32FC2,pairs.flatMap(([,j])=>[features[to].points[j].x,features[to].points[j].y]))),mask=own(new cv.Mat());
    own(cv.findFundamentalMat(a,b,cv.FM_RANSAC,1.5,.999,2000,mask));
    if(!mask.empty())verified=pairs.filter((_,i)=>mask.data[i]);
   }
   diagnostic.inliers=verified.length;graph[from].set(to,new Map(verified));graph[to].set(from,new Map(verified.map(([a,b])=>[b,a])));
  }
  const candidates=features.map((_,from)=>{const views=features.map((_,i)=>i).filter(i=>i!==from);const ids=[...graph[from].get(views[0]).keys()].filter(id=>views.every(to=>graph[from].get(to).has(id)));return {from,ids}}).sort((a,b)=>b.ids.length-a.ids.length);
  const {from:anchor,ids}=candidates[0];diagnostics.anchors=candidates.map(c=>({image:images[c.from].name,sharedTracks:c.ids.length}));diagnostics.selectedAnchor=images[anchor].name;
  const anchors=ids.slice(0,100);if(anchors.length<30)throw Error(`Only ${anchors.length} tracks survive across all images (best anchor ${images[anchor].name}); this spike needs 30. Select 3 closely overlapping views or use 1024 px feature images.`);
  progress(`Reconstructing ${images.length} cameras from ${anchors.length} matched tracks`);
  const tracks=own(new cv.MatVector());
  for(let view=0;view<images.length;view++){const coords=anchors.map(i=>features[view].points[view===anchor?i:graph[anchor].get(view).get(i)]);const matrix=own(matFromArray(cv,2,anchors.length,cv.CV_64FC1,[...coords.map(p=>p.x),...coords.map(p=>p.y)]));tracks.push_back(matrix)}
  const options=own(new cv.sfm.libmv_ReconstructionOptions(0,1,0,0,-1));
  const intrinsics=own(new cv.sfm.libmv_CameraIntrinsicsOptions(0,focal,focal,images[0].width/2,images[0].height/2));
  const reconstruction=own(cv.sfm.SFMLibmvEuclideanReconstruction.create(intrinsics,options));reconstruction.run(tracks); progress('Reading reconstructed cameras and points');
  const rotations=own(new cv.MatVector()),translations=own(new cv.MatVector()),points=own(new cv.MatVector());reconstruction.getCameras(rotations,translations);reconstruction.getPoints(points);
  const cameras=[];for(let i=0;i<rotations.size();i++){const r=own(rotations.get(i)),t=own(translations.get(i));cameras.push({rotation:[...r.data64F],translation:[...t.data64F]})}
  const xyz=[];for(let i=0;i<points.size();i++)xyz.push([...own(points.get(i)).data64F]);
  const centers=cameras.map(({rotation:r,translation:t})=>[0,1,2].map(j=>-(r[j]*t[0]+r[j+3]*t[1]+r[j+6]*t[2])));
  const baseline=Math.max(...centers.map(c=>Math.hypot(...c.map((v,j)=>v-centers[0][j]))));
  const front=xyz.filter(X=>cameras.every(({rotation:r,translation:t})=>r[6]*X[0]+r[7]*X[1]+r[8]*X[2]+t[2]>0)).length;
  diagnostics.frontFacingFraction=front/xyz.length;if(diagnostics.frontFacingFraction<.9)throw Error(`Reconstruction cheirality failed: only ${front}/${xyz.length} points lie in front of every camera.`);
  const error=reconstruction.getError();if(cameras.length!==images.length||xyz.length<30||!xyz.every(p=>p.length===3&&p.every(Number.isFinite))||!Number.isFinite(error)||error>3||!Number.isFinite(baseline)||baseline<1e-6||!cameras.every(c=>[...c.rotation,...c.translation].every(Number.isFinite)))throw Error(`Reconstruction quality failed: ${cameras.length} cameras, ${xyz.length} points, ${error} pixel error.`);
  self.postMessage({ok:true,diagnostics,elapsedMs:performance.now()-started,width:images[0].width,height:images[0].height,featureCounts:features.map(f=>f.points.length),tracks:anchors.length,reprojectionError:error,cameras,cameraCenters:centers,points:xyz,intrinsics:{focal,cx:images[0].width/2,cy:images[0].height/2},note:'Camera reconstruction only; no Gaussian training yet.'});
 }catch(e){let error=e instanceof Error?e.message:String(e);if(typeof e==='number'&&cv)try{error=cv.exceptionFromPtr(e).msg}catch{}self.postMessage({error,failedStage:stage,diagnostics})}
 finally{for(const o of owned.reverse())try{if(!o.isDeleted())o.delete()}catch{}}
};
