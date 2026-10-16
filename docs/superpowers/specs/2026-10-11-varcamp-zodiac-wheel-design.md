# VarCamp Zodiac Wheel and Wayfinding Design

**Status:** Approved by the user on 2026-10-11 for implementation.  
**Audience:** VarCamp Myanmar attendees, including first-time WorkAdventure visitors.  
**Purpose:** Make every speaker room easy to find from arrival while preserving the cosmic campus, exploration areas, side quests, and optional social destinations.

## User outcome

Visitors arrive at an obvious welcome point, learn the basic movement controls, and can follow one continuous circular road to any of the twelve furnished speaker rooms. The road, arrows, room numbers, zodiac names, glyphs, and element colors reinforce one another. Visitors can return to the hub or continue into the campus without needing to know WorkAdventure's menus.

## Reference review

The following public WorkAdventure maps inform layout and wayfinding only:

- [Shaka Beach 2024](https://github.com/workadventure/shaka-beach-2024): visible area thresholds and a strong entrance landmark at a transition between districts.
- [Webinar preset](https://github.com/workadventure/wam-preset-webinar): an open garden route connects the auditorium and informal gathering areas.
- [Sponsorship preset](https://github.com/workadventure/wam-preset-sponsorship): clearly labeled individual rooms open from a shared approach, with quiet areas visibly marked.
- [WA Village](https://github.com/workadventure/wa-village): recognizable buildings, a hierarchy of outdoor paths, and public commons help visitors orient themselves.

VarCamp will combine the requested zodiac wheel with those patterns: one arrival hub, one continuous loop, twelve unmistakable room doors, repeated path arrows, visible thresholds, and memorable outer-campus landmarks. Reference art, map tiles, code, and branding will not be copied. Existing VarCamp assets and their current licenses remain authoritative.

## Map structure

`overworld.wam` remains the canonical entry map and its existing map ID remains `overworld`. It becomes a purpose-built 320×320 arrival plaza: a clear welcome court opens north to one continuous circular stone promenade, with twelve radial speaker pavilions arranged around the loop. Twelve complete speaker-room interiors move from the four elemental district maps into those pavilions. Their current zodiac identity, presentation stage, seats, decorations, meeting-zone settings, unique WorkAdventure room names, and muted-on-entry defaults remain intact.

The route follows the conventional zodiac order clockwise from Aries: Aries, Taurus, Gemini, Cancer, Leo, Virgo, Libra, Scorpio, Sagittarius, Capricorn, Aquarius, Pisces. Each pavilion displays a large two-digit index, full sign name, matching glyph, and its element marker. Fire, earth, air, and water use the existing VarCamp palette and iconography. One matching existing constellation tile decorates the inner garden for each sign, and golden lights mark the ring junctions. A clear entrance threshold and a readable label face the ring road.

The ring road is continuous and bidirectional, with one obvious north approach from the welcome court and collision-free walks from the loop to each room door. Signs on the promenade show clockwise/counterclockwise arrows. The central welcome plaza has a high-contrast “START HERE / YOU ARE HERE” directory, room order, a “Return to Welcome” landmark, and concise movement guidance (arrow keys or WASD; walk through a marked doorway to enter). These features are visible scenery, not a new scripted navigation service.

The four elemental district maps remain in the world as optional exploration and social destinations. Their three speaker-room footprints are removed to prevent duplicate rooms; their elemental identity, quest sigil areas, safe entries/returns, and non-speaker commons are retained or reflowed into useful elemental lounges. All existing three quests remain unchanged in purpose, flags, and completion flow.

The original large exploration world is preserved as `campus-exploration`, including its Solar and Lunar halls, elemental destinations, Orbit Maze, Hidden Observatory, original plaza, quests, gardens, and return route. The wheel has named, visibly signed gates to that preserved map and the existing maze, observatory, halls, social lounges, festival park, and elemental maps. Existing IDs remain available; the new wheel must not strand a visitor who follows a route in either direction.

## Visual and interaction rules

- Keep the established cosmic-night campus palette: navy, gold, constellation light, and each room's existing element/sign treatment.
- Room names and sign glyphs must remain readable at native Tiled scale; decorative text alone is not a route cue.
- Use redundant cues: directional arrow plus destination wording, and element color plus sign glyph/name.
- Keep the center plaza uncluttered for a group arrival. Place furniture and decoration outside road, threshold, spawn, and navigation-clearance cells.
- Every doorway has a physically walkable approach and leads to the matching room area. Every room can return to the hub by a marked threshold/route.
- Preserve all existing third-party asset attribution and licenses. New original artwork must have a provenance entry and its source retained.
- Do not add a new service, external game backend, login, host operation, or deployment step.

## Fixed scope

In scope: the overworld canvas/layout and signage; moving twelve existing room interiors and WorkAdventure meeting areas into the wheel; converting the four district room footprints into non-speaker commons while retaining district quest/element identity; wheel/district/world map exits and start entries; catalog, package, journal/directory, tests, credits if new art is introduced, and operating/QA documentation.

Out of scope: changing speaker-room names or media configuration, changing quest logic or flags, redesigning Solar/Lunar halls, Orbit Maze, Hidden Observatory, arcade, or festival park beyond the links needed for the new route; importing third-party reference art/code; AWS/devbox changes; WorkAdventure upload or production publication.

## Measurable acceptance

1. `overworld.wam` remains the package entry point and its default spawn is inside the labeled central welcome area.
2. Exactly twelve unique speaker meeting areas exist across the complete world package, one for each zodiac sign, with the existing stable WorkAdventure room names and meeting configuration; no duplicate speaker rooms remain in the elemental districts.
3. All twelve furnished room interiors retain their sign identity and presentation essentials (stage/screen/lectern/seating) and each is reachable by walking from the welcome spawn along the ring without crossing a collision tile.
4. The road forms one continuous walkable cycle. Every sign has a matching pavilion label, glyph, meeting area and physical doorway. All directional signs and route exits resolve to valid, reachable destinations; all wheel/district returns lead back to the hub or the signed campus route.
5. All existing map IDs, the three quest flags and trigger flows, journal actions, six previously published map destinations, and both social-map destinations remain present and valid.
6. The red tests demonstrate the old state lacks the wheel, room migration, and direction signage. The completed tests cover room uniqueness and preservation, walkable route connectivity, accessible doorways/returns, signage and destination links, map dimensions/collisions, quest preservation, and release inventory.
7. `npm test`, `npm run buildmap`, `npm run maps:build`, `npm run art:check`, source and preview map validation, the full pinned upstream WAM schema check, and official Tiled visual rendering pass. Native screenshots show the entire wheel, entry instructions, all room doors, all four route exits, and retained campus destinations.
8. Repeated source/preview/release builds are byte-identical. The import archive contains every unique TMJ/WAM pair and assets/licenses, with ZIP CRC and archive-to-build byte checks passing.
9. No upload or deployment occurs. Live sponsored-client walking/rehearsal remains a separately reported gate because the sponsor import target and event client are not part of this local development task.

## Risks and safeguards

- **Crowding and orientation:** twelve large rooms could overwhelm the center. Keep a clear central hub, use consistent room modules, and place directional cues on every ring junction; verify overview and native-scale crops.
- **Map scale and collisions:** relocating room modules can create intersections or inaccessible entrances. Establish route/collision RED tests before map edits, then validate reachability from the welcome spawn for every doorway and destination.
- **Meeting identity:** moving WAM areas can accidentally rename or duplicate LiveKit rooms. Assert exact equality with the twelve original `varcamp-<sign>` identifiers and preserved muted/raise-hand settings.
- **Quest regressions:** district map edits can strand sigils or their return path. Preserve quest source/flag sets and prove each required quest zone remains reachable in tests.
- **Visitor language and font rendering:** use concise English control instructions plus simple keyboard glyphs; keep route cues pictographic and test signs at native scale. Burmese text is not a hard dependency for this release.
- **Publication risk:** package locally only. A green build or commit is not a hosted event result; import, client walking, group audio/video, and rehearsals remain explicitly unverified.
