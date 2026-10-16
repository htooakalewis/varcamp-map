# VarCamp Zodiac Wheel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the twelve existing furnished speaker rooms physically reachable from the VarCamp entry plaza by a continuous, clearly labeled zodiac wheel while preserving the rest of the event world.

**Architecture:** Keep `overworld` as the entry map and rebuild it as a 320×320 zodiac plaza. Compose the twelve existing room interiors into radial pavilions, retain their exact meeting identities/settings, and reflow the four elemental maps into non-speaker commons while preserving their quests. Preserve the previous full-size adventure overworld as a new `campus-exploration` destination. Add a central “Start Here” guide, a broad bidirectional ring, collision-aware room approaches, gold orbit lights, four direction signs, and maintained links to all twelve destinations; rely on the deterministic JSON layout/build pipeline.

**Tech Stack:** Tiled 1.12.2 TMJ/WAM, TypeScript layout builder, JSON map layouts, Vitest, existing art catalog and license manifests.

**Spec:** `docs/superpowers/specs/2026-10-11-varcamp-zodiac-wheel-design.md`

## Global Constraints

- Keep `maps/overworld.wam` as the entry map with a default spawn inside the central welcome area.
- Provide exactly twelve unique speaker areas, one per sign, with the existing `varcamp-<sign>` meeting names, muted defaults, disabled chat, and raise-hand enabled.
- Preserve all eleven existing map IDs, both new social maps, and the three quest flags and completion flows.
- Preserve the visual identity and presentation essentials of each existing zodiac room; do not copy map art or code from the four references.
- Keep all wheel roads, spawns, doorway approaches, meeting areas, exits, signs, and map placements in bounds and free of blocking collisions.
- Keep all asset attribution and licenses; no server, AWS, upload, publication, login, or account changes.
- Run implementation in the existing isolated `codex/varcamp-amenities` worktree and use test-first red/green cycles.

## Review Focus

- Missing or duplicated meeting identity during room migration — test exact equality of all twelve meeting-zone names and preserved settings.
- A radial room door or loop cell blocked by collision — test reachability from welcome spawn to all twelve doors and route cells.
- A broken route or stale map exit after reflow — test the full map-exit graph, all entries, and returns.
- Dropped or unreachable quest areas in repurposed elemental maps — test all four sigils and existing quest zones against baseline names and reachable paths.
- Room group transforms clipping art or labels outside the map — test all generated placement and sign bounds, then review official Tiled renders.

---

### Task 1: RED wayfinding and room-migration acceptance tests

**Files:**
- Create: `tests/zodiac-wheel.test.ts`
- Modify: `tests/overworld.test.ts`
- Modify: `tests/world-contract.test.ts`

**Interfaces:**
- Consumes: current `world/layouts/*.json`, `WORLD_CATALOG`, `buildMap(layout, tiles)`, `validateMap`, and `validateWam`.
- Produces: executable checks for welcome spawn, a closed walkable ring, twelve labeled/unique speaker pavilions, current meeting names/settings, and reachable legacy/quest exits.

- [ ] **Step 1: Write failing tests** named `keeps the twelve unique meeting rooms in the entry map`, `connects every zodiac doorway and ring cell to the welcome spawn`, `shows all twelve numbered sign labels in zodiac order`, `preserves all legacy map exits and returns`, and `keeps every quest sigil area reachable after room migration`. Assert exact twelve-name set, all ring tiles reachable, door-entry cells clear, label/sign mapping complete, original map ID set retained, and four quest sigils preserved.
- [ ] **Step 2: Run RED** with `npm test -- --run tests/zodiac-wheel.test.ts tests/overworld.test.ts tests/world-contract.test.ts`. Expected: failures identify absent wheel/room map placement, room areas remaining in district WAMs, and missing route/sign contracts; no harness or parse error.
- [ ] **Step 3: Commit tests only** as `test: specify zodiac wheel wayfinding acceptance` after retaining the exact failing output in `docs/qa/zodiac-wheel/red-tests.txt`.

### Task 2: Compose and relocate the twelve furnished rooms

**Files:**
- Create: `tools/maps/zodiac-wheel.ts`
- Modify: `tools/maps/types.ts`
- Modify: `tools/maps/build.ts`
- Create: `tests/zodiac-wheel.test.ts`
- Create: `world/layouts/campus-exploration.json`
- Modify: `world/layouts/overworld.json`
- Modify: `world/layouts/fire-district.json`
- Modify: `world/layouts/earth-district.json`
- Modify: `world/layouts/air-district.json`
- Modify: `world/layouts/water-district.json`

**Interfaces:**
- Consumes: all catalog layouts and the existing four elemental source layouts for speaker-room placements/areas.
- Produces: `composeZodiacWheel(layouts: MapLayout[]): MapLayout[]`, which translates each existing furnished room module into one of twelve ring pavilions without changing its interior, retains its exact meeting area/settings, and removes the duplicate room footprint from its source district.
- The composed overworld has exactly one existing meeting WAM area per sign and includes a physical doorway threshold for each sign.

- [ ] **Step 1: Write failing composition tests** for one-to-one source placement/content preservation, meeting-area settings, unique room identity, route connectivity, and no road tiles through pavilion footprints.
- [ ] **Step 2: Run RED** with `npm test -- --run tests/zodiac-wheel.test.ts`; expected failures identify the missing central room composition and promenade.
- [ ] **Step 3: Implement deterministic room extraction and integer-tile translation** in `tools/maps/zodiac-wheel.ts`; reject missing source rooms or duplicate identities rather than silently dropping them.
- [ ] **Step 4: Add twelve radial speaker pavilions** around the 320×320 overworld plaza and make the builder compose them before export. Keep the world canvas large enough for the complete circle, center spawn, and named gate routes; add a separate `campus-exploration` map that preserves the previous full-size world.
- [ ] **Step 5: Reflow former room footprints** in the four elemental districts into clear elemental lounge/commons areas, retaining each sign's element identity and the existing sigil area without any speaker meeting areas.
- [ ] **Step 6: Run transform and migration RED tests** and record output; fix production code until all pass while keeping source assets/attribution intact.
- [ ] **Step 7: Run `npm test -- --run tests/zodiac-wheel-compose.test.ts tests/zodiac-wheel.test.ts`**; expected: transform and structural acceptance tests pass.
- [ ] **Step 8: Commit** as `feat: move zodiac speaker rooms into arrival wheel`.

### Task 3: Add visitor directions and reconnect the campus

**Files:**
- Modify: `world/layouts/overworld.json`
- Modify: `world/layouts/fire-district.json`
- Modify: `world/layouts/earth-district.json`
- Modify: `world/layouts/air-district.json`
- Modify: `world/layouts/water-district.json`
- Modify: `src/journal/view.ts`
- Modify: `docs/operating/venue-guide.md`
- Modify: `README.md`
- Modify: `tests/zodiac-wheel.test.ts`
- Modify: `tests/journal.test.ts`

**Interfaces:**
- Consumes: the composed wheel layout and stable eleven-map catalog.
- Produces: a default `welcome` spawn; `01`-`12` labels mapped to zodiac sign/glyph/element; center guide with controls; ring arrows/destination signs at every route junction; named outer-campus routes and clear returns; directory/journal actions stay valid.

- [ ] **Step 1: Add failing direction tests** for all twelve exact labels in conventional zodiac order, the welcome/instructions signs, both loop directions, and each retained outer destination arrow/exit.
- [ ] **Step 2: Run RED** with `npm test -- --run tests/zodiac-wheel.test.ts tests/journal.test.ts`; expected: route labels, orientation/instructions, or updated room placement assertions fail.
- [ ] **Step 3: Add signs and arrow-marker placements** in the composed layout. Ensure text and floor arrows remain visible at Tiled's native zoom; retain redundant sign name, glyph, and element marker.
- [ ] **Step 4: Reconnect the campus destination graph** from the wheel and ensure every currently supported map entrance can return to the hub/overworld without dead ends. Do not change map IDs or quest flags.
- [ ] **Step 5: Update visitor instructions and directory labels** to explain the central orientation board, walking controls, numbered room sequence, element color key, return route, parks/arcade, and optional exploration.
- [ ] **Step 6: Run `npm test -- --run tests/zodiac-wheel.test.ts tests/journal.test.ts tests/overworld.test.ts`**; expected: all focused route and directory tests pass.
- [ ] **Step 7: Commit** as `feat: guide visitors around the zodiac wheel`.

### Task 4: Full package validation and visual review

**Files:**
- Modify/Create: `docs/qa/zodiac-wheel/*`
- Modify: `tests/world-package.test.ts`
- Modify: `tests/overworld.test.ts`

**Interfaces:**
- Consumes: composed maps, all existing maps, art sources, and release builder.
- Produces: a complete import ZIP, native Tiled renders, retained tests/validation logs, and documented hosted-verification blocker.

- [ ] **Step 1: Build source maps and preview** with `npm run maps:build`; expected: every layout emits validated TMJ/WAM and preview assets.
- [ ] **Step 2: Run `npm run maps:validate` and preview validation**; expected: zero source and preview issues.
- [ ] **Step 3: Run `npm run buildmap`, `npm test`, and `npm run art:check` serially**; expected: TypeScript/Vite succeeds, all tests pass, and all art bounds/licenses/source hashes pass.
- [ ] **Step 4: Validate all release WAMs with the pinned full upstream schema and package inventory**; expected: each source/release WAM passes, every unique map pair is included once, ZIP CRC succeeds, and archive bytes match `dist/`.
- [ ] **Step 5: Render the full wheel and focused crops with pinned Tiled 1.12.2**; review spawn view, full loop, labels/arrows, twelve entrances/returns, four element commons, existing plaza destinations, and quest landmarks. Fix any hidden text, collisions, or confusing visual hierarchy with a new failing test before correction.
- [ ] **Step 6: Repeat source/preview/release builds**; expected: byte-identical outputs.
- [ ] **Step 7: Run final `npm test`, `npm run buildmap`, map validation, art check, and diff review after all edits**; capture exact results, package SHA-256, and hosted client import/walk limitations in `docs/qa/zodiac-wheel/README.md`.
- [ ] **Step 8: Commit** as `test: verify zodiac wheel package and wayfinding`.

## Self-review

- **Spec coverage:** room migration/interior preservation is Task 2; circular path, spawn, labels, wayfinding, and all map links are Tasks 1–3; quest preservation is Tasks 1–2; full WAM/build/art/visual/package checks and the hosted gate are Task 4.
- **Step scan:** each task names its test, command, expected RED/GREEN, files, and commit. Geometry details stay in the spec and transform test values rather than duplicating a full coordinate implementation here.
- **Type consistency:** composer consumes/returns `MapLayout`; the builder consumes composed layouts and existing `buildMap` signature remains stable; WAM room areas use existing `LayoutArea` / `WamAreaProperty` types.
- **Review-focus coverage:** meeting identity/settings (Tasks 1–2), collision/reachability (Tasks 1–2), exits/returns (Tasks 1/3), quests (Tasks 1–2), bounds/rendering (Tasks 2/4).
- **Proportion:** four tasks match the tightly coupled layout migration, user-facing route work, and whole-package acceptance.
