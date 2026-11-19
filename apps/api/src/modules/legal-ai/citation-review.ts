import {z} from 'zod';

export const citationReviewInput=z.object({
 text:z.string().min(20).max(40000),
}).strict();

export function extractCitationCandidates(text:string){
 const patterns=[
  {type:'LEGISLATION',regex:/\b(?:Lei|Decreto|Resolu[cç][aã]o|CPC|CPP|CLT)\s*(?:n[º°o.]?\s*)?\d[\d.\/\-]*/giu},
  {type:'ARTICLE',regex:/\b(?:art(?:igo)?\.?\s*)\d+[\wº°\-]*/giu},
  {type:'CASE',regex:/\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/g},
  {type:'PRECEDENT',regex:/\b(?:S[uú]mula|Tema)\s*(?:n[º°o.]?\s*)?\d+\b/giu},
 ];
 const seen=new Set<string>();
 const candidates:{type:string;reference:string;status:'PENDING_VERIFICATION'}[]=[];
 for(const p of patterns){
  for(const match of text.matchAll(p.regex)){
   const reference=match[0].trim();
   const key=p.type+':'+reference.toLocaleLowerCase('pt-BR');
   if(!seen.has(key)){seen.add(key);candidates.push({type:p.type,reference,status:'PENDING_VERIFICATION'});}
   if(candidates.length>=100)return candidates;
  }
 }
 return candidates;
}
