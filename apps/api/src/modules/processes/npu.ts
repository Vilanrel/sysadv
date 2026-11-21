import { npuRegex, isValidCnjNpu } from '@sysadv/contracts';
export const isValidNpu = (npu: string) => npuRegex.test(npu) && isValidCnjNpu(npu);
