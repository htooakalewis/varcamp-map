# Visible guide robots

The approved NPC work adds visible, clearly named guides without adding collisions or moving existing furniture. Lyra is a blue plaza guide, Aster a purple maze keeper, and Nova a gold dockmaster. Three original transparent robot sprites occupy a 96 ×64 integer-grid SVG atlas, each using one 32 ×64 cell. The native export and provenance checks cover the new atlas.

`addNpcGuides` is a deterministic post-composition transform. It adds one non-colliding `npc-character-<id>` placement and a readable name beside each existing conversation area. It creates the missing Comet lobby conversation rectangle `(38,41,3,3)` and uses the existing plaza, Orbit and Shipyard rectangles unchanged. Labels avoid all other signs and prop footprints. Applying the helper twice must not duplicate native objects, and the input layouts remain untouched.

Acceptance: failing-first NPC tests must become green; every conversation cell remains reachable from the map arrival; all three atlas crops are valid, transparent and licensed; names have clear native pixels; the four guide locations render visibly. Runtime interaction and server AI are coordinator-owned. No generated maps, package release or deployment is written by this art task.
