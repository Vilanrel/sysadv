import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, authToken } from './api.js';

afterEach(() => {
  vi.unstubAllGlobals();
  authToken.set(null);
});

describe('apiFetch', () => {
  it('does not send application/json content-type when the request has no body', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(init?.method).toBe('POST');
      expect(init?.body).toBeUndefined();
      expect(headers.has('Content-Type')).toBe(false);
      return new Response(null, { status: 204 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/processes/process-1/datajud/refresh', { method: 'POST' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sends application/json content-type when a JSON body is present', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get('Content-Type')).toBe('application/json');
      expect(init?.body).toBe(JSON.stringify({ email: 'admin@sysadv.local' }));
      return new Response(null, { status: 204 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/example', { method: 'POST', body: JSON.stringify({ email: 'admin@sysadv.local' }) });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
