import type { ReactNode } from 'react';

/** Placeholder exibido enquanto o código de uma tela é carregado (rotas sob demanda). */
export function PageSkeleton() {
  return <div className="page-skeleton" role="status" aria-label="Carregando tela">
    <div className="sk sk-title" />
    <div className="sk sk-line" />
    <div className="sk-grid">{Array.from({ length: 4 }, (_, i) => <div className="sk sk-card" key={i} />)}</div>
    <div className="sk sk-panel" />
    <span className="sr-only">Carregando…</span>
  </div>;
}

export function EmptyState({ icon = '⌁', title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return <div className="empty-state" role="status">
    <span className="empty-state-icon" aria-hidden="true">{icon}</span>
    <strong>{title}</strong>
    {children && <p>{children}</p>}
    {action}
  </div>;
}

/** Linhas de tabela em esqueleto para listagens em carregamento. */
export function TableSkeleton({ columns, rows = 5 }: { columns: number; rows?: number }) {
  return <>{Array.from({ length: rows }, (_, r) => <tr key={r} className="row-skeleton" aria-hidden="true">
    {Array.from({ length: columns }, (_, c) => <td key={c}><span className="sk sk-cell" /></td>)}
  </tr>)}</>;
}
