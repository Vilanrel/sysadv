/** Safe, public error codes for the legal operations API.
 * Never return Prisma, filesystem or credential errors verbatim to clients. */
const safeCodes = new Set([
  'NOT_FOUND','DUPLICATE_TAX_ID','ALREADY_LINKED','ALREADY_EXISTS','HOLIDAY_ALREADY_EXISTS',
  'CHECKLIST_INCOMPLETE','TASK_ALREADY_DONE','RANGE_TOO_WIDE','FIELD_TOO_LONG',
  'INVALID_ACTIVE','INVALID_ASSIGNEE','INVALID_CHECKLIST_TITLE','INVALID_COMPLETED',
  'INVALID_DATE','INVALID_DESCRIPTION','INVALID_EMAIL','INVALID_EVENT_TYPE',
  'INVALID_INPUT','INVALID_INTERVAL','INVALID_KIND','INVALID_NAME','INVALID_PERSON',
  'INVALID_PHONE','INVALID_PRIORITY','INVALID_PROCESS','INVALID_REFERENCE',
  'INVALID_REQUIRED','INVALID_RESPONSIBLE','INVALID_ROLE','INVALID_STATE','INVALID_STATUS',
  'INVALID_TASK_TRANSITION','INVALID_TAX_ID','INVALID_TAX_ID_FOR_KIND','INVALID_TEXT',
  'INVALID_TITLE','INVALID_URL','INVALID_ZIP_CODE'
]);
const conflicts=new Set(['DUPLICATE_TAX_ID','ALREADY_LINKED','ALREADY_EXISTS','HOLIDAY_ALREADY_EXISTS']);
export function safeOperationError(error:unknown):{status:number;error:string} {
  const code=error instanceof Error?error.message:'';
  if(!safeCodes.has(code))return {status:500,error:'INTERNAL_ERROR'};
  return {status:code==='NOT_FOUND'?404:conflicts.has(code)?409:400,error:code};
}
