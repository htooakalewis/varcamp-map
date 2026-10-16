# Demo guide service

The additive `npc` service runs in the existing `varcamp` Compose project and routes only `/varcamp-npc/` on the demo TLS host. It uses the installed pinned official Node image. No public host port, core restart or AWS configuration change is needed.

On devbox, install `server.mjs` at `/srv/varcamp/npc/server.mjs` and this compose file at `/srv/varcamp/npc-compose.yml`. Create `/srv/varcamp/private/npc.env` from `environment.example` with mode 600, preserving it on subsequent deployments. The server works offline without a provider key.

```sh
docker compose -p varcamp -f /srv/varcamp/npc-compose.yml config --quiet
docker compose -p varcamp -f /srv/varcamp/npc-compose.yml up -d --no-deps --pull never npc
```

Record existing core container IDs before/after. Verify public TLS health, an actual chat POST with the map asset origin, rejection of a foreign origin, and native in-map conversation. To stop this addition, stop the `npc` service using the same compose file; do not use project-wide down.

For live AI, an operator must place `OPENROUTER_API_KEY` in the private env file and recreate only `npc`. Never display the file or paste the key into chat. Then verify a real response with `mode: openrouter`; key presence or mock tests alone do not prove live AI. Model `openrouter/free` and provider zero-price bounds are fixed server-side. Free-provider limits can be lower than the local budget; fallback remains available.

The three map robots are stationary private guides. Hosted moving bots are a separate WorkAdventure administration feature, to confirm on the sponsored core. The service does not control avatars, award badges, or read proximity chat.
