import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
const source = 'https://raw.githubusercontent.com/marcelpadilla/splats/c3e5ec0a8ddb3ab26f28a067a29d272fe1a23411/data/plant/plant.splat';
const expected = 'ce9d490b18f16d6730d832227bf541431b8b1a5d167c5a3fe89af4f324c0d8fd';
const response = await fetch(source);
if (!response.ok) throw new Error(`Download failed: ${response.status}`);
const original = Buffer.from(await response.arrayBuffer());
if (createHash('sha256').update(original).digest('hex') !== expected) throw new Error('Source checksum mismatch');
// Keep every fourth complete 32-byte splat in source order; no other transformations.
const result = Buffer.alloc(original.length / 4);
for (let i = 0; i < original.length / 32; i += 4) original.copy(result, i / 4 * 32, i * 32, i * 32 + 32);
await writeFile(new URL('../public/samples/houseplant.splat', import.meta.url), result);
console.log(`${result.length / 32} splats, ${result.length} bytes, SHA-256 ${createHash('sha256').update(result).digest('hex')}`);
