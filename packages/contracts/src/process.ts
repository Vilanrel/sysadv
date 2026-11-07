import { z } from 'zod';
export const npuRegex = /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/;
export const processSchema = z.object({
  npu: z.string().regex(npuRegex, 'NPU inválido'), claimant: z.string().optional(), defendant: z.string().optional(),
  claimantDocument: z.string().optional(), defendantDocument: z.string().optional(), court: z.string().optional(), trt: z.string().optional(),
  judicialSegment: z.string().optional(), judicialSegmentCode: z.string().optional(), tribunalCode: z.string().optional(), datajudAlias: z.string().optional(), judgingBody: z.string().optional(),
  laborCourt: z.string().optional(), municipality: z.string().optional(), responsibleLawyer: z.string().optional(), filingDate: z.string().optional(),
  admissionDate: z.string().optional(), terminationDate: z.string().optional(), jobTitle: z.string().optional(), contractualSalaryCents: z.number().int().nonnegative().optional(),
  referenceDate: z.string().optional(), proceduralPhase: z.string().optional(), calculationDueDate: z.string().optional(), notes: z.string().max(10000).optional()
});
export const sourceTypeSchema = z.enum(['OFFICIAL','AI','MANUAL']);
export const fieldStatusSchema = z.enum(['PENDING','VALIDATED','DIVERGENCE']);
export type ProcessInput = z.infer<typeof processSchema>;
