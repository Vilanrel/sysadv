import { describe, expect, it } from 'vitest';
import { DataJudClient, dataJudEndpointForNpu, normalizeDataJudProcess } from './datajud.js';
import { resolveJudicialSegment } from './judicial-segment.js';

describe('Judicial segment resolver', () => {
  it('maps TJSP NPU to the state-justice DataJud endpoint', () => {
    const resolved = resolveJudicialSegment('1051528-57.2024.8.26.0053');
    expect(resolved).toMatchObject({ segment: 'STATE', segmentLabel: 'Justiça Estadual', tribunal: 'TJSP', tribunalCode: '26', datajudAlias: 'tjsp' });
    expect(resolved.endpoint).toBe('https://api-publica.datajud.cnj.jus.br/api_publica_tjsp/_search');
  });

  it('maps labor and federal NPUs without confusing the tribunal code', () => {
    expect(dataJudEndpointForNpu('0001234-56.2025.5.02.0030')).toBe('https://api-publica.datajud.cnj.jus.br/api_publica_trt2/_search');
    expect(dataJudEndpointForNpu('0001234-56.2025.4.03.0000')).toBe('https://api-publica.datajud.cnj.jus.br/api_publica_trf3/_search');
  });
});

describe('DataJud integration', () => {
  it('sends the API key and an exact process-number query', async () => {
    let captured: { url?: string; init?: RequestInit } = {};
    const fetchImpl: typeof fetch = async (input, init) => {
      captured = { url: String(input), init };
      return new Response(JSON.stringify({ hits: { hits: [] } }), { status: 200, headers: { 'content-type': 'application/json' } });
    };
    const client = new DataJudClient({ apiKey: 'test-key', fetchImpl });
    await client.searchByNpu('1051528-57.2024.8.26.0053');
    expect(captured.url).toBe('https://api-publica.datajud.cnj.jus.br/api_publica_tjsp/_search');
    expect(new Headers(captured.init?.headers).get('authorization')).toBe('APIKey test-key');
    expect(JSON.parse(String(captured.init?.body))).toEqual({ size: 1, query: { match: { numeroProcesso: '10515285720248260053' } } });
  });

  it('normalizes state-court metadata without inventing a TRT', () => {
    const normalized = normalizeDataJudProcess('1051528-57.2024.8.26.0053', {
      tribunal: 'TJSP', grau: 'G1', dataAjuizamento: '2024-03-10T12:00:00.000Z',
      classe: { nome: 'Procedimento Comum Cível' }, orgaoJulgador: { nome: '5ª Vara Cível' },
      movimentos: [{ nome: 'Distribuição', dataHora: '2024-03-10T12:00:00.000Z' }]
    });
    expect(normalized).toMatchObject({ npu: '1051528-57.2024.8.26.0053', court: 'TJSP', judicialSegment: 'Justiça Estadual', judicialSegmentCode: '8', tribunalCode: '26', datajudAlias: 'tjsp', judgingBody: '5ª Vara Cível', filingDate: '2024-03-10', proceduralPhase: 'Distribuição' });
    expect(normalized.trt).toBeUndefined();
    expect(normalized.laborCourt).toBeUndefined();
  });

  it('keeps labor-specific TRT compatibility for labor cases', () => {
    const normalized = normalizeDataJudProcess('0001234-56.2025.5.02.0030', { tribunal: 'TRT2', orgaoJulgador: { nome: '30ª Vara do Trabalho de São Paulo' } });
    expect(normalized).toMatchObject({ trt: 'TRT 2', judicialSegment: 'Justiça do Trabalho', datajudAlias: 'trt2', judgingBody: '30ª Vara do Trabalho de São Paulo', laborCourt: '30ª Vara do Trabalho de São Paulo' });
  });
});
