function parseDate(value:unknown):Date|null {
  if(value===null||value===undefined||value==='')return null;
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value))throw new Error('INVALID_DATE');
  const date=new Date(value);if(Number.isNaN(date.getTime()))throw new Error('INVALID_DATE');
  const part=value.slice(0,10);
  const [y,m,d]=part.split('-').map(Number);
  if(new Date(Date.UTC(y,m-1,d)).toISOString().slice(0,10)!==part)throw new Error('INVALID_DATE');
  return date;
}
export const EVENT_TYPES=['HEARING','MEETING','DEADLINE','OTHER'] as const;
export function validateCalendarRange(from:unknown,to:unknown){
  const start=parseDate(from);const end=parseDate(to);
  if(!start||!end||end<start)throw new Error('INVALID_INTERVAL');
  if(end.getTime()-start.getTime()>366*86400000)throw new Error('RANGE_TOO_WIDE');
  return {from:start,to:end};
}
export function validateCalendarEvent(input:Record<string,unknown>,partial=false) {
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('INVALID_INPUT');
  const out:{title?:string;type?:typeof EVENT_TYPES[number];startsAt?:Date;endsAt?:Date|null;processId?:string|null;responsibleId?:string|null;location?:string|null;meetingUrl?:string|null;notes?:string|null}={};
  if(!partial||'title'in input){const title=typeof input.title==='string'?input.title.trim():'';if(title.length<2||title.length>180)throw new Error('INVALID_TITLE');out.title=title;}
  if(!partial||'type'in input){const type=input.type??'MEETING';if(!EVENT_TYPES.includes(type as any))throw new Error('INVALID_EVENT_TYPE');out.type=type as typeof EVENT_TYPES[number];}
  if(!partial||'startsAt'in input){const startsAt=parseDate(input.startsAt);if(!startsAt)throw new Error('INVALID_DATE');out.startsAt=startsAt;}
  if('endsAt'in input)out.endsAt=parseDate(input.endsAt);
  if(out.startsAt&&out.endsAt&&out.endsAt<out.startsAt)throw new Error('INVALID_INTERVAL');
  for(const key of ['processId','responsibleId'] as const){if(key in input){const val=input[key];if(val!==null&&val!==undefined&&(typeof val!=='string'||val.length<3||val.length>120))throw new Error('INVALID_REFERENCE');out[key]=(val as string)||null;}}
  for(const key of ['location','meetingUrl','notes'] as const){if(key in input){const val=input[key];if(val!==null&&val!==undefined&&typeof val!=='string')throw new Error('INVALID_TEXT');const str=String(val??'').trim();if(str.length>(key==='notes'?5000:700))throw new Error('INVALID_TEXT');out[key]=str||null;}}
  if(out.meetingUrl){try{const u=new URL(out.meetingUrl);if(!['https:','http:'].includes(u.protocol))throw new Error()}catch{throw new Error('INVALID_URL')}}
  return out;
}
