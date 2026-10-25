# Speaker room rollout implementation plan

> **For agentic workers:** Use superpowers:executing-plans for the approved inline workflow; request one independent review before publication.

**Goal:** Apply the owner-approved live Aries design to the remaining eleven zodiac speaker rooms and deploy it.

**Architecture:** Reuse the exact Aries tile atlas, four native logos, captions and presenter/listener controls. A named eleven-room successor adapts the trim to the existing stage borders, centres branding in each width and covers all existing seats without including the social foyer. Retain Aries and all other native maps unchanged.

**Tech Stack:** TypeScript native TMJ/WAM author tools, Python guarded publisher, Node 26.11.1, existing Playwright.

**Spec:** Lewis approved the live Aries preview and instructed: “apply exactly as it to the rest of the rooms.”

## Global constraints

- Preserve every original furnishing, zodiac feature, collision cell, animation, entry, return, room dimension and existing asset byte.
- Reuse the approved 32px tile atlas and original 192x64/128x64 logos without scaling source artwork.
- Preserve all independent live editor data; refuse customized owned controls or colliding area/property/control-owner identities.
- Keep the frozen fourteen-room contract, original 303 receipts and every prior publication revision unchanged.
- Keep private guide services stopped and their private release pins untouched. Camera/mic off in headless browsers.
- Local commit with Codex trailer, await completion, fast-forward main, guarded devbox deployment. No PR, CI or push.

## Review focus

- Pisces final seat extends to row 26; listener bounds must cover it while excluding the foyer starting row 27.
- Sagittarius is 40 tiles wide; centre complete logos/captions without moving its unique furniture.
- Stage widths differ; frame and speaker controls follow each existing stage border.
- Independent editor settings, vendor data, entities and areas retain JSON types through fresh reviewed migration.
- All previous byte receipts remain historical; explicit finite successors prove current room changes.

### Task1: Native room family

Files: `world/speaker-presentation.json`, `tools/maps/speaker-presentation.ts`, existing Aries wrapper, eleven layouts/native pairs/previews, `tests/speaker-presentation.test.ts`, bounded history helpers/fixtures and existing room tests.

- [ ] Add tests for actual exported branding, per-room stage/listener controls, all-seat coverage, foyer exclusion, collisions/original furnishings and preservation of Aries.
- [ ] Run and observe missing branding/zones fail.
- [ ] Add the finite template successor and author only the eleven room pairs; extend independent history proofs without changing old receipts.
- [ ] Run room/native/history checks.

### Task2: Live data migration and publication

Files: `ops/release_upload.py`, scoped migration regression fixture/test, named rollout publication revision and pinned source manifest.

- [ ] Add publisher tests for valid eleven-room migrations and rejection of unowned changes, numeric booleans, customized controls and identity collisions; observe failure first.
- [ ] Reuse the existing guarded native-area merge through an exact eleven-room allowlist. Preserve Aries's migration behavior and ordinary token-only behavior.
- [ ] Append a new revision; refresh exact guide input provenance if necessary while preserving route geometry/module/private pins.
- [ ] Run focused publisher/source checks and one full suite; compare exact failed-test names to the approved Aries baseline.
- [ ] Request independent review and fix important findings before release.

### Task3: Deploy and verify

- [ ] Capture a fresh live baseline, construct reviewed candidates, validate actual native rooms, preserve all other WAM bytes except their version tokens and prepare the official release plan.
- [ ] Commit reviewed sources, confirm clean tree, fast-forward main and apply with quiet-window checks and two complete readbacks.
- [ ] Verify HTTP bytes for all twelve speaker rooms and assets; run live smoke plus room-by-room fresh/reload and listener UI checks, with media capture off and browsers closed.
- [ ] Save receipts and report the rollout live.
