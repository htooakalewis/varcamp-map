# Scripted Lyra shared walking bot design

Approved direction: one shared Lyra concierge, no OpenRouter or other model calls. Keep existing room refinement separate from this first bot delivery. The user approved the custom-script direction and asked to test on devbox because the sponsored world is not ready. Existing approval covers implementation, public script publication and careful demo testing; it does not establish WorkAdventure hosted bot entitlement.

## Scope and environment

Build an official-compatible ES module exporting a default object with asynchronous `run(metadata)`. Ordinary map runtime must never import or start this module. Lyra runs only in her dedicated bot browser, uses supported WorkAdventure 1.32.10 APIs and stays on the current overworld. Preserve every existing map, layout, atlas, quest and legacy guide source byte. Keep all existing tests; new dependencies are unnecessary for the browser module.

The demo guest menu exposes no Bots manager. WorkAdventure's official self-host administration panel requires a separately supplied license, registry access and Kubernetes; do not install that stack or claim it is available. Devbox is the user's own development server, with ample measured resources. A separate single-browser development launcher can exercise the public map APIs there, without altering the WorkAdventure core or bypassing any sponsored SaaS limit. Official bot-manager registration remains a future activation option for the same module.

## Behavior

Lyra uses a deterministic state machine: start at the native welcome spawn, walk home, patrol a short reception loop, pause for a nearby bubble conversation, answer explicit commands, escort willing visitors to a safe destination waypoint and return home. No forced following, teleporting, arbitrary URLs, microphone capture, quest writes or cross-map movement.

Commands: `help`/`အကူအညီ`, `rooms`/`အခန်းများ`, `go <destination>`/`သွား <destination>`, and `stop`/`ရပ်`. Accept bare known destination aliases and numbered room IDs 1–12, including Burmese digits. Match English case and whitespace consistently. Reply in Burmese for Burmese command forms and English otherwise. Unsupported free text receives one short help response, subject to cooldown. Do not invent event schedules, speakers or sponsors.

Destinations are 12 named speaker buildings plus Solar Hall, Lunar Hall, Mazes, Park, Harbor and Exploration. State which gate leads onward, then stop before its portal. First visitor owns an escort; another visitor gets a concise busy response. The owner can stop. Commands while the current cell move is pending change the next action without overlapping moves.

Use real bubble join/leave participants to greet and pause; do not mistake viewport entry for conversation. Greet each participant at most once per 120 seconds. Limit repeat replies from one participant to one per 2 seconds, and bound/expire visitor bookkeeping (256 entries maximum, 10 minute expiry). Pause unsolicited patrol while a live conversation is active; after a 20 second conversation idle period resume. Greeting text may vary through a small authored sequence. Incoming own messages (`authorId` undefined) are ignored.

A single asynchronous movement loop issues at most one adjacent-tile move at a time, with a brief delay after each step (100 ms). Patrol rests 2 seconds at each corner. Movement rejection, cancellation, a result outside the intended cell, incompatible map, unknown position or room change stop the controller safely with a clear diagnostic. Never issue another move while an earlier move is unresolved, including after a timeout. Cleanup invalidates in-flight continuations and removes all owned timers/subscriptions; duplicate `run` stops the previous controller rather than stacking loops.

## Routes and map compatibility

Authoritative audit is `docs/qa/lyra-scripted-bot-2026-10-16/route-proposal.json` in the original workspace, generated from the unchanged published map. Home is tile (70,70), pixel (2256,2256). Patrol corners are (70,70),(73,70),(73,73),(66,73),(66,70),home. Route graph contains exactly 743 audited safe cells. It excludes all 48 portal cells, both interaction areas, sponsor logos and conservative visual prop/building footprints. BFS on that graph gives safe adjacent-tile routes to all18 destination points.

Native welcome spawns are (63,65),(64,65),(63,66),(64,66), inside the directory interaction. Startup alone may take one or two straight north steps to row64 from those four cells, then must use the ordinary graph. This exception expires immediately. Unknown spawn positions outside normal graph and this exact reserved prefix abort. Coordinates passed to moveTo are tile centers (`32*x+16`,`32*y+16`); do not let native pathfinding choose one long route across portals.

Before movement, verify width/height128, tile size32 and a SHA-256 signature of the native layer structure/data and tileset collision definitions, excluding map script and image URLs rewritten by release packaging. Guard must accept the same native geometry from the built map and reject a changed collision/exit definition. Audit fixtures and browser route data must have reproducible provenance; tests independently check every allowed cell against native collision/exit/interaction geometry.

## Packaging and development activation

Publish `bots/lyra.js` as an independent Vite entry, retaining the official default export. It must import safely without a WA global and do nothing until run is called. Use a SHA-versioned URL when registering it with a hosted manager. Existing runtime and art remain intact. Original 303-source manifest stays byte-exact; publication integrity can add a separate extension inventory for new bot files and approved root configuration changes.

A development launcher is an additive, single-browser service on devbox with hard resource limits, camera/microphone off and a clearly named Lyra [BOT] avatar. Start/stop/status operate only this browser; no public unauthenticated administration API. It may import the published bot module in its own initialized map-script iframe after joining as a regular development participant. Do not add bot startup flags to ordinary map scripts. Keep existing core container IDs and health unchanged; capture before/after evidence and provide a stop procedure. Browser dependencies belong only to this development tool, not the map bundle.

## Acceptance

1. Failing-first tests show missing bot export/lifecycle, then cover patrol/escort behavior, all18 destination commands, Burmese aliases, per-visitor cooldowns, multi-visitor ownership, own-message ignore, idle resume, duplicate startup, rejection/cancel/late completion and cleanup.
2. Native route checks independently reject collisions, portals and interaction cells, and pin the exact startup exception; all existing source maps/art/layouts remain byte-identical.
3. Build emits an importable official default.run module over HTTPS, normal visitors load no controller, current full test suite passes and public bytes match the reviewed artifact.
4. On devbox, two independent visitor sessions observe the same Lyra avatar at changing positions and the same nearby bubble response; visitors retain movement control. A browser module and passing tests alone do not meet this outcome.
5. Development stop removes only Lyra. No OpenRouter calls, core restarts, paid hosted-bot activation or AWS infrastructure changes. Report any unavailable activation step explicitly.

References: https://docs.workadventu.re/admin/bots/custom-script/ ; https://github.com/workadventure/bot-starter-kit ; https://docs.workadventu.re/developer/map-scripting/references/api-player/ ; https://docs.workadventu.re/developer/map-scripting/references/api-chat/ ; https://docs.workadventu.re/admin/admin-self-hosting/ .
