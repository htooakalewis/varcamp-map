# VarCamp maze guides and OpenRouter bridge

The user approved continued implementation and asked for fun mazes and NPC bots using OpenRouter. This is an addition to the compact plaza, separate speaker interiors, and shipyard beach. The existing Orbit Maze and saved badge stay intact; a separate 48×48 Comet Maze adds a short checkpoint challenge, clear return, and optional hints.

## Reproduction and causal boundary

The live guest scene has no visible NPC guides or conversation interaction. Before implementation, `GET https://varcamp.3-1-133-135.sslip.io/varcamp-npc/health` returned **404, text/html, Not Found**. This is an absent feature, not evidence of a broken provider. A presence-only inspection of `/srv/varcamp/private/environment` found no configured `OPENROUTER_API_KEY`; `/srv/varcamp/private/npc.env` also did not exist. Never read or report key values.

Map scripts run in the guest browser. Installed WorkAdventure 1.32.10 typings have no spawn-NPC API. Use clearly labelled, original pixel robot map objects, native conversation areas and an API-enabled modal. These are guides, not simulated event attendees. A dedicated bot browser is outside this bounded change. Official references: [map scripting](https://docs.workadventu.re/developer/map-scripting/), [OpenRouter quickstart](https://openrouter.ai/docs/quickstart).

## Interaction and server

- Lyra, the plaza guide: controls, speaker buildings, parks and directions.
- Aster, the maze keeper: optional hints, restart, checkpoint challenge.
- Nova, the dockmaster: beach, shipyard and return directions.
- Guests explicitly open the panel and submit a question. No guest names, proximity chat, microphone, or quest state are automatically sent to OpenRouter.
- The panel uses text rendering for responses and provides labelled offline answers when AI is unavailable. No provider output changes navigation or saved progress.
- A small Node HTTP service, added to the existing `varcamp` Compose project, handles only `/varcamp-npc/health` and `/varcamp-npc/chat`. It uses the installed pinned official Node image, existing TLS hostname and Docker network; no existing core service is restarted.
- The key stays in a private environment file. No key appears in maps, static bundles, logs or responses. The endpoint accepts only known NPC IDs and a bounded plain question, restricts browser origins and applies global request/provider limits and a timeout.
- Default model is OpenRouter's free router, with zero-price provider bounds. Provider calls are unavailable until a private key is configured. Offline behaviour is a delivered feature; it must not be reported as live AI.

## Measurable acceptance

1. All three robot characters are visibly rendered and their nearby Talk prompts open the correct guide panel.
2. A live guest submits a question and receives a labelled, useful offline reply; Close and Return to Plaza work.
3. Failing-first server tests cover actual HTTP validation, CORS, missing-key fallback, bounded OpenRouter requests, upstream failure, concurrency/rate limits and secret non-disclosure. A mocked provider response is not a live AI acceptance result.
4. Comet Maze has reachable start, all three checkpoints, finish and return; its completion saves a separate personal flag after all checkpoints. Original Orbit Maze route and badge remain valid.
5. Both mazes and guide interactions receive independent source review, generated-map validation and Computer verification after demo deployment.
6. Devbox health returns HTTP 200. Existing core container IDs remain unchanged. Final report names missing OpenRouter configuration as a live-AI blocker until a real provider request is verified.
