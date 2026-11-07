import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readThroughFileCache, invalidateFileCache } from '../../apps/api/src/modules/dashboard/file-cache.ts';

test('invalidation removes stale tenant dashboard without disturbing other tenants',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'sysadv-v090-'));
 try{
   let a=0,b=0;
   const opts={root,ttlMs:999999};
   assert.deepEqual(await readThroughFileCache('org-a:dashboard:30',async()=>({v:++a}),opts),{v:1});
   assert.deepEqual(await readThroughFileCache('org-b:dashboard:30',async()=>({v:++b}),opts),{v:1});
   await invalidateFileCache('org-a:dashboard:30',{root});
   assert.deepEqual(await readThroughFileCache('org-a:dashboard:30',async()=>({v:++a}),opts),{v:2});
   assert.deepEqual(await readThroughFileCache('org-b:dashboard:30',async()=>({v:++b}),opts),{v:1});
 }finally{await rm(root,{recursive:true,force:true})}
});
test('invalidation cannot be undone by an in-flight stale loader',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'sysadv-v090-'));
 try{
   let release=()=>{};
   const pending=readThroughFileCache('org-a:dashboard:7',()=>new Promise(resolve=>{release=()=>resolve({version:'old'});}),{root,ttlMs:999999});
   for(let i=0;i<100&&release.toString()==='()=>{}';i++) await new Promise(r=>setTimeout(r,2));
   await invalidateFileCache('org-a:dashboard:7',{root});
   release();await pending;
   assert.deepEqual(await readThroughFileCache('org-a:dashboard:7',async()=>({version:'new'}),{root,ttlMs:999999}),{version:'new'});
 }finally{await rm(root,{recursive:true,force:true})}
});
