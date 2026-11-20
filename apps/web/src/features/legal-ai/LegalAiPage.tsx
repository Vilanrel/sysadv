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
  const [citations,setCitations]=useState<{reference:string;type:string;status:string}[]>([]);
  const [citationLinks,setCitationLinks]=useState<Record<string,string>>({});
  const [citationConfirmed,setCitationConfirmed]=useState<Record<string,boolean>>({});
  const [citationAttested,setCitationAttested]=useState<Record<string,boolean>>({});
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{void officeRequest<Status>('/legal-ai/status').then(setStatus).catch(e=>setError(readableError(e)));},[]);
  async function reviewCitations(){
    if(!result)return;
    setError('');
    try{
      const review=await officeRequest<{references:{reference:string;type:string;status:string}[]}>('/legal-ai/citation-review',{method:'POST',body:JSON.stringify({text:result.draft})});
      setCitations(review.references);
    }catch(e){setError(readableError(e));}
  }
  async function attestCitation(c:{reference:string;type:string}){
    setBusy(true);setError('');
    try{
      await officeRequest('/legal-ai/citation-attestations',{method:'POST',
        body:JSON.stringify({reference:c.reference,referenceType:c.type,sourceUrl:citationLinks[c.reference],personallyChecked:true}),
      });
      setCitationAttested(prev=>({...prev,[c.reference]:true}));
    }catch(e){setError(readableError(e));}finally{setBusy(false);}
  }
  async function submit(event:FormEvent){
    event.preventDefault();if(!consent)return;
    setBusy(true);setError('');setResult(null);setCitations([]);setCitationLinks({});setCitationConfirmed({});setCitationAttested({});
    try {
      const response=await officeRequest<Result>('/legal-ai/drafts',{method:'POST',body:JSON.stringify({
        action,practiceArea:area,instructions,referenceText,approvedForExternalProvider:consent,
      })});
      setResult(response);
    }catch(e){setError(readableError(e));}finally{setBusy(false);}
  }
  return <main className="panel" style={{maxWidth:1050,margin:'0 auto'}}>
    <h1>Assistente de redação jurídica</h1>
    <p className="muted">Rascunhos para revisão por advogado. O resultado não comprova fontes nem substitui pesquisa jurídica.</p>
    {!status?.enabled&&<p role="status">Serviço não habilitado. Solicite ao administrador que acesse Configurações do escritório e configure a Inteligência Artificial.</p>}
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
      <button className="ghost" type="button" onClick={()=>void reviewCitations()}>Listar referências para conferência</button>
      {citations.length>0&&<section><h3>Referências para conferência humana</h3>
       <p className="muted">O sistema não consulta nem comprova o conteúdo das fontes. Registre uma confirmação somente após conferir pessoalmente a referência na página oficial.</p>
       <ul>{citations.map((c,i)=><li key={i}><strong>{c.reference}</strong> ({c.type}) — {citationAttested[c.reference]?'Conferência humana registrada':'Pendente de conferência'}
         {!citationAttested[c.reference]&&<div className="office-form">
          <label className="office-span-2">URL da fonte oficial<input type="url" value={citationLinks[c.reference]??''} onChange={e=>setCitationLinks(prev=>({...prev,[c.reference]:e.target.value}))} placeholder="https://...jus.br/..."/></label>
          <label className="office-span-2"><input type="checkbox" checked={citationConfirmed[c.reference]??false} onChange={e=>setCitationConfirmed(prev=>({...prev,[c.reference]:e.target.checked}))}/> Eu verifiquei pessoalmente o texto na fonte indicada.</label>
          <button className="ghost office-span-2" type="button" disabled={busy||!citationConfirmed[c.reference]||!citationLinks[c.reference]} onClick={()=>void attestCitation(c)}>Registrar conferência humana</button>
         </div>}</li>)}</ul></section>}
      <p className="muted">Não salvo automaticamente no banco. Não gera petição ou protocolo.</p>
    </section>}
  </main>;
}
