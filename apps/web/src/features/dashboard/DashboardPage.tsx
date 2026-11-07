import { useAuth } from '../auth/AuthProvider';
import { money,hourLabel } from '../office/OfficeShared';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiJson } from '../auth/api';

type Breakdown = {label:string;count:number};
type Activity = {id:string;action:string;entityType:string;createdAt:string};
type Metrics = {
  processes:number;pendingFields:number;documents:number;calculations:number;templates:number;
  newProcesses:number;newDocuments:number;apiPeriod:number;apiPeriodFailures:number;apiSuccessRate:number;
  phaseBreakdown:Breakdown[];tribunalBreakdown:Breakdown[];calculationBreakdown:Breakdown[];sourceBreakdown:Breakdown[];
  recentActivities:Activity[];generatedAt:string;
  people:number|null;openTasks:number|null;overdueTasks:number|null;dueSoonTasks:number|null;upcomingHearings:number|null;
  accessible:{people:boolean;tasks:boolean;calendar:boolean;audit:boolean};
};
function BreakdownPanel({title,items,empty}:{title:string;items:Breakdown[];empty:string}) {
  const peak=Math.max(1,...items.map(i=>i.count));
  return <section className="panel analytics-panel"><h2>{title}</h2>{items.length===0?<p className="muted">{empty}</p>:<div className="analytics-bars">{items.map(item=><div className="analytics-bar" key={item.label}><div className="analytics-bar-label"><span title={item.label}>{item.label}</span><strong>{item.count}</strong></div><div className="analytics-bar-track"><div style={{width:`${Math.max(2,item.count/peak*100)}%`}}/></div></div>)}</div>}</section>;
}
export function DashboardPage() {
  const {user,has}=useAuth();
  const canReport=has('report.read');
  const [days,setDays]=useState(30);
  // As duas consultas correm em paralelo e ficam em cache: voltar ao dashboard é instantâneo,
  // e trocar o período mantém os números anteriores na tela até chegarem os novos.
  const overview=useQuery({queryKey:['dashboard','overview'],queryFn:()=>apiJson<{processes:number|null;intakes:number|null;finance:{receivableCents:number}|null;time:{minutes:number}|null}>('/reports/overview'),enabled:canReport});
  const metrics=useQuery({queryKey:['dashboard','metrics',days],queryFn:()=>apiJson<Metrics>(`/dashboard?days=${days}`),placeholderData:keepPreviousData});
  const office=canReport?overview.data??null:null;
  const m=metrics.data??null;
  const loading=metrics.isPending;
  const error=metrics.isError?'Não foi possível carregar os indicadores.':'';
  return <>
    <div className="office-welcome"><div><span className="eyebrow">Área de trabalho</span><h2>Olá, {user?.name?.split(' ')[0] || 'equipe'} <span aria-hidden="true">👋</span></h2><p>Seus indicadores são calculados com registros autorizados do escritório.</p></div><Link className="ghost" to="/agenda">Ver agenda →</Link></div>
    {office&&<div className="office-kpis office-dashboard-kpis">{office.processes!==null&&<article><span>Processos ativos</span><strong>{office.processes}</strong><small>Carteira do escritório</small></article>}{office.intakes!==null&&<article><span>Atendimentos</span><strong>{office.intakes}</strong><small>Demandas em acompanhamento</small></article>}{office.finance&&<article><span>A receber</span><strong>{money(office.finance.receivableCents)}</strong><small>Saldo de receitas registrado</small></article>}{office.time&&<article><span>Horas registradas</span><strong>{hourLabel(office.time.minutes)}</strong><small>Horas acessíveis ao seu perfil</small></article>}</div>}
    <div className="page-heading"><div><span className="eyebrow">Visão executiva</span><h1>Dashboard gerencial</h1><p>Indicadores reais da organização, processos, documentos e integrações.</p></div><div className="dashboard-actions"><label>Período de atividade<select aria-label="Período do dashboard" value={days} onChange={e=>setDays(Number(e.target.value))}><option value={7}>7 dias</option><option value={30}>30 dias</option><option value={90}>90 dias</option><option value={365}>12 meses</option></select></label><Link className="primary link-button" to="/processes/new">+ Novo processo</Link></div></div>
    {loading&&<div className="dashboard-skeleton" role="status" aria-label="Carregando indicadores gerenciais">
      {Array.from({length:6},(_,i)=><div className="skeleton-metric" key={i}><div/><div/><div/></div>)}
      <span className="sr-only">Carregando indicadores...</span>
    </div>}
    {error&&<div className="alert" role="alert">{error}</div>}
    {m&&<><div className="metrics dashboard-metrics">
      <article><span>Processos ativos</span><strong>{m.processes}</strong><small>+{m.newProcesses} no período</small></article>
      <article><span>Pendências de validação</span><strong>{m.pendingFields}</strong><small>Campos pendentes ou divergentes</small></article>
      <article><span>Documentos</span><strong>{m.documents}</strong><small>+{m.newDocuments} no período</small></article>
      <article><span>Modelos jurídicos</span><strong>{m.templates}</strong><small>Biblioteca ativa</small></article>
      <article><span>Cálculos</span><strong>{m.calculations}</strong><small>Todos os estados</small></article>
      <article><span>Consultas de integração</span><strong>{m.apiPeriod}</strong><small>{m.apiPeriodFailures} falha(s) no período</small></article>
    </div>
    <div className="metrics dashboard-metrics ops-dashboard-metrics">
      {m.accessible.people&&<Link className="metric-link" to="/people"><span>Pessoas e clientes</span><strong>{m.people}</strong><small>Cadastros ativos</small></Link>}
      {m.accessible.tasks&&<Link className="metric-link" to="/tasks?filter=open"><span>Tarefas pendentes</span><strong>{m.openTasks}</strong><small>Em aberto ou revisão</small></Link>}
      {m.accessible.tasks&&<Link className="metric-link urgent" to="/tasks?filter=overdue"><span>Tarefas vencidas</span><strong>{m.overdueTasks}</strong><small>Ação necessária</small></Link>}
      {m.accessible.tasks&&<Link className="metric-link" to="/tasks?filter=dueSoon"><span>Vencimentos próximos</span><strong>{m.dueSoonTasks}</strong><small>Nos próximos 7 dias</small></Link>}
      {m.accessible.calendar&&<Link className="metric-link" to="/agenda"><span>Audiências próximas</span><strong>{m.upcomingHearings}</strong><small>Nos próximos 7 dias</small></Link>}
    </div>
    <div className="dashboard-highlight"><div className="dashboard-rate"><span>Disponibilidade das consultas efetuadas</span><strong>{m.apiSuccessRate}%</strong><p>Proporção de chamadas registradas sem erro, não o SLA dos provedores.</p></div><div className="dashboard-rate-progress" role="img" aria-label={`Taxa de sucesso de integrações: ${m.apiSuccessRate} porcento`}><div style={{width:`${m.apiSuccessRate}%`}}/></div><div className="dashboard-quick-links"><Link to="/templates">Modelos de documentos</Link><Link to="/sources">Fontes de dados</Link><Link to="/documents">Arquivos</Link></div></div>
    <div className="dashboard-charts"><BreakdownPanel title="Processos por fase" items={m.phaseBreakdown} empty="Fases ainda não informadas nos processos."/><BreakdownPanel title="Processos por tribunal" items={m.tribunalBreakdown} empty="Tribunais ainda não classificados."/><BreakdownPanel title="Status dos cálculos" items={m.calculationBreakdown} empty="Nenhum cálculo cadastrado."/><BreakdownPanel title="Fontes de dados" items={m.sourceBreakdown} empty="Nenhuma fonte cadastrada."/></div>
    <section className="panel"><div className="panel-head"><div><h2>Atividade recente</h2><p>Registros de auditoria do período selecionado.</p></div>{m.accessible.audit&&<Link to="/audit">Ver auditoria</Link>}</div>{!m.accessible.audit?<p className="muted">Sem permissão de auditoria para detalhar atividades.</p>:m.recentActivities.length===0?<p className="muted">Sem atividades registradas no período.</p>:<div className="dashboard-activity">{m.recentActivities.map(activity=><div key={activity.id}><span>{activity.action.replaceAll('_',' ')}</span><small>{activity.entityType} • {new Date(activity.createdAt).toLocaleString('pt-BR')}</small></div>)}</div>}</section>
    <p className="dashboard-updated">Atualizado em {new Date(m.generatedAt).toLocaleString('pt-BR')} • Cache de até 30 segundos</p></>}
  </>;
}
