# Publishing VarCamp maps on GitHub

The public source repository is [htooayelwinict/varcamp-map](https://github.com/htooayelwinict/varcamp-map). GitHub Pages publishes the built maps and a venue directory at [htooayelwinict.github.io/varcamp-map/](https://htooayelwinict.github.io/varcamp-map/). Pages hosts static map files; attendees still need a WorkAdventure service to run the venue. The [devbox guest demo](https://varcamp.3-1-133-135.sslip.io/~/varcamp-demo/maps/overworld.wam) is a separate deployment.

The repository contains all 33 native TMJ/WAM map pairs, their editable layouts, original artwork sources, licensed tilesets, scripts, tests and credits. Asset licenses remain separate from the starter code's MIT license. This is a WorkAdventure map project, rather than a standalone asset pack. Private configuration, credentials, local tool installations and operational archives are excluded.

## Edit and verify locally

For the strict artwork byte comparison, use **macOS ARM64**, Node.js **26.11.1** Apple Python **3.9.6** and the locked dependencies. This matches the authoring renderer that produced the committed PNG files:

```sh
npm ci
npm run maps:validate
npm run art:check
npm run maps:build
npm run buildmap
npm test -- --maxWorkers=1 --testTimeout=30000
```

The original published snapshot passed **754 tests plus seven Python tests**, including actual native Tiled rasterization. The current suite also includes the reviewed extension tests; run all discovered tests. Install the official macOS **Tiled 1.12.2** bundle at `.tools/tiled-1.12.2/Tiled.app/Contents/MacOS/tmxrasterizer`. The workflow downloads [the official release archive](https://github.com/mapeditor/tiled/releases/download/v1.12.2/Tiled-1.12.2_macOS-13%2B.zip) and verifies SHA-256 `75712ec3a892701a9b2b7a12e44d636a1dbbe4caa6bb8bba729e697bd8a80433` before extracting it. The local binary is ignored by Git. See also [the dependency record](../dependencies.md) for the earlier toolchain history.

The configuration tests also require the **Docker 29.8.0 CLI** and **Compose 5.5.1 plugin**. They run `docker compose config` to inspect configuration and do not need a Docker engine, Docker Desktop or running containers. The workflow downloads [the official ARM64 Docker CLI archive](https://download.docker.com/mac/static/stable/aarch64/docker-29.8.0.tgz), verifies SHA-256 `3f37afe51f8f53f224192099a76a454a62eb6100d426738da17fdf8472cf4b5f`, and extracts only its `docker/docker` binary into a temporary job directory. It downloads [the official ARM64 Compose binary](https://github.com/docker/compose/releases/download/v5.5.1/docker-compose-darwin-aarch64), verifies SHA-256 `998735c9b6fe68a4f05895e6ea73d71ad06f9fc7046383ad89e47346781b6af5`, and installs it under `$HOME/.docker/cli-plugins/docker-compose`. The CLI directory is added to the job path, and both versions are logged before tests.

Open `maps/<map-id>.tmj` in Tiled to edit a native map. `npm run maps:build` preserves those files and only validates them and refreshes previews. Building a release does not require reauthoring.

`npm run maps:author` compiles the editable JSON layouts and guards against overwriting native Tiled edits. Its `.qa/authored-map-hashes.json` manifest is intentionally local. On a fresh checkout, only when deliberately redrawing all maps from reconciled layout sources, first back up native changes and use:

```sh
npm run maps:author -- --initialize
```

That explicit command rewrites native map pairs and initializes the guard. Do not use it as a routine build step. Follow [map editing and safe publication](map-editing.md) when preserving live organiser changes.

## Automatic Pages publication

The [Pages workflow](../../.github/workflows/pages.yml) runs on pushes to `main` and can also be started manually from the repository's Actions page. The repository's **Settings → Pages → Build and deployment → Source** must be **GitHub Actions**.

The `build` job uses the standard `macos-15` ARM64 runner and Node.js **26.11.1**. It installs the lockfile, verified Tiled bundle and pinned Docker/Compose CLIs, validates all maps, runs the strict **739-sprite** art check, refreshes previews, builds the release and runs **all current tests plus seven Python tests** with one worker and a 30-second test timeout. No tests or validation checks are excluded. Only this strict build produces the Pages artifact.

The independent `source-integrity` job uses Ubuntu **24.04** and Node.js **26.11.1**. It verifies every one of the **303 frozen source hashes**, every separately reviewed `extensionInventory` hash, and all **33 native TMJ/WAM map pairs**. Within `app`, `art`, `assets`, `maps`, `src`, `tools`, `tests` and `world`, the actual files must equal the union of the original and extension inventories. Missing, unlisted or changed files fail verification; the inventories cannot overlap. Explicit extensions outside those folders, including `buildmap.vite.config.ts` and any later reviewed `ops/bots/` runner files, are also checked for existence and exact bytes. It does not regenerate artwork. Both this job and the complete canonical Mac build must pass before deployment.

Keep the original `sourceInventory` and `sourceFilesByteExact: 303` unchanged. Add only existing reviewed paths and their SHA-256 hashes to `extensionInventory`; it currently records nine files (the seven Lyra sources/tests, the publication-integrity test, and root build configuration). Later runner additions must extend that explicit list before combined verification. The checker does not discover arbitrary new files outside the eight source folders, so review must account for every new operational file. Do not insert placeholders for future files.

The stable bot script destination is [bots/lyra.js](https://htooayelwinict.github.io/varcamp-map/bots/lyra.js), emitted independently with `default.run(metadata)`. Publish the complete reviewed `dist` package, compare HTTPS readback bytes with the reviewed package, then use `https://htooayelwinict.github.io/varcamp-map/bots/lyra.js?v=<sha256>` with that verified module hash. The query selects a cache version; byte comparison establishes integrity. [Lyra activation](scripted-lyra.md) additionally requires one dedicated bot session and two independent visitor sessions for shared-avatar acceptance. This extension has not yet been published or activated. The single combined publication and full canonical CI run are deferred until the runner changes are reviewed.

### Publishing environment reassessment

The first Linux build failed the existing byte-exact flight-artwork check. A diagnostic run then disproved the initial compression-only hypothesis: Linux generated different decoded RGBA bytes, despite identical 512×608 dimensions and animation metadata except the two PNG digest fields. The exact raster/compositing cause remains unresolved. **Linux artwork reauthoring is unsupported.** Cross-platform compiler repair is outside this publication's scope; no artwork, renderer, test or native map was changed. The source integrity gate replaces the newly introduced cross-platform reauthoring requirement; it does not replace the strict Mac artwork check or exclude any existing tests.

The Mac runner's default Homebrew Python 3.14 also failed 123 legacy fixture assertions. Independent local reproduction showed Python 3.14 and 3.15 now instantiate an HTTPS handler's verified default context immediately, whereas those fixtures expect its private `_context` field to be `None`. They also report an invalid-escape syntax warning when importing the recovery guard, conflicting with its inert-import stderr assertion. Actual redirect rejection and verified TLS behavior remained intact. The workflow selects the already verified Apple `/usr/bin/python3` **3.9.6**, asserts its version and expected handler behavior, and logs the runtime. All 754 tests and seven Python checks remain required.

Acceptance requires unchanged source hashes, the full canonical build and tests, a successful Pages deployment, and HTTP readback of every built file. Source push or passing tests alone do not establish that publication succeeded.

After verification, the workflow copies `publication/index.html` into `dist/index.html`, copies the landing page's JPEG images into `dist/publication/`, and preserves the old root `varcamp.tmj` and `tileset.png` URLs. It uploads the complete `dist` artifact and deploys it in a separate job. Actions are pinned to official commit hashes. The build has read access to repository contents; only the deployment job receives Pages write and identity-token permissions. Publication runs queue without cancelling an earlier deployment.

Check the actual Actions run and public URLs before calling publication complete. A successful build alone does not establish that GitHub Pages or a WorkAdventure room loaded. The workflow does not upload maps to the devbox, restart services or change the sponsored WorkAdventure venue.

For a downloaded release archive, use the repository's Releases page when a release has been published. Retain the bundled `credits/` directory when distributing or hosting built maps.

GitHub reports dependency advisories in the inherited locked toolchain. Dependency upgrades are recorded as a separate finding; this publication does not change the lockfile or expand into package upgrades.
