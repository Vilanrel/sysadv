/* Valida sintaxe TypeScript/TSX e politica/HTTP sem rede, banco ou dependencias npm. */
const fs=require('node:fs');const path=require('node:path');const os=require('node:os');
let ts; try {ts=require('typescript');} catch {ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript');} // fallback apenas do ambiente de geração
const root=path.resolve(__dirname,'..');const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sysadv-judicial-offline-'));
let passed=0,failed=0;
function test(name,callback){try{callback();passed++;console.log('PASS',name);}catch(e){failed++;console.error('FAIL',name,e.message);}}
function assert(v,msg='failed assertion'){if(!v)throw new Error(msg)}
function filesRec(p){return fs.readdirSync(p,{withFileTypes:true}).flatMap(x=>x.isDirectory()?filesRec(path.join(p,x.name)):[path.join(p,x.name)]);}
const all=filesRec(path.join(root,'apps')).filter(f=>/\.tsx?$/.test(f));
for(const file of all){const src=fs.readFileSync(file,'utf8');const ast=ts.createSourceFile(file,src,ts.ScriptTarget.ES2022,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);const errors=ast.parseDiagnostics.filter(d=>d.category===ts.DiagnosticCategory.Error);test(`Syntax ${path.relative(root,file)}`,()=>assert(errors.length===0,errors.map(e=>ts.flattenDiagnosticMessageText(e.messageText,' ')).join('; ')));}
const source=path.join(root,'apps/api/src/modules/judicial-integrations');
for(const base of ['catalog','tribunals','policy','http']){
 const contents=fs.readFileSync(path.join(source,base+'.ts'),'utf8');
 const out=ts.transpileModule(contents,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 fs.writeFileSync(path.join(dir,base+'.js'),out);
}
const catalog=require(path.join(dir,'catalog.js'));const tribunal=require(path.join(dir,'tribunals.js'));const policy=require(path.join(dir,'policy.js'));const http=require(path.join(dir,'http.js'));
const expectThrows=(cb,code)=>{let thrown;try{cb();}catch(e){thrown=e}assert(thrown?.message===code,`expected ${code}; received ${thrown?.message}`)};
test('27 tribunals and 15 named sources',()=>assert(tribunal.STATE_COURTS.length===27&&catalog.JUDICIAL_SOURCES.length===15));
test('DataJud disabled by default',()=>{delete process.env.JUDICIAL_DATAJUD_NONCOMMERCIAL_ENABLED;expectThrows(()=>policy.assertDataJudLegalGate(),'DATAJUD_POLICY_BLOCKED');});
test('commercial DataJud purpose rejected even if backend flag is on',()=>{process.env.JUDICIAL_DATAJUD_NONCOMMERCIAL_ENABLED='true';expectThrows(()=>policy.canActivateJudicialSource('DATAJUD','COMMERCIAL','ref-approval-123','Legal-Basis-123',{}),'DATAJUD_PURPOSE_NOT_AUTHORIZED');delete process.env.JUDICIAL_DATAJUD_NONCOMMERCIAL_ENABLED;});
test('DJEN blocked until verified contract',()=>{delete process.env.JUDICIAL_DJEN_CONTRACT_VALIDATED;expectThrows(()=>policy.canActivateJudicialSource('DJEN','authorized monitoring','ref-approval-123','Legal-Basis-123',{itemsPath:'items',totalPath:'totalPages'}),'DJEN_CONTRACT_NOT_VALIDATED');});
test('No institutional source can be activated as a public connector',()=>expectThrows(()=>policy.canActivateJudicialSource('DOMICILIO','monitoring','ref-123456','legal-123456',{}),'CONNECTOR_NOT_IMPLEMENTED'));
test('Unreviewed connection cannot be used for requests',()=>expectThrows(()=>policy.requireReadyConnection({sourceCode:'TJDFT_JURISDF',status:'PENDING',termsAccepted:false,purpose:'research'},'searchDecisions'),'CONNECTION_NOT_HOMOLOGATED'));
test('Only explicit capabilities allowed',()=>expectThrows(()=>policy.requireReadyConnection({sourceCode:'TJDFT_JURISDF',status:'READY',termsAccepted:true,contractHash:'hash',contractVerifiedAt:new Date(),purpose:'research'},'acknowledge'),'JUDICIAL_ACT_NOT_IMPLEMENTED'));
test('Approved HTTPS host path only',()=>{assert(http.safeJudicialUrl('DJEN','/api/v1/comunicacao').origin==='https://comunicaapi.pje.jus.br');expectThrows(()=>http.safeJudicialUrl('DJEN','//attacker.tld/a'),'JUDICIAL_HOST_NOT_APPROVED');expectThrows(()=>http.safeJudicialUrl('DJEN','https://evil.test'),'JUDICIAL_HOST_NOT_APPROVED');});
test('Retry-After honors numeric limits',()=>assert(http.parseRetryAfter('9')===9&&http.parseRetryAfter('50000')===3600));
(async()=>{
 async function asyncTest(name,run){try{await run();passed++;console.log('PASS',name)}catch(e){failed++;console.error('FAIL',name,e.message)}}
 await asyncTest('JSON HTTP validates and returns data',async()=>{let url,opts;const out=await http.requestJudicialJson('TJDFT_JURISDF','/api/v1/pesquisa',{method:'POST'},async(u,o)=>{url=u;opts=o;return new Response('{"hits":2}',{headers:{'content-type':'application/json'}})});assert(out.hits===2&&url.startsWith('https://jurisdf.tjdft.jus.br')&&opts.redirect==='manual');});
 await asyncTest('HTML 200 rejected',async()=>{let e;try{await http.requestJudicialJson('DJEN','/api/v1/comunicacao',{},async()=>new Response('<html>login</html>',{headers:{'content-type':'text/html'}}))}catch(err){e=err}assert(e?.code==='JUDICIAL_NON_JSON_RESPONSE');});
 await asyncTest('429 produces bounded retry-after',async()=>{let e;try{await http.requestJudicialJson('DJEN','/api/v1/comunicacao',{},async()=>new Response('error',{status:429,headers:{'retry-after':'4'}}))}catch(err){e=err}assert(e?.code==='JUDICIAL_HTTP_429'&&e.retryAfterSeconds===4);});
 await asyncTest('Redirection rejected',async()=>{let e;try{await http.requestJudicialJson('STJ_CKAN','/api/3/action/package_search',{},async()=>new Response('',{status:302,headers:{location:'https://127.0.0.1'}}))}catch(err){e=err}assert(e?.code==='JUDICIAL_REDIRECT_BLOCKED');});
 await asyncTest('Oversized response rejected',async()=>{let e;try{await http.requestJudicialJson('STJ_CKAN','/api/3/action/package_search',{},async()=>new Response('x'.repeat(2000001),{headers:{'content-type':'application/json'}}))}catch(err){e=err}assert(e?.code==='JUDICIAL_PAYLOAD_TOO_LARGE');});
 fs.rmSync(dir,{recursive:true,force:true});
 console.log(`\nOffline QA: ${passed} passed; ${failed} failed. No DB, external request or production cred used.`);
 process.exitCode=failed?1:0;
})();
