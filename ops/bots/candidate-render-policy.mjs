// PRIVATE clean Canvas candidate. Audited capture/join functions retained; no profiler.
import {createHash}from'node:crypto';
import {failureRecord}from'./evidence.mjs';
export const APP=Object.freeze({kind:'app-frontend',url:'https://varcamp.3-1-133-135.sslip.io/assets/main-D9nIy7Ns.js',status:200,bytes:1179867,sha256:'530259dde885e1dc4b0df3b886c4ca140ff38d70095993ec581f1a0930acd55b',frame:'owned-main-page'});
const ROOM='https://varcamp.3-1-133-135.sslip.io/~/varcamp-demo/maps/overworld.wam';
const require=(x)=>{if(!x)throw Error('Renderer diagnostic validation failed');};
export function navigationUrl(canonical,mode){require(canonical===ROOM&&['default','canvas'].includes(mode));const u=new URL(canonical);require(!u.search&&!u.hash&&!u.username&&!u.password);if(mode==='canvas')u.search='?phaserMode=canvas';return u.href;}
export function createDiagnosticJoin(mode,joinRoom){return async(page,canonical,authority)=>{authority.assertLive();navigationUrl(canonical.roomUrl,mode);await joinRoom(page,canonical,{...authority,navigationMode:mode});authority.assertLive();};}
const bound=async(work,timeout,onTimeout=()=>{})=>{let timer;try{return await Promise.race([Promise.resolve().then(work),new Promise((_,reject)=>{timer=setTimeout(()=>{onTimeout();reject(Error('Renderer diagnostic deadline'));},timeout);})]);}finally{clearTimeout(timer);}};
export function captureAppResponse(page,{assertLive,fail,expected=APP}={}){
 let active=true,seen=0,pending,receipt,first;const live=()=>{require(active);assertLive();};
 const failed=e=>{first??=e;fail(e,{source:'app-frontend-provenance'});};
 const onResponse=response=>{if(response.url()!==APP.url)return;
  try{live();require(++seen===1);require(response.frame()===page.mainFrame()&&response.status()===200&&response.request().resourceType()==='script');
   pending=bound(async()=>{live();const body=await response.body();live();require(Buffer.isBuffer(body)&&body.length<=2097152&&body.length===expected.bytes&&createHash('sha256').update(body).digest('hex')===expected.sha256);receipt={...APP,bytes:expected.bytes,sha256:expected.sha256};return receipt;},1000,()=>{active=false;});void pending.catch(failed);
  }catch(e){pending=Promise.reject(e);void pending.catch(failed);}
 };
 page.on('response',onResponse);
 return {async requireProof(){live();require(seen===1&&pending);const result=await pending;live();if(first)throw first;require(receipt);return result;},detach(){active=false;page.off('response',onResponse);}};
}
export function validateCanvasObservation(value,mode){
 require(value&&['default','canvas'].includes(mode));require(value.sameCanvas===true&&value.nativeInitialized===true);require(mode==='canvas'?value.backend==='canvas2d':['webgl','webgl2'].includes(value.backend));
 for(const key of ['canvasWidth','canvasHeight'])require(Number.isInteger(value[key])&&value[key]>0&&value[key]<=32768);
 for(const key of ['clientWidth','clientHeight'])require(Number.isFinite(value[key])&&value[key]>0&&value[key]<=32768);
 require(value.viewportWidth===1440&&value.viewportHeight===1000&&value.dpr===1);return value;
}
export function inspectInitializedCanvas(element){
 if(!(element instanceof HTMLCanvasElement)||!element.isConnected||!element.matches('#game canvas')||document.querySelectorAll('#game canvas').length!==1)throw Error('Unknown game canvas');
 const style=getComputedStyle(element);if(['hidden','collapse'].includes(style.visibility)||style.display==='none')throw Error('Game canvas is not CSS-visible');
 const rect=element.getBoundingClientRect();if(rect.width<=0||rect.height<=0||element.width<=0||element.height<=0)throw Error('Uninitialized canvas dimensions');
 let backend='unknown';const two=element.getContext('2d');if(two instanceof CanvasRenderingContext2D)backend='canvas2d';else{const gl2=element.getContext('webgl2');if(typeof WebGL2RenderingContext!=='undefined'&&gl2 instanceof WebGL2RenderingContext)backend='webgl2';else{const gl=element.getContext('webgl');if(typeof WebGLRenderingContext!=='undefined'&&gl instanceof WebGLRenderingContext)backend='webgl';}}
 return {backend,canvasWidth:element.width,canvasHeight:element.height,clientWidth:rect.width,clientHeight:rect.height,dpr:devicePixelRatio,viewportWidth:innerWidth,viewportHeight:innerHeight,sameCanvas:true,nativeInitialized:true};
}
/** Same delivered response body and original redacted frame; typed authority only for GameManager. */
export function captureDiagnosticScriptResponses(page,{mode,assertLive,now=Date.now,maxBytes=8*1024*1024,maxResponses=8}={}){
 const approved=navigationUrl(ROOM,mode);require(typeof assertLive==='function');
 const context=Object.freeze({schemaVersion:1,frameRole:'owned-main-page',navigationMode:mode,navigationUrlSha256:createHash('sha256').update(approved).digest('hex'),binding:'response-frame-and-url'});
 const captured=[],pending=new Set();let selected=0,active=true;
 const live=()=>{require(active);assertLive();};
 const kindOf=url=>/\/iframe_api\.js(?:[?#]|$)/.test(url)?'iframe-sdk':/\/GameManager-[\w-]+\.js(?:[?#]|$)/.test(url)?'GameManager':/\/(?:src-main|index)-[\w-]+\.js(?:[?#]|$)/.test(url)?'main':null;
 const listener=response=>{
  const kind=kindOf(response.url());if(!kind||selected++>=maxResponses)return;
  const source=failureRecord(response.url());let frame,actualFrame,bound=false;
  try{actualFrame=response.frame();frame=failureRecord(actualFrame.url());if(kind==='GameManager'){live();bound=actualFrame===page.mainFrame()&&actualFrame.url()===approved&&response.request().resourceType()==='script';}}catch{frame??={error:'missing:frame-unavailable',redacted:false};}
  const row={kind,url:source.error,observedAt:now(),frame:frame.error,redacted:source.redacted||frame.redacted,origin:'captured-response-body',status:response.status(),sha256:null,size:null,capture:'pending'};captured.push(row);
  const work=(async()=>{
   try{
    live();if(kind==='GameManager'&&!bound){row.capture='missing:execution-context';return;}
    const length=Number((await response.allHeaders())['content-length']);live();
    if(length>maxBytes){row.capture='missing:response-too-large';return;}
    const body=await response.body();live();
    if(body.length>maxBytes){row.capture='missing:response-too-large';return;}
    if(kind==='GameManager'&&(response.frame()!==actualFrame||actualFrame!==page.mainFrame()||actualFrame.url()!==approved)){row.capture='missing:execution-context';return;}
    row.sha256=createHash('sha256').update(body).digest('hex');row.size=body.length;
    if(kind==='GameManager')row.executionContext={...context};
    row.capture='captured';
   }catch{row.capture='missing:body-unavailable';}
  })();pending.add(work);void work.finally(()=>pending.delete(work));
 };
 page.on('response',listener);
 return{snapshot:()=>['iframe-sdk','main','GameManager'].flatMap(kind=>{const rows=captured.filter(row=>row.kind===kind);return rows.length?rows.map(row=>({...row,...(row.executionContext?{executionContext:{...row.executionContext}}:{})})):[{kind,capture:'missing:not-observed',sha256:null,origin:'no-captured-response'}];}),async settle(){await Promise.allSettled([...pending]);},detach(){active=false;page.off('response',listener);}};
}

export function parseCandidateMode(args){require(args.length===1&&args[0]==='--renderer-mode=canvas');return 'canvas';}
export function validateCandidateRendererEvidence(value){
 const keys=(o,list)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===list.length&&list.every(k=>Object.hasOwn(o,k));
 require(keys(value,['schemaVersion','requestedMode','appAttestation','sequence','observation'])&&value.schemaVersion===1&&value.requestedMode==='canvas'&&Number.isSafeInteger(value.sequence)&&value.sequence>=1);
 require(keys(value.appAttestation,Object.keys(APP))&&Object.keys(APP).every(k=>value.appAttestation[k]===APP[k]));
 const o=value.observation;require(keys(o,['startWallMs','startMonoMs','endWallMs','endMonoMs','backend','canvasWidth','canvasHeight','clientWidth','clientHeight','dpr','viewportWidth','viewportHeight','sameCanvas','nativeInitialized']));
 for(const key of ['startWallMs','startMonoMs','endWallMs','endMonoMs'])require(Number.isFinite(o[key])&&o[key]>=0&&o[key]<=Number.MAX_SAFE_INTEGER);
 require(o.endWallMs>=o.startWallMs&&o.endWallMs-o.startWallMs<=1000&&o.endMonoMs>=o.startMonoMs&&o.endMonoMs-o.startMonoMs<=1000);validateCanvasObservation(o,'canvas');require(Buffer.byteLength(JSON.stringify(value))<=4096);return value;
}
export function createCandidateRendererObserver(page,{assertLive,assertInitialized,appCapture,clock=()=>performance.now(),wall=Date.now}){
 require(typeof assertLive==='function'&&typeof assertInitialized==='function'&&typeof appCapture?.requireProof==='function');
 let handle,active=true,reading=false,sequence=0;
 const live=()=>{require(active);assertLive();assertInitialized();require(page.url()===navigationUrl(ROOM,'canvas'));};
 return{async read(){
  if(reading){active=false;throw Error('Concurrent candidate renderer read');}reading=true;
  try{return await bound(async()=>{live();const observation={startWallMs:wall(),startMonoMs:clock()};const proof=await appCapture.requireProof();live();require(proof&&Object.keys(proof).length===Object.keys(APP).length&&Object.keys(APP).every(k=>proof[k]===APP[k]));
   const locator=page.locator('#game canvas');require(await locator.count()===1);live();const current=await locator.elementHandle();live();require(current);
   if(!handle)handle=current;else{const same=await handle.evaluate((el,other)=>el===other,current);live();require(same===true);if(current!==handle){await current.dispose();live();}}
   const value=await handle.evaluate(inspectInitializedCanvas);live();validateCanvasObservation(value,'canvas');Object.assign(observation,value,{endWallMs:wall(),endMonoMs:clock()});
   const result={schemaVersion:1,requestedMode:'canvas',appAttestation:{...APP},sequence:sequence+1,observation};validateCandidateRendererEvidence(result);live();sequence++;
   return Object.freeze({...result,appAttestation:Object.freeze(result.appAttestation),observation:Object.freeze(observation)});
  },1000,()=>{active=false;});}catch(e){active=false;throw e;}finally{reading=false;}
 },close(){active=false;}};
}
