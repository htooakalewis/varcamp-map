# Aries live preview implementation plan

> **For agentic workers:** Execute this plan in the current session, with an independent final code review. Retain the owner's no-PR, local-commit/main-fast-forward deployment workflow.

**Goal:** Publish only the redesigned Aries room in the existing demo so Lewis can review it in-game before the remaining eleven rooms change.

**Architecture:** Keep the original fourteen-room functional contract intact. Add an explicit Aries presentation successor for its stage/listener areas and branding; preserve every existing furnishing, route, zodiac feature, animation and native tile footprint. Derive a reviewed live WAM migration from a fresh storage baseline while preserving independent editor content.

**Tech stack:** Node 26.11.1, TypeScript, native 32px Tiled tiles, existing Sharp and WorkAdventure WAM schemas.

**Spec:** The requested Aries preview at `.orca/speaker-room-preview/design.md` and its rendered images. Lewis's subsequent live screenshot establishes the need to make that single room available in-game.

## Global constraints

- Only Aries gains branding and presentation controls; other room geometry and controls remain unchanged.
- Use the existing four brand PNGs at their native 192x64 or 128x64 sizes.
- Retain the frozen original interior contract and original 303 publication receipts.
- No new public services, AWS access, PRs or pushes. Private guide services remain stopped.
- Headless live checks keep camera and microphone off.

## Review focus

- Every seat is covered by the audience area; stage and audience do not overlap.
- The audience references the stable stage area ID and enables listening/raise-hand.
- Branding cannot hide zodiac details or change collisions, arrivals or returns.
- Coherent source/native omissions must still fail production acceptance.
- The reviewed WAM delta preserves unrelated live areas, entities, rights and metadata.

### Task 1: Define and verify the Aries successor

Files: `tests/aries-presentation.test.ts`, `world/aries-presentation.json`, `tools/maps/aries-presentation.ts`, `tools/maps/reference-interiors.ts`, `world/layouts/speaker-aries.json`, `maps/speaker-aries.tmj`, `maps/speaker-aries.wam`, native preview.

- [ ] Write and observe failing actual-source/native tests for separate presenter/listener controls and native branding.
- [ ] Add the named successor; preserve the original contract, all old furnishings and collision geometry.
- [ ] Add negative acceptance tests for missing listeners, wrong references, missing marks and rescaled artwork.
- [ ] Update existing current-room expectations to distinguish the Aries presentation from the eleven preserved group calls.
- [ ] Run focused tests and existing interior acceptance tests.

### Task 2: Add native artwork and refresh receipts

Files: new original speaker wallpaper SVG/PNG/metadata, `art/tile-catalog.json`, `art/sources.json`, generated input receipts and publication records.

- [ ] Retain exact native logo bytes and create the seven geometric 32px wallpaper/trim tiles from the preview.
- [ ] Refresh only necessary provenance and public module pins; verify no other native room changes.
- [ ] Run art/map/build/source checks, full Vitest and Node suites; compare known baseline failures by name.
- [ ] Obtain independent review and correct material findings.

### Task 3: Publish one room for owner review

Files: private reviewed WAM migration, release plan, verification receipts.

- [ ] Reconcile only Aries's old meeting area and add its audience; retain independent live content and update map version tokens.
- [ ] Commit the explicit reviewed paths with the Codex coauthor trailer; await completion and fast-forward local main.
- [ ] Build and upload through the existing guarded planner, with two complete readbacks.
- [ ] Verify live Aries bytes/controls, seven-step smoke, media-off state and stopped guide services.
- [ ] Verify the redesigned Aries backdrop in a fresh headless game view, close the browser, and provide the room link for Lewis's review.
