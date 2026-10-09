import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark';
import { demoBytes, validateFile, extensions } from './files';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `<header><a class="brand" href="./"><span class="mark">✳</span> gaussian<span class="tag">SPLAT VIEWER</span></a><span class="privacy">● Local & private</span></header>
<main><aside><div class="eyebrow">EXPLORE IN 3D</div><h1>A new perspective.</h1><p class="intro">Open a Gaussian splat scene and see every angle. Your files stay on your device.</p><button id="open" class="primary">＋ Open scene</button><input id="file" type="file" hidden accept="${extensions.map(e => '.' + e).join(',')}"><button id="sample" class="secondary">Explore houseplant <span>↗</span></button><div class="sample-credit">Real scan · 0.87 MiB · <a href="https://marcelpadilla.com/Gaussian_Splat_Object_Dataset/" target="_blank" rel="noopener noreferrer">Marcel Padilla</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a></div><button id="demo" class="secondary">Explore demo <span>↗</span></button><div class="formats">PLY · SPLAT · KSPLAT · SPZ · SOG<br>Single file · up to 256 MiB</div><section class="scene-info"><div class="eyebrow">CURRENT SCENE</div><strong id="name">No scene loaded</strong><div id="stats">Start with a file or the demo</div></section><div class="tools"><button id="reset" disabled>↺ Reset camera</button><label><input id="rotate" type="checkbox"> Auto rotate</label><label>Background <input id="background" type="color" value="#10141b" aria-label="Background color"></label></div><div class="help"><strong>Move around</strong><p>Drag to orbit<br>Right drag to pan<br>Scroll or pinch to zoom<br>Touch: one finger orbit, two pan / zoom</p></div></aside><section id="viewport" aria-label="3D scene viewport"><div id="empty"><div class="orb">✳</div><h2>Your world, in splats.</h2><p>Drop a scene here to get started</p><span>or try the colorful torus demo</span></div><div id="drop">Drop one splat file to open</div><div class="viewport-top"><span>GAUSSIAN WORKSPACE</span><span id="badge">READY</span></div><div class="status" id="status" role="status" aria-live="polite">Ready to explore</div><div class="viewport-bottom">ORBIT · PAN · ZOOM <span>Powered by Spark</span></div></section></main>`;
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const viewport = el<HTMLDivElement>('viewport'), status = el('status');
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(55, 1, .01, 1000);
let renderer: THREE.WebGLRenderer, controls: OrbitControls, current: SplatMesh | undefined;
let busy = false;
let graphicsReady = false;
function message(text: string, error = false) { status.textContent = text; status.classList.toggle('error', error); }
try {
  renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor('#10141b'); viewport.prepend(renderer.domElement);
  renderer.domElement.setAttribute('aria-label', 'Interactive Gaussian splat scene');
  scene.add(new SparkRenderer({ renderer }));
  graphicsReady = true;
  controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.autoRotateSpeed = .8;
  new ResizeObserver(() => { const w = viewport.clientWidth, h = viewport.clientHeight; renderer.setSize(w,h); camera.aspect = w / h; camera.updateProjectionMatrix(); }).observe(viewport);
  camera.position.set(3,2,4);
  renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
  renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); message('Graphics context lost. Reload the page to recover.', true); });
} catch { message('WebGL2 is unavailable. Enable hardware acceleration or try a supported browser.', true); ['open','demo','sample'].forEach(id => el<HTMLButtonElement>(id).disabled = true); }
function reset() {
  if (!current) return;
  current.updateMatrixWorld(true);
  const box = current.getBoundingBox(false).applyMatrix4(current.matrixWorld), center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, .1);
  const distance = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.15;
  controls.target.copy(center); camera.position.copy(center).add(new THREE.Vector3(.65,.35,1).normalize().multiplyScalar(distance));
  camera.near = Math.max(radius / 1000, .0001); camera.far = Math.max(radius * 100, 100); camera.updateProjectionMatrix(); controls.minDistance = radius / 100; controls.maxDistance = radius * 30; controls.update();
}
async function load(name: string, bytes: Uint8Array, upright = false) {
  let candidate: SplatMesh | undefined;
  try {
    message(`Decoding ${name}…`); el('badge').textContent = 'LOADING';
    candidate = new SplatMesh({ fileBytes: bytes, fileName: name });
    await candidate.initialized;
    const box = candidate.getBoundingBox(false);
    if (!candidate.packedSplats?.numSplats || box.isEmpty() || ![...box.min.toArray(), ...box.max.toArray()].every(Number.isFinite)) throw new Error('No valid Gaussian splats found in this file.');
    if (current) { scene.remove(current); current.dispose(); }
    current = candidate; if (upright) current.rotation.x = Math.PI; scene.add(current); reset();
    el('empty').hidden = true; el('name').textContent = name; el('stats').textContent = `${current.packedSplats!.numSplats.toLocaleString()} splats · ${(bytes.length / 1024).toLocaleString(undefined,{maximumFractionDigits:1})} KiB`;
    el<HTMLButtonElement>('reset').disabled = false; message(`${name} loaded — drag to explore`);
  } catch (e) { candidate?.dispose(); message(`Unable to open scene: ${e instanceof Error ? e.message : 'Unsupported or damaged file.'}`, true); }
  finally { busy = false; el('badge').textContent = current ? 'SCENE LOADED' : 'READY'; ['open','demo','sample'].forEach(id => el<HTMLButtonElement>(id).disabled = false); }
}
function begin() { busy = true; ['open','demo','sample'].forEach(id => el<HTMLButtonElement>(id).disabled = true); }
async function openFile(file: File) {
  if (busy || !graphicsReady) return;
  try { validateFile(file); begin(); message(`Reading ${file.name}…`); await load(file.name, new Uint8Array(await file.arrayBuffer())); }
  catch (e) { busy = false; ['open','demo','sample'].forEach(id => el<HTMLButtonElement>(id).disabled = false); message(e instanceof Error ? e.message : 'Could not read file.',true); }
}
el('open').onclick = () => el<HTMLInputElement>('file').click();
el<HTMLInputElement>('file').onchange = e => { const input = e.target as HTMLInputElement; if (input.files?.[0]) void openFile(input.files[0]); input.value = ''; };
el('demo').onclick = () => { if (!busy) { begin(); void load('Colorful torus.splat', demoBytes()); } };
el('sample').onclick = async () => {
  if (busy || !graphicsReady) return;
  begin(); message('Downloading Houseplant sample (0.87 MiB)…');
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}samples/houseplant.splat`);
    if (!response.ok) throw new Error(`Sample download failed (${response.status}). Try again or use the instant demo.`);
    await load('Houseplant.splat', new Uint8Array(await response.arrayBuffer()), true);
  } catch (e) {
    busy = false; ['open','demo','sample'].forEach(id => el<HTMLButtonElement>(id).disabled = false);
    message(e instanceof Error ? e.message : 'Sample download failed. Try the instant demo.', true);
  }
};
el('reset').onclick = reset;
el<HTMLInputElement>('rotate').onchange = e => { if (controls) controls.autoRotate = (e.target as HTMLInputElement).checked; };
el<HTMLInputElement>('background').oninput = e => renderer?.setClearColor((e.target as HTMLInputElement).value);
let dragDepth = 0;
window.addEventListener('dragenter', e => { e.preventDefault(); if (e.dataTransfer?.types.includes('Files')) { dragDepth++; el('drop').classList.add('visible'); } });
window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('dragleave', () => { if (--dragDepth <= 0) el('drop').classList.remove('visible'); });
window.addEventListener('drop', e => { e.preventDefault(); dragDepth = 0; el('drop').classList.remove('visible'); const files = e.dataTransfer?.files; if (files?.length === 1) void openFile(files[0]); else message('Drop exactly one scene file.',true); });
