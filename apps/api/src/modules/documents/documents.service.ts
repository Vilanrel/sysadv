import path from 'node:path';
import { prisma } from '../../db/prisma.js';
import { env } from '../../config/env.js';
import { storeBytes, readStoredBytes } from './storage.js';
import { canReadPrivateDocument, verifyStoredHash } from '../templates/template-policy.js';
const extensions: Record<string,string[]> = { 'application/pdf': ['.pdf'] };
export class DocumentsService {
  async store(input: { processId: string; originalName: string; mimeType: string; bytes: Buffer; type?: 'SENTENCE'|'APPEAL'|'EMBARGO'|'CALCULATION'|'PAYSLIP'|'OTHER' }, auth: { userId: string; organizationId: string }) {
    if (input.bytes.length > env.MAX_DOCUMENT_BYTES) throw new Error('FILE_TOO_LARGE');
    const ext = path.extname(input.originalName).toLowerCase(); if (!extensions[input.mimeType]?.includes(ext)) throw new Error('INVALID_FILE_TYPE');
    if (input.mimeType === 'application/pdf' && !input.bytes.subarray(0,5).toString().startsWith('%PDF-')) throw new Error('MIME_MISMATCH');
    const process = await prisma.legalProcess.findFirst({ where: { id: input.processId, organizationId: auth.organizationId } }); if (!process) throw new Error('NOT_FOUND');
    const stored = await storeBytes(input.bytes);
    return prisma.document.create({ data: { organizationId: auth.organizationId, processId: input.processId, uploadedById: auth.userId, type: input.type ?? 'OTHER', originalName: path.basename(input.originalName), mimeType: input.mimeType, ...stored } });
  }
  list(processId: string, org: string, userId?: string, roleCodes: string[] = []) { return prisma.document.findMany({ where: { processId, organizationId: org, ...(roleCodes.includes('ADMIN') ? {} : { OR: [{ isPrivate: false }, { uploadedById: userId ?? '' }] }) }, orderBy: { createdAt: 'desc' } }); }
  listAll(org: string, userId?: string, roleCodes: string[] = []) { return prisma.document.findMany({ where: { organizationId: org, ...(roleCodes.includes('ADMIN') ? {} : { OR: [{ isPrivate: false }, { uploadedById: userId ?? '' }] }) }, orderBy: { createdAt: 'desc' }, take: 250, include: { process: { select: { id: true, npu: true, claimant: true, defendant: true } } } }); }
  async download(id: string, org: string, userId?: string, roleCodes: string[] = []) { const doc = await prisma.document.findFirst({ where: { id, organizationId: org } }); if (!doc) throw new Error('NOT_FOUND'); if (!canReadPrivateDocument(doc, userId ?? '', roleCodes)) throw new Error('FORBIDDEN'); const bytes = await readStoredBytes(doc.storageKey); verifyStoredHash(bytes, doc.sha256); return { doc, bytes }; }
}
