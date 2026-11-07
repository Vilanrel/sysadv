/** Funcoes de dominio sem dependencias externas, compartilhadas com testes de integridade. */
export function financialState(amountCents:number,paidCents:number,cancelledAt:Date|string|null) {
  if(cancelledAt)return 'CANCELLED';
  if(paidCents>=amountCents)return 'PAID';
  if(paidCents>0)return 'PARTIAL';
  return 'OPEN';
}
export function canReceivePayment(amountCents:number,paidCents:number,paymentCents:number,cancelledAt:unknown){
 return !cancelledAt && [amountCents,paidCents,paymentCents].every(Number.isSafeInteger) &&
 paymentCents>0 && paidCents>=0 && amountCents>0 && paidCents+paymentCents<=amountCents;
}
export function validLocalDate(value:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(value+'T00:00:00.000Z');return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value;
}
export function todayInZone(zone='America/Sao_Paulo'){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const date=Object.fromEntries(parts.map(p=>[p.type,p.value]));return `${date.year}-${date.month}-${date.day}`;
}
