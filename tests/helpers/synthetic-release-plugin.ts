/** Deliberately synthetic native asset/cache fixtures exercise the real generic
 * emitter, not the complete current-world release entry or its authority. */
import{readFileSync}from'node:fs';
import{resolve}from'node:path';
import type{Plugin}from'vite';
import{WORLD_CATALOG}from'../../src/world/catalog';
import{emitNativeMapAssets,uiReleaseIdentity}from'../../tools/release';
import{readZodiacWokaPublication}from'../../tools/wokas/publication';
export function syntheticReleasePlugin():Plugin{return{name:'synthetic-native-map-assets',config(config){return{define:{'import.meta.env.VARCAMP_UI_RELEASE':JSON.stringify(uiReleaseIdentity(resolve(config.root??'.')))}};},generateBundle(_options,bundle){const runtime=Object.values(bundle).find(entry=>entry.type==='chunk'&&entry.isEntry&&entry.name==='src-main');if(!runtime)throw Error('Missing controlled fixture runtime');const rows=Object.keys(WORLD_CATALOG).map(id=>({id,map:JSON.parse(readFileSync(`maps/${id}.tmj`,'utf8')),sourceWam:JSON.parse(readFileSync(`maps/${id}.wam`,'utf8'))}));emitNativeMapAssets(rows,runtime.fileName,readZodiacWokaPublication(),asset=>this.emitFile(asset));}};}
