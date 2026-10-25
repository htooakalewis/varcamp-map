# Tropical Cove Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

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

- [x] Write behavior tests for a recessed bay, open central sand, safe portals, water collision, prop grounding, caption retirement and preserved original asset/ship bytes. Run them before implementation; expected FAIL against the cluttered beach.
- [x] Render the new coast atlas using the unchanged renderer. Author a pure forward layout transform, a beach-only native transaction and a mandatory current validator. Preserve historical receipts; scope tests of retired decisions to hash-pinned snapshots.
- [x] Run the cove and affected coastal/caption/native tests; expected all current and historical coastal checks PASS. Render the actual native layers and inspect bay, palms, dock and signs at avatar scale.
- [x] Commit the authored redesign and tests locally with the agent co-author trailer.

### Task2: Verification, publication and live acceptance

**Files:** Named publication revision, exact extension receipts, docs/current-release-facts.md; private evidence under .orca/tropical-cove and .qa/.

**Interfaces:** Consumes Task1’s verified native beach. Produces a guarded release with baseline retention, two readbacks and live browser evidence.

- [x] Run maps:validate, art:check, maps:build and buildmap; expected PASS. Run full Vitest/Node suites and compare every failure with the prior baseline; expected no new failures.
- [x] Obtain one fresh whole-change review; resolve Important/Critical findings with failing-test-first verification.
- [x] Append a named publication revision without changing original303 receipts or earlier revisions. Refresh facts, then receipts again; expected verify-source and facts --check PASS.
- [x] Commit locally, fast-forward local main, prepare/review/apply the guarded release in tmux. Expected two complete readbacks match; preserve organiser WAM state and all unrelated assets.
- [x] Check public TMJ/WAM/atlas bytes, fresh/reloaded game views and physical portal approaches with camera/mic off. Close browsers and verify guide services remain stopped.

## Execution ledger

Owner’s “ok go” authorizes executing the chosen design without another design/plan confirmation. Execute natively in the current owner checkout; the skill’s additional review/confirmation prompts are superseded by that instruction and the standing devbox workflow. Preserve private evidence rather than deleting it after completion.

Task1: implemented; initial local commit414bb16. The final focused run passes119tests, including16cove tests. Earlier broader affected suites pass497tests; their three remaining failures now pass in the final focused run. Original206asset files,33other native maps,34source WAMs and1540catalog definitions remain byte-exact. The new coast has314separately named sprite definitions; the protected aircraft band keeps its original coast atlas and clock.

Fresh review: noCritical, threeImportant, noMinor, no declined findings. Reproduced all three before fixing: sea tint obscured timber, omitted water cells passed current validation, and the ordinary caption writer repacked the frozen shared reservation. The final119-test run verifies dock tint exclusion, complete2304-cell ground coverage, and immutable shared caption resources including missing-resource rejection. Review evidence is private under.orca/tropical-cove.

Task2: completed. Final full suite:2273passes and exactly the same130baseline failures, with no new failures or suite import errors. Node suite:17passes and its same single known image permission failure. Final guarded release is.qa/tropical-cove-20261025-final-d21a405; the earlier1937preview was not applied.

The first stable full run found2272passes and131failures: all130recorded baseline failures plus one expo-only caption writer regression. The existing expo fixture supplied the failing case. The writer now permits a completely absent, unused shared family while rejecting a missing or partial shared reservation when linked/present. The affected caption, cove, publication and solid-prop tests pass; the final full confirmation passes with exactly the baseline failure list. Node suite remains17passes and its single known image package.json permission failure.

Publication and live acceptance: code commitd21a405 was fast-forwarded to localmain and deployed through the fresh guarded plan. Both complete readbacks match638files, retaining the633-file baseline. All34WAMs change only version tokens; all437existing live asset files remain exact. Twelve public file hashes match. The7-step smoke and8-step physical tour pass with0unexpected browser errors; fresh/reload and roundtrips through all3gateways verified. Both headless browsers closed with camera/microphone off and0media requests/tracks. All3guide services remain exited; their private releases were not altered. Private verification and screenshots are under.orca/tropical-cove. No PR, push or hosted CI.
