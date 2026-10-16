# Shared VarCamp Guides Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. User supplied this method and full execution/publication approval; do not repeat confirmation gates.

**Goal:** Restore visible Lyra, retire four static robots, and deliver three reliable shared guides using zodiac names.

**Architecture:** Preserve the standalone bot module and audited controller, add bounded persona configuration, and run three isolated owned browsers. Explicit reviewed source revisions enable narrow native map edits without replacing the original source receipt. Runtime crash correction is gated on the ongoing real diagnostic and written causal decision before that task is dispatched.

**Tech Stack:** Existing TypeScript/Vite/Vitest/nativeTiled; isolated lockedPlaywright1.64.1 and pinned ARM64 browser base.

**Spec:** docs/superpowers/specs/2026-10-16-shared-guides-refresh-design.md

## Global Constraints

- Names Lyra [BOT], Nova [BOT], Orion [BOT]; no model calls; no ordinary visitor startup.
- Retire exactly four static robots/eight sprite cells/four labels/four conversation areas; no unrelated map, quest, collision or portal edits.
- Preserve original303 inventory; exact reviewed old-to-new revisions only, all33 map pairs required.
- Keep743 safe cells,4 startup cells/north-only escape; adjacent awaited movement100ms/rest2s, reply2s/greeting120s,256 visitor entries/10min,20s conversation idle.
- Each of three owned containers <=1CPU/2GiB/512PIDs; cap-dropALL/nonroot1000/nnp/read-only/default-deny derivedseccomp/Chromiumsandbox/AppArmor/noports/nohostmounts/noAWSchanges.
- Full real acceptance including12minute post-chat-departure soak; no claim from tests/commit alone.

## Review Focus

- Authoring and old liveWAMs cannot resurrect ghost Q&A prompts.
- Map signature changes require re-audit; deliberate portal/collision mutation still fails.
- All three bots sharing a bubble must ignore each other without ignoring human commands.
- New profile lifecycle operations must never stop siblings/core, including concurrent starts and bad ownership.
- Native UI errors require full diagnostics and independently measured bot capability; no blanket pageerror suppression or restart storm.

### Task 1: Explicit reviewed revisions in publication integrity

**Files:** publication/verify-source.mjs, publication/source-manifest.json; create publication/revisions/2026-10-16-shared-guides.json and tests/publication-revisions.test.ts. Tests/publication-integrity.test.ts remains required.
**Interfaces:** Preserve original sourceInventory keys/hashes. Add one schema-validated reviewed revision inventory with exact path/fromSha256/toSha256/reason and no wildcard/unknown keys; hash the revision file in extensionInventory. Subsequent tasks record only owned baseline-file revisions there, or extension hashes for added files. Checker validates fromSha256 against original receipt and actual bytes against toSha256; paths cannot overlap extensions or leave original inventory. Empty initial revision list is valid.
- [ ] Write behavioral temporary-tree regressions: old checker rejects explicit changed baseline; exact reviewed replacement passes only with matching old/new hashes; unrelated edits, missing revision file/source, wrong old/new digest, duplicate/unknown/wildcard path, overlap and changed extension fail.
- [ ] Run RED, implement strict policy and truthful verification wording; preserve all original receipt values and map-pair checks.
- [ ] Add new spec/plan and owned files to extension inventory; run focused publication tests/checker; self-review and commit only owned files.

### Task 2: Remove four static Q&A robots and re-audit map provenance

**Files:** Follow private static-robot-inventory.md exact table. Modify only four native TMJ/WAM pairs/affected previews, three raw layouts, npc-guides authoring/registration/runtime and directly affected tests; src/bots/lyra-routes.json provenance; reviewed revision/extension records.
**Interfaces:** Consume Task1 revision schema. Preserve addNpcGuides exported compatibility if callers need it while ensuring it cannot add any retired area/avatar/label. Disable actual runtime registration so old areas offer no ghost Talk action. Keep strict guard and same allowedCells graph/hash; update only independently computed source/geometry provenance with documented reason.
- [ ] Write absence/idempotence/legacy-area-no-action regressions first; compare all four collision masks and every unrelated native cell/object/area before/after. Keep quest/furniture/route checks; change only robot-presence expectations.
- [ ] Run RED, implement exact retirement; retain unused guides atlas/GIDs and BEACH BAR signage; do not blanket author/regenerate maps.
- [ ] Independently re-audit all743 cells against updated overworld collisions, portals, interactions, logo/scenery bounds; re-pin strict geometry and affected source hashes, tampering still fails.
- [ ] Refresh previews normally; run focused maps/NPC/route tests, native render all four, map/art validation/buildmap/checker; record exact delta and commit.

### Task 3: Three-persona module and zodiac-name-first dialogue

**Files:** src/bots/{lyra,controller,venue}.ts, create src/bots/personas.ts if needed; tests/lyra-bot*.ts, docs/operating/scripted-lyra.md; revision/extension records.
**Interfaces:** default.run(metadata) accepts a validated persona key lyra|nova|orion, with existing missing metadata defaulting to lyra. Each persona has fixed name, audited home/patrol and shared reserved bot-name set. Controller creation receives persona config; adapter uses public participant/player names and IDs to exclude the other authored bots from greeting/commands. No global WA/player/quest state writes.
- [ ] Write failing tests for bare all12 zodiac names (including Gemini/Cancer/Libra), case/whitespace/Burmese, name-first help/rooms, correct destination/owner-safe stop; retain numeric compatibility and existing concurrency/cancellation regressions.
- [ ] Add failing multi-bot simulations: three distinct personas, home/patrol all in same safe graph; each ignores the other two, human dialogue/escort works; no chatter/ownership loops or overlapping steps.
- [ ] Implement minimum persona interface and truthful greetings; no number-first prompts or hardcoded Lyra self-name for Nova/Orion. Validate metadata; no arbitrary routes/names/URLs.
- [ ] Run focused module/artifact tests and build; record actual new module SHA/size for Task4; update docs/inventories and commit.

### Task 4: Three owned runners and reproduced crash boundary correction

**Files:** ops/bots/config.mjs, browser-session.mjs, runner.mjs, manager.mjs, cli.mjs, README.md; focused ops/tests; revision/extension records.
**Prerequisite:** Coordinator must attach the completed visibility reproduction/causal decision before dispatch. No speculative implementation of error policy. Existing historical failure and deployed native-source candidates are evidence, not a substitute for the full real exception stack. If diagnostic cannot establish cause, preserve evidence and report the blocked runtime portion.
**Interfaces:** Consume Task3 validated persona metadata and new module digest. CLI supports explicit lyra/nova/orion actions, with documented existing Lyra default compatibility. Container names fixed per spec; ownership includes persona+module digest; operations inspect/act on immutable matching IDs. Runner joins correct name/observed avatar, imports verified public bytes, passes only persona metadata. No bot activation in visitors.
- [ ] Reproduce missing-three-profile lifecycle and diagnosed crash-policy bug in failing tests; preserve full error stack/frame/source diagnostics with bounded logs. Keep crashes, controller/map/identity/media failures sticky and fail-closed. Any contained native-presentation exception must meet independently reviewed exact origin/signature and real controller-capability checks, never message-only blanket filtering.
- [ ] Implement three-profile local management using same bounded isolation, cleanup, no-port and camera/mic-off controls; test sibling isolation/concurrency/ownership/refusal/failure cleanup.
- [ ] Implement only written causal correction, run focused ops/module tests, source checker/build; independent scoped security/lifecycle review before starting any new runtime.

### Task 5: Coordinator release and actual user acceptance

**Files:** Private QA/release plans only; source documentation corrections if review requires them through implementer.
- [ ] Whole-branch independent review, focused fixes, full canonical CI/Pages; compare exact complete public artifact and module bytes.
- [ ] Prepare guarded native release from complete current devbox baseline; reviewed ZIP removes only four exact liveWAM areas and preserves all unknown metadata/entities. Rehearse editor-save preservation in owned test namespace, inspect quiet-window plan and recoverable baseline, then apply with double inventories/delayed full readbacks.
- [ ] Inspect resources; preserve old failure logs and remove only old owned exited container via its old CLI. Build ARM64 image from reviewed ops Git archive, start exactly three profiles; verify actual confinement and all69 pre-existing containers unchanged.
- [ ] Two visitors observe exactly three distinct moving guides, bare zodiac room requests and shared correct responses, no bot-to-bot loops; independent movement and isolated stop/restart one profile.
- [ ] Exercise native chat scroll/close and visitor departures;12minute soak after departure with full diagnostics/capability checks and all three healthy. Close QA clients, verify three persist, inspect user's open map visibly and four robot-free maps/no ghost prompts.
- [ ] Record exact evidence/deployment status/remaining limits; publish only real verified outcome, preserve worktree and private reports.
