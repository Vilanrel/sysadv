import {useEffect,useState,type FormEvent} from 'react';
import {useAuth} from '../auth/AuthProvider';
import {OfficeBlank,OfficeHeading,OfficeNotice,OfficeStatus,Selection,officeRequest,readableError,useOfficeList,useOfficeReferences,money,moneyInput,centsFromInput} from '../office/OfficeShared';

type Diligence={id:string;title:string;description:string|null;status:string;processId:string|null;correspondentId:string|null;scheduledAt:string|null;feeCents:number;evidenceReference:string|null;completionNotes:string|null;process?:{npu:string};correspondent?:{name:string}};
type Correspondent={id:string;name:string};
const statuses=[['REQUESTED','Solicitada'],['ACCEPTED','Aceita'],['IN_PROGRESS','Em andamento'],['COMPLETED','Concluída'],['CANCELLED','Cancelada']];
const fresh={title:'',description:'',status:'REQUESTED',processId:'',correspondentId:'',scheduledAt:'',fee:'0,00',evidenceReference:'',completionNotes:''};
export function DiligencesPage(){
 const {has}=useAuth();const [filter,setFilter]=useState('');const [page,setPage]=useState(1);
 const [correspondents,setCorrespondents]=useState<Correspondent[]>([]);
 const [editing,setEditing]=useState<Diligence|null>(null);const [open,setOpen]=useState(false);
 const [form,setForm]=useState({...fresh});const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [success,setSuccess]=useState('');
 const list=useOfficeList<Diligence>(`/diligences?page=${page}&status=${filter}`);const refs=useOfficeReferences();
 useEffect(()=>{void officeRequest<Correspondent[]>('/diligences/correspondents').then(setCorrespondents).catch(()=>{});},[]);
 function create(){setEditing(null);setForm({...fresh});setOpen(true);setError('');}
 function edit(row:Diligence){setEditing(row);setForm({title:row.title,description:row.description??'',status:row.status,processId:row.processId??'',correspondentId:row.correspondentId??'',scheduledAt:row.scheduledAt?new Date(row.scheduledAt).toISOString().slice(0,16):'',fee:moneyInput(row.feeCents),evidenceReference:row.evidenceReference??'',completionNotes:row.completionNotes??''});setOpen(true);setError('');}
 async function save(event:FormEvent){event.preventDefault();setBusy(true);setError('');try{
  const body={title:form.title,description:form.description||null,status:form.status,processId:form.processId||null,correspondentId:form.correspondentId||null,scheduledAt:form.scheduledAt?new Date(form.scheduledAt).toISOString():null,feeCents:centsFromInput(form.fee),...(editing?{evidenceReference:form.evidenceReference||null,completionNotes:form.completionNotes||null}:{})};
  await officeRequest(editing?`/diligences/${editing.id}`:'/diligences',{method:editing?'PATCH':'POST',body:JSON.stringify(body)});
  setSuccess(editing?'Diligência atualizada.':'Diligência cadastrada.');setOpen(false);await list.refresh();
 }catch(e){setError(readableError(e));}finally{setBusy(false);}}
 return <><OfficeHeading eyebrow="Serviços externos · correspondentes" title="Diligências" description="Controle de diligências por processo, responsável externo e situação. Cadastre correspondentes em Clientes e pessoas, no papel CORRESPONDENT." action={has('task.write')&&<button className="primary" onClick={create}>+ Nova diligência</button>}/>
 <OfficeNotice error={error||list.error} success={success}/>
 <section className="panel office-list-panel"><div className="office-toolbar"><label>Situação<select value={filter} onChange={e=>{setFilter(e.target.value);setPage(1)}}><option value="">Todas</option>{statuses.map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label><span>{list.data.total} diligência(s)</span></div>
 {list.loading?<p>Carregando…</p>:list.data.items.length===0?<OfficeBlank>Nenhuma diligência cadastrada.</OfficeBlank>:<div className="table-wrap"><table><thead><tr><th>Descrição</th><th>Processo</th><th>Correspondente</th><th>Situação</th><th>Custo previsto</th><th>Ações</th></tr></thead><tbody>{list.data.items.map(row=><tr key={row.id}><td>{row.title}</td><td>{row.process?.npu??'—'}</td><td>{row.correspondent?.name??'—'}</td><td><OfficeStatus value={row.status}/></td><td>{money(row.feeCents)}</td><td>{has('task.write')&&<button className="ghost office-small" onClick={()=>edit(row)}>Editar</button>}</td></tr>)}</tbody></table></div>}
 <div className="office-pagination"><button className="ghost" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Anterior</button><span>Página {page}</span><button className="ghost" disabled={page*list.data.pageSize>=list.data.total} onClick={()=>setPage(p=>p+1)}>Próxima</button></div></section>
 {open&&<section className="panel office-edit-panel"><div className="panel-head"><h2>{editing?'Editar diligência':'Nova diligência'}</h2><button className="ghost" onClick={()=>setOpen(false)}>Fechar</button></div><form className="office-form" onSubmit={e=>void save(e)}>
 <label className="office-span-2">Título *<input required minLength={2} maxLength={200} value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label>
 <Selection label="Processo" value={form.processId} onChange={v=>setForm({...form,processId:v})} options={refs.processes.map(x=>({id:x.id,name:x.npu}))}/>
 <Selection label="Correspondente" value={form.correspondentId} onChange={v=>setForm({...form,correspondentId:v})} options={correspondents.map(x=>({id:x.id,name:x.name}))}/>
 <label>Situação<select value={form.status} disabled={!editing||editing?.status==='COMPLETED'||editing?.status==='CANCELLED'} onChange={e=>setForm({...form,status:e.target.value})}>{statuses.map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label>
 <label>Valor previsto (R$)<input inputMode="decimal" value={form.fee} onChange={e=>setForm({...form,fee:e.target.value})}/></label>
 <label>Data prevista<input type="datetime-local" value={form.scheduledAt} onChange={e=>setForm({...form,scheduledAt:e.target.value})}/></label>
 <label className="office-span-2">Instruções<textarea rows={4} maxLength={12000} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
 {editing&&<><label className="office-span-2">Referência da evidência de execução<input maxLength={500} value={form.evidenceReference} onChange={e=>setForm({...form,evidenceReference:e.target.value})} placeholder="Identificador ou URL de documento autorizado"/></label><label className="office-span-2">Relato da conclusão<textarea rows={3} maxLength={4000} value={form.completionNotes} onChange={e=>setForm({...form,completionNotes:e.target.value})}/></label></>}
 <div className="office-form-actions office-span-2"><button type="submit" disabled={busy} className="primary">{busy?'Salvando…':'Salvar'}</button><button type="button" className="ghost" onClick={()=>setOpen(false)}>Cancelar</button></div></form></section>}
 </>;
}
