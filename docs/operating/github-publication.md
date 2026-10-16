# Publishing VarCamp maps on GitHub

The public source repository is [htooayelwinict/varcamp-map](https://github.com/htooayelwinict/varcamp-map). GitHub Pages publishes the built maps and a venue directory at [htooayelwinict.github.io/varcamp-map/](https://htooayelwinict.github.io/varcamp-map/). Pages hosts static map files; attendees still need a WorkAdventure service to run the venue. The [devbox guest demo](https://varcamp.3-1-133-135.sslip.io/~/varcamp-demo/maps/overworld.wam) is a separate deployment.

The repository contains all 33 native TMJ/WAM map pairs, their editable layouts, original artwork sources, licensed tilesets, scripts, tests and credits. Asset licenses remain separate from the starter code's MIT license. This is a WorkAdventure map project, rather than a standalone asset pack. Private configuration, credentials, local tool installations and operational archives are excluded.

## Edit and verify locally

Use Node.js **26.8.2** and install the locked dependencies:

```sh
npm ci
npm run maps:validate
npm run art:check
npm run maps:build
npm run buildmap
npm test -- --maxWorkers=1 --testTimeout=30000
```

The complete local suite contains **754 tests plus seven Python tests**. One native rendering test requires the official macOS **Tiled 1.12.2** bundle at `.tools/tiled-1.12.2/Tiled.app/Contents/MacOS/tmxrasterizer`. Download the official bundle and verify the recorded download hash using [the dependency instructions](../dependencies.md). The local binary is ignored by Git. Run the full suite on that setup to verify actual Tiled rasterization.

Open `maps/<map-id>.tmj` in Tiled to edit a native map. `npm run maps:build` preserves those files and only validates them and refreshes previews. Building a release does not require reauthoring.

`npm run maps:author` compiles the editable JSON layouts and guards against overwriting native Tiled edits. Its `.qa/authored-map-hashes.json` manifest is intentionally local. On a fresh checkout, only when deliberately redrawing all maps from reconciled layout sources, first back up native changes and use:

```sh
npm run maps:author -- --initialize
```

That explicit command rewrites native map pairs and initializes the guard. Do not use it as a routine build step. Follow [map editing and safe publication](map-editing.md) when preserving live organiser changes.

## Automatic Pages publication

The [Pages workflow](../../.github/workflows/pages.yml) runs on pushes to `main` and can also be started manually from the repository's Actions page. The repository's **Settings → Pages → Build and deployment → Source** must be **GitHub Actions**.

The Linux build installs the lockfile, validates all maps, checks art provenance, refreshes previews, builds the release and runs tests with one worker and a 30-second test timeout. It excludes only the test named `renders all 12 PNG cells in native order through nested tile layers`, because the macOS Tiled bundle is not installed on that runner. The expected CI result is **753 passing tests and one explicitly excluded native rendering test**, plus seven Python tests. This exclusion does not replace the full local native rendering check.

After verification, the workflow copies `publication/index.html` into `dist/index.html`, copies the landing page's JPEG images into `dist/publication/`, and preserves the old root `varcamp.tmj` and `tileset.png` URLs. It uploads the complete `dist` artifact and deploys it in a separate job. Actions are pinned to official commit hashes. The build has read access to repository contents; only the deployment job receives Pages write and identity-token permissions. Publication runs queue without cancelling an earlier deployment.

Check the actual Actions run and public URLs before calling publication complete. A successful build alone does not establish that GitHub Pages or a WorkAdventure room loaded. The workflow does not upload maps to the devbox, restart services or change the sponsored WorkAdventure venue.

For a downloaded release archive, use the repository's Releases page when a release has been published. Retain the bundled `credits/` directory when distributing or hosting built maps.
