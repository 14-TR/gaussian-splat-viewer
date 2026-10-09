# Gaussian Splat Viewer

A local-first, browser-based Gaussian splat viewer. Open a scene, drop a file, or explore the instant colorful torus and the real Houseplant scan.

**Live viewer:** https://14-tr.github.io/gaussian-splat-viewer/ — on your phone, tap **Explore houseplant** (0.87 MiB download) or **Explore demo** (instant, generated on-device). Orbit, pan, zoom, reset the camera, toggle auto rotation, and choose the background.

## Run locally

Requires Node.js 22.12+ (or a supported newer Node release) and a WebGL2-capable browser with hardware acceleration.

```sh
npm ci
npm run dev
```

Open the localhost URL printed by Vite. To build and preview production assets:

```sh
npm run build
npm run preview
```

## Controls

- Left drag / one finger: orbit
- Right drag / two fingers: pan
- Mouse wheel / pinch: zoom
- **Reset camera**: frame the loaded scene again

Open one file at a time. The previous scene remains available if decoding a replacement fails. Loading is serialized; wait for the current file to finish before opening another.

## Formats and limitations

The file picker accepts `.ply`, `.splat`, `.ksplat`, `.spz`, and single-file `.sog`, decoded by Spark 2.3.1 with the original filename supplied for format detection. PLY must contain Gaussian splat attributes; arbitrary point clouds or triangle meshes are not supported. Spark also supports compressed Gaussian PLY variants. Multi-file SOG folders, generic ZIP archives, remote URLs, and paged RAD streaming are deliberately outside this MVP.

The automated rendering fixture verifies standard 32-byte `.splat` decoding. The other accepted formats use Spark's documented decoders but are not individually verified by bundled fixtures; format/exporter compatibility can vary. Invalid, empty, or non-finite scenes show an error.

Files are limited to **256 MiB**, read completely into memory, and processed on the device. This limit is a guardrail, not a guarantee that a device can render every accepted file. Large scenes can exhaust browser or GPU memory. No level-of-detail generation, progressive loading, editing, exporting, persistence, or orientation correction is provided. Coordinate axes are preserved as imported; some exporters may produce upside-down scenes. Auto-framing uses a bounding sphere. Narrow screens may need a vertical scroll to reach the entire canvas. If the WebGL context is lost, reload the page.

## Privacy

Selected files are passed as byte arrays directly to Spark. There is no upload endpoint, telemetry, external font, CDN dependency, cloud storage, account requirement, or API key. The torus demo is generated in memory. Tapping **Explore houseplant** downloads the public, licensed sample from the same GitHub Pages site; it does not upload anything. GitHub receives ordinary site and sample requests. App code, workers, and renderer assets are bundled locally. Installing npm packages and obtaining the app itself require network access; opening scene files does not. Browser tests assert no external requests during local scene loading.

## Checks and rendering evidence

```sh
npm run typecheck
npm run build
npx playwright install chromium
npm test
```

Four Playwright tests cover validation, file loading and actual Gaussian rendering, orbit/zoom/reset and auto-rotate controls, error recovery, the demo, drag/drop at a mobile viewport, and the real Houseplant sample with emulated one-finger orbit and two-finger pinch/pan. The rendering check decodes a deterministic 64 KiB, 2,048-splat torus through the same file-loading path used for user files, checks over 1,000 colorful canvas pixels, and verifies orbiting changes the rendered image. It uses Chromium with SwiftShader for reproducible CI; this is a rendering correctness check, not a GPU performance benchmark. Desktop and mobile screenshots are saved in `test-results/`, which CI uploads as an artifact.

The torus generator in `src/files.ts` is original synthetic test data (2,048 splats, 64 KiB). The bundled **Houseplant** is a real photographic capture and reconstruction by **Marcel Padilla**, from the [Gaussian Splat Objects Dataset](https://marcelpadilla.com/Gaussian_Splat_Object_Dataset/), under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The original contains 113,648 splats, 3,636,736 bytes (3.47 MiB), with SHA-256 `ce9d490b18f16d6730d832227bf541431b8b1a5d167c5a3fe89af4f324c0d8fd`. Source snapshot: [`marcelpadilla/splats` at `c3e5ec0`](https://github.com/marcelpadilla/splats/tree/c3e5ec0a8ddb3ab26f28a067a29d272fe1a23411/data/plant). The bundled mobile derivative retains every fourth splat: 28,412 splats, 909,184 bytes (0.87 MiB), SHA-256 `eddf2b50d0aa26b2f751d352d9358f6784aac223b69166cec454c3692ee13620`. This reduces visual detail. The original metadata is preserved with source attribution; `node scripts/prepare-sample.mjs` reproduces the derivative after checking the original hash. The viewer applies a 180-degree X rotation to display its -Y up axis upright. It has no view-dependent spherical harmonics and its scale is not metric. Attribution and full license text are in `public/samples/` and attribution is displayed beside its button.

Touch gestures are tested in Chromium mobile emulation through CDP, not on physical hardware or iOS Safari. Actual mobile GPU speed and memory limits vary. The larger real sample is not guaranteed to run on every device; the instant torus is the fallback.

## GitHub Pages deployment

Vite's base is `/gaussian-splat-viewer/`, matching this repository's Pages path. The Actions workflow runs checks on pushes and pull requests; only successful `main` builds deploy `dist/` to the `github-pages` environment. Deployment uses GitHub's required `pages: write` and `id-token: write` permissions scoped to the deploy job; no secrets, paid service, or account permission changes are needed. Repository Pages must use the **GitHub Actions** source. Renaming the repository requires updating `vite.config.ts` and the test base URL.

To rerun the same browser tests against the deployed site:

```sh
VIEWER_URL=https://14-tr.github.io/gaussian-splat-viewer/ npm test
```

## Dependencies and attribution

- [Spark 2.3.1](https://github.com/sparkjsdev/spark), MIT: Gaussian rendering and format decoding. [Official getting started](https://sparkjs.dev/docs/) and [SplatMesh format/API documentation](https://sparkjs.dev/docs/splat-mesh/) informed this implementation.
- [Three.js](https://github.com/mrdoob/three.js), MIT: WebGL renderer, camera and OrbitControls.
- [Vite](https://vite.dev/), MIT, and [TypeScript](https://www.typescriptlang.org/), Apache-2.0: development and build.
- [Playwright](https://playwright.dev/), Apache-2.0, and [pngjs](https://github.com/pngjs/pngjs), MIT: browser and pixel verification.

Dependency versions are locked in `package-lock.json`; their licenses remain in their distributions. The renderer bundle is approximately 3 MB uncompressed (about 1 MB gzip), so Vite reports its expected large-chunk warning.

## Project license

A license for this project's original code has **not yet been selected**. Public visibility does not grant an open-source license. The owner should choose a license before inviting reuse or contributions. Third-party dependencies retain their own licenses.

## Experimental browser reconstruction

A dev-only [photo-to-splat prototype](docs/browser-reconstruction-spike.md) is available at `/gaussian-splat-viewer/spike/index.html` when running Vite locally. Pinned OpenCV WASM reconstructs cameras, and MIT Splat.js performs local WebGPU optimization and standard PLY export. Known-camera and image-derived procedural fixtures train and render in Spark on the tested Mac; a licensed three-photo real skull subset also reconstructs, trains and exports successfully after central-anchor and feature-resolution repairs. The wider original set still fails matching. Outputs remain a rough, bounded experiment (2,000 Gaussians, 256 px training images). Cancellation, repeat runs, export floats, image similarity and local-only requests are checked. The existing production viewer and Pages deployment exclude this route. See the linked evidence, limitations, attribution and archived failed Brush investigation.
