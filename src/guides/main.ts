/// <reference types="@workadventure/iframe-api-typings" />
import {createHumanCommunication,type GuideReply} from '../bots/event-bridge';
import {SIGN_IDS} from '../world/catalog';
import './style.css';
export async function startGuidePanel(container:HTMLElement):Promise<()=>void>{
 await WA.onInit();
 // All dynamic text is rendered with textContent; incoming text is never HTML.
 container.innerHTML='<header><button type="button" data-close>Close</button><span class="eyebrow">VARCAMP · WALKING GUIDES</span><h1>Where would you like to go?</h1><p>Walk near Lyra, Nova or Orion, then choose a room. Your guide will lead the way.</p></header><label for="guide">Nearby guide</label><select id="guide" aria-label="Choose nearby guide"></select><p class="status" role="status" aria-live="polite"></p><button type="button" data-refresh>Find nearby guides</button><form><label for="command">Room or destination</label><div class="command"><input id="command" name="command" maxlength="512" autocomplete="off" placeholder="Gemini, Cancer, Libra…"><button type="submit">Go</button></div></form><nav class="zodiac" aria-label="Zodiac speaker rooms"></nav><div class="actions"><button type="button" data-command="help">Help</button><button type="button" data-command="stop">Stop my guide</button></div><h2>Guide messages</h2><ol class="messages" aria-live="polite"></ol><small>Guides respond within four tiles. Other attendees cannot send commands as you. Normal attendee chat stays available.</small>';
 const select=container.querySelector<HTMLSelectElement>('select')!,status=container.querySelector<HTMLElement>('.status')!,input=container.querySelector<HTMLInputElement>('input')!,messages=container.querySelector<HTMLOListElement>('.messages')!,nav=container.querySelector<HTMLElement>('.zodiac')!;
 for(const sign of SIGN_IDS){const button=document.createElement('button');button.type='button';button.dataset.command=sign;button.textContent=sign[0].toUpperCase()+sign.slice(1);nav.append(button);}
 let active=true;const shown=new Set<string>();
 const display=(reply:GuideReply)=>{const identity=`${reply.persona}:${reply.session}:${reply.requestId}:${reply.text}`;if(shown.has(identity))return;shown.add(identity);if(shown.size>20)shown.delete(shown.values().next().value!);const li=document.createElement('li');li.textContent=`${reply.persona[0].toUpperCase()+reply.persona.slice(1)}: ${reply.text}`;messages.append(li);while(messages.children.length>20)messages.firstElementChild?.remove();li.scrollIntoView?.({block:'nearest'});};
 let communication:Awaited<ReturnType<typeof createHumanCommunication>>|undefined;
 const redraw=()=>{if(!active||!communication)return;const selected=select.value,guides=communication.guides();select.replaceChildren();for(const g of guides){const option=document.createElement('option');option.value=String(g.id);option.textContent=`${g.persona.name} · ${g.responsive?'responding':'checking'}`;select.append(option);}if(guides.some(g=>String(g.id)===selected))select.value=selected;
  const current=guides.find(g=>String(g.id)===select.value);status.textContent=!guides.length?'No guide is close enough. Walk within four tiles of a guide, then choose Find nearby guides.':current?.responsive?'Connected. Choose a zodiac room or type a destination.':'Checking your guide. Choose Find nearby guides if there is no response.';
  for(const button of Array.from(container.querySelectorAll<HTMLButtonElement>('[data-command],button[type="submit"]')))button.disabled=!current?.responsive;
 };
 communication=await createHumanCommunication(WA,crypto.randomUUID(),display,redraw,error=>{if(active)status.textContent='Guide connection unavailable. Close this panel and try again. '+String(error).slice(0,160);});
 const hello=()=>{for(const guide of communication!.guides())communication!.hello(guide.id);redraw();};
 const request=(text:string)=>{if(!communication!.request(Number(select.value),text)){status.textContent='Walk closer to the guide, or wait two seconds between commands.';return;}input.value='';status.textContent='Request sent. Follow your guide’s avatar.';};
 const onClick=(event:Event)=>{const button=(event.target as HTMLElement).closest<HTMLButtonElement>('button');if(button?.hasAttribute('data-close'))WA.ui.modal.closeModal();else if(button?.hasAttribute('data-refresh'))hello();else if(button?.dataset.command)request(button.dataset.command);};
 const onSubmit=(event:Event)=>{event.preventDefault();request(input.value);};const form=container.querySelector('form')!;
 container.addEventListener('click',onClick);form.addEventListener('submit',onSubmit);select.addEventListener('change',redraw);hello();
 const refreshTimer=setInterval(redraw,1000);
 const dispose=()=>{if(!active)return;active=false;clearInterval(refreshTimer);communication?.close();container.removeEventListener('click',onClick);form.removeEventListener('submit',onSubmit);select.removeEventListener('change',redraw);};
 window.addEventListener('pagehide',dispose,{once:true});return dispose;
}
if(typeof document!=='undefined'){const container=document.getElementById('guides');if(container)void startGuidePanel(container).catch(()=>{container.textContent='Nearby guides are unavailable. Close this panel and try again.';});}
