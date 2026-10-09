# Gaussian Splat Viewer

A local-first, browser-based Gaussian splat viewer. Open a scene, drop a file, or explore the built-in colorful torus. Orbit, pan, zoom, reset the camera, toggle auto rotation, and choose the background.

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

Selected files are passed as byte arrays directly to Spark. There is no upload endpoint, telemetry, external font, CDN dependency, cloud storage, account requirement, or API key. The built-in demo is generated in memory. App code, workers, and renderer assets are bundled locally. Installing npm packages and obtaining the app itself require network access; opening scene files does not. Browser tests assert no external requests during local scene loading.

## Checks and rendering evidence

```sh
npm run typecheck
npm run build
npx playwright install chromium
npm test
```

Three Playwright tests cover validation, file loading and actual Gaussian rendering, orbit/zoom/reset and auto-rotate controls, error recovery, the demo, and drag/drop at a mobile viewport. The rendering check decodes a deterministic 64 KiB, 2,048-splat torus through the same file-loading path used for user files, checks over 1,000 colorful canvas pixels, and verifies orbiting changes the rendered image. It uses Chromium with SwiftShader for reproducible CI; this is a rendering correctness check, not a GPU performance benchmark. Desktop and mobile screenshots are saved in `test-results/`, which CI uploads as an artifact.

The torus generator in `src/files.ts` is original synthetic test data. No third-party scan or private scene is bundled.

## Dependencies and attribution

- [Spark 2.3.1](https://github.com/sparkjsdev/spark), MIT: Gaussian rendering and format decoding. [Official getting started](https://sparkjs.dev/docs/) and [SplatMesh format/API documentation](https://sparkjs.dev/docs/splat-mesh/) informed this implementation.
- [Three.js](https://github.com/mrdoob/three.js), MIT: WebGL renderer, camera and OrbitControls.
- [Vite](https://vite.dev/), MIT, and [TypeScript](https://www.typescriptlang.org/), Apache-2.0: development and build.
- [Playwright](https://playwright.dev/), Apache-2.0, and [pngjs](https://github.com/pngjs/pngjs), MIT: browser and pixel verification.

Dependency versions are locked in `package-lock.json`; their licenses remain in their distributions. The renderer bundle is approximately 3 MB uncompressed (about 1 MB gzip), so Vite reports its expected large-chunk warning.

## Project license

A license for this project's original code has **not yet been selected**. Public visibility does not grant an open-source license. The owner should choose a license before inviting reuse or contributions. Third-party dependencies retain their own licenses.
