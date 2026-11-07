export const TASK_PRIORITIES=['LOW','NORMAL','HIGH','URGENT'] as const;
export const TASK_STATUSES=['TODO','IN_PROGRESS','REVIEW','DONE','CANCELLED'] as const;
export type TaskStatus = typeof TASK_STATUSES[number];
export type TaskPriority = typeof TASK_PRIORITIES[number];
export function parseDate(value:unknown):Date|null {
  if(value===undefined||value===null||value==='')return null;
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value))throw new Error('INVALID_DATE');
  const result=new Date(value);if(Number.isNaN(result.getTime()))throw new Error('INVALID_DATE');
  const datePart=value.slice(0,10);
  const [year,month,day]=datePart.split('-').map(Number);
  if(new Date(Date.UTC(year,month-1,day)).toISOString().slice(0,10)!==datePart)throw new Error('INVALID_DATE');
  return result;
}
export function validateTask(input:Record<string,unknown>,partial=false) {
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('INVALID_INPUT');
  const result:{title?:string;description?:string|null;priority?:TaskPriority;dueAt?:Date|null;assignedToId?:string|null;processId?:string|null;personId?:string|null;status?:TaskStatus}={};
  if(!partial||'title'in input){const title=typeof input.title==='string'?input.title.trim().replace(/\s+/g,' '):'';if(title.length<2||title.length>200)throw new Error('INVALID_TITLE');result.title=title;}
  if(!partial||'priority'in input){const priority=input.priority??'NORMAL';if(!TASK_PRIORITIES.includes(priority as TaskPriority))throw new Error('INVALID_PRIORITY');result.priority=priority as TaskPriority;}
  if('status'in input){if(!TASK_STATUSES.includes(input.status as TaskStatus))throw new Error('INVALID_STATUS');result.status=input.status as TaskStatus;}
  if('dueAt'in input)result.dueAt=parseDate(input.dueAt);
  if('description'in input){if(input.description!==null&&input.description!==undefined&&typeof input.description!=='string')throw new Error('INVALID_DESCRIPTION');const s=String(input.description??'').trim();if(s.length>10000)throw new Error('INVALID_DESCRIPTION');result.description=s||null;}
  for(const key of ['assignedToId','processId','personId'] as const){if(key in input){const val=input[key];if(val!==null&&val!==undefined&&(typeof val!=='string'||val.length>120||val.length<3))throw new Error('INVALID_REFERENCE');result[key]=(val as string)||null;}}
  return result;
}
export function assertChecklistComplete(items:{required:boolean;completed:boolean}[]):void {
  if(items.some(item=>item.required&&!item.completed))throw new Error('CHECKLIST_INCOMPLETE');
}
export function validateTaskTransition(current:TaskStatus,next:TaskStatus):void {
  if(current==='CANCELLED'&&next!=='CANCELLED')throw new Error('INVALID_TASK_TRANSITION');
  if(current==='DONE'&&next==='CANCELLED')throw new Error('INVALID_TASK_TRANSITION');
}
export function validateChecklistItem(input:Record<string,unknown>) {
  const title=typeof input.title==='string'?input.title.trim():'';
  if(!title||title.length>250)throw new Error('INVALID_CHECKLIST_TITLE');
  if('required'in input&&typeof input.required!=='boolean')throw new Error('INVALID_REQUIRED');
  return { title,required:input.required===undefined?true:input.required as boolean };
}
