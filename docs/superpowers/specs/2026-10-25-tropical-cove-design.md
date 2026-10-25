# Tropical cove

Lewis selected a tropical cove over a long open beach, then approved implementation with “ok go”. The beach currently feels cluttered because its sand carries scattered lounge props, six wide signboards and a broad cross-map wooden promenade. The redesign makes the coast the main feature: a sheltered curved bay, wet sand and turquoise shallows, open sand, palm clusters, one bar and two small seating pockets.

## Approach

Moving signs alone would leave the island silhouette and promenade unchanged. A long open coastline would be simpler but does not provide the sheltered atmosphere Lewis selected. The chosen approach reshapes the southern shore into a crescent and removes the broad promenade, while retaining the working ship and portal geometry. A new separately named coast atlas uses the existing deterministic native32px renderer; no historical artwork is regenerated.

## Layout and constraints

- Retain the48×48 map and32×32 tiles. Terrain, collisions, sprite bases, avatar depth and animated tide must agree.
- Keep all three entry/exit pairs byte-exact: plaza, FA ship and Constellation Shore. Keep both social-area rectangles reachable, including the pier lookout.
- Preserve the complete ship artwork, ship maps, boarding controls and the existing wildlife/aircraft pixels and clocks. Preserve the aircraft band at rows5–7 and its source/collision footprint, so no animation provenance is silently changed.
- Shape a broad southern bay with sandy headlands at the west/east edges and a recessed middle shore. Keep the center of the dry beach open. Replace the horizontal promenade with one narrow jetty to the existing boarding gangway and one edge boardwalk to the shore exit.
- Retain the bar and repair hut as destinations. Keep workshop equipment beside the hut. Group four loungers into two small pockets; remove scattered extra furniture, barrels and shell clusters. Keep palms around the edges.
- Retain only the three compact portal signs. Retire the workshop, bar and central route signboards and their caption layers. Reuse unchanged caption pixels and original native reservations; archived glyph rows may remain unused.
- Keep subtle existing event identity. No new sponsor banners, paid assets, infrastructure changes or unrelated room changes. Guide services remain stopped and their private pins stay untouched.

## Builder choices

The builder settles the exact curve/control points, prop grouping, dock lengths and coast atlas packing, while preserving the contracts above. New current-source checks must reject missing coast source, altered portals, disconnected routes, water with no collision, solid bases on water and missing retained captions. Historical receipts and tests stay pinned to their actual prior snapshots; current behavior has separate tests.

## Acceptance

Inspect a native map render and actual browser arrival, bay, boarding and shore approaches, including fresh load and reload with camera/microphone off. Validate maps, artwork, previews, build and publication receipts. Compare the full suite with the recorded baseline failures. Publish through the existing guarded devbox procedure, retain its baseline and two complete readbacks, and verify public bytes. No PR or hosted CI.
