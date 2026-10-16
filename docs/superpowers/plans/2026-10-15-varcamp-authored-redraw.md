# VarCamp Authored Redraw Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Track each independently reviewed deliverable below.

**Goal:** Ship the compact, hand-composed 33-map world with first-arrival demo sponsors and explicit separate activity entrances/returns.

**Architecture:** Explicit layout sources and the existing native Tiled exporter; remove automatic wheel/scatter composition. Keep editable TMJs durable through the normal build, separate sponsor image assets, existing WAM/state runtime, and guarded publication.

**Tech Stack:** TypeScript, finite 32px Tiled JSON/WAM, existing licensed PNG sheets, original SVG/PNG sponsors, Vitest, native Tiled rasterizer, Computer/Chrome.

**Spec:** `docs/superpowers/specs/2026-10-15-varcamp-authored-redraw-design.md`

## Global constraints

- 64×64 circular hub; 33 independent maps and seven new IDs exactly as specified.
- Speaker walks ≤42 tiles, six hall/activity threshold walks ≤24; no activity inside arrival.
- Three 192×64 original DEMO PNG logos as supported native tile layers using independent 6×2 PNG sheets, replaceable without regeneration.
- Preserve progress keys, real meeting settings and license records; no core, credential or provider change.
- No silent overwrite of native TMJ edits; no random decoration transform.
- Work in the existing isolated `codex/varcamp-amenities` worktree; preserve pre-existing changes.

## Review focus

- Returning from a leaf must place guests near its hub direction without immediate bounce.
- Narrow doors and road corners must be reachable with actual exported collisions, not only source rectangles.
- Later Tiled edits and replaced logos survive a normal map build.
- Relocated live areas retain their fresh properties, rights and stable IDs while obsolete activity areas are removed deliberately.
- Quest bindings must match actual separate-map ownership; reload retains earned progress.

### Task 1: Baseline and world contract — coordinator

Files: `src/world/catalog.ts`, `tests/authored-world.test.ts`, `tools/maps/build.ts`, `tools/maps/zodiac-wheel.ts`, `tools/maps/layouts.ts`, `tools/maps/author.ts`, `package.json`.

- [ ] Save existing source/map hashes and verify live starting scene; record code vs infrastructure cause.
- [ ] Write failing assertions for 33 IDs, compact bounds, all-entry/exit collision reachability, main distance bounds and no activity co-location; retain red output.
- [ ] Implement explicit layout loading without wheel/scatter transformation and update catalog from authored layouts. Separate normal preview/validation build from guarded initial author export.
- [ ] Test modified native TMJ preservation and explicit-author refusal to overwrite edits; test all physical returns and graph connectivity.

### Task 2: Authored interior family — interior implementer

Files: twelve new `world/layouts/speaker-<sign>.json`, four district JSONs, both hall JSONs, hidden-observatory JSON, family acceptance tests.

Interface: `MapLayout` explicit native placements; stable map IDs, speaker-entry and speaker plaza-return to `from-speaker-<sign>`. Meeting properties remain exact. Coordinator owns catalog/export/runtime.

- [ ] Write/run failing tests for independent authored interiors, meeting preservation, relocated discoveries and distinct furnishings.
- [ ] Hand-compose each scene with native assets, real wall/window/door structure, stage/focal point and social pocket, preserving clear 2-tile aisles and contracted area IDs.
- [ ] Make districts compact individual activities with their own sigil, without duplicate speaker-room shells.
- [ ] Verify builder bounds/collisions and supply per-map dimensions, entries, area migrations and screenshots/render instructions for review.

### Task 3: Authored outdoor/activity family — outdoor implementer

Files: campus, arcade, park, harbor, both maze JSONs; seven new activity JSONs; family tests and QA.

Interface: stable legacy entry aliases; all new maps default `arrival`, plus physical plaza-return using the corresponding existing hub return. Coordinator owns catalog/export/runtime.

- [ ] Write/run failing tests proving each new activity has its own layout and clear entries/exits.
- [ ] Compose compact exploration, harbor and entertainment branches with explicit gates to their leaf maps. Extract/recompose FA SHIP and shore into independent maps.
- [ ] Redraw maze architecture/landmarks without breaking checkpoint, finish or hint/solution contracts; record any necessary route update.
- [ ] Verify every activity/exit reachable, no sea walking and no entry/exit overlap; provide exact area migrations and sizes.

### Task 4: Sponsor assets and sponsor tile-layer export — art implementer

Files: `art/source/sponsors/*.svg`, `assets/sponsors/demo-01.png` through `demo-03.png`, `art/sponsors.json`, `tools/maps/types.ts`, `tools/maps/builder.ts`, `tools/release.ts`, sponsor tests/docs.

Interface: optional `MapLayout.images` array of `{name,image,x,y,width,height}` in tiles; path project-relative `assets/sponsors/...png`; TMJ image path relative to `maps/`. Three native192×64 images with original fictional DEMO marks, no links or actual sponsor claims.

- [ ] Write/run failing native-image export/package tests including invalid image paths and replacement durability.
- [ ] Author distinct SVG marks, rasterize with existing sharp, retain dimensions and edit instructions.
- [ ] Export image layers at correct pixel offsets, include referenced sponsor assets in release; keep frames outside logo bitmaps and never regenerate logos in maps build.
- [ ] Verify images visually and return asset paths/placement sizes to coordinator.

### Task 5: Compact arrival, runtime and integration — coordinator

Files: `world/layouts/overworld.json`, `src/journal/*`, `src/quests/interactions.ts`, NPC venue copy if navigation changed, relevant tests, operating docs.

- [ ] Author the64×64 circular arrival with inward-facing twelve room doors, six close thresholds, sponsor wall, readable instructions, guide and bounded garden pockets.
- [ ] Update journal with all public destinations; bind discoveries in speaker maps and telescope in terrace, preserving explicit actions and gate.
- [ ] Replace obsolete geometry/count assertions with new functional acceptance, preserving unrelated tests. Run author export, native schema, TypeScript, art, package and full tests.
- [ ] Render all33 maps using pinned Tiled, inspect each and walk local preview where useful; resolve actual findings.

### Task 6: Review, publish and live acceptance — coordinator and independent reviewer

Files: `ops/release_upload.py`, deployment tests, fresh WAM migration artifact, `docs/qa/redraw-2026-10-15/`, handoff/README.

- [ ] Independent source, functional, visual and migration review. Update uploader catalog consistently and test new-map enumeration.
- [ ] Fetch fresh live baselines; reconcile each moved native area by stable ID, preserve current properties/settings and explicitly review additions/removals. Prepare immutable complete release plan.
- [ ] Publish only `varcamp-demo`, then compare two delayed complete readbacks with every expected file hash. Do not restart or reconfigure core.
- [ ] Use Computer to verify sponsor arrival, all12 physical room entries/returns, entertainment, both mazes, harbor/shore/FA SHIP and exploration leaf links; verify checkpoint persistence and actual telescope action ownership.
- [ ] Record exact delivery/native evidence and blockers. Update docs with logo replacement and durable Tiled workflow. Report demo outcome separately from sponsored publication, AI/provider state and capacity/media rehearsal.
