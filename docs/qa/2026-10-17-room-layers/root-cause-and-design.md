# Room visibility investigation and bounded design

Read-only investigation, 2026-10-17. No deployment or browser claims. No AGENTS.md found beneath the workspace parent.

## Reproduction and root cause

`tools/maps/builder.ts:86-110` chooses the avatar stack using `art/tile-catalog.json` sprite `level`. The authored placement's `layer` only distinguishes `terrain` from other scenery: `props` and `architecture` do not control avatar depth. `floorLayer` is correctly between belowAvatar and aboveAvatar scenery. Collision is independently exported into an invisible `physical-collisions` layer from each sprite's blockingCells, combined with authored solid cores. Thus collision correctness does not imply visibility correctness.

All twelve speaker maps plus Solar/Lunar Hall have reachable cells containing visible aboveAvatar scenery. Counts of reachable cells with a nonzero aboveAvatar GID (not a claim every such pixel is opaque): Aquarius 66, Aries 68, Cancer 70, Capricorn 62, Gemini 66, Leo 96, Libra 68, Pisces 72, Sagittarius 68, Scorpio 71, Taurus 86, Virgo 66, Lunar 118, Solar 118. Reachability was a four-neighbor flood from the default start, excluding physical-collisions cells.

Exact committed-map examples (zero-based tile coordinates; 32px tiles):

| Map | Cell | Above layer GID | Sprite / causal metadata |
| --- | --- | --- | --- |
| speaker-aries | (1,25) | 10 | glass-partition top; aboveAvatar; only bottom row blocks |
| speaker-aries | (15,7) | 257 | screen-presentation; aboveAvatar; no blockingCells |
| speaker-aries | (17,35) | 19 | door-open central bottom; aboveAvatar; only outer bottom jambs block; also exit-plaza-return |
| speaker-aries | (4,10) | 13 | light-amber; aboveAvatar |
| solar-hall | (29,7) | 257 | screen-presentation; aboveAvatar; no blockingCells |
| solar-hall | (7,17) | 19 | staff door-open middle; unblocked |
| solar-hall | (31,55) | 19 | return door middle; also exit-plaza-return |
| solar-hall | (3,4) | 1 | staff north wall top; wall-navy only bottom row blocks |

All examples are reachable. Aries uses physical mask GID 1966 (marker 1965); Solar mask 2222 (marker 2221). Sprite sheet magic.png supplies GIDs above; GID 257 is local tile 256. wall-navy is a 1x2 sprite, aboveAvatar, blockingCells [[0,1]]. glass-partition is 3x2, aboveAvatar, blockingCells bottom row. door-open is 4x2, aboveAvatar, blockingCells [[0,1],[3,1]]. screen-presentation is 6x3, aboveAvatar, zero blocking.

There is no floor/carpet/rug sprite classified aboveAvatar in these fourteen authored layouts. floor-charcoal and floor-wood are belowAvatar. The visible symptom can look like a floor covering the avatar, but the demonstrated source is reachable opaque/partially opaque architecture and decorative screens rendered after floorLayer. Pixel inspection with sharp established wall top GID 1 is fully opaque (1024/1024 alpha >240). Runtime confirmation remains required for exact avatar silhouette overlap.

The current editable source is world/layouts/*.json. tools/maps/author.ts compiles these through addNpcGuides/buildMap; maps:build preserves native TMJ edits. tools/maps/speaker-maps.ts is an older extraction helper (32x36), whereas current authored rooms are 36x36, Sagittarius 40x36, Pisces 36x38. Do not mistake that helper for the source of current rooms. Halls are 64x56.

## Bounded design proposed for implementation

Use open-sided cutaway architecture for the fourteen existing rooms. Keep the north back wall as a theme/display backdrop, remove tall west/east/south wall scenery and glass foyer partitions, and replace their visual boundary with low floor trim below the avatar. Preserve solid perimeter collision through existing wall-core placements (and add explicit north core if required); a cutaway must not allow leaving the map. Preserve door portals and their exit rectangles, using a flat floor threshold rather than overhead door art. Staff preparation rooms likewise retain a north backdrop but use open sides/front, with staff media/rights areas unchanged.

Avoid globally changing catalog.level for shared sprites, which would alter other scenes. Add an explicit per-placement drawing-level override or a small set of below-avatar cutaway variants for architecture/screens used here. The override should be validated as belowAvatar/aboveAvatar and should not change blockingCells. Put floor-mounted presentation screens, reliefs, constellation panels, lamps, and other room decoration belowAvatar on these maps when an avatar can walk over their footprint. Retain furniture, room titles/names/themes, glyphs, meeting/beacon areas, seats, stages, lounges, entry/return names and destinations. Keep decorative artwork coordinates unless a removed side wall hosted an item; retain such items as floor-mounted displays in their existing region. The north backdrop may stay aboveAvatar only if its entire occupied footprint is physically unreachable; otherwise render belowAvatar.

This is bounded to the existing map builder contract and fourteen room layout files. Regenerate TMJs/previews through the authored export with its native-edit guard respected. WAM geometry/properties should compare byte-for-byte or structurally identical after export, apart from existing deterministic formatting. No new subsystems or map topology.

## Failing-first and acceptance

1. Add a regression that demonstrates reachable above-avatar opaque room decoration at the exact screen/door/glass cells above; it must fail on current generated maps before implementing depth/open-side changes.
2. Assert all fourteen target maps have zero reachable cells containing aboveAvatar room architecture/screens. Preserve intentional remote north backdrop only when unreachable; do not count invisible masks/triggers as visual scenery.
3. Assert side/front tall walls and foyer glass are absent; north backdrop and visible low trim remain. Verify all nonarchitectural furniture/theme placement IDs and all area/sign/entry/exit records are preserved.
4. Compare physical perimeter masks before/after; no newly reachable outside perimeter cell. Confirm default starts, portal rectangles, central aisles, front routes, discovery and meeting approaches remain clear and mutually connected using existing speaker/hall tests.
5. Run focused speaker/hall/map/builder tests, art:check, maps:validate and full build as coordinated by the root. Render before/after Aries, Pisces, Sagittarius, Solar and Lunar with pinned Tiled for image inspection.
6. Independent code review must examine override validation, collision preservation, authored/native export guard, room/theme identity preservation and regenerated artifacts.
7. Live attendee acceptance after approved release: walk through former Aries glass at (1,25), stand on/behind presentation screens, cross speaker and both hall return thresholds and staff-prep opening. Capture avatar visibility before/after at the same coordinates and test all fourteen room arrivals/returns. Static evidence does not certify this step.


## Implemented and verified

The approved bounded implementation uses placement renderRole values `grounded`, `canopy`, and `cutaway`. It validates roles and restricts them to scenery. Grounded room fixtures/backdrops draw below avatars; canopy preserves explicit elevated scenery. Cutaway renders a single bottom row of existing floor-inlay artwork while retaining the original sprite blockingCells and dimensions, so walls, portal jambs, and partitions keep their physical footprint. All original placement records remain unchanged apart from the role field. Decorated north/side backdrops remain; foreground south walls/doors and foyer glass become low trim. This preserves rooms' names, themes and furniture while exposing the avatar.

Failing-first run `.qa/room-cutaway-red.log`: 28 failures (visibility and foreground role), 14 preservation passes. Final focused run `.qa/room-cutaway-green.log`: 91 tests pass across four files. TypeScript passes. maps:validate reports 33 maps / 66 TMJ-WAM files / zero issues. Before/after renders from committed native source are `.qa/room-cutaway/before/` and `after/`, covering Aries, Pisces, Sagittarius, Solar and Lunar. No WAM file changed. Native export guard compared all 28 target source files to Git HEAD because the optional authored hash manifest was absent; all matched before export. Only these fourteen TMJs and previews were rebuilt.

Builder/types hashes are embedded in BOTH animation provenance records. Deterministic rerender proved unchanged PNG hashes before updating those exact inputs: roadster f0d01aa3c4f9835b1d35fa6ae3c8534ebdb8e4a647d3cdb30f43309b13a63fe1; coastal-flight 615e385edc6d741303b6631824929372ba082b6bfb5432fd632d39b996b4f525. Matching layout descriptors were reconciled. Root agent owns art/source manifest hash reconciliation and final publication manifest. Full release build and actual live acceptance remain root-coordinated; this record does not claim them.

## Root integration and deployment evidence

The supported controls API disables native tap/right-click destination walking immediately after each map initialization; keyboard and joystick control paths are retained. Current deployed app/source-map bytes were matched to the actual touch handler used by the source reproduction. Real iOS/Android idle, touch-cancel and background/resume acceptance remains unverified.

A separate full-suite failure exposed quadratic diagnostic redaction before text truncation. Actual50,000-character projection took6.57s; bounded-prefix acquisition plus a forward assignment scanner reduced it to0.64ms in the recorded measurement. The121 affected tests passed. This is a code defect, not inferred AWS load. The rebuilt guide module is4ca233321d91f15d3141f3fd60912168806edf6acd5487da4dd4cfca009f1732,26832bytes; its source pin and generated operating facts are updated. That does not deploy or start any bot.

Root verification:91 focused room/hall/map tests, TypeScript,66map-file validation and767-sprite artwork checks passed. First full run retained19 failures (stale release/provenance assertions and actual redaction delay); after reconciliation/build/fix the next full run passed1165 of1166, with only stale generated operating facts. Facts were regenerated and all7 focused documentation-contract tests passed. Do not relabel the historical full-suite run as an all-green run.

Independent package review reconstructed the exact live-preserving package through the actual release functions:146release files,249complete package files,33map pairs and33token-only WAM migrations. All245existing paths are retained, every baseline PNG is unchanged, and only14native map geometries change (ignoring all33updated runtime-script pointers). Organizer WAM settings/properties/areas/entities remain byte-exact outside each mapUrl token. The unchanged view JS sourcemap only has relative debug-source path metadata updated.

Devbox apply completed with HTTP200 and TWO complete249-file matching readbacks. Selected lifecycle/health records for all77existing containers were identical before and after; no service restart or AWS/security/core configuration change was performed. The live Aries screenshot visibly confirms removal of the former glass foyer and foreground door wall. These are visual entry observations, not full14-room movement or device acceptance. Bot runtime integration and live three-guide acceptance remain separate, incomplete work.

Private transaction evidence is retained in .qa/room-cutaway (ignored by Git), with an independent package report in the sibling map-package-independent-review-2026-10-17 workspace output. The initial HTTP probe had an unescaped-space URL construction error; it is preserved rather than attributed to the map server. A corrected encoded-path public-byte verification is separate evidence. An earlier optional Docker-health read used a missing direct key and was replaced by selected optional-key access; neither read probe mutated containers.

## Follow-up: remaining nineteen maps

A separate reachable-cell and PNG-alpha audit confirmed the same misplaced foreground-art cause in thirteen more maps. The bounded change assigns 157 existing placements to the existing roles: 146 grounded and eleven cutaway. All placement identities, artwork, positions, dimensions, collisions, portals, WAMs and nonvisual native data remain intact. Natural canopies and the six excluded map sources remain unchanged.

The first 133-placement proposal exposed a real visual regression: grounded nameplates disappeared behind elevated house roofs. That batch was held before publication. Pixel attribution also showed that exempting those labels would retain partial avatar occlusion. The corrected design grounds each complete house/nameplate/emblem assembly, adding exactly twelve building and twelve emblem roles. A native 4096×4096 render is pixel-exact to the original plaza, while avatars can render above walkable decorative roof edges. Blocked interiors remain blocked. No artwork, coordinates, collision or sorting feature changed.

The selective native editor retains all existing tile/layer/object identities and historical unused tilesets. Only scenery tile data changes; overworld adds one necessary below-avatar layer, ID58. Independent root comparisons against Git HEAD verify the thirteen layouts contain only the 157 approved roles, every nonvisual layer and map/tileset metadata is exact, and WAM bytes are unchanged. The forty-file implementation freeze and native export receipts are retained privately; no map-wide normalization or unrelated retirement was bundled.

Failing-first visibility/native-depth and assembly checks were retained. The corrected focused run passed160 tests across nine files, TypeScript passed, and all66 map files validated. An earlier parallel local run hit two existing five-second test deadlines while TypeScript/map validation competed for CPU; the serial rerun passed with no timeout or assertion changes. These source results do not establish a live avatar outcome.

The bot guard correctly refused the changed whole-map signature before reconciliation. An independent review verified exactly three route-provenance changes (layout hash, native hash and whole-map geometry hash), unchanged routing/collision constraints, the same21 runtime object aliases and unchanged guard implementation. The old authority accepts the old map and rejects the new; the reconciled authority does the inverse. Its55 focused tests passed. The rebuilt public controller is cb61aea75d5468999861a02571a05eeaa89428d3a8afa067f29a00d7ac6d54cc,26832bytes. That changes the required guide-image input; earlier135b source readbacks are historical17d4 proof, not proof of a running current bot.

Full-suite/public package/live follow-up acceptance will be recorded separately after verification. Physical iOS/Android idle/cancel/background checks and the three-bot runtime outcome remain unaccepted.

The historical composition assertions now verify the current approved visual arrays first, reconstruct complete immutable17d4 native/layout receipts, and only then apply the original start/robot/Roadster/coastal inverses. All26 reconstructed artifacts match actual Git17d4 semantically and byte-for-byte; independent drift probes reject unrelated changes. Original historical hashes were not repinned. The source-provenance audit also pins the two changed proof tests and their explicit new helper; allowed cells, destinations, geometry and guard implementation are unchanged. The built controller remains cb61aea75d5468999861a02571a05eeaa89428d3a8afa067f29a00d7ac6d54cc,26832bytes.

The serial complete local run passed1219 of1220 tests with only stale proof-source provenance; after reconciling those independently reviewed sources, all61 targeted route/profile/health/documentation tests passed. No local timeout was increased. The earlier parallel run's timeouts and the serial run's one legitimate stale-pin failure remain recorded; neither is relabeled an all-green complete run. Publication integrity verifies303 historical receipts,113 reviewed revisions and86 extensions. Canonical CI and live release verification are subsequent gates.
