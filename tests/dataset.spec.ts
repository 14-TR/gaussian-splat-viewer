import {test,expect} from '@playwright/test';
// @ts-expect-error Experimental worker helper is intentionally standalone JavaScript.
import {cameraToWorld} from '../spike/dataset.js';
test('camera handoff preserves center and converts OpenCV axes to OpenGL',()=>{
 const r=[0,0,1,0,1,0,-1,0,0],t=[2,3,4];
 const c2w=cameraToWorld({rotation:r,translation:t});
 expect(c2w.map((row:number[])=>row.map(v=>v===0?0:v))).toEqual([[0,0,1,4],[0,-1,0,-3],[1,0,0,-2],[0,0,0,1]]);
 // A camera-space point (x,y,z) must round-trip after OpenGL y/z sign conversion.
 const cv=[1,2,5],gl=[cv[0],-cv[1],-cv[2]];
 const world=c2w.slice(0,3).map((row:number[])=>row[3]+row.slice(0,3).reduce((sum,v,i)=>sum+v*gl[i],0));
 const recovered=[0,1,2].map(i=>r.slice(i*3,i*3+3).reduce((sum,v,j)=>sum+v*world[j],t[i]));
 expect(recovered).toEqual(cv);
});
