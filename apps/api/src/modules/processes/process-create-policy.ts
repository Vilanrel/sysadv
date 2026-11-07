export type ProcessCreateAction = 'CREATE' | 'CONFLICT' | 'REACTIVATE';

export function decideProcessCreateAction(existing?: { deletedAt: Date | null }): ProcessCreateAction {
  if (!existing) return 'CREATE';
  return existing.deletedAt ? 'REACTIVATE' : 'CONFLICT';
}
