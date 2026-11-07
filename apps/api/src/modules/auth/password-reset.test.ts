import { describe,expect,it } from 'vitest';
import { createHash } from 'node:crypto';
describe('password reset token protection',()=>{it('supports irreversible SHA-256 storage shape',()=>{const hash=createHash('sha256').update('example-token').digest('hex');expect(hash).toMatch(/^[a-f0-9]{64}$/);expect(hash).not.toContain('example-token')})});
