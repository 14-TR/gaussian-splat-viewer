import {cp,mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
await mkdir('dist/third-party',{recursive:true});
for(const [name,file] of Object.entries({
 'OpenCV-facade-LICENSE.txt':'node_modules/@banou/opencv-wasm/LICENSE',
 'OpenCV-THIRD_PARTY_NOTICES.md':'node_modules/@banou/opencv-wasm/THIRD_PARTY_NOTICES.md',
 'Spark-LICENSE.txt':'node_modules/@sparkjsdev/spark/LICENSE',
 'Three-LICENSE.txt':'node_modules/three/LICENSE',
 'Splat.js-LICENSE.txt':'licenses/Splat.js-LICENSE.txt'
}))await cp(file,`dist/third-party/${name}`);
await cp('node_modules/@banou/opencv-wasm/lib/licenses','dist/third-party/opencv-native',{recursive:true});
await writeFile('dist/third-party/README.txt',`Third-party licenses and source attribution\n\nSpark 2.3.1 (MIT): https://github.com/sparkjsdev/spark\nThree.js (MIT): https://github.com/mrdoob/three.js\nSplat.js (MIT), source commit 88efe9aaf32279b0b9bcb781ea0deb4d60c49dff:\nhttps://github.com/arrival-space/splat.js/tree/88efe9aaf32279b0b9bcb781ea0deb4d60c49dff\nIts unchanged package also contains Mediabunny (MPL-2.0): https://github.com/Vanilagy/mediabunny\nOpenCV WASM facade 0.0.6 (Apache-2.0): https://github.com/banou26/opencv-wasm\nFull native notices and licenses are in opencv-native/ and OpenCV-THIRD_PARTY_NOTICES.md.\n\nThe original application's license remains undecided. These dependency notices do not license the original code.\n`);
const commit=process.env.GITHUB_SHA||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
await writeFile('dist/build-info.json',JSON.stringify({commit,repository:'14-TR/gaussian-splat-viewer'},null,2)+'\n');
console.log('Collected dependency notices and build commit marker');
