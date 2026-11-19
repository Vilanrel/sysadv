import {useState,type FormEvent} from 'react';
import {useAuth} from '../auth/AuthProvider';
import {OfficeBlank,OfficeHeading,OfficeNotice,OfficeStatus,SearchFilter,Selection,PersonLookup,money,moneyInput,centsFromInput,officeRequest,readableError,useOfficeList,useOfficeReferences} from '../office/OfficeShared';

type Opportunity={id:string;title:string;stage:string;estimatedCents:number;clientId:string|null;intakeId:string|null;ownerId:string|null;expectedCloseOn:string|null;notes:string|null;client?:{name:string};owner?:{name:string}};
const stages=[['LEAD','Prospecção'],['QUALIFIED','Qualificação'],['PROPOSAL','Proposta'],['NEGOTIATION','Negociação'],['WON','Ganha'],['LOST','Perdida']];
const fresh={title:'',stage:'LEAD',estimated:'0,00',clientId:'',intakeId:'',ownerId:'',expectedCloseOn:'',notes:''};

export function CrmPage(){
 const {has}=useAuth();
 const [q,setQ]=useState('');const [stage,setStage]=useState('');const [page,setPage]=useState(1);
 const [open,setOpen]=useState(false);const [editing,setEditing]=useState<Opportunity|null>(null);
 const [form,setForm]=useState({...fresh});const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [success,setSuccess]=useState('');
 const refs=useOfficeReferences();
 const list=useOfficeList<Opportunity>(`/crm/opportunities?page=${page}&q=${encodeURIComponent(q)}&stage=${stage}`);
 function create(){setEditing(null);setForm({...fresh});setOpen(true);setError('');}
 function edit(o:Opportunity){setEditing(o);setForm({title:o.title,stage:o.stage,estimated:moneyInput(o.estimatedCents),clientId:o.clientId??'',intakeId:o.intakeId??'',ownerId:o.ownerId??'',expectedCloseOn:o.expectedCloseOn?.slice(0,10)??'',notes:o.notes??''});setOpen(true);setError('');}
 async function save(e:FormEvent){
   e.preventDefault();setBusy(true);setError('');try{
     const body={title:form.title,stage:form.stage,estimatedCents:centsFromInput(form.estimated),clientId:form.clientId||null,intakeId:form.intakeId||null,ownerId:form.ownerId||null,expectedCloseOn:form.expectedCloseOn||null,notes:form.notes||null};
     await officeRequest(editing?`/crm/opportunities/${editing.id}`:'/crm/opportunities',{method:editing?'PATCH':'POST',body:JSON.stringify(body)});
     setSuccess(editing?'Oportunidade atualizada.':'Oportunidade criada.');setOpen(false);await list.refresh();
   }catch(err){setError(readableError(err));}finally{setBusy(false);}
 }
 return <><OfficeHeading eyebrow="Relacionamento · funil comercial" title="Oportunidades" description="Acompanhe negociações com clientes sem duplicar o cadastro de pessoas." action={has('intake.write')&&<button className="primary" onClick={create}>+ Nova oportunidade</button>}/>
 <OfficeNotice error={error||list.error} success={success}/>
 <section className="panel office-list-panel"><div className="office-toolbar"><SearchFilter value={q} onChange={v=>{setQ(v);setPage(1)}} placeholder="Buscar oportunidade ou cliente"/>
 <label>Etapa<select value={stage} onChange={e=>{setStage(e.target.value);setPage(1)}}><option value="">Todas</option>{stages.map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label><span>{list.data.total} oportunidade(s)</span></div>
 {list.loading?<p>Carregando…</p>:list.data.items.length===0?<OfficeBlank>Nenhuma oportunidade encontrada.</OfficeBlank>:<div className="table-wrap"><table><thead><tr><th>Oportunidade</th><th>Cliente</th><th>Etapa</th><th>Valor estimado</th><th>Responsável</th><th>Ações</th></tr></thead><tbody>{list.data.items.map(o=><tr key={o.id}><td>{o.title}</td><td>{o.client?.name??'—'}</td><td><OfficeStatus value={o.stage}/></td><td>{money(o.estimatedCents)}</td><td>{o.owner?.name??'—'}</td><td>{has('intake.write')&&<button className="ghost office-small" onClick={()=>edit(o)}>Editar</button>}</td></tr>)}</tbody></table></div>}
 <div className="office-pagination"><button className="ghost" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Anterior</button><span>Página {page}</span><button className="ghost" disabled={page*list.data.pageSize>=list.data.total} onClick={()=>setPage(p=>p+1)}>Próxima</button></div></section>
 {open&&<section className="panel office-edit-panel"><div className="panel-head"><h2>{editing?'Atualizar oportunidade':'Nova oportunidade'}</h2><button className="ghost" onClick={()=>setOpen(false)}>Fechar</button></div><form className="office-form" onSubmit={e=>void save(e)}>
 <label className="office-span-2">Título *<input required minLength={2} maxLength={200} value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label>
 <PersonLookup label="Cliente" value={form.clientId} onChange={v=>setForm({...form,clientId:v})}/>
 <Selection label="Atendimento" value={form.intakeId} onChange={v=>setForm({...form,intakeId:v})} options={refs.intakes.map(x=>({id:x.id,name:x.subject}))}/>
 <label>Etapa<select value={form.stage} disabled={editing?.stage==='WON'||editing?.stage==='LOST'} onChange={e=>setForm({...form,stage:e.target.value})}>{stages.map(([v,t])=><option value={v} key={v}>{t}</option>)}</select></label>
 <label>Valor estimado (R$)<input inputMode="decimal" value={form.estimated} onChange={e=>setForm({...form,estimated:e.target.value})}/></label>
 <label>Previsão de fechamento<input type="date" value={form.expectedCloseOn} onChange={e=>setForm({...form,expectedCloseOn:e.target.value})}/></label>
 <label className="office-span-2">Notas<textarea rows={4} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
 <div className="office-form-actions office-span-2"><button disabled={busy} className="primary" type="submit">{busy?'Salvando…':'Salvar'}</button><button className="ghost" type="button" onClick={()=>setOpen(false)}>Cancelar</button></div></form></section>}
 </>;
}
