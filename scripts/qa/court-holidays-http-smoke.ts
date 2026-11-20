import assert from 'node:assert/strict';
import {PrismaClient} from '@prisma/client';
import {buildApp} from '../../apps/api/src/app.js';
import {hashPassword} from '../../apps/api/src/modules/auth/password.js';

/** Authenticated integration smoke: court holiday scope, evidence, and recalculation. */
let dbName='';
try{dbName=new URL(process.env.DATABASE_URL??'').pathname.slice(1);}catch{}
if(process.env.NODE_ENV!=='test'
  ||process.env.SYSADV_ALLOW_QA_DATA_WRITES!=='true'
  ||dbName!=='sysadv_qa')throw new Error('QA_DATABASE_ONLY');
const prisma=new PrismaClient();
const prefix='holiday-qa-'+Date.now()+'-'+process.pid;
const a=prefix+'-a',b=prefix+'-b';
const sourceUrl='https://example.invalid/calendario-judicial-ficticio';
const evidence='Portaria inteiramente ficticia utilizada apenas para testes automatizados.';
const createdPermissions:string[]=[];
let app:Awaited<ReturnType<typeof buildApp>>|undefined;
const body={
  scope:'CITY',name:'Feriado judicial ficticio',date:'2026-11-23',
  state:'SP',tribunalCode:'TJSP',city:'Sao Paulo',sourceUrl,evidence,
};
const previewBody={
  ruleCode:'CIVIL_CONTESTACAO',processId:null,
  anchorDate:'2026-11-20',
  anchorEvidence:'Marco juridico inteiramente ficticio, validado apenas para QA.',
  tribunalCode:'TJSP',state:'SP',city:'Sao Paulo',
  fileFormat:'ELECTRONIC',doubleBasis:'NONE',
  internalBusinessDays:2,natureConfirmation:'PROCESSUAL',natureAcknowledged:true,
};
try{
  await prisma.organization.createMany({data:[{id:a,name:'QA Holiday A'},{id:b,name:'QA Holiday B'}]});
  for(const code of ['calendar.read','calendar.manage']){
    if(!await prisma.permission.findUnique({where:{code}})){
      await prisma.permission.create({data:{code,description:'Holiday QA only'}});
      createdPermissions.push(code);
    }
  }
  const permissions=await prisma.permission.findMany({
    where:{code:{in:['calendar.read','calendar.manage']}},
  });
  const roleA=await prisma.role.create({data:{organizationId:a,code:'QA_CAL_ADMIN_A',name:'QA Holiday manager A'}});
  const roleB=await prisma.role.create({data:{organizationId:b,code:'QA_CAL_ADMIN_B',name:'QA Holiday manager B'}});
  const readerB=await prisma.role.create({data:{organizationId:b,code:'QA_CAL_READ_B',name:'QA Holiday reader B'}});
  await prisma.rolePermission.createMany({data:[
    ...permissions.map(p=>({roleId:roleA.id,permissionId:p.id})),
    ...permissions.map(p=>({roleId:roleB.id,permissionId:p.id})),
    ...permissions.filter(p=>p.code==='calendar.read').map(p=>({roleId:readerB.id,permissionId:p.id})),
  ]});
  const password='Only-for-QA-synthetic-calendar-123!';
  const passwordHash=await hashPassword(password);
  const managerA=await prisma.user.create({data:{
    organizationId:a,email:prefix+'-a@example.invalid',name:'QA Holiday manager A',passwordHash,
  }});
  const managerB=await prisma.user.create({data:{
    organizationId:b,email:prefix+'-b@example.invalid',name:'QA Holiday manager B',passwordHash,
  }});
  const reader=await prisma.user.create({data:{
    organizationId:b,email:prefix+'-reader@example.invalid',name:'QA Holiday reader B',passwordHash,
  }});
  await prisma.userRole.createMany({data:[
    {userId:managerA.id,roleId:roleA.id},
    {userId:managerB.id,roleId:roleB.id},
    {userId:reader.id,roleId:readerB.id},
  ]});
  app=await buildApp();
  await app.ready();

  async function login(email:string){
    const response=await app!.inject({method:'POST',url:'/api/auth/login',
      payload:{email,password}});
    assert.equal(response.statusCode,200,response.body);
    return {authorization:'Bearer '+String(response.json().accessToken)};
  }
  const headersA=await login(managerA.email);
  const headersB=await login(managerB.email);
  const headersRead=await login(reader.email);
  const getPreview=async(city='Sao Paulo',headers=headersA)=>{
    const response=await app!.inject({method:'POST',url:'/api/deadlines/preview',
      headers,payload:{...previewBody,city}});
    assert.equal(response.statusCode,200,response.body);
    return response.json().preview as {dueDate:string;internalDate:string};
  };
  const before=await getPreview();
  assert.equal(before.dueDate,'2026-12-11');
  const unauth=await app.inject({method:'GET',url:'/api/deadlines/holidays?year=2026'});
  assert.equal(unauth.statusCode,401);
  const invalid=await app.inject({method:'POST',url:'/api/deadlines/holidays',
    headers:headersA,payload:{...body,scope:'NATIONAL'}});
  assert.equal(invalid.statusCode,400);
  const noSource=await app.inject({method:'POST',url:'/api/deadlines/holidays',
    headers:headersA,payload:{...body,sourceUrl:'http://example.invalid'}});
  assert.equal(noSource.statusCode,400);
  const forbidden=await app.inject({method:'POST',url:'/api/deadlines/holidays',
    headers:headersRead,payload:body});
  assert.equal(forbidden.statusCode,403);
  const created=await app.inject({method:'POST',url:'/api/deadlines/holidays',
    headers:headersA,payload:body});
  assert.equal(created.statusCode,201,created.body);
  const holidayId=String(created.json().id);
  const row=await prisma.courtHoliday.findFirstOrThrow({where:{id:holidayId,organizationId:a}});
  assert.equal(row.city,'SAO PAULO');
  assert.equal(row.active,true);
  assert.deepEqual(JSON.parse(row.notes??''),{scope:'CITY',sourceUrl,evidence});

  const duplicated=await app.inject({method:'POST',url:'/api/deadlines/holidays',
    headers:headersA,payload:body});
  assert.equal(duplicated.statusCode,409);
  assert.equal(duplicated.json().error,'HOLIDAY_ALREADY_EXISTS');

  const listA=await app.inject({method:'GET',url:'/api/deadlines/holidays?year=2026',
    headers:headersA});
  assert.equal(listA.statusCode,200,listA.body);
  assert.equal(listA.json().items.length,1);
  assert.equal(listA.json().items[0].date,'2026-11-23');
  const otherYear=await app.inject({method:'GET',url:'/api/deadlines/holidays?year=2027',
    headers:headersA});
  assert.equal(otherYear.statusCode,200);
  assert.equal(otherYear.json().items.length,0);
  const listB=await app.inject({method:'GET',url:'/api/deadlines/holidays?year=2026',
    headers:headersB});
  assert.equal(listB.statusCode,200);
  assert.equal(listB.json().items.length,0);

  const changed=await getPreview();
  assert.equal(changed.dueDate,'2026-12-14');
  const otherCity=await getPreview('Campinas');
  assert.equal(otherCity.dueDate,before.dueDate,'City holiday leaked to another municipality');
  const otherTenant=await getPreview('Sao Paulo',headersB);
  assert.equal(otherTenant.dueDate,before.dueDate,'Holiday leaked to another organization');

  const foreignDeactivate=await app.inject({method:'POST',
    url:'/api/deadlines/holidays/'+holidayId+'/deactivate',
    headers:headersB,payload:{reason:'Nao autorizado para este escritorio.'}});
  assert.equal(foreignDeactivate.statusCode,404);
  const forbiddenDeactivate=await app.inject({method:'POST',
    url:'/api/deadlines/holidays/'+holidayId+'/deactivate',
    headers:headersRead,payload:{reason:'Sem permissao para alterar este feriado.'}});
  assert.equal(forbiddenDeactivate.statusCode,403);
  const deactivate=await app.inject({method:'POST',
    url:'/api/deadlines/holidays/'+holidayId+'/deactivate',
    headers:headersA,payload:{reason:'Revisao: fonte inicial estava incorreta; fixture QA.'}});
  assert.equal(deactivate.statusCode,200,deactivate.body);
  assert.equal(deactivate.json().active,false);
  const restored=await getPreview();
  assert.equal(restored.dueDate,before.dueDate);
  const again=await app.inject({method:'POST',
    url:'/api/deadlines/holidays/'+holidayId+'/deactivate',
    headers:headersA,payload:{reason:'Segunda tentativa de desativacao QA.'}});
  assert.equal(again.statusCode,409);
  const persisted=await prisma.courtHoliday.findUniqueOrThrow({where:{id:holidayId}});
  assert.equal(persisted.active,false);
  const audited=await prisma.auditEvent.findMany({where:{
    organizationId:a,entityType:'CourtHoliday',entityId:holidayId,
  }});
  assert.equal(audited.filter(x=>x.action==='DEADLINE_HOLIDAY_CREATED').length,1);
  assert.equal(audited.filter(x=>x.action==='DEADLINE_HOLIDAY_DEACTIVATED').length,1);
  assert.equal(await prisma.deadlineCase.count({where:{organizationId:a}}),0);
  console.log(JSON.stringify({
    ok:true,authenticated:true,managerOnly:true,tenantIsolation:true,
    scopeValidation:true,sourceRequired:true,civilDatePreserved:true,
    previewRecalculates:true,deactivationAudited:true,
    noAutomaticDeadlineCreation:true,externalCalls:0,
  }));
}finally{
  await app?.close();
  try{
    await prisma.auditEvent.deleteMany({where:{organizationId:{in:[a,b]}}});
    await prisma.courtHoliday.deleteMany({where:{organizationId:{in:[a,b]}}});
    await prisma.session.deleteMany({where:{user:{organizationId:{in:[a,b]}}}});
    await prisma.userRole.deleteMany({where:{user:{organizationId:{in:[a,b]}}}});
    await prisma.rolePermission.deleteMany({where:{role:{organizationId:{in:[a,b]}}}});
    await prisma.role.deleteMany({where:{organizationId:{in:[a,b]}}});
    await prisma.user.deleteMany({where:{organizationId:{in:[a,b]}}});
    await prisma.organization.deleteMany({where:{id:{in:[a,b]}}});
    await prisma.permission.deleteMany({where:{code:{in:createdPermissions}}});
  }finally{
    await prisma.$disconnect();
  }
}
