# Scripted Lyra

Lyra is an authored walking concierge for the frozen overworld. The independent build artifact is `dist/bots/lyra.js`. It exports `default.run(metadata)` following the [official starter](https://github.com/workadventure/bot-starter-kit/blob/master/src/main.ts). Importing it is safe without `WA`; calling `run` requires the initialized WorkAdventure scripting iframe of the dedicated bot browser. Regular map visitors never import or start this controller.

Build and verify with:

```sh
npm test -- tests/lyra-bot.test.ts tests/lyra-bot-release.test.ts --maxWorkers=1
npm run buildmap
npm test -- --maxWorkers=1 --testTimeout=30000
shasum -a 256 dist/bots/lyra.js
```

Publication and activation are separate steps. The stable public destination is `https://htooayelwinict.github.io/varcamp-map/bots/lyra.js`. Publication is pending the complete combined change, its full canonical CI run, and HTTPS/package byte comparison; a local build does not make that URL current. This task does not publish or start a shared avatar. A built module and passing tests do not demonstrate that independent visitor sessions observe the same moving bot.

## Behavior and commands

Use `help`, `rooms`, `go <destination>`, or `stop`; Burmese forms are `အကူအညီ`, `အခန်းများ`, `သွား <destination>`, and `ရပ်`. Known names work directly. Speaker rooms accept numbers 1–12 and Burmese digits. Commands ignore English case and repeated whitespace. Burmese command forms receive Burmese replies. Unsupported text receives the short help response, with a two-second per-visitor reply cooldown. Explicit commands still change the next action immediately during that cooldown; a pending native step always finishes first.

Speaker rooms are Aries, Taurus, Gemini, Cancer, Leo, Virgo, Libra, Scorpio, Sagittarius, Capricorn, Aquarius and Pisces. Other destinations are Solar Hall, Lunar Hall, Mazes, Park, Harbor and Exploration. Lyra explains the onward gate and stops at the audited waypoint before its portal. The first requesting visitor owns the escort until home; another visitor receives a busy response. Visitors walk independently and can leave at any time.

Only actual proximity-bubble participants can issue commands. The adapter accepts the supported `proximity` kind and the demo's observed `default` / `Proximity Chat` meeting; other meeting kinds and differently named default meetings are ignored. Joining greets a participant at most once per 120 seconds. A live conversation pauses unsolicited patrol until 20 seconds of inactivity. Up to 256 visitor records are retained and expire after ten minutes without activity; when full, new participants are ignored until records expire, preserving existing greeting/reply cooldowns. Own chat events are ignored. Patrol rests two seconds per corner.

## Movement and diagnostics

The module uses only the 743 audited normal cells in `src/bots/lyra-routes.json`. The four native welcome spawns have one initial exception: walk straight north on the original spawn column to row 64, then use the normal graph. Home is tile `(70,70)` / pixel `(2256,2256)`. Every native movement targets one adjacent tile center, followed by a 100 ms pause. Normal movement can never reenter a reserved startup cell.

A Web Crypto SHA-256 guard checks native dimensions, layers and embedded tileset definitions before movement. Source and release maps have the same signature: the map script property and tileset image URLs are excluded. Runtime objectgroup `class` aliases are normalized only when they exactly duplicate an existing nonempty `type`, as confirmed by the full live raw-versus-runtime map audit. Contradictory classes, class-only objects, tile-layer metadata, coordinates, collision definitions and exits remain signature-bearing. Provenance pins the audited source hashes, original proposal hash and allowed-cell digest. Geometry changes require a new audit, updated provenance and independent route verification; do not weaken the guard to make an incompatible map run.

Watch the dedicated browser console for `Lyra stopped: <reason>`. A failed/cancelled move, wrong result cell, unexpected player position, changed room, incompatible map, ten-second movement timeout or sixty-second startup timeout stops all future actions. A timed-out movement remains quarantined until its native promise settles. Repeated `run` calls stop the prior controller and wait for its pending API work; they cannot stack movement loops. Closing the dedicated browser stops its session. Page lifecycle cleanup removes owned subscriptions and timers. An already-issued native move may finish after cleanup, but no later step is issued.

## Official hosted registration (pending)

The [official custom-script guide](https://docs.workadventu.re/admin/bots/custom-script/) describes dedicated headless browsers and a Custom script URL. When the intended world's Bots manager and entitlement are available:

1. Publish the reviewed complete `dist` package on HTTPS, preserving any emitted imports and source-map assets.
2. Compute the SHA-256 of the exact published `bots/lyra.js` bytes and compare it with the reviewed artifact.
3. Create one bot named `Lyra [BOT]`, choose **Custom script**, and set its script URL to `https://htooayelwinict.github.io/varcamp-map/bots/lyra.js?v=<sha256>` using the full verified module SHA-256. The query versions browser caching; it does not validate downloaded bytes. Complete steps 1–2 before activation.
4. Join the current overworld using its native welcome spawn. Keep camera and microphone off. Start exactly one dedicated session.
5. Use two separate visitor sessions to verify one shared avatar, changing positions, nearby bubble replies, escort ownership and retained visitor movement control. Stop through the manager and confirm only Lyra disappears.

The guide's prose describes a `run` function; its linked starter uses a default object with `run`, which this artifact preserves. No Bots manager was exposed in the inspected demo guest menu. Official hosted registration, entitlement and live behavior are unverified; no licensed administration stack is installed by this work.

## Owned devbox development runner (pending)

WorkAdventure's [development tutorial](https://docs.workadventu.re/blog/gpt-bot/#our-battle-plan) describes a dedicated browser tab and eventual headless browser. A separate owned development runner may join as an ordinary participant, identify the avatar as `Lyra [BOT]`, and import this artifact only inside that browser's already-initialized map-script iframe:

```js
const lyra = await import('https://htooayelwinict.github.io/varcamp-map/bots/lyra.js?v=<sha256>');
await lyra.default.run({});
```

The runner must be additive and resource-limited, with one browser, camera/microphone off, authenticated operator controls and no public administration API. It must never add bot startup flags to ordinary map scripts. Browser dependencies belong to the runner, not this map package. Preserve existing core container IDs and health and capture before/after evidence. Start/stop/status commands and their exact service name will be documented with that separate tool; no launcher service is provided in this module task. Stop by closing only the dedicated browser/session. No model API, microphone capture, forced following, teleport, quest write, cross-map movement, WorkAdventure core change or infrastructure change is part of this module.
