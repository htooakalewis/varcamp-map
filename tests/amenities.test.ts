import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { WORLD_CATALOG, type MapId } from '../src/world/catalog';
import { roomDestination, previewRoomDestination } from '../src/navigation';
import { DIRECTORY_DESTINATIONS, emptyJournalView } from '../src/journal/view';
import { renderJournal } from '../src/journal/main';
import { buildMap } from '../tools/maps/builder';
import { loadTileCatalog } from '../tools/art/catalog';
import { validateMap, validateWam } from '../tools/maps/validate';
import type { MapLayout, TileRect, TiledMap } from '../tools/maps/types';

const venues = [
  ['nebula-arcade', 'arcade-entry', 'from-arcade', 'Nebula Arcade & Esports Lounge'],
  ['zodiac-festival-park', 'festival-entry', 'from-festival', 'Zodiac Festival Park'],
] as const;
function load(id: string): MapLayout {
  expect(existsSync(`world/layouts/${id}.json`), `missing optional venue ${id}`).toBe(true);
  return JSON.parse(readFileSync(`world/layouts/${id}.json`, 'utf8'));
}
const cells = (r: TileRect, width: number) => Array.from({ length: r.width*r.height }, (_, i) => (r.y+Math.floor(i/r.width))*width+r.x+i%r.width);
function reachable(map: TiledMap, start: TileRect): Set<number> {
  const mask = map.layers.find(l => l.name === 'physical-collisions');
  if (mask?.type !== 'tilelayer') throw Error('missing collision mask');
  const q = [cells(start, map.width)[0]], seen = new Set(q);
  for (let h=0;h<q.length;h++) {
    const n=q[h], x=n%map.width,y=Math.floor(n/map.width);
    for(const [nx,ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {
      const next=ny*map.width+nx;
      if(nx>=0&&ny>=0&&nx<map.width&&ny<map.height&&!mask.data[next]&&!seen.has(next)){seen.add(next);q.push(next);}
    }
  }
  return seen;
}
describe('optional social destination journeys', () => {
  // Missing catalog entries would reject the journal action before navigation.
  it.each(venues)('routes %s out and back in production and preview worlds', (id, entry, back) => {
    expect(Object.hasOwn(WORLD_CATALOG,id), 'destination absent from catalog').toBe(true);
    expect(roomDestination('https://play.test/~/sponsored/maps/overworld.wam',id as MapId)).toBe(`https://play.test/~/sponsored/maps/${id}.wam#${entry}`);
    expect(roomDestination(`https://play.test/~/sponsored/maps/${id}.wam`,'overworld',back)).toBe(`https://play.test/~/sponsored/maps/overworld.wam#${back}`);
    expect(previewRoomDestination('https://play.test/_/preview/maps.test/maps/preview/overworld.tmj',id as MapId)).toBe(`https://play.test/_/preview/maps.test/maps/preview/${id}.tmj#${entry}`);
  });
  it('offers both optional destinations while progress is unavailable', () => {
    const container={innerHTML:''} as HTMLElement; renderJournal(emptyJournalView,container);
    for(const [id,,,label] of venues){expect(DIRECTORY_DESTINATIONS).toContainEqual({id,label});expect(container.innerHTML).toContain(`data-destination="${id}"`);}
    expect(emptyJournalView.summary.badges).toEqual([]);
  });
  // Broken spawn/exit placement strands a guest even when schemas accept the map.
  it.each(venues)('%s exports valid native/source/preview maps and safe social routes', (id,entry) => {
    const layout=load(id),{tmj,wam}=buildMap(layout,loadTileCatalog());
    expect(validateMap(tmj,WORLD_CATALOG)).toEqual([]);expect(validateWam(wam)).toEqual([]);
    expect(layout.entries).toContainEqual(expect.objectContaining({name:entry,isDefault:true}));
    expect(layout.exits).toEqual(expect.arrayContaining([expect.objectContaining({destination:'overworld',entry:'from-festival'})]));
    const expectedDestinations=id==='nebula-arcade'?['overworld','zodiac-festival-park']:['overworld','nebula-arcade','orbit-playground'];expect(layout.exits.map(e=>e.destination).sort()).toEqual(expectedDestinations.sort());
    const reached=reachable(tmj,layout.entries[0]);
    for(const r of [...layout.entries,...layout.exits,...layout.areas]) for(const cell of cells(r,tmj.width))expect(reached.has(cell), `${id} ${r.name} cell ${cell}`).toBe(true);
    expect(wam.areas.every(a=>a.properties.every(p=>p.type==='silent'))).toBe(true);
    for(const ext of ['tmj','wam'])expect(existsSync(`maps/${id}.${ext}`)).toBe(true);
    const preview=JSON.parse(readFileSync(`maps/preview/${id}.tmj`,'utf8')) as TiledMap;
    expect(validateMap(preview,WORLD_CATALOG)).toEqual([]);
    const returns=preview.layers.flatMap(l=>(l.properties??[]).filter(p=>p.name==='exitUrl').map(p=>p.value));
    expect(returns.sort()).toEqual(layout.exits.map(e=>`${e.destination}.tmj#${e.entry}`).sort());
  });
  it('keeps arcade cabinets and four zodiac gardens readable at native scale', () => {
    const arcade=load('nebula-arcade'), park=load('zodiac-festival-park');
    const cabinets=arcade.placements.filter(p=>p.sprite==='arcade-cabinet');expect(cabinets.some(p=>p.x<arcade.width/2)).toBe(true);expect(cabinets.some(p=>p.x>=arcade.width/2)).toBe(true);
    for(const zone of ['arcade-cabinets','tournament-stage','social-tables'])expect(arcade.inspectionZones.some(z=>z.name===zone)).toBe(true);
    for(const element of ['fire','earth','air','water']){expect(park.signs?.some(s=>s.name===`${element}-garden-label`)).toBe(true);expect(park.placements.some(p=>p.sprite===`sigil-${element}`)).toBe(true);}
    for(const zone of ['moonlit-pond','picnic-lawn','quiet-lawn','hidden-star-overlook'])expect(park.inspectionZones.some(z=>z.name===zone)).toBe(true);
    expect(park.placements.filter(p=>p.sprite.startsWith('glyph-')).map(p=>p.sprite).sort()).toEqual(['aquarius','aries','cancer','capricorn','gemini','leo','libra','pisces','sagittarius','scorpio','taurus','virgo'].map(s=>`glyph-${s}`));
  });
  it('reaches the arcade and playground through festival thresholds with safe return entries', () => {
    const hub=load('overworld'),festival=load('zodiac-festival-park'),{tmj}=buildMap(festival,loadTileCatalog()),reached=reachable(tmj,festival.entries.find(e=>e.isDefault)!);
    expect(hub.exits.some(e=>e.destination==='zodiac-festival-park')).toBe(true);expect(hub.exits.some(e=>e.destination==='nebula-arcade')).toBe(false);
    for(const[id,back]of[['nebula-arcade','from-arcade'],['orbit-playground','from-playground']]){const gate=festival.exits.find(e=>e.destination===id)!,spawn=festival.entries.find(e=>e.name===back)!;expect(gate).toBeDefined();expect(spawn).toBeDefined();for(const r of[gate,spawn])for(const c of cells(r,tmj.width))expect(reached.has(c)).toBe(true);expect(cells(gate,tmj.width).some(c=>cells(spawn,tmj.width).includes(c))).toBe(false);}
  });
});
it('keeps the overlook return sign clear of zodiac displays', () => {
  const park=load('zodiac-festival-park'),sign=park.signs!.find(s=>s.name==='plaza-return-label')!;
  for(const p of park.placements.filter(p=>p.sprite.startsWith('constellation-')||p.sprite.startsWith('glyph-')))expect(sign.x<p.x+p.width&&sign.x+sign.width>p.x&&sign.y<p.y+p.height&&sign.y+sign.height>p.y,`return sign overlaps ${p.id}`).toBe(false);
});
it('keeps park return aperture and overlook title clear of tree canopies', () => {
  const park=load('zodiac-festival-park'),title=park.signs!.find(s=>s.name==='overlook-label')!;
  for(const r of [title,park.exits[0]])for(const tree of park.placements.filter(p=>p.sprite.startsWith('tree-')))expect(r.x<tree.x+tree.width&&r.x+r.width>tree.x&&r.y<tree.y+tree.height&&r.y+r.height>tree.y,`${'name' in r?r.name:''} overlaps ${tree.id}`).toBe(false);
});
