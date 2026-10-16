# Compact hub and separate speaker maps implementation plan

**Goal:** A smaller arrival campus with twelve zodiac buildings, twelve separate talk scenes and signed roads to the existing activities and the new shipyard/beach. The added Comet Maze is reached from the existing Orbit Maze.

**Spec:** [Compact hub specification](../specs/2026-10-12-varcamp-separated-speakers-design.md)

**Architecture:** Derive each speaker scene from the authored district module, preserving all 535 interior placements and meeting properties. The composer removes these modules and meetings from the district scenes, creates a compact outdoor hub, routes continuous roads around full building footprints, and places scenery in reserved free space. Catalog-driven packaging emits 26 TMJ/WAM pairs. Root reviews fresh live WAM metadata before deployment and performs Computer acceptance.

**Constraints:** Hub 160×160, center (80,80), twelve 16×12 facades at radius 48, nominal promenade radius 56, welcome court 24×24. Separate speaker maps are 32×36 with original module origin (2,2), entry (15,26,2,2), return (15,31,2,1). Outdoor scenery totals 200–300 placements with at least eight prop types, four ponds and four nearby forecourt props per building. Reserve the NPC guide area and robot clearance. No new dependencies, paid assets, infrastructure changes, production changes or commits.

## Task 1: Extract interiors and compose the compact hub

Files: `tools/maps/speaker-maps.ts`, `tools/maps/zodiac-wheel.ts`, `tools/maps/campus-decoration.ts`, `world/layouts/overworld.json`, `src/world/catalog.ts`, `tests/speaker-maps.test.ts`, `tests/zodiac-wheel.test.ts`, `tests/campus-decoration.test.ts`.

- [x] Capture failing tests for separate scenes, exact 535 placement signatures/settings, dimensions, portals/returns and removal of plaza/district meetings.
- [x] Capture failing compact hub tests for dimensions, twelve small facades, continuous loop, direction arrows, welcome board, NPC clearance and bounded scenery.
- [x] Extract original interiors before removing district modules; add only enclosing boundaries and return instructions.
- [x] Add native facades with roof/floor texture, navy walls, zodiac glyphs, constellation emblems, lights and south doors.
- [x] Reserve all physical speaker portals and return entries before road and scenery placement.
- [x] Route continuous, four-connected roads around complete facade footprints; connect the court, doors and activity gates.
- [x] Place close welcome furniture, landscaped forecourts, four water/rock pockets and alternating scenery beside routes.
- [x] Capture and fix the additional failing test for south gate labels overlapping return arrivals.
- [x] Run focused tests with default parallelism; verify every arrival is reachable and disjoint from collisions, signs and exits.
- [x] Obtain independent review of compact source, generated maps and native renders. Final integrated NPC/quest review remains root-owned.

## Task 2: Integrate catalog, directory and generated artifacts

Files: `src/journal/view.ts`, `tests/journal.test.ts`, `tests/world-contract.test.ts`, `tests/world-package.test.ts`. The activity agent owns `world/layouts/shipyard-beach.json`, `world/layouts/comet-maze.json`, the Orbit Maze addon and their tests. Root owns NPC interaction/art/backend and quest runtime changes.

- [x] Register twelve speaker maps plus shipyard and Comet Maze, their dimensions and named entries.
- [x] Capture failing directory tests, then add numbered speaker destinations and the new activities while retaining existing public destinations.
- [x] Make release inspection consume composed layouts because the extracted speaker scenes have no separate authored JSON source.
- [x] Build 26 source pairs and the release artifact; validate 52 source files with zero issues and verify licensed asset bounds/hashes.
- [x] Render the compact hub, welcome court and representative preserved interiors through native Tiled 1.12.2.
- [ ] Run a final full suite after root's concurrent NPC/quest implementation is complete. The current full run passes all map and release tests; the in-progress visible-NPC test remains red.

## Task 3: Publisher inventory and reviewed live metadata

Files: `ops/release_upload.py`, `ops/tests/release-upload.test.ts`. Root owns live metadata preparation and deployment.

- [x] Capture a failing test through the actual publisher prepare entry point: the complete 26-map fixture is rejected by the old 12-map guard.
- [x] Extend only the expected inventory; preserve baseline aborts, live WAM preservation, credential transport and delayed readback behavior.
- [ ] Root downloads a fresh live baseline and reviews explicit WAM replacements. Remove only the twelve old plaza meetings, keep generated NPC areas, preserve unrelated live fields, and copy each corresponding current meeting's settings into its new speaker scene.
- [ ] Root reviews all additional changed maze/activity WAM areas against the current baseline rather than sending stale source metadata.
- [ ] Root prepares and applies only the demo release in the authorized quiet editor window, requiring HTTP 200 and two complete delayed checksum readbacks. A changed baseline aborts preparation/application and requires reconciliation.

## Task 4: Computer acceptance

Root owns all UI operation, deployment receipts and live walkthrough evidence.

- [ ] Physically enter all twelve building doors. Record distinct speaker URLs, visible matching interiors and matching meeting activation.
- [ ] Physically return through every south door. Record the matching exterior arrival, no automatic reentry and a clear walk to the promenade.
- [ ] Retest festival and campus round trips, campus→festival and plaza↔shipyard/beach using physical roads and signs.
- [ ] Retest Orbit Maze↔Comet Maze while preserving the old maze and its hints.
- [ ] Record exact observed evidence separately from source tests and delivered files. Separate maps do not establish 100-user capacity, working media or sponsored production readiness.
