# VarCamp 2026 organiser-supplied props

Owner-provided artwork from the VarCamp Myanmar 2026 asset drop (`varcamp2026_assets`, received 2026-10-22), used with the organiser's permission for the 2026 event. Rights stay with the owner; see LICENSE.txt. Official event reference: https://var.camp/ .

| Native export | Footprint | Supplied master (not redistributed) | Master SHA-256 |
| --- | --- | --- | --- |
| `assets/tilesets/original/plaza-fountain.png` | 128×96 px, 4×3 tiles (`plaza-fountain`) | `misc/Ornate Azure Fountain with Planters-2.png`, 1536×1024 RGBA | `822a1a9c4c9394b0dc8a78bf2e968104e613be3a85d5a3abf906dec894f28a37` |
| `assets/tilesets/original/plaza-lamp.png` | 32×96 px, 1×3 tiles (`plaza-lamp`) | `misc/misc (9).png`, 887×1774 RGBA | `2e57c11e12e3ff404b58766ca71463aa257eac812f0c4fecc01c62c49fab8ffa` |

Technical changes only: alpha-bounding-box crop, aspect-preserving Lanczos3 downscale (fountain 1147×895 → 123×96, lamp 403×1639 → 24×96), centred on the transparent tile grid, alpha thresholded to binary (≥128 opaque). The sprite depth, blocking cells and placements are recorded in `art/tile-catalog.json` and `tools/maps/brand-assets.ts`.

The four owner-provided 128×64 expo booth marks (AWS User Group Myanmar, BSides Myanmar, OpenInfra User Group Myanmar, the VarCamp lockup) are sponsor panels recorded in `art/sponsors.json`, not part of this tileset registry.
