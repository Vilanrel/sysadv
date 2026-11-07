import test from 'node:test';
import assert from 'node:assert/strict';
import { canReadPrivateDocument, validateBlockSelection, validateDocxImport, verifyStoredHash } from '../../apps/api/src/modules/templates/template-policy.ts';

test('autor e admin podem ler documento privado; outros nao',()=>{
  assert.equal(canReadPrivateDocument({isPrivate:true,uploadedById:'a'},'a',[]),true);
  assert.equal(canReadPrivateDocument({isPrivate:true,uploadedById:'a'},'b',['ADMIN']),true);
  assert.equal(canReadPrivateDocument({isPrivate:true,uploadedById:'a'},'b',['LAWYER']),false);
  assert.equal(canReadPrivateDocument({isPrivate:false,uploadedById:'a'},'b',[]),true);
});
test('nao permite blocos de outro modelo',()=>{
  assert.throws(()=>validateBlockSelection(['a','b'],[{id:'a'}]),/INVALID_BLOCK/);
  assert.deepEqual(validateBlockSelection(['a','a'],[{id:'a'}]),['a']);
});
test('importacao exige docx e tamanho maximo',()=>{
  assert.throws(()=>validateDocxImport('arquivo.pdf',Buffer.from('a')),/INVALID_FILE_TYPE/);
  assert.throws(()=>validateDocxImport('arquivo.docx',Buffer.alloc(5*1024*1024+1)),/FILE_TOO_LARGE/);
  assert.doesNotThrow(()=>validateDocxImport('modelo.docx',Buffer.from('PK')));
});
test('hash de arquivo impede uso de dado adulterado',()=>{
  assert.doesNotThrow(()=>verifyStoredHash(Buffer.from('a'),'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb'));
  assert.throws(()=>verifyStoredHash(Buffer.from('b'),'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb'),/FILE_CORRUPT/);
});
