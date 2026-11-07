import assert from 'node:assert/strict';
import { CALCULATION_TABS, statusLabel } from '../../apps/web/src/features/calculations/calculation-model.ts';
assert.equal(CALCULATION_TABS.length,16); assert.equal(CALCULATION_TABS.at(-1)?.id,'pjecalc'); assert.equal(statusLabel('VALIDATED'),'Validado'); console.log('calculation model tests passed');
