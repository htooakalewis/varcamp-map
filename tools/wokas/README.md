# Reproduce and qualify the Woka package

Authoring requires Python3 and Pillow. The retained masters and exact mask/crop
recipe live in `art/source/wokas`. `prepare_sources.py` deterministically derives
the masks and recipe from those original images. It keeps subject components at
alpha>128, intended detached details of at least3source pixels within32pixels,
and the original two-pixel antialias fringe. It never paints an invented pose.
Every selected native RGBA sample comes from its pinned original source.

    python3 tools/wokas/prepare_sources.py
    python3 tools/wokas/export.py --check
    python3 tests/wokas/test_native_package.py
    python3 tests/wokas/test_collection_binding.py
    python3 tests/wokas/test_source_export.py

`export.py` without `--check` writes the24 native skins, manifest and unbound
collection. It uses one character-wide uniform scale, nearest sampling, a
transparent border and a shared foot baseline at row30 of each32px frame.
Leo's separately repaired six-pose source is normalized to224 original source
units before that common scale because the repair has different resolution.
All other18 Leo poses retain the original master source body.

`verify-upstream.mjs` accepts a separately supplied actual pinned upstream
checkout, exact dependency root, TypeScript compiler and evidence destination.
It verifies all source pins before executing temporary transpiled copies of the
actual schema, animation function and LocalWokaService. The real filesystem
catalog read executes; only the messages-module import path is rebound to the
actual schema module in the temporary test directory. It verifies all24 IDs,
unknown/partial/duplicate rejection, default preservation and actual file reload.
It does not change the upstream checkout, access a server or establish which
service is active live.

    node tests/wokas/verify-upstream.mjs \
      --core-source /actual/pinned/workadventure \
      --dependency-root /isolated/test/node_modules \
      --typescript /actual/typescript/lib/typescript.js \
      --evidence /new/source-selection-proof.json

The pinned dependencies used for this source qualification are zod3.25.76,
@anatine/zod-openapi2.2.8 and openapi3-ts4.5.0, from the inspected upstream lock.
No upstream implementation is copied into the avatar artwork package. Live
catalog integration and full attendee selection remain separate Root-operated
gates, described in the public bundle README.
