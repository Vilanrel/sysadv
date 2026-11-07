import type { LegalRule } from './deadline-engine.js';
const CPC = 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105.htm';
const CPP = 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del3689.htm';
const CLT = 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452.htm';
const LRF = 'https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2005/lei/l11101.htm';
const L9784 = 'https://www.planalto.gov.br/ccivil_03/leis/l9784.htm';
const D3048 = 'https://www.planalto.gov.br/ccivil_03/decreto/d3048.htm';
const mk = (code: string, label: string, branch: LegalRule['branch'], nature: LegalRule['nature'], countMode: LegalRule['countMode'], quantity: number, trigger: string, sourceUrl: string, caveat: string, extra: Partial<LegalRule> = {}): LegalRule =>
  ({code, label, branch, nature, countMode, quantity, trigger, sourceUrl, caveat, version: 1,
    endRoll: countMode === 'CALENDAR_DAYS' ? 'NEXT_BUSINESS' : 'NONE', recess: ['CIVIL', 'BUSINESS', 'LABOR'].includes(branch) && nature === 'PROCESSUAL',
    doubleEligible: ['CIVIL','BUSINESS'].includes(branch) && nature === 'PROCESSUAL', active: true,...extra});
const review = 'Contagem sugerida: conferir rito, ato, intimação, legislação especial, norma do tribunal e determinação judicial antes de aprovar.';
export const DEFAULT_DEADLINE_RULES: LegalRule[] = [
  mk('CIVIL_CONTESTACAO','Contestação CPC (15 úteis)','CIVIL','PROCESSUAL','BUSINESS_DAYS',15,'marco do art. 335 e 231, confirmado pelo advogado',CPC, review),
  mk('CIVIL_APELACAO','Apelação cível (15 úteis)','CIVIL','PROCESSUAL','BUSINESS_DAYS',15,'publicação/intimação válida',CPC,review),
  mk('CIVIL_EMBARGOS_DECLARACAO','Embargos de declaração CPC (5 úteis)','CIVIL','PROCESSUAL','BUSINESS_DAYS',5,'publicação/intimação válida',CPC,review),
  mk('CIVIL_REPLICA','Réplica à contestação CPC (15 úteis)','CIVIL','PROCESSUAL','BUSINESS_DAYS',15,'intimação válida',CPC,review),
  mk('CIVIL_IMPUGNACAO','Impugnação ao cumprimento de sentença (15 úteis)','CIVIL','PROCESSUAL','BUSINESS_DAYS',15,'marco processual validado (arts. 523 e 525)',CPC,review),
  mk('BUSINESS_RECURSO','Recurso empresarial sob CPC (15 úteis)','BUSINESS','PROCESSUAL','BUSINESS_DAYS',15,'intimação válida, confirmada aplicabilidade CPC',CPC,review),
  mk('INSOLVENCY_STAY','Stay period RJ (180 corridos)','INSOLVENCY','MATERIAL','CALENDAR_DAYS',180,'decisão que defere processamento de RJ, conforme caso',LRF,'Prazo material de 180 DIAS CORRIDOS; eventual prorrogação judicial deve ser registrada separadamente.',{endRoll:'NONE',recess:false,doubleEligible:false}),
  mk('INSOLVENCY_CREDIT_DIVERGENCE','Habilitação/divergência de crédito (15 corridos)','INSOLVENCY','MATERIAL','CALENDAR_DAYS',15,'publicação do edital da LRF',LRF,'Lei 11.101/2005 art. 189 §1º I: contagem em dias corridos; conferir natureza e marco.',{doubleEligible:false,recess:false}),
  mk('INSOLVENCY_CREDIT_OBJECTION','Impugnação de crédito RJ (10 corridos)','INSOLVENCY','PROCESSUAL','CALENDAR_DAYS',10,'publicação da relação de credores e marco do art. 8º',LRF,'Prazo de lei especial em dias CORRIDOS (art. 189 §1º I), mesmo sendo impugnação judicial.',{doubleEligible:false,recess:false}),
  mk('CRIMINAL_ANSWER','Resposta à acusação (10 corridos)','CRIMINAL','PROCESSUAL','CALENDAR_DAYS',10,'citação válida; verificar hipótese específica',CPP,review,{recess:false,doubleEligible:false}),
  mk('CRIMINAL_APPEAL_FILE','Interposição apelação criminal (5 corridos)','CRIMINAL','PROCESSUAL','CALENDAR_DAYS',5,'intimação válida',CPP,review,{recess:false,doubleEligible:false}),
  mk('CRIMINAL_APPEAL_REASONS','Razões apelação criminal (8 corridos)','CRIMINAL','PROCESSUAL','CALENDAR_DAYS',8,'abertura de vista/intimação válida',CPP,review,{recess:false,doubleEligible:false}),
  mk('CRIMINAL_RESE_FILE','Interposição RESE (5 corridos)','CRIMINAL','PROCESSUAL','CALENDAR_DAYS',5,'intimação válida',CPP,review,{recess:false,doubleEligible:false}),
  mk('CRIMINAL_ED','Embargos declaração criminal (2 corridos)','CRIMINAL','PROCESSUAL','CALENDAR_DAYS',2,'intimação válida',CPP,review,{recess:false,doubleEligible:false}),
  mk('CRIMINAL_MEMORIALS','Memoriais finais criminais (5 corridos)','CRIMINAL','PROCESSUAL','CALENDAR_DAYS',5,'vista/designação judicial aplicável',CPP,review,{recess:false,doubleEligible:false}),
  mk('LABOR_DEFENSE_HEARING','Defesa trabalhista (prazo pelo horário da audiência)','LABOR','PROCESSUAL','FIXED_EVENT',0,'data e hora da audiência inaugural e regra do sistema do tribunal',CLT,'Ato dependente da audiência, não de somar dias. Horário deve ser confirmado.',{doubleEligible:false,recess:false,endRoll:'NONE'}),
  mk('LABOR_APPEAL','Recurso trabalhista (8 úteis)','LABOR','PROCESSUAL','BUSINESS_DAYS',8,'publicação/intimação válida',CLT,review,{doubleEligible:false}),
  mk('LABOR_ED','Embargos declaração trabalhista (5 úteis)','LABOR','PROCESSUAL','BUSINESS_DAYS',5,'publicação/intimação válida',CLT,review,{doubleEligible:false}),
  mk('LABOR_EXPERT_REPORT','Manifestação laudo pericial (prazo fixado pelo juiz)','LABOR','PROCESSUAL','FIXED_EVENT',0,'ordem judicial individual com data e hora',CLT,'Prazo de laudo depende da decisão; não usar 5 dias por padrão.',{doubleEligible:false,recess:false,endRoll:'NONE'}),
  mk('LABOR_RESCISSORY_ACTION','Ação rescisória trabalhista (2 anos)','LABOR','MATERIAL','YEARS',2,'trânsito em julgado de decisão rescindenda confirmado',CLT,'Prazo decadencial de anos; conferir marco temporal e regras específicas.',{doubleEligible:false,recess:false,endRoll:'NONE'}),
  mk('SOCIAL_SECURITY_INSS_ORDINARY','Recurso CRPS ordinário (30 corridos)','SOCIAL_SECURITY_ADMIN','ADMINISTRATIVE','CALENDAR_DAYS',30,'ciência efetiva da decisão administrativa',D3048,'Conferir regulamentação vigente do CRPS e prazo próprio da espécie.',{doubleEligible:false,recess:false}),
  mk('SOCIAL_SECURITY_INSS_SPECIAL','Recurso CRPS especial (30 corridos)','SOCIAL_SECURITY_ADMIN','ADMINISTRATIVE','CALENDAR_DAYS',30,'ciência do acórdão da Junta',D3048,'Conferir cabimento, norma CRPS vigente e marco da ciência.',{doubleEligible:false,recess:false}),
  mk('ADMIN_FEDERAL_GENERAL','Prazo administrativo federal genérico (dias corridos)','SOCIAL_SECURITY_ADMIN','ADMINISTRATIVE','CALENDAR_DAYS',5,'cientificação oficial',L9784,'Padrão ilustrativo de 5 dias APENAS quando aplicável art. 24; usar regra específica ou decisão quando houver.',{doubleEligible:false,recess:false}),
];
export function getDefaultRule(code: string) {return DEFAULT_DEADLINE_RULES.find(r => r.code === code);}
