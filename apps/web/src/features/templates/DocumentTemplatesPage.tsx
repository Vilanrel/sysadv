import { useEffect, useMemo, useState } from 'react';
import { useFeedback } from '../../components/feedback';
import { Link, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../auth/api';
import { useAuth } from '../auth/AuthProvider';

type TemplateSummary = { id: string; name: string; category: string; version: number; updatedAt: string; context: 'PROCESS' | 'GENERAL' };
type TemplateForm = { id?: string; version: number; name: string; category: string; description: string; context: 'PROCESS'|'GENERAL'; content: string; header: string; footer: string };
type TemplateBlock = { id:string; name:string; content:string; scope:'GENERIC'|'EXCLUSIVE'; recommended:boolean };
type ProcessSummary = { id:string; npu:string; claimant?:string|null; defendant?:string|null };
type Preview = { text:string; unresolved:string[]; templateVersion:number };
type HistoryItem = { id:string; version:number; createdAt:string; snapshot:Partial<TemplateForm> };
const blank: TemplateForm = { version:0, name:'', category:'Peticoes', description:'', context:'PROCESS', content:'', header:'', footer:'' };
const variables = [
  ['processo.numero','Numero do processo'],['processo.autor','Parte autora'],['processo.reu','Parte re'],
  ['processo.tribunal','Tribunal'],['processo.orgao','Orgao julgador'],['processo.advogado','Advogado'],
  ['processo.fase','Fase'],['usuario.nome','Usuario'],['data.atual','Data de hoje']
] as const;
const errorLabels: Record<string,string> = {
  INVALID_INPUT:'Verifique os campos obrigatorios e os limites de tamanho.',
  VERSION_CONFLICT:'Este modelo foi alterado em outra sessao. Recarregue antes de salvar.',
  MISSING_VARIABLES:'Ha variaveis sem valor. Revise o cadastro do processo ou o texto do modelo.',
  INVALID_DOCX:'O arquivo DOCX nao foi reconhecido.',
  FILE_TOO_LARGE:'Arquivo maior que 5 MB.',
  PROCESS_NOT_FOUND:'Processo nao localizado na organizacao.',
  FORBIDDEN:'Sem permissao para esta operacao.'
};
async function readError(response: Response) {
  const data=await response.json().catch(()=>({}));
  return {message:errorLabels[data.error] || String(data.error || `Falha HTTP ${response.status}`), fields:data.unresolved as string[]|undefined};
}
function makePayload(form: TemplateForm) {
  return { name:form.name.trim(), category:form.category.trim() || 'Geral', context:form.context,
    description:form.description, content:form.content, header:form.header, footer:form.footer };
}
function saveBlob(bytes: Blob, fileName: string) {
  const url=URL.createObjectURL(bytes);
  const link=document.createElement('a');link.href=url;link.download=fileName;
  document.body.appendChild(link);link.click();link.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),1500);
}

export function DocumentTemplatesPage() {const fb=useFeedback();
  const {has}=useAuth();
  const canManage=has('document.template.manage');
  const canGenerate=has('document.generate') && has('document.upload');
  const [params]=useSearchParams();
  const [list,setList]=useState<TemplateSummary[]>([]);
  const [form,setForm]=useState<TemplateForm>(blank);
  const [blocks,setBlocks]=useState<TemplateBlock[]>([]);
  const [processes,setProcesses]=useState<ProcessSummary[]>([]);
  const [processId,setProcessId]=useState(params.get('processId')||'');
  const [selectedBlocks,setSelectedBlocks]=useState<string[]>([]);
  const [includeHeader,setIncludeHeader]=useState(true);
  const [includeFooter,setIncludeFooter]=useState(true);
  const [privateFile,setPrivateFile]=useState(false);
  const [hideClient,setHideClient]=useState(false);
  const [exportFormat,setExportFormat]=useState<'PDF'|'DOCX'>('PDF');
  const [fileName,setFileName]=useState('');
  const [preview,setPreview]=useState<Preview|null>(null);
  const [query,setQuery]=useState('');
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [dirty,setDirty]=useState(false);
  const [working,setWorking]=useState(false);
  const [showVersions,setShowVersions]=useState(false);
  const [versions,setVersions]=useState<HistoryItem[]>([]);
  const [newBlock,setNewBlock]=useState({name:'',content:'',scope:'EXCLUSIVE' as 'EXCLUSIVE'|'GENERIC'});
  const [showBlocks,setShowBlocks]=useState(false);

  const filtered=useMemo(()=>list.filter(item=>`${item.name} ${item.category}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))),[list,query]);
  async function refreshList() {
    const r=await apiFetch('/document-templates');
    if (r.ok) setList(await r.json());
    else setError((await readError(r)).message);
  }
  async function refreshBlocks(id?: string) {
    const r=await apiFetch(`/document-templates/blocks${id?`?templateId=${encodeURIComponent(id)}`:''}`);
    if (r.ok) setBlocks(await r.json());
  }
  useEffect(()=>{
    void refreshList(); void refreshBlocks();
    void apiFetch('/processes').then(async r=>{if(r.ok)setProcesses(await r.json());});
  },[]);
  async function openTemplate(id: string) {
    setError('');setMessage('');setPreview(null);setShowVersions(false);
    const r=await apiFetch(`/document-templates/${id}`);
    if (!r.ok) {setError((await readError(r)).message);return;}
    const d=await r.json();
    setForm({id:d.id,version:d.version,name:d.name,category:d.category,context:d.context,
      description:d.description||'',content:d.content,header:d.header||'',footer:d.footer||''});
    setFileName(d.name);setDirty(false);setSelectedBlocks([]);setBlocks(d.blocks||[]);
  }
  function createNew(){setForm({...blank});setFileName('');setPreview(null);setDirty(false);setMessage('');setError('');setShowVersions(false);void refreshBlocks();}
  function change<K extends keyof TemplateForm>(key:K,value:TemplateForm[K]) {setForm(old=>({...old,[key]:value}));setDirty(true);setPreview(null);}
  function insert(text: string) {change('content',`${form.content}${form.content&&!form.content.endsWith('\n')?'\n':''}${text}`);}
  async function save() {
    setWorking(true);setError('');setMessage('');
    try {
      const r=await apiFetch(form.id?`/document-templates/${form.id}`:'/document-templates',{method:form.id?'PUT':'POST',body:JSON.stringify({...makePayload(form),...(form.id?{expectedVersion:form.version}:{})})});
      if(!r.ok){setError((await readError(r)).message);return;}
      const created=await r.json();
      setForm(old=>({...old,id:created.id,version:created.version}));setDirty(false);
      setMessage(`Modelo salvo na versao ${created.version}.`);
      await refreshList();await refreshBlocks(created.id);
    } finally {setWorking(false);}
  }
  async function archive() {
    if(!form.id||!(await fb.confirm({title:'Arquivar este modelo? Os documentos ja gerados serao preservados.',tone:'danger'})))return;
    const r=await apiFetch(`/document-templates/${form.id}`,{method:'DELETE'});
    if(r.ok){createNew();await refreshList();setMessage('Modelo arquivado.');}
    else setError((await readError(r)).message);
  }
  async function onImport(file?: File) {
    if(!file)return;
    setError('');setMessage('');
    if(!file.name.toLowerCase().endsWith('.docx')||file.size>5*1024*1024){setError('Selecione um DOCX de ate 5 MB.');return;}
    const body=new FormData();body.append('file',file);
    setWorking(true);
    try {
      const r=await apiFetch('/document-templates/import',{method:'POST',body});
      if(!r.ok){setError((await readError(r)).message);return;}
      const d=await r.json();await refreshList();await openTemplate(d.id);
      setMessage('Texto importado. Confira e ajuste a formatacao antes de gerar documentos.');
    } finally {setWorking(false);}
  }
  async function addBlock() {
    if(!newBlock.name.trim()||!newBlock.content.trim()){setError('Informe nome e conteudo do bloco.');return;}
    if(newBlock.scope==='EXCLUSIVE'&&!form.id){setError('Salve o modelo antes de criar bloco exclusivo.');return;}
    const r=await apiFetch('/document-templates/blocks',{method:'POST',body:JSON.stringify({...newBlock,templateId:newBlock.scope==='EXCLUSIVE'?form.id:undefined,recommended:true})});
    if(!r.ok){setError((await readError(r)).message);return;}
    const block=await r.json();
    await refreshBlocks(form.id);
    insert(`{{bloco:${block.id}}}`);
    setNewBlock({name:'',content:'',scope:'EXCLUSIVE'});setMessage('Bloco criado e marcador inserido. Salve o modelo.');
  }
  async function removeBlock(id: string) {
    if(!(await fb.confirm({title:'Excluir bloco? Modelos que o utilizem precisam de revisao.',tone:'danger'})))return;
    const r=await apiFetch(`/document-templates/blocks/${id}`,{method:'DELETE'});
    if(r.ok)await refreshBlocks(form.id);
    else setError((await readError(r)).message);
  }
  async function showHistory() {
    if(!form.id)return;
    const r=await apiFetch(`/document-templates/${form.id}/versions`);
    if(r.ok){setVersions(await r.json());setShowVersions(true);}
  }
  function restoreFrom(history: HistoryItem) {
    setForm(old=>({...old,...history.snapshot,id:old.id,version:old.version,description:history.snapshot.description||'',header:history.snapshot.header||'',footer:history.snapshot.footer||''}));
    setDirty(true);setShowVersions(false);setMessage('Versao anterior carregada no editor. Clique em Salvar para criar nova versao.');
  }
  async function buildPreview() {
    if(!form.id||dirty){setError('Salve o modelo antes de gerar a previa.');return;}
    setWorking(true);setError('');setMessage('');
    try {
      const r=await apiFetch(`/document-templates/${form.id}/preview`,{method:'POST',body:JSON.stringify({processId:processId||undefined,selectedBlockIds:selectedBlocks,includeHeader,includeFooter})});
      if(r.ok)setPreview(await r.json());
      else setError((await readError(r)).message);
    }finally{setWorking(false);}
  }
  async function generate() {
    if(!form.id||!processId){setError('Selecione um processo para vincular o documento.');return;}
    if(dirty){setError('Salve o modelo antes de gerar o documento.');return;}
    setWorking(true);setError('');setMessage('');
    try {
      const r=await apiFetch(`/document-templates/${form.id}/generate`,{method:'POST',body:JSON.stringify({processId,selectedBlockIds:selectedBlocks,includeHeader,includeFooter,format:exportFormat,fileName:fileName||form.name,isPrivate:privateFile,hiddenFromClient:hideClient})});
      if(!r.ok){const err=await readError(r);setError(`${err.message}${err.fields?.length?` Campos: ${err.fields.join(', ')}`:''}`);return;}
      const body=await r.json();
      const downloaded=await apiFetch(`/documents/${body.document.id}/download`);
      if(downloaded.ok)saveBlob(await downloaded.blob(),body.document.originalName);
      setMessage(`Documento vinculado ao processo com sucesso (modelo v${body.templateVersion}).`);
      setPreview(null);
    } finally {setWorking(false);}
  }
  return <>
    <div className="page-heading"><div><span className="eyebrow">Documentos / Modelos</span><h1>Modelos juridicos</h1><p>Crie pecas com blocos reutilizaveis, variaveis e geracao vinculada ao processo.</p></div><div className="actions">{canManage&&<><label className="upload-button" title="Importar texto de DOCX">Importar DOCX<input type="file" accept=".docx" hidden onChange={async e=>{await onImport(e.target.files?.[0]);e.target.value='';}}/></label><button className="primary" onClick={createNew}>+ Novo modelo</button></>}</div></div>
    {message&&<div className="integration-banner" role="status">{message}</div>}
    {error&&<div className="alert" role="alert">{error}</div>}
    <div className="templates-layout">
      <aside className="panel templates-list"><div className="panel-head"><h2>Biblioteca</h2><span className="template-count">{filtered.length}</span></div><input aria-label="Pesquisar modelos" placeholder="Buscar nome ou categoria" value={query} onChange={e=>setQuery(e.target.value)}/><div className="template-list-items">{filtered.length===0?<p className="muted">Nenhum modelo cadastrado.</p>:filtered.map(item=><button key={item.id} className={`template-list-item ${form.id===item.id?'active':''}`} onClick={()=>void openTemplate(item.id)}><span className="template-category">{item.category}</span><strong>{item.name}</strong><small>Versao {item.version} • {new Date(item.updatedAt).toLocaleDateString('pt-BR')}</small></button>)}</div></aside>
      <div className="templates-main">
        <section className="panel template-editor"><div className="panel-head"><div><h2>{form.id?'Editar modelo':'Novo modelo'}</h2><p>{form.id?`Versao atual: ${form.version}`:'O modelo nao esta salvo.'}</p></div><div className="actions">{form.id&&<button className="ghost" onClick={()=>void showHistory()}>Historico</button>}{canManage&&form.id&&<button className="danger" onClick={()=>void archive()}>Arquivar</button>}{canManage&&<button disabled={working||!form.name.trim()||!form.content.trim()} className="primary" onClick={()=>void save()}>{working?'Salvando...':'Salvar modelo'}</button>}</div></div>
          <div className="template-fields"><label>Nome do modelo<input disabled={!canManage} value={form.name} onChange={e=>change('name',e.target.value)} placeholder="Ex.: Manifestacao processual"/></label><label>Categoria<input disabled={!canManage} value={form.category} onChange={e=>change('category',e.target.value)} placeholder="Peticoes, Contratos..."/></label><label>Tipo de modelo<select disabled={!canManage} value={form.context} onChange={e=>change('context',e.target.value as TemplateForm['context'])}><option value="PROCESS">Processo</option><option value="GENERAL">Geral</option></select></label><label className="span-2">Descricao<input disabled={!canManage} value={form.description} onChange={e=>change('description',e.target.value)}/></label></div>
          <div className="template-toolbar"><span>Inserir variavel:</span><select aria-label="Inserir variavel" defaultValue="" disabled={!canManage} onChange={e=>{if(e.target.value)insert(`{{${e.target.value}}}`);e.target.value='';}}><option value="">Selecione...</option>{variables.map(([code,label])=><option key={code} value={code}>{label}</option>)}</select><button className="ghost" onClick={()=>setShowBlocks(v=>!v)}>Blocos ({blocks.length})</button></div>
          <label className="template-body-label">Conteudo do modelo<textarea className="template-body" disabled={!canManage} spellCheck value={form.content} onChange={e=>change('content',e.target.value)} placeholder="Digite o texto do modelo. Utilize {{processo.numero}} para inserir variaveis..."/></label>
          <details className="template-settings"><summary>Cabeçalho e rodape</summary><label>Cabeçalho<textarea disabled={!canManage} rows={2} value={form.header} onChange={e=>change('header',e.target.value)}/></label><label>Rodape<textarea disabled={!canManage} rows={2} value={form.footer} onChange={e=>change('footer',e.target.value)}/></label></details>
          {showVersions&&<div className="template-history"><div className="panel-head"><h3>Historico de versoes</h3><button className="ghost" onClick={()=>setShowVersions(false)}>Fechar</button></div>{versions.map(v=><div key={v.id} className="template-history-row"><span>Versao {v.version} • {new Date(v.createdAt).toLocaleString('pt-BR')}</span>{canManage&&<button className="ghost" onClick={()=>restoreFrom(v)}>Carregar versao</button>}</div>)}</div>}
          {showBlocks&&<div className="template-blocks"><div className="panel-head"><div><h3>Blocos reutilizaveis</h3><p>Escolha os blocos opcionais ao gerar uma peca.</p></div></div>{blocks.length>0&&<div className="template-blocks-list">{blocks.map(b=><div key={b.id} className="template-block-row"><span><strong>{b.name}</strong><small>{b.scope==='GENERIC'?'Generico':'Exclusivo'}</small></span><div className="actions"><button className="ghost" disabled={!canManage} onClick={()=>insert(`{{bloco:${b.id}}}`)}>Inserir marcador</button>{canManage&&<button className="danger" onClick={()=>void removeBlock(b.id)} aria-label={`Excluir bloco ${b.name}`}>Excluir</button>}</div></div>)}</div>}{canManage&&<div className="new-block-form"><input aria-label="Nome do bloco" placeholder="Nome do bloco" value={newBlock.name} onChange={e=>setNewBlock(b=>({...b,name:e.target.value}))}/><select aria-label="Tipo do bloco" value={newBlock.scope} onChange={e=>setNewBlock(b=>({...b,scope:e.target.value as 'GENERIC'|'EXCLUSIVE'}))}><option value="EXCLUSIVE">Exclusivo deste modelo</option><option value="GENERIC">Generico (outros modelos)</option></select><textarea rows={3} aria-label="Conteudo do bloco" placeholder="Texto do bloco" value={newBlock.content} onChange={e=>setNewBlock(b=>({...b,content:e.target.value}))}/><button className="ghost" onClick={()=>void addBlock()}>+ Criar bloco</button></div>}</div>}
        </section>
        <section className="panel template-generate"><div className="panel-head"><div><h2>Gerar documento</h2><p>Pré-visualize antes de vincular a um processo.</p></div>{form.id&&<span className="status-pill ok">Modelo v{form.version}</span>}</div><div className="template-fields"><label className="span-2">Processo<select aria-label="Selecionar processo" value={processId} onChange={e=>{setProcessId(e.target.value);setPreview(null);}}><option value="">Selecione um processo</option>{processes.map(p=><option key={p.id} value={p.id}>{p.npu} {p.claimant?`- ${p.claimant}`:''}</option>)}</select></label><label>Formato de saida<select value={exportFormat} onChange={e=>setExportFormat(e.target.value as 'PDF'|'DOCX')}><option value="PDF">PDF</option><option value="DOCX">DOCX (Word)</option></select></label><label>Nome do documento<input value={fileName} onChange={e=>setFileName(e.target.value)} placeholder={form.name||'Nome do arquivo'}/></label></div>
          <div className="template-options"><label><input type="checkbox" checked={includeHeader} onChange={e=>setIncludeHeader(e.target.checked)}/> Incluir cabecalho</label><label><input type="checkbox" checked={includeFooter} onChange={e=>setIncludeFooter(e.target.checked)}/> Incluir rodape</label><label><input type="checkbox" checked={privateFile} onChange={e=>setPrivateFile(e.target.checked)}/> Documento privado</label><label><input type="checkbox" checked={hideClient} onChange={e=>setHideClient(e.target.checked)}/> Ocultar do portal do cliente</label></div>
          {blocks.length>0&&<div className="template-block-selector"><h3>Blocos opcionais</h3><div className="template-options">{blocks.map(block=><label key={block.id}><input type="checkbox" checked={selectedBlocks.includes(block.id)} onChange={e=>{setSelectedBlocks(old=>e.target.checked?[...old,block.id]:old.filter(x=>x!==block.id));setPreview(null);}}/> {block.name}</label>)}</div></div>}
          <div className="actions"><button className="ghost" disabled={!form.id||working} onClick={()=>void buildPreview()}>Pré-visualizar</button>{canGenerate&&<button className="primary" disabled={!form.id||!processId||working} onClick={()=>void generate()}>Gerar e salvar no processo</button>}</div>
          {preview&&<div className="document-preview"><div className="panel-head"><strong>Previa • versao {preview.templateVersion}</strong><span>{preview.unresolved.length?`${preview.unresolved.length} variaveis pendentes`:'Campos preenchidos'}</span></div>{preview.unresolved.length>0&&<div className="alert" role="alert">Confira os campos ausentes: {preview.unresolved.join(', ')}.</div>}<div className="document-page-preview">{preview.text}</div></div>}
          {processId&&<p className="muted">O documento gerado sera armazenado e vinculado ao <Link to={`/processes/${processId}`}>processo selecionado</Link>.</p>}
        </section>
      </div>
    </div>
  </>;
}
