import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../features/auth/api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      // Não insiste em erros de permissão/validação; repete uma vez falhas de rede/servidor.
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 1,
    },
  },
});
