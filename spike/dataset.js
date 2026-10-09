// Convert estimated OpenCV world-to-camera poses to Nerfstudio/OpenGL camera-to-world.
export function cameraToWorld({rotation:r,translation:t}) {
  const c=[0,1,2].map(j=>-(r[j]*t[0]+r[j+3]*t[1]+r[j+6]*t[2]));
  return [[r[0],-r[3],-r[6],c[0]],[r[1],-r[4],-r[7],c[1]],[r[2],-r[5],-r[8],c[2]],[0,0,0,1]];
}
export async function writeDataset(directory, files, result) {
  const images=await directory.getDirectoryHandle('images',{create:true});let firstPixels,width,height;
  const frames=[];
  async function put(dir,name,contents){const f=await dir.getFileHandle(name,{create:true});const writable=await f.createWritable();await writable.write(contents);await writable.close()}
  for(let i=0;i<files.length;i++){
    const bitmap=await createImageBitmap(files[i]);const scale=Math.min(1,512/Math.max(bitmap.width,bitmap.height));
    const canvas=new OffscreenCanvas(Math.round(bitmap.width*scale),Math.round(bitmap.height*scale));const context=canvas.getContext('2d');context.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
    width=canvas.width;height=canvas.height;if(i===0)firstPixels=context.getImageData(0,0,width,height).data;
    await put(images,`view-${i}.png`,await canvas.convertToBlob({type:'image/png'}));
    frames.push({file_path:`images/view-${i}.png`,transform_matrix:cameraToWorld(result.cameras[i])});
  }
  const {focal,cx,cy}=result.intrinsics;
  await put(directory,'transforms.json',JSON.stringify({fl_x:focal,fl_y:focal,cx,cy,w:width,h:height,ply_file_path:'init.ply',frames}));
  // This is initialization from SfM points and photo colors, not the trained/exported result.
  const header=`ply\nformat ascii 1.0\nelement vertex ${result.points.length}\nproperty float x\nproperty float y\nproperty float z\nproperty uchar red\nproperty uchar green\nproperty uchar blue\nend_header\n`;
  const {rotation:r,translation:t}=result.cameras[0];
  const rows=result.points.map(p=>{const q=[0,1,2].map(i=>r[i*3]*p[0]+r[i*3+1]*p[1]+r[i*3+2]*p[2]+t[i]);const u=Math.max(0,Math.min(width-1,Math.round(focal*q[0]/q[2]+cx))),v=Math.max(0,Math.min(height-1,Math.round(focal*q[1]/q[2]+cy))),o=(v*width+u)*4;return `${p.join(' ')} ${firstPixels[o]} ${firstPixels[o+1]} ${firstPixels[o+2]}`});
  await put(directory,'init.ply',header+rows.join('\n')+'\n');
  return {width,height,frames:frames.length,initialPoints:result.points.length};
}
