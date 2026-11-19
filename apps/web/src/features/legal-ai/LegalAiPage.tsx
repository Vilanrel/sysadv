import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { officeRequest, readableError } from '../office/OfficeShared';

type Status={enabled:boolean;reviewRequired:boolean;provider:string;model:string};
type Result={draft:string;requiresHumanReview:boolean;sourceVerificationRequired:boolean;stored:boolean};

export function LegalAiPage(){
  const {has}=useAuth();
  const [status,setStatus]=useState<Status|null>(null);
  const [action,setAction]=useState<'DRAFT'|'REVIEW'|'OUTLINE'>('DRAFT');
  const [area,setArea]=useState('Civil');
  const [instructions,setInstructions]=useState('');
  const [referenceText,setReferenceText]=useState('');
  const [consent,setConsent]=useState(false);
  const [result,setResult]=useState<Result|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{void officeRequest<Status>('/legal-ai/status').then(setStatus).catch(e=>setError(readableError(e)));},[]);
  async function submit(event:FormEvent){
    event.preventDefault();if(!consent)return;
    setBusy(true);setError('');setResult(null);
    try {
      const response=await officeRequest<Result>('/legal-ai/drafts',{method:'POST',body:JSON.stringify({
        action,practiceArea:area,instructions,referenceText,
      })});
      setResult(response);
    }catch(e){setError(readableError(e));}finally{setBusy(false);}
  }
  return <main className="panel" style={{maxWidth:1050,margin:'0 auto'}}>
    <h1>Assistente de redação jurídica</h1>
    <p className="muted">Rascunhos para revisão por advogado. O resultado não comprova fontes nem substitui pesquisa jurídica.</p>
    {!status?.enabled&&<p role="status">Serviço não habilitado: administrador deve configurar LEGAL_AI_ENABLED e LEGAL_AI_API_KEY no servidor.</p>}
    {error&&<p role="alert">{error}</p>}
    <form onSubmit={e=>void submit(e)} className="office-form">
      <label>Modalidade<select value={action} onChange={e=>setAction(e.target.value as typeof action)}>
        <option value="DRAFT">Elaborar rascunho</option><option value="REVIEW">Revisar texto</option><option value="OUTLINE">Criar estrutura</option>
      </select></label>
      <label>Ramo do direito<input required minLength={2} maxLength={100} value={area} onChange={e=>setArea(e.target.value)}/></label>
      <label className="office-span-2">Objetivo e instruções<textarea required rows={6} minLength={20} maxLength={12000} value={instructions} onChange={e=>setInstructions(e.target.value)}/></label>
      <label className="office-span-2">Referências informadas pelo advogado (opcional)<textarea rows={6} maxLength={16000} value={referenceText} onChange={e=>setReferenceText(e.target.value)}/></label>
      <label className="office-span-2"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>
        Confirmo que revisei os dados fornecidos e estou autorizado a compartilhar este conteúdo com o provedor de IA externo.</label>
      <button className="primary office-span-2" type="submit" disabled={!has('document.generate')||!status?.enabled||!consent||busy}>
        {busy?'Gerando rascunho…':'Gerar para revisão'}
      </button>
    </form>
    {result&&<section className="panel" aria-label="Rascunho gerado">
      <h2>Rascunho — revisão jurídica obrigatória</h2>
      <p>Verifique fatos, legislação, precedentes, datas, citações e confidencialidade antes de utilizar.</p>
      <textarea readOnly rows={18} value={result.draft} style={{width:'100%'}} aria-label="Rascunho em texto"/>
      <button className="ghost" type="button" onClick={()=>void navigator.clipboard.writeText(result.draft)}>Copiar rascunho</button>
      <p className="muted">Não salvo automaticamente no banco. Não gera petição ou protocolo.</p>
    </section>}
  </main>;
}
