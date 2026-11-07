import {test} from 'node:test';
import assert from 'node:assert/strict';
import {safeOperationError} from '../../apps/api/src/modules/operations/operation-errors.ts';

test('business validation failures expose only controlled codes and proper status',()=>{
  assert.deepEqual(safeOperationError(new Error('INVALID_TAX_ID')), {status:400,error:'INVALID_TAX_ID'});
  assert.deepEqual(safeOperationError(new Error('CHECKLIST_INCOMPLETE')), {status:400,error:'CHECKLIST_INCOMPLETE'});
  assert.deepEqual(safeOperationError(new Error('NOT_FOUND')), {status:404,error:'NOT_FOUND'});
  assert.deepEqual(safeOperationError(new Error('HOLIDAY_ALREADY_EXISTS')), {status:409,error:'HOLIDAY_ALREADY_EXISTS'});
});
test('database/internal stack messages must never be exposed to clients',()=>{
  assert.deepEqual(safeOperationError(new Error('Error at /app/src/db: connection password=secret')), {status:500,error:'INTERNAL_ERROR'});
  assert.deepEqual(safeOperationError(undefined), {status:500,error:'INTERNAL_ERROR'});
});
