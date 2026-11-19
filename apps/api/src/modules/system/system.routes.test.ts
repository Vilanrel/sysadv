import { describe, expect, it } from 'vitest';
import { SYSTEM_CAPABILITIES, SYSTEM_VERSION } from './system.routes.js';

describe('system release metadata', () => {
  it('exposes the deployed release version', () => {
    expect(SYSTEM_VERSION).toMatch(/^\d{8}\d{2}$/);
    expect(SYSTEM_VERSION).toBe('2026110701');
  });

  it('advertises the maintained capabilities required by the release', () => {
    expect(SYSTEM_CAPABILITIES).toEqual(expect.arrayContaining([
      'api-consumption',
      'process-update',
      'process-soft-delete',
      'process-restore',
      'datajud-force-refresh',
      'audit',
      'user-management',
      'calculation-drafts'
    ]));
  });
});
