import { describe, expect, it } from 'vitest';
import { parseEnv } from './env.js';

describe('parseEnv', () => {
  it('requires database and auth secrets', () => {
    expect(() => parseEnv({ NODE_ENV: 'test' } as NodeJS.ProcessEnv)).toThrow();
  });

  it('treats an empty DataJud key as not configured', () => {
    const parsed = parseEnv({
      NODE_ENV: 'test', DATABASE_URL: 'postgresql://test', ACCESS_TOKEN_SECRET: 'a'.repeat(32),
      REFRESH_TOKEN_SECRET: 'b'.repeat(32), WEB_ORIGIN: 'http://localhost:8080', DATAJUD_API_KEY: ''
    } as NodeJS.ProcessEnv);
    expect(parsed.DATAJUD_API_KEY).toBeUndefined();
  });
});
