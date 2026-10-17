# Three owned development guide profiles

Task 4 prepares local source for three fixed, separately owned browser profiles. It does not establish a runtime cure or authorize a launch. Historical native `hasPreviousMessage` and controller Abort origins remain unresolved. The source corrects proven loss of original error evidence and makes the observed UI-to-controller readiness handoff explicit. Unknown page, module, API, identity, media and controller failures remain fatal; there are no filters, retries, automatic restarts or deadline increases.

| CLI profile | Container | Guest identity | Observed avatar |
| --- | --- | --- | --- |
| `lyra` (default) | `varcamp-lyra-dev` | Lyra [BOT] | `#woka-female4` |
| `nova` | `varcamp-nova-dev` | Nova [BOT] | `#woka-male2` |
| `orion` | `varcamp-orion-dev` | Orion [BOT] | `#woka-male1` |

Each invocation selects one profile. `node ops/bots/cli.mjs status` retains default-Lyra syntax; explicit syntax is `node ops/bots/cli.mjs nova status`. Actions are `start sha256:<immutable-image-id>`, `status`, `logs`, `stop`, and read-only `snapshot`. There is no all-profile start. Only the runner loads the locked browser dependency. The tool has no public management endpoint; the operator uses existing private SSH/Docker authorization. Official hosted Bots manager entitlement remains unverified.

## Source review and runtime gates

Independent final source/isolation review, current resource preflight, canonical CI/Pages and exact public-byte verification must precede a separately authorized finite ARM64 canary. A passing canary needs a coordinator decision before adding siblings. If an unexpected error recurs, retain the original operation/source/stack, stop, and reassess. Tests and source publication do not establish ten-minute reliability or a live three-bot outcome.

After those gates, the coordinator can build the reviewed image and operate one explicitly selected profile:

```sh
mkdir -p ops/private/guides
chmod 700 ops/private/guides
umask 077
node ops/bots/cli.mjs snapshot > ops/private/guides/before.json
docker build --platform linux/arm64 --iidfile ops/private/guides/image-id -f ops/bots/Dockerfile ops/bots
GUIDE_IMAGE_ID="$(cat ops/private/guides/image-id)"
node ops/bots/cli.mjs lyra start "$GUIDE_IMAGE_ID"
node ops/bots/cli.mjs lyra status
node ops/bots/cli.mjs lyra logs
node ops/bots/cli.mjs lyra stop
```

Nova/Orion use the identical image with their explicit CLI profile only when separately cleared by the coordinator. Each start atomically reserves its exact name. Running owned instances are checked; exited ones remain for explicit inspection/stop. A losing concurrent creator never cleans another creator's instance. Startup readiness retains 150 seconds, Docker calls 25 seconds, and browser startup 120 seconds. Failed startup cleanup re-verifies exact name, owner, persona, module digest and immutable ID before stopping/removing that ID. Foreign, missing or conflicting labels fail closed. Sibling/core objects are never adopted. Compare all 69 pre-existing container IDs/state/health with private before/running/after snapshots; the historical 31-container receipt is not the current baseline.

## Legacy stopped Lyra

The original stopped Lyra has the old owner/module labels and no persona label. New `status`, `logs`, `stop` and `start` refuse that label shape; absence of a persona never authorizes adoption or cleanup. No source test authorizes touching it.

The coordinator's explicit reviewed old-CLI path is `ops/private/lyra-legacy-04b6d56/ops/bots/cli.mjs`, extracted from the pre-Task-4 commit below. That old code verifies the original owner, exact old digest, name and immutable ID. Use it only after checking the recorded original ID/labels, preserving its failure logs, and passing the coordinator gate:

```sh
mkdir -p ops/private/lyra-legacy-04b6d56
git archive 04b6d566a3ec5c711a911a0f0a4bb74aa0dc2991 ops/bots | tar -x -C ops/private/lyra-legacy-04b6d56
node ops/private/lyra-legacy-04b6d56/ops/bots/cli.mjs status
node ops/private/lyra-legacy-04b6d56/ops/bots/cli.mjs logs
# Explicit legacy removal, only after preserving diagnostics and verifying the original ID:
node ops/private/lyra-legacy-04b6d56/ops/bots/cli.mjs stop
```

## Readiness, evidence and failure authority

All profiles pin `cb61aea75d5468999861a02571a05eeaa89428d3a8afa067f29a00d7ac6d54cc`, exactly 26,832 bytes, at `https://htooayelwinict.github.io/varcamp-map/bots/lyra.js?v=cb61aea75d5468999861a02571a05eeaa89428d3a8afa067f29a00d7ac6d54cc`. The runner verifies the exact HTTPS response with no redirects and fulfills the original browser import with those same bytes. It selects only the initialized expected `about:srcdoc` map frame and calls `default.run({ persona })` once. Ordinary visitors never activate the module.

For the production runner's freshly created isolated context only, readiness uses a positive welcome handshake. The lifecycle creates one blank guide page and issues an opaque, single-use grant; arbitrary/resumed contexts cannot enter this bootstrap. Public APIs must report the fixed room/name, expected map frame and one of the four reviewed native spawn cells, with unchanged identity/position at the subsequent settlement boundaries. No movement is commanded during UI settlement.

The sequence is fresh owned join/frame → unique exact welcome action observed with the existing finite action budget → one normal activation → unique visible `iframe#modalIframe` with exact `title="VarCamp Quest Journal"` attribute whose actual HTTPS source is the reviewed journal path ending `#directory` → unique native close control associated within the iframe's immediate parent DIV → both iframe and close hidden and consumed action absent → absence rechecked immediately before ordinary media handling → normal five-second no-media click if present → actual denied permissions and visible off controls/no blocking UI → verified module start once → identity/controller/confirmed step receipt → ready. After activation the action is observed as consumed or pending; delayed removal may span modal closure, so closure precedes waiting for final absence. Missing, duplicate, returned or stuck welcome, wrong/preexisting modal, unknown popup, media interception or unresolved/off/permission failures remain fatal. Guards after awaited startup boundaries prevent late completions from continuing after a fatal latch. The same outer120-second startup and ten-second cleanup caps remain.

This fresh-only contract supersedes the initial known-panel exemption from fix2. Initial startup cannot excuse a remaining action with that classifier. The existing strict post-start room observation remains separate: it can recognize only the exact known four-DIV native welcome action panel, without reopening it, and still rejects unknown sibling/content/control/modal states. Recognition never makes an intercepting panel safe to click through; a normal late media click failure remains fatal. There are no forced inputs, DOM/store/style writes, stability sleeps, alternate menus/callbacks, movement to clear a panel, retry or timeout increase.

The reported ARM64 canary proves native popup interception of its media click before controller import; missing blocker text/timestamps leave the exact welcome lifecycle unresolved. This amendment corrects the independent source gap between map API readiness and positive native welcome settlement. It does not diagnose that canary's exact blocker, historical click failures, controller Abort or native timeline causes.

Controller operations retain original Error name/message/browser stack/cause and non-Error values, operation/phase/sequence/start/settlement times, persona/generation and attempted cell/step count. The shared serializer bounds depth to four, selected object keys to sixteen, strings to 4KiB, and encoded evidence to 16KiB, with explicit redaction/truncation/serialization flags. URL userinfo/query/fragment and authorization/header/credential material are redacted; chat contents are never collected. Terminal console records are parsed, validated and sanitized again before the first failure is stored. Native pageerror stacks are stored directly, without presenting a Node wrapper stack as browser origin. Logger/getter failures cannot prevent terminal shutdown.

Current-operation/progress receipts remain in browser memory, with no 100ms monitoring log. Selected iframe SDK, main and GameManager response bodies are hashed from the response delivered during this session, recording URL/frame/observation time/status/size and captured-response origin. This does not refetch URLs or substitute local source hashes. At most eight selected responses of at most 8MiB each are hashed; capture gaps/pending/oversized/unavailable bodies are explicit. Response capture alone does not prove a script executed, and coverage gaps must remain in later attribution evidence.

Heartbeat probes are serialized. UI/media/permission observation has a five-second host deadline and terminal-failure race, independently of the existing five-second identity probe; a timed-out native evaluation is not cancelled or retried, and its late resolution cannot publish ready or schedule a new heartbeat. A fatal latch while any check awaits prevents subsequent ready/success and future scheduling; `RuntimeHealth` was already sticky. Pending moves and positions stay quarantined through stop/replacement until their actual continuations settle. Movement watchdogs and all routing/ownership semantics remain unchanged. First error evidence is latched/enqueued before optional artifacts; optional collection/storage has a bounded wait. The whole cleanup, including actual owned browser closure, retains the existing ten-second process deadline. The exited container remains for inspection. Health state uses private bounded tmpfs, with logs rotated at 2 × 5MiB.

## Isolation and pinned inputs

The additive container has at most 1 CPU, 2 GiB memory with no additional swap, 512 PIDs, 512 MiB private shared memory, and a 512 MiB writable `/tmp` tmpfs. Root filesystem is read-only; user is `1000:1000`; all capabilities are dropped; no-new-privileges and Docker init are enabled. It uses Docker bridge networking with no published ports, host networking, host IPC or external mounts. Core services, their IDs/health, AWS settings, credentials and map data remain outside this tool's mutation surface.

The browser image is the already inspected official ARM64 Ubuntu 24.04 Playwright 1.64.1 base, pinned to `mcr.microsoft.com/playwright@sha256:68456172e8d99f42cf391e835f5d566b3ab0a2c6a745decd9590c4d73c54d2fb`. It contains browser binaries; the separate lockfile installs only `playwright-core` 1.64.1. `npm ci --ignore-scripts` runs only during the image build. The map application's package and lockfile are untouched. `config.mjs`, `manager.mjs` and CLI import no browser library; only `runner.mjs` loads `playwright-core`.

Chromium sandboxing stays enabled. `seccomp.json` is a project-derived version of the [official Playwright v1.64.1 profile](https://github.com/microsoft/playwright/blob/v1.64.1/utils/docker/seccomp_profile.json). Upstream SHA-256 is `cc3e61cabda6bbc1e53e54d27ba4d55a9d3be829b6dd1a596f4a7b31b1cc7849`; the derived file is pinned to `f922c7c9bfc1ece0b72b244e56dc85756ded002c837fb46054cfd8b275c74b6b`. The only change removes the `CAP_SYS_CHROOT` include condition from the existing `chroot` allow rule. All other profile content, including default `SCMP_ACT_ERRNO` and the upstream `clone`, `setns`, `unshare` allowance, is preserved. The regression test restores that one condition and reconstructs the exact upstream bytes/hash. The accompanying Apache-2.0 [upstream license](PLAYWRIGHT-LICENSE) has SHA-256 `45873d00a0dd243596deb4aa23b2493b3d1f0671921bf2538ea431d7380220eb`.

This derivation is required because [Docker's profile loader](https://github.com/moby/moby/blob/8af9fe3a36bab3e039862a2ab1cef1880c9b4d03/vendor/github.com/moby/profiles/seccomp/seccomp_linux.go#L144) omits capability-conditioned rules when the initial bounding set is empty. The original profile therefore blocked Chromium's filesystem-sealing `chroot` after user-namespace creation, aborting startup. The derived profile permits that syscall while keeping every container capability dropped, nonroot execution, no-new-privileges, Chromium sandboxing and host AppArmor checks. It grants no capability. The allowance is for the syscall generally; seccomp cannot restrict it to the `/proc/self/fdinfo/` pathname. Independent review and a controlled native kernel comparison must gate activation. If another kernel or AppArmor restriction prevents startup, stop and report it. There is no capability-addition, unconfined seccomp/AppArmor, no-sandbox or host sysctl fallback.

## Focused verification and later acceptance

```sh
npm test -- ops/tests/guide-profiles.test.ts ops/tests/guide-session.test.ts ops/tests/guide-welcome.test.ts ops/tests/guide-fresh-bootstrap.test.ts ops/tests/lyra-launcher.test.ts ops/tests/lyra-healthcheck.test.ts ops/tests/lyra-container-config.test.ts tests/guide-evidence.test.ts tests/lyra-bot.test.ts tests/lyra-bot-personas.test.ts tests/lyra-bot-release.test.ts --maxWorkers=1 --testTimeout=30000
npm run buildmap
node publication/verify-source.mjs
shasum -a 256 dist/bots/lyra.js
```

The tests use controlled engine/page boundaries and actual copied-runtime imports, without launching Docker or browsers. The full canonical suite remains the coordinator's combined CI gate. Public source inventory preserves every original 303-file receipt value.

Later acceptance needs all three distinct avatars and their movement visible to two independent visitors, each guide's zodiac request/owner-safe stop, later native meeting entry, isolated profile stop/restart, robot-free fresh maps/WAMs, unchanged core containers, and a 12-minute post-chat/departure soak with full diagnostics. The deployed proximity limit is four participants (`MAX_PER_GROUP=4`, min distance 64px/group radius 48px). Three guides plus two QA visitors cannot share one five-person bubble: test all-guide arbitration with three guides plus one QA (four total); test the same reply received by both QA in subgroups of at most four, containing the target guide and both QA, with other guides absent as needed. Visibility to two visitors is separate from shared bubble membership. Do not change capacity, radius, homes or patrols to manufacture acceptance. Consistent-snapshot election remains conditional; divergent public snapshots are a documented limitation, and explicit guide addressing remains available.
