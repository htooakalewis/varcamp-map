import {afterEach,expect,it,vi}from'vitest';
import {readFileSync}from'node:fs';
import {registerGuideMenu}from'../src/guides/menu';
afterEach(()=>vi.restoreAllMocks());
it('registers a discoverable human plaza panel without touching native chat or meeting controls',()=>{
 const register=vi.fn(),open=vi.fn();const api={room:{id:'https://example.test/~/demo/maps/overworld.wam'},player:{name:'Attendee'},ui:{registerMenuCommand:register,modal:{openModal:open}}};
 registerGuideMenu(api as unknown as Parameters<typeof registerGuideMenu>[0]);expect(register).toHaveBeenCalledOnce();expect(register.mock.calls[0][0]).toBe('Talk to Nearby Guides');register.mock.calls[0][1].callback();expect(open).toHaveBeenCalledWith(expect.objectContaining({title:'Nearby Guides',allowApi:true,position:'right',closable:true}));
 register.mockClear();for(const name of ['Lyra[BOT]','Nova[BOT]','Orion[BOT]']){api.player.name=name;registerGuideMenu(api as unknown as Parameters<typeof registerGuideMenu>[0]);}expect(register).not.toHaveBeenCalled();api.player.name='Attendee';api.room.id='https://example.test/maps/speaker-cancer.wam';registerGuideMenu(api as unknown as Parameters<typeof registerGuideMenu>[0]);expect(register).not.toHaveBeenCalled();
});
it('keeps dynamic replies out of HTML, bounds transcripts, offers zodiac/Help/Stop and packages a separate API-enabled panel',()=>{
 const source=readFileSync('src/guides/main.ts','utf8');expect(source).toContain('li.textContent=');expect(source).toContain('messages.children.length>20');expect(source).toContain('for(const sign of SIGN_IDS)');expect(source).toContain('data-command="help"');expect(source).toContain('data-command="stop"');expect(source).not.toMatch(/WA\.chat|disablePlayerProximityMeeting/);expect(readFileSync('buildmap.vite.config.ts','utf8')).toContain("guides: './src/guides/index.html'");
});
it('gives English and Burmese instructions for the actual nearby-guide panel and zodiac names',async()=>{
 const {help}=await import('../src/bots/venue');for(const language of ['en','my']as const){expect(help(language)).toContain('Talk to Nearby Guides');expect(help(language)).not.toContain('Nova, Cancer');}expect(help('en')).toMatch(/Gemini.*Cancer.*Libra/);expect(help('my')).toMatch(/[က-အ]/);
});
