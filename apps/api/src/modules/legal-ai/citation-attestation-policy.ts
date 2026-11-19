import {z} from 'zod';

export function isAllowedOfficialSource(value:string){
 try{
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||url.port)return false;
  const host=url.hostname.toLowerCase();
  return host==='planalto.gov.br'||host.endsWith('.planalto.gov.br')
   ||host==='jus.br'||host.endsWith('.jus.br');
 }catch{return false;}
}
export const citationAttestationInput=z.object({
 reference:z.string().trim().min(3).max(500),
 referenceType:z.enum(['LEGISLATION','ARTICLE','CASE','PRECEDENT']),
 sourceUrl:z.string().url().max(1500).refine(isAllowedOfficialSource,'OFFICIAL_SOURCE_REQUIRED'),
 reviewNotes:z.string().trim().max(2000).nullable().optional(),
 personallyChecked:z.literal(true),
}).strict();
