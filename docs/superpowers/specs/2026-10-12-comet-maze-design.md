# Comet Maze extension

The user approved extra fun mazes while retaining the existing Orbit Maze quest. This bounded extension adds one short separate 48 ×48 destination and a signed optional entrance in Orbit Maze's existing social alcove. No original corridor, full-route hint, landmark, finish, restart, or campus return is replaced.

`comet-maze` uses a deterministic grid of five columns and four rows, joined by three-tile corridors. At least two loops allow guests to recover from a wrong turn; visible dead ends reward exploration without trapping anyone. Three crystal checkpoint courts lead to a finish shrine at the northeast. A south lobby has rest seating, a clear exit and instructions. These are personal-progress geometry events only; the coordinator owns runtime progress handling.

The default `comet-entry` spawn is `(5,41,3,2)`. Its south threshold `(5,45,3,1)` targets `orbit-maze.wam#from-comet`. Orbit's new gate `(73,70,2,2)` targets `comet-maze.wam#comet-entry`; safe return spawn `from-comet` is `(70,70,2,2)`, outside the gate. Orbit gets an accessible `npc-maze-keeper` interaction area `(44,65,3,3)`, clear of the quiet maze and existing furniture.

The new native area names are `comet-checkpoint-1`, `comet-checkpoint-2`, `comet-checkpoint-3`, and `comet-finish`, all initially empty properties. Existing licensed cosmic floors, gold lamps, cyan crystals, zodiac panels, benches and a shrine supply the scenery; no assets or network services are added.

Acceptance requires valid native exports, three-tile clearance along a hand-defined route visiting every checkpoint and finish, blocked walls, reachable side branches and return, nonoverlapping spawns/gates, intact existing Orbit Maze route and quest geometry, and readable native signs. The coordinator verifies live physical entry, checkpoint traversal, finish and return after integration/deployment. Source tests and screenshots alone do not complete that user outcome.

Implementation: write failing journey tests; author the new layout and append only prefixed Orbit gate scenery/navigation/NPC area; run new and existing exploration tests; render and inspect both maps; report evidence and contracts. No catalog/runtime/infrastructure edits or commits are part of this task.
