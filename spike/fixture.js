import * as THREE from 'three';
// Original procedural scene; no photographs, models, fonts or textures from outside sources.
// Ground-truth camera poses are never sent to the reconstruction worker.
export async function fixture() {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#363c47');
  const camera = new THREE.PerspectiveCamera(50, 512/384, .1, 20);
  const renderer = new THREE.WebGLRenderer({preserveDrawingBuffer:true}); renderer.setSize(512,384);
  let seed=47; const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296};
  for(const [x,y,z] of [[-.85,.1,0],[.85,.25,-.6],[0,-.65,.3]]) {
    const textureCanvas=document.createElement('canvas'); textureCanvas.width=512;textureCanvas.height=512;
    const ctx=textureCanvas.getContext('2d');ctx.fillStyle='#d6d9dc';ctx.fillRect(0,0,512,512);
    for(let i=0;i<500;i++){ctx.fillStyle=`rgb(${Math.floor(random()*200)},${Math.floor(random()*200)},${Math.floor(random()*200)})`;ctx.fillRect(random()*500,random()*500,5+random()*25,5+random()*25)}
    const texture=new THREE.CanvasTexture(textureCanvas); texture.colorSpace=THREE.SRGBColorSpace;
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1.4,1.5),new THREE.MeshBasicMaterial({map:texture}));mesh.position.set(x,y,z);scene.add(mesh);
  }
  const files=[];
  for(const [i,x] of [-.24,-.08,.08,.24].entries()) {
    camera.position.set(x,0,4); camera.rotation.set(0,0,0);renderer.render(scene,camera);
    const blob=await new Promise(resolve=>renderer.domElement.toBlob(resolve,'image/png'));
    files.push(new File([blob],`fixture-${i}.png`,{type:'image/png'}));
  }
  scene.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.map?.dispose();o.material.dispose()}});renderer.dispose();
  return {files, focal:384/(2*Math.tan(25*Math.PI/180)), truth:{x:[-.24,-.08,.08,.24]}};
}
