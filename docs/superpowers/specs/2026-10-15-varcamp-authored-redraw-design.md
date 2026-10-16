# VarCamp compact authored world redraw

The user wants a smaller, easily understood arrival, every activity in a separate map, replaceable demo sponsor logos on first arrival, and a deliberate redraw using the supplied VarCamp, WorkAdventure and tileset references. Existing full approval and the instruction not to ask again apply. This supersedes the old 160×160 geometry and exact furniture-position freeze; meeting, quest, license and safe-publication contracts remain.

## Cause and scope

The existing generated hub is 160×160 with radius-48 facades, radius-56 promenade and distant edge gates. Collision-aware shortest walks are 44–72 tiles to rooms and 82–132 to activities. Campus exploration still combines garden, playground, café, grotto and telescope; harbor combines shore, games and ship. This is authored composition and topology, with no evidence that infrastructure causes those symptoms. Preserve unrelated infrastructure and record unrelated findings.

Redraw all 26 destinations and introduce seven: `orbit-playground`, `constellation-shore`, `fa-ship`, `star-garden`, `moon-cafe`, `moon-grotto`, `stargazer-terrace`. Result: 33 independent TMJ/WAM pairs. A 64×64 circular arrival has twelve small inward-facing zodiac building entrances on its perimeter, a short continuous inner promenade, reception/directory/guide, three fictional DEMO sponsor panels, bounded planted beds and two small water gardens. No meeting, game, maze or coastal activity runs on arrival. Halls and four activity directions are adjacent to the inner court. No random scenery scattering.

## Map graph

Arrival directly reaches twelve speaker maps, Solar Hall, Lunar Hall, Festival Park, Orbit Maze, Shipyard and Exploration Court. Festival Park reaches Arcade and Orbit Playground. Orbit reaches Comet Maze. Shipyard reaches Constellation Shore and FA SHIP. Exploration Court reaches the four elemental districts, Star Garden, Moon Café, Moon Grotto and Stargazer Terrace. The telescope retains the four-sigil gate to Hidden Observatory. Every public leaf also has a signed physical plaza return, and every destination except the quest-gated observatory appears in the journal. Existing return-entry aliases remain valid at the matching hub direction. Entrances never overlap exit triggers.

## Visual authorship

Use deliberate native-scale tile placement: navy architectural masses, stone/wood routes, warm gold signs, restrained cyan technology, zodiac glyphs/constellations, planted recesses, window walls, reception desks and furnished social pockets. Rooms have distinct stage/desk/lounge arrangements and clear aisles. Districts become compact workshop/library/studio/conservatory scenes rather than three duplicated room shells. Coastline is shaped, with edged quays, bays, palms and boats. FA SHIP has its own map, identifiable bow/stern, navigation deck, cargo and crew lounge. Mazes retain solvable routes, checkpoint/finish contracts and distinct landmarks.

References guide composition and licenses; paid packs are not purchased or copied. Reuse verified complete licensed atlases and original SVG art. Logo slots are three separate 192×64 transparent PNGs with plainly fictional DEMO marks, native embedded 32px sheet tilesets (6 columns, 12 cells) rendered by ordinary visible Tiled tile layers, stable relative paths and independent frames. This follows the pinned WorkAdventure renderer, which loads tileset images and renders tile layers; Tiled image layers are unsupported. Each full PNG remains separate and byte-identical, without atlas repacking or re-encoding, and all twelve cells are placed at the native 6×2 footprint with GID ranges disjoint from navigation markers. Team replacement requires replacing the same-sized PNG, without changing code or regenerating tile art.

## Authoring and state

Hand-composed layout JSON provides explicit placements for the initial redraw, then emits ordinary editable native Tiled TMJs. Normal `maps:build` must preserve native TMJ edits and produce/validate previews; explicit `maps:author` may compile layout sources only when generated baselines are unchanged (or an explicit scoped overwrite is requested). This prevents silent loss of later Tiled work. Logos remain separate files and are never overwritten by map building. Existing progress keys, explicit quest activation, muted meeting defaults, rights properties and private NPC bridge are retained. Sign collection belongs in each speaker scene; telescope activation belongs on Stargazer Terrace. No AI-key or core-service change is part of this redesign.

## Measurable acceptance

- Hub is 64×64, 84% less area than the current 160×160 hub; no hub meeting/game/maze/shore areas.
- Collision-aware arrival walk ≤42 tiles to every speaker door and ≤24 to the six hall/activity thresholds. All exits and interactive cells reachable, and all spawn rectangles clear, connected, and disjoint from exits.
- Three DEMO logos, instructions and reception are together at first arrival; text does not overlap, sponsor PNG paths are stable and included in release.
- 33 TMJ/WAM pairs, all declared routes/entries valid; graph reaches every public map and returns to arrival. New activities have distinct map IDs, not zones on arrival or the legacy giant campus.
- All twelve private meeting areas retain room names, muted audio/video and raise-hand settings. Four sigils, twelve discoveries, both maze rewards and observatory gate retain existing stored keys and meaningful activation.
- All destinations receive native renders and visual inspection; Computer walks all twelve doors/returns and each new activity branch in the live demo. Automated route, collision, state, art, schema, package and edit-preservation checks pass.
- Independent review before release. Guarded publication preserves fresh live WAM properties/settings while explicitly reviewing relocated/removed areas. Two full delayed readbacks match the complete final inventory. Demo only; sponsored publication and participant capacity/media remain separate acceptance.

## Audience wayfinding refinement — October 15

Latest steering requires directions in the environment, beyond a single instruction paragraph. Arrival must enumerate north mazes/halls, west park/arcade/playground, east harbor/shore/FA SHIP and south Exploration Court, with twelve numbered speaker doors. Every scene needs a readable arrival board and accurately arrowed physical exit labels, including its plaza return. Branch junctions need direction boards and road chevrons. Use an original 32px native navy/wood/brass pixel sign atlas, retaining licensed source records and transparent exports. Signs must remain clear of spawn/exit/interactive cells, walls, furniture and one another; preserve the frozen graph, area geometry and maze collision masks. Review native renders and live normal-zoom readability before acceptance.
