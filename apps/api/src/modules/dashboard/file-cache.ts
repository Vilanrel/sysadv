import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

type CacheOpts = { root: string; ttlMs: number; now?: () => number };
const inFlight = new Map<string, Promise<unknown>>();
const generations = new Map<string, number>();
const knownKeys = new Map<string, Set<string>>();
export function registerOrganizationDashboardKey(organizationId:string,key:string){
  const set=knownKeys.get(organizationId)??new Set<string>();set.add(key);knownKeys.set(organizationId,set);
}
function entry(key:string,root:string) {
  const resolved=path.resolve(root);
  const hashed=createHash('sha256').update(key).digest('hex');
  return { fullPath:path.join(resolved,`${hashed}.json`), pendingKey:`${resolved}:${hashed}` };
}
export async function invalidateFileCache(key:string,opts:{root:string}):Promise<void> {
  const {fullPath,pendingKey}=entry(key,opts.root);
  generations.set(pendingKey,(generations.get(pendingKey)??0)+1);
  await unlink(fullPath).catch(()=>undefined);
}
export async function invalidateOrganizationDashboard(organizationId:string,root:string):Promise<void> {
  const keys=[...(knownKeys.get(organizationId)??new Set<string>())];
  await Promise.all(keys.map(key=>invalidateFileCache(key,{root})));
  knownKeys.delete(organizationId);
}

export async function readThroughFileCache<T>(key: string, load: () => Promise<T>, opts: CacheOpts): Promise<T> {
  const root=path.resolve(opts.root);
  const {fullPath,pendingKey}=entry(key,root);
  const generation=generations.get(pendingKey)??0;
  const flightKey=`${pendingKey}:${generation}`;
  const existing = inFlight.get(flightKey);
  if (existing) return existing as Promise<T>;
  const task = (async () => {
    const now = opts.now?.() ?? Date.now();
    try {
      const parsed = JSON.parse(await readFile(fullPath, 'utf8')) as { savedAt?: number; value?: T };
      if (typeof parsed.savedAt === 'number' && parsed.savedAt <= now && now - parsed.savedAt < opts.ttlMs && parsed.value !== undefined && (parsed as any).generation === generation) return parsed.value;
    } catch { /* missing/expired/corrupt cache falls through to authoritative source */ }
    const value = await load();
    let temporary = '';
    try {
      if((generations.get(pendingKey)??0)===generation){
        await mkdir(root, {recursive:true, mode:0o700});
        temporary = `${fullPath}.${randomUUID()}.tmp`;
        await writeFile(temporary, JSON.stringify({ savedAt: now, value, generation }), { flag:'wx', mode:0o600 });
        if((generations.get(pendingKey)??0)===generation)await rename(temporary, fullPath);
        else await unlink(temporary).catch(()=>undefined);
      }
    } catch {
      if (temporary) await unlink(temporary).catch(()=>undefined);
      // A cache write error must never turn a successful PostgreSQL read into a failure.
    }
    return value;
  })();
  inFlight.set(flightKey, task);
  try { return await task; }
  finally { inFlight.delete(flightKey); }
}
