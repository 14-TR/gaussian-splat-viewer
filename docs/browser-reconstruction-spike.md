# Experimental local photos to splats

This **dev-only prototype** now demonstrates photos → reconstructed cameras → actual Gaussian optimization → PLY export → Spark rendering on the procedural fixture. It is not a general-purpose or phone-ready photo reconstruction product. A licensed three-photo skull subset now completes camera reconstruction, training, PLY export and Spark rendering. The wider four-photo arc still fails the all-view-track requirement, even after the repair. Production builds and the existing Pages viewer exclude this route.

## Reproduce

```sh
npm ci
TRAINING_SPIKE=1 npm run dev
# Open http://127.0.0.1:5173/gaussian-splat-viewer/spike/index.html
# In another terminal, with Playwright Chromium installed:
KNOWN_CAMERAS=1 npm run test:training
npm run test:training
```

The known-camera button is a separate trainer control: it explicitly supplies synthetic poses and a dense surface seed. The normal fixture button supplies only original rendered images and focal calibration to OpenCV; withheld poses are used solely to check recovered camera spacing. Generate the fixture, reconstruct cameras, train, and export PLY. The preview starts at the first training camera, supports orbit/pan/zoom and resets to that camera. The exported file also opens through the original viewer's local-file input.

## Pipeline and coordinate conventions

Four original 512×384 procedural views contain three textured surfaces at different depths. OpenCV SIFT uses up to 1,500 features at 512 px or 4,000 at 1,024 px, reciprocal ratio-0.7 matching and fundamental RANSAC at 1.5 px. Every selected image pair is matched once. The anchor with the most all-view geometrically verified tracks is selected automatically; camera/image ordering is preserved. Up to 100 all-view tracks seed fixed-intrinsics libmv/Ceres reconstruction with keyframes 0 and 1. Acceptance requires all cameras, at least 30 finite points, nonzero baseline, reprojection error below 3 px and at least 90% of points in front of all cameras. Per-pair features/matches/inliers, anchor counts and cheirality are exported in diagnostics. An earlier 300-track/keyframe-0,3 configuration failed with a WASM memory-access error; arbitrary datasets may still fail.

OpenCV and Splat.js share row-major world-to-camera R,t, with X right, Y down and Z forward. No pose sign conversion occurs at training handoff. Focal length and principal point are scaled from the reconstructed-image width to the actual training-image width; the fixture changes 512 to 256 px and focal 411.7453 to 205.8727 px. The experimental Spark preview converts those cameras to OpenGL camera-to-world using the independently tested helper in `spike/dataset.js`.

Splat.js seeds up to 2,000 Gaussians from reconstructed XYZ and sampled first-image RGB, then optimizes all Gaussian parameters on WebGPU. The known-camera control uses 1,728 surface points without clone truncation. The final view is withheld from gradient updates; evaluation uses that view every 50 iterations. Training is rounded to multiples of 50, bounded at 50–4,000 iterations, 256 px longest image side, degree-0 SH, no growth and a maximum 4:1 axis ratio. Jobs time out after 180 seconds. These limits bound requested work, not all browser/GPU memory.

PLY is upstream's binary little-endian standard INRIA layout, including positions, zero normals, SH DC, logit opacity, log scales and normalized WXYZ quaternion. Mip opacity compensation is **baked using the run's actual focal, camera centers and dilation 0.1** before export. This is upstream's approximation for standard renderers, not exact projection parity at every viewing angle. The test parses every exported float, checks count/size and quaternion normalization, requires parameter changes and improved held-out PSNR, checks source-image similarity in calibrated Spark pixels, orbits the scene, and loads the same bytes in the original viewer.

## Evidence and performance

See [known-camera metrics](evidence/splat-js-known-camera.json), [known-camera export](evidence/splat-js-known-camera.png), [image-derived metrics](evidence/splat-js-recovered-camera.json) and [image-derived export](evidence/splat-js-recovered-camera.png). These are actual trained exports, not a pre-existing model. The image-derived model remains soft and incomplete where only 100 sparse tracks seed the surfaces; numerical improvement does not establish arbitrary-photo quality.

Tests run in visible Playwright Chromium on the M4 Pro Mac, using normal WebGPU without unsafe flags. The adapter supports 10 storage buffers per shader stage; Splat.js successfully uses the default device limit of 8. Standard headless Chromium on this Mac has no hardware adapter, so headless CI covers reconstruction, capability rejection and viewer rendering rather than claiming GPU training.

Timing records separate decode/setup, camera reconstruction and training wall time. A separate 10-step timestamp profile runs **after the exported snapshot**; those diagnostic steps are not included in the reported/exported 4,000 training iterations. Rasterization/gradient accumulation is the largest measured training kernel cost. Those kernels already run on the GPU; rewriting the JavaScript orchestration in Rust would not remove that bottleneck. These are tiny-fixture measurements, not benchmarks for large real scenes.

## Real-photo result and original failure

Source: [Skull - Cameramoves - Flash - No Background](https://gitlab.com/photogrammetry-test-sets/skull-cameramoves-flash-no-background) by [alansartlog](https://alansartlog.com), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), commit `0f31c229ac289a615b3ae981a5f584856bb24c47`. The source README explicitly licenses the photographs and supplies attribution. EXIF identifies Canon EOS REBEL T3 and a 55 mm lens. Original photos are 4272×2848 JPEGs; fixed approximate calibration uses a 22.2 mm sensor width, giving focal 2536 px at a 1024 px resized width. No distortion correction or external camera poses are used.

The initial four-photo set (`01.JPG`–`04.JPG`) at 512 px failed: the first-to-third pair had only eight reciprocal matches. Moving the anchor to the middle image with three views gave 52/86 reciprocal matches, but only 20 all-view tracks at that resolution. [Original failure/provenance/hashes](evidence/real-photo-failed-reconstruction.json) remains preserved. This was an overly peripheral first-image anchor combined with feature resolution too low for this detailed, reflective object; no quality threshold was relaxed to obtain success.

**Successful three-photo subset:** `01.JPG`, `02.JPG`, `03.JPG`, in that natural order. Features run at 1024×683; training runs at 256×171 with focal 634 px and principal point (128, 85.375). Automatic matching chooses `02.JPG`; the pair has 95/181 geometric inliers to its neighbors, while `01`↔`03` has only eight. There are 32 shared tracks and three recovered cameras, ~0.127 px reprojection error, and all points in front of all cameras. Training on two views holds the third out of gradient updates; SfM uses all three photos, as standard reconstruction does.

The bounded run optimizes 800 Gaussians for 4000 iterations. Held-out PSNR improves from 8.95 to about 18.34 dB. [Actual metrics/diagnostics](evidence/real-photo-training.json), [exported Spark screenshot](evidence/real-photo-trained-render.png) and [trained PLY](evidence/real-photo-trained.ply) are saved. Spark's calibrated exported-view similarity, colorful pixels, orbit, original-viewer loading, finite floats/quaternions, cancellation/restart, two consecutive training runs and no external/POST requests are asserted. The model depicts a recognizable skull but is soft and covers only the observed frontal arc; it is not a complete 360° or photorealistic reconstruction. The trainer's held-out metric and Spark's first-source-view metric are different measurements.

Reproduce from downloaded originals:

```sh
REAL_PHOTO_DIR=/absolute/path/to/originals REAL_PHOTOS=01,02,03 \
  REAL_RESOLUTION=1024 REAL_FOCAL=2536 npm run test:training
```

The committed [licensed regression fixture](../tests/fixtures/skull/README.md) contains those three images resized to lossless 1024×683 PNG (about 3.9 MiB total), with explicit attribution and [full CC BY license](../licenses/Skull-CC-BY-4.0.txt). `node scripts/prepare-real-fixture.mjs /path/to/originals` checks original SHA-256 hashes and reproduces the resize. Only these related licensed derivatives and evidence are published; no user photos are included. Reproduce training directly from the fixture:

```sh
REAL_PHOTO_DIR="$PWD/tests/fixtures/skull" REAL_PHOTOS=01,02,03 \
  REAL_EXTENSION=png REAL_RESOLUTION=1024 REAL_FOCAL=2536 npm run test:training
```

The committed PNG fixture was also trained end to end independently: three cameras, 51 tracks, 0.185 px reprojection error, 1,275 Gaussians and held-out PSNR 9.24→18.84 dB; Spark exported-view PSNR 23.54 dB. [Fixture metrics](evidence/real-photo-fixture-training.json), [fixture export](evidence/real-photo-fixture-render.png) and [fixture trained PLY](evidence/real-photo-fixture-trained.ply) retain hashes and the same CC-BY attribution. A repeated run reaches 19.46 dB. Metrics differ from the original JPEG-input run because this resize/PNG round-trip freezes different decoded/resampled pixels; both runs are measured separately.

With all four original photos at 1024 px, the repaired pipeline still finds only two common tracks. Adjacent pairs have 95, 181 and 108 inliers, but `01`↔`04` has zero. [Current failure diagnostics](evidence/real-photo-four-view-current-failure.json) make the remaining limitation explicit: all-view tracks cannot span that wider arc. Supporting such captures would need partial-track/incremental SfM work beyond this ordinary anchor/resolution repair. Selecting three closely overlapping views succeeds without hiding or dropping inputs automatically.

The standard headless test suite reconstructs this real-photo fixture and checks central-anchor selection, front-facing geometry and reprojection error. It does not claim hardware GPU training in CI. Wider photo arcs, other captures, lens errors and full-scene coverage remain limitations, not solved by this one successful subset.

## Privacy and limits

- 3–6 equal-dimension JPEG/PNG photos, maximum 24 MiB total; no HEIC, video, EXIF autocalibration, lens-distortion correction, partial tracks or disconnected views. Supply focal length at the chosen feature-image resolution (512 or 1024 px longest side). Changing feature size adjusts the supplied focal for the selected image size; verify that calibration before reconstructing.
- All input decoding, matching, training and export stay on this device. No upload endpoint exists; tests reject any POST or external-origin request during the workflow. Splat.js jobs use memory, **not OPFS persistence**. Cancellation terminates the worker and clears pending output; repeated runs allocate a fresh device/model. Completed local downloads persist wherever the user saves them.
- The pinned OpenCV WASM is about 46 MiB. It is too heavy to describe as phone-ready. Physical iPhone/Safari and general real-photo robustness remain unverified.
- The UI rejects unavailable adapters and fewer than eight storage buffers, reports WebGPU validation/device errors, and does not offer export after failed or cancelled training.
- Low step budgets can fail the quality gate. Even accepted output may be blurry or lack coverage; a 2,000-Gaussian, degree-0 prototype is a deliberately small experiment.

## Dependency provenance and licenses

[Splat.js official source](https://github.com/arrival-space/splat.js/tree/88efe9aaf32279b0b9bcb781ea0deb4d60c49dff) is pinned to commit `88efe9aaf32279b0b9bcb781ea0deb4d60c49dff`. `package.json` uses that exact GitHub archive and `package-lock.json` pins its SHA-512 integrity. Upstream code was inspected and is unmodified. [MIT license](../licenses/Splat.js-LICENSE.txt), copyright 2026 Stratum1 GmbH, is retained. The package also contains unchanged Mediabunny code under MPL-2.0; its embedded notice/source link remains in the dependency. Video import is not exposed in this prototype. Splat.js is early version 0.1.0, so upstream README benchmark claims are not claimed as our results.

`@banou/opencv-wasm` is pinned to 0.0.6 from the official npm registry with lockfile integrity. Its facade is Apache-2.0 and its distribution contains native dependency notices, including enabled nonfree features. Retain its `THIRD_PARTY_NOTICES.md` and `lib/licenses/` before any future redistributed native build. Source: https://github.com/banou26/opencv-wasm . The unlicensed hosted WebSfM bundle was never executed.

The original app license remains undecided. Spark, Three.js and build/test attribution are in the README. No API key, paid service or account permission change is needed.

## Separate failed Brush experiment

Brush is no longer the active trainer. [Archived source/runtime investigation](brush-runtime-investigation.md), [failed metrics](evidence/brush-mac-failed-run.json) and [blank export](evidence/brush-mac-failed-render.png) remain clearly marked as failures. Its projection needs 12 storage buffers versus this Mac adapter's 10. `npm run brush:build` still reproduces the pinned source build and `spike/brush.worker.js` retains that implementation, but no UI invokes it. Brush source compilation passing CI is not evidence of successful GPU training.
