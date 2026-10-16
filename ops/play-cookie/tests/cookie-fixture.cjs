// Synthetic issuer and identity only; execute actual installed authentication sources.
const fs = require('node:fs');
const crypto = require('node:crypto');
const http = require('node:http');
const https = require('node:https');
const { createRequire } = require('node:module');
const requireStock = createRequire('/usr/src/play/package.json');
const emit = value => process.stdout.write(JSON.stringify(value)+'\n');
const diagnostics = [];
for (const key of ['log','info','warn','error','debug']) console[key] = () => {
  if(key==='error') diagnostics.push(new Error().stack.split('\n').filter(x=>x.includes('/usr/src/play/src/')).map(x=>x.match(/pusher\/[^ :)]*:[0-9]+:[0-9]+/)?.[0]).filter(Boolean));
};
const servers=[]; const failures=[];
function check(name, condition, detail={}) { emit({case:name,passed:!!condition,...detail}); if(!condition) failures.push(name); }
async function listen(app,tls) {
 const server=tls?https.createServer(tls,app):http.createServer(app);servers.push(server);
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 return (tls?'https':'http')+'://127.0.0.1:'+server.address().port;
}
async function get(origin,path,headers={},ca) {
 return new Promise((resolve,reject)=>{
  const req=(origin.startsWith('https:')?https:http).get(origin+path,{headers,ca,...(ca?{servername:'localhost'}:{})},res=>{let body='';res.on('data',x=>body+=x);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body}));});req.on('error',reject);
 });
}
function cookies(response) {
 const jar={};const attrs=(response.headers['set-cookie']||[]).map(raw=>{
  const pieces=raw.split(';');const pos=pieces[0].indexOf('=');const name=pieces[0].slice(0,pos);jar[name]=decodeURIComponent(pieces[0].slice(pos+1));
  const flags=pieces.slice(1).map(x=>x.trim().toLowerCase());
  const expiry=flags.find(x=>x.startsWith('expires='));
  return {name,secure:flags.includes('secure'),httpOnly:flags.includes('httponly'),pathSlash:flags.includes('path=/'),domain:flags.some(x=>x.startsWith('domain=')),sameSite:flags.some(x=>x.startsWith('samesite=')),expired:!!expiry&&Date.parse(expiry.slice(8))<Date.now(),empty:jar[name]===''};
 });return {jar,attrs};
}
const cookieHeader = jar => Object.entries(jar).map(([k,v])=>k+'='+encodeURIComponent(v)).join('; ');
const attrOkay=(a,secure,expired=false)=>a.secure===secure&&a.httpOnly&&a.pathSlash&&!a.domain&&!a.sameSite&&a.expired===expired;
const timeout=setTimeout(()=>{emit({case:'fixture-timeout',passed:false});process.exit(2);},45000);
(async()=>{
 const mode=process.env.FIXTURE_MODE||'configured-https';
 let issuerOrigin; let discoveries=0; let tokens=0; let userinfos=0;let revocations=0;let challenge;let tokenControls;
 const pair=crypto.generateKeyPairSync('rsa',{modulusLength:2048}); const jwk=pair.publicKey.export({format:'jwk'});jwk.kid='synthetic-key';jwk.use='sig';jwk.alg='RS256';
 const jwt = payload => {
  const b=x=>Buffer.from(JSON.stringify(x)).toString('base64url');const input=b({alg:'RS256',kid:jwk.kid})+'.'+b(payload);
  return input+'.'+crypto.sign('RSA-SHA256',Buffer.from(input),pair.privateKey).toString('base64url');
 };
 issuerOrigin=await listen(async(req,res)=>{
  res.setHeader('Content-Type','application/json');
  if(req.url==='/.well-known/openid-configuration') {discoveries++;res.end(JSON.stringify({issuer:issuerOrigin,authorization_endpoint:issuerOrigin+'/authorize',token_endpoint:issuerOrigin+'/token',userinfo_endpoint:issuerOrigin+'/userinfo',jwks_uri:issuerOrigin+'/jwks',revocation_endpoint:issuerOrigin+'/revoke',response_types_supported:['code'],subject_types_supported:['public'],id_token_signing_alg_values_supported:['RS256'],token_endpoint_auth_methods_supported:['client_secret_basic'],code_challenge_methods_supported:['S256']}));}
  else if(req.url==='/jwks')res.end(JSON.stringify({keys:[jwk]}));
  else if(req.url==='/token') {
   let body='';for await(const c of req)body+=c;const data=new URLSearchParams(body);tokens++;
   tokenControls={verifierS256:crypto.createHash('sha256').update(data.get('code_verifier')||'').digest('base64url')===challenge,callback:data.get('redirect_uri')===process.env.PUSHER_URL+'/openid-callback',grant:data.get('grant_type')==='authorization_code'};
   if(!Object.values(tokenControls).every(Boolean)){res.statusCode=400;res.end(JSON.stringify({error:'invalid_grant'}));return;}
   const now=Math.floor(Date.now()/1000);res.end(JSON.stringify({access_token:'synthetic-access-token',token_type:'Bearer',expires_in:300,id_token:jwt({iss:issuerOrigin,sub:'synthetic-user',aud:'synthetic-client',exp:now+300,iat:now})}));
  } else if(req.url.startsWith('/userinfo')){userinfos++;res.end(JSON.stringify({sub:'synthetic-user',email:'fixture@example.invalid',preferred_username:'fixture',locale:'en',tags:['organizer']}));}
  else if(req.url==='/revoke'){revocations++;res.end('{}');}
  else{res.statusCode=404;res.end('{}');}
 });
 const empty=mode==='empty';const relative=mode==='relative';const native=mode==='native-tls';
 const publicUrl=empty?'':relative?'/relative':mode==='configured-https'?'https://cookie-fixture.invalid':'http://cookie-fixture.invalid';
 Object.assign(process.env,{SECRET_KEY:'synthetic-cookie-fixture-key',API_URL:'127.0.0.1:1',MAP_STORAGE_API_TOKEN:'synthetic-map-token',PUSHER_URL:publicUrl,FRONT_URL:'https://cookie-fixture.invalid',UPLOADER_URL:'',ICON_URL:'https://icons-fixture.invalid',OPENID_CLIENT_ID:empty||relative?'':'synthetic-client',OPENID_CLIENT_SECRET:'synthetic-client-secret',OPENID_CLIENT_ISSUER:issuerOrigin,OPENID_SCOPE:'openid email profile',DEBUG:'',TSX_TSCONFIG_PATH:'/usr/src/play/tsconfig-pusher.json',TSX_DISABLE_CACHE:'1'});
 requireStock('tsx/cjs'); const express=requireStock('express');const cookieParser=requireStock('cookie-parser');const {generators}=requireStock('openid-client');
 const app=express();app.use(cookieParser());let nativeSecure;
 app.use((req,res,next)=>{nativeSecure=req.secure;next();});
 if(empty||relative){
  const {transientOidcCookieOptions}=requireStock('/usr/src/play/src/pusher/services/TransientOidcCookieOptions.ts');
  app.get('/policy',(req,res)=>{for(const name of ['code_verifier','oidc_state','playUri'])res.cookie(name,'synthetic',transientOidcCookieOptions(req));res.status(200).end();});
 }else{
  const {AuthenticateController}=requireStock('/usr/src/play/src/pusher/controllers/AuthenticateController.ts');new AuthenticateController(app);
 }
 app.use((err,req,res,next)=>{emit({case:'sanitized-error-category',errorName:err?.name,sourceFrames:(err?.stack||'').split('\n').filter(x=>x.includes('/usr/src/play/src/')).map(x=>x.match(/pusher\/[^ :)]*:[0-9]+:[0-9]+/)?.[0]).filter(Boolean)});res.status(500).end('sanitized fixture error');});
 const tls=native?{key:Buffer.from(process.env.FIXTURE_TLS_KEY,'base64'),cert:Buffer.from(process.env.FIXTURE_TLS_CERT,'base64')}:undefined;
 const origin=await listen(app,tls);const ca=tls?.cert;const secure=mode==='configured-https'||native;
 const forged={host:'forged.invalid','forwarded':'for=127.0.0.1;proto=https;host=forged.invalid','x-forwarded-proto':'https','x-forwarded-host':'forged.invalid'};
 if(mode==='configured-https'){forged.forwarded='proto=http;host=forged.invalid';forged['x-forwarded-proto']='http';}
 const room=publicUrl+'/~/fixture/maps/room.wam';
 const response=await get(origin,empty||relative?'/policy':'/login-screen?'+new URLSearchParams({playUri:room}),forged,ca);const created=cookies(response);
 check(mode+'-real-socket',response.status===(empty||relative?200:302)&&created.attrs.length===3&&new Set(created.attrs.map(a=>a.name)).size===3&&created.attrs.every(a=>attrOkay(a,secure)),{status:response.status,cookies:created.attrs});
 check(mode+'-trust-boundary',app.get('trust proxy')===false&&nativeSecure===native);
 if(!(empty||relative)){
  const location=new URL(response.headers.location);const {openIDClient}=requireStock('/usr/src/play/src/pusher/services/OpenIDClient.ts');challenge=location.searchParams.get('code_challenge');
  check(mode+'-initiation-controls',discoveries===1&&location.origin===issuerOrigin&&location.searchParams.get('response_type')==='code'&&location.searchParams.get('code_challenge_method')==='S256'&&location.searchParams.get('redirect_uri')===publicUrl+'/openid-callback'&&generators.codeChallenge(openIDClient.decrypt(created.jar.code_verifier))===challenge&&created.jar.oidc_state===location.searchParams.get('state')&&created.jar.playUri===room);
  const callback=await get(origin,'/openid-callback?'+new URLSearchParams({code:'synthetic-code',state:created.jar.oidc_state}),{Cookie:cookieHeader(created.jar)},ca);
  const deleted=cookies(callback);const back=callback.headers.location?new URL(callback.headers.location):null;
  check(mode+'-callback',callback.status===302&&back?.origin===new URL(publicUrl).origin&&back?.pathname===new URL(room).pathname&&tokens===1&&userinfos===1&&Object.values(tokenControls||{}).every(Boolean),{status:callback.status,tokenControls});
  check(mode+'-callback-expiry',deleted.attrs.length===3&&deleted.attrs.every(a=>attrOkay(a,secure,true)&&a.empty),{cookies:deleted.attrs});
  const jarAfter={...created.jar};for(const a of deleted.attrs)if(a.expired&&a.empty)delete jarAfter[a.name];check(mode+'-jar-deletion',Object.keys(jarAfter).length===0);
  const mismatch=await get(origin,'/openid-callback?'+new URLSearchParams({code:'synthetic-code',state:'mismatch'}),{Cookie:cookieHeader(created.jar)},ca);
  check(mode+'-mismatched-state',mismatch.status===500&&tokens===1,{status:mismatch.status});
  const noVerifier={...created.jar};delete noVerifier.code_verifier;
  const missing=await get(origin,'/openid-callback?'+new URLSearchParams({code:'synthetic-code',state:created.jar.oidc_state}),{Cookie:cookieHeader(noVerifier)},ca);
  check(mode+'-missing-verifier',missing.status===500&&tokens===1,{status:missing.status});
  // Preserve stock conditional state semantics: absent supplied state is not strengthened here.
  const absentState=await get(origin,'/openid-callback?code=synthetic-code',{Cookie:cookieHeader(created.jar)},ca);
  check(mode+'-conditional-state-preserved',absentState.status===302&&tokens===2,{status:absentState.status});
  const logoutCallback=await get(origin,'/logout-callback',{Cookie:cookieHeader({playUri:room})},ca);const logoutClear=cookies(logoutCallback);
  check(mode+'-existing-logout-clear',logoutCallback.status===302&&logoutCallback.headers.location===room&&logoutClear.attrs.length===1&&attrOkay(logoutClear.attrs[0],secure,true));
  const matrixCallback=await get(origin,'/matrix-callback?loginToken=synthetic',{Cookie:cookieHeader({playUri:room})},ca);const matrixClear=cookies(matrixCallback).attrs.filter(a=>a.name==='playUri');
  check(mode+'-existing-matrix-clear',matrixCallback.status===200&&matrixClear.length===1&&attrOkay(matrixClear[0],secure,true));
  const syntheticClient=await openIDClient.initClient();emit({case:'logout-source-branch-attribution',clientRevocationEndpointPresent:!!syntheticClient.metadata.revocation_endpoint,issuerRevocationEndpointPresent:!!syntheticClient.issuer.metadata.revocation_endpoint});
  const authToken=back?.searchParams.get('token');
  const logout=await get(origin,'/logout?'+new URLSearchParams({playUri:room,token:authToken||'',redirect:issuerOrigin+'/post-logout'}),{},ca);const logoutCreated=cookies(logout);
  check(mode+'-existing-logout-write',logout.status===302&&logout.headers.location===issuerOrigin+'/post-logout'&&revocations===0&&logoutCreated.attrs.length===1&&attrOkay(logoutCreated.attrs[0],secure),{status:logout.status,revocations,cookies:logoutCreated.attrs});
 }
 const allowedFrames=diagnostics.every(frames=>frames.some(frame=>frame.startsWith('pusher/services/MatrixProvider.ts:42:')||frame.startsWith('pusher/controllers/AuthenticateController.ts:')));
 check(mode+'-classified-diagnostics-only',allowedFrames,{sanitizedSourceFrames:diagnostics});
 await Promise.all(servers.map(s=>new Promise(resolve=>s.close(resolve))));clearTimeout(timeout);emit({case:mode+'-result',failures});process.exit(failures.length?1:0);
})().catch(error=>{emit({case:'fixture-infrastructure',passed:false,errorName:error?.name||'unknown',code:error?.code||null});clearTimeout(timeout);for(const s of servers)s.close();process.exit(2);});
