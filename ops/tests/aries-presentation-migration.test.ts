import {execFileSync} from 'node:child_process';
import {expect,it} from 'vitest';

it('allows only the named Aries area successor and preserves independent live organizer data',()=>{
 const result=JSON.parse(execFileSync('python3',['ops/tests/aries-presentation-migration-fixture.py'],{encoding:'utf8'}));
 expect(result.count).toBe(25);
 expect(result.passedCases).toContain('owner-bool-number');
 expect(result.passedCases).toContain('missing-revision-files');
});
