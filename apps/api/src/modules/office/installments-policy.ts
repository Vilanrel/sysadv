import { z } from 'zod';
import { dayString } from './office-policy.js';

export const installmentsInput=z.object({
  installments:z.number().int().min(1).max(60),
  firstDueOn:dayString,
}).strict();

export function distributeCents(total:number,count:number):number[] {
  if(!Number.isSafeInteger(total)||total<=0||!Number.isInteger(count)||count<1||count>60||total<count)throw new Error('INVALID_AMOUNT');
  const q=Math.floor(total/count),r=total%count;
  return Array.from({length:count},(_,i)=>q+(i<r?1:0));
}

export function monthlyDueDates(firstDueOn:string,count:number):string[] {
  const [year,month,day]=firstDueOn.split('-').map(Number);
  if(!Number.isInteger(count)||count<1||count>60||day<1||day>31)throw new Error('INVALID_REQUEST');
  return Array.from({length:count},(_,i)=>{
    const monthBase=new Date(Date.UTC(year,month-1+i,1));
    const y=monthBase.getUTCFullYear(),m=monthBase.getUTCMonth();
    const last=new Date(Date.UTC(y,m+1,0)).getUTCDate();
    return new Date(Date.UTC(y,m,Math.min(day,last))).toISOString().slice(0,10);
  });
}
