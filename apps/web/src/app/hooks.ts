import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiJson } from '../features/auth/api';

/** Atrasa a propagação de um valor (ex.: busca digitada) para evitar uma requisição por tecla. */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export type ProcessOption = { id: string; npu: string };
export type PersonOption = { id: string; name: string };
export type UserOption = { id: string; name: string };

/**
 * Listas de apoio para selects (processos, pessoas, responsáveis).
 * Ficam em cache por 5 min e são compartilhadas entre telas: navegar de Tarefas
 * para Pessoas não refaz as mesmas consultas. Antes cada tela baixava a lista
 * completa de processos (com todos os campos) a cada montagem.
 */
const REFERENCE_STALE = 5 * 60_000;

export const referenceKeys = {
  processes: ['ref', 'processes'] as const,
  people: (q: string) => ['ref', 'people', q] as const,
  assignees: ['ref', 'assignees'] as const,
};

export function useProcessOptions(enabled = true) {
  return useQuery({
    queryKey: referenceKeys.processes,
    queryFn: () => apiJson<ProcessOption[]>('/processes/options'),
    staleTime: REFERENCE_STALE,
    enabled,
  });
}

export function usePeopleOptions(q = '', enabled = true) {
  const term = q.trim();
  return useQuery({
    queryKey: referenceKeys.people(term),
    queryFn: () => apiJson<{ items: PersonOption[] }>(`/people?page=1${term ? `&q=${encodeURIComponent(term)}` : ''}`).then(r => r.items),
    staleTime: REFERENCE_STALE,
    placeholderData: previous => previous,
    enabled,
  });
}

export function useAssignees(enabled = true) {
  return useQuery({
    queryKey: referenceKeys.assignees,
    queryFn: () => apiJson<UserOption[]>('/tasks/assignees'),
    staleTime: REFERENCE_STALE,
    enabled,
  });
}
