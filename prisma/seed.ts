import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();
const permissions = [
  'process.read','process.create','process.update','document.upload','document.read',
  'parameter.validate','audit.read','user.manage','source.manage','publication.read','publication.sync',
  'document.template.read','document.template.manage','document.generate',
  'person.read','person.create','person.update','task.read','task.write','task.manage','calendar.read','calendar.write','calendar.manage',
  'intake.read','intake.write','finance.read','finance.manage','contract.read','contract.manage','timesheet.read','timesheet.write','timesheet.manage','report.read','settings.read','settings.manage'
];
const rolePermissions: Record<string, string[]> = {
  ADMIN: permissions,
  LAWYER: ['process.read','process.create','process.update','document.upload','document.read','parameter.validate','publication.read','publication.sync','document.template.read','document.template.manage','document.generate','person.read','person.create','person.update','task.read','task.write','task.manage','calendar.read','calendar.write','intake.read','intake.write','contract.read','timesheet.read','timesheet.write','report.read','settings.read'],
  CALCULATOR: ['process.read','process.update','document.read','parameter.validate','publication.read','document.template.read','document.generate','person.read','task.read','calendar.read','timesheet.read','timesheet.write','settings.read'],
  VIEWER: ['process.read','document.read','publication.read','document.template.read','task.read','calendar.read','settings.read']
};

async function main() {
  for (const code of permissions) {
    await prisma.permission.upsert({ where: { code }, update: {}, create: { code, description: code } });
  }
  const organization = await prisma.organization.upsert({
    where: { id: 'sysadv-default-org' },
    update: {},
    create: { id: 'sysadv-default-org', name: 'SysADV - Ambiente Inicial' }
  });
  for (const [code, codes] of Object.entries(rolePermissions)) {
    const role = await prisma.role.upsert({
      where: { organizationId_code: { organizationId: organization.id, code } },
      update: {},
      create: { organizationId: organization.id, code, name: code === 'ADMIN' ? 'Administrador' : code === 'LAWYER' ? 'Advogado' : code === 'CALCULATOR' ? 'Calculista' : 'Consulta' }
    });
    for (const permissionCode of codes) {
      const permission = await prisma.permission.findUniqueOrThrow({ where: { code: permissionCode } });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } }, update: {},
        create: { roleId: role.id, permissionId: permission.id }
      });
    }
  }
  // Atualizacoes preservam papeis atuais; ADMIN recebe os novos escopos em cada escritorio.
  const adminRoles = await prisma.role.findMany({where:{code:'ADMIN'}});
  const adminGrants = await prisma.permission.findMany({where:{code:{in:permissions}}});
  for(const role of adminRoles)for(const permission of adminGrants){
    await prisma.rolePermission.upsert({where:{roleId_permissionId:{roleId:role.id,permissionId:permission.id}},update:{},create:{roleId:role.id,permissionId:permission.id}});
  }
  // Nunca permitir senha de exemplo em ambiente real.
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? (process.env.NODE_ENV === 'production' ? '' : 'ChangeMe!123456');
  if (!adminPassword || adminPassword.length < 12) throw new Error('SEED_ADMIN_PASSWORD_REQUIRED: configure senha administrativa segura antes de migrar');
  const passwordHash = await argon2.hash(adminPassword, { type: argon2.argon2id });
  const admin = await prisma.user.upsert({
    where: { organizationId_email: { organizationId: organization.id, email: 'admin@sysadv.local' } },
    update: {},
    create: { organizationId: organization.id, email: 'admin@sysadv.local', name: 'Administrador SysADV', passwordHash }
  });
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { organizationId_code: { organizationId: organization.id, code: 'ADMIN' } } });
  await prisma.userRole.upsert({ where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } }, update: {}, create: { userId: admin.id, roleId: adminRole.id } });
  await prisma.dataSource.upsert({ where: { organizationId_code: { organizationId: organization.id, code: 'DATAJUD' } }, update: { name: 'DataJud (CNJ)', type: 'REST_API', environment: 'PRODUCTION', status: 'INACTIVE', priority: 1, baseUrl: 'https://api-publica.datajud.cnj.jus.br', authType: 'API_KEY' }, create: { organizationId: organization.id, code: 'DATAJUD', name: 'DataJud (CNJ)', type: 'REST_API', environment: 'PRODUCTION', status: 'INACTIVE', priority: 1, baseUrl: 'https://api-publica.datajud.cnj.jus.br', authType: 'API_KEY', description: 'API Pública do CNJ para capas e movimentações.', settings: { testPath: '/api_publica_tjsp/_search', testMethod: 'POST', testBody: { size: 0, query: { match_all: {} } }, apiKeyHeader: 'authorization', apiKeyPrefix: 'APIKey ' } } });
  for (const [code, name, priority] of [['DJEN','DJEN - Diário de Justiça Eletrônico Nacional',10],['PJE','PJe / Tribunais',20],['JURISPRUDENCE','Jurisprudência',30],['DOMICILIO','CNJ - Domicilio Judicial Eletronico',40]] as const) {
    await prisma.dataSource.upsert({ where: { organizationId_code: { organizationId: organization.id, code } }, update: {}, create: { organizationId: organization.id, code, name, type: 'REST_API', environment: 'PRODUCTION', status: 'INACTIVE', priority, authType: code === 'DOMICILIO' ? 'OAUTH2' : 'NONE', description: code === 'DOMICILIO' ? 'Exige credenciais oficiais e conector autorizado.' : 'Fonte cadastrada para configuracao e homologacao.' } });
  }
}

main().finally(() => prisma.$disconnect());
