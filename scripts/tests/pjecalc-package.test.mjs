import assert from 'node:assert/strict';
import { buildPjeCalcManifest, compareParameters } from '../../apps/api/src/modules/calculations/pjecalc-package.ts';
const m=buildPjeCalcManifest({calculationId:'c1',version:2,npu:'0000000-00.2026.5.02.0001',parameters:{salary:1000}});
assert.equal(m.format,'SYSADV-PJECALC-1'); assert.equal(m.version,2); assert.equal(m.calculationId,'c1'); assert.match(m.sha256,/^[a-f0-9]{64}$/);
const d=compareParameters({salary:1000,fgts:true},{salary:1200,fgts:true,fee:10});
assert.deepEqual(d,[{field:'fee',before:undefined,after:10},{field:'salary',before:1000,after:1200}]);
console.log('package tests passed');
