import {describe,expect,it} from 'vitest';
import {officeError} from './office-policy.js';

describe('officeError',()=>{
  it('translates missing evidence to 400 instead of 500',()=>{
    const reply={
      status:0,
      payload:null as unknown,
      code(status:number){this.status=status;return this;},
      send(payload:unknown){this.payload=payload;return this;},
    };
    officeError(reply,new Error('EVIDENCE_REQUIRED'));
    expect(reply.status).toBe(400);
    expect(reply.payload).toEqual({error:'EVIDENCE_REQUIRED'});
  });
  it('does not expose unexpected internal exception text',()=>{
    const reply={
      status:0,
      payload:null as unknown,
      code(status:number){this.status=status;return this;},
      send(payload:unknown){this.payload=payload;return this;},
    };
    officeError(reply,new Error('sensitive internal diagnostics'));
    expect(reply.status).toBe(500);
    expect(reply.payload).toEqual({error:'INTERNAL_ERROR'});
  });
});
