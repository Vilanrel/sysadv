import { npuRegex } from '@sysadv/contracts';
export const isValidNpu = (npu: string) => npuRegex.test(npu);
