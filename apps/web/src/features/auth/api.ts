let accessToken: string | null = null;

export const authToken = {
  get: () => accessToken,
  set: (v: string | null) => { accessToken = v; },
};

/** Erro de API com o código devolvido pelo backend (ex.: NOT_FOUND, VALIDATION_ERROR). */
export class ApiError extends Error {
  constructor(public readonly code: string, public readonly status: number, public readonly body: unknown = null) {
    super(code);
    this.name = 'ApiError';
  }
}

function buildHeaders(init: RequestInit) {
  const headers = new Headers(init.headers);

  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  const hasBody = init.body !== undefined && init.body !== null;
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;

  if (hasBody && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return headers;
}

/**
 * Renovação única do token: quando várias chamadas recebem 401 ao mesmo tempo
 * (ex.: dashboard com 4 consultas paralelas), apenas UM /auth/refresh é enviado
 * e as demais aguardam o mesmo resultado. Antes, cada chamada disparava o seu.
 */
let refreshInFlight: Promise<boolean> | null = null;
function refreshAccessToken(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
      .then(async response => {
        if (!response.ok) return false;
        const data = await response.json().catch(() => ({}));
        if (!data.accessToken) return false;
        authToken.set(data.accessToken);
        return true;
      })
      .catch(() => false)
      .finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  const headers = buildHeaders(init);
  const requestInit: RequestInit = { ...init, headers, credentials: 'include' };
  const response = await fetch(`/api${path}`, requestInit);

  if (response.status === 401 && path !== '/auth/refresh' && path !== '/auth/login') {
    if (await refreshAccessToken()) {
      headers.set('Authorization', `Bearer ${accessToken}`);
      return fetch(`/api${path}`, { ...requestInit, headers });
    }
  }

  return response;
}

/** Atalho tipado: faz a chamada, interpreta JSON e lança ApiError com o código do backend. */
export async function apiJson<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await apiFetch(path, init);
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({ error: 'INVALID_RESPONSE' }));
  if (!response.ok) {
    const code = typeof (data as { error?: unknown })?.error === 'string' ? (data as { error: string }).error : `HTTP_${response.status}`;
    throw new ApiError(code, response.status, data);
  }
  return data as T;
}
