import { describe, expect, it } from 'vitest';
import { decideProcessCreateAction } from './process-create-policy.js';

describe('process create policy', () => {
  it('creates when the NPU does not exist', () => {
    expect(decideProcessCreateAction(undefined)).toBe('CREATE');
  });

  it('blocks when the NPU already exists and is active', () => {
    expect(decideProcessCreateAction({ deletedAt: null })).toBe('CONFLICT');
  });

  it('reactivates when the NPU exists but was soft-deleted', () => {
    expect(decideProcessCreateAction({ deletedAt: new Date('2026-09-18T00:00:00Z') })).toBe('REACTIVATE');
  });
});
