import { expect, it } from 'vitest';
import { failureRecord } from '../bots/evidence.mjs';

it.each([50000,100000])('bounds projection work before parsing a %i character unmatched token', length => {
 const began=performance.now();const record=failureRecord('safe',{token:'private',detail:'x'.repeat(length)});
 expect(performance.now()-began).toBeLessThan(1000);
 expect(record.truncated).toBe(true);expect(JSON.stringify(record)).not.toContain('private');
 expect(Buffer.byteLength(JSON.stringify(record))).toBeLessThanOrEqual(16384);
});
it.each([
 'x'.repeat(100000)+' token=PRIVATE',
 'x'.repeat(3000)+' '.repeat(100000)+'token=PRIVATE',
 'x'.repeat(4000)+' token=PRIVATE'.repeat(100),
 'x'.repeat(4000)+' HTTPS://user:PRIVATE@example.invalid/a?token=PRIVATE#PRIVATE'.repeat(3),
 'x'.repeat(4000)+' Bearer PRIVATE'.repeat(100),
 'Error: client_secret='+ 'PRIVATE'.repeat(10000),
 JSON.stringify({apiKey:'PRIVATE'.repeat(10000)}),
])('redacts or discards credentials at bounded text boundaries', input => {
 const record=failureRecord(input);expect(JSON.stringify(record)).not.toContain('PRIVATE');expect(record.truncated).toBe(true);
});
it('preserves safe stacks and nested secret classification with a UTF-8 global ceiling',()=>{
 const original=new Error('safe',{cause:{'API-KEY':'PRIVATE',url:'https://user:PRIVATE@example.invalid/?token=PRIVATE#PRIVATE',detail:'မြန်မာ'.repeat(100000)}});
 original.stack='Error: safe\n at https://example.invalid/a.js:2:3';
 const record=failureRecord(original);expect(record.error.stack).toBe(original.stack);
 expect(record.redacted).toBe(true);expect(record.truncated).toBe(true);expect(JSON.stringify(record)).not.toContain('PRIVATE');
 expect(Buffer.byteLength(JSON.stringify(record))).toBeLessThanOrEqual(16384);
});
