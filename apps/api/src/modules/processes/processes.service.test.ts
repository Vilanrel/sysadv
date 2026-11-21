import { describe, expect, it } from 'vitest';
import { processSchema } from '@sysadv/contracts';
import { isValidNpu } from './npu.js';

describe('NPU CNJ - modulo 97', () => {
  const valid='1051528-57.2024.8.26.0053';
  it('aceita NPU formatado com digito verificador valido', () => {
    expect(isValidNpu(valid)).toBe(true);
    expect(processSchema.safeParse({npu:valid}).success).toBe(true);
  });
  it('rejeita formato incorreto e digito alterado antes de cadastrar ou editar', () => {
    expect(isValidNpu('123')).toBe(false);
    expect(isValidNpu('1051528-56.2024.8.26.0053')).toBe(false);
    expect(processSchema.safeParse({npu:'1051528-56.2024.8.26.0053'}).success).toBe(false);
    expect(processSchema.partial().safeParse({npu:'1051528-56.2024.8.26.0053'}).success).toBe(false);
  });
});
