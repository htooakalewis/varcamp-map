import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {renderCoast} from '../tools/art/coast-raster';
it('parameterized extraction reproduces every reviewed shipyard pixel and source terrain cell exactly',async()=>{const old=JSON.parse(readFileSync('world/layouts/shipyard-beach.json','utf8')),art=JSON.parse(readFileSync('art/source/organic-coast.json','utf8')),recipe=JSON.parse(readFileSync('world/organic-coast.json','utf8'));const r=await renderCoast(recipe,{width:48,height:48,prefix:'organic-coast',groundPrefix:'organic-ground',image:art.image});expect(r.png.equals(readFileSync(art.image))).toBe(true);expect(r.edges).toEqual(art.cells);expect(r.ground).toEqual(old.placements.filter((p:any)=>p.id.startsWith('organic-ground-')));});
