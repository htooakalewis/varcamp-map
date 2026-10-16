# One owned Lyra development browser

This tool joins the user's development WorkAdventure room as the ordinary guest **Lyra [BOT]**. It owns exactly one container, `varcamp-lyra-dev`, labelled `io.varcamp.bot.owner=varcamp-lyra-development-v1`. It runs independently on the devbox after the operator disconnects. There is no public management endpoint. Use the existing private SSH access to run the CLI on that host; the operator needs Node.js 20+ and Docker CLI access. Paths below are relative to the reviewed project checkout, and the CLI resolves its seccomp profile relative to itself.

This is an owned development launcher, not the official WorkAdventure Bots manager. The inspected guest menu exposes no Bots manager; hosted bot entitlement remains unverified. The official self-host administration stack requires separate licensing, registry access and Kubernetes. This tool does not install that stack or alter a sponsored world's limits. Its dedicated-browser approach follows the [WorkAdventure development tutorial](https://docs.workadventu.re/blog/gpt-bot/#our-battle-plan).

## Review, build and run on the devbox

Before activating any release, verify successful full canonical CI and Pages deployment, then compare the exact HTTPS module bytes with the reviewed artifact. Check CLI status for the current devbox process; a build alone is not live acceptance. After the build, use the commands below to start and inspect the process, then test shared behavior with two independent visitors.

Run these commands inside the reviewed checkout through private SSH (for example, `ssh <devbox-host>`, then `cd <reviewed-checkout>`):

```sh
mkdir -p ops/private/lyra
chmod 700 ops/private/lyra
umask 077
node ops/bots/cli.mjs snapshot > ops/private/lyra/before.json

docker build --platform linux/arm64 --iidfile ops/private/lyra/image-id -f ops/bots/Dockerfile ops/bots
LYRA_IMAGE_ID="$(cat ops/private/lyra/image-id)"
node ops/bots/cli.mjs start "$LYRA_IMAGE_ID"
node ops/bots/cli.mjs status
node ops/bots/cli.mjs logs

node ops/bots/cli.mjs stop
node ops/bots/cli.mjs snapshot > ops/private/lyra/after-stop.json
```

`ops/private/` is already ignored by Git. Preserve the original private `before-browser-setup-containers.json` QA reference (31 containers) as well as a fresh snapshot before the browser setup proof. Snapshot output includes only IDs, names, state and health; keep it private. Compare every original ID and health against the before/running/stopped snapshots. Neither snapshot collection nor the manager uses Compose or mutates existing services.

`start` accepts only the immutable `sha256:...` local image ID produced by the reviewed build. Docker's exact container-name reservation prevents concurrent starts from creating duplicates. An already-running owned instance is checked for readiness; an exited instance must be inspected and explicitly stopped before a new start. A competing start can fail with Docker's name-conflict error; inspect `status` and do not invent another container name. Readiness is bounded to 150 seconds; Docker calls are individually bounded to 25 seconds. A startup failure gathers the last 80 log lines, stops/removes only its newly created, reverified container ID, and exits nonzero. A later runtime failure closes the browser and leaves an exited container for inspection. `stop` verifies both ownership labels and the exact name, then targets the immutable ID. Unrelated name collisions are refused. `status` exits nonzero unless the owned container is healthy.

To restart, run `stop` and then `start` with the same reviewed image ID. No host directory, credentials, browser profile, Docker socket or laptop process is mounted into the container. There is no automatic restart policy, so failures remain visible and do not create retry storms. Local CLI authentication is the existing private SSH/Docker host authorization.

## Runtime contract

The fixed public URL is:

```text
https://htooayelwinict.github.io/varcamp-map/bots/lyra.js?v=29b9a65b5880a922710ddf6b524e1ee0d772620687c7843c5b6928f633396c1f
```

The expected SHA-256 is `29b9a65b5880a922710ddf6b524e1ee0d772620687c7843c5b6928f633396c1f`. The runner fetches that exact HTTPS request without redirects and verifies its response bytes, then fulfills the original browser module request with those same bytes. The version query is not treated as proof of integrity. It calls only `module.default.run({})`, inside the dedicated initialized `about:srcdoc` frame whose script URL matches this deployment's `assets/src-main-*.js` and whose `WA.room.id` equals the intended overworld URL. Modal, journal and NPC frames are excluded. No local module fallback or bot activation in ordinary visitor scripts exists.

The fresh-profile UI selectors come from the 16 October devbox browser observations: login name input, `#woka-female4`, the exact Continue/Save buttons and the two Turn off device choices. An optional proximity prompt is dismissed only through **Continue without webcam and microphone**, with normal clicks. Changed or obstructed UI fails within the startup bounds; no forced clicks or guessed popup close controls are used.

The context explicitly denies audio/video capture through Chromium's permission API, chooses microphone/camera off in the UI, checks both off controls, blocks service workers and launches with audio muted. The runner uses public WA identity APIs; it never mutates meeting internals, force-follows visitors or changes map/core state. Health requires completed `default.run`, no `Lyra stopped:` diagnostic, unchanged bot identity and room, camera/microphone off, and a fresh probe. Diagnostics are sticky even if `run` resolves. Failed startup, page errors/crashes, missing frames, room changes or stale probes close only the owned browser and exit nonzero. Health state lives only in bounded container tmpfs; normal logs rotate at 2 × 5 MiB.

The controller subscribes through public `WA.player.meetings.onJoin()`. Existing bubble replay at the instant the module attaches is not established by the API observations. Acceptance must exercise a visitor already near spawn and a visitor joining later. If an existing bubble is missed, record the limitation; do not patch private meeting state or fabricate a new event. Native move results can be 16 pixels above the requested center while still in the intended tile. Verify observed tile/position changes, not invented exact-center equality.

## Isolation and pinned inputs

The additive container has at most 1 CPU, 2 GiB memory with no additional swap, 512 PIDs, 512 MiB private shared memory, and a 512 MiB writable `/tmp` tmpfs. Root filesystem is read-only; user is `1000:1000`; all capabilities are dropped; no-new-privileges and Docker init are enabled. It uses Docker bridge networking with no published ports, host networking, host IPC or external mounts. Core services, their IDs/health, AWS settings, credentials and map data remain outside this tool's mutation surface.

The browser image is the already inspected official ARM64 Ubuntu 24.04 Playwright 1.64.1 base, pinned to `mcr.microsoft.com/playwright@sha256:68456172e8d99f42cf391e835f5d566b3ab0a2c6a745decd9590c4d73c54d2fb`. It contains browser binaries; the separate lockfile installs only `playwright-core` 1.64.1. `npm ci --ignore-scripts` runs only during the image build. The map application's package and lockfile are untouched. `config.mjs`, `manager.mjs` and CLI import no browser library; only `runner.mjs` loads `playwright-core`.

Chromium sandboxing stays enabled. The [official Playwright Docker guidance](https://playwright.dev/docs/docker) requires a separate user and its namespace-enabled seccomp profile. `seccomp.json` is the unmodified [v1.64.1 upstream profile](https://github.com/microsoft/playwright/blob/v1.64.1/utils/docker/seccomp_profile.json), SHA-256 `cc3e61cabda6bbc1e53e54d27ba4d55a9d3be829b6dd1a596f4a7b31b1cc7849`; its default action is `SCMP_ACT_ERRNO`, with the upstream `clone`, `setns`, `unshare` allowance. The accompanying Apache-2.0 [upstream license](PLAYWRIGHT-LICENSE) has SHA-256 `45873d00a0dd243596deb4aa23b2493b3d1f0671921bf2538ea431d7380220eb`. If the host kernel or AppArmor prevents sandbox startup, report that blocker. There is no SYS_ADMIN, unconfined seccomp/AppArmor, no-sandbox or host sysctl fallback.

## Verification and live acceptance

```sh
npm test -- ops/tests/lyra-launcher.test.ts ops/tests/lyra-healthcheck.test.ts ops/tests/lyra-container-config.test.ts --maxWorkers=1
node publication/verify-source.mjs
npm run buildmap
shasum -a 256 dist/bots/lyra.js
```

Unit checks use a controlled Docker boundary and real healthcheck subprocesses; they do not start Docker or browsers. The container configuration checks inspect the actual pinned inputs and generated Docker arguments. The full existing suite remains the coordinator's combined CI gate. All new runner and operational test files are included in the publication extension inventory.

Live acceptance requires: successful full canonical CI and Pages deployment; exact public HTTPS byte validation; a sandboxed ARM64 build/start; one shared bot player ID and changing positions seen by two independent visitors; the same nearby bubble reply visible to both; independent visitor movement; startup-near and later-join cases; stop/restart with only Lyra disappearing/reappearing; and unchanged original 31-container IDs/health. Check CLI status for the current devbox process throughout; a build alone is not live acceptance. Local tests and earlier temporary HTTPS-interception QA do not establish these results.
