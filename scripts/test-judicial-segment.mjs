import assert from 'node:assert/strict';
import { resolveJudicialSegment } from '../apps/api/src/modules/processes/judicial-segment.ts';

const state = resolveJudicialSegment('1051528-57.2024.8.26.0053');
assert.equal(state.segmentCode, '8');
assert.equal(state.segment, 'STATE');
assert.equal(state.tribunal, 'TJSP');
assert.equal(state.datajudAlias, 'tjsp');
assert.equal(state.endpoint, 'https://api-publica.datajud.cnj.jus.br/api_publica_tjsp/_search');

const labor = resolveJudicialSegment('0001234-56.2025.5.02.0030');
assert.equal(labor.segmentCode, '5');
assert.equal(labor.segment, 'LABOR');
assert.equal(labor.tribunal, 'TRT2');
assert.equal(labor.datajudAlias, 'trt2');

const federal = resolveJudicialSegment('0001234-56.2025.4.03.0000');
assert.equal(federal.segment, 'FEDERAL');
assert.equal(federal.tribunal, 'TRF3');
assert.equal(federal.datajudAlias, 'trf3');

console.log('judicial segment resolver: OK');
