import { prisma } from '../../db/prisma.js';
/** Guarda contra referencias cruzadas entre escritorios, inclusive em IDs opcionais. */
export async function checkOfficeReferences(organizationId:string,input:{clientId?:string|null;personId?:string|null;processId?:string|null;intakeId?:string|null;agreementId?:string|null;taskId?:string|null;responsibleId?:string|null}) {
  const checks:Promise<unknown>[]=[];
  if(input.clientId)checks.push(prisma.person.findFirst({where:{id:input.clientId,organizationId,active:true},select:{id:true}}));
  if(input.personId)checks.push(prisma.person.findFirst({where:{id:input.personId,organizationId,active:true},select:{id:true}}));
  if(input.processId)checks.push(prisma.legalProcess.findFirst({where:{id:input.processId,organizationId,deletedAt:null},select:{id:true}}));
  if(input.intakeId)checks.push(prisma.officeIntake.findFirst({where:{id:input.intakeId,organizationId},select:{id:true}}));
  if(input.agreementId)checks.push(prisma.feeAgreement.findFirst({where:{id:input.agreementId,organizationId},select:{id:true}}));
  if(input.taskId)checks.push(prisma.workTask.findFirst({where:{id:input.taskId,organizationId},select:{id:true}}));
  if(input.responsibleId)checks.push(prisma.user.findFirst({where:{id:input.responsibleId,organizationId,status:'ACTIVE'},select:{id:true}}));
  if((await Promise.all(checks)).some(result=>!result))throw new Error('INVALID_REFERENCE');
}
