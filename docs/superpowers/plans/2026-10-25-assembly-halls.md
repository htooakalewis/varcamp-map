# Assembly Halls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved speaker-room treatment to Solar/Lunar and align visible floor boundaries with their current presentation controls.

**Architecture:** A declarative two-hall successor and pure author transform reuse the existing native style atlas and partner panels. The existing interior guard calls the new mandatory hall guard. All WAM/portal/collision data stays exact.

**Tech Stack:** Native32px Tiled TMJ/WAM, TypeScript, Node26.11.1, sharp, Vitest, headless Playwright.

**Spec:** docs/superpowers/specs/2026-10-25-assembly-halls-design.md

## Global Constraints

64×56rooms,32px tiles,60seats each. Preserve stage/listener/prep IDs, staff rights, WAM bytes, original artwork, clocks, doors and paths. No PR/push/CI/new exposure; guides stay stopped. Native execution in the owner checkout follows the established workflow; the full-treatment answer authorizes extending the already approved design without another design or execution-method confirmation.

## Review Focus

- A seated or standing visitor should enter the same listening zone the floor depicts; outside galleries/foyer stay outside.
- Native logos must not cover old crests, furniture, windows, captions or pathways.
- Branding and trim must never add collisions or alter staff rights.
- Source/native/build must all reject coherent omissions and drift, without rewriting frozen history.
- The upload must retain independent organiser data and all unrelated maps/assets.

### Task1: Source/native treatment

**Files:** world/hall-presentation.json; tools/maps/hall-presentation.ts; tools/maps/reference-interiors.ts; tests/hall-presentation.test.ts and fixtures; only Solar/Lunar layouts, native maps and previews.

**Interfaces:** applyHallPresentation(original:MapLayout):MapLayout; assertHallPresentation(layout:MapLayout,catalog:TileCatalog):void. Uses renderReferenceInterior and the existing current map gate.

- [x] Add behavior/preservation/negative tests; run against old halls and confirm missing branding and floor-boundary mismatches fail.
- [x] Implement the bounded successor; retain all original seats/props except the three stated nonblocking floor dimensions. Add native four-logo panels and trim, then render both source/native maps.
- [ ] Run hall, speaker/interior, map/art/publication tests and inspect native/live output; resolve failures at their source. Commit locally with Codex co-author.

### Task2: Publication and acceptance

**Files:** Named hall publication revision, exact extension receipts, release facts, private evidence under.orca/assembly-halls and.qa.

**Interfaces:** Guarded prepare/review/apply, existing smoke, hall-specific physical walkthrough and public hash comparison.

- [ ] Run maps/art/build/source/facts checks and full regression comparison against the current130known failures (Node17pass/1known failure).
- [ ] Obtain one fresh review, reproduce/fix Important findings and verify scope:32other native maps,34WAMs and every existing asset byte retained.
- [ ] Refresh receipts/facts, commit/FFmain; prepare and inspect a fresh guarded plan, apply it and verify two complete readbacks with token-only WAM changes.
- [ ] Verify fresh/reload, listener approaches/staff rights/return routes with media off. Close browsers, verify guides stopped, retain a concise verification record.

Execution note: Lewis added twelve zodiac exteriors during hall implementation. The final whole-change review and guarded publication will cover both additive requests together. Hall-specific native/source scope was captured before exterior changes; its336 focused/broad tests pass.
