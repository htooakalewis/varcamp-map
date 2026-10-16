# Bounded transient OIDC cookie overlay

Baseline: WorkAdventure96d43a841766b22418c061744e7ed2aafd9870d3 and the exact ARM64 Play base in `Dockerfile`. `cookie.patch` is the complete reviewed source change. `source-files.json` records exact original and final bytes; the two full authentication files and one policy module are the only runtime replacements. The image inherits TSX/Node, assets, entrypoint, command, healthcheck and node ownership. No dependency install or startup injection is used.

Build on the already prepared native ARM64 host with a fresh unique local tag:

```sh
python3 ops/play-cookie/build.py --tag varcamp/workadventure-play:oidc-cookie-unique --evidence-dir .qa/hosting-h2-build
```

The build context contains only six allowlisted source/build inputs. Runtime secrets and test-only declaration packages are excluded. A successful build is intermediate evidence: inspect installed source hashes/permissions and actual runtime, then independently export/load and verify a normal isolated Compose fixture before any venue replacement. A rebuild is not claimed byte-identical without evidence.

`tests/cookie-fixture.cjs` loads the actual installed AuthenticateController/OpenIDClient through the pinned TSX runtime, uses real Express sockets/cookie serialization and a fully synthetic controlled issuer. `tests/run-cookie-fixture.py` uses bounded network-none/read-only containers, requires the image already cached and temporary synthetic `fixture-tls.key`/`fixture-tls.crt` in its evidence directory (certificate SAN localhost and127.0.0.1), and retains commands/exits/harness bytes. It never pulls/builds/loads. Native TLS uses the explicit localhost peer name and trusted synthetic CA while forged HTTP Host is unchanged. Empty/relative URL controls test the actual shared module without enabling OIDC, because stock rejects empty PUSHER_URL with an OIDC client.

`tests/scoped-typecheck.cjs` is a type-only test utility for the actual three installed source roots and their genuine transitive imports. Exact upstream-lock declaration packages are provisioned only in a disposable `/tmp` fixture; they are not part of the image. Preserve the full runtime-image pusher typecheck failure separately: production images omit development declarations/test dependencies. Do not claim that a scoped pass proves the complete upstream test/type suite.

Only Play may use `local-artifact-v1` in `images.lock.json`, with the exact derived daemon ID, retained archive checksum and hash-pinned provenance receipt. `pull_policy: never` is required. Other services retain their registry digest checks. Preflight hashes actual archive/receipt files through no-follow regular-file acquisition and never builds, pulls or loads. The receipt attests correspondence to independently reviewed source/build/export/import evidence; a label or Boolean is insufficient. Keep the archive under the bounded deployment `artifacts/` directory, outside Git and the map release. Preserve private custody: owned artifact directory0700 and archive/provenance files0600; changing metadata must preserve their locked hashes.

Rollout is only the existing VarCamp Play service after the operational checkpoint; capture the exact original nonsecret Compose and cached stock image identity first. Rollback restores that exact Compose and recreates only Play with `--no-deps --pull never`. Actual public cookie, staff callback/deletion/admin/edit/save/reload, guest and unchanged unrelated-container acceptance plus independent review remain mandatory. Full media/event readiness is separate.
