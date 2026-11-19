import {useEffect,useState,type FormEvent} from 'react';
import {useAuth} from '../auth/AuthProvider';
import {OfficeHeading,OfficeNotice,Selection,PersonLookup,officeRequest,readableError,useOfficeReferences} from '../office/OfficeShared';

type Request={id:string;title:string;status:string;legalBasis:string;authorizationReference:string|null;sourceName:string|null;evidenceReference:string|null;resultSummary:string|null;process:{npu:string};subject:{name:string}};
export function AssetResearchPage(){
 const {has}=useAuth();const refs=useOfficeReferences();
 const [items,setItems]=useState<Request[]>([]);const [title,setTitle]=useState('');const [processId,setProcessId]=useState('');const [subjectPersonId,setSubjectPersonId]=useState('');const [legalBasis,setLegalBasis]=useState('');
 const [reviewing,setReviewing]=useState<Request|null>(null);const [reviewStatus,setReviewStatus]=useState('REQUESTED');const [authorizationReference,setAuthorizationReference]=useState('');const [sourceName,setSourceName]=useState('');const [evidenceReference,setEvidenceReference]=useState('');const [resultSummary,setResultSummary]=useState('');
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
 function review(row:Request){setReviewing(row);setReviewStatus(row.status);setAuthorizationReference(row.authorizationReference??'');setSourceName(row.sourceName??'');setEvidenceReference(row.evidenceReference??'');setResultSummary(row.resultSummary??'');setError('');}
 async function saveReview(e:FormEvent){e.preventDefault();if(!reviewing)return;setBusy(true);setError('');try{
   await officeRequest('/asset-research/'+reviewing.id,{method:'PATCH',body:JSON.stringify({status:reviewStatus,authorizationReference:authorizationReference||undefined,sourceName:sourceName||undefined,evidenceReference:evidenceReference||undefined,resultSummary:resultSummary||undefined})});
   setReviewing(null);setSuccess('Andamento registrado com rastreabilidade.');await load();
 }catch(e){setError(readableError(e));}finally{setBusy(false);}}
 return <><OfficeHeading eyebrow="Execuções · pesquisa patrimonial" title="Solicitações de pesquisa" description="Registre a finalidade e o fundamento jurídico. Este módulo não consulta automaticamente bancos, registradores ou cadastros restritos."/>
 <OfficeNotice error={error} success={success}/>
 <section className="panel office-list-panel"><h2>Solicitações</h2><div className="table-wrap"><table><thead><tr><th>Assunto</th><th>Processo</th><th>Pessoa</th><th>Status</th><th>Ações</th></tr></thead><tbody>{items.map(item=><tr key={item.id}><td>{item.title}</td><td>{item.process.npu}</td><td>{item.subject.name}</td><td>{item.status}</td><td>{has('process.update')&&has('audit.read')&&!['COMPLETED','CANCELLED'].includes(item.status)&&<button className="ghost office-small" onClick={()=>review(item)}>Atualizar</button>}</td></tr>)}</tbody></table></div>{items.length===0&&<p className="muted">Nenhuma solicitação registrada.</p>}</section>
 {reviewing&&<section className="panel office-edit-panel"><div className="panel-head"><h2>Andamento · {reviewing.title}</h2><button className="ghost" onClick={()=>setReviewing(null)}>Fechar</button></div>
 <p className="muted">Registre apenas autorizações e evidências obtidas por meios legalmente permitidos. Nenhuma consulta externa será disparada.</p>
 <form className="office-form" onSubmit={e=>void saveReview(e)}>
 <label>Situação<select value={reviewStatus} onChange={e=>setReviewStatus(e.target.value)}><option value="REQUESTED">Solicitada</option><option value="AUTHORIZED">Autorizada</option><option value="IN_PROGRESS">Em andamento</option><option value="COMPLETED">Concluída</option><option value="CANCELLED">Cancelada</option></select></label>
 <label>Referência da autorização<input maxLength={500} value={authorizationReference} onChange={e=>setAuthorizationReference(e.target.value)}/></label>
 <label>Fonte autorizada<input maxLength={150} value={sourceName} onChange={e=>setSourceName(e.target.value)}/></label>
 <label>Referência documental da evidência<input maxLength={500} value={evidenceReference} onChange={e=>setEvidenceReference(e.target.value)}/></label>
 <label className="office-span-2">Resumo do resultado<textarea maxLength={4000} rows={4} value={resultSummary} onChange={e=>setResultSummary(e.target.value)}/></label>
 <div className="office-form-actions office-span-2"><button className="primary" disabled={busy} type="submit">Registrar andamento</button></div>
 </form></section>}
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
