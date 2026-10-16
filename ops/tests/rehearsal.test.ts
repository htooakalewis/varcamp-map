import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { expect,it } from 'vitest';
it('exports a clearly labelled temporary private-world map with an unblocked start and collision mask',()=> {
 execFileSync('python3',['ops/build-rehearsal.py']);
 const m=JSON.parse(readFileSync('ops/rehearsal/core-rehearsal.tmj','utf8'));
 const w=JSON.parse(readFileSync('ops/rehearsal/core-rehearsal.wam','utf8'));
 const names=m.layers.map((l:any)=>l.name);expect(new Set(names).size).toBe(names.length);
 expect(w.metadata.name).toContain('REHEARSAL'); expect(w.mapUrl).toBe('core-rehearsal.tmj');
 expect(m.layers.some((l:any)=>l.type==='objectgroup'&&l.name==='floorLayer')).toBe(true);
 const source=JSON.parse(readFileSync('docs/qa/samples/aries.tmj','utf8'));
 const drawn=m.layers.filter((l:any)=>l.type==='tilelayer'&&!['start','rehearsal-collisions'].includes(l.name));
 expect(drawn.map((l:any)=>l.data)).toEqual(source.layers.map((l:any)=>l.data));
 expect(drawn.filter((l:any)=>l.name.startsWith('chair-north-slate--placement-'))).toHaveLength(20);
 const start=m.layers.find((l:any)=>l.name==='start'); const collision=m.layers.find((l:any)=>l.name==='rehearsal-collisions');
 expect(start.data.filter(Boolean)).toHaveLength(1); expect(collision.data[start.data.findIndex(Boolean)]).toBe(0);
 expect(collision.data.some(Boolean)).toBe(true);
});
