import { it,expect } from 'vitest';
import { offlineReply } from '../ops/npc/server.mjs';
it('gives current separate-space routes rather than obsolete south-road directions',()=>{
 expect(offlineReply('guide','Where is the ship?')).toMatch(/east.*harbor/i);
 expect(offlineReply('guide','Where is the ship?')).toMatch(/FA SHIP/);
 expect(offlineReply('guide','Where is the park?')).toMatch(/west/i);
 expect(offlineReply('guide','Where are the speaker rooms?')).toMatch(/south-facing/i);
 expect(offlineReply('guide','Where is the cafe?')).toMatch(/Exploration Court/);
});

it('directs public destinations to chosen gates beyond the houses on the outer circle road',()=>{
 for(const question of ['Where is the ship?','Where is the park?','Where is the cafe?','Where is the maze?','Where is Solar Hall?']){const answer=offlineReply('guide',question);expect(answer).toMatch(/outer circle road/i);expect(answer).toMatch(/signed alleys|signed alley/i);}
});

it('qualifies plaza approach advice when Aster is already speaking inside a maze',()=>{
 expect(offlineReply('maze-keeper','I need a hint')).toMatch(/^From the plaza,/);
});
