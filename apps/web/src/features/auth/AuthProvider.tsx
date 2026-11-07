import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiFetch, authToken } from './api';
import { queryClient } from '../../app/query-client';

type User = { id: string; name: string; email: string; organization: { id: string; name: string }; roleCodes: string[]; permissionCodes: string[] };
type Auth = { user: User | null; loading: boolean; login: (email: string, password: string) => Promise<void>; logout: () => Promise<void>; has: (p: string) => boolean };

const Ctx = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await apiFetch('/auth/me');
      setUser(r.ok ? await r.json() : null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const login = useCallback(async (email: string, password: string) => {
    const r = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    if (!r.ok) throw new Error('INVALID_CREDENTIALS');
    const d = await r.json();
    authToken.set(d.accessToken);
    // Uma única consulta a /auth/me traz organização e permissões completas.
    await load();
  }, [load]);

  const logout = useCallback(async () => {
    await apiFetch('/auth/logout', { method: 'POST' }).catch(() => undefined);
    authToken.set(null);
    setUser(null);
    queryClient.clear(); // não deixa dados do usuário anterior em cache
  }, []);

  // Set de permissões: busca O(1) e `has` estável enquanto o usuário não muda.
  // Antes, `has` era recriada a cada render e disparava recargas nas telas que a usam como dependência.
  const permissions = useMemo(() => new Set(user?.permissionCodes ?? []), [user]);
  const has = useCallback((p: string) => permissions.has(p), [permissions]);

  const value = useMemo<Auth>(() => ({ user, loading, login, logout, has }), [user, loading, login, logout, has]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}
