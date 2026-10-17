# WorkAdventure mobile input lifecycle patch

Four-file patch against WorkAdventure96d43a841766b22418c061744e7ed2aafd9870d3 (1.34.1), matched to the original running image25973e38… and source hashes in source-delta.json. Original upstream: https://github.com/workadventure/workadventure/tree/96d43a841766b22418c061744e7ed2aafd9870d3. Retained upstream licenses accompany the patch.

The input manager owns transient joystick lifecycle and exact gesture pointer. Hidden/blur, valid release/cancel, disabled controls and stale isDown clear the same joystick state and movement/path intent. Focus/resume alone cannot rearm; a fresh valid DOWN is needed. The joystick uses the existing typed Rex public enable/reset boundary with same accepted pointer forwarding. Keyboard/follow/right-click policy remains unchanged. No DOM event synthesis or dependency patch.

## Source and test evidence

Fetch the exact upstream revision, verify original hashes, then from its root apply `patch -p1 < source.patch`; verify all four resulting patched hashes and unchanged VisibilityStore against source-delta.json. The application used additional pre-existing OIDC/server/renderer overlays: this patch is not a complete reconstruction of that deployed image.

Actual WA/Rex/Phaser module fixture suite: original7PASS11FAIL, patched18PASS0FAIL. Machine result records and exact test dependency pins are included. The harness/dependency tree is intentionally not shipped here, so this package alone is NOT a rerunnable test environment; no dependency-free CI claim is made. Source reproduction and independent diff review are supported.

Actual complete offline strict Phaser patch, TypeScript check and Vite build all exited0. The patched report retains all1152output paths/sizes/hashes:185210013bytes, original renderer source1copy and exact four patched module source-map copies1each. Full generated output/node_modules/images are excluded.

## Runtime evidence

Runtime image1a25fe6ae0639fab9e2f365109893c40aca3e79cc4759d9c09c98655aaa3dddb preserves original image configuration and server overlays, replaces the four TS files and complete fresh public tree. Build namespace executes only fixed public-directory deletion plus COPY; application/package code does not run during runtime image assembly. Never-started stopped-image readback verified the entire public tree and four TS files, then removed its exact disposable container with positive absence and no unresolved requests. Nine owned Varcamp services were unchanged during build/readback.

Deployment verifier source and captured JSON record image-only play compose change, healthy newplay96b3e073…, unchanged other8service DTOs and resolved play environment matching compose (no environment values retained). Public map and GameManager-CBZPpoD6.js HTTP200 hashes are included. This is deployment/desktop smoke, not physical device acceptance.

## Remaining acceptance

On physical iOS and Android: untouched wheel idle; fresh DOWN moves; release/outside release/cancel stops; background/hidden/blur stops; returning/focus without new DOWN stays stopped; stale held-pointerover/multitouch cannot rearm; fresh DOWN works after resume. Confirm keyboard/follow/control-disable ownership remains correct. Canvas tap-to-walk is a separate policy from joystick lifecycle; map-side supported disabled-rightclick setting must be checked separately. No claim that desktop entry proves device event delivery or that the complete mobile issue is accepted.

## Evidence provenance

provenance.json gives original receipt hashes. Runtime transaction copies omit only global ID diagnostic rows to avoid publishing unrelated shared-host IDs and are explicitly reencoded selected evidence, not byte-identical raw receipts. Scoped Varcamp/effect/artifact rows are retained. Test result sourceRoot paths are made relative; exact original JSON hashes and this transformation are recorded. Private Config/env/credentials and full generated185MB output are excluded. Manifest verifies each candidate file. This package was prepared outside the repository and reviewed before publication. The packager performed no repository or service mutation; deployment was performed separately and is recorded above.
