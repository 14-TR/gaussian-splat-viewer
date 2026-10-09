# Houseplant sample

“Houseplant” Gaussian splat capture by Marcel Padilla, from the Gaussian Splat Objects Dataset (July 2026).

- License: Creative Commons Attribution 4.0 International (CC BY 4.0): https://creativecommons.org/licenses/by/4.0/
- Legal terms: https://creativecommons.org/licenses/by/4.0/legalcode
- Dataset: https://marcelpadilla.com/Gaussian_Splat_Object_Dataset/
- Source snapshot: https://github.com/marcelpadilla/splats/tree/c3e5ec0a8ddb3ab26f28a067a29d272fe1a23411/data/plant
- Original asset: `plant.splat`; bundled as the modified mobile derivative `houseplant.splat`.
- Original size: 3,636,736 bytes; 113,648 splats.
- Bundled derivative: 909,184 bytes (0.87 MiB); 28,412 splats, made by retaining every fourth complete 32-byte splat in source order. This reduces detail.
- Original SHA-256: ce9d490b18f16d6730d832227bf541431b8b1a5d167c5a3fe89af4f324c0d8fd
- Derivative SHA-256: eddf2b50d0aa26b2f751d352d9358f6784aac223b69166cec454c3692ee13620
- Original per-object metadata is preserved in `houseplant.meta.json`.

The viewer rotates the sample 180 degrees around X to present its documented -Y up axis upright; the derivative also reduces splat count to one quarter. `scripts/prepare-sample.mjs` reproduces this modification from the checksum-verified original. Spherical harmonics are absent (SH0), so shading is not view-dependent. The capture scale is not metric.

You may share and adapt this sample, including commercially, subject to CC BY 4.0 attribution, license-link, change-notice, and other terms. This sample license does not license the viewer's original code.
