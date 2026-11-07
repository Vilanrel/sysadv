import { z } from 'zod';
export const loginSchema = z.object({ email: z.string().email().transform(v => v.toLowerCase().trim()), password: z.string().min(1) });
export const userRoleCodeSchema = z.enum(['ADMIN','LAWYER','CALCULATOR','VIEWER']);
export const createUserSchema = z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(12), roleCodes: z.array(userRoleCodeSchema).min(1) });
export const updateUserSchema = z.object({ name: z.string().min(2).optional(), email: z.string().email().optional(), roleCodes: z.array(userRoleCodeSchema).min(1).optional(), mfaRequired: z.boolean().optional() });
export const userStatusActionSchema = z.object({ reason: z.string().min(3).max(500) });
export type LoginInput = z.infer<typeof loginSchema>;
export type AuthContext = { userId: string; organizationId: string; roleCodes: string[]; permissionCodes: string[] };
