# Browser camera-reconstruction spike

This is a **dev-only experimental prototype**, not a verified complete photos-to-splats product. Image-derived camera reconstruction works. Official Brush WASM, camera-dataset handoff, bounded training, canonical PLY export and Spark loading are wired, but **end-to-end trained rendering is blocked on the tested Mac/browser**. Its WebGPU adapter permits 10 storage buffers per shader stage; Brush's projection pass binds 12. The UI now refuses training before engine startup on that device. The existing Pages viewer and production entry remain unchanged.

## Run

```sh
npm ci
TRAINING_SPIKE=1 npm run dev
```

Open `http://127.0.0.1:5173/gaussian-splat-viewer/spike/index.html`.

Choose **Generate local multi-view fixture**, then **Reconstruct cameras**. Or select 3–6 overlapping JPEG/PNG photos with the same image dimensions and set their approximate focal length in pixels **at the resized resolution**. This spike does not infer EXIF calibration or correct lens distortion. Download computed camera/point data with **Export reconstruction JSON**. Training is available only after a compatible adapter and local Brush build are present. `TRAINING_SPIKE=1` disables hot reload during long GPU work; refresh manually after edits.

To reproduce the source build (Git, Rust 1.95.0 and its wasm32 target required):

```sh
rustup toolchain install 1.95.0 --profile minimal
rustup target add wasm32-unknown-unknown --toolchain 1.95.0
npm run brush:build
```

The build script clones official Brush into a fresh temporary directory, checks out an exact commit, applies the checked-in patch and builds with `--locked`. It retains that source directory for inspection. Generated `spike/brush-pkg/` is ignored and is not published. `npm run test:training` opens visible Chromium against the running dev server and requires actual changed finite Gaussian parameters, improved held-out PSNR, visible Spark pixels and orbit changes. The compared early snapshot is already partly trained; it is not an untrained baseline. **It currently fails at the real adapter capability gate on this Mac.** This is intentional, not a skipped or passing training test.

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
- Cancellation terminates the worker and prevents a pending image-decoding step from restarting it. Native handles are released on normal completion; worker termination discards the instance heap. Camera processing does not persist inputs. Training would write resized PNGs, `transforms.json` and SfM initialization into a unique temporary OPFS folder. Worker completion, failure, cancellation and the 180-second timeout attempt to delete that folder. Browser/device crashes may interrupt cleanup; clearing this site’s storage removes any remainder.
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

## Brush build and actual runtime evidence

Official source: [ArthurBrussee/brush](https://github.com/ArthurBrussee/brush/tree/1388f74c6fe0236f68ee4915564bf00e9d2e3747/apps/brush-js), Apache-2.0, pinned to `1388f74c6fe0236f68ee4915564bf00e9d2e3747`. Its Cargo.lock pins Burn/CubeCL and other vendor dependencies. npm [wasm-pack](https://github.com/wasm-bindgen/wasm-pack) is pinned to 0.15.0 (MIT OR Apache-2.0), Rust to 1.95.0. The build script copies the upstream LICENSE and records provenance beside generated files. The original app's license remains undecided. [Brush's full license](../licenses/Brush-LICENSE.txt) applies to its source patch, not to the original app. [Brush's full license](../licenses/Brush-LICENSE.txt) applies to its source patch, not to the original app.

The small source patch adds `BrushSplats.exportPly()` using upstream `brush_serde::splat_to_ply` and disables Burn GPU autotuning. Unmodified autotuning panicked because WASM cannot block on GPU futures; full tuning also failed when its samples carried no timing measurement. A worker-local WGSL adapter adds the missing `enable subgroups;` declaration and checks generated shader storage-binding counts against actual device limits. No substituted training kernels or diagnostic writes remain.

The dataset handoff converts OpenCV world-to-camera matrices to Nerfstudio/OpenGL camera-to-world matrices. An independent known-pose round-trip test checks the axis conversion and center. The `init.ply` contains image-derived SfM XYZ and sampled photo RGB only; it is **initialization, not trained output**. Brush initializes Gaussian scales/quaternions/opacity and optimizes its real model. Only canonical trained PLY bytes enter Spark through its existing local-file input. No server training or upload path exists.

The bounded configuration requests 50–400 steps, at most 2,000 splats, 256-pixel training images, a 64 MiB scene-image cache, SH degree 0, an evaluation split every fourth view, and evaluation every 50 iterations. This bounds requested work rather than total WASM/GPU process memory. Output is rejected if multiple evaluations show no held-out PSNR improvement.

Before adding the capability gate, a diagnostic run with a temporary one-task dispatch workaround actually reached 400 Brush optimization steps, loaded 3 training views and 1 held-out view, and exported 85 finite Gaussians. **It failed validation:** held-out PSNR stayed exactly 7.427385807 dB from iteration 50 through 400, SSIM stayed 0.00108994, and Spark's exported scene was nearly blank. [Raw failed-run evidence](evidence/brush-mac-failed-run.json) and [render screenshot](evidence/brush-mac-failed-render.png) are retained as failure evidence, not success fixtures. No successful trained PLY fixture is claimed or bundled.

Projection instrumentation showed zero visible splats and zero intersections even for a temporary known-value shader write. Buffer IDs confirmed dispatch and readback targeted the same buffers. Device inspection then exposed the actual limit: Apple `metal-3`, `maxStorageBuffersPerShaderStage = 10`. Brush's projection shader has 11 storage arrays plus its storage metadata array (12). Explicit device requests above the adapter limit are rejected. Default, high-performance, core and unsafe diagnostic adapter configurations all retained the limit of 10. The unsafe diagnostic flags are not used by the app or required setup. All temporary instrumentation, artificial writes and unsuccessful dispatch/readback workarounds were removed. The failed-run dispatch workaround is not in the final source patch. The failed-run dispatch workaround is not in the final source patch.

This limitation is consistent with [Dawn's Metal limit allocation](https://github.com/google/dawn/blob/main/src/dawn/native/metal/PhysicalDeviceMTL.mm): shared buffer argument slots are divided among storage, uniform and vertex buffers. WebGPU API availability and shader-f16 support alone do not establish Brush compatibility. The worker also checks each compiled shader because later kernels may require more than the projection's minimum.

## Remaining blocker and validation boundaries

A successful browser-only photos → cameras → optimized Gaussians → visible exported scene is **not demonstrated**. Resolving this requires porting Brush's packed GPU kernels to supported browser binding limits or evaluating a different browser trainer. This is a concrete runtime capability blocker, not an account, payment, API-key or package-installation approval issue.

Camera reconstruction and failed training were tested with original procedural images. No real camera-photo set was ingested or redistributed: inspected small OpenMVG/AliceVision sets had copyright statements or no explicit image license, so availability was not treated as permission. The existing Houseplant viewer sample is a separately licensed completed reconstruction; it is not evidence of training local photos here. A small explicitly licensed real multi-view set and physical iPhone/Safari validation remain outstanding after the trainer blocker is solved.

The standard automated suite covers the production viewer, real licensed houseplant rendering/touch controls, image-derived cameras, known-pose dataset conversion, blank-input rejection/cancellation and the storage-binding capability gate. It does not claim to perform successful GPU training in headless CI. Production builds exclude `spike/index.html`; the draft branch must not deploy this experimental processing feature to Pages.
