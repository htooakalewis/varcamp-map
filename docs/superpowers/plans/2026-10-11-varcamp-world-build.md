# VarCamp Myanmar World Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver nine fully furnished, connected WorkAdventure maps with twelve distinct zodiac rooms and three optional personal quests, assembled completely by the agent.

**Architecture:** Use the official map starter kit, licensed 32px scenery, and original zodiac details. Declarative layouts produce editable TMJ maps and release-matched WAM sidecars; a shared TypeScript script supplies navigation, private quest progress, and a journal. This plan produces the map package; the linked hosting plan supplies its production world and multiplayer verification.

**Tech Stack:** Tiled, TypeScript, Vite, Vitest, PNG tilesets, JSON Schema validation; official map starter kit 3.3.18 at `1143646a9c02c3928eac4acbb123642c62a48a85`; WorkAdventure WAM 2.1.0.

**Spec:** [Approved world design](../specs/2026-10-10-varcamp-world-design.md).

## Global Constraints

- Nine maps: overworld 256×192; Solar 80×64; Lunar 72×56; four districts 96×64 each; maze 80×80; observatory 64×48. Tiles are 32×32 pixels; map orientation is orthogonal.
- Main avenues are at least eight tiles wide, secondary paths four tiles wide, and maze corridors at least three tiles wide.
- Embedded tileset definitions, `floorLayer` object group, valid start layers, and boolean tile `collides` properties are required.
- All twelve zodiac rooms and every auxiliary space must be furnished and decorated to the approved standard; the agent performs all assembly and manual editing.
- Camera and microphone start off; no flashing decorations, forced music, invented event date, speakers, or agenda.
- Quest flags use `varcamp2026`, `public:false`, `persist:true`, `scope:"world"`. Guest progress is browser-local. Support one active quest tab per visitor. API promise resolution means an accepted API write, not a server durability acknowledgement; verify persistence through actual refresh and cross-map runs.
- Event access, physical exits, and journal navigation remain available with no quest progress or a save failure.
- No paid asset purchase. Keep author, source, license, and modification records with each reused sheet. Keep differently licensed sheets separate.
- Use the existing Node v26.8.2, satisfying the pinned kit's Vite requirement `^20.19.0 || >=22.12.0`; retain the starter lockfile before adding project dependencies.
- Work only inside this standalone repository, never the ancestor home-directory Git repository. Use its `codex/varcamp-cosmic-world` branch or a managed worktree rooted in this repository.
- Before changing implementation code for a failure, reproduce it on the stock/current version, trace the full causal chain, separate code from infrastructure causes, and record fixed scope plus measurable end-to-end acceptance. Use failing-first tests and independent review. If a related failure recurs after a fix, stop patching and reassess the design. Record unrelated findings without adding them to this release.
- Plans, passing tests and commits are intermediate evidence; completion requires the actual attendee outcome, with remaining blockers and deployment status reported explicitly.

## Review Focus

1. A blocked spawn, decorative collision, or overlapping exit must not trap a visitor or bounce them between maps: Tasks 1, 3–6.
2. A rejected save that optimistically changes the API's local value must remain retryable and award nothing: Task 7.
3. A refresh while standing beside a beacon, or repeated action clicks, must not lose the interaction or double-count progress: Task 8.
4. A copied observatory URL with incomplete sigils must allow safe exploration and return, without awarding Stargazer: Tasks 7–8.
5. A small viewport or script failure must preserve useful navigation and readable content; a beautiful overview must not conceal unfinished rooms: Tasks 8–9.

---

## Delivery order and repository structure

Execute Tasks 1–2, then build the maps in Tasks 3–6. Tasks 7–8 add quests and the journal. Task 9 validates and packages the completed world. Hosting preflight can run independently after plan approval; production media tests require both plans.

| Path | Responsibility |
| --- | --- |
| `src/world/catalog.ts` | Authoritative map, sign, element, entry, and interaction IDs |
| `src/navigation.ts` | Production/preview room destinations and navigation commands |
| `world/layouts/*.json` | Authored geometry, tile placements, entries, exits, named areas, and decoration zones |
| `tools/maps/{types,builder,validate,render}.ts` | TMJ/WAM output, structural/reachability checks, and inspection renders |
| `maps/*.tmj`, `maps/*.wam` | Editable, committed Tiled maps and native meeting metadata |
| `assets/tilesets/{workadventure,lpc-office,lpc-space,custom}/` | Separate licensed scenery sheets and custom zodiac art |
| `art/{sources.json,tile-catalog.json,source/}` | Attribution, stable semantic tile IDs, and original art masters |
| `src/quests/{model,store,interactions}.ts` | Pure rules, confirmed persistence, explicit beacon actions |
| `src/main.ts`, `src/journal/` | Map initialization and journal display |
| `tests/` | Structural, reachability, quest, and runtime contract tests |
| `docs/qa/`, `docs/operating/` | Actual map inspection evidence and handover instructions |

Generated geometry and tile placements are owned by `world/layouts`. Tiled may be used by the agent to inspect and refine them; any edit to a generated TMJ must be reconciled into its layout before regenerating. WAM editor changes must be exported and committed. Do not overwrite live WAM edits during an upload.

## Selected tilesets

Use the following verified sources, rather than asking the organiser to find or place assets:

| Pack | Selected files and use | License handling |
| --- | --- | --- |
| [WorkAdventure starter tilesets](https://github.com/workadventure/map-starter-kit/tree/1143646a9c02c3928eac4acbb123642c62a48a85/tilesets) | `WA_Room_Builder.png`, `WA_Seats.png`, `WA_Tables.png`, `WA_Other_Furniture.png`, `WA_Decoration.png`, `WA_Exterior.png`; 32px grid, zero margin/spacing. Office furniture, walls, plants, water, bridges and outdoor scenery. | Preserve [LICENSE.assets](https://github.com/workadventure/map-starter-kit/blob/1143646a9c02c3928eac4acbb123642c62a48a85/LICENSE.assets). Redistribute with this WorkAdventure map, never as a standalone asset pack. |
| [LPC Revised: The Office](https://opengameart.org/content/lpc-revised-the-office) | `Laptop.png`, `TV, Widescreen.png`, `Coffee Maker.png`, `Copy Machine.png`, `Water Cooler.png`, `Card Table.png` from [the archive](https://opengameart.org/sites/default/files/lpc_-_the_office.zip). Office accessories on a 32px grid. | Preserve `Credits.txt`, OGA-BY 3.0; credit Eliza Wyatt and Lanea Zimmerman (Sharm). |
| [LPC goes to space](https://opengameart.org/content/lpc-goes-to-space) | `scifi_space_rpg_tiles_lpcized_0.png`, 448×256, 32px grid. Navy metal, illuminated consoles, crystals and futuristic doors. | Select CC-BY-SA 4.0, credit Baŝto/Basxto, Hyptosis, FunwithPixels and Skorpio. Retain that license and change notes for adapted sheets. |

Keep the concept image as a style reference. Author the twelve glyphs, constellation displays, rune thresholds, beacons, and selected magical centrepieces as original pixel-grid art. Do not paste the concept board into a floor layer. Reused furniture plus deliberate arrangement and custom details must create the approved richly decorated rooms.

### Task 1: A buildable map package with validated world contracts

**Files:** Create `src/world/catalog.ts`, `src/navigation.ts`, `tools/maps/types.ts`, `tools/maps/validate.ts`, `tests/world-contract.test.ts`, `tests/map-validation.test.ts`, `docs/dependencies.md`; adapt the pinned starter `package.json`, lockfile and Vite configs; add `.gitignore`.

**Interfaces:** `MapId` is the nine filename stems from the spec. `SignId` is the twelve lowercase English sign names; `ElementId = 'fire'|'earth'|'air'|'water'`. Export `WORLD_CATALOG`, `SIGN_IDS`, `ELEMENT_IDS`. In `tools/maps/types.ts`, define `MapLayout` with `id`, integer `width`/`height`, placements, entries, exits, areas and inspection zones; `TileRect` coordinates are integer tiles; define `TiledMap` and `WamFile` to match the pinned formats. Export `roomDestination(currentRoomId:string,mapId:MapId,entry?:string):string`, `validateMap(map:unknown,catalog:typeof WORLD_CATALOG):ValidationIssue[]`; each issue has `code`, `mapId`, `location`, `message`.

- [ ] Write tests asserting exactly nine map IDs, twelve unique signs, and four elements. Routing test: from `https://front.test/~/varcamp/maps/fire-district.wam`, destination is `https://front.test/~/varcamp/maps/overworld.wam#from-fire`; same-map restart ends `#maze-entry`. Reject unknown entries. Malformed map fixtures cover missing `floorLayer`, external TSX, invalid GIDs, truncated tile data, blocked spawns and exit overlap.

```ts
expect(Object.keys(WORLD_CATALOG)).toHaveLength(9);
expect(new Set(SIGN_IDS).size).toBe(12);
expect(roomDestination('https://front.test/~/varcamp/maps/fire-district.wam', 'overworld', 'from-fire'))
  .toBe('https://front.test/~/varcamp/maps/overworld.wam#from-fire');
```
- [ ] Run `npm test -- tests/world-contract.test.ts tests/map-validation.test.ts`; confirm the expected missing implementation failures.
- [ ] Import the pinned starter into this repository without its Git history or sample maps in the deliverable. Implement the interfaces, add Vitest and schema validation with locked versions, preserve optimizer and relative build paths. Define preview TMJ routing separately from production WAM routing. Add `test`, `maps:validate`, `maps:build`, `art:check`, and `qa:render` scripts. Install official Tiled 1.12.2 into the task's tool directory if absent; do not replace another installation.
- [ ] Run those tests and `npm run buildmap`; require passing output. Record the actual starter SHA, Node version, Tiled version, added dependencies and upstream schemas in `docs/dependencies.md`.
- [ ] Commit the buildable package and contracts: `chore: establish validated VarCamp map project`.

### Task 2: A reusable office, outdoor and zodiac art kit

**Files:** Create the four `assets/tilesets/` directories, `art/sources.json`, `art/tile-catalog.json`, `art/source/zodiac.svg`, `art/source/magic.svg`, `tools/art/{catalog,export}.ts`, `tests/art-catalog.test.ts`, `docs/qa/art-kit.md`.

**Interfaces:** `tools/art/catalog.ts` defines `TileCatalog`, mapping a semantic sprite ID to its sheet, integer tile rectangle, `blockingCells`, drawing level (`belowAvatar` or `aboveAvatar`), and source ID, and exports `loadTileCatalog():TileCatalog`. `tools/art/export.ts` exports `exportCustomArt():Promise<void>`. Stable IDs cover architecture, workstations, presentation furniture, lounge seating, plants, outdoor props, twelve glyphs/constellations, four sigils, telescope and quest shrines.

- [ ] Write `art-catalog.test.ts`: referenced files exist; every sprite rectangle fits its sheet on the 32px grid; every source has a license and attribution record; all twelve sign art IDs exist; blocking footprints exclude decorative upper portions and door openings.

```ts
for (const sign of SIGN_IDS) {
  expect(loadTileCatalog()[`glyph-${sign}`]).toBeDefined();
  expect(loadTileCatalog()[`constellation-${sign}`]).toBeDefined();
}
```
- [ ] Run `npm test -- tests/art-catalog.test.ts`; confirm failure on missing art/catalog.
- [ ] Import the selected licensed sheets, preserving their license files. Select useful sprite footprints and author original magical overlays on an integer pixel grid, exporting transparent PNGs at native scale. Apply any licensed adaptations to separate sheets and record changes. Assemble furnished Aries and Libra sample compositions using the actual tiles as an early scale/style check; refine them personally, including Tiled edits if useful.
- [ ] Run `npm run art:check` and the art test. Inspect both compositions beside a WorkAdventure avatar at game scale: glass, warm wood, technology screens, plants, decorated walls, glowing zodiac features and usable doors must be visible. Save actual renders in `docs/qa/`; remove obvious style or scale mismatches before building the rest of the campus.
- [ ] Commit: `art: add licensed cosmic office and landscape tiles`.

### Task 3: The large outdoor campus and physical navigation

**Files:** Create `world/layouts/overworld.json`, `maps/overworld.tmj`, `maps/overworld.wam`, `tools/maps/builder.ts`, `tools/maps/render.ts`, `tests/overworld.test.ts`; extend `art/tile-catalog.json` only for needed props.

**Interfaces:** Export `buildMap(layout:MapLayout,tiles:TileCatalog):{tmj:TiledMap;wam:WamFile}` and `renderMap(map:TiledMap,outputPath:string):Promise<void>`. Default entry is `plaza-arrival`. Return entries are `from-solar`, `from-lunar`, `from-fire`, `from-earth`, `from-air`, `from-water`, `from-maze`, `from-observatory`. Production exits use sibling `.wam` destinations, with preview variants generated separately.

- [ ] Write tests for 256×192 dimensions, required entries, safe physical exits and BFS paths from every arrival tile to all district/hall gates, telescope and maze entrance. Assert the specified road widths and no spawn/exit overlap. Include a blocked bridge fixture that must fail reachability.

```ts
expect(layout.width).toBe(256);
expect(layout.height).toBe(192);
expect(validateMap(buildMap(layout, tiles).tmj, WORLD_CATALOG)).toEqual([]);
```
- [ ] Run `npm test -- tests/overworld.test.ts`; confirm failure before the map exists.
- [ ] Build the plaza, glass/wood welcome desk, directories, district gateways, two northern hall entrances, Star Garden, Orbit Playground, Moon Cafe, rivers and bridges, varied woodland paths, telescope and moon grotto. Use the selected tilesets throughout; add planted edges, benches, lighting, sculptures and readable signs. Put exits on physical doorway tile layers so navigation survives script failure. Keep gathering pockets off arrival routes.
- [ ] Run `npm run maps:build`, `npm run maps:validate` and the overworld test. Open the generated map in Tiled, inspect its overview and each outdoor destination, and walk every gate in the WorkAdventure preview. Save screenshots with readable paths and real decoration.
- [ ] Commit: `feat: build explorable constellation campus`.

### Task 4: Two fully furnished presentation halls

**Files:** Create `world/layouts/{solar-hall,lunar-hall}.json`, `maps/{solar-hall,lunar-hall}.{tmj,wam}`, `tests/halls.test.ts`, `docs/qa/halls.md`.

**Interfaces:** Solar stage area ID `solar-stage`, broadcast name `varcamp-solar-main`; Lunar stage area ID `lunar-stage`, broadcast name `varcamp-lunar-main`. Their listener `speakerZoneName` values reference those area IDs, not display names. Entrances are `solar-entry` and `lunar-entry`; returns target the corresponding overworld entries. Separate preparation meetings are `varcamp-solar-prep` and `varcamp-lunar-prep`.

- [ ] Write tests for the 80×64 and 72×56 dimensions, distinct stage/meeting names, correctly referenced audience areas, walkable audience routes, separate backstage zones and physical return exits. Validate WAM 2.1.0 against the pinned schema; an audience pointing to a display name rather than stage ID must fail the project check.

```ts
expect(solarAudience.properties.find(p => p.type === 'listenerMegaphone')?.speakerZoneName).toBe('solar-stage');
expect(lunarAudience.properties.find(p => p.type === 'listenerMegaphone')?.speakerZoneName).toBe('lunar-stage');
```
- [ ] Run `npm test -- tests/halls.test.ts`; confirm failure.
- [ ] Furnish both halls with different zodiac stage compositions, modern seats, side screens, decorated panels, lit aisles, resource boards and fully decorated prep rooms. WAM stage property is `speakerMegaphone` with `chatEnabled:false`, `seeAttendees:false`; audience is `listenerMegaphone` with `chatEnabled:false`, `allowTalking:false`, `raiseHandEnabled:true`. This chooses `LIVE_STREAMING_USERS` broadcast filtering and avoids persistent chat dependencies. Stage/backstage restrictions use `restrictedRightsPropertyData`, trusted staff `readTags`, and `writeTags:[]`. These UI restrictions depend on the hosting plan's server authorization for enforced presenter control.
- [ ] Run the hall test and map validation; open both maps in Tiled and inspect each hall and prep room at avatar scale. Actual simultaneous audio and permissions are verified in the hosting plan, not inferred from metadata.
- [ ] Commit: `feat: add solar and lunar presentation halls`.

### Task 5: Twelve clean zodiac presentation rooms and furnished district social spaces

**Files:** Create four district layout JSONs and their TMJ/WAM files; `tests/districts.test.ts`; `docs/qa/zodiac-rooms.md`.

**Interfaces:** Each district entry is `<element>-entry`; each return targets `overworld.wam#from-<element>`. Each meeting is `varcamp-<sign>`. Quest interaction areas are `beacon-<sign>` and `sigil-<element>` in the public vestibules. Every room and auxiliary space has a named inspection zone in its layout.

- [ ] Write tests that the four 96×64 district maps contain exactly Aries/Leo/Sagittarius, Taurus/Virgo/Capricorn, Gemini/Libra/Aquarius and Cancer/Scorpio/Pisces respectively. Assert twelve unique native meetings, twelve beacon areas, four sigil areas, muted meeting defaults, public paths to each clue without entering a meeting, and complete room inspection inventories.

```ts
expect(new Set(meetingProperties.map(p => p.roomName)).size).toBe(12);
expect(beaconAreas).toHaveLength(12);
expect(sigilAreas).toHaveLength(4);
```
- [ ] Run `npm test -- tests/districts.test.ts`; confirm failure.
- [ ] Assemble every room personally using the selected tilesets and the spec's revised twelve presentation compositions. Each has its named glyph entrance, custom zodiac backdrop, primary screen/stage and speaker position, orderly audience seating, restrained perimeter plants and lighting, finished walls/glass and floor materials. Keep a two-tile central aisle and a clear front presentation floor. Place collaboration areas, lounges, larger sculptures and richer magical detail in adjoining district social spaces, vestibules and corridors. Use native `livekitRoomProperty` with unique `roomName` and `livekitRoomConfig` muted audio/video plus raised hands. Keep open doors and circulation around furniture.
- [ ] Run the district test and map validation; inspect all twelve room close-ups plus vestibules and corridors. Revise repeated generic arrangements, bare walls, unscaled furniture and obstructed text. Save actual images in the QA document.
- [ ] Commit: `feat: build clean zodiac presentation rooms and social spaces`.

### Task 6: A fair maze and hidden observatory

**Files:** Create `world/layouts/{orbit-maze,hidden-observatory}.json`, their TMJ/WAM files, `world/maze-route.json`, `tests/exploration.test.ts`, `docs/qa/exploration.md`.

**Interfaces:** Maze entry `maze-entry`, finish action area `maze-finish`; observatory entry `observatory-entry`, discovery action area `observatory-discovery`. Telescope action area in the overworld is `observatory-telescope`. `world/maze-route.json` contains a verified sequence of walkable tile coordinates for the full hint.

- [ ] Write tests for 80×80 and 64×48 dimensions; maze corridor width ≥3; BFS route to finish; all hint coordinates walkable; three landmark zones; physical return exits. Block the finish in a fixture and require a failed route check.

```ts
expect(maze.width).toBe(80);
expect(maze.height).toBe(80);
expect(route.length).toBeGreaterThan(0);
expect(validateMap(mazeTmj, WORLD_CATALOG)).toEqual([]);
```
- [ ] Run `npm test -- tests/exploration.test.ts`; confirm failure.
- [ ] Build a fixed, visually varied maze with crescent fountain, comet statue and star ring, decorated walls and finish shrine. Build the observatory with telescope, constellation display, seating, elaborate discovery shrine and clear return portal. Add a quiet exploration area and marked social alcove outside the maze; no randomly changing walls.
- [ ] Run the exploration test and map validation. Walk the maze without teleporting, then verify the full route hint, restart entry and observatory return. Inspect walls and all auxiliary spaces individually.
- [ ] Commit: `feat: add orbit maze and hidden observatory`.

### Task 7: Private quest rules and confirmed progress

**Files:** Create `src/quests/model.ts`, `src/quests/store.ts`, `tests/quest-model.test.ts`, `tests/quest-store.test.ts`, `docs/qa/failure-register.md`, `docs/qa/unrelated-findings.md`.

**Interfaces:** `Progress` contains `signs:Record<SignId,boolean>`, `elements:Record<ElementId,boolean>`, `mazeComplete:boolean` and `observatoryDiscovered:boolean`. Flag keys are `varcamp2026.sign.<sign>`, `varcamp2026.sigil.<element>`, `varcamp2026.mazeComplete`, and `varcamp2026.observatoryDiscovered`. Define `BadgeId = 'zodiac-explorer'|'maze-navigator'|'stargazer'`; `QuestSummary` contains `discoveredSigns:SignId[]`, `missingSigns:SignId[]`, `elements:ElementId[]`, `badges:BadgeId[]`. Export `normalizeProgress(raw:Record<string,unknown>):Progress`, `summarizeProgress(progress:Progress):QuestSummary`, `canEnterObservatory(progress:Progress):boolean`, and `createProgressStore(driver:StateDriver):ProgressStore`. `StateDriver.read(key):unknown`, `StateDriver.save(key,value:boolean):Promise<void>`; store exposes `load():Progress`, `get():Progress`, `saveFlag(key:FlagKey):Promise<Progress>`. Here confirmed progress means an API write was accepted; durability is verified separately.

- [ ] Write tests for twelve distinct discoveries, four sigils, duplicate collection, invalid truthy values treated as false, independent visitors, correct badge prerequisites and direct observatory entry with missing sigils awarding nothing. For persistence, simulate the engine changing its shared raw value to true before a storage failure, then assert visible progress remains false; restore the previous confirmed boolean before retrying true so the engine's equality shortcut cannot skip the storage write. Concurrent clicks on the same flag must share one pending write.

```ts
await expect(store.saveFlag('varcamp2026.sign.aries')).rejects.toThrow();
expect(store.get().signs.aries).toBe(false);
expect(summarizeProgress(store.get()).badges).not.toContain('zodiac-explorer');
```
- [ ] Run `npm test -- tests/quest-model.test.ts tests/quest-store.test.ts`; confirm failure. Before changing the persistence adapter, reproduce guest storage failure against stock v1.34.1, trace API cache → shared cache → localStorage failure → equal-value retry shortcut → reopened journal, and record exact evidence/classification in the failure register. A source reading or mocked test alone is not that reproduction.
- [ ] Implement pure rules and per-flag persistence. Maintain confirmed values separately from pending/failed writes; only accepted promises advance the visible quest state. Restore the last confirmed value after a rejected write before retrying. Save with `{public:false,persist:true,scope:'world'}`. Do not store a whole persistent progress object or a trusted count. Observatory discovery requires all four confirmed sigils; persist the discovery flag on its explicit shrine interaction.
- [ ] Run the quest tests; require all assertions to pass, including retry after optimistic local mutation. Repeat the real storage-failure journey and recovery, then obtain independent review of the adapter and causal evidence. Navigation is independent of these methods and must not be disabled by a failed quest write. Recurrence requires design reassessment before another patch.
- [ ] Commit: `feat: track optional quests with retryable private progress`.

### Task 8: Always available navigation, explicit clues and the journal

**Files:** Create `src/main.ts`, `src/runtime.ts`, `src/quests/interactions.ts`, `src/journal/{index.html,main.ts,view.ts,style.css}`, `tests/runtime-contract.test.ts`, `tests/journal.test.ts`; add the script property to all nine TMJs and journal build input.

**Interfaces:** `src/runtime.ts` defines `WorkAdventureApi` as the supported subset of the pinned `WA` typings used here, wrapping `WA.onInit`, room area subscriptions, action messages, menu commands, player state and `WA.nav.goToRoom`. Export `initializeWorld(api:WorkAdventureApi):Promise<void>` and `registerInteractions(api:WorkAdventureApi,store:ProgressStore,catalog:typeof WORLD_CATALOG):()=>void`. `src/journal/view.ts` defines `JournalView = {ready:boolean;summary:QuestSummary;pendingKeys:FlagKey[];errorMessage?:string}`; journal main exports `renderJournal(view:JournalView,container:HTMLElement):void`. Publish the view from the map script as `varcamp2026.journalView` with `{public:false,persist:false,scope:'room'}`; the journal reads/subscribes only to that validated transient snapshot, never raw persistent flags or public room events. Use three permanent navigation menus plus a `Quest Journal` menu.

- [ ] Write tests recording initialization order: after `onInit`, register Return to Plaza, Go to Solar Hall and Go to Lunar Hall before reading quest state. Test refresh/`reason:'initial'` beside a clue, safe leave cleanup, repeated clicks, rejected saves, and journal badges based on confirmed values. Test telescope failure causes no transition, four successful sigils permit transition, and direct-entry shrine with missing sigils grants nothing. Journal rendering lists missing signs and optional full maze hints without a reward penalty.

```ts
expect(events.indexOf('menu:Return to Plaza')).toBeLessThan(events.indexOf('progress:load'));
expect(goToRoom).not.toHaveBeenCalled(); // failed telescope save
expect(summarizeProgress(incompleteSigils).badges).not.toContain('stargazer');
```
- [ ] Run `npm test -- tests/runtime-contract.test.ts tests/journal.test.ts`; confirm failure.
- [ ] Implement per-map initialization. Use `WA.ui.displayActionMessage` near quest areas and remove it on leave; collect only on action. Await successful saves before quest transitions. Use sibling WAM navigation from `WA.room.id`, never asset `mapURL`; preview routing remains separate. Provide journal stamps/badges, visible saved plaza URL, maze restart, optional hints, and exact save-error copy **Progress could not be saved. Try again.** Programme copy remains **Ask the help desk for the current programme**.
- [ ] Run the runtime/journal tests and `npm run buildmap`. Verify a 360px-wide journal and desktop view, keyboard operation, long labels and empty/corrupt progress. In a real browser, simulate guest storage failing then recovering; reopen the journal and require an undiscovered stamp until a real retry writes storage. Simulate script loading failure and verify physical exits. Permanent menus must remain usable when the journal snapshot or quest loading fails.
- [ ] Commit: `feat: add quest journal and reliable venue navigation`.

### Task 9: Complete map QA and editable handover

**Files:** Create `tests/world-package.test.ts`, `docs/qa/world-inspection.md`, `docs/operating/map-editing.md`, `docs/operating/venue-guide.md`; update README and asset credits. Save actual overviews and close-ups under `docs/qa/images/`.

**Interfaces:** The release artifact is the starter kit's `dist/` containing nine TMJs, nine WAMs, referenced assets and bundled scripts/journal; all source files and license records remain in Git. The hosting plan consumes this package and `WORLD_CATALOG`.

- [ ] Write the package test: every catalog map and WAM exists in built output, resolves all assets/scripts, passes schema/route validation, and has the expected inspection zones. No sample map or secret configuration belongs in the release.

```ts
expect(builtTmjFiles).toHaveLength(9);
expect(builtWamFiles).toHaveLength(9);
expect(missingReferencedFiles).toEqual([]);
```
- [ ] Run `npm test -- tests/world-package.test.ts`; confirm failure before the complete package is built.
- [ ] Build the finished world and write the guide: arrival, session destinations, quest instructions, saving the plaza URL and actual progress limitations. Explain how to edit sources in Tiled and preserve live WAM edits, while stating that organiser editing is optional. Include asset credits in map/tileset metadata and the repository.
- [ ] Run `npm test`, `npm run art:check`, `npm run maps:validate`, `npm run buildmap` and the package test. Open all nine maps in Tiled and WorkAdventure, personally inspect every named room/auxiliary zone, and fix missing art or bare areas. Record actual results and images; screenshots of the original concept do not count as completed-map evidence.
- [ ] Commit: `docs: verify and hand over the completed VarCamp world`. Run a whole-branch review before integration. Local map completion does not claim tested 100-person capacity or verified cross-map persistence; those require the hosting plan.

## Linked production work and acceptance coverage

Continue with [the production hosting plan](2026-10-11-varcamp-production-hosting.md). Spec acceptance criteria 1–5 and 11 are primarily owned here; 6–7 require the hosted two-visitor quest runs; 8–10 require actual media, staff-role, device and attendance checks. Never report an unperformed rehearsal as passing.

## Primary implementation references

- [Starter package/scripts at the pinned revision](https://github.com/workadventure/map-starter-kit/blob/1143646a9c02c3928eac4acbb123642c62a48a85/package.json) and [build config](https://github.com/workadventure/map-starter-kit/blob/1143646a9c02c3928eac4acbb123642c62a48a85/buildmap.vite.config.ts).
- [Tiled map rules](https://docs.workadventu.re/map-building/tiled-editor/wa-maps/), [entry/exit layers](https://docs.workadventu.re/map-building/tiled-editor/entry-exit/), [WAM 2.1.0 schema](https://github.com/workadventure/workadventure/blob/v1.34.1/docs/schema/2.1.0/wam.json).
- [Script initialization](https://docs.workadventu.re/developer/map-scripting/references/api-start/), [area subscriptions](https://docs.workadventu.re/developer/map-scripting/references/api-room/), [UI actions/menus](https://docs.workadventu.re/developer/map-scripting/references/api-ui/), [navigation](https://docs.workadventu.re/developer/map-scripting/references/api-nav/).
- [Player persistence](https://docs.workadventu.re/developer/map-scripting/references/api-player/) and [optimistic local API writes](https://github.com/workadventure/workadventure/blob/v1.34.1/play/src/front/Api/Iframe/playerState.ts).
- [Upload behavior and preserving WAM changes](https://docs.workadventu.re/map-building/tiled-editor/publish/wa-hosted/).
