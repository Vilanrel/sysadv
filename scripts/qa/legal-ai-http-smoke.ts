import assert from 'node:assert/strict';
import {PrismaClient} from '@prisma/client';
import {buildApp} from '../../apps/api/src/app.js';
import {hashPassword} from '../../apps/api/src/modules/auth/password.js';

/**
 * Authenticated HTTP test of the legal AI configuration and drafting workflow.
 * NEVER uses real customer accounts, production data, or the real OpenAI API.
 */
const url=new URL(process.env.DATABASE_URL??'');
if(process.env.NODE_ENV!=='test'
  ||process.env.SYSADV_ALLOW_QA_DATA_WRITES!=='true'
  ||!url.pathname.endsWith('/sysadv_qa')) {
  throw new Error('QA_DATABASE_ONLY: ephemeral PostgreSQL database sysadv_qa required');
}

const prisma=new PrismaClient();
const stamp='legal-ai-http-qa-'+Date.now()+'-'+process.pid;
const orgA=stamp+'-a';
const orgB=stamp+'-b';
const secret='sk-SYNTHETIC-NOT-A-REAL-OPENAI-KEY-'+process.pid;
const password='Only-For-Disposable-QA-123!';
const originalFetch=globalThis.fetch;
let app:Awaited<ReturnType<typeof buildApp>>|undefined;
let mockedCalls: {url:string;method:string;body?:string}[]=[];
let createdPermissions:string[]=[];
const permissions=['settings.read','settings.manage','document.generate'];
const validDraft={
  action:'DRAFT',
  approvedForExternalProvider:true,
  practiceArea:'Direito Civil',
  instructions:'Elaborar uma minuta sintetica com base nos fatos estritamente ficticios do teste.',
  referenceText:'Caso puramente sintetico para validacao automatizada. Sem dados pessoais reais.',
};

function responseNoSecret(content:unknown){
  assert.equal(JSON.stringify(content).includes(secret),false,'API response leaked plaintext key');
}
function requestHeaders(token:string){return {authorization:'Bearer '+token};}
function safeJson(res:{json:()=>unknown,body:string}) {
  const body=res.json();responseNoSecret(body);return body as Record<string,any>;
}

try{
  await prisma.organization.createMany({data:[
    {id:orgA,name:'QA AI Office A'},
    {id:orgB,name:'QA AI Office B'},
  ]});

  for(const code of permissions){
    const row=await prisma.permission.findUnique({where:{code}});
    if(!row){
      await prisma.permission.create({data:{code,description:'Automated QA only'}});
      createdPermissions.push(code);
    }
  }
  const grants=await prisma.permission.findMany({where:{code:{in:permissions}}});
  const adminRole=await prisma.role.create({data:{organizationId:orgA,code:'QA_AI_ADMIN',name:'QA AI administrator'}});
  const viewerRole=await prisma.role.create({data:{organizationId:orgB,code:'QA_AI_VIEWER',name:'QA AI read-only'}});
  await prisma.rolePermission.createMany({data:[
    ...grants.map(p=>({roleId:adminRole.id,permissionId:p.id})),
    ...grants.filter(p=>p.code==='settings.read').map(p=>({roleId:viewerRole.id,permissionId:p.id})),
  ]});
  const passwordHash=await hashPassword(password);
  const admin=await prisma.user.create({data:{
    organizationId:orgA,name:'QA Administrator',
    email:stamp+'-admin@example.invalid',passwordHash,
  }});
  const viewer=await prisma.user.create({data:{
    organizationId:orgB,name:'QA Read-Only',
    email:stamp+'-viewer@example.invalid',passwordHash,
  }});
  await prisma.userRole.createMany({data:[
    {userId:admin.id,roleId:adminRole.id},
    {userId:viewer.id,roleId:viewerRole.id},
  ]});

  app=await buildApp();
  await app.ready();

  const unauth=await app.inject({method:'GET',url:'/api/office/legal-ai'});
  assert.equal(unauth.statusCode,401);

  const invalidLogin=await app.inject({method:'POST',url:'/api/auth/login',
    payload:{email:admin.email,password:'incorrect-synthetic-password'}});
  assert.equal(invalidLogin.statusCode,401);
  responseNoSecret(invalidLogin.json());

  const login=await app.inject({method:'POST',url:'/api/auth/login',
    payload:{email:admin.email,password}});
  assert.equal(login.statusCode,200,login.body);
  const token=safeJson(login).accessToken as string;
  assert.ok(token);

  const whoami=await app.inject({method:'GET',url:'/api/auth/me',
    headers:requestHeaders(token)});
  assert.equal(whoami.statusCode,200);
  assert.equal(safeJson(whoami).organization.id,orgA);

  const before=await app.inject({method:'GET',url:'/api/office/legal-ai',
    headers:requestHeaders(token)});
  assert.equal(before.statusCode,200);
  assert.equal(safeJson(before).keyConfigured,false);

  const notReady=await app.inject({method:'PATCH',url:'/api/office/legal-ai',
    headers:requestHeaders(token),payload:{enabled:true,model:'gpt-4.1-mini'}});
  assert.equal(notReady.statusCode,400);
  assert.equal(safeJson(notReady).error,'LEGAL_AI_KEY_REQUIRED');

  const saved=await app.inject({method:'PATCH',url:'/api/office/legal-ai',
    headers:requestHeaders(token),
    payload:{enabled:false,model:'gpt-4.1-mini',apiKey:secret}});
  assert.equal(saved.statusCode,200,saved.body);
  assert.equal(safeJson(saved).keyConfigured,true);
  const raw=await prisma.legalAiSettings.findUniqueOrThrow({where:{organizationId:orgA}});
  assert.ok(raw.encryptedApiKey?.startsWith('v1.'));
  assert.equal(raw.encryptedApiKey?.includes(secret),false);

  let aiStatus=await app.inject({method:'GET',url:'/api/legal-ai/status',
    headers:requestHeaders(token)});
  assert.equal(aiStatus.statusCode,200,aiStatus.body);
  assert.equal(safeJson(aiStatus).enabled,false);

  const disabled=await app.inject({method:'POST',url:'/api/legal-ai/drafts',
    headers:requestHeaders(token),payload:validDraft});
  assert.equal(disabled.statusCode,503);
  assert.equal(safeJson(disabled).error,'LEGAL_AI_NOT_CONFIGURED');

  // Intercept every provider call; the test process cannot access a real OpenAI service.
  globalThis.fetch=(async(input:any,init?:RequestInit)=>{
    const target=String(input);
    assert.ok(target.startsWith('https://api.openai.com/v1/'),'Unexpected external request');
    const method=init?.method??'GET';
    const auth=new Headers(init?.headers).get('Authorization');
    assert.equal(auth,'Bearer '+secret);
    mockedCalls.push({url:target,method,body:init?.body?.toString()});
    if(target.endsWith('/models/gpt-4.1-mini')){
      return new Response(JSON.stringify({id:'gpt-4.1-mini',object:'model'}),
        {status:200,headers:{'content-type':'application/json'}});
    }
    if(target.endsWith('/chat/completions')){
      return new Response(JSON.stringify({choices:[{
        message:{content:'RASCUNHO FICTICIO PARA REVISAO HUMANA\nPENDENCIAS DE CONFERENCIA'}
      }]}),{status:200,headers:{'content-type':'application/json'}});
    }
    throw new Error('Provider endpoint not approved for QA');
  }) as typeof fetch;

  const testConnection=await app.inject({method:'POST',url:'/api/office/legal-ai/test',
    headers:requestHeaders(token)});
  assert.equal(testConnection.statusCode,200,testConnection.body);
  assert.equal(safeJson(testConnection).connected,true);
  assert.equal(mockedCalls.length,1,'Test connection did not contact mocked provider once');

  const enabled=await app.inject({method:'PATCH',url:'/api/office/legal-ai',
    headers:requestHeaders(token),payload:{enabled:true,model:'gpt-4.1-mini'}});
  assert.equal(enabled.statusCode,200,enabled.body);
  assert.equal(safeJson(enabled).enabled,true);

  aiStatus=await app.inject({method:'GET',url:'/api/legal-ai/status',
    headers:requestHeaders(token)});
  assert.equal(aiStatus.statusCode,200);
  assert.equal(safeJson(aiStatus).enabled,true);

  const deniedConsent=await app.inject({method:'POST',url:'/api/legal-ai/drafts',
    headers:requestHeaders(token),payload:{...validDraft,approvedForExternalProvider:false}});
  assert.equal(deniedConsent.statusCode,400);
  assert.equal(mockedCalls.length,1,'Input without consent must never be sent to provider');

  const drafted=await app.inject({method:'POST',url:'/api/legal-ai/drafts',
    headers:requestHeaders(token),payload:validDraft});
  assert.equal(drafted.statusCode,200,drafted.body);
  const draft=safeJson(drafted);
  assert.equal(draft.requiresHumanReview,true);
  assert.equal(draft.sourceVerificationRequired,true);
  assert.equal(draft.stored,false);
  assert.match(draft.draft,/PENDENCIAS DE CONFERENCIA/);
  assert.equal(mockedCalls.length,2);
  const sent=JSON.parse(mockedCalls[1].body??'{}');
  assert.equal(sent.model,'gpt-4.1-mini');
  assert.equal(sent.messages[0].role,'system');
  assert.match(sent.messages[0].content,/Nao invente leis/);
  assert.match(sent.messages[1].content,/Caso puramente sintetico/);

  const viewerLogin=await app.inject({method:'POST',url:'/api/auth/login',
    payload:{email:viewer.email,password}});
  assert.equal(viewerLogin.statusCode,200,viewerLogin.body);
  const viewerToken=safeJson(viewerLogin).accessToken as string;
  const viewerSettings=await app.inject({method:'GET',url:'/api/office/legal-ai',
    headers:requestHeaders(viewerToken)});
  assert.equal(viewerSettings.statusCode,200);
  assert.equal(safeJson(viewerSettings).keyConfigured,false);
  const forbiddenEdit=await app.inject({method:'PATCH',url:'/api/office/legal-ai',
    headers:requestHeaders(viewerToken),
    payload:{enabled:true,model:'gpt-4.1-mini',apiKey:secret}});
  assert.equal(forbiddenEdit.statusCode,403);
  responseNoSecret(forbiddenEdit.json());
  const forbiddenTest=await app.inject({method:'POST',url:'/api/office/legal-ai/test',
    headers:requestHeaders(viewerToken)});
  assert.equal(forbiddenTest.statusCode,403);
  const forbiddenDraft=await app.inject({method:'POST',url:'/api/legal-ai/drafts',
    headers:requestHeaders(viewerToken),payload:validDraft});
  assert.equal(forbiddenDraft.statusCode,403);
  assert.equal(mockedCalls.length,2);

  const audits=await prisma.auditEvent.findMany({
    where:{organizationId:orgA,action:'LEGAL_AI_SETTINGS_UPDATED'}});
  assert.ok(audits.length>=2);
  assert.equal(JSON.stringify(audits).includes(secret),false);
  assert.equal(JSON.stringify(audits).includes(raw.encryptedApiKey??''),false);

  const revoked=await app.inject({method:'PATCH',url:'/api/office/legal-ai',
    headers:requestHeaders(token),
    payload:{enabled:false,model:'gpt-4.1-mini',clearApiKey:true}});
  assert.equal(revoked.statusCode,200,revoked.body);
  assert.equal(safeJson(revoked).keyConfigured,false);
  assert.equal((await prisma.legalAiSettings.findUniqueOrThrow({
    where:{organizationId:orgA}})).encryptedApiKey,null);

  console.log(JSON.stringify({
    ok:true,
    authenticatedLogin:true,
    officeScoped:true,
    administratorOnly:true,
    settingsAuditedWithoutSecrets:true,
    encryptedKey:true,
    providerMocked:true,
    connectionTestWhileDisabled:true,
    explicitConsentRequired:true,
    humanReviewRequired:true,
    keyRevocation:true,
    externalNetworkCalls:0,
  }));
}finally{
  globalThis.fetch=originalFetch;
  await app?.close();
  // Explicit cleanup, in FK-safe order and limited to this synthetic QA prefix.
  try{
    await prisma.auditEvent.deleteMany({where:{organizationId:{in:[orgA,orgB]}}});
    await prisma.legalAiSettings.deleteMany({where:{organizationId:{in:[orgA,orgB]}}});
    await prisma.session.deleteMany({where:{user:{organizationId:{in:[orgA,orgB]}}}});
    await prisma.userRole.deleteMany({where:{user:{organizationId:{in:[orgA,orgB]}}}});
    await prisma.rolePermission.deleteMany({where:{role:{organizationId:{in:[orgA,orgB]}}}});
    await prisma.role.deleteMany({where:{organizationId:{in:[orgA,orgB]}}});
    await prisma.user.deleteMany({where:{organizationId:{in:[orgA,orgB]}}});
    await prisma.organization.deleteMany({where:{id:{in:[orgA,orgB]}}});
    await prisma.permission.deleteMany({where:{code:{in:createdPermissions}}});
  }finally{
    await prisma.$disconnect();
  }
}
