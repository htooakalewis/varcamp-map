# VarCamp Zodiac2026 readable native artwork v2

24 original native32px human avatars:12 signs, male/female pairs, twelve frames each.
The96x128 PNG uses DOWN/LEFT/RIGHT/UP rows and stride-a/idle/stride-b columns.
No core framing, collisions or camera changes are required.

Existing varcamp-zodiac-v1-* texture IDs are intentionally preserved. This resource
folder is versioned v2 so a later reviewed catalog can change URLs without losing
people's chosen identity or appending duplicate choices. The unbound template is
not a live catalog; publish/bind only through the separately reviewed operator.

Reproduce from the reviewed repo with node node_modules/tsx/dist/cli.mjs
 tools/wokas/readable-v2.ts. All pixels are painted directly by the TypeScript
source and sharp encodes them losslessly. Source/glyph/palette provenance is in
manifest.json. Original artwork is supplied under the repository MIT license.

No deployment or live selection outcome is claimed by this package.
