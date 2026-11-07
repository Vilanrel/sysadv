import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiFetch } from '../auth/api';
import { useFeedback } from '../../components/feedback';
import { PageSkeleton } from '../../components/ui';
import { OriginStatusBadge } from './OriginStatusBadge';
import { DocumentsPanel } from '../documents/DocumentsPanel';

export function ProcessDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [p, setP] = useState<any>();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState('');
  const [timeline, setTimeline] = useState<any[]>([]);
  const [notFound, setNotFound] = useState(false);
  const { toast, confirm } = useFeedback();

  // Processo e linha do tempo em paralelo (antes eram duas chamadas em sequência).
  const load = useCallback(async () => {
    const [response, timelineResponse] = await Promise.all([apiFetch(`/processes/${id}`), apiFetch(`/processes/${id}/timeline`)]);
    if (response.ok) setP(await response.json()); else if (response.status === 404) setNotFound(true);
    if (timelineResponse.ok) setTimeline((await timelineResponse.json()).items ?? []);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const latestEvidence = useMemo(() => {
    const map = new Map<string, any>();
    for (const evidence of p?.evidence ?? []) if (!map.has(evidence.fieldName)) map.set(evidence.fieldName, evidence);
    return map;
  }, [p]);

  const sourceFor = (field: string, value: unknown): 'OFFICIAL' | 'AI' | 'MANUAL' | 'VALIDATED' | 'DIVERGENCE' | 'PENDING' => {
    const evidence = latestEvidence.get(field);
    if (!evidence) return value ? 'MANUAL' : 'PENDING';
    if (evidence.status === 'DIVERGENCE') return 'DIVERGENCE';
    if (evidence.status === 'VALIDATED') return 'VALIDATED';
    return evidence.sourceType;
  };

  async function refreshDataJud() {
    setRefreshing(true);
    setRefreshMessage('Consultando o DataJud/CNJ...');
    try {
      const response = await apiFetch(`/processes/${id}/datajud/refresh`, { method: 'POST' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (body.error === 'DATAJUD_NOT_CONFIGURED') setRefreshMessage('Integração DataJud não configurada.');
        else if (body.error === 'UNSUPPORTED_JUDICIAL_SEGMENT') setRefreshMessage('O segmento judicial deste NPU ainda não possui endpoint DataJud suportado pelo SysADV.');
        else { const r = body.routing; setRefreshMessage(`DataJud falhou${body.upstreamStatus ? ` (HTTP ${body.upstreamStatus})` : ''}${r ? ` — ${r.segmentLabel} / ${r.tribunal} / ${r.datajudAlias}` : ''}.`); }
        return;
      }
      setP(body.process);
      if (!body.result?.found) setRefreshMessage('Processo não localizado no DataJud. Nenhum dado foi alterado.');
      else if (body.preservedValidatedFields?.length) setRefreshMessage(`Consulta concluída. ${body.changedFields.length} campo(s) atualizado(s) e ${body.preservedValidatedFields.length} campo(s) validado(s) preservado(s) como divergência.`);
      else setRefreshMessage(`Consulta concluída. ${body.changedFields.length} campo(s) atualizado(s). HTTP ${body.result?.httpStatus ?? '—'} em ${body.result?.durationMs ?? 0} ms.`);
    } finally {
      setRefreshing(false);
    }
  }

  async function refreshPublications() {
    setRefreshMessage('Consultando fonte de publicações configurada...');
    const response = await apiFetch(`/processes/${id}/publications/refresh`, { method: 'POST' });
    const body = await response.json().catch(() => ({}));
    if (response.ok) { setRefreshMessage('Publicações atualizadas.'); await load(); return; }
    if (body.error === 'CONNECTOR_NOT_CONFIGURED') setRefreshMessage('Fonte DJEN ainda não está ativa/configurada em Fontes de Dados.');
    else if (body.error === 'CONNECTOR_NOT_IMPLEMENTED') setRefreshMessage('A fonte está cadastrada, mas o conector remoto precisa de um método oficial/autorizado para ser ativado.');
    else setRefreshMessage(`Falha ao consultar publicações: ${body.error ?? response.status}`);
  }

  async function remove() {
    const ok = await confirm({ title: 'Excluir este processo?', message: 'A exclusão será lógica e auditável; o processo pode ser restaurado por um administrador.', confirmLabel: 'Excluir', tone: 'danger' });
    if (!ok) return;
    const r = await apiFetch(`/processes/${id}`, { method: 'DELETE', body: JSON.stringify({ reason: 'Exclusão pela tela do processo' }) });
    if (r.ok) { toast('Processo excluído.'); navigate('/processes'); } else toast('Não foi possível excluir o processo.', 'error');
  }

  async function prepareCalculation() {
    const r = await apiFetch(`/processes/${id}/calculations`, { method: 'POST', body: JSON.stringify({ parameters: {} }) });
    if (r.ok) { await load(); toast('Rascunho de cálculo criado. Acesse o menu Cálculos para continuar.'); }
    else toast('Não foi possível preparar o cálculo.', 'error');
  }

  if (notFound) return <section className="panel"><h2>Processo não encontrado</h2><p className="muted">O processo pode ter sido excluído ou você não tem acesso a ele.</p><Link className="ghost link-button" to="/processes">Voltar para Processos</Link></section>;
  if (!p) return <PageSkeleton/>;
  return <>
    <div className="page-heading">
      <div><span className="eyebrow">Processo</span><h1>{p.npu}</h1><p>{p.claimant || 'Reclamante pendente'} × {p.defendant || 'Reclamado pendente'}</p></div>
      <div className="actions"><Link className="ghost link-button" to={`/processes/${id}/edit`}>Alterar</Link><button className="primary" onClick={refreshDataJud} disabled={refreshing}>{refreshing ? 'Consultando...' : 'Consultar DataJud agora'}</button><button className="ghost" onClick={()=>void refreshPublications()}>Atualizar publicações</button><button className="danger" onClick={()=>void remove()}>Excluir</button></div>
    </div>
    {refreshMessage && <section className="integration-banner" role="status">{refreshMessage}</section>}
    <section className="panel"><h2>Dados estruturados</h2><div className="detail-grid">
      <div><span>Reclamante</span><strong>{p.claimant || '—'}</strong><OriginStatusBadge kind={sourceFor('claimant', p.claimant)} /></div>
      <div><span>Reclamado</span><strong>{p.defendant || '—'}</strong><OriginStatusBadge kind={sourceFor('defendant', p.defendant)} /></div>
      <div><span>Segmento Judicial</span><strong>{p.judicialSegment || '—'}</strong><OriginStatusBadge kind={sourceFor('judicialSegment', p.judicialSegment)} /></div>
      <div><span>Tribunal</span><strong>{p.court || '—'}</strong><OriginStatusBadge kind={sourceFor('court', p.court)} /></div>
      <div><span>Código do Tribunal</span><strong>{p.tribunalCode || '—'}</strong><OriginStatusBadge kind={sourceFor('tribunalCode', p.tribunalCode)} /></div>
      <div><span>Alias DataJud</span><strong>{p.datajudAlias || '—'}</strong><OriginStatusBadge kind={sourceFor('datajudAlias', p.datajudAlias)} /></div>
      {p.trt && <div><span>TRT</span><strong>{p.trt}</strong><OriginStatusBadge kind={sourceFor('trt', p.trt)} /></div>}
      <div><span>Órgão julgador</span><strong>{p.judgingBody || p.laborCourt || '—'}</strong><OriginStatusBadge kind={sourceFor('judgingBody', p.judgingBody || p.laborCourt)} /></div>
      <div><span>Data de ajuizamento</span><strong>{p.filingDate ? new Date(p.filingDate).toLocaleDateString('pt-BR') : '—'}</strong><OriginStatusBadge kind={sourceFor('filingDate', p.filingDate)} /></div>
      <div><span>Fase / última movimentação</span><strong>{p.proceduralPhase || '—'}</strong><OriginStatusBadge kind={sourceFor('proceduralPhase', p.proceduralPhase)} /></div>
    </div></section>
    <section className="panel"><div className="panel-head"><div><h2>Linha do Tempo</h2><p>Movimentações DataJud e publicações oficiais permanecem distintas e ordenadas cronologicamente.</p></div></div>{timeline.length?<div className="case-timeline">{timeline.map((item:any)=><article key={`${item.type}-${item.id}`} className={`timeline-card ${item.type==='PUBLICATION'?'publication':'movement'}`}><div className="timeline-marker">{item.type==='PUBLICATION'?'P':'M'}</div><div><div className="timeline-meta"><span className={`status-pill ${item.type==='PUBLICATION'?'warn':'ok'}`}>{item.type==='PUBLICATION'?'Publicação':'Movimentação'}</span><span>{item.date?new Date(item.date).toLocaleString('pt-BR'):'—'}</span><span>{item.source?.name||item.provider||'—'}</span></div><strong>{item.label}</strong>{item.judgingBody&&<p>{item.judgingBody}</p>}{item.type==='PUBLICATION'&&item.content&&<p className="timeline-excerpt">{item.content}</p>}</div></article>)}</div>:<p className="muted">Nenhuma movimentação ou publicação persistida para este processo.</p>}</section>
    <section className="panel"><div className="panel-head"><div><h2>Cálculos</h2><p>Preparação dos parâmetros vinculados ao processo.</p></div><button className="ghost" onClick={()=>void prepareCalculation()}>+ Preparar cálculo</button></div>{p.calculations?.length?<div className="timeline">{p.calculations.map((c:any)=><div key={c.id}><span className="status-pill">{c.status}</span><strong>Cálculo</strong><span>{new Date(c.updatedAt).toLocaleString('pt-BR')}</span></div>)}</div>:<p className="muted">Nenhum cálculo preparado.</p>}</section>
    <DocumentsPanel processId={p.id} />
    <section className="panel"><h2>Origem dos dados / evidências</h2>{p.evidence?.length ? <div className="timeline">{p.evidence.slice(0, 50).map((e: any) => <div key={e.id}><OriginStatusBadge kind={e.status === 'DIVERGENCE' ? 'DIVERGENCE' : e.status === 'VALIDATED' ? 'VALIDATED' : e.sourceType} /><strong>{e.fieldName}</strong><span>{e.valueText}</span><small>{e.provider || e.sourceLabel || '—'}{e.retrievedAt ? ` · ${new Date(e.retrievedAt).toLocaleString('pt-BR')}` : ''}{e.reliabilityScore != null ? ` · confiabilidade ${Math.round(e.reliabilityScore*100)}%` : ''}</small></div>)}</div> : <p className="muted">Nenhuma evidência registrada.</p>}</section>
  </>;
}
