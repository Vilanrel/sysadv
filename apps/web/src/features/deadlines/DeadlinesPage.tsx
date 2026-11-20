import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useFeedback } from '../../components/feedback';
import { Link } from 'react-router-dom';
import { apiFetch } from '../auth/api';
import { useAuth } from '../auth/AuthProvider';

type Rule={code:string;version:number;label:string;branch:string;nature:string;countMode:string;quantity:number;trigger:string;caveat:string;approved:boolean;preset:boolean;id?:string;sourceUrl:string};
type Preview={dueDate:string|null;internalDate:string|null;fixedDueAt:string|null;calendarCoverage:string;warnings:string[];alertDates:{kind:string;on:string}[];quantityApplied:number;countMode:string;state:string};
type Deadline={id:string;ruleCode:string;legalDueOn:string;internalDueOn:string;status:string;reviewedAt:string|null;warnings:string[];process?:{id:string;npu:string}|null};
type Alert={id:string;kind:string;scheduledOn:string;deadline:{id:string;ruleCode:string;legalDueOn:string;process?:{id:string;npu:string}|null}};
type Process={id:string;npu:string};
type HolidayScope='NATIONAL'|'STATE'|'TRIBUNAL'|'CITY';
type Holiday={id:string;name:string;date:string;tribunalCode:string|null;state:string|null;city:string|null;notes:string|null;active:boolean};
type Suspension={
 id:string;tribunalCode:string;state:string;city:string;from:string;to:string;
 reason:string;evidence:string;active:boolean;revokedAt:string|null;
};
type CalendarCoverage={
 id:string;tribunalCode:string;state:string;city:string;year:number;
 sourceUrl:string;evidence:string;verifiedAt:string;verified:boolean;needsRevalidation:boolean;
};
const holidayScopeLabels:Record<HolidayScope,string>={
  NATIONAL:'Nacional',STATE:'Estadual',TRIBUNAL:'Tribunal',CITY:'Municipal',
};
function holidaySource(notes:string|null):string{
  if(!notes)return 'Sem evidência documentada';
  try{
    const value=JSON.parse(notes) as {sourceUrl?:string;evidence?:string};
    if(typeof value.sourceUrl==='string'&&typeof value.evidence==='string')
      return 'Fonte: '+value.sourceUrl+' — Evidência: '+value.evidence;
  }catch{}
  return notes;
}
type PublicationReference={
  id:string;npu:string;title:string|null;actType:string;tribunal:string|null;
  availableOn:string|null;publishedOn:string|null;sourceUrl:string|null;
  source:{code:string;name:string}|null;
};
type Form={ruleCode:string;processId:string;anchorDate:string;anchorEvidence:string;tribunalCode:string;state:string;city:string;fileFormat:'PAPER'|'ELECTRONIC';doubleBasis:'NONE'|'PUBLIC_ENTITY'|'PUBLIC_DEFENDER'|'SEPARATE_COUNSEL';doubleJustification:string;fixedDueAt:string;fixedOffset:string;internalBusinessDays:number;natureConfirmation:'PROCESSUAL'|'MATERIAL'|'ADMINISTRATIVE';natureAcknowledged:boolean};
const defaultForm:Form={ruleCode:'CIVIL_CONTESTACAO',processId:'',anchorDate:'',anchorEvidence:'',tribunalCode:'TJSP',state:'SP',city:'',fileFormat:'ELECTRONIC',doubleBasis:'NONE',doubleJustification:'',fixedDueAt:'',fixedOffset:'-03:00',internalBusinessDays:2,natureConfirmation:'PROCESSUAL',natureAcknowledged:false};
const display=(d:string|null|undefined)=>d?d.slice(0,10).split('-').reverse().join('/'):'—';
const labels:Record<string,string>={CIVIL:'Cível',BUSINESS:'Empresarial',CRIMINAL:'Penal',LABOR:'Trabalhista',SOCIAL_SECURITY_ADMIN:'Previdenciário administrativo',INSOLVENCY:'Recuperação e falência',
  PROCESSUAL:'Processual',MATERIAL:'Material',ADMINISTRATIVE:'Administrativo',
  HARD_D5:'D-5',HARD_D3:'D-3',HARD_D1:'D-1',INTERNAL_DUE:'Prazo interno',
  PENDING_REVIEW:'Aguardando revisão',APPROVED:'Aprovado',CANCELLED:'Cancelado'};
const explain:Record<string,string>={LEGAL_REVIEW_MANDATORY:'Conferência jurídica humana obrigatória.',TRIGGER_AND_INTIMATION_MUST_BE_VERIFIED:'Confira a validade e o marco de ciência/intimação.',
  VERIFY_LOCAL_RECESS_EXCEPTIONS:'Verifique exceções ao recesso ou suspensões no tribunal.',MATERIAL_PERIOD_REQUIRES_INDIVIDUAL_REVIEW:'Natureza material exige análise do caso concreto.',
  COURT_AND_STATE_SCOPE_INCOMPLETE:'Tribunal/UF incompletos.',MUNICIPAL_CALENDAR_SCOPE_NOT_VERIFIED:'Informe a cidade do foro e valide os feriados municipais antes de aprovar o prazo.',DOUBLE_TIME_REQUIRES_DOCUMENTED_ELIGIBILITY:'Prazo em dobro depende de comprovação documental.',
  HEARING_TIME_AND_TIMEZONE_REQUIRE_REVIEW:'Confirme horário e fuso da audiência.',CUSTOM_RULE_NOT_APPROVED:'Regra customizada não aprovada.'};
const errorText=(s:string)=>({CALENDAR_NOT_VERIFIED:'Valide o calendário do tribunal para os anos aplicáveis antes de aprovar.',
  STALE_CALCULATION:'O calendário/regra mudou; cancele este rascunho e gere um novo cálculo.',ARTICLE_229_EXCLUDES_ELECTRONIC_CASES:'Art. 229 §2º CPC: sem prazo em dobro por procuradores distintos em autos eletrônicos.',
  DIFFERENT_REVIEWER_REQUIRED:'A revisão precisa ser realizada por outro usuário autorizado.',RULE_NOT_APPROVED:'Uma regra customizada precisa da aprovação do gestor.',
  DOUBLE_NOT_APPLICABLE_TO_THIS_RULE:'Prazo em dobro não permitido automaticamente para esta regra.',
  NATURE_MISMATCH_RULE:'A natureza informada não corresponde à regra. Selecione uma regra adequada ou cadastre uma versão específica.',
  ANCHOR_EVIDENCE_REQUIRED:'Informe a evidência da data que inicia a contagem.',INVALID_RULE_QUANTITY:'A quantidade definida na regra não é válida.',
  HEARING_DEADLINE_DATETIME_REQUIRED:'Informe data e hora da audiência ou do ato fixado judicialmente.',
  DOUBLE_REQUIRES_FACTUAL_JUSTIFICATION:'Fundamente a aplicação do prazo em dobro.'}[s]??s);
const encodeBody=(v:unknown)=>JSON.stringify(v);
async function jsonRequest(path:string,method='GET',body?:unknown){
  const response=await apiFetch(path,{method,...(body?{body:encodeBody(body)}:{})});
  const data=await response.json().catch(()=>({error:'FALHA_DE_COMUNICACAO'}));
  if(!response.ok)throw new Error(errorText(data.error??'ERRO_NA_REQUISICAO'));
  return data;
}
export function DeadlinesPage(){const fb=useFeedback();
 const {has}=useAuth();const [tab,setTab]=useState<'calculate'|'cases'|'rules'|'alerts'>('calculate');
 const [rules,setRules]=useState<Rule[]>([]);const [processes,setProcesses]=useState<Process[]>([]);const [cases,setCases]=useState<Deadline[]>([]);
 const [alerts,setAlerts]=useState<Alert[]>([]);const [form,setForm]=useState<Form>(defaultForm);const [preview,setPreview]=useState<Preview|null>(null);
 const [holidayYear,setHolidayYear]=useState(new Date().getFullYear());
 const [holidays,setHolidays]=useState<Holiday[]>([]);
 const [suspensionYear,setSuspensionYear]=useState(new Date().getFullYear());
 const [suspensions,setSuspensions]=useState<Suspension[]>([]);
 const [calendarCoverages,setCalendarCoverages]=useState<CalendarCoverage[]>([]);
 const [suspensionForm,setSuspensionForm]=useState({
  tribunalCode:'TJSP',state:'SP',city:'',from:'',to:'',
  reason:'',sourceUrl:'',evidence:'',
 });
 const [holidayForm,setHolidayForm]=useState({
   scope:'CITY' as HolidayScope,name:'',date:'',tribunalCode:'TJSP',state:'SP',
   city:'',sourceUrl:'',evidence:'',
 });
 const [publicationReferences,setPublicationReferences]=useState<PublicationReference[]>([]);
 const [publicationLoading,setPublicationLoading]=useState(false);
 const [publicationError,setPublicationError]=useState('');
 const [coverage,setCoverage]=useState({tribunalCode:'TJSP',state:'SP',city:'',year:new Date().getFullYear(),sourceUrl:'',evidence:'',reviewAcknowledged:false});
 const [ruleForm,setRuleForm]=useState({code:'',label:'',branch:'CIVIL',nature:'PROCESSUAL',countMode:'BUSINESS_DAYS',quantity:5,endRoll:'NONE',recess:true,doubleEligible:false,trigger:'',sourceUrl:'',caveat:'',active:true});
 const [newRule,setNewRule]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');
 const selected=useMemo(()=>rules.find(r=>r.code===form.ruleCode&&r.approved)||rules.find(r=>r.code===form.ruleCode),[rules,form.ruleCode]);
 const reload=useCallback(async()=>{
   const requests=[
     jsonRequest('/deadlines/rules'),jsonRequest('/deadlines'),jsonRequest('/deadlines/alerts'),
     has('process.read')?jsonRequest('/processes'):Promise.resolve([]),
     jsonRequest('/deadlines/holidays?year='+holidayYear),
     jsonRequest('/deadlines/suspensions?year='+suspensionYear),
     jsonRequest('/deadlines/calendar-coverage'),
   ];
   const [r,d,a,p,h,susp,calendar]=await Promise.all(requests);
   setRules(r.rules??[]);setCases(d.items??[]);setAlerts(a.items??[]);
   setProcesses(Array.isArray(p)?p:Array.isArray(p.items)?p.items:[]);
   setHolidays(h.items??[]);
   setSuspensions(susp.items??[]);
   setCalendarCoverages(calendar.items??[]);
 },[has,holidayYear,suspensionYear]);
 useEffect(()=>{void reload().catch(e=>setError(e instanceof Error?e.message:'Não foi possível carregar os prazos.'));},[reload]);
 useEffect(()=>{
   let active=true;
   setPublicationReferences([]);setPublicationError('');
   if(!form.processId||!has('publication.read')){setPublicationLoading(false);return;}
   setPublicationLoading(true);
   void jsonRequest('/deadlines/publications?processId='+encodeURIComponent(form.processId))
     .then(data=>{if(active)setPublicationReferences(Array.isArray(data.items)?data.items:[]);})
     .catch(e=>{if(active)setPublicationError(e instanceof Error?e.message:'Falha ao consultar publicações.');})
     .finally(()=>{if(active)setPublicationLoading(false);});
   return ()=>{active=false;};
 },[form.processId,has]);
 const update=(key:keyof Form,value:string|number|boolean)=>{setForm(v=>({...v,[key]:value}));setPreview(null);setError('');};
 const payload=()=>({ruleCode:form.ruleCode,processId:form.processId||null,anchorDate:form.anchorDate,anchorEvidence:form.anchorEvidence,
  tribunalCode:form.tribunalCode,state:form.state,city:form.city,fileFormat:form.fileFormat,doubleBasis:form.doubleBasis,
  natureConfirmation:form.natureConfirmation,natureAcknowledged:form.natureAcknowledged,
  doubleJustification:form.doubleJustification||undefined,fixedDueAt:form.fixedDueAt?`${form.fixedDueAt}:00${form.fixedOffset}`:undefined,internalBusinessDays:form.internalBusinessDays});
 async function perform(task:()=>Promise<unknown>,success:string){setBusy(true);setError('');setNotice('');try{await task();setNotice(success);await reload();}catch(e){setError(e instanceof Error?e.message:'Falha na operação.');}finally{setBusy(false);}}
 const calculate=(e:FormEvent)=>{e.preventDefault();void perform(async()=>{const out=await jsonRequest('/deadlines/preview','POST',payload());setPreview(out.preview);},'Prévia gerada. Confira todos os avisos antes de salvar.');};
 const store=()=>void perform(async()=>{await jsonRequest('/deadlines','POST',payload());setTab('cases');setPreview(null);},'Rascunho salvo. Outra pessoa com permissão de gestão deve aprovar.');
 const approve=async(item:Deadline)=>{const text=(await fb.prompt({title:`Validação jurídica — ${item.ruleCode}. Informe a evidência revisada (mínimo 12 caracteres).`,input:{label:'Texto',required:true}}));if(!text)return;void perform(()=>jsonRequest(`/deadlines/${item.id}/approve`,'POST',{reviewNotes:text}), 'Prazo validado; alertas internos registrados.');};
 const cancel=async(item:Deadline)=>{const text=(await fb.prompt({title:'Motivo do cancelamento (mínimo 12 caracteres):',input:{label:'Texto',required:true}}));if(!text)return;void perform(()=>jsonRequest(`/deadlines/${item.id}/cancel`,'POST',{reason:text}), 'Prazo cancelado; histórico preservado.');};
 const approveRule=async(rule:Rule)=>{if(!rule.id||!(await fb.confirm({title:`Homologar versão ${rule.version} de ${rule.code}?`,tone:'danger'})))return;void perform(()=>jsonRequest(`/deadlines/rules/${rule.id}/approve`,'POST'), 'Regra aprovada para uso no escritório.');};
 const acknowledge=(id:string)=>void perform(()=>jsonRequest(`/deadlines/alerts/${id}/ack`,'POST'), 'Alerta marcado como lido.');
 const addHoliday=(e:FormEvent)=>{
   e.preventDefault();
   const scope=holidayForm.scope;
   const body={
     scope,name:holidayForm.name,date:holidayForm.date,
     sourceUrl:holidayForm.sourceUrl,evidence:holidayForm.evidence,
     ...(scope!=='NATIONAL'?{state:holidayForm.state}:{}),
     ...(scope==='TRIBUNAL'||scope==='CITY'?{tribunalCode:holidayForm.tribunalCode}:{}),
     ...(scope==='CITY'?{city:holidayForm.city}:{}),
   };
   const entryYear=Number(holidayForm.date.slice(0,4));
   void perform(async()=>{
     await jsonRequest('/deadlines/holidays','POST',body);
     setHolidayForm(v=>({...v,name:'',date:'',sourceUrl:'',evidence:''}));
     if(entryYear>=2000&&entryYear<=2100)setHolidayYear(entryYear);
   },'Feriado cadastrado com fonte documental. Confira a cobertura anual antes de aprovar prazos.');
 };
 const registerSuspension=(e:FormEvent)=>{
   e.preventDefault();
   const entryYear=Number(suspensionForm.from.slice(0,4));
   void perform(async()=>{
     await jsonRequest('/deadlines/suspensions','POST',suspensionForm);
     setSuspensionForm(v=>({...v,from:'',to:'',reason:'',sourceUrl:'',evidence:''}));
     if(entryYear>=2000&&entryYear<=2100)setSuspensionYear(entryYear);
   },'Suspensão registrada. A validação do calendário correspondente precisará ser refeita.');
 };
 const revokeSuspension=async(item:Suspension)=>{
   const reason=await fb.prompt({title:'Revogar suspensão de expediente',input:{label:'Motivo documentado (mínimo 12 caracteres)',required:true}});
   if(!reason)return;
   void perform(()=>jsonRequest('/deadlines/suspensions/'+encodeURIComponent(item.id)+'/revoke','POST',{reason}),
     'Suspensão revogada com auditoria. Os prazos afetados exigem nova revisão.');
 };
 const deactivateHoliday=async(item:Holiday)=>{
   const reason=await fb.prompt({title:'Desativar feriado '+item.name+'? Informe o motivo com pelo menos 12 caracteres.',input:{label:'Motivo da correção',required:true}});
   if(!reason)return;
   void perform(()=>jsonRequest(`/deadlines/holidays/${encodeURIComponent(item.id)}/deactivate`,'POST',{reason}),
     'Feriado desativado, mantendo o histórico de auditoria. Pré-calculos existentes deverão ser revistos.');
 };
 return <div className="deadline-page"><div className="page-heading"><div><span className="eyebrow">Gestão jurídica · motor de contagem versionado</span><h1>Gerenciador de prazos</h1><p>Contagem por matéria, datas jurídicas auditáveis e revisão antes da confirmação.</p></div><span className="deadline-safety">Prévia não substitui conferência profissional</span></div>
  <div className="deadline-nav" role="tablist" aria-label="Gerenciamento de prazos">{([['calculate','Calcular prazo'],['cases','Prazos do escritório'],['rules','Regras e calendários'],['alerts',`Alertas (${alerts.length})`]] as const).map(([key,label])=><button key={key} className={tab===key?'active':''} role="tab" aria-selected={tab===key} onClick={()=>{setTab(key);setError('');}}>{label}</button>)}</div>
  {error&&<div role="alert" className="alert">{error}</div>}{notice&&<div role="status" className="notice-success">{notice}</div>}
  {tab==='calculate'&&<div className="deadline-columns"><section className="panel"><div className="panel-head"><h2>Parâmetros do cálculo</h2></div><form className="entity-form" onSubmit={calculate}>
   <label className="span-full">Regra e instituto<select value={form.ruleCode} onChange={e=>{const r=rules.find(x=>x.code===e.target.value&&x.approved);setForm(v=>({...v,ruleCode:e.target.value,natureConfirmation:(r?.nature??'PROCESSUAL') as Form['natureConfirmation'],natureAcknowledged:false}));setPreview(null);}} required>{rules.filter(r=>r.approved).map(r=><option key={`${r.code}/${r.version}`} value={r.code}>{r.label} · {labels[r.branch]??r.branch}</option>)}</select></label>
   <label>Natureza jurídica confirmada *<select value={form.natureConfirmation} onChange={e=>update('natureConfirmation',e.target.value)}><option value="PROCESSUAL">Processual</option><option value="MATERIAL">Material</option><option value="ADMINISTRATIVE">Administrativo</option></select></label>
   <label className="deadline-check"><input type="checkbox" required checked={form.natureAcknowledged} onChange={e=>update('natureAcknowledged',e.target.checked)}/> Conferi a natureza e a regra aplicável</label>
   <div className="deadline-rule-description span-full">{selected&&<><strong>{labels[selected.nature]??selected.nature} · {selected.countMode==='BUSINESS_DAYS'?'Dias úteis':selected.countMode==='CALENDAR_DAYS'?'Dias corridos':selected.countMode==='YEARS'?'Anos':'Data da audiência'}</strong><p>{selected.trigger}. {selected.caveat}</p><a target="_blank" rel="noreferrer" href={selected.sourceUrl}>Ver referência legal</a></>}</div>
   <label className="span-full">Processo (opcional)<select value={form.processId} onChange={e=>update('processId',e.target.value)}><option value="">Sem processo vinculado</option>{processes.map(p=><option key={p.id} value={p.id}>{p.npu}</option>)}</select></label>
   {form.processId&&has('publication.read')&&<section className="span-full deadline-publication-references" aria-label="Publicações do processo para conferência">
     <h3>Publicações vinculadas — consulta para conferência</h3>
     <p className="muted">A data de disponibilização e a data de publicação são metadados distintos. Nenhuma delas confirma, por si só, ciência ou início de prazo. Confira a publicação e informe manualmente o marco e sua evidência.</p>
     {publicationLoading?<p>Consultando publicações vinculadas…</p>:publicationError?<p role="alert" className="alert">{publicationError}</p>:publicationReferences.length===0?<p className="muted">Nenhuma publicação vinculada a este processo. Isso não significa inexistência de atos ou intimações.</p>:
       <div className="deadline-rules-list">{publicationReferences.map(p=><article key={p.id}>
         <div><strong>{p.title??p.actType}</strong>
           <p>{p.tribunal??'Tribunal não informado'} · {p.source?.name??'Origem não especificada'}</p>
           <p>Disponibilização: <strong>{display(p.availableOn)}</strong> · Publicação: <strong>{display(p.publishedOn)}</strong></p>
         </div>
         <Link to="/publications" className="ghost">Abrir publicações</Link>
       </article>)}</div>}
     <p className="muted">Não há cálculo ou criação automática de prazo a partir dessas publicações. A revisão jurídica e o calendário do tribunal permanecem obrigatórios.</p>
   </section>}
   <label>Data do ato / ciência comprovada *<input type="date" required value={form.anchorDate} onChange={e=>update('anchorDate',e.target.value)}/></label>
   <label>Tipo de autos<select value={form.fileFormat} onChange={e=>update('fileFormat',e.target.value)}><option value="ELECTRONIC">Eletrônico</option><option value="PAPER">Físico</option></select></label>
   <label className="span-full">Evidência do marco inicial *<textarea required minLength={8} rows={2} placeholder="Ex.: publicação de 06/11/2026, certidão no processo, intimação..." value={form.anchorEvidence} onChange={e=>update('anchorEvidence',e.target.value)}/></label>
   <label>Tribunal<input required maxLength={24} value={form.tribunalCode} onChange={e=>update('tribunalCode',e.target.value.toUpperCase())}/></label><label>UF<input required maxLength={2} value={form.state} onChange={e=>update('state',e.target.value.toUpperCase())}/></label>
   <label>Cidade<input value={form.city} onChange={e=>update('city',e.target.value)}/></label><label>Prazo interno (dias úteis antes)<input type="number" min={0} max={20} value={form.internalBusinessDays} onChange={e=>update('internalBusinessDays',Number(e.target.value))}/></label>
   <label>Prerrogativa de prazo em dobro<select value={form.doubleBasis} onChange={e=>update('doubleBasis',e.target.value)}><option value="NONE">Não se aplica</option><option value="PUBLIC_ENTITY">Fazenda Pública (validar)</option><option value="PUBLIC_DEFENDER">Defensoria Pública (validar)</option><option value="SEPARATE_COUNSEL">Litisconsortes com procuradores distintos (autos físicos)</option></select></label>
   {form.doubleBasis!=='NONE'&&<label className="span-full">Justificativa e evidência da prerrogativa<input required minLength={12} value={form.doubleJustification} onChange={e=>update('doubleJustification',e.target.value)} placeholder="Fundamento jurídico e documentação no processo"/></label>}
   {selected?.countMode==='FIXED_EVENT'&&<><label>Data e horário do ato *<input type="datetime-local" required value={form.fixedDueAt} onChange={e=>update('fixedDueAt',e.target.value)}/></label><label>Fuso do horário<select value={form.fixedOffset} onChange={e=>update('fixedOffset',e.target.value)}><option value="-03:00">Brasília (UTC-03)</option><option value="-04:00">Manaus/Cuiabá (UTC-04)</option><option value="-05:00">Rio Branco (UTC-05)</option><option value="+00:00">UTC</option></select></label></>}
   <div className="actions span-full"><button type="submit" className="primary" disabled={busy}>Calcular prévia</button>{preview&&has('calendar.write')&&<button className="ghost" type="button" disabled={busy} onClick={store}>Salvar para revisão</button>}</div>
  </form></section><section className="panel deadline-preview"><div className="panel-head"><h2>Prévia e pontos de atenção</h2></div>{!preview?<div className="deadline-empty">Escolha a regra, confirme o início da contagem e clique em <strong>Calcular prévia</strong>.</div>:<><span className="deadline-pending">{preview.state==='PENDING_REVIEW'?'Aguardando validação jurídica':preview.state}</span><div className="deadline-dates"><div><small>Prazo fatal calculado</small><strong>{display(preview.dueDate)}</strong></div><div><small>Prazo interno</small><strong>{display(preview.internalDate)}</strong></div></div><h3>Alertas planejados</h3><div className="deadline-alert-chips">{preview.alertDates.map(x=><span key={x.kind}>{labels[x.kind]??x.kind}: <strong>{display(x.on)}</strong></span>)}</div><h3>Atenções</h3><ul className="deadline-warnings">{preview.warnings.map(w=><li key={w}>{w.startsWith('CALENDAR_COVERAGE_NOT_VERIFIED')?`Calendário local ainda não validado para ${w.split(':')[1]}.`:explain[w]??w}</li>)}</ul><p className="muted">Calendário: <strong>{preview.calendarCoverage==='VERIFIED'?'verificado pelo escritório':'pendente de verificação'}</strong>. Mesmo após a verificação, uma segunda pessoa deve validar o cálculo.</p></>}</section></div>}
  {tab==='cases'&&<section className="panel"><div className="panel-head"><div><h2>Prazos cadastrados</h2><p>O prazo só entra na agenda e nos alertas após aprovação.</p></div><button className="ghost" onClick={()=>void reload()}>Atualizar</button></div>{!cases.length?<p className="muted">Ainda não há prazos cadastrados.</p>:<div className="table-wrap"><table><thead><tr><th>Regra / Processo</th><th>Fatal</th><th>Interno</th><th>Status</th><th>Ações</th></tr></thead><tbody>{cases.map(item=><tr key={item.id}><td><strong>{item.ruleCode}</strong><br/>{item.process?<Link to={`/processes/${item.process.id}`}>{item.process.npu}</Link>:<small>Sem processo</small>}</td><td>{display(item.legalDueOn)}</td><td>{display(item.internalDueOn)}</td><td><span className={`deadline-status deadline-${item.status.toLowerCase()}`}>{labels[item.status]??item.status}</span></td><td className="actions">{item.status==='PENDING_REVIEW'&&has('calendar.manage')&&<button className="ghost" disabled={busy} onClick={()=>approve(item)}>Revisar</button>}{item.status!=='CANCELLED'&&has('calendar.manage')&&<button className="ghost" disabled={busy} onClick={()=>cancel(item)}>Cancelar</button>}</td></tr>)}</tbody></table></div>}</section>}
  {tab==='rules'&&<><section className="panel"><div className="panel-head"><div><h2>Regras de contagem</h2><p>Modelos legais e regras internas customizadas, com versões e aprovação.</p></div>{has('calendar.manage')&&<button className="primary" onClick={()=>setNewRule(v=>!v)}>{newRule?'Fechar':'Criar regra'}</button>}</div>{newRule&&<form className="entity-form" onSubmit={e=>{e.preventDefault();void perform(()=>jsonRequest('/deadlines/rules','POST',ruleForm),'Versão da regra criada. Ela precisa ser aprovada antes de uso.');setNewRule(false);}}>
    {([['code','Código (letras e underscore)'],['label','Título'],['trigger','Evento que inicia o prazo'],['sourceUrl','URL da fonte legal'],['caveat','Exceções / observações']] as const).map(([key,label])=><label key={key} className="span-full">{label}<input required value={ruleForm[key]} onChange={e=>setRuleForm(v=>({...v,[key]:key==='code'?e.target.value.toUpperCase():e.target.value}))}/></label>)}
    <label>Ramo<select value={ruleForm.branch} onChange={e=>setRuleForm(v=>({...v,branch:e.target.value}))}>{['CIVIL','BUSINESS','CRIMINAL','LABOR','SOCIAL_SECURITY_ADMIN','INSOLVENCY'].map(k=><option value={k} key={k}>{labels[k]}</option>)}</select></label><label>Natureza<select value={ruleForm.nature} onChange={e=>setRuleForm(v=>({...v,nature:e.target.value}))}>{['PROCESSUAL','MATERIAL','ADMINISTRATIVE'].map(k=><option key={k} value={k}>{labels[k]}</option>)}</select></label>
    <label>Contagem<select value={ruleForm.countMode} onChange={e=>setRuleForm(v=>({...v,countMode:e.target.value}))}>{['BUSINESS_DAYS','CALENDAR_DAYS','YEARS','FIXED_EVENT'].map(k=><option key={k} value={k}>{k}</option>)}</select></label><label>Quantidade<input type="number" min={0} max={5000} value={ruleForm.quantity} onChange={e=>setRuleForm(v=>({...v,quantity:Number(e.target.value)}))}/></label>
    <label>Vencimento<select value={ruleForm.endRoll} onChange={e=>setRuleForm(v=>({...v,endRoll:e.target.value}))}><option value="NONE">Sem prorrogação automática</option><option value="NEXT_BUSINESS">Próximo dia útil</option></select></label>
    <label className="deadline-check"><input type="checkbox" checked={ruleForm.recess} onChange={e=>setRuleForm(v=>({...v,recess:e.target.checked}))}/> Suspender no recesso 20/12–20/01</label><label className="deadline-check"><input type="checkbox" checked={ruleForm.doubleEligible} onChange={e=>setRuleForm(v=>({...v,doubleEligible:e.target.checked}))}/> Elegível a prazo em dobro</label>
    <div className="actions span-full"><button className="primary" disabled={busy}>Salvar nova versão</button></div>
   </form>}
   <div className="deadline-rules-list">{rules.map(r=><article key={`${r.code}-${r.version}`}><div><strong>{r.label}</strong><p>{labels[r.branch]??r.branch} · {labels[r.nature]??r.nature} · versão {r.version} · {r.preset?'Modelo de referência':'Personalizada'}</p></div><div className="actions"><span className={`deadline-status ${r.approved?'deadline-approved':'deadline-pending_review'}`}>{r.approved?'Disponível':'Não aprovada'}</span>{!r.approved&&r.id&&has('calendar.manage')&&<button className="ghost" onClick={()=>approveRule(r)}>Aprovar</button>}</div></article>)}</div>
   </section>
   <section className="panel">
     <div className="panel-head"><div><h2>Feriados judiciais e locais</h2>
       <p>Registre feriados nacionais, estaduais, do tribunal e municipais, sempre com fonte documental. Correções preservam a auditoria.</p>
     </div></div>
     {has('calendar.manage')&&<form className="entity-form" onSubmit={addHoliday}>
       <label>Abrangência<select value={holidayForm.scope} onChange={e=>setHolidayForm(v=>({...v,scope:e.target.value as HolidayScope}))}>
         {(Object.keys(holidayScopeLabels) as HolidayScope[]).map(key=><option key={key} value={key}>{holidayScopeLabels[key]}</option>)}
       </select></label>
       <label>Data do feriado<input type="date" required value={holidayForm.date} onChange={e=>setHolidayForm(v=>({...v,date:e.target.value}))}/></label>
       <label className="span-full">Nome do feriado<input required minLength={4} maxLength={160} value={holidayForm.name} onChange={e=>setHolidayForm(v=>({...v,name:e.target.value}))}/></label>
       {holidayForm.scope!=='NATIONAL'&&<label>UF<input required maxLength={2} value={holidayForm.state} onChange={e=>setHolidayForm(v=>({...v,state:e.target.value.toUpperCase()}))}/></label>}
       {(holidayForm.scope==='TRIBUNAL'||holidayForm.scope==='CITY')&&<label>Tribunal<input required maxLength={24} value={holidayForm.tribunalCode} onChange={e=>setHolidayForm(v=>({...v,tribunalCode:e.target.value.toUpperCase()}))}/></label>}
       {holidayForm.scope==='CITY'&&<label>Cidade<input required minLength={2} maxLength={100} value={holidayForm.city} onChange={e=>setHolidayForm(v=>({...v,city:e.target.value}))}/></label>}
       <label className="span-full">URL da fonte oficial (HTTPS)<input type="url" required pattern="https://.*" value={holidayForm.sourceUrl} onChange={e=>setHolidayForm(v=>({...v,sourceUrl:e.target.value}))} placeholder="https://..."/></label>
       <label className="span-full">Evidência documental<textarea required minLength={12} rows={2} value={holidayForm.evidence} onChange={e=>setHolidayForm(v=>({...v,evidence:e.target.value}))} placeholder="Ato normativo, portaria, calendário ou decisão oficial conferida"/></label>
       <div className="actions span-full"><button className="primary" disabled={busy}>Registrar feriado</button></div>
     </form>}
     <div className="actions"><label>Ano da consulta <input type="number" min={2000} max={2100} value={holidayYear} onChange={e=>{const year=Number(e.target.value);if(year>=2000&&year<=2100)setHolidayYear(year);}}/></label></div>
     {holidays.length===0?<p className="muted">Nenhum feriado cadastrado neste ano. Isso não comprova inexistência de feriados.</p>:
       <div className="deadline-rules-list">{holidays.map(item=><article key={item.id}>
         <div><strong>{item.name} · {display(item.date)}</strong>
           <p>{item.tribunalCode??'Todos os tribunais'} · {item.state??'Brasil'} · {item.city??'Todas as cidades'}</p>
           <p className="muted">{holidaySource(item.notes)}</p>
           <span className={`deadline-status ${item.active?'deadline-approved':'deadline-cancelled'}`}>{item.active?'Ativo':'Inativo'}</span>
         </div>
         {item.active&&has('calendar.manage')&&<button className="ghost" type="button" disabled={busy} onClick={()=>void deactivateHoliday(item)}>Desativar</button>}
       </article>)}</div>}
     <p className="muted">O registro de um feriado não valida todo o calendário anual. Alterações nos feriados exigem revisar os cálculos pendentes.</p>
   </section><section className="panel"><div className="panel-head"><h2>Validação de calendário local</h2></div><p className="muted">Cadastre feriados e suspensões na <Link to="/agenda">Agenda</Link>; após conferir o calendário oficial completo do tribunal e ano, registre a evidência abaixo. Esta ação não consulta uma API externa.</p>
   <form className="entity-form" onSubmit={e=>{e.preventDefault();void perform(()=>jsonRequest('/deadlines/calendar-coverage','POST',coverage),'Cobertura do calendário registrada pelo responsável.');}}>
    <label>Tribunal<input required value={coverage.tribunalCode} onChange={e=>setCoverage(v=>({...v,tribunalCode:e.target.value.toUpperCase()}))}/></label><label>UF<input required maxLength={2} value={coverage.state} onChange={e=>setCoverage(v=>({...v,state:e.target.value.toUpperCase()}))}/></label><label>Cidade<input value={coverage.city} onChange={e=>setCoverage(v=>({...v,city:e.target.value}))}/></label><label>Ano<input type="number" min={2000} max={2100} value={coverage.year} onChange={e=>setCoverage(v=>({...v,year:Number(e.target.value)}))}/></label>
    <label className="span-full">Fonte oficial consultada<input required type="url" value={coverage.sourceUrl} onChange={e=>setCoverage(v=>({...v,sourceUrl:e.target.value}))} placeholder="https://..."/></label><label className="span-full">Evidência de conferência completa<textarea required minLength={12} rows={2} value={coverage.evidence} onChange={e=>setCoverage(v=>({...v,evidence:e.target.value}))} placeholder="Ato normativo, dias suspensos, feriados e conferência documental"/></label>
    {has('calendar.manage')&&<button className="primary" disabled={busy}>Registrar validação</button>}
   </form>
  </section></>}
  {tab==='alerts'&&<section className="panel"><div className="panel-head"><div><h2>Alertas de prazo</h2><p>Alertas D-5, D-3, D-1 e prazo interno. Exibidos somente após aprovação.</p></div><button className="ghost" onClick={()=>void reload()}>Atualizar</button></div>{alerts.length===0?<p className="muted">Sem alertas pendentes até hoje.</p>:<div className="deadline-rules-list">{alerts.map(a=><article key={a.id}><div><strong>{labels[a.kind]??a.kind} · {a.deadline.ruleCode}</strong><p>{display(a.scheduledOn)} · prazo fatal {display(a.deadline.legalDueOn)} · {a.deadline.process?.npu??'Sem processo'}</p></div>{has('calendar.write')&&<button className="ghost" disabled={busy} onClick={()=>acknowledge(a.id)}>Marcar lido</button>}</article>)}</div>}<p className="muted">Alertas são persistidos para consulta dentro do SysADV; notificações externas por e-mail, SMS ou push ainda não estão habilitadas.</p></section>}
 </div>;
}
