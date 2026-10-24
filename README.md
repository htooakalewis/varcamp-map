# VarCamp Myanmar — zodiac WorkAdventure world

Connected, editable maps with twelve separate zodiac speaker buildings, a central welcome plaza, halls, parks, arcade lounges, two mazes, beaches and the sailing **FA SHIP**. Roads lead to signed gates outside the speaker plaza. New arrivals start at the central welcome point.

[Enter the live demo](https://varcamp.3-1-133-135.sslip.io/~/varcamp-demo/maps/overworld.wam) · [Published map files](https://maps.3-1-133-135.sslip.io/varcamp-demo/)

The **WorkAdventure custom map URL** is:

```text
https://maps.3-1-133-135.sslip.io/varcamp-demo/maps/overworld.tmj
```

This URL is a map asset, opened by a WorkAdventure client. The devbox map storage hosts the maps and runtime assets; the same devbox runs the WorkAdventure multiplayer service that serves the live demo.

![FA SHIP in the live demo](publication/fa-ship.jpg)

## Edit or build

Use Node **26.11.1**, npm and Apple Python **3.9.6** for the legacy operational fixtures. `.nvmrc` carries the same Node pin, so `fnm use` or `nvm use` selects it. Install dependencies and validate the authored maps:

```sh
npm ci
npm run maps:validate
npm run art:check
npm run maps:build
npm run buildmap
```

`dist/` contains the ready-to-host world: the TMJ/WAM pairs listed in [current facts](docs/current-release-facts.md), runtime scripts, the independent `bots/lyra.js` module, sponsor artwork, source atlases and credits. It omits private configuration and development previews. Copy its full contents to a static HTTPS host; keep the relative paths intact. For an existing edited WorkAdventure world, follow the guarded publication procedure rather than overwriting live WAM state.

Open `maps/*.tmj` in Tiled. Normal `maps:build` preserves native edits and refreshes `maps/preview/`. Hand-composed source layouts are in `world/layouts/`; editable artwork and full source credits are retained in `art/` and `assets/`. The map files and assets match the developed world byte for byte; [the snapshot manifest](publication/source-manifest.json) records them.

Read [map editing](docs/operating/map-editing.md), [the venue guide](docs/operating/venue-guide.md), [sponsor replacement](docs/operating/sponsors.md), and [publishing and test prerequisites](docs/operating/publication.md). On a fresh clone, the ignored native-edit guard manifest is absent: use `npm run maps:author -- --initialize` only when intentionally reauthoring from layouts. Do not use that command to overwrite later Tiled edits.

## Verification and publishing

The local complete suite passed **754 tests plus 7 Python checks** before publication, including the central default-spawn regression and all 25 existing named entry selections. The full suite also uses Docker CLI 29.8.0 and Compose 5.5.1 to parse configuration fixtures; it does not require a Docker engine. Run it with:

```sh
npm run buildmap
npm test -- --maxWorkers=1 --testTimeout=30000
```

Full verification uses macOS ARM64 and official Tiled 1.12.2 at `.tools/tiled-1.12.2/Tiled.app/Contents/MacOS/tmxrasterizer`; on the Linux devbox the Tiled rasterizer and Apple Python 3.9.6 fixture families are known to fail, and the rest of the suite runs. `node publication/verify-source.mjs .` verifies the original 303 source receipts, their exact reviewed replacements, the manifest’s separately reviewed extension hashes and all native map pairs listed in [generated current facts](docs/current-release-facts.md) without regenerating artwork; it must pass before every upload. The snapshot’s original 303 paths and hashes remain unchanged; `extensionInventory` in the manifest records added source files and the changed root build configuration. The entrance also includes a [stationary native Roadster animation](docs/operating/roadster.md), with source/crop receipts and unchanged walking routes. The exact upstream compatibility fixtures and required regression baselines are included. Local operational archives and private deployment history are excluded.

Releases are published from the devbox straight to the live demo's map storage with the repository's guarded upload tool; Git is version control only, and the public repository is a source mirror, read-only from the devbox. In brief: `npm run maps:validate` and `npm run buildmap`; `node publication/verify-source.mjs .`; `ops/migrate_wam_tokens.py` to move every live WAM `?v=` pin to the freshly built TMJ hashes; `ops/release_upload.py prepare` and an inspection of `plan.json`, `baseline.zip`, `release.zip` and `package.zip`; `ops/release_upload.py apply --quiet-editor-window`; then `npm run acceptance:smoke` and a visual check in the browser. `npm run deploy:demo` chains these steps. The exact commands, artifacts, quiet-editor rule and rollback are in [publication](docs/operating/publication.md). Credentials stay in `/srv/varcamp/private/environment`, never in the repository.

The reviewed Lyra module targets [the stable script URL](https://maps.3-1-133-135.sslip.io/varcamp-demo/bots/lyra.js). Before activating any release, verify that the devbox publication completed, the verify-source receipt passed, and the exact HTTPS module bytes match the reviewed package. Then test the real shared behavior with two independent visitors: each opens the avatar menu at the top right, chooses **All settings**, then chooses **Talk to Nearby Guides** from the menu list, picks an actual nearby guide and sends a zodiac name or button command through the panel. Use visitor names of at most 10 characters; WorkAdventure rejects longer names, and if its "Name is too long" error persists after shortening, reload the page. Use `?v=<sha256>` for the verified module. A local build alone is not live acceptance. See [Scripted Lyra](docs/operating/scripted-lyra.md) for the `default.run` contract and activation checks, and the [dedicated guide service source](ops/bots/README.md) for the public unbound template and retired launcher notice.

Linux artwork regeneration currently changes decoded flight-atlas pixels and is unsupported; use the canonical macOS authoring environment. Publishing preserves the existing artwork bytes. Publication uploads map assets to the devbox map storage; it does not restart the WorkAdventure services or the guide bots, whose private release pin must be re-qualified after any map or module change. The devbox demo's deliberate departures from `ops/compose.yml` are recorded in [devbox deployment](docs/operating/devbox-deployment.md). The original public draft files `varcamp.tmj`, `tileset.png` and `build_map.py` remain for reference; the current world starts at `maps/overworld.tmj`.

Sponsor marks are fictional demo placeholders for the team to replace. The optional server-side OpenRouter key applies only to the legacy NPC chat server, which is currently offline. Scripted Lyra uses authored replies and needs no OpenRouter key. Never put keys in map files or client scripts.

## Credits and licenses

This is a WorkAdventure map project, not a standalone asset pack. Starter-derived code retains its [MIT notice](LICENSE). Artwork and compatibility fixtures have separate licenses: see [the source manifest](art/sources.json), each asset folder’s LICENSE/ATTRIBUTION/CREDITS files, and the published [credits](https://maps.3-1-133-135.sslip.io/varcamp-demo/credits/index.html). The native ship, dock, water and containers retain their LPC author credits. Paid tileset preview images are not redistributed as production artwork.
