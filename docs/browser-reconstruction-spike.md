# Browser camera-reconstruction spike

This is a **dev-only intermediate prototype**, not the complete photos-to-Gaussian-splats pipeline. It computes real feature matches, 3D points and camera poses from image pixels. Gaussian training and Spark loading of trained output are not connected. The existing Pages viewer and its production asset hashes are unchanged.

## Run

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:5173/gaussian-splat-viewer/spike/index.html`.

Choose **Generate local multi-view fixture**, then **Reconstruct cameras**. Or select 3–6 overlapping JPEG/PNG photos with the same image dimensions and set their approximate focal length in pixels **at the resized resolution**. This spike does not infer EXIF calibration or correct lens distortion. Download the computed camera/point data with **Export reconstruction JSON**.

The fixture renders four 512×384 views of three textured surfaces at different depths. Textures are original seeded rectangles, generated on-device with Three.js; no external photos, models, fonts, or texture assets are used. Ground-truth camera positions stay in the fixture generator/test and are **not passed to the reconstruction worker**. Its known focal length is supplied as camera calibration, not as a pose. No third-party data is redistributed.

## What is computed

1. Resize photos to at most 512 pixels on their longest side; require identical resized dimensions.
2. In a dedicated worker, load OpenCV WASM and extract SIFT descriptors.
3. Match the first view to each subsequent view, apply the 0.7 descriptor ratio test and reciprocal matching.
4. Apply fundamental-matrix RANSAC with a 1.5-pixel threshold to each pair.
5. Keep up to 100 tracks observed in every view; require at least 30.
6. Run libmv/Ceres Euclidean camera reconstruction with fixed supplied intrinsics.
7. Require all cameras, finite 3D points, nonzero camera baseline and reprojection error below 3 pixels; export JSON.

Automated fixture verification recovers four cameras and 100 points at approximately **0.055 pixels mean reprojection error** on this Mac's Chromium. It checks recovered relative camera spacing against withheld ground truth, up to arbitrary global scale, and downloads the actual reconstruction JSON. The result is neither a slideshow nor a pre-existing or hallucinated splat.

## Limits and privacy

- 3–6 JPEG/PNG photos, maximum 24 MiB total, maximum 512-pixel image side, 1,500 target SIFT features per view, 100 retained tracks and 90-second processing budget.
- Cancellation terminates the worker and prevents a pending image-decoding step from restarting it. Native handles are released on normal completion; worker termination discards the instance heap. No IndexedDB/OPFS persistence is used.
- Inputs must have strong texture and all views must overlap the first view. Partial tracks, multiple components, variable intrinsics, lens distortion, EXIF calibration, HEIC, general camera-path robustness, and image-quality guidance are not implemented.
- Tested on the procedural fixture, not a real camera-photo dataset or a physical iPhone. Numeric solver success alone does not guarantee a faithful scene on arbitrary photos.
- The worker receives local pixel buffers; no upload endpoint exists. Tests assert no POST requests or external-origin requests. Local requests load app/dependency/WASM assets only.
- The uncompressed WASM asset is **48,363,260 bytes (~46 MiB)**. This full OpenCV-contrib build is too heavy to call a phone-ready distribution. A leaner custom build or alternative needs evaluation before a public/mobile release.
- This route is served by Vite for local development; it is not an entry in the production build and is not deployed to Pages. Do not remove that boundary until the full pipeline and deployment are reviewed.

## Dependency provenance

`@banou/opencv-wasm` is pinned to **0.0.6**, obtained from `https://registry.npmjs.org/@banou/opencv-wasm/-/opencv-wasm-0.0.6.tgz`. The archive was checked against npm's SHA-512 integrity before use; `package-lock.json` retains the integrity pin. It was installed with lifecycle scripts disabled. The package facade is Apache-2.0 and includes native dependency licenses/notices. Source: https://github.com/banou26/opencv-wasm . Review and retain its `THIRD_PARTY_NOTICES.md` and `lib/licenses/` for any future redistributed binary; this build enables OpenCV nonfree features.

Installation/execution from the official npm registry is within the approved development task; there is no outstanding action-time permission blocker for this pinned package. The hosted WebSfM app bundle was read as data but never executed or copied into this project.

## Failure investigated

The first attempted solver configuration (300 retained tracks, initial keyframes 0 and 3) failed with a WASM memory-access error. A control case reproducing the package's known-correspondence reconstruction succeeded. The current bounded configuration uses 100 tracks and the upstream-tested keyframe pair 0 and 1 and succeeds on the image-derived fixture. No assertion was removed to conceal a failed reconstruction. Other datasets may still expose native solver failures; the worker reports the failed stage and ends the run.

## Remaining training milestone

Official Brush JS/WASM source is Apache-2.0: https://github.com/ArthurBrussee/brush/tree/main/apps/brush-js . Its current bindings train from a prepared dataset directory, pump `training.trainSteps`, expose GPU buffers through `currentSplats`, and cancel with `training.free()`.

Concrete unfinished work:

- Build the official `brush-js` WASM from source. Current release artifacts inspected include desktop apps/source, not a ready-made importable brush-js build. `cargo`/`rustc` are installed, but `wasm-pack` and the `wasm32-unknown-unknown` target are not currently installed. These are toolchain tasks, not approval blockers under the approved registry/vendor policy.
- Convert reconstructed intrinsics/extrinsics and local images to a Brush-supported dataset representation; provide an OPFS/memory-directory adapter for multi-file selection rather than relying on Chromium-only `showDirectoryPicker`.
- Add trained-splat byte export/readback; current JS bindings expose GPU buffers, not a PLY/SPZ/SPLAT byte-export method. Validate coordinates, scales, quaternions, opacity and color encoding before feeding Spark.
- Bound training steps/splat count/memory, expose real loss/progress, support explicit cancellation/device-loss handling, and prove photometric optimization plus valid exported bytes.
- Validate physical iPhone/Safari with the user. Visible Chromium on this Mac has an Apple Metal WebGPU adapter and `shader-f16`; default headless Chromium exposes `navigator.gpu` but does not return an adapter. Browser API presence alone is insufficient.

Until those are complete, no trained Gaussian output or full photo-to-splat success is claimed.
