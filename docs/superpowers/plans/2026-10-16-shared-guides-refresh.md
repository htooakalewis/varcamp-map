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

#### Reviewed Task 3 addendum and source verification

Task 3 also requires public self ID/name validation after `WA.onInit`; fixed metadata with absent-field Lyra compatibility; distinct cyclic homes `(70,70)`, `(73,73)`, `(66,70)`; participant and chat-author names; complete-snapshot classification before greetings; separate human membership and reserved-name bot candidates; deterministic rank/ID responder election independent of busy state; anchored guide prefixes with optional `[BOT]` and comma/colon delimiters; and owner-safe bare-stop fanout before election/reply cooldown. Explicit targeting retains local first-requester ownership and serialization. See the spec's reviewed interaction contract for the exact behavior.

Subscribe/cache public native meeting events before async map/position checks and replay only current membership after validation. Dispose early subscriptions on invalid map/replacement/shutdown. Already-established pre-subscription meetings cannot be discovered through the supported non-replaying API; acceptance requires later real meeting entry. Divergent snapshots are a documented limitation, not a global exactly-once claim. Do not use viewport/private stores or a delay to claim correctness.

Focused serial regressions cover all twelve names/Burmese/numeric compatibility, profile homes/startup routes, ordered/self-omitted snapshots, explicit escorts, bot-only patrol and author fallback, stop fanout inside cooldown with unrelated ownership preserved, join/leave and duplicate-persona numeric tie-breaks, divergent snapshots, deferred validation, invalid maps and replacement disposal. Retain existing route/provenance/cancellation/lifecycle tests and the standalone import/visitor-artifact test. Record actual emitted module digest/size after `npm run buildmap`; runner metadata/digest changes remain Task 4. Historical native runtime failures, runner error policy and deadlines remain unresolved and unchanged by Task 3.

### Task 4: Reviewed local three-profile evidence and readiness preparation

**Files:** ops/bots config/session/runner/manager/CLI/shared evidence serializer and necessary Docker copy closure; controller/adapter diagnostics; focused ops/module tests; operating docs and exact extension hashes.
**Causal prerequisite:** Completed private reassessment and Task 4 causal decision approve only this narrowed local work. Original native `hasPreviousMessage`, old normal-click failures and controller Abort operation/source/latency causes remain unresolved. Proven message-only evidence loss is the diagnosed code defect. The observed successful stationary UI handoff supports an explicit readiness contract, not a common runtime-cause claim.
**Interfaces:** Three immutable fixed profiles and observed avatars; compatible default Lyra CLI; exact name+owner+persona+module digest+immutable-ID management. Legacy stopped Lyra lacks persona and is refused by new operations; use the documented exact reviewed old CLI only under coordinator control. One selected profile per action, no automatic all-profile start.
- [ ] Behavioral RED→GREEN for sibling isolation/concurrent starts/name collisions/strict legacy and foreign-label refusal/failed cleanup; retain all resource/security pins.
- [ ] Original map/startup-position/pre-step-position/move rejection name/message/browser stack/cause and non-Error values survive bounded/redacted operation-aware controller→console→final runner storage. Capture delivered selected script responses with URL/hash/frame/time and explicit missing provenance. No participant chat or secrets.
- [ ] Observed welcome/modal and ordinary five-second optional media dismissal, hidden popup, both visible/off controls and actual denied permissions precede verified module import/run; recheck late prompts. Unknown states fail. Identity/live-controller/observed step progress precede ready.
- [ ] Deferred fatal probes cannot publish ready or schedule another heartbeat; first failure stays sticky. Preserve pending position/move quarantine and first-requester/cancellation/743-cell guards. Logger/artifact failures cannot bypass owned closure within the existing ten-second cleanup deadline.
- [ ] Build actual final module, pin exact SHA/size into all profiles/docs, rebuild for deterministic digest; update exact inventories preserving all 303 original receipts. Focused serial tests only, source checker/build/diff check, self-review and source commit. No browser/server/AWS/push/runtime rollout by this source worker.
- [ ] Coordinator obtains independent final source/security/isolation review and current resource preflight before authorizing one finite ARM64 canary. A separate decision based on real canary evidence gates sibling rollout. No error allowlists, retries, autorestarts, SDK/core changes or deadline increases.

#### Task 4 reviewed fix3 amendment: positive fresh welcome acknowledgement

The approved third-round reassessment replaces the optional instantaneous welcome decision only for the production runner's own fresh isolated context/single page and fixed overworld/profile/spawn. Issue a single-use lifecycle grant, validate public map/room/name/spawn without movement, await the unique exact welcome action, normally activate, validate native title plus named modal iframe's actual reviewed source ending `#directory`, close normally, then await final action absence and recheck before normal media. Observe consumed/pending immediately after activation; removal may span closure, so never await absence before closing. Initial startup cannot use the known-panel classifier as an exemption; post-start strict observation stays separate and never reopens welcome.

Failing-first asynchronous tests must deliver welcome independently after API/frame readiness while media is already visible, exercise residual removal across close, all three profile/media variants, invalid UI/map/spawn/context/frame and fatal late-continuation paths. Preserve default15s actions, outer120s startup, normal media5s, identity5s, actual cleanup10s, no retries/forced input/native writes/movement/classifier expansion. The observed canary interception identifies neither blocker text nor exact welcome timing; do not infer a historical native/Abort fix. Build/checker/exact source hashes, unchanged module/maps and independent scoped review precede another coordinator runtime decision.

### Task 5: Coordinator release and actual user acceptance

**Files:** Private QA/release plans only; source documentation corrections if review requires them through implementer.
- [ ] Whole-branch independent review, focused fixes, full canonical CI/Pages; compare exact complete public artifact and module bytes.
- [ ] Prepare guarded native release from complete current devbox baseline; reviewed ZIP removes only four exact liveWAM areas and preserves all unknown metadata/entities. Rehearse editor-save preservation in owned test namespace, inspect quiet-window plan and recoverable baseline, then apply with double inventories/delayed full readbacks.
- [ ] Inspect resources; preserve old failure logs and remove only old owned exited container via its old CLI. Build ARM64 image from reviewed ops Git archive; only after independent review/resource gate and coordinator authorization run one finite canary. After its evidence and a separate coordinator decision, add sibling profiles; verify actual confinement and all69 pre-existing containers unchanged.
- [ ] Two visitors observe exactly three distinct moving avatars. With deployed MAX_PER_GROUP=4 (minDistance64px/groupRadius48px), test all-guide arbitration in a three-guide+one-QA bubble and the same reply seen by both QA in ≤4-participant target-guide subgroups (other guides may be absent). Never claim a five-person bubble or change capacity/homes/patrol. Verify bare zodiac requests, shared correct responses and no bot-to-bot loops; independent movement and isolated stop/restart one profile.
- [ ] Exercise native chat scroll/close and visitor departures;12minute soak after departure with full diagnostics/capability checks and all three healthy. Close QA clients, verify three persist, inspect user's open map visibly and four robot-free maps/no ghost prompts.
- [ ] Record exact evidence/deployment status/remaining limits; publish only real verified outcome, preserve worktree and private reports.
