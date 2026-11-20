import { useEffect,useState,type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { OfficeHeading,OfficeNotice,centsFromInput,moneyInput,officeRequest,readableError } from './OfficeShared';

type AiSettings={enabled:boolean;model:string;keyConfigured:boolean;source:'OFFICE'|'ENVIRONMENT'};
type Settings={name:string;officeEmail:string|null;officePhone:string|null;timezone:string;defaultHourlyRateCents:number;currency:string};
export function SettingsPage(){
 const {has}=useAuth();
 const [ai,setAi]=useState<AiSettings|null>(null);
 const [aiKey,setAiKey]=useState('');
 const [removeAiKey,setRemoveAiKey]=useState(false);
 const [aiLoading,setAiLoading]=useState(true);
 const [aiBusy,setAiBusy]=useState(false);
 const [aiError,setAiError]=useState('');
 const [aiSuccess,setAiSuccess]=useState('');
 const [form,setForm]=useState({name:'',officeEmail:'',officePhone:'',timezone:'America/Sao_Paulo',rate:'0,00'});const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [success,setSuccess]=useState('');
 useEffect(()=>{let live=true;void officeRequest<Settings>('/office/settings').then(s=>{if(live)setForm({name:s.name,officeEmail:s.officeEmail||'',officePhone:s.officePhone||'',timezone:s.timezone,rate:moneyInput(s.defaultHourlyRateCents)});}).catch(e=>{if(live)setError(readableError(e));}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[]);
 useEffect(()=>{let active=true;void officeRequest<AiSettings>('/office/legal-ai')
    .then(x=>{if(active)setAi(x);}).catch(e=>{if(active)setAiError(readableError(e));})
    .finally(()=>{if(active)setAiLoading(false);});return()=>{active=false;};},[]);
 async function saveAi(e:FormEvent){
  e.preventDefault();if(!ai)return;setAiBusy(true);setAiError('');setAiSuccess('');
  try{
    const payload={enabled:ai.enabled,model:ai.model,...(aiKey?{apiKey:aiKey}:{}),
      ...(removeAiKey?{clearApiKey:true}:{})};
    const saved=await officeRequest<AiSettings>('/office/legal-ai',
      {method:'PATCH',body:JSON.stringify(payload)});
    setAi(saved);setAiKey('');setRemoveAiKey(false);
    setAiSuccess('Configurações de IA atualizadas. A chave permanece protegida no servidor.');
  }catch(e){setAiError(readableError(e));}finally{setAiBusy(false);}
 }
 async function testAi(){
  setAiBusy(true);setAiError('');setAiSuccess('');
  try{await officeRequest('/office/legal-ai/test',{method:'POST'});
    setAiSuccess('Chave e acesso ao modelo validados. Este teste não confirma créditos ou limites de geração disponíveis.');
  }catch(e){setAiError(readableError(e));}finally{setAiBusy(false);}
 }
 async function save(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{await officeRequest('/office/settings',{method:'PATCH',body:JSON.stringify({name:form.name,officeEmail:form.officeEmail||null,officePhone:form.officePhone||null,timezone:form.timezone,defaultHourlyRateCents:centsFromInput(form.rate)})});setSuccess('Configurações do escritório atualizadas.');}catch(e){setError(readableError(e));}finally{setBusy(false);}}
 return <><OfficeHeading eyebrow="Administração · parâmetros" title="Configurações do escritório" description="Identificação, contatos e parâmetros internos por organização, com alteração restrita ao administrador."/><OfficeNotice error={error} success={success}/>
 {loading?<p className="muted">Carregando parâmetros…</p>:<section className="panel office-edit-panel"><h2>Dados do escritório</h2><form className="office-form" onSubmit={e=>void save(e)}><label className="office-span-2">Nome do escritório *<input required minLength={3} disabled={!has('settings.manage')} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>E-mail corporativo<input type="email" disabled={!has('settings.manage')} value={form.officeEmail} onChange={e=>setForm({...form,officeEmail:e.target.value})}/></label><label>Telefone<input type="tel" disabled={!has('settings.manage')} value={form.officePhone} onChange={e=>setForm({...form,officePhone:e.target.value})}/></label><label>Fuso horário<select disabled={!has('settings.manage')} value={form.timezone} onChange={e=>setForm({...form,timezone:e.target.value})}>{['America/Sao_Paulo','America/Manaus','America/Cuiaba','America/Recife','America/Belem','America/Rio_Branco','UTC'].map(v=><option key={v} value={v}>{v.replace('America/','')}</option>)}</select></label><label>Valor/hora sugerido (R$)<input inputMode="decimal" disabled={!has('settings.manage')} value={form.rate} onChange={e=>setForm({...form,rate:e.target.value})}/></label><div className="office-span-2 office-form-actions">{has('settings.manage')&&<button type="submit" className="primary" disabled={busy}>{busy?'Salvando…':'Salvar parâmetros'}</button>}</div></form></section>}
 <section className="panel office-edit-panel" aria-label="Configuração da inteligência artificial">
  <h2>Inteligência artificial jurídica — OpenAI</h2>
  <p className="muted">Configure a integração para este escritório. As credenciais são criptografadas no servidor e não são exibidas após salvar.</p>
  {aiError&&<p className="alert" role="alert">{aiError}</p>}
  {aiSuccess&&<p className="notice-success" role="status">{aiSuccess}</p>}
  {aiLoading?<p className="muted">Carregando configurações de IA…</p>:ai&&<form className="office-form" onSubmit={e=>void saveAi(e)}>
   <label className="office-span-2"><input type="checkbox" checked={ai.enabled} disabled={!has('settings.manage')}
    onChange={e=>setAi({...ai,enabled:e.target.checked})}/> Habilitar assistente de IA jurídica</label>
   <label>Modelo OpenAI<input required minLength={3} maxLength={80} value={ai.model}
    disabled={!has('settings.manage')} onChange={e=>setAi({...ai,model:e.target.value})}
    placeholder="gpt-4.1-mini"/></label>
   <label>Chave da API<input type="password" autoComplete="new-password" value={aiKey}
    disabled={!has('settings.manage')||removeAiKey}
    onChange={e=>setAiKey(e.target.value)} placeholder={ai.keyConfigured?'Chave cadastrada — digite para substituir':'Cole sua chave secreta'}
    aria-label="Chave da API OpenAI"/></label>
   <div className="office-span-2">
    <p className="muted">Chave: {ai.keyConfigured?'Configurada (oculta)':'Não configurada'} · Origem: {ai.source==='OFFICE'?'Cadastro do escritório':'Variáveis do servidor'}</p>
    {has('settings.manage')&&<label><input type="checkbox" checked={removeAiKey}
     onChange={e=>{setRemoveAiKey(e.target.checked);if(e.target.checked)setAiKey('');}}/> Revogar chave cadastrada neste escritório</label>}
   </div>
   <div className="office-form-actions office-span-2">{has('settings.manage')&&<>
    <button className="primary" type="submit" disabled={aiBusy}>{aiBusy?'Salvando…':'Salvar configuração de IA'}</button>
    <button className="ghost" type="button" onClick={()=>void testAi()} disabled={aiBusy||!ai.keyConfigured}>Testar conexão</button>
   </>}</div>
  </form>}
  <p className="muted">O envio de dados ao provedor exige autorização explícita do usuário no assistente jurídico. A liberação efetiva depende de a versão da API estar publicada e das migrações do banco aplicadas.</p>
 </section>
 <section className="panel"><h2>Gestão e conformidade</h2><div className="office-admin-links"><Link to="/users">Usuários e perfis</Link><Link to="/audit">Auditoria</Link><Link to="/integrations">Integrações judiciais</Link><Link to="/sources">Fontes de dados</Link></div><p className="muted">Alterações neste formulário não modificam automaticamente contratos, prazos processuais ou taxas já registradas.</p></section></>;
}
