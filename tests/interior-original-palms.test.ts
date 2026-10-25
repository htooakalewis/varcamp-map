import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import sharp from 'sharp';
import {loadTileCatalog} from '../tools/art/catalog';
import {assertNativeReferenceInterior,renderReferenceInterior} from '../tools/maps/reference-interiors';
import {validateMap,validateWam} from '../tools/maps/validate';
import {WORLD_CATALOG} from '../src/world/catalog';
import type {MapLayout,TiledMap,WamFile,TileLayer} from '../tools/maps/types';
import baseline from './fixtures/interior-original-palms/before.json';
import {approvedHistoricalLayout,assertApprovedLayoutSuccessor,advanceReviewedProvenance} from './helpers/approved-world-successor';
import ariesPresentation from '../world/aries-presentation.json';
import {speakerPresentation} from '../tools/maps/speaker-presentation';
import {beforeSpeakerWam} from './helpers/speaker-presentation-history';
import {beforeHallJson,beforeHallRaw} from './helpers/hall-presentation-history';

const alias='world-ambient-plant-palm';
const read=<T>(path:string):T=>JSON.parse(readFileSync(path,'utf8')) as T;
const sha=(raw:Buffer|string)=>createHash('sha256').update(raw).digest('hex');
const digest=(value:unknown)=>sha(JSON.stringify(value));
const expectedSprite={sheet:'assets/tilesets/original/world-ambient-plants.png',rect:{x:0,y:0,width:3,height:3},blockingCells:[[1,2]],level:'belowAvatar',sourceId:'original',upperCells:[[0,0],[1,0],[2,0],[0,1],[1,1],[2,1]]};
const load=(id:string)=>({layout:read<MapLayout>(`world/layouts/${id}.json`),map:read<TiledMap>(`maps/${id}.tmj`),wam:read<WamFile>(`maps/${id}.wam`),catalog:loadTileCatalog()});
const check=(a:ReturnType<typeof load>)=>assertNativeReferenceInterior(a.map,a.layout,a.catalog,a.wam);
const regeneratedCheck=(a:ReturnType<typeof load>)=>{a.map=renderReferenceInterior(a.layout,a.catalog).tmj;check(a);};
const mask=(map:TiledMap)=>{const layer=map.layers.find(l=>l.name==='physical-collisions');if(layer?.type!=='tilelayer')throw Error('Missing actual collision layer');return layer.data.flatMap((gid,i)=>gid?[i]:[]);};
const targets=(id:string)=>baseline.targets.filter(p=>p.map===id);

describe('original same-footprint interior palms',()=>{
 it('uses the approved original 96px crop with one solid pot base and six upper foliage cells',async()=>{
  const catalog=loadTileCatalog();expect(catalog[alias]).toEqual(expectedSprite);
  const png=readFileSync(expectedSprite.sheet);expect(sha(png)).toBe('4fa0fa471186b1b0725ac10a914bd9104df86e7382b2ec4f233da547dee44f11');
  const metadata=await sharp(png).metadata();expect([metadata.width,metadata.height,metadata.channels]).toEqual([96,96,4]);
  const crop=await sharp('art/source/world-ambient-planter-approved-atlas.png').extract({left:0,top:128,width:96,height:96}).png().toBuffer();expect(crop).toEqual(png);
  // Shared20 owns final source registration; normal art:check enforces sheet
  // membership after Root's single genuine merged provenance regeneration.
  const sources=read<Record<string,{licenseFile:string}>>('art/sources.json');expect(readFileSync(sources.original.licenseFile,'utf8')).toMatch(/CC0/);
 });

 for(const [id,before] of Object.entries(baseline.maps)){
  it(`${id}: retains the actual baseline mask, motion clocks, WAM controls and every untargeted source field`,()=>{
   const a=load(id),historical=approvedHistoricalLayout(id),rest=structuredClone(historical),placements=a.layout.placements;delete (rest as Partial<MapLayout>).placements;
   expect(mask(a.map)).toEqual(before.blockedIndices);expect([a.map.width,a.map.height]).toEqual([before.width,before.height]);
   expect(digest(rest)).toBe(before.layoutExceptPlacementsSha256);
   assertApprovedLayoutSuccessor(id,a.layout);
   const addedIds=(id==='speaker-aries'?ariesPresentation:speakerPresentation(id))?.placements.map(p=>p.id)??[];
   const hall=['solar-hall','lunar-hall'].includes(id),palmEpochPlacements=hall?beforeHallJson<MapLayout>(`world/layouts/${id}.json`).placements:placements;
   expect(digest(palmEpochPlacements.filter(p=>!targets(id).some(t=>t.id===p.id)&&!addedIds.includes(p.id)))).toBe(before.nonTargetPlacementsSha256);
   expect(digest(historical.animatedOverlays)).toBe(before.motionSha256);expect(a.layout.animatedOverlays).toHaveLength(before.motionCount);
   if(id.startsWith('speaker-')){
    const actualBeforeWam=beforeSpeakerWam(id);
    expect(sha(actualBeforeWam)).toBe(before.wamSha256);
    const actualBefore=renderReferenceInterior(advanceReviewedProvenance(historical),a.catalog).tmj;
    if(!targets(id).length)expect(sha(JSON.stringify(actualBefore)+'\n')).toBe(before.nativeSha256);
   }else{
    expect(sha(readFileSync(`maps/${id}.wam`))).toBe(before.wamSha256);
    if(!targets(id).length)expect(sha(hall?beforeHallRaw(`maps/${id}.tmj`):readFileSync(`maps/${id}.tmj`))).toBe(before.nativeSha256);
   }
   expect(validateMap(a.map,WORLD_CATALOG)).toEqual([]);expect(validateWam(a.wam)).toEqual([]);expect(()=>check(a)).not.toThrow();
  });
 }

 for(const target of baseline.targets){
  it(`${target.map}/${target.id}: original pot remains solid below the avatar, with native canopy above and no protected route coverage`,()=>{
   const a=load(target.map),p=a.layout.placements.find(p=>p.id===target.id)!;
   const {map,...expected}=target;expect(p).toEqual({...expected,layer:'props'});
   const set=a.map.tilesets.find(t=>t.image?.endsWith('/world-ambient-plants.png'));expect(set).toBeDefined();
   const floor=a.map.layers.findIndex(l=>l.name==='floorLayer');expect(floor).toBeGreaterThan(0);
   for(let y=0;y<3;y++)for(let x=0;x<3;x++){
    const index=(p.y+y)*a.map.width+p.x+x,gid=set!.firstgid+y*3+x;
    const matches=a.map.layers.flatMap((l,i)=>l.type==='tilelayer'&&l.visible!==false&&l.opacity!==0&&l.data[index]===gid?[i]:[]);
    expect(matches,`${target.id}: cell ${x},${y} is painted exactly once`).toHaveLength(1);
    expect(matches[0]>floor,`${target.id}: only top two rows are above the avatar`).toBe(y<2);
    if(y<2){const protectedRects=[...a.layout.entries,...a.layout.exits,...a.layout.inspectionZones.filter(z=>/aisle|route/.test(z.name)),...a.layout.areas.filter(z=>z.id?.startsWith('beacon-'))];expect(protectedRects.some(r=>p.x+x>=r.x&&p.y+y>=r.y&&p.x+x<r.x+r.width&&p.y+y<r.y+r.height)).toBe(false);}
   }
   expect(mask(a.map)).toContain((p.y+2)*a.map.width+p.x+1);
  });
 }

 // These exercise the real current14 consumer after coherent native regeneration.
 // They catch a deleted required plant, restored imported art, shifted base,
 // or corrupted depth/mask even when simple source/native parity still agrees.
 it.each(['missing','reverted','moved'] as const)('rejects a %s required original palm after native regeneration',kind=>{
  const a=load('speaker-taurus'),p=a.layout.placements.find(p=>p.id==='jade-planter-west')!;
  if(kind==='missing')a.layout.placements=a.layout.placements.filter(q=>q.id!==p.id);
  if(kind==='reverted')p.sprite='plant-palm';
  if(kind==='moved')p.x++;
  expect(()=>regeneratedCheck(a)).toThrow(/Interior.*required furnishing/);
 });
 it.each(['base-mask','missing-canopy','wrong-canopy'] as const)('rejects %s catalog corruption after native regeneration',kind=>{
  const a=load('speaker-leo'),s=a.catalog[alias];expect(s).toBeDefined();
  if(kind==='base-mask')s.blockingCells=[[0,2]];
  if(kind==='missing-canopy')delete s.upperCells;
  if(kind==='wrong-canopy')s.upperCells=[[0,0],[1,0],[2,0]];
  expect(()=>regeneratedCheck(a)).toThrow(/Interior.*required catalog/);
 });
 it.each(['grounded','cutaway'] as const)('refuses a %s override which would flatten the explicit canopy',role=>{
  const a=load('solar-hall');a.layout.placements.find(p=>p.id==='gallery-palm-west')!.renderRole=role;
  expect(()=>regeneratedCheck(a)).toThrow(/explicit upper partition cannot be overridden/);
 });
 it('rejects a saved native canopy moved below the avatar',()=>{
  const a=load('lunar-hall'),p=a.layout.placements.find(p=>p.id==='gallery-palm-west')!,set=a.map.tilesets.find(t=>t.image?.endsWith('/world-ambient-plants.png'));expect(set).toBeDefined();
  const index=p.y*a.map.width+p.x,gid=set!.firstgid,upper=a.map.layers.find(l=>l.type==='tilelayer'&&l.name.startsWith('scenery-aboveAvatar')&&l.data[index]===gid) as TileLayer;expect(upper).toBeDefined();upper.data[index]=0;
  const lower=a.map.layers.find(l=>l.type==='tilelayer'&&l.name.startsWith('scenery-belowAvatar')) as TileLayer;lower.data[index]=gid;
  expect(()=>check(a)).toThrow(/Interior.*native cells\/depth\/controls/);
 });
});
