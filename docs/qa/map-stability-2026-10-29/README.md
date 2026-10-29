# Map stability and tile physics audit — 2026-10-29

The 34-map world was checked at baseline `7f24c28b111a307f8ce010950671900660f3226e`. One confirmed map defect was found: all twelve plaza booth chairs blocked their empty lower tile while their visible seat was walkable. The current collision mask corrects those twelve pairs. Artwork, scale, placement, room zones, doors, drone routes and the circular campus layout remain unchanged.

## Coverage and evidence

| Check | Scope | Result |
| --- | --- | --- |
| Independent source/native geometry | 34 maps; 23,046 placements; 371 native objects; 166,340 painted tile instances | No structural or navigation issues |
| Navigation graph | 81 spawn layers, 80 exits, 91 WAM areas | Valid geometry and accessible public approaches |
| Sprite footprints | 2,260 collision cells from used sprite definitions; decoded PNG alpha | Chair mismatch found and corrected |
| Full browser traversal before correction | 34 maps, 437 walks, all 80 exits, 135 wall probes | Passed; no page errors or missing assets |
| Additional live physics probes | Solar/Lunar walls, beach sea boundary, maze world edge | Three wall probes and one world-boundary probe passed |
| Live WAM readback | All 34 WAMs, 91 areas, zero entities | Geometry/properties match; four retained live area IDs are documented |
| Immutable source comparison | 1,025 map/art/layout files | Byte-identical; native and preview each change only 24 collision cells |
| Built package versus previous live maps | All 34 published TMJs | Only the common script reference and those 24 plaza collision cells differ |
| Standard release checks | Map author guards, native map validation, art validation, TypeScript/Vite build, publication pins | Passed |

The geometry audit independently reconstructs each collision cell from terrain and sprite footprints, including flipped placements, then compares it with the native physical mask. It checks bounds, identifiers, tile reservations, image dimensions, animation frames, spawns, exit destinations and walkable connectivity. This examines every authored placement and painted tile; live keyboard tests sample collision surfaces rather than contacting every individual object.

The 65 review flags were inspected. Isolated cells are decorative strips or pockets behind walls/exit triggers with no player spawn. Partially blocked activity rectangles contain intended furniture and retain usable floor. Walkable map edges are bounded by WorkAdventure's world limits; the maze boundary was verified live. Plant base cells are covered by their animated foliage. Transparent hall roof corners lie inside the blocked sea boundary rather than on a pedestrian route. Neither maze has an edge shortcut.

Four Solar/Lunar presenter/preparation areas intentionally restrict guest access. Their geometry was audited; this run did not impersonate staff to enter them. Microphone and camera stayed off, and all browser contexts were closed.

## Chair regression and release

`chair-presentation` uses the WA Seats crop at row 9, 1×2 tiles. Its visible artwork is entirely in local cell `[0,0]`; `[0,1]` is transparent. The collider changes from `[0,1]` to `[0,0]`. Regression tests check every chair in both the authored and native maps, verify the exact 24-cell reversible change, and reject unrelated geometry/catalog mutations. Historical tests use the original chair footprint when rebuilding their immutable old snapshots.

The public guide geometry/module receipts were refreshed against the new collision mask. The 864-cell route graph is unchanged. Orion, Nova and Lyra remain stopped; private guide activation pins were not edited.

The full Vitest run completed 2,640 tests: 2,370 passed, 181 failed and 89 skipped. Six of those failures were historical catalog checks that expected the original chair collider. After updating only those historical assertions, a focused rerun completed 233 tests: 232 passed and one pre-existing fixture-copy failure remained. Combining the latest result for each complete test file gives **2,376 passed, 175 pre-existing failures and 89 skipped, with zero new failures**. This is not a fully green repository suite.

The remaining failures are listed individually in [test-results-final.json](test-results-final.json). They include old layout/fixture contracts, missing fixture dependencies, a macOS-only Tiled executable path, and guide operations tests. The separate Node operations suite passed 17/18 checks; its failed guide-image check requires world-readable local files, while the unchanged guide Docker inputs have mode `0600`. No guide activation or permission change was made.

Code commit **`e095eef16f3e3967c7cc2d98e82ef5e3f163fec0`** was deployed with `npm run deploy:demo -- --apply`. Upload returned HTTP 200, two complete readbacks verified all 745 expected files, and the standard live acceptance smoke passed. [Release receipt](release-receipt.json).

After deployment:

- All **34 maps** loaded successfully and their fetched native maps matched the built files; zero page errors or missing assets. [Load sweep](postdeploy-loads.json).
- The plaza passed **29 collision probes and all 18 outgoing exits** again, with zero failures or runtime errors. [Plaza sweep](postdeploy-plaza.json).
- Real keyboard movement stopped at the visible chair and passed through its formerly blocked empty lower tile. [Before](chair-live-before.json), [after](chair-live-after.json), [screenshot](chair-after.png).
- All 34 live WAMs retained the expected geometry and properties. [Readback](live-wams-after.json).
- Every audit browser closed cleanly. Orion, Nova and Lyra remained stopped.

The source change is covered by the existing publication chain plus `publication/revisions/2026-10-29-map-physics.json`. This folder contains post-release QA evidence, with its own [SHA-256 index](SHA256SUMS), and does not change the deployed runtime.

This audit covers map integrity and bounded live behavior. It is not a 1,000-person concurrency, browser-performance or WorkAdventure-core capacity certification.

## Reproduce the independent checks

From the repository root, with the pinned Node version active:

```sh
python3 docs/qa/map-stability-2026-10-29/audit.py
node docs/qa/map-stability-2026-10-29/alpha-audit.mjs
```

These scripts inspect the local map/art data and write reports only beneath `.qa/map-stability-audit/`. Both were rerun from this archive and reproduced the saved final reports exactly.

The complete pre-correction browser traversal is retained in [shard 0](live-sweep-0.json), [shard 1](live-sweep-1.json) and [additional boundaries](extra-live.json). The immutable source comparison is in [source delta](source-delta-final.json), and the live-versus-built semantic comparison is in [package delta](package-semantic-delta.json).
