import { z } from 'zod';
export const documentTypeSchema = z.enum(['SENTENCE','APPEAL','EMBARGO','CALCULATION','PAYSLIP','OTHER']);
export const allowedDocumentMimeTypes = ['application/pdf'] as const;
