# Replace the first-arrival sponsor logos

The arrival uses three independent visible Tiled tile layers. Each complete PNG is a standalone embedded 6×2 tileset with 32px cells, separate from shared furniture atlases, painted below avatars as walkable floor inlays. This representation is rendered by the pinned WorkAdventure engine; its image layers are unsupported. DEMO ORBIT, DEMO NOVA and DEMO ATLAS are original fictional placeholders with no sponsor links or affiliation claims. Their original artwork is dedicated under CC0; provenance and replacement records are in `art/sponsors.json` and included in release credits.

| Slot | Stable PNG path | Editable original | Native footprint |
| --- | --- | --- | --- |
| DEMO ORBIT | `assets/sponsors/demo-01.png` | `art/source/sponsors/demo-01.svg` | 192×64 pixels / 6×2 tiles |
| DEMO NOVA | `assets/sponsors/demo-02.png` | `art/source/sponsors/demo-02.svg` | 192×64 pixels / 6×2 tiles |
| DEMO ATLAS | `assets/sponsors/demo-03.png` | `art/source/sponsors/demo-03.svg` | 192×64 pixels / 6×2 tiles |

1. Export the authorized replacement as a transparent RGBA PNG, exactly **192×64 pixels**, with the complete mark inside the canvas. Choose lettering that remains readable at native size on the dark paving. Preserve the same filename and path for the chosen slot.
2. Replace that PNG directly. Keep the walkable floor footprint clear; do not add mounting posts or frames. The SVG master is an optional editable original; map builds never regenerate the logo from it.
3. Update the corresponding record in `art/sponsors.json` with the replacement owner, permission and applicable license. CC0 covers the original fictional marks only; it does not grant rights to replacement branding.
4. Run `npm run maps:build` to validate maps and refresh previews, then `npm run buildmap` to create the release. Review the arrival preview at native scale and check the PNG in `dist/assets/sponsors/`. The release includes the bytes currently on disk, with no content hash freeze. Changing logos needs no code changes or atlas rebuild.

## Expo booths

The expo plaza south of the welcome court (overworld rows 73-88, columns 39-88; `tools/maps/expo-plaza.ts`) has ten booths in two rows facing the shared aisle. Row A, left to right: A1 DEMO ORBIT, A2 DEMO NOVA, A3 CODE CIRCLE (hub), A4 DESIGN GUILD (hub), A5 DEMO ATLAS, A6 DEMO VECTOR. Row B: B1 DATA CLUB (hub), B2 GAME JAM (hub), B3 DEMO LUMEN, B4 OPEN SOURCE (hub). Sponsor booths have the deep-blue carpet, hub booths the wood floor; the audited guide corridors are the open gaps between booths. The mark slots per booth are recorded in `art/sponsors.json`: A1 `demo-01.png` and A5 `demo-03.png` are the two 6×2 (192×64) slots, every other booth takes a 4×2 (128×64) mark (`demo-02-compact.png`, `hub-01.png`, `hub-02.png`, `demo-04.png`, `hub-03.png`, `hub-04.png`, `demo-05.png`, `hub-05.png`). Those marks are not yet placed: the three 6×2 inlays stay on the arrival floor, and placing a mark in a booth needs a reviewed native epoch, because every booth mark is a new embedded tileset and the current overworld atlas roster is closed by `art/source/native-ownership-context.json`, while `tools/maps/builder.ts` accepts only the 6×2 footprint; both files are provenance inputs of the animated overlays across the world. Until that epoch the booths carry no logo or caption; the small floor runes are stand-ins for the sticker sprites in `assets/tilesets/original/booth-stickers.png`, which need the same epoch.

Map authors use an optional `images` array in the layout, for example:

```json
{
  "name": "sponsor-demo-orbit",
  "image": "assets/sponsors/demo-01.png",
  "x": 20,
  "y": 32,
  "width": 6,
  "height": 2,
  "standing": false
}
```

Coordinates and dimensions are integer tiles. The exporter embeds a standalone tileset with `image: "../assets/sponsors/demo-01.png"`, 6 columns, 12 tiles and 32×32 cells. A visible normal tile layer places its twelve GIDs in row-major order at the specified `x,y` tile position. The complete PNG stays byte-identical and unscaled. Navigation-mask and sponsor GID ranges are disjoint. Keep the 6×2 footprint. Paths must refer directly to PNG files inside `assets/sponsors/`. Absolute paths, traversal, remote URLs, missing files, escaped symlinks, incorrect dimensions and incomplete/corrupt PNGs fail the author/release checks. Keep native logo files below 2 MiB; normal 192×64 PNGs are much smaller. Replacements are fully decoded for validation, including indexed-color PNGs; they are never rewritten. A native Tiled edit may place the tile layer inside groups. Keep the embedded sheet dimensions and its `sponsorPanel` property; normal builds validate the current PNG and rewrite the tileset path for previews. Image-only layers are rejected during build/release because the pinned engine loads tileset images and creates tile layers, without rendering Tiled image layers.

To deliberately re-export an edited SVG master, run this from the repository root, replacing the slot number as needed. This is an explicit art operation; neither map command runs it:

```sh
node --input-type=module -e 'import sharp from "sharp"; await sharp("art/source/sponsors/demo-01.svg", { density: 72 }).png().toFile("assets/sponsors/demo-01.png");'
```

The SVGs use authored paths for both lettering and marks, so native exports do not depend on installed fonts. The separate VarCamp Myanmar2026 floor identity uses its organizer-approved generated PNG and retained source master, with the official VarCamp mark as its identity reference. It has its own provenance entry; the fictional sponsor CC0 dedication does not relicense the event brand. No purchased assets, web fonts or new dependencies are used.
