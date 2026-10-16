# Publishing VarCamp maps on GitHub

The public source repository is [htooayelwinict/varcamp-map](https://github.com/htooayelwinict/varcamp-map). GitHub Pages publishes the built maps and a venue directory at [htooayelwinict.github.io/varcamp-map/](https://htooayelwinict.github.io/varcamp-map/). Pages hosts static map files; attendees still need a WorkAdventure service to run the venue. The [devbox guest demo](https://varcamp.3-1-133-135.sslip.io/~/varcamp-demo/maps/overworld.wam) is a separate deployment.

The repository contains all 33 native TMJ/WAM map pairs, their editable layouts, original artwork sources, licensed tilesets, scripts, tests and credits. Asset licenses remain separate from the starter code's MIT license. This is a WorkAdventure map project, rather than a standalone asset pack. Private configuration, credentials, local tool installations and operational archives are excluded.

## Edit and verify locally

For the strict artwork byte comparison, use **macOS ARM64**, Node.js **26.11.1** and the locked dependencies. This matches the authoring renderer that produced the committed PNG files:

```sh
npm ci
npm run maps:validate
npm run art:check
npm run maps:build
npm run buildmap
npm test -- --maxWorkers=1 --testTimeout=30000
```

The complete suite contains **754 tests plus seven Python tests**, including actual native Tiled rasterization. Install the official macOS **Tiled 1.12.2** bundle at `.tools/tiled-1.12.2/Tiled.app/Contents/MacOS/tmxrasterizer`. The workflow downloads [the official release archive](https://github.com/mapeditor/tiled/releases/download/v1.12.2/Tiled-1.12.2_macOS-13%2B.zip) and verifies SHA-256 `75712ec3a892701a9b2b7a12e44d636a1dbbe4caa6bb8bba729e697bd8a80433` before extracting it. The local binary is ignored by Git. See also [the dependency record](../dependencies.md) for the earlier toolchain history.

The configuration tests also require the **Docker 29.8.0 CLI** and **Compose 5.5.1 plugin**. They run `docker compose config` to inspect configuration and do not need a Docker engine, Docker Desktop or running containers. The workflow downloads [the official ARM64 Docker CLI archive](https://download.docker.com/mac/static/stable/aarch64/docker-29.8.0.tgz), verifies SHA-256 `3f37afe51f8f53f224192099a76a454a62eb6100d426738da17fdf8472cf4b5f`, and extracts only its `docker/docker` binary into a temporary job directory. It downloads [the official ARM64 Compose binary](https://github.com/docker/compose/releases/download/v5.5.1/docker-compose-darwin-aarch64), verifies SHA-256 `998735c9b6fe68a4f05895e6ea73d71ad06f9fc7046383ad89e47346781b6af5`, and installs it under `$HOME/.docker/cli-plugins/docker-compose`. The CLI directory is added to the job path, and both versions are logged before tests.

Open `maps/<map-id>.tmj` in Tiled to edit a native map. `npm run maps:build` preserves those files and only validates them and refreshes previews. Building a release does not require reauthoring.

`npm run maps:author` compiles the editable JSON layouts and guards against overwriting native Tiled edits. Its `.qa/authored-map-hashes.json` manifest is intentionally local. On a fresh checkout, only when deliberately redrawing all maps from reconciled layout sources, first back up native changes and use:

```sh
npm run maps:author -- --initialize
```

That explicit command rewrites native map pairs and initializes the guard. Do not use it as a routine build step. Follow [map editing and safe publication](map-editing.md) when preserving live organiser changes.

## Automatic Pages publication

The [Pages workflow](../../.github/workflows/pages.yml) runs on pushes to `main` and can also be started manually from the repository's Actions page. The repository's **Settings → Pages → Build and deployment → Source** must be **GitHub Actions**.

The `build` job uses the standard `macos-15` ARM64 runner and Node.js **26.11.1**. It installs the lockfile, verified Tiled bundle and pinned Docker/Compose CLIs, validates all maps, runs the strict **739-sprite** art check, refreshes previews, builds the release and runs **all 754 tests plus seven Python tests** with one worker and a 30-second test timeout. No tests or validation checks are excluded. Only this strict build produces the Pages artifact.

The separate `linux-parity` job uses Ubuntu **24.04** and Node.js **26.8.2**. It renders the aircraft atlas entirely in memory and compares the committed and rendered PNG hashes, complete decoded RGBA pixels, dimensions and recursively compared animation metadata. It logs the platform, Sharp library versions and each PNG chunk's type and data hash. Linux PNG compression can produce different encoded bytes despite identical pixels. The comparison therefore normalizes only `atlas.sha256` and `overlay.provenance.atlasSha256`, after proving each identifies the corresponding real PNG. Every other metadata field and every RGBA byte must match. The canonical atlas and all **303 source files** remain unchanged; this diagnostic does not regenerate source files or weaken the Mac byte check.

Deployment requires both jobs to pass. A failure in either the strict build or the independent Linux parity check prevents publication.

After verification, the workflow copies `publication/index.html` into `dist/index.html`, copies the landing page's JPEG images into `dist/publication/`, and preserves the old root `varcamp.tmj` and `tileset.png` URLs. It uploads the complete `dist` artifact and deploys it in a separate job. Actions are pinned to official commit hashes. The build has read access to repository contents; only the deployment job receives Pages write and identity-token permissions. Publication runs queue without cancelling an earlier deployment.

Check the actual Actions run and public URLs before calling publication complete. A successful build alone does not establish that GitHub Pages or a WorkAdventure room loaded. The workflow does not upload maps to the devbox, restart services or change the sponsored WorkAdventure venue.

For a downloaded release archive, use the repository's Releases page when a release has been published. Retain the bundled `credits/` directory when distributing or hosting built maps.
