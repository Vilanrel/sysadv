import assert from 'node:assert/strict';
import { hashAgentToken, verifyAgentToken } from '../../apps/api/src/modules/pjecalc-agent/agent-token.ts';
const token='agent-secret-123'; const hash=hashAgentToken(token); assert.notEqual(hash,token); assert.match(hash,/^[a-f0-9]{64}$/); assert.equal(verifyAgentToken(token,hash),true); assert.equal(verifyAgentToken('wrong',hash),false); console.log('agent token tests passed');
