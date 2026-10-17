# Editing and preserving VarCamp

Organiser editing is optional. The maps listed in [current release facts](../current-release-facts.md) are furnished and assembled. The standalone Git repository contains `world/layouts/*.json` semantic placements, `maps/*.tmj` embedded Tiled maps, native `maps/*.wam`, `maps/preview/` authoring previews, `art/tile-catalog.json`, `art/sources.json`, source atlases and editable original SVG masters. Keep the starter MIT notice and all four separate art license/attribution directories, including Office `Credits.txt`. QA composites using the avatar reference keep their provenance record under `docs/qa/reference/`; no standalone avatar atlas belongs in the release.

Open a root `maps/<id>.tmj` in Tiled 1.12.2. Tiles are orthogonal 32px. Preserve embedded tilesets, boolean `collides`, `floorLayer`, default/named entry layers, exit destinations and inspection objects. Keep named entry/exit rectangles clear and connected. `npm run maps:build` preserves native maps and validates/refreshes their previews. `npm run maps:author` explicitly recompiles hand-composed JSON sources, with a whole-batch native edit guard. Reconcile direct Tiled edits before author compilation; its explicit `--initialize` bypass is only for an intentional backed-up redraw. Edit original SVGs and export with the existing art toolchain; retain source/license/hash records. Avoid changing live organiser metadata by regenerating WAMs and blindly uploading them.

Use the canonical CI Node version in [current release facts](../current-release-facts.md). `npm run buildmap` makes a fresh `dist/` with the catalog map pairs listed in [current release facts](../current-release-facts.md), referenced unchanged atlases, Vite runtime/journal and public credits. The development optimizer remains available for preview; release packaging keeps source tilesets separate with their original embedded credits. `npm test`, `npm run art:check`, `npm run maps:validate`, the pinned full WAM schema check and actual native/browser QA are distinct checks. The package test requires a built `dist/`. The source tree and private files are never the upload root.

## Tiled rendering

For a single source-size QA image, run the official pinned macOS Tiled rasterizer from the repository root:

```sh
mkdir -p .qa/manual-render
.tools/tiled-1.12.2/Tiled.app/Contents/MacOS/tmxrasterizer --no-smoothing --scale 1 maps/overworld.tmj .qa/manual-render/overworld.png
```

Replace `overworld` with another catalog map ID. This uses committed TMJs and their relative source atlases; open the same TMJ in Tiled 1.12.2 for inspection/editing. The bundle installation and observed hash are recorded in [dependencies](../dependencies.md). The committed [renderMap API](../../tools/maps/render.ts) also invokes this pinned rasterizer while resolving source atlas paths. There is no `qa:render` CLI; the unsupported placeholder was removed. The [venue guide](venue-guide.md) provides navigation context; a new edit needs its own appropriate visual verification. Current source facts do not certify a completed live survey.

## Existing live worlds

A supported Basic-over-trusted-HTTPS ZIP POST replaces its entire target directory. It preserves an existing WAM only when that exact paired TMJ is in the ZIP and the WAM is omitted. A same basename in a different directory is insufficient. Unpaired WAMs and every old asset must be explicitly retained. A missing WAM may be generated from defaults; it is not recovered organiser metadata. A WAM elsewhere with the same basename suppresses generation, so selected file GETs cannot establish the whole resulting inventory.

The live `varcamp` tree retains legacy previews/rehearsal files separately from the clean catalog release. Do not clean them as part of an upload. The project planner downloads the whole target, keeps every non-WAM and orphan WAM, overlays the clean release, and omits exact paired live WAMs. New WAMs are included. Explicitly reviewed WAM replacements are an optional ZIP containing only the exact release WAM paths, derived from the fresh live bytes. The October 15 redraw explicitly relocates 24 live areas into separate destinations and adopts reviewed geometry for all moved scenes. `ops/redraw_wams.py` preserves their IDs, complete live properties and top-level metadata; it aborts for unknown areas or live furniture needing manual relocation. Preserve the exact downloaded baseline provenance, compare it with the publisher plan, and independently review the migration report before applying. Later ordinary releases should omit unchanged live WAMs.

After building and verifying locally, prepare a fresh plan:

```
python3 ops/release_upload.py prepare --target varcamp-demo --plan .qa/release-YYYYMMDD
```

For a reviewed native delta, append `--reviewed-wams .qa/reviewed-wams.zip`. Inspect `plan.json`, `baseline.zip`, `release.zip` and `package.zip`. These are different artifacts: the release contains exactly the catalog TMJ/WAM pairs listed in [current facts](../current-release-facts.md), while the upload includes the full retained live tree and deliberately omits preserved WAMs. Readbacks must include all saved WAMs and every retained/new file. Keep a recovery archive and inventory before proceeding.

First perform a normal organiser edit/save/reupload rehearsal in a separately owned sibling namespace, with exact prior absence evidence. Use ordinary login and native editor controls. Wait beyond the 15-second save interval; archive and compare the saved native delta, then upload the preserving package and compare two complete readbacks beyond another interval. Reload and verify the actual editor/attendee view. This demonstrates one quiet normal save scenario, not concurrency or atomicity.

Coordinate a quiet editor window at the concrete prepared-plan checkpoint. Stop changes in the target editor, allow autosave to settle, and confirm the planned baseline still matches. Then run:

```
python3 ops/release_upload.py apply --plan .qa/release-YYYYMMDD --quiet-editor-window
```

The command compares the whole live inventory twice 16 seconds apart, aborts on any change, uploads once, and verifies two full delayed archive readbacks. It never silently restores stale WAMs. Reconcile a changed baseline with the organiser and prepare a new plan. Failure after upload may leave a partial tree: preserve current evidence and compare recovery with current editor state before an explicitly reviewed recovery. There is no upload/editor lock, revision check or atomic rollback. Omitted WAMs do not necessarily trigger live refresh; verify a fresh room load and ordinary reload.

Credentials stay in ignored `ops/private/environment` and are read in process memory. Do not put them in command arguments, logs, screenshots or artifacts. Stock `upload-wa-map` sends incompatible Bearer authentication; the project integration uses Basic with normal certificate verification. The old `ops/upload-rehearsal.py` refuses all writes. `npm run upload-only -- prepare ...` delegates to the same guarded planner.

## Evidence and limits

Native Tiled GUI selection previously timed out; this handover uses the official pinned Tiled headless parser and rasterizer plus personally inspected images and actual WorkAdventure flows. Do not label that GUI control. Images cover rooms and routes, while media, staff enforcement, independent visitor persistence, physical devices/networks, capacity, certificate renewal and recovery are separate hosting gates. Read `docs/qa/world-inspection.md` for the performed checks and deployment state.
