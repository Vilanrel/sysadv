import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateDeadline, DeadlineRuleError } from '../../apps/api/src/modules/deadlines/deadline-engine.ts';
const makeRule=(o={})=>({code:'CIVIL_EXAMPLE',version:1,label:'Exemplo CPC',branch:'CIVIL',nature:'PROCESSUAL',countMode:'BUSINESS_DAYS',quantity:5,endRoll:'NONE',
 recess:true,doubleEligible:true,trigger:'intimação',sourceUrl:'https://www.planalto.gov.br/',caveat:'verificar',active:true,...o});
const makeInput=(o={})=>({anchorDate:'2026-11-06',anchorEvidence:'Certidão de intimação validada.',court:'TJSP',state:'SP',city:'SAO PAULO',fileFormat:'ELECTRONIC',doubleBasis:'NONE',internalBusinessDays:2,...o});
const cal=(o={})=>({holidays:[],verifiedYears:[2024,2025,2026,2027,2028],...o});
const run=(rule={},input={},calendar={})=>calculateDeadline(makeRule(rule),makeInput(input),cal(calendar));

test('CPC: 5 dias uteis excluem inicio e finais de semana',()=>{
 const result=run();assert.equal(result.dueDate,'2026-11-13');assert.equal(result.internalDate,'2026-11-11');assert.equal(result.calendarCoverage,'VERIFIED');
});
test('CPC: feriado estadual e municipal no meio do prazo',()=>{
 const result=run({}, {}, {holidays:['2026-11-09','2026-11-11']});assert.equal(result.dueDate,'2026-11-17');
});
test('recesso civil suspende 20/dez a 20/jan inclusives',()=>{
 const result=run({}, {anchorDate:'2026-12-18'});assert.equal(result.dueDate,'2027-01-27');
});
test('trabalho: 8 dias uteis, aplica recesso',()=>{
 const result=run({code:'LABOR_RO',branch:'LABOR',quantity:8,doubleEligible:false},{anchorDate:'2026-12-18'});
 assert.equal(result.dueDate,'2027-02-01');
});
test('Penal: dias corridos, sem recesso; vencimento domingo prorrogado',()=>{
 const result=run({branch:'CRIMINAL',countMode:'CALENDAR_DAYS',quantity:2,recess:false,endRoll:'NEXT_BUSINESS',doubleEligible:false});
 assert.equal(result.dueDate,'2026-11-09');
});
test('Penal: feriado intermediario e incluido, feriado do vencimento prorroga',()=>{
 const result=run({branch:'CRIMINAL',countMode:'CALENDAR_DAYS',quantity:3,recess:false,endRoll:'NEXT_BUSINESS',doubleEligible:false}, {},{holidays:['2026-11-09','2026-11-10']});
 assert.equal(result.dueDate,'2026-11-11');
});
test('Administrativo: 30 corridos com prorrogacao em domingo',()=>{
 const result=run({branch:'SOCIAL_SECURITY_ADMIN',nature:'ADMINISTRATIVE',countMode:'CALENDAR_DAYS',quantity:30,recess:false,doubleEligible:false,endRoll:'NEXT_BUSINESS'});
 assert.equal(result.dueDate,'2026-12-07');
});
test('LRF: stay period 180 corridos, sem regra CPC nem rollover',()=>{
 const rule={branch:'INSOLVENCY',nature:'MATERIAL',countMode:'CALENDAR_DAYS',quantity:180,recess:false,doubleEligible:false,endRoll:'NONE'};
 const result=run(rule,{anchorDate:'2026-11-06'});
 assert.equal(result.dueDate,'2027-05-05');
});
test('LRF: impugnacao de credito e corrida por lei especial',()=>{
 const result=run({branch:'INSOLVENCY',countMode:'CALENDAR_DAYS',quantity:10,recess:false,doubleEligible:false,endRoll:'NEXT_BUSINESS'});
 assert.equal(result.dueDate,'2026-11-16');
});
test('Dobra por procuradores distintos proibida em autos eletronicos',()=>{
 assert.throws(()=>run({}, {doubleBasis:'SEPARATE_COUNSEL',doubleJustification:'Existem dois escritorios distintos nos autos.'}),e=>e instanceof DeadlineRuleError&&e.code==='ARTICLE_229_EXCLUDES_ELECTRONIC_CASES');
});
test('Dobra em autos fisicos apenas com justificativa',()=>{
 const result=run({}, {fileFormat:'PAPER',doubleBasis:'SEPARATE_COUNSEL',doubleJustification:'Escritorios distintos, comprovados nos autos.'});
 assert.equal(result.quantityApplied,10);assert.equal(result.dueDate,'2026-11-20');
});
test('Fazenda Publica com marco validado: dobra preliminar',()=>{
 const result=run({}, {doubleBasis:'PUBLIC_ENTITY',doubleJustification:'Pessoa juridica de direito publico, verificacao de excecoes.'});
 assert.equal(result.quantityApplied,10);assert.ok(result.warnings.includes('DOUBLE_TIME_REQUIRES_DOCUMENTED_ELIGIBILITY'));
});
test('nao aplicar dobra indevida na materia penal',()=>{
 assert.throws(()=>run({branch:'CRIMINAL',doubleEligible:false},{doubleBasis:'PUBLIC_ENTITY',doubleJustification:'Declaracao administrativa de prazo.'}),/DOUBLE_NOT_APPLICABLE_TO_THIS_RULE/);
});
test('calendario sem evidencia nao e homologado',()=>{
 const result=run({}, {}, {verifiedYears:[]});assert.equal(result.calendarCoverage,'UNVERIFIED');assert.ok(result.warnings.some(w=>w.includes('CALENDAR_COVERAGE_NOT_VERIFIED')));
});
test('suspensao cadastrada interrompe apenas contagem util',()=>{
 const result=run({}, {}, {suspensions:[{from:'2026-11-09',to:'2026-11-10'}]});assert.equal(result.dueDate,'2026-11-17');
});
test('evento fixo: audiencia deve ter data e hora',()=>{
 assert.throws(()=>run({countMode:'FIXED_EVENT',quantity:0,endRoll:'NONE'},{}),/HEARING_DEADLINE_DATETIME_REQUIRED/);
 const result=run({countMode:'FIXED_EVENT',quantity:0,endRoll:'NONE'},{fixedDueAt:'2026-11-13T09:00:00-03:00'});
 assert.equal(result.dueDate,'2026-11-13');
});
test('ano material: aniversario bissexto clamped para fevereiro',()=>{
 const result=run({nature:'MATERIAL',countMode:'YEARS',quantity:2,recess:false,doubleEligible:false},{anchorDate:'2024-02-29'});
 assert.equal(result.dueDate,'2026-02-28');
});
test('alertas D-5, D-3, D-1 e interno sao separados do fatal',()=>{
 const result=run();assert.deepEqual(result.alertDates.map(x=>x.kind),['HARD_D5','HARD_D3','HARD_D1','INTERNAL_DUE']);
 assert.deepEqual(result.alertDates.map(x=>x.on),['2026-11-08','2026-11-10','2026-11-12','2026-11-11']);
});
test('ancora exige evidencia juridica, nao somente data automatica',()=>{
 assert.throws(()=>run({}, {anchorEvidence:''}),/ANCHOR_EVIDENCE_REQUIRED/);
});
test('nao executa regra desligada',()=>assert.throws(()=>run({active:false}),/RULE_INACTIVE/));

// QA4: without the municipality, a statewide calendar must not be presented
// as locally verified. Approval checks calendarCoverage === VERIFIED.
test('calendario estadual nao comprova feriados municipais sem cidade',()=>{
 const result=run({}, {city:''}, {verifiedYears:[2026,2027]});
 assert.equal(result.calendarCoverage,'UNVERIFIED');
 assert.ok(result.warnings.includes('MUNICIPAL_CALENDAR_SCOPE_NOT_VERIFIED'));
});
test('cidade ausente nao gera homologacao silenciosa',()=>{
 const result=run({}, {city:undefined}, {verifiedYears:[2026,2027]});
 assert.equal(result.calendarCoverage,'UNVERIFIED');
});
