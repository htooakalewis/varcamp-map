# Scripted shared guides

Lyra, Nova and Orion are authored walking guides for the frozen overworld, using one shared module and separate dedicated browsers. The independent build artifact is `dist/bots/lyra.js`. It exports `default.run(metadata)` following the [official starter](https://github.com/workadventure/bot-starter-kit/blob/master/src/main.ts). Importing it is safe without `WA`; calling `run` requires the initialized WorkAdventure scripting iframe of the dedicated bot browser. Regular map visitors never import or start this controller.

Build and verify with:

```sh
npx vitest run tests/lyra-bot.test.ts tests/lyra-bot-personas.test.ts tests/lyra-bot-release.test.ts --maxWorkers=1 --testTimeout=30000
npm run buildmap
node publication/verify-source.mjs
shasum -a 256 dist/bots/lyra.js
```

Publication and activation are separate steps. The stable public destination is `https://htooayelwinict.github.io/varcamp-map/bots/lyra.js`. Before activating any release, verify successful full canonical CI and Pages deployment, then compare the exact HTTPS module bytes with the reviewed artifact. Check the CLI status for the current devbox process; a build alone is not live acceptance. After those checks, test that two independent visitor sessions observe exactly three distinct moving guides and shared replies. Source tests and a local build do not establish live acceptance.

## Behavior and commands

Type `Gemini`, `Cancer`, or `Libra` directly; all twelve zodiac names work. Use `help`, `rooms`, `go <destination>`, or `stop`; Burmese forms are `အကူအညီ`, `အခန်းများ`, `သွား <destination>`, and `ရပ်`. Known names work directly. Speaker rooms accept numbers 1–12 and Burmese digits. Commands ignore English case and repeated whitespace. Burmese command forms receive Burmese replies. Unsupported text receives the short help response, with a two-second per-visitor reply cooldown. Explicit commands still change the next action immediately during that cooldown; a pending native step always finishes first.

Speaker rooms are Aries, Taurus, Gemini, Cancer, Leo, Virgo, Libra, Scorpio, Sagittarius, Capricorn, Aquarius and Pisces. Other destinations are Solar Hall, Lunar Hall, Mazes, Park, Harbor and Exploration. Lyra explains the onward gate and stops at the audited waypoint before its portal. The first requesting visitor owns the escort until home; another visitor receives a busy response. Visitors walk independently and can leave at any time.

The module accepts `default.run({ persona: 'lyra' })`, `default.run({ persona: 'nova' })`, or `default.run({ persona: 'orion' })`. Missing persona metadata defaults to Lyra, including official metadata without that field. An explicitly invalid persona fails. The public player ID/name, read after `WA.onInit`, must match the chosen fixed identity: `Lyra [BOT]`, `Nova [BOT]`, or `Orion [BOT]`. Metadata cannot override names, routes or URLs.

Only actual proximity-bubble participants can issue commands. The adapter accepts the supported `proximity` kind and the demo's observed `default` / `Proximity Chat` meeting; other meeting kinds and differently named default meetings are ignored. The adapter supplies public participant IDs and names plus chat author names. Self and normalized exact reserved bot names are excluded from human greeting/commands/activity/cooldowns. The complete snapshot is classified before greetings. From self and observed current guide peers, rank Lyra → Nova → Orion, then numeric player ID, elects one ordinary responder. Bot joins/leaves update election; busy state never triggers availability fallback. A bot-only bubble stays silent and keeps patrolling.

Use `Nova, Cancer`, `Orion: Libra`, or `Lyra [BOT], help` to target one guide. Prefixes are anchored and case-insensitive; names elsewhere in text do not target. Bare `stop` immediately clears each local sender-owned escort even inside reply cooldown, preserving other owners. Only the elected guide may acknowledge the bare request, without claiming unknown peer state; a lone guide busy with another owner keeps its busy response. Explicit `Nova, stop` affects only Nova and checks ownership.

The elected guide greets a participant at most once per 120 seconds. A live conversation pauses unsolicited patrol until 20 seconds of inactivity. Up to 256 visitor records are retained and expire after ten minutes without activity; when full, new participants are ignored until records expire, preserving existing greeting/reply cooldowns. Own chat events are ignored. Patrol rests two seconds per corner.

## Movement and diagnostics

The module uses only the 743 audited normal cells in `src/bots/lyra-routes.json`. The four native welcome spawns have one initial exception: walk straight north on the original spawn column to row 64, then use the normal graph. Fixed homes are Lyra tile `(70,70)` / pixel `(2256,2256)`, Nova `(73,73)` / `(2352,2352)`, and Orion `(66,70)` / `(2128,2256)`. Their patrols rotate the same existing audited corners; neither the graph nor startup exception expands. Every native movement targets one adjacent tile center, followed by a 100 ms pause. Normal movement can never reenter a reserved startup cell.

A Web Crypto SHA-256 guard checks native dimensions, layers and embedded tileset definitions before movement. Source and release maps have the same signature: the map script property and tileset image URLs are excluded. Runtime objectgroup `class` aliases are normalized only when they exactly duplicate an existing nonempty `type`, as confirmed by the full live raw-versus-runtime map audit. Contradictory classes, class-only objects, tile-layer metadata, coordinates, collision definitions and exits remain signature-bearing. Provenance pins the audited source hashes, original proposal hash and allowed-cell digest. Geometry changes require a new audit, updated provenance and independent route verification; do not weaken the guard to make an incompatible map run.

Watch the dedicated browser console for `<persona name> stopped: <reason>`. A failed/cancelled move, wrong result cell, unexpected player position, changed room, incompatible map, ten-second movement timeout or sixty-second startup timeout stops all future actions. A timed-out movement remains quarantined until its native promise settles. Repeated `run` calls stop the prior controller and wait for its pending API work; they cannot stack movement loops. Closing the dedicated browser stops its session. Page lifecycle cleanup removes owned subscriptions and timers. An already-issued native move may finish after cleanup, but no later step is issued.

## Official hosted registration

The [official custom-script guide](https://docs.workadventu.re/admin/bots/custom-script/) describes dedicated headless browsers and a Custom script URL. When the intended world's Bots manager and entitlement are available:

1. Publish the reviewed complete `dist` package on HTTPS, preserving any emitted imports and source-map assets.
2. Compute the SHA-256 of the exact published `bots/lyra.js` bytes and compare it with the reviewed artifact.
3. For a Lyra default session, create one bot named `Lyra [BOT]`, choose **Custom script**, and set its script URL to `https://htooayelwinict.github.io/varcamp-map/bots/lyra.js?v=<sha256>` using the full verified module SHA-256. The query versions browser caching; it does not validate downloaded bytes. Complete steps 1–2 before activation.
4. Join the current overworld using its native welcome spawn. Keep camera and microphone off. Start one dedicated session per configured persona; Nova and Orion require their matching fixed persona metadata and public names. Hosted metadata configuration remains unverified.
5. Use two separate visitor sessions to verify one shared avatar, changing positions, nearby bubble replies, escort ownership and retained visitor movement control. Stop through the manager and confirm only Lyra disappears.

The guide's prose describes a `run` function; its linked starter uses a default object with `run`, which this artifact preserves. No Bots manager was exposed in the inspected demo guest menu. Official hosted registration, entitlement and live behavior are unverified; no licensed administration stack is installed by this work.

## Owned devbox development runner

The existing [owned development launcher](../../ops/bots/README.md) currently manages one additive `varcamp-lyra-dev` container through private SSH/local CLI. It joins as `Lyra [BOT]`, imports the exact reviewed HTTPS bytes only in its initialized map-script frame, and invokes `default.run({})`. Its existing digest is historical and does not match the new three-persona module. Task 4 must update the launcher to pass each fixed persona and pin the reviewed module; Task 3 does not change runner policy or deploy browsers. The locally built Task 3 module is 20,084 bytes with SHA-256 `337b73da6c7ab6d6029c72dc0b62e70f89128f855049a7a7817d9785cc0b2470`. The launcher contains its own locked browser dependency; ordinary map visitors never activate it.

From the reviewed devbox checkout, after building the reviewed image as documented:

```sh
node ops/bots/cli.mjs start "$(cat ops/private/lyra/image-id)"
node ops/bots/cli.mjs status
node ops/bots/cli.mjs logs
node ops/bots/cli.mjs stop
```

Ownership labels and immutable container IDs restrict cleanup to the dedicated browser. Camera and microphone are denied/off, audio is muted, Chromium remains sandboxed, and CPU/memory/PID/tmpfs limits bound the detached process. The tool exposes no public administration API and modifies no core service. Private snapshots preserve deployment container references outside Git. The publication manifest pins explicit extensions, including source/tests, while preserving all original 303 source receipt values. Authorized baseline revisions use exact old/new records.

The official manager and its entitlement remain separate and unverified. Before activation, verify successful full canonical CI and Pages deployment, compare the exact HTTPS module bytes with the reviewed artifact, and check CLI status for the current devbox process. A build alone is not live acceptance. Verify sandbox startup and exercise shared behavior with two independent visitors, including early and later bubble joins and stop/restart. Public `WA.player.meetings.onJoin()` is non-replaying. The controller subscribes before asynchronous map/position validation, caches ongoing join/leave/end changes, and uses only current membership after validation. Invalid map/replacement/shutdown clean all subscriptions. A bubble established before this subscription remains unobservable through supported public APIs, so acceptance must include a real later meeting entry. Viewport lists and private framework stores are not bubble membership. Divergent public snapshots can elect different local responders; this is not a global exactly-once guarantee, and explicit guide addressing remains available. See the launcher guide for exact commands, failure health, core isolation and live acceptance steps.

Historical dedicated-runtime native chat failures remain unresolved by this source-only task. Preserve their diagnostics and existing failure policy/deadlines for the separately reviewed runtime investigation.
