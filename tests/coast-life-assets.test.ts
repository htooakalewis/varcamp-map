import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {expect,it} from 'vitest';
import {renderCoastLifeAssets} from '../tools/art/coast-life-assets';
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
it('exports every new coast prop from the approved original masters with native dimensions and real transparency',async()=>{
 const result=await renderCoastLifeAssets();const baseline=JSON.parse(readFileSync('tests/fixtures/coast-life/baseline.json','utf8'));
 for(const alias of new Set(baseline.placements.map((p:any)=>p.newSprite)) as Set<string>){const image=result.props[alias];expect(image,alias).toBeDefined();const m=await sharp(image.png).metadata();const old=baseline.placements.find((p:any)=>p.newSprite===alias);expect([m.width,m.height]).toEqual([old.width*32,old.height*32]);const raw=await sharp(image.png).ensureAlpha().raw().toBuffer();expect(raw.some((a,i)=>i%4===3&&a===0),alias).toBe(true);expect(new Set([...raw].filter((_,i)=>i%4!==3)).size,alias).toBeGreaterThan(32);}
 expect(result.metadata.masters.every(m=>sha(readFileSync(m.path))===m.sha256)).toBe(true);
 const plane=await sharp(result.plane).metadata();expect([plane.width,plane.height]).toEqual([192,96]);
 expect(result.atlas.equals(readFileSync(result.metadata.atlas.path))).toBe(true);expect(result.plane.equals(readFileSync('art/source/coastal-flight-plane.png'))).toBe(true);expect(result.metadata).toEqual(JSON.parse(readFileSync('art/source/coast-life-assets.json','utf8')));for(const[name,png]of Object.entries(result.poseStrips))expect(png.equals(readFileSync(`art/source/coast-life-${name}-poses.png`))).toBe(true);
},20000);
it('exports actual distinct flap/tail/breach/rest poses and opposite-facing fish without changing original master bytes',async()=>{
 const result=await renderCoastLifeAssets();for(const [name,count] of Object.entries({fish:12,gull:12,dolphin:7,seal:6})){const poses=result.poses[name];expect(poses,name).toHaveLength(count);expect(new Set(poses.map(p=>sha(p.rgba))).size,name).toBe(count);}
 expect(result.poses.dolphin[0].rgba.every(x=>x===0)).toBe(true);
},20000);
