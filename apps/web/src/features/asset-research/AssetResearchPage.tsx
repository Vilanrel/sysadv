import {useEffect,useState,type FormEvent} from 'react';
import {useAuth} from '../auth/AuthProvider';
import {OfficeHeading,OfficeNotice,Selection,PersonLookup,officeRequest,readableError,useOfficeReferences} from '../office/OfficeShared';

type Request={id:string;title:string;status:string;legalBasis:string;authorizationReference:string|null;process:{npu:string};subject:{name:string}};
export function AssetResearchPage(){
 const {has}=useAuth();const refs=useOfficeReferences();
 const [items,setItems]=useState<Request[]>([]);const [title,setTitle]=useState('');const [processId,setProcessId]=useState('');const [subjectPersonId,setSubjectPersonId]=useState('');const [legalBasis,setLegalBasis]=useState('');
 const [error,setError]=useState('');const [success,setSuccess]=useState('');const [busy,setBusy]=useState(false);
 const load=()=>officeRequest<Request[]>('/asset-research').then(setItems).catch(e=>setError(readableError(e)));
 useEffect(()=>{void load();},[]);
 async function save(e:FormEvent){
  e.preventDefault();setBusy(true);setError('');try{
   await officeRequest('/asset-research',{method:'POST',body:JSON.stringify({title,processId,subjectPersonId,legalBasis})});
   setSuccess('Solicitação registrada. A pesquisa depende de autorização e execução por fonte habilitada.');
   setTitle('');setProcessId('');setSubjectPersonId('');setLegalBasis('');await load();
  }catch(e){setError(readableError(e));}finally{setBusy(false);}
 }
 return <><OfficeHeading eyebrow="Execuções · pesquisa patrimonial" title="Solicitações de pesquisa" description="Registre a finalidade e o fundamento jurídico. Este módulo não consulta automaticamente bancos, registradores ou cadastros restritos."/>
 <OfficeNotice error={error} success={success}/>
 <section className="panel office-list-panel"><h2>Solicitações</h2><div className="table-wrap"><table><thead><tr><th>Assunto</th><th>Processo</th><th>Pessoa</th><th>Status</th></tr></thead><tbody>{items.map(item=><tr key={item.id}><td>{item.title}</td><td>{item.process.npu}</td><td>{item.subject.name}</td><td>{item.status}</td></tr>)}</tbody></table></div>{items.length===0&&<p className="muted">Nenhuma solicitação registrada.</p>}</section>
 {has('process.update')&&<section className="panel office-edit-panel"><h2>Nova solicitação</h2>
 <form className="office-form" onSubmit={e=>void save(e)}>
 <label className="office-span-2">Título<input required minLength={3} maxLength={200} value={title} onChange={e=>setTitle(e.target.value)}/></label>
 <Selection label="Processo" value={processId} required onChange={setProcessId} options={refs.processes.map(x=>({id:x.id,name:x.npu}))}/>
 <PersonLookup label="Pessoa pesquisada" required value={subjectPersonId} onChange={setSubjectPersonId}/>
 <label className="office-span-2">Fundamento e finalidade jurídica<textarea required minLength={20} maxLength={4000} rows={5} value={legalBasis} onChange={e=>setLegalBasis(e.target.value)}/></label>
 <div className="office-form-actions office-span-2"><button type="submit" className="primary" disabled={busy}>Registrar solicitação</button></div>
 </form></section>}
 </>;
}
