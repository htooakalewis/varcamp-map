# Scripted Lyra Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Execute tasks with independent review; user supplied this method and standing approval.

**Goal:** Publish and demonstrate one shared scripted Lyra concierge without OpenRouter.

**Architecture:** A standalone official-compatible browser module owns one bot avatar and a single lifecycle-managed movement/dialogue state machine. Separate source publication and a limited devbox browser launcher provide reviewable artifacts and real two-visitor verification.

**Tech Stack:** Existing TypeScript/Vite/Vitest, WorkAdventure iframe typings1.32.10, existing native Tiled source; isolated development browser tooling only if necessary.

**Spec:** `docs/superpowers/specs/2026-10-16-scripted-lyra-design.md`

## Global Constraints

- One bot; no model requests; no map/art/layout/legacy guide source changes.
- Worktree `codex/lyra-scripted-bot`; no new browser-module dependencies.
- Route graph743 safe cells, native startup4cells north-only escape, 32pixel tile centers.
- All18 known destinations; no portals, forced follow, teleport, quest writes or arbitrary navigation.
- Greeting120s, reply2s, visitor entries256/10min, conversation idle20s, adjacent moves100ms delay and patrol corner2s rest.
- Every existing test stays required. Publish only after independent source review and actual artifact checks.

## Review Focus

- Startup inside directory requires exact bounded north escape; no permanent reserved-cell permission.
- Stop/duplicate run during pending movement cannot start a second movement or leak old callbacks.
- Room or geometry changes stop safely; release URL rewriting must not invalidate a compatible map.
- Bubble membership, sender IDs and escort owner prevent chatter and competing movement commands.
- Public script or unit tests alone cannot stand in for two independent real visitors observing the shared bot.

### Task 1: Official-compatible Lyra module and artifact

**Files:** Create `src/bots/{lyra,controller,venue,map-guard}.ts`, `src/bots/lyra-routes.json`; create `tests/lyra-bot.test.ts`, `tests/lyra-bot-release.test.ts`; modify `buildmap.vite.config.ts`; create `docs/operating/scripted-lyra.md`.

**Interfaces:** Official default `{run(metadata:unknown):Promise<void>}`; pure controller owns movement state and accepts a narrow real-API adapter and injectable clock/scheduler. Route data derives from provided audited route proposal; public API signatures are implementer-owned but must be documented in the report for downstream integration. Bundle entry is `bots/lyra.js`; `run` is the only start path.

- [ ] Write behavioral tests first, run and record RED; include actual built artifact absence/import contract and native-route counterexamples.
- [ ] Implement minimum module, safe graph planning, bilingual command data, map guard and single lifecycle; use installed typings as authority, bubble scope and default module object as official starter.
- [ ] Add independent bundle entry; do not import it from `src/main.ts` or runtime.
- [ ] Run focused tests, `npm run buildmap`, and full `npm test -- --maxWorkers=1 --testTimeout=30000` once; report exact outcomes and any inherited unrelated failures.
- [ ] Self-review and commit only owned files. Coordinator dispatches independent task review before next task.

### Task 2: Reviewed publication integrity and release

**Files:** `publication/source-manifest.json`, `publication/verify-source.mjs`, `README.md`, `docs/operating/scripted-lyra.md`; add source-integrity behavioral tests only if checker changes need them. Do not alter original303 source hashes.

**Interfaces:** Consume Task1 default.run and published `bots/lyra.js`. Extension inventory records added source files and changed root build configuration; old303 keys/hashes remain exact.

- [ ] Demonstrate old inventory rejects newly added sources; add negative tests for changed baseline, extension hash drift, missing extension and unlisted file before checker changes.
- [ ] Implement explicit extension integrity without weakening baseline hash coverage or33map-pair checks; document script URL and activation prerequisites.
- [ ] Verify package/HTTPS byte identity and full CI, independently review, then publish through authorized GitHub account. No new dependency upgrades or map regeneration.

### Task 3: One development bot and actual shared verification

**Files:** Separate `ops/bots/` development launcher, its own locked browser dependencies if needed, focused lifecycle tests and operating documentation. No changes to core services or credentials. Private runtime state stays outside Git.

**Interfaces:** Import Task1 HTTPS module into only the dedicated Lyra map-script iframe after joining the devbox map; expose local-only start/stop/status for that one development browser.

- [ ] Confirm official-manager license boundary and inspect devbox resources before mutations; document development launcher identity.
- [ ] Write and reproduce failing lifecycle/config tests, then implement a limited launcher with camera/mic disabled, one instance and safe cleanup. Review before starting it.
- [ ] Capture existing core IDs/health, start only this browser, and use two independent visitor contexts to observe shared motion and bubble commands.
- [ ] Verify stop/restart, no visitor control, actual serving bytes and unchanged core; save evidence. If browser or admin activation is unavailable, report exact blocker without claiming user outcome complete.
