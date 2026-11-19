import {useEffect,useState,type FormEvent} from 'react';
import {useAuth} from '../auth/AuthProvider';
import {OfficeHeading,OfficeNotice,officeRequest,readableError} from '../office/OfficeShared';

type Rule={id:string;name:string;enabled:boolean;event:'INTAKE_CREATED'|'INTAKE_STATUS_CHANGED';action:'CREATE_TASK';taskTitle:string;dueOffsetDays:number;assignedToId:string|null};
const initial={name:'',enabled:false,event:'INTAKE_CREATED' as Rule['event'],action:'CREATE_TASK' as const,taskTitle:'Revisar atendimento: {assunto}',dueOffsetDays:0,assignedToId:null as string|null};

export function WorkflowsPage(){
 const {has}=useAuth();
 const [items,setItems]=useState<Rule[]>([]);const [form,setForm]=useState({...initial});
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [success,setSuccess]=useState('');
 const reload=()=>officeRequest<Rule[]>('/workflows/rules').then(setItems).catch(e=>setError(readableError(e)));
 useEffect(()=>{void reload();},[]);
 async function add(event:FormEvent){
  event.preventDefault();setBusy(true);setError('');setSuccess('');
  try{await officeRequest('/workflows/rules',{method:'POST',body:JSON.stringify(form)});setSuccess('Regra cadastrada desativada. Ative depois de revisar sua configuração.');setForm({...initial});await reload();}
  catch(e){setError(readableError(e));}finally{setBusy(false);}
 }
 async function toggle(rule:Rule){
  setBusy(true);setError('');try{await officeRequest('/workflows/rules/'+rule.id,{method:'PATCH',body:JSON.stringify({enabled:!rule.enabled})});setSuccess(rule.enabled?'Regra desativada.':'Regra ativada. Ela produzirá tarefas para eventos futuros.');await reload();}
  catch(e){setError(readableError(e));}finally{setBusy(false);}
 }
 return <><OfficeHeading eyebrow="Produtividade · operações jurídicas" title="Automações" description="Configure tarefas automáticas para novos atendimentos e mudanças de situação. As regras começam desativadas."/>
 <OfficeNotice error={error} success={success}/>
 <section className="panel office-list-panel">
 <h2>Regras cadastradas</h2>
 {items.length===0?<p className="muted">Nenhuma regra registrada.</p>:<div className="table-wrap"><table><thead><tr><th>Nome</th><th>Evento</th><th>Tarefa</th><th>Situação</th><th>Ação</th></tr></thead><tbody>{items.map(rule=><tr key={rule.id}><td>{rule.name}</td><td>{rule.event==='INTAKE_CREATED'?'Novo atendimento':'Mudança de situação'}</td><td>{rule.taskTitle}</td><td>{rule.enabled?'Ativa':'Desativada'}</td><td>{has('settings.manage')&&<button className="ghost office-small" disabled={busy} onClick={()=>void toggle(rule)}>{rule.enabled?'Desativar':'Ativar'}</button>}</td></tr>)}</tbody></table></div>}
 </section>
 {has('settings.manage')&&<section className="panel office-edit-panel"><h2>Nova regra</h2><form className="office-form" onSubmit={e=>void add(e)}>
 <label>Nome<input required minLength={3} maxLength={150} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
 <label>Evento<select value={form.event} onChange={e=>setForm({...form,event:e.target.value as Rule['event']})}><option value="INTAKE_CREATED">Novo atendimento</option><option value="INTAKE_STATUS_CHANGED">Mudança de situação</option></select></label>
 <label className="office-span-2">Título da tarefa<input required minLength={2} maxLength={200} value={form.taskTitle} onChange={e=>setForm({...form,taskTitle:e.target.value})}/><small>Variáveis: {'{assunto}'} e {'{situacao}'}</small></label>
 <label>Dias após o evento<input type="number" min={0} max={365} value={form.dueOffsetDays} onChange={e=>setForm({...form,dueOffsetDays:Number(e.target.value)})}/></label>
 <div className="office-form-actions office-span-2"><button className="primary" disabled={busy} type="submit">Salvar desativada</button></div>
 </form></section>}
 <p className="muted">Regras executam apenas criação interna de tarefas. Não enviam e-mails, mensagens ou documentos a terceiros.</p></>;
}
