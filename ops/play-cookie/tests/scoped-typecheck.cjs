// Type-only analysis of the actual installed overlay, preserving upstream compiler options.
const fs=require('node:fs');const crypto=require('node:crypto');const cp=require('node:child_process');
const ts=require('/usr/src/node_modules/typescript');
const roots=['/usr/src/play/src/pusher/controllers/AuthenticateController.ts','/usr/src/play/src/pusher/services/OpenIDClient.ts','/usr/src/play/src/pusher/services/TransientOidcCookieOptions.ts'];
const config=ts.readConfigFile('/usr/src/play/tsconfig-pusher.json',ts.sys.readFile);
const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,'/usr/src/play');
const originalOptions={...parsed.options};
const packages=JSON.parse(fs.readFileSync('/tmp/h2-types/packages.json','utf8'));
const paths={...parsed.options.paths};
for(const name of Object.keys(packages))paths[name.startsWith('@types/')?name.slice(7):name]=['/tmp/h2-types/node_modules/'+name];
const options={...parsed.options,noEmit:true,typeRoots:['/tmp/h2-types/node_modules/@types','/usr/src/node_modules/@types'],paths};
const program=ts.createProgram(roots,options);
const diagnostics=[...parsed.errors,...ts.getPreEmitDiagnostics(program)].map(d=>({file:d.file?.fileName||null,code:d.code,line:d.file&&d.start!==undefined?d.file.getLineAndCharacterOfPosition(d.start).line+1:null,message:ts.flattenDiagnosticMessageText(d.messageText,'\n')}));
const sources=program.getSourceFiles().map(f=>({path:fs.realpathSync(f.fileName),sha256:crypto.createHash('sha256').update(fs.readFileSync(f.fileName)).digest('hex'),declaration:f.isDeclarationFile}));
fs.writeSync(1,JSON.stringify({case:'actual-overlay-scoped-typecheck',node:process.version,typescript:ts.version,roots,originalOptions,options,packages,sources,diagnostics,exit:diagnostics.length?1:0})+'\n');
process.exit(diagnostics.length?1:0);
