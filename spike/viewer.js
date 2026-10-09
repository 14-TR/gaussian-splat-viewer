import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {SparkRenderer,SplatMesh} from '@sparkjsdev/spark';
import {cameraToWorld} from './dataset.js';
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),renderer=new THREE.WebGLRenderer({antialias:false});
renderer.setClearColor('#10141b');renderer.setSize(768,576);document.body.append(renderer.domElement);scene.add(new SparkRenderer({renderer}));
const controls=new OrbitControls(camera,renderer.domElement);let reset;
document.getElementById('reset').onclick=()=>reset?.();
renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera)});
window.addEventListener('message',async e=>{
 if(e.source!==parent||e.origin!==location.origin||!e.data.bytes)return;
 try{const {bytes,reconstruction}=e.data,pose=reconstruction.cameras[0],matrix=new THREE.Matrix4().set(...cameraToWorld(pose).flat());
 renderer.setSize(768,Math.round(768*reconstruction.height/reconstruction.width));const mesh=new SplatMesh({fileBytes:bytes,fileName:'trained.ply'});await mesh.initialized;scene.add(mesh);
 reset=()=>{camera.matrix.copy(matrix);matrix.decompose(camera.position,camera.quaternion,camera.scale);camera.up.setFromMatrixColumn(matrix,1);camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(reconstruction.height/(2*reconstruction.intrinsics.focal)));camera.aspect=reconstruction.width/reconstruction.height;camera.near=.001;camera.far=1000;camera.updateProjectionMatrix();const forward=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);const distance=mesh.getBoundingBox(false).getCenter(new THREE.Vector3()).distanceTo(camera.position);controls.target.copy(camera.position).addScaledVector(forward,distance);controls.update()};reset();document.getElementById('status').textContent=`${mesh.packedSplats.numSplats} splats loaded — drag to orbit`;
 }catch(e){document.getElementById('status').textContent=e.message}
});
