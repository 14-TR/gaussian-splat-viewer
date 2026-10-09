# Licensed real-photo regression fixture

“Photogrammetry Test Set: Skull - Cameramoves - Flash - No Background” #01, #02 and #03 by [alansartlog](https://alansartlog.com), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

Source: https://gitlab.com/photogrammetry-test-sets/skull-cameramoves-flash-no-background , commit `0f31c229ac289a615b3ae981a5f584856bb24c47`. The source README explicitly licenses this work and supplies the attribution above. Full license: [CC BY 4.0](../../../licenses/Skull-CC-BY-4.0.txt).

Changes: original 4272×2848 JPEG photos were decoded and resized to 1024×683 PNG files for a small lossless regression fixture. No retouching, cropping or content generation. `node scripts/prepare-real-fixture.mjs /path/to/original/JPGs` reproduces resizing and verifies original SHA-256 hashes. Browser image decoding may differ slightly across systems; the committed PNGs freeze the tested pixels.

The derived trained PLY, rendered screenshot and metrics in `docs/evidence/real-photo-*` use the same CC-BY source attribution; these are a rough partial-view experimental reconstruction, not the source author's supplied model. They do not license this application's original code.
