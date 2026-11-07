import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../../config/env.js';
const root = path.resolve(env.DOCUMENT_STORAGE_PATH);
export function safeStoragePath(key: string) { const result = path.resolve(root, key); if (!result.startsWith(root + path.sep)) throw new Error('INVALID_STORAGE_PATH'); return result; }
export async function storeBytes(bytes: Buffer) { await mkdir(root, { recursive: true }); const key = randomUUID(); const fullPath = safeStoragePath(key); await writeFile(fullPath, bytes, { flag: 'wx' }); return { storageKey: key, sha256: createHash('sha256').update(bytes).digest('hex'), sizeBytes: bytes.length }; }
export const readStoredBytes = (key: string) => readFile(safeStoragePath(key));

export const deleteStoredBytes = (key: string) => unlink(safeStoragePath(key));
