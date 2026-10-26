# Drones and arrival implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline; one fresh whole-change review at the end. Owner explicitly requested execution and deployment.

**Goal:** Draw all overworld drones on top and publish the larger colourful arrival logo, cleared road sign and relocated car.
**Architecture:** Adopt the closed drone-depth epoch; compose one finite arrival successor with four standard sponsor panels and a placement-only Roadster metadata producer. Preserve immutable historical fixtures and native owners.
**Tech Stack:** Node26.11.1, TypeScript, sharp, native32pxTiled, Vitest, bundled headless Playwright.
**Spec:** docs/superpowers/specs/2026-10-26-drones-arrival-design.md

## Global Constraints

Preserve the zodiac fix and all85prior atlas bodies, existing art pixels/frame clocks, all34sourceWAMs and controls. New4panel reservations follow halls. Scope only arrival logo/sign/car and43drone depth. Public792guide graph retained where valid; private3services stopped. No PR/push/CI, AWS credentials or new exposure. Long jobs in tmux; camera/microphone off.

### Task 1: Integrate and qualify the existing drone epoch

Interfaces:836ea81 -> exact current owner branch successor809a1d0, consumed by Task2's immutable pre-arrival fixture.

- [ ] Preserve all7unfinishedBfiles and the tracked diff without modifying Claude's worktree; cherry-pick836ea81 onto a0bbbcb.
- [ ] Run the adopted drone/animation/physics tests and inspect failures against the actual130known baseline, not the handoff's load-dependent counts.
  Run: fnm exec --using26.11.1 npm test -- tests/drone-depth.test.ts tests/zodiac-physics.test.ts tests/plaza-drones.test.ts tests/plaza-fleet.test.ts tests/airborne-birds.test.ts tests/current-animation-safety.test.ts tests/animation-policy.test.ts --maxWorkers=1 --testTimeout=30000
  Expected: adopted behavior checks pass;43unchanged layer bodies trail the complete native stack.

### Task 2: Finish the arrival successor and publish both changes

Files: tools/art/arrival-refresh.ts, tools/maps/arrival-refresh.ts, world/arrival-refresh.json, new source SVG/metadata/four panels; native ownership/plaza/art current gates; tests/arrival-refresh.test.ts, immutable fixture/history adapters; publication revision and public route pins.
Interfaces: genuine809a1d0before -> renderArrivalRefresh/applyArrivalRefresh/reconcileArrivalRefresh -> mandatory source/art/native checks -> public guide audit -> guarded demo release.

- [ ] Freeze genuine809a1d0inputs and all old media/control hashes. Write arrival tests first: four6x2panels form12x4at58,60; sign+pole+relationship absent; native pole cell68,64free; complete car at74,54with same frames; all43drones trailing; source/native idempotence and negative coherent mutations.
  Run: fnm exec --using26.11.1 npm test -- tests/arrival-refresh.test.ts --maxWorkers=1 --testTimeout=30000
  Expected: arrival requirements fail on the actual adopted drone source.
- [ ] Implement the pure logo/car placement producer and exact source/native transaction. Retain old producer defaults. Add the four named native reservations after halls, preserving every old GID. Clear only the sign/pole's native collision and retire its owned paint image layer exactly.
- [ ] Add mandatory art/plaza/current gates; alpha/colour/native raster, sealed source family, placement envelope, full car/pad bounds and no-control-overlap checks. Reproduce other affected metadata via producers; add exact provenance/historical adapters and finite byte receipts.
- [ ] Extend old arrival expectations deliberately (replaced sign/old logo tests), preserve their original fixture contracts, and audit public guide pins. Append publication successor, sync facts and re-pin again. Run focused historical/animation/arrival tests before the full scan.
- [ ] Run maps:validate, art:check, maps:build, buildmap and one stable full test comparison against exact130known failures. Address any new failures RED->GREEN and rerun as needed. Run Node suite, documenting its known COPY mode failure.
- [ ] Obtain one fresh whole-change review; fix Important findings once with RED->GREEN. Commit locally and fast-forward main.
- [ ] Execute npm run deploy:demo -- --apply using media-off preload and a unique retained plan. Verify both complete readbacks and organizer preservation. Live smoke, first arrival viewport, clear former sign tile, relocated car/unchanged animation and43top drone layers. Capture full arrival screenshot, close browsers, record receipts and show Lewis the result.

Task completion command: fnm exec --using26.11.1 npm test -- tests/arrival-refresh.test.ts tests/drone-depth.test.ts tests/roadster.test.ts tests/guide-route-audit.test.ts tests/medium-hub.test.ts --maxWorkers=1 --testTimeout=30000 --hookTimeout=30000
Expected: all focused task checks pass; complete source/live evidence retained.

## Review Focus

- All43registered drones, including the three fleet types, remain above scenery and attendee sprites; unknown roles cannot gain the exemption.
- Four logo quadrants meet on exact32pxgrid positions with no seams, distortion, changed branding or blocked spawn/guide cells.
- Removing every new marker cannot bypass current arrival enforcement; historical inverses never silently strip a malformed candidate.
- Car relocation includes its pad/shadow/flame footprint and exact one-flip animation, with no residual old carriers or altered historical v1/v2producer.
- New native families append after all85bodies; unrelated controls/WAMs and earlier art/physics fixes remain exact through complete live readbacks.
