# Shipyard and beach extension

The user approved a smaller plaza, separate speaker buildings, and a shipyard with a beach reached by a signed road. This authored destination uses the existing map-builder format and licensed native assets. Hub integration and live deployment belong to the coordinator.

The new `shipyard-beach` map is 96 × 112 tiles. A north arrival court at `(46,9,4,2)` connects to a central promenade, a west technology workshop, an east picnic garden, and a southern sandy shore. A wooden pier leads to a zodiac observation deck; a west dock meets a furnished cargo barge. Small licensed wooden boats sit beside the docks. Beach games are an open social court, with no invented network minigame implied.

Navigation is deliberately simple: the main road runs north/south, two horizontal branches lead to the workshop and beach activities, and repeated arrow signs identify the pier, beach, shipyard and plaza. The north return threshold at `(46,3,4,1)` uses `overworld.wam#from-shipyard`. Arrival is `shipyard-entry`; arrival and exit do not overlap. The map contains no speaker meeting areas.

References guide composition: [old VarCamp](https://github.com/kokoye2007/varcamp-room), [Shaka Beach](https://github.com/workadventure/shaka-beach-2024), [Pocket Islands](https://schwarnhild.itch.io/pocket-islands-tileset-32x32-legacy), and [Sea Adventures](https://rafaelmatos.itch.io/epic-rpg-world-sea-adventures-asset-pack). Paid pack files are not copied. Coastline silhouettes, planted gathering pockets, workshop furniture, docks and readable routes are recreated with the project's licensed WorkAdventure/LPC/original pixels. A gold textured WorkAdventure floor tile supplies the warm granular shore surface; it is an artistic reuse, not a claim that the original atlas contains a beach pack.

## Fixed acceptance scope

- Build a valid TMJ/WAM from the authored layout with retained license attribution.
- Every arrival cell, north return cell, social-area cell and signed main-road cell is free of collisions and reachable from arrival.
- Open water remains blocked; the pier replaces water collisions and its observation deck is reachable.
- Signs remain clear of tree canopies and furniture. Native screenshots must show a recognizable shore, furnished workshop, cargo barge, boats, beach seating and game court.
- The coordinator integrates the signed plaza gate and verifies the physical plaza → shipyard → pier → plaza journey in Chrome before claiming the extension complete.

## Implementation sequence

1. Write real builder/collision tests; record their missing-layout failure.
2. Add only two visually verified native atlas mappings: warm granular ground and wooden boat.
3. Author the map JSON with terrain layering, clear roads, workshop/barge modules, vegetation and signs.
4. Run focused tests and the project suite; render with the pinned native Tiled renderer and inspect pixels.
5. Report schema, coordinates, evidence and any unresolved integration concerns to the coordinator. No infrastructure changes, credential access or commits are part of this subtask.
