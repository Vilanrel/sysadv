/** SysADV API + PostgreSQL homologation. NEVER run outside disposable sysadv QA database. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const url = process.env.QA_API_URL || 'http://127.0.0.1:3001';
const pwd = process.env.SEED_ADMIN_PASSWORD;
if (process.env.NODE_ENV !== 'test' || !process.env.DATABASE_URL?.includes('sysadv_qa') || !pwd) {
  throw new Error('QA_ONLY: banco e NODE_ENV devem pertencer a homologacao isolada');
}
const db = new PrismaClient();
const results = [];
let token;
const ids = {};
const headers = extra => ({ 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra });
async function request(path, { method = 'GET', body, extraHeaders = {}, auth = true } = {}) {
  const response = await fetch(`${url}/api${path}`, {
    method, headers: headers(auth ? extraHeaders : { ...extraHeaders }),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15000)
  });
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  let data = text;
  if (contentType.includes('json') && text) { try { data = JSON.parse(text); } catch { throw new Error(`Resposta JSON invalida na rota ${path}`); } }
  return { status: response.status, data, headers: response.headers, text };
}
async function check(name, fn) {
  try { await fn(); results.push({ name, status: 'PASS' }); console.log(`[OK] ${name}`); }
  catch (error) { results.push({ name, status: 'FAIL', reason: String(error?.message ?? error).slice(0,200) }); console.error(`[FALHA] ${name}: ${error?.message}`); }
}
try {
  await check('API health e versao', async () => {
    assert.equal((await request('/health')).status, 200);
    const v = await request('/system/version');
    assert.equal(v.status, 200); assert.equal(v.data.version, '2026110701');
  });
  await check('Leitura protegida sem sessao', async () => {
    const r = await request('/finance/entries', { auth: false }); assert.equal(r.status, 401);
  });
  await check('Login administrativo e permissoes', async () => {
    const r = await request('/auth/login', { method: 'POST', body: { email: 'admin@sysadv.local', password: pwd }, auth: false });
    assert.equal(r.status, 200, JSON.stringify(r.data)); assert.ok(r.data.accessToken);
    token = r.data.accessToken;
    const me = await request('/auth/me'); assert.equal(me.status, 200);
    for (const p of ['finance.manage','contract.manage','intake.write','timesheet.manage','report.read']) {
      assert.ok(me.data.permissionCodes.includes(p), `Permissao ausente: ${p}`);
    }
  });
  if (!token) throw new Error('LOGIN_FAILED: demais verificacoes nao podem prosseguir');
  await check('CRUD de pessoa e listagem', async () => {
    const r = await request('/people', { method: 'POST', body: { name: 'Cliente Ficticio Integracao QA', kind: 'INDIVIDUAL', roles: ['CLIENT'] } });
    assert.equal(r.status, 201, JSON.stringify(r.data)); ids.person = r.data.id;
    const list = await request('/people?q=Ficticio'); assert.equal(list.status, 200);
    assert.ok(list.data.items.some(x => x.id === ids.person));
  });
  if (!ids.person) throw new Error('CLIENT_FAILED: impedindo registros associados sem cliente');
  await check('Processo judicial ficticio e detalhes por API', async () => {
    const npu = `${String(Math.floor(Math.random() * 9999999)).padStart(7, '0')}-00.2026.8.26.0001`;
    const r = await request('/processes', { method: 'POST', body: { npu, claimant: 'Parte Ficticia QA', defendant: 'Empresa Ficticia QA', proceduralPhase: 'Conhecimento' } });
    assert.equal(r.status, 201, JSON.stringify(r.data)); ids.process = r.data.id;
    const detail = await request(`/processes/${ids.process}`); assert.equal(detail.status, 200);
  });
  await check('Atendimento cadastrado e evolucao de estado', async () => {
    const r = await request('/intakes', { method: 'POST', body: { subject: 'Consulta juridica ficticia', clientId: ids.person, channel: 'VIDEO', description: 'Analise inicial ficticia' } });
    assert.equal(r.status, 201, JSON.stringify(r.data)); ids.intake = r.data.id;
    const update = await request(`/intakes/${ids.intake}`, { method: 'PATCH', body: { status: 'WAITING_CLIENT' } });
    assert.equal(update.status, 200); assert.equal(update.data.status, 'WAITING_CLIENT');
  });
  await check('Contrato de honorarios persistente', async () => {
    const r = await request('/agreements', { method: 'POST', body: { clientId: ids.person, intakeId: ids.intake, code: `QA-${randomUUID().slice(0,10)}`, title: 'Honorarios ficticios QA', feeModel: 'FIXED', amountCents: 100000, status: 'ACTIVE' } });
    assert.equal(r.status, 201, JSON.stringify(r.data)); ids.agreement = r.data.id;
    const get = await request(`/agreements/${ids.agreement}`); assert.equal(get.status, 200);
  });
  await check('Lancamento financeiro em centavos', async () => {
    const r = await request('/finance/entries', { method: 'POST', body: { kind: 'RECEIVABLE', title: 'Honorarios QA', category: 'Honorarios', amountCents: 10000, dueOn: '2026-12-15', personId: ids.person, agreementId: ids.agreement } });
    assert.equal(r.status, 201, JSON.stringify(r.data)); ids.entry = r.data.id;
    assert.equal(r.data.remainingCents, 10000);
  });
  await check('Baixa parcial, total e idempotencia', async () => {
    const key1 = randomUUID(); const key2 = randomUUID();
    const first = await request(`/finance/entries/${ids.entry}/payments`, { method: 'POST', body: { amountCents: 4000, paidOn: '2026-11-07', method: 'PIX' }, extraHeaders: { 'Idempotency-Key': key1 } });
    assert.equal(first.status, 201, JSON.stringify(first.data));
    const again = await request(`/finance/entries/${ids.entry}/payments`, { method: 'POST', body: { amountCents: 4000, paidOn: '2026-11-07', method: 'PIX' }, extraHeaders: { 'Idempotency-Key': key1 } });
    assert.equal(again.status, 201); assert.equal(again.data.id, first.data.id);
    const conflict = await request(`/finance/entries/${ids.entry}/payments`, { method: 'POST', body: { amountCents: 4001, paidOn: '2026-11-07', method: 'PIX' }, extraHeaders: { 'Idempotency-Key': key1 } });
    assert.equal(conflict.status, 409);
    const second = await request(`/finance/entries/${ids.entry}/payments`, { method: 'POST', body: { amountCents: 6000, paidOn: '2026-11-07', method: 'PIX' }, extraHeaders: { 'Idempotency-Key': key2 } });
    assert.equal(second.status, 201);
    const third = await request(`/finance/entries/${ids.entry}/payments`, { method: 'POST', body: { amountCents: 1, paidOn: '2026-11-07', method: 'PIX' }, extraHeaders: { 'Idempotency-Key': randomUUID() } });
    assert.equal(third.status, 409);
    const after = await request(`/finance/entries/${ids.entry}`);
    assert.equal(after.data.paidCents, 10000); assert.equal(after.data.remainingCents, 0); assert.equal(after.data.state, 'PAID');
    assert.equal(after.data.payments.length, 2);
  });
  await check('Concorrencia de duas baixas nao ultrapassa saldo', async () => {
    const created = await request('/finance/entries', { method: 'POST', body: { kind: 'RECEIVABLE', title: 'Teste de concorrencia QA', category: 'Teste', amountCents: 10000, dueOn: '2026-12-15' } });
    assert.equal(created.status, 201);
    const send = () => request(`/finance/entries/${created.data.id}/payments`, { method: 'POST', body: { amountCents: 7000, paidOn: '2026-11-07', method: 'PIX' }, extraHeaders: { 'Idempotency-Key': randomUUID() } });
    const [a, b] = await Promise.all([send(), send()]);
    assert.equal([a.status,b.status].filter(s => s === 201).length, 1, `Esperado so uma baixa: ${a.status},${b.status}`);
    assert.ok([a.status,b.status].every(s => s === 201 || s === 409));
    const result = await request(`/finance/entries/${created.data.id}`);
    assert.equal(result.data.paidCents, 7000);
    assert.equal(result.data.payments.length, 1);
  });
  await check('Resumo financeiro e dados reais', async () => {
    const r = await request('/finance/summary'); assert.equal(r.status, 200);
    assert.ok(r.data.RECEIVABLE.totalCents >= 10000);
    assert.ok(r.data.RECEIVABLE.paidCents >= 10000);
  });
  await check('Timesheet: envio, aprovacao e imutabilidade', async () => {
    const r = await request('/timesheets', { method: 'POST', body: { workOn: '2026-11-07', minutes: 90, billable: true, description: 'Analise de documentacao ficticia', intakeId: ids.intake } });
    assert.equal(r.status, 201, JSON.stringify(r.data)); ids.time = r.data.id;
    const submitted = await request(`/timesheets/${ids.time}/submit`, { method: 'POST', body: {} }); assert.equal(submitted.status, 200);
    const decision = await request(`/timesheets/${ids.time}/decision`, { method: 'POST', body: { decision: 'APPROVED' } });
    assert.equal(decision.status, 200); assert.equal(decision.data.status, 'APPROVED');
    const patch = await request(`/timesheets/${ids.time}`, { method: 'PATCH', body: { minutes: 95 } }); assert.equal(patch.status, 409);
  });
  await check('Relatorios gerenciais e exportacao CSV', async () => {
    const r = await request('/reports/overview'); assert.equal(r.status, 200);
    assert.ok(r.data.people >= 1); assert.ok(r.data.intakes >= 1);
    for (const kind of ['people', 'intakes', 'finance', 'timesheets']) {
      const exp = await request(`/reports/export?kind=${kind}`);
      assert.equal(exp.status, 200, `${kind}: ${exp.text.slice(0,120)}`);
      assert.ok(exp.headers.get('content-type')?.includes('text/csv'));
    }
  });
  await check('Segregacao por escritorio na API e referencias', async () => {
    const org = await db.organization.create({ data: { name: `Outro Escritorio Ficticio QA ${randomUUID().slice(0,8)}` } });
    const other = await db.person.create({ data: { organizationId: org.id, name: 'Pessoa Restrita QA', roles: ['CLIENT'] } });
    const get = await request(`/people/${other.id}`); assert.equal(get.status, 404);
    const insert = await request('/intakes', { method: 'POST', body: { subject: 'Acesso cruzado bloqueado', clientId: other.id } });
    assert.equal(insert.status, 400);
  });
  await check('RBAC: perfil de consulta nao acessa financeiro', async () => {
    const org = await db.organization.findUniqueOrThrow({ where: { id: 'sysadv-default-org' } });
    const role = await db.role.findUniqueOrThrow({ where: { organizationId_code: { organizationId: org.id, code: 'VIEWER' } } });
    const viewerPwd = `Qa!${randomUUID()}ABC123`;
    const viewer = await db.user.create({ data: { organizationId: org.id, name: 'Consulta QA', email: `qa-view-${randomUUID()}@example.invalid`, passwordHash: await argon2.hash(viewerPwd) } });
    await db.userRole.create({ data: { userId: viewer.id, roleId: role.id } });
    const login = await request('/auth/login', { method: 'POST', body: { email: viewer.email, password: viewerPwd }, auth: false });
    assert.equal(login.status, 200);
    const original = token; token = login.data.accessToken;
    try {
      const denied = await request('/finance/entries'); assert.equal(denied.status, 403);
      const deniedReport = await request('/reports/overview'); assert.equal(deniedReport.status, 403);
    } finally { token = original; }
  });
  await check('Prazos: catalogo por materia, natureza e regras de referencia', async () => {
    const result = await request('/deadlines/rules');
    assert.equal(result.status, 200);
    const codes = result.data.rules.map(x => x.code);
    assert.ok(codes.includes('CIVIL_CONTESTACAO'));
    assert.ok(codes.includes('CRIMINAL_ANSWER'));
    assert.ok(codes.includes('LABOR_APPEAL'));
    assert.ok(codes.includes('SOCIAL_SECURITY_INSS_ORDINARY'));
    assert.ok(codes.includes('INSOLVENCY_STAY'));
  });
  await check('Prazos: calculo penal corrido e bloqueio de dobra indevida', async () => {
    const payload = {
      ruleCode:'CRIMINAL_ANSWER', processId: ids.process ?? null,
      anchorDate:'2026-11-02', anchorEvidence:'Certidao de citacao validada pelo advogado QA',
      tribunalCode:'TJSP',state:'SP',city:'',fileFormat:'ELECTRONIC',doubleBasis:'NONE',
      natureConfirmation:'PROCESSUAL',natureAcknowledged:true,internalBusinessDays:2
    };
    const preview = await request('/deadlines/preview', {method:'POST', body:payload});
    assert.equal(preview.status, 200, JSON.stringify(preview.data));
    assert.equal(preview.data.preview.dueDate,'2026-11-12');
    assert.equal(preview.data.preview.calendarCoverage,'UNVERIFIED');
    const forbidden=await request('/deadlines/preview',{method:'POST',body:{...payload,doubleBasis:'PUBLIC_ENTITY',doubleJustification:'Justificativa simulada para teste de proibicao'}});
    assert.equal(forbidden.status,422);
  });
  await check('Prazos: rascunho auditado sem aprovacao propria ou alertas oficiais', async () => {
    const payload = {
      ruleCode:'CIVIL_CONTESTACAO',processId:ids.process ?? null,
      anchorDate:'2026-11-02',anchorEvidence:'Marco inicial processual ficticio e conferido apenas para QA',
      tribunalCode:'TJSP',state:'SP',city:'',fileFormat:'ELECTRONIC',doubleBasis:'NONE',
      natureConfirmation:'PROCESSUAL',natureAcknowledged:true,internalBusinessDays:2
    };
    const saved=await request('/deadlines',{method:'POST',body:payload});
    assert.equal(saved.status,201,JSON.stringify(saved.data));
    assert.equal(saved.data.status,'PENDING_REVIEW');
    const denied=await request(`/deadlines/${saved.data.id}/approve`,{method:'POST',body:{reviewNotes:'Revisao de QA por proprio criador nao permitida'}});
    assert.equal(denied.status,403);
    const dbCase=await db.deadlineCase.findUnique({where:{id:saved.data.id}});
    assert.equal(dbCase?.status,'PENDING_REVIEW');
    assert.equal(await db.deadlineAlert.count({where:{deadlineId:saved.data.id}}),0);
    const agenda=await request('/agenda?from=2026-11-01T00:00:00.000Z&to=2026-12-01T00:00:00.000Z');
    assert.equal(agenda.status,200);
    assert.ok(!agenda.data.items.some(x=>x.kind==='DEADLINE'&&x.id===saved.data.id));
  });
  await check('Fontes judiciais bloqueadas por padrao', async () => {
    const r = await request('/integracoes/fontes'); assert.equal(r.status, 200);
    assert.equal(r.data.dataJudNonCommercialEnabled, false);
    assert.equal(r.data.djenContractValidated, false);
    assert.ok(r.data.sources.length > 0);
  });
  await check('Registros e auditoria persistidos no PostgreSQL', async () => {
    const [person, intake, agreement, payment, entry, time, audit] = await Promise.all([
      db.person.findUnique({ where: { id: ids.person } }), db.officeIntake.findUnique({ where: { id: ids.intake } }),
      db.feeAgreement.findUnique({ where: { id: ids.agreement } }), db.financialPayment.count({ where: { entryId: ids.entry } }),
      db.financialEntry.findUnique({ where: { id: ids.entry } }), db.timeEntry.findUnique({ where: { id: ids.time } }),
      db.auditEvent.count({ where: { organizationId: 'sysadv-default-org' } })
    ]);
    assert.ok(person && intake && agreement && time && entry && audit > 0);
    assert.equal(payment, 2); assert.equal(entry.paidCents, 10000);
  });
} catch (e) { console.error(`[BLOQUEIO] ${e.message}`); results.push({name:'Prerequisitos',status:'FAIL',reason:e.message}); }
finally {
  await db.$disconnect();
  const fail = results.filter(x => x.status === 'FAIL');
  console.log(`\nAPI + PostgreSQL: ${results.length - fail.length}/${results.length} verificacoes aprovadas.`);
  console.log(JSON.stringify({ summary: { total: results.length, passed: results.length - fail.length, failed: fail.length }, cases: results }));
  if (fail.length) process.exitCode = 1;
}
