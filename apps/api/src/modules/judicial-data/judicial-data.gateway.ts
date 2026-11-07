import { DataJudClient, type DataJudSearchResult } from '../processes/datajud.js';
import { listJudicialSources, type JudicialSourceDescriptor } from './source-registry.js';

export type GatewaySearchContext = {
  purpose: string;
  processId?: string;
  userId?: string;
  organizationId?: string;
};

export class JudicialDataGateway {
  constructor(private readonly dataJudApiKey?: string) {}

  sources(): JudicialSourceDescriptor[] {
    return listJudicialSources();
  }

  async searchPrimaryByNpu(npu: string, _context?: GatewaySearchContext): Promise<DataJudSearchResult> {
    if (!this.dataJudApiKey?.trim()) throw Object.assign(new Error('DATAJUD_NOT_CONFIGURED'), { statusCode: 503 });
    return new DataJudClient({ apiKey: this.dataJudApiKey }).searchByNpu(npu);
  }
}
