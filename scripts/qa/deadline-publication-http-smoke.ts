import assert from 'node:assert/strict';
import {PrismaClient} from '@prisma/client';
import {buildApp} from '../../apps/api/src/app.js';
import {hashPassword} from '../../apps/api/src/modules/auth/password.js';

/** Disposable-DB authenticated HTTP acceptance for judicial publication -> deadline review. */
const databaseUrl=process.env.DATABASE_URL;
let dbName='';
try{dbName=new URL(databaseUrl??'').pathname.slice(1);}catch{}
if(process.env.NODE_ENV!=='test'
  ||process.env.SYSADV_ALLOW_QA_DATA_WRITES!=='true'
  ||dbName!=='sysadv_qa')throw new Error('QA_DATABASE_ONLY');
const prisma=new PrismaClient();
const prefix='deadline-publication-qa-'+Date.now()+'-'+process.pid;
const a=prefix+'-a',b=prefix+'-b';
let app:Awaited<ReturnType<typeof buildApp>>|undefined;
const createdPermissions:string[]=[];
try{
  await prisma.organization.createMany({data:[{id:a,name:'QA Court A'},{id:b,name:'QA Court B'}]});
  for(const code of ['calendar.read','publication.read']){
    if(!await prisma.permission.findUnique({where:{code}})){
      await prisma.permission.create({data:{code,description:'Disposable QA'}});createdPermissions.push(code);
    }
  }
  const grants=await prisma.permission.findMany({where:{code:{in:['calendar.read','publication.read']}}});
  const roleA=await prisma.role.create({data:{organizationId:a,code:'QA_COURT_A',name:'QA Court A'}});
  const roleB=await prisma.role.create({data:{organizationId:b,code:'QA_COURT_B',name:'QA Court B'}});
  await prisma.rolePermission.createMany({data:[
    ...grants.map(g=>({roleId:roleA.id,permissionId:g.id})),
    ...grants.filter(g=>g.code==='calendar.read').map(g=>({roleId:roleB.id,permissionId:g.id})),
  ]});
  const passwordHash=await hashPassword('Only-A-Synthetic-QA-Password-123!');
  const userA=await prisma.user.create({data:{
    organizationId:a,email:prefix+'-a@example.invalid',name:'QA Court Reader A',passwordHash,
  }});
  const userB=await prisma.user.create({data:{
    organizationId:b,email:prefix+'-b@example.invalid',name:'QA Court Reader B',passwordHash,
  }});
  await prisma.userRole.createMany({data:[
    {userId:userA.id,roleId:roleA.id},{userId:userB.id,roleId:roleB.id},
  ]});
  const npu='10515285720248260053';
  const processA=await prisma.legalProcess.create({data:{organizationId:a,npu}});
  const processB=await prisma.legalProcess.create({data:{organizationId:b,npu}});
  const linked=await prisma.officialPublication.create({data:{
    organizationId:a,processId:processA.id,npu,actType:'PUBLICACAO_SINTETICA',
    fingerprint:prefix+'-linked',content:'Fixture sem dados reais',
    title:'Comunicacao judicial simulada',tribunal:'TJSP',
    availableAt:new Date('2026-11-18T00:00:00Z'),
    publishedAt:new Date('2026-11-19T00:00:00Z'),
    sourceUrl:'https://example.invalid/publication',
    rawMetadata:{confidentialFixture:'must-not-leak'},
  }});
  await prisma.officialPublication.create({data:{
    organizationId:a,processId:null,npu,actType:'UNLINKED',
    fingerprint:prefix+'-unlinked',content:'Nao deve aparecer',
  }});
  await prisma.officialPublication.create({data:{
    organizationId:b,processId:processB.id,npu,actType:'OTHER_TENANT',
    fingerprint:prefix+'-other',content:'Nao deve aparecer',
  }});
  app=await buildApp();await app.ready();
  const tokenA=app.jwt.sign({sub:userA.id,organizationId:a});
  const tokenB=app.jwt.sign({sub:userB.id,organizationId:b});
  const path='/api/deadlines/publications?processId='+encodeURIComponent(processA.id);
  const anon=await app.inject({method:'GET',url:path});
  assert.equal(anon.statusCode,401);
  const own=await app.inject({method:'GET',url:path,headers:{authorization:'Bearer '+tokenA}});
  assert.equal(own.statusCode,200,own.body);
  const body=own.json();
  assert.equal(body.process.id,processA.id);
  assert.equal(body.items.length,1,'Unlinked or cross-tenant publication incorrectly returned');
  assert.equal(body.items[0].id,linked.id);
  assert.equal(body.items[0].availableOn,'2026-11-18');
  assert.equal(body.items[0].publishedOn,'2026-11-19');
  assert.equal(body.requiresHumanReview,true);
  assert.equal(body.automaticDeadlineCreation,false);
  assert.equal(body.items[0].content,undefined);
  assert.equal(body.items[0].rawMetadata,undefined);
  assert.ok(!own.body.includes('must-not-leak'));
  const missing=await app.inject({method:'GET',
    url:'/api/deadlines/publications?processId=nonexistent',
    headers:{authorization:'Bearer '+tokenA}});
  assert.equal(missing.statusCode,404);
  const foreign=await app.inject({method:'GET',url:path,
    headers:{authorization:'Bearer '+tokenB}});
  assert.equal(foreign.statusCode,403,'No publication.read must not see foreign data');
  const invalid=await app.inject({method:'GET',url:'/api/deadlines/publications',
    headers:{authorization:'Bearer '+tokenA}});
  assert.equal(invalid.statusCode,400);
  const allowedButForeign=app.jwt.sign({sub:userA.id,organizationId:b});
  const forged=await app.inject({method:'GET',url:path,headers:{authorization:'Bearer '+allowedButForeign}});
  assert.equal(forged.statusCode,401,'Cross-organization forged JWT must be rejected');
  const deadlineCount=await prisma.deadlineCase.count({where:{organizationId:a}});
  assert.equal(deadlineCount,0,'Read-only judicial reference must never create a deadline');
  console.log(JSON.stringify({
    ok:true,authenticated:true,permissions:true,tenantIsolation:true,
    linkedOnly:true,civilDatesPreserved:true,noContentLeak:true,
    noAutomaticDeadlineCreation:true,sourceRequests:0,
  }));
}finally{
  await app?.close();
  try{
    await prisma.officialPublication.deleteMany({where:{organizationId:{in:[a,b]}}});
    await prisma.legalProcess.deleteMany({where:{organizationId:{in:[a,b]}}});
    await prisma.session.deleteMany({where:{user:{organizationId:{in:[a,b]}}}});
    await prisma.userRole.deleteMany({where:{user:{organizationId:{in:[a,b]}}}});
    await prisma.rolePermission.deleteMany({where:{role:{organizationId:{in:[a,b]}}}});
    await prisma.role.deleteMany({where:{organizationId:{in:[a,b]}}});
    await prisma.user.deleteMany({where:{organizationId:{in:[a,b]}}});
    await prisma.organization.deleteMany({where:{id:{in:[a,b]}}});
    await prisma.permission.deleteMany({where:{code:{in:createdPermissions}}});
  }finally{await prisma.$disconnect();}
}
