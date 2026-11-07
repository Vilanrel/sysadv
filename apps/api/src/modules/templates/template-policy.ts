import { createHash, timingSafeEqual } from 'node:crypto';
import path from 'node:path';

export function canReadPrivateDocument(
  doc: { isPrivate: boolean; uploadedById: string },
  userId: string,
  roleCodes: string[]
): boolean {
  return !doc.isPrivate || doc.uploadedById === userId || roleCodes.includes('ADMIN');
}
export function validateBlockSelection(selected: string[], available: { id: string }[]): string[] {
  const allowed = new Set(available.map(b => b.id));
  const unique = [...new Set(selected)];
  if (unique.some(id => !allowed.has(id))) throw new Error('INVALID_BLOCK');
  return unique;
}
export function validateDocxImport(fileName: string, bytes: Buffer) {
  if (bytes.length > 5 * 1024 * 1024) throw new Error('FILE_TOO_LARGE');
  if (path.extname(fileName).toLowerCase() !== '.docx') throw new Error('INVALID_FILE_TYPE');
  if (bytes.length === 0) throw new Error('EMPTY_FILE');
}
export function verifyStoredHash(bytes: Buffer, expectedSha256: string): void {
  const actual = createHash('sha256').update(bytes).digest();
  if (!/^[0-9a-f]{64}$/i.test(expectedSha256)) throw new Error('FILE_CORRUPT');
  const expected = Buffer.from(expectedSha256, 'hex');
  if (expected.length !== actual.length || !timingSafeEqual(actual, expected)) throw new Error('FILE_CORRUPT');
}
