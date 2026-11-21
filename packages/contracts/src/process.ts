import { z } from 'zod';
export const npuRegex = /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/;

/** CNJ 65/2008: confere formato e digito modulo 97, sem coercoes numericas. */
export function isValidCnjNpu(value: string): boolean {
  if (!npuRegex.test(value) && !/^\d{20}$/.test(value)) return false;
  const digits = value.replace(/\D/g, '');
  const base = BigInt(digits.slice(0, 7) + digits.slice(9) + '00');
  return 98n - base % 97n === BigInt(digits.slice(7, 9));
}
export const processSchema = z.object({
  npu: z.string().regex(npuRegex, 'NPU inválido').refine(isValidCnjNpu, 'Digito verificador CNJ invalido'), claimant: z.string().optional(), defendant: z.string().optional(),
  claimantDocument: z.string().optional(), defendantDocument: z.string().optional(), court: z.string().optional(), trt: z.string().optional(),
  judicialSegment: z.string().optional(), judicialSegmentCode: z.string().optional(), tribunalCode: z.string().optional(), datajudAlias: z.string().optional(), judgingBody: z.string().optional(),
  laborCourt: z.string().optional(), municipality: z.string().optional(), responsibleLawyer: z.string().optional(), filingDate: z.string().optional(),
  admissionDate: z.string().optional(), terminationDate: z.string().optional(), jobTitle: z.string().optional(), contractualSalaryCents: z.number().int().nonnegative().optional(),
  referenceDate: z.string().optional(), proceduralPhase: z.string().optional(), calculationDueDate: z.string().optional(), notes: z.string().max(10000).optional()
});
export const sourceTypeSchema = z.enum(['OFFICIAL','AI','MANUAL']);
export const fieldStatusSchema = z.enum(['PENDING','VALIDATED','DIVERGENCE']);
export type ProcessInput = z.infer<typeof processSchema>;
