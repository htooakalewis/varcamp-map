# Compact hub and separate zodiac speaker maps

The user wants participants distributed across separate maps, a smaller arrival plaza, twelve zodiac rooms represented by buildings, and a signed road from the plaza to a shipyard and beach. Preserve every authored room interior and setting. This restructures map navigation; no core, production or infrastructure change is included. Existing full approval and subagent execution apply, with no new question gate.

## Cause and data flow

The current twelve-map composition copies all 535 authored room placements and twelve meeting areas onto the 256×256 overworld. Guests in all twelve talk rooms therefore retain one WorkAdventure room URL, although their LiveKit room names already differ. The oversized loop and sparse open field are source layout decisions; the live walkthrough reproduced their appearance while rooms and links rendered. No 100-user performance failure was measured. Map separation changes scene membership but does not guarantee 100-user capacity or sponsored-core readiness.

The current builder supports physical exitUrl tile layers and named startLayer entries. The publisher intentionally preserves paired live WAMs. A TMJ-only change would retain the old plaza meeting zones, so root must explicitly review the new plaza WAM against a fresh baseline, remove only the twelve old meeting areas and preserve unrelated live metadata. New speaker maps retain the current corresponding meeting properties.

## Compact hub

Replace the plaza with a 160×160 campus centered at (80,80). Its welcome court is 24×24 at (68,68); default spawn is (77,78,6,4). A camera-facing four-line board has panel (71,84,18,5), text (72,84,17,5), 14 px font. Copy is: VARCAMP MYANMAR · START / MOVE: ARROWS / WASD / 12 SIGNS → GOLD LOOP / SOUTH: PARK · CAMPUS · BEACH.

Twelve 16×12 building facades form the same clockwise zodiac order at radius 48. For index i, origin is (round(80+48*cos(i*π/6))-8, round(80+48*sin(i*π/6))-6). Use existing navy walls, floor/roof texture, zodiac glyphs, constellation emblems and doors. The former full interior previews may change into these smaller buildings. Preserve a continuous nominal-radius 56 promenade with four direction labels; obstacle-aware road routes stay outside complete building footprints. The road and doors are near the starting court; all building centers are 48 tiles from arrival.

Each building portal is a 2×1 physical threshold at (origin.x+7,origin.y+11), targeting speaker-<sign>.wam#speaker-entry. A 2×1 exterior return spawn at (origin.x+7,origin.y+14) is disjoint from every exit, prop and sign. Speaker portals are added before road/decoration reservation so return areas stay clear.

Use 200–300 curated outdoor placements, at least eight prop types, four small lily/rock garden pockets, close arrival seating/planters/lights, and at least four decorations near each building approach. Density and safe circulation replace the old 345-placement count; current licensed sprites only. Every added full footprint reserves at least one tile from buildings, roads, entries/exits and sign boxes. Do not import paid assets or dependencies.

South gates and return arrivals use the following exact contracts:

| Gate | x | Threshold | Return arrival | Destination |
| --- | --- | --- | --- | --- |
| Maze |47| x47,y154,w4,h1 | x47,y149,w4,h3 | orbit-maze#maze-entry |
| Arcade |67| x67,y154,w4,h1 | x67,y149,w4,h3 | nebula-arcade#arcade-entry |
| Festival park |87| x87,y154,w4,h1 | x87,y149,w4,h3 | zodiac-festival-park#festival-entry |
| Exploration campus |117| x117,y154,w4,h1 | welcome (77,78,6,4) | campus-exploration#from-wheel |
| Shipyard and beach |137| x137,y154,w4,h1 | x137,y149,w4,h3 | shipyard-beach#shipyard-entry |

Solar/lunar thresholds are (75,5,4,1)/(85,5,4,1), returns at same x,y8,w4,h3. Fire/earth thresholds are (5,67,1,4)/(5,91,1,4), returns x8 at matching y,w3,h4. Air/water thresholds are (154,67,1,4)/(154,91,1,4), returns x149 at matching y,w3,h4. Existing destination and entry names remain unchanged.

## Separate interiors and shipyard contract

Generate twelve 32×36 speaker maps named speaker-aries through speaker-pisces from the original district source modules. Copy the complete 28×30 module to (2,2), preserving all 535 native placement signatures and every meeting property. Default entry speaker-entry is (15,26,2,2), in the central aisle; return threshold (15,31,2,1) leads to overworld#from-speaker-<sign>. Add only a boundary and south return strip around each original module. Plaza and districts have zero zodiac meeting areas; every speaker map has exactly its matching one. District social foyers, beacons and sigils remain.

The shipyard agent owns world/layouts/shipyard-beach.json and its tests: 96×112 tiles, default shipyard-entry=(46,9,4,2), north return threshold=(46,3,4,1) to overworld#from-shipyard. The hub/catalog agent owns catalog, navigation/directory and plaza integration. Catalog/release total is 26 maps/52 TMJ-WAM files. Existing activity, hall, park and quest routes remain available. Runtime/journal reuse the existing bundle and world-scoped progress.

## Added quest and guide contract

Reserve npc-guide=(88,79,3,3) and clearance (87,77,5,6) beside the welcome board for the root-owned guide robot. No landscaping may enter that clearance. Root owns NPC art, interaction, OpenRouter server and quest runtime changes.

The activity agent also owns comet-maze (48×48), default comet-entry=(5,41,3,2), return threshold=(5,45,3,1) to orbit-maze#from-comet, plus the old maze’s additional gate and return arrival. Preserve the full original maze and hints; the extra maze has its own room URL. Add its catalog and directory route in this implementation.

## Official transition references

Native exitUrl accepts relative map URLs; named entry layers have startLayer=true and URL hashes select arrival. See current official [entries and exits](https://docs.workadventu.re/map-building/tiled-editor/entry-exit/). The self-hosted ~/varcamp-demo/maps/ wrapper is documented in [map-storage publishing](https://docs.workadventu.re/map-building/tiled-editor/publish/wa-hosted/); directory navigation uses [WA.nav.goToRoom](https://docs.workadventu.re/developer/map-scripting/references/api-nav/). No deprecated exitSceneUrl/exitInstance properties are introduced.

## Measurable acceptance

1. Exactly 26 catalog maps and 26 TMJ/WAM pairs, 52 source/release map files, zero validation issues.
2. Twelve distinct zodiac meetings, one per speaker map; zero plaza/district zodiac meetings. All 535 room placement relative signatures and original settings preserved.
3. Hub 160×160, court 24×24, twelve separate 16×12 buildings at radius 48; continuous road loop, four road-adjacent direction arrows and readable board near spawn. Curated 200–300 outdoor placements, ≥8 prop types, four lily ponds and ≥4 forecourt props per building.
4. All plaza portals, park/activity gates and every return spawn reachable; every spawn disjoint from collision, exits and sign boxes. New room spawns reach their meeting and return threshold through the original aisle. No road/decor crosses building footprints.
5. Every route resolves to a emitted map/named entry; candidate/preview wrappers and world-scoped quest behavior retained. Shipyard gate and its return use the stated contract.
6. Independent review and source/compiled asset/reference checks pass. Root reviews fresh live plaza metadata, deploys only varcamp-demo, and obtains HTTP200 plus two complete delayed checksum readbacks.
7. Computer physically walks all twelve new building portals, records distinct speaker URLs, sees matching interiors/meeting activation, and returns at the matching building without automatic reentry. Retest festival/campus roundtrips and plaza↔shipyard/beach. Record only actually observed URLs/screenshots.

Tests or upload delivery do not complete live acceptance. Media, capacity, staff authentication and sponsored production hosting remain outside scope.
