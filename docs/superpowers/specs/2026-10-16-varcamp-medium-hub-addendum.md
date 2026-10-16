# VarCamp medium plaza addendum

User steering supersedes only the earlier 64×64 hub geometry and compact façade treatment. Full approval to implement and verify is already supplied; no extra workflow approval is requested.

The hub becomes 96×96. It remains a circular arrival with twelve separate zodiac speaker buildings and six primary hall/activity choices. All other 32 source layouts, terrain, art placement, quest geometry and exported native maps remain byte-identical. Retain every existing named return alias, repositioned safely within the expanded hub.

Use a broad circular stone promenade around a legible central reception court, with clear radial approaches, bounded planted recesses, water gardens and deliberate seating pockets between buildings. Move native-size objects to authored positions; do not scale the old map or its props. Welcome, sponsor panels, directory and instructions remain together.

Each speaker façade must read as an actual building: pitched roof, eaves/depth, solid walls, windows, entrance frame/canopy and an individual zodiac accent. Use a fixed camera with upright windows and wall depth. All twelve buildings face south with short paved side/front approaches from the circular street, as explicitly approved in the later steering; do not rotate whole building sprites. Preserve independent speaker interiors and all existing return alias names. One original native12×12 exterior plus individual zodiac emblems/nameplates identifies each address.

Twelve prominent English nameplates read `01 ARIES SPEAKER ROOM` through `12 PISCES SPEAKER ROOM` in the established sign order. Pinned TextUtils ignores Tiled `bold`; guarantee bold using deterministic original raster block lettering, with no installed-font dependency. Two lines preserve native pixel size and legibility. Existing small directional room signs may remain on their clear public approaches.

Acceptance: 96² hub; every speaker door ≤65 collision steps from every welcome cell; all six primary choices ≤36; clear connected spawn and exit rectangles; no uncontrolled text/control/scenery overlap; welcome/sponsors clear; proper roof/window/door native depth; physical entrances remain usable. Guarded author export must reject native edits, then normal map build must preserve native sources. Snapshot and compare all other 32 layouts and production/preview outputs. No UI, remote publication or release/cache tooling change.

Further navigation steering: remove the dense arrival paragraph. Use a short WELCOME/MOVE control plaque, four separate padded pointer boards (N HALLS/MAZES, W PARK/ARCADE, E BEACH/FA SHIP, S GARDEN/CAFÉ), small visual compass/you-are-here and directory prompt. Position glyphs explicitly in original raster art, with consistent hierarchy and padding. Final author pass waits for the coordinator’s sample-reference feedback.

## Final arrival/public-space composition

Four separately shaped arrow arms form one compact direction post at47,43 (12×6), one clear tile above the default arrival. Native integer glyph rectangles center each line inside its physical arm; the existing four junction boards remain. Four planted conversation gardens, four outer seating gardens, two water gardens, a crescent fountain court and a community table terrace bound the former empty floor. The north/south avenue retains six clear central tiles and the east/west avenue retains at least six clear rows. Every furnishing uses its native32px footprint.

## First-entry correction and compact arrival signs

The actual pinned HdpiManager starts zoomModifier1, chooses floor(sqrt(physicalGamePixels/(640×480))), and has no defaultZoom map-property consumer or persisted zoom preference. At the observed2880px screen, native32px tiles render96physicalpx. The former sponsor rowy39 was above the first30×~16camera; the earlier24×16QA crop also omitted it. This was a composition contract failure and is corrected in source.

Following explicit user feedback that arrival boards were too large, regenerated native rasters reduce crosspost12×6→6×3, brand12×2→6×1, welcome10×3→5×1, directory8×1→4×1, position8×1→4×1. Compact glyphs are original5×7 patterns at native1px stroke, yielding21px physical text at3×. Twelve room nameplates, four junction boards and six gate plaques keep exactly their previous pixels.

Final positions: sponsors37/45/53,y51 (6×2 each), three plinthsx36/44/52,y51 (8×3) with wood shelfy53. Crosspost50,45; brand38,44; welcome39,47; directory45,54/pole46,55; position45,57/pole46,58; compass43,57. Welcome seat moves36,44→36,45 to clear the compact brand. All entries/exits/interactive areas remain exactly unchanged.

A first-view test checks full native rectangles for all three logos, all four shaped arrow arms and directory from all four welcome cells in30×16 viewports with1tile top/side and2tile bottom HUD reservation. Pixel tests preserve arrow4px vertical dark inset and compact plaque2px clear dark backing, with decorative flourishes omitted only on the compact arrival plaques.
