import type { JudicialSourceDescriptor, JudicialSourceProvider } from './source-registry.js';

export type JudicialSourceQuery = {
  npu: string;
  processId?: string;
  organizationId?: string;
  userId?: string;
  purpose: string;
};

export type JudicialSourceResult<T = unknown> = {
  provider: JudicialSourceProvider;
  found: boolean;
  queriedAt: string;
  data?: T;
  sourceRef?: string;
  sourceUrl?: string;
  metadata?: Record<string, unknown>;
};

export interface JudicialSourceConnector<T = unknown> {
  descriptor(): JudicialSourceDescriptor;
  search(query: JudicialSourceQuery): Promise<JudicialSourceResult<T>>;
}
