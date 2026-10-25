# Tropical Cove Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the cluttered beach with a navigable tropical cove and publish the verified result through the owner’s devbox workflow.

**Architecture:** Add a separately named coast atlas and declarative cove recipe. Apply an explicit beach-only source transaction and reconcile native visible layers without changing portal controls or unrelated maps. Reuse existing prop and caption pixels.

**Tech Stack:** Node26.11.1, TypeScript, sharp, native32px Tiled TMJ/WAM, Vitest, Playwright.

**Spec:** docs/superpowers/specs/2026-10-25-tropical-cove-design.md

## Global Constraints

-48×48 map,32×32 tiles; three byte-exact entry/exit pairs.
- Existing ship, aircraft-band geometry, wildlife art and clocks remain exact.
- Every existing asset byte is retained; add a separately named native coastline atlas.
- No PR/push/CI, new exposed service, guide restart or private pin change.

## Review Focus

- The apparent shoreline must agree with where avatars can walk; partial coast cells cannot provide invisible dry bridges.
- All return spawns and boarding controls must be reachable without crossing an unintended exit.
- Retired signs must have neither floating captions nor invisible solid supports.
- Historical atlas/caption source must stay immutable and current-source omissions must fail closed.
- Public WAM migration must preserve independent organiser state and unrelated maps.

### Task1: Cove authoring and native contract

**Files:** Create world/tropical-cove.json, tools/maps/tropical-cove.ts, tools/art/tropical-cove.ts, tests/tropical-cove.test.ts, tests/fixtures/tropical-cove/*; modify active coast registry and caption selection; update only beach source/native/preview and current tests as required.

**Interfaces:** Consumes renderCoast(recipe,options), buildMap(layout,catalog), attachOrganicCoast(map,layout), reconcileNativeProjection(native,source). Produces the current beach layout/native map and assertTropicalCove(map,layout,catalog).

- [ ] Write behavior tests for a recessed bay, open central sand, safe portals, water collision, prop grounding, caption retirement and preserved original asset/ship bytes. Run them before implementation; expected FAIL against the cluttered beach.
- [ ] Render the new coast atlas using the unchanged renderer. Author a pure forward layout transform, a beach-only native transaction and a mandatory current validator. Preserve historical receipts; scope tests of retired decisions to hash-pinned snapshots.
- [ ] Run the cove and affected coastal/caption/native tests; expected all current and historical coastal checks PASS. Render the actual native layers and inspect bay, palms, dock and signs at avatar scale.
- [ ] Commit the authored redesign and tests locally with the agent co-author trailer.

### Task2: Verification, publication and live acceptance

**Files:** Named publication revision, exact extension receipts, docs/current-release-facts.md; private evidence under .orca/tropical-cove and .qa/.

**Interfaces:** Consumes Task1’s verified native beach. Produces a guarded release with baseline retention, two readbacks and live browser evidence.

- [ ] Run maps:validate, art:check, maps:build and buildmap; expected PASS. Run full Vitest/Node suites and compare every failure with the prior baseline; expected no new failures.
- [ ] Obtain one fresh whole-change review; resolve Important/Critical findings with failing-test-first verification.
- [ ] Append a named publication revision without changing original303 receipts or earlier revisions. Refresh facts, then receipts again; expected verify-source and facts --check PASS.
- [ ] Commit locally, fast-forward local main, prepare/review/apply the guarded release in tmux. Expected two complete readbacks match; preserve organiser WAM state and all unrelated assets.
- [ ] Check public TMJ/WAM/atlas bytes, fresh/reloaded game views and physical portal approaches with camera/mic off. Close browsers and verify guide services remain stopped.

## Execution ledger

Owner’s “ok go” authorizes executing the chosen design without another design/plan confirmation. Execute natively in the current owner checkout; the skill’s additional review/confirmation prompts are superseded by that instruction and the standing devbox workflow. Preserve private evidence rather than deleting it after completion.

Task1: implemented. Nine cove behavior/export tests and71 focused coastal/caption tests PASS; maps:build, art:check, buildmap, publication source and facts checks PASS. Original206asset files,33other native maps and34source WAMs remain byte-exact.
