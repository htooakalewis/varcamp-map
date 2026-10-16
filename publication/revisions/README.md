# Reviewed source replacements

`2026-10-16-shared-guides.json` is the sole revision file accepted by `publication/verify-source.mjs`. Its exact bytes must be hashed in `publication/source-manifest.json` under `extensionInventory`. The initial revision list is empty.

The schema is an object with exactly `schemaVersion: 1` and a `revisions` array. Each record has exactly these fields:

- `path`: one exact existing `sourceInventory` key; no wildcards or paths outside that original receipt.
- `fromSha256`: the original receipt's lowercase 64-character SHA-256 digest. Preserve that receipt unchanged, including when revising the same file again.
- `toSha256`: the lowercase 64-character SHA-256 digest of the reviewed replacement bytes.
- `reason`: a nonempty explanation of the authorized change.

Record only explicitly reviewed existing-file changes. A path may appear once. Files added after the original receipt belong in `extensionInventory`, never in this revision list; original paths cannot overlap extensions. Update the revision file's extension digest whenever its reviewed records change. Also update extension digests for reviewed changes to extension files.

Verification still requires every original file, checks unchanged originals against their original digests and replacements against their exact new digests, rejects unlisted files in the eight audited source folders, verifies every extension digest, and requires all 33 native TMJ/WAM pairs. A revision is an explicit replacement record, not an exception to these checks.
