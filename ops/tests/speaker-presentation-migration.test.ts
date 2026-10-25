import {execFileSync} from 'node:child_process';import {expect,it} from 'vitest';
it('migrates only the eleven approved speaker rooms while refusing loss of saved organizer data and identity collisions',()=>{
 const result=JSON.parse(execFileSync('python3',['ops/tests/speaker-presentation-migration-fixture.py'],{encoding:'utf8'}));
 expect(result.maps).toEqual(['speaker-aquarius','speaker-cancer','speaker-capricorn','speaker-gemini','speaker-leo','speaker-libra','speaker-pisces','speaker-sagittarius','speaker-scorpio','speaker-taurus','speaker-virgo']);
 expect(result.cases).toBe(319);
});
