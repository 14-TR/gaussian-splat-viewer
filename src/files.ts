export const extensions = ['ply', 'splat', 'ksplat', 'spz', 'sog'];
export const maxBytes = 256 * 1024 * 1024;
export function validateFile(file: Pick<File, 'name' | 'size'>): void {
  if (!extensions.includes(file.name.split('.').pop()?.toLowerCase() ?? '')) throw new Error('Choose a .ply, .splat, .ksplat, .spz, or .sog file.');
  if (!file.size) throw new Error('This file is empty.');
  if (file.size > maxBytes) throw new Error('This MVP accepts files up to 256 MiB. Try a smaller scene.');
}
// Original deterministic synthetic fixture: a colorful torus, 2,048 standard 32-byte splats.
export function demoBytes(): Uint8Array {
  const bytes = new Uint8Array(2048 * 32), view = new DataView(bytes.buffer);
  for (let i = 0; i < 2048; i++) {
    const a = (i % 128) / 128 * Math.PI * 2, b = Math.floor(i / 128) / 16 * Math.PI * 2;
    const r = 1.2 + .38 * Math.cos(b), o = i * 32;
    [r * Math.cos(a), .38 * Math.sin(b), r * Math.sin(a), .045, .045, .045].forEach((v, j) => view.setFloat32(o + j * 4, v, true));
    bytes.set([Math.round(128 + 120 * Math.cos(a)), Math.round(128 + 120 * Math.sin(a)), Math.round(128 + 120 * Math.cos(b)), 235, 255, 128, 128, 128], o + 24);
  }
  return bytes;
}
