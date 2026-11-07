import test from 'node:test';
import assert from 'node:assert/strict';
import { renderLegalText, templateVariables, safeDocumentName } from '../../apps/api/src/modules/templates/render-model.ts';
import { makeDocx, makePdf, extractDocxText } from '../../apps/api/src/modules/templates/office-files.ts';

test('preenche variaveis permitidas e comunica campos ausentes', () => {
  const out = renderLegalText('Autos {{processo.numero}} / {{processo.reu}} / {{desconhecido}}', { 'processo.numero': '123', 'processo.reu': '' }, [], []);
  assert.equal(out.text, 'Autos 123 / {{processo.reu}} / {{desconhecido}}');
  assert.deepEqual(out.unresolved.sort(), ['desconhecido','processo.reu']);
});
test('blocos exclusivos e genericos opcionais so entram se marcados', () => {
  const content = 'Inicio\n{{bloco:abc}}\n{{bloco:def}}\nFim';
  const blocks = [{ id:'abc', content:'Clausula {{processo.autor}}' }, { id:'def', content:'Nao deve aparecer' }];
  const out = renderLegalText(content, {'processo.autor':'Joao'}, blocks, ['abc']);
  assert.match(out.text,/Clausula Joao/);
  assert.doesNotMatch(out.text,/Nao deve aparecer|\{\{bloco:def\}\}/);
});
test('arquivo nao aceita caminho no nome e variaveis listam somente chaves conhecidas', () => {
  assert.equal(safeDocumentName('../../x:y\\z?','pdf'),'z.pdf');
  assert.ok(templateVariables.some(v=>v.code==='processo.numero'));
});
test('gera DOCX valido e extrai seu texto de maneira limitada', () => {
  const bytes=makeDocx('Teste de peticao\nSegundo paragrafo');
  assert.equal(bytes.subarray(0,2).toString(),'PK');
  assert.match(extractDocxText(bytes),/Segundo paragrafo/);
});
test('gera PDF com header e encerramento validos', () => {
  const bytes=makePdf('Peticao de teste\nConteudo');
  assert.ok(bytes.subarray(0,8).toString().startsWith('%PDF-1.'));
  assert.ok(bytes.toString('latin1').includes('%%EOF'));
});
