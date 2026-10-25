# VarCamp Zodiac 2026 pixel artwork v3

24 original native 32px RPG characters: 12 signs, male/female pairs, twelve frames each.
Each 96x128 PNG uses DOWN/LEFT/RIGHT/UP rows and stride-a/idle/stride-b columns,
32x32 frames, feet on row 30 and a transparent one-pixel border (same contract as v2).

v3 replaces v2's flat block style with layered hand-authored pixel templates:
hue-shifted material outlines, four-tone ramps lit from the top left, two-pixel
eyes with highlights, hair with strands, coat/belt/trousers/boots, alternating
legs and swinging arms, real side profiles and back-of-head views. Every DOWN
frame carries a 9x9 parchment chest badge with the sign's 7x7 glyph, and each
sign keeps a small identifying accessory in every direction.

Existing varcamp-zodiac-v1-* texture IDs are intentionally preserved; only the
resource folder moves to v3. The unbound template is not a live catalog;
publish/bind only through the separately reviewed operator.

Reproduce from the repo with node node_modules/tsx/dist/cli.mjs
tools/wokas/pixel-v3.ts. All pixels are painted by the TypeScript templates and
sharp encodes them losslessly. Palettes, glyphs and accessory notes live in
art/source/wokas-pixel-v3/native-design.json; hashes are in manifest.json.
Original artwork is supplied under the repository MIT license.

No deployment or live selection outcome is claimed by this package.
