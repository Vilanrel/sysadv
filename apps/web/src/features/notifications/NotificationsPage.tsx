import {useEffect,useState} from 'react';
import {OfficeHeading,OfficeNotice,officeRequest,readableError} from '../office/OfficeShared';
type Note={id:string;title:string;body:string|null;readAt:string|null;createdAt:string};
type Inbox={items:Note[];unread:number};
export function NotificationsPage(){
 const [data,setData]=useState<Inbox>({items:[],unread:0});const [emailOptIn,setEmailOptIn]=useState(false);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const load=()=>officeRequest<Inbox>('/notifications').then(setData).catch(e=>setError(readableError(e)));
 useEffect(()=>{void load();void officeRequest<{emailEnabled:boolean}>('/notifications/preferences').then(p=>setEmailOptIn(p.emailEnabled)).catch(()=>{});},[]);
 async function optIn(v:boolean){setBusy(true);setError('');try{const result=await officeRequest<{emailEnabled:boolean}>('/notifications/preferences',{method:'PATCH',body:JSON.stringify({emailEnabled:v})});setEmailOptIn(result.emailEnabled);}catch(e){setError(readableError(e));}finally{setBusy(false);}}
 async function mark(id:string){setBusy(true);setError('');try{await officeRequest('/notifications/'+id+'/read',{method:'POST'});await load();}catch(e){setError(readableError(e));}finally{setBusy(false);}}
 return <><OfficeHeading eyebrow="Alertas internos · minha conta" title="Notificações" description="Avisos gerados pelo sistema para o usuário autenticado. Este módulo não envia e-mails ou SMS."/>
 <OfficeNotice error={error}/>
 <section className="panel"><label><input type="checkbox" disabled={busy} checked={emailOptIn} onChange={e=>void optIn(e.target.checked)}/> Aceito receber alertas genéricos por e-mail, quando o serviço estiver habilitado.</label><p className="muted">E-mails não incluem detalhes confidenciais. Você pode revogar este consentimento a qualquer momento.</p></section>
 <section className="panel office-list-panel"><p>{data.unread} aviso(s) não lido(s)</p><div className="table-wrap"><table><thead><tr><th>Mensagem</th><th>Data</th><th>Situação</th><th>Ação</th></tr></thead><tbody>{data.items.map(n=><tr key={n.id}><td><strong>{n.title}</strong><small className="office-secondary">{n.body??''}</small></td><td>{new Date(n.createdAt).toLocaleString('pt-BR')}</td><td>{n.readAt?'Lida':'Pendente'}</td><td>{!n.readAt&&<button disabled={busy} className="ghost office-small" onClick={()=>void mark(n.id)}>Marcar lida</button>}</td></tr>)}</tbody></table></div>{!data.items.length&&<p className="muted">Nenhuma notificação disponível.</p>}</section></>;
}
