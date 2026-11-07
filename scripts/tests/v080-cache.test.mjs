import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readThroughFileCache } from '../../apps/api/src/modules/dashboard/file-cache.ts';
import { topCounts, successRate } from '../../apps/api/src/modules/dashboard/dashboard-summary.ts';

test('cache de arquivo respeita organizacao, TTL e recupera json corrompido', async () => {
  const root=await mkdtemp(path.join(tmpdir(),'sysadv-dashboard-'));
  try {
    let now=1000; let calls=0;
    const load=async () => ({ count:++calls });
    const opts={root, ttlMs:30000, now:()=>now};
    assert.deepEqual(await readThroughFileCache('org-a:30',load,opts),{count:1});
    assert.deepEqual(await readThroughFileCache('org-a:30',load,opts),{count:1});
    assert.deepEqual(await readThroughFileCache('org-b:30',load,opts),{count:2});
    now=32001;
    assert.deepEqual(await readThroughFileCache('org-a:30',load,opts),{count:3});
    const entries=await readdir(root);
    assert.equal(entries.length,2);
    assert.ok(entries.every(name=>/^[a-f0-9]{64}\.json$/.test(name)));
    for (const file of entries) await writeFile(path.join(root,file),'{corrompido');
    assert.deepEqual(await readThroughFileCache('org-a:30',load,opts),{count:4});
  } finally { await rm(root,{recursive:true,force:true}); }
});
test('cache agrupa requisicoes concorrentes do mesmo tenant', async () => {
  const root=await mkdtemp(path.join(tmpdir(),'sysadv-dashboard-'));
  try { let calls=0; const loader=async()=>{calls++;await new Promise(resolve=>setTimeout(resolve,15));return {value:42};};
    const result=await Promise.all(Array.from({length:6},()=>readThroughFileCache('org-x',loader,{root,ttlMs:1000,now:()=>0})));
    assert.equal(calls,1);assert.equal(result.length,6);
  } finally { await rm(root,{recursive:true,force:true}); }
});
test('dashboard ordena grupos e calcula eficiencia sem dividir por zero',()=>{
  assert.deepEqual(topCounts([{label:null,count:1},{label:'TRT2',count:10},{label:'TRT15',count:4}],2),[{label:'TRT2',count:10},{label:'TRT15',count:4}]);
  assert.equal(successRate(0,0),100);
  assert.equal(successRate(10,2),80);
});
