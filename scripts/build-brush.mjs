import { spawnSync } from 'node:child_process';
import { mkdtemp,copyFile,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'..');
const revision='1388f74c6fe0236f68ee4915564bf00e9d2e3747';
const source=await mkdtemp(resolve(tmpdir(),'viewer-brush-'));
function run(command,args,cwd=source){const r=spawnSync(command,args,{cwd,stdio:'inherit',env:{...process.env,RUSTUP_TOOLCHAIN:'1.95.0'}});if(r.status!==0)throw Error(`${command} failed (${r.status})`)}
run('git',['clone','https://github.com/ArthurBrussee/brush.git','.']);
run('git',['checkout','--detach',revision]);
run('git',['apply',resolve(root,'scripts/brush-browser.patch')]);
run(resolve(root,'node_modules/.bin/wasm-pack'),['build','apps/brush-js','--dev','--target','web','--out-dir',resolve(root,'spike/brush-pkg'),'--','--locked']);
await copyFile(resolve(source,'LICENSE'),resolve(root,'spike/brush-pkg/LICENSE'));
await writeFile(resolve(root,'spike/brush-pkg/PROVENANCE.json'),JSON.stringify({source:'https://github.com/ArthurBrussee/brush',revision,license:'Apache-2.0',patch:'scripts/brush-browser.patch',rust:'1.95.0',profile:'dev'},null,2));
console.log(`Built pinned official Brush source in ${source}. Build files remain there for inspection.`);
