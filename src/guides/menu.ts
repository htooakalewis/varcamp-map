import {personaByName} from '../bots/personas';
const panelPath=import.meta.env.DEV?'./guides/index.html':`../src/guides/index.html?v=${import.meta.env.VARCAMP_UI_RELEASE}`;
const panelUrl=new URL(/* @vite-ignore */panelPath,import.meta.url).href;
export function registerGuideMenu(api:Pick<typeof WA,'player'|'room'|'ui'>):void{
 if(personaByName(api.player.name)||!/(?:^overworld$|\/overworld\.wam$)/.test(api.room.id.split(/[?#]/)[0]))return;
 api.ui.registerMenuCommand('Talk to Nearby Guides',{key:'varcamp-nearby-guides',callback:()=>api.ui.modal.openModal({src:panelUrl,title:'Nearby Guides',allow:null,allowApi:true,position:'right',allowFullScreen:false,closable:true})});
}
