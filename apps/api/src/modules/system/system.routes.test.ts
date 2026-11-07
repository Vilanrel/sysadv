import { describe, expect, it } from 'vitest';
import { SYSTEM_CAPABILITIES, SYSTEM_VERSION } from './system.routes.js';

describe('system release metadata', () => {
  it('exposes the deployed release version', () => {
    expect(SYSTEM_VERSION).toBe('0.5.0');
  });

  it('advertises the v0.3 capabilities required by the release', () => {
    expect(SYSTEM_CAPABILITIES).toEqual(expect.arrayContaining([
      'api-consumption',
      'process-update',
      'process-soft-delete',
      'process-restore',
      'datajud-force-refresh',
      'audit',
      'user-administration',
      'calculation-drafts'
    ]));
  });
});
