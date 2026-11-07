import { createHash, timingSafeEqual } from 'node:crypto';
export function hashAgentToken(token:string){return createHash('sha256').update(token).digest('hex');}
export function verifyAgentToken(token:string,hash:string){const a=Buffer.from(hashAgentToken(token),'hex'),b=Buffer.from(hash,'hex');return a.length===b.length&&timingSafeEqual(a,b);}
