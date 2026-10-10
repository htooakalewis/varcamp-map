# Varcamp draft venue map

## Purpose

A first draft of the Barcamp (Varcamp) venue in WorkAdventure, used to try the
event flow in the `varcamp-testing` world. The real event runs 12 talks at a
time for about 300 people online at once.

## Layout

70 x 74 tiles at 32 px. Everyone spawns in the lobby and every area opens onto
it.

- **Main stage hall** across the top (68 x 18 tiles), with a raised stage and
  rows of seats. Two four-tile doorways lead down to the lobby.
- **Lobby** in the middle (42 x 53 tiles) with the spawn mat, an info desk and
  a quiet corner at the bottom.
- **Session rooms 1-6** down the left side and **7-12** down the right, each
  12 x 8 tiles with a two-tile door and its number on the lobby floor outside.

## Behaviour

| Area | Layer | Property |
|---|---|---|
| Spawn | `start` | none (the layer name is what WorkAdventure looks for) |
| Rooms 1-12 | `room-01` .. `room-12` | `jitsiRoom` = `varcamp-room-NN` |
| Quiet corner | `quiet-corner` | `silent` = true |
| Walls, info desk | `walls`, `furniture` | tiles carry `collides` = true |

The main stage has no video wired up. A normal video room does not hold 300
people; the broadcast setup for the stage is still to be decided.

## Hosting

A public GitHub repo served by GitHub Pages, which sends the cross-origin
header WorkAdventure needs to fetch the map and tileset from another site.

## Generation and checks

`build_map.py` draws the tileset and writes the map. Before writing, it checks
that every layer is the right size, the outer wall has no gap, the spawn tiles
are walkable, and all 12 rooms, the quiet corner and the stage can be reached
on foot from the spawn.

## Not in this draft

Real artwork, a schedule board, stage broadcast, exits to other maps.
