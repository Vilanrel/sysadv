import { useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiJson } from '../auth/api';
import { useAuth } from '../auth/AuthProvider';
import { useDebouncedValue, referenceKeys } from '../../app/hooks';
import { useFeedback } from '../../components/feedback';
import { TableSkeleton } from '../../components/ui';

type ProcessRow = {
  id: string;
  npu: string;
  claimant?: string | null;
  defendant?: string | null;
  proceduralPhase?: string | null;
  updatedAt: string;
};
type RefreshResult = { changedFields?: string[]; divergentFields?: string[] };

const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export function ProcessesPage() {
  const { has } = useAuth();
  const { toast, prompt } = useFeedback();
  const client = useQueryClient();
  const [showDeleted, setShowDeleted] = useState(false);
  const [search, setSearch] = useState('');
  const term = useDebouncedValue(search.trim(), 300);
  const canSeeDeleted = has('user.manage');

  // Busca no servidor (NPU, partes e fase), com cache por termo e sem piscar a tabela entre buscas.
  const list = useQuery({
    queryKey: ['processes', showDeleted ? 'deleted' : 'active', term],
    queryFn: () => apiJson<ProcessRow[]>(`/processes${showDeleted ? '/deleted' : ''}${term ? `?q=${encodeURIComponent(term)}` : ''}`),
    placeholderData: keepPreviousData,
  });
  const rows = list.data ?? [];

  const invalidate = () => Promise.all([
    client.invalidateQueries({ queryKey: ['processes'] }),
    client.invalidateQueries({ queryKey: referenceKeys.processes }),
  ]);

  const action = useMutation({
    mutationFn: async ({ kind, process }: { kind: 'remove' | 'restore' | 'refresh'; process: ProcessRow; reason?: string }) => {
      if (kind === 'refresh') return apiJson<RefreshResult>(`/processes/${process.id}/datajud/refresh`, { method: 'POST' });
      if (kind === 'restore') return apiJson(`/processes/${process.id}/restore`, { method: 'POST' });
      return null;
    },
  });

  async function remove(process: ProcessRow) {
    const reason = await prompt({
      title: `Excluir o processo ${process.npu}?`,
      message: 'A exclusão é lógica: o processo pode ser restaurado depois e a operação fica na auditoria.',
      input: { label: 'Motivo da exclusão', defaultValue: 'Exclusão solicitada pelo usuário', required: true },
      confirmLabel: 'Excluir', tone: 'danger',
    });
    if (reason === null) return;
    try {
      await apiJson(`/processes/${process.id}`, { method: 'DELETE', body: JSON.stringify({ reason }) });
      toast(`Processo ${process.npu} excluído.`);
      await invalidate();
    } catch { toast('Não foi possível excluir o processo.', 'error'); }
  }

  async function refresh(process: ProcessRow) {
    try {
      const body = await action.mutateAsync({ kind: 'refresh', process }) as RefreshResult;
      toast(`Consulta concluída: ${body.changedFields?.length ?? 0} campo(s) atualizado(s), ${body.divergentFields?.length ?? 0} divergência(s).`);
      await invalidate();
    } catch (e) { toast(`Falha ao consultar o DataJud (${e instanceof Error ? e.message : 'erro'}).`, 'error'); }
  }

  async function restore(process: ProcessRow) {
    try {
      await action.mutateAsync({ kind: 'restore', process });
      toast(`Processo ${process.npu} restaurado.`);
      await invalidate();
    } catch { toast('Não foi possível restaurar o processo.', 'error'); }
  }

  const busyId = action.isPending ? action.variables?.process.id : undefined;

  return <>
    <div className="page-heading">
      <div><span className="eyebrow">Gestão processual</span><h1>Processos</h1><p>Encontre processos, acompanhe andamentos e mantenha a rastreabilidade da carteira.</p></div>
      <div className="actions">
        {canSeeDeleted && <button className="ghost" type="button" aria-pressed={showDeleted} onClick={() => setShowDeleted(value => !value)}>{showDeleted ? 'Exibir ativos' : 'Exibir excluídos'}</button>}
        <Link className="primary link-button" to="/processes/new">+ Novo processo</Link>
      </div>
    </div>
    {list.isError && <div className="alert" role="alert">Não foi possível carregar a listagem. Verifique sua conexão e tente novamente. <button type="button" className="ghost" onClick={() => void list.refetch()}>Tentar novamente</button></div>}
    <section className="panel" aria-label="Listagem de processos">
      <div className="listing-toolbar">
        <label className="listing-search" htmlFor="process-search"><span>Buscar na carteira</span><input id="process-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Número, parte ou fase processual"/></label>
        <span className="listing-count" aria-live="polite">{list.isFetching && !list.isPending ? 'Atualizando… ' : ''}{rows.length} {rows.length === 1 ? 'processo' : 'processos'} {showDeleted ? 'excluídos' : 'na lista'}</span>
      </div>
      <div className="table-wrap"><table aria-label={showDeleted ? 'Processos excluídos' : 'Processos ativos'} aria-busy={list.isFetching}>
        <thead><tr><th>NPU</th><th>Reclamante</th><th>Reclamado</th><th>Fase</th><th>Atualização</th><th>Ações</th></tr></thead>
        <tbody>{list.isPending
          ? <TableSkeleton columns={6}/>
          : rows.length === 0
          ? <tr><td className="empty" colSpan={6}>{term ? 'Nenhum processo corresponde à pesquisa.' : 'Nenhum processo encontrado.'}</td></tr>
          : rows.map(process => <tr key={process.id}>
            <td data-label="NPU" className="cell-mono">{showDeleted ? process.npu : <Link to={`/processes/${process.id}`}>{process.npu}</Link>}</td>
            <td data-label="Reclamante">{process.claimant || '—'}</td>
            <td data-label="Reclamado">{process.defendant || '—'}</td>
            <td data-label="Fase"><span className="phase-label">{process.proceduralPhase || 'Pendente'}</span></td>
            <td data-label="Atualização" className="cell-muted">{dateTime.format(new Date(process.updatedAt))}</td>
            <td data-label="Ações"><div className="row-actions">{showDeleted
              ? <button className="ghost" type="button" disabled={busyId === process.id} onClick={() => void restore(process)}>Restaurar</button>
              : <>
                <Link className="ghost link-button" to={`/processes/${process.id}/edit`}>Alterar</Link>
                <button className="ghost" type="button" disabled={busyId === process.id} onClick={() => void refresh(process)}>{busyId === process.id ? 'Consultando…' : 'Consultar API'}</button>
                <button className="danger" type="button" disabled={busyId === process.id} onClick={() => void remove(process)}>Excluir</button>
              </>}</div></td>
          </tr>)}</tbody>
      </table></div>
      {rows.length >= 100 && <p className="muted compact-meta">Exibindo os 100 mais recentes. Refine a busca para encontrar outros processos.</p>}
    </section>
  </>;
}
