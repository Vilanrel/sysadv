import { createHash } from 'node:crypto';
import { z } from 'zod';
import { requestJudicialJson, JudicialUpstreamError } from './http.js';
import { resolveJudicialSegment } from '../processes/judicial-segment.js';

export const dateString=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const [y,m,d]=v.split('-').map(Number);const dt=new Date(Date.UTC(y,m-1,d));return dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d;},'INVALID_DATE');
export const djenFilterSchema=z.object({from:dateString,to:dateString,tribunal:z.string().regex(/^[A-Z0-9-]{2,12}$/).optional(),oabNumber:z.string().trim().regex(/^[A-Za-z0-9.\-/]{1,25}$/).optional(),oabState:z.string().regex(/^[A-Z]{2}$/).optional(),npu:z.string().regex(/^\d{20}$/).optional(),pageSize:z.number().int().min(1).max(100).default(50)}).strict().refine(v=>v.from<=v.to,{message:'INVALID_DATE_RANGE'}).refine(v=>!!v.oabNumber===!!v.oabState,{message:'OAB_UF_REQUIRED'});
export type DjenFilters=z.infer<typeof djenFilterSchema>;
export type DjenItem={externalId:string;processNumber:string;body:string;tribunal:string|null;actType:string;title:string|null;availableOn:string|null;publishedOn:string|null;original:Record<string,unknown>;providerVersion:string|null;sourceUrl:string|null};
export type DjenPage={items:DjenItem[];totalPages:number;page:number};
export type DjenMapping={itemsPath:'items'|'data.items'|'content';totalPath:'totalPages'|'totalPaginas'|'total_pages'|'page.totalPages'|'totalElements';fieldMapping?:Record<string,string>};
const asRecord=(v:unknown):Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
export function readMappedPath(value:unknown,path:string):unknown {
  if(!/^[a-zA-Z][\w]*(\.[a-zA-Z][\w]*){0,4}$/.test(path) || path.split('.').some(key=>['constructor','prototype','__proto__'].includes(key)))return undefined;
  return path.split('.').reduce<unknown>((acc,key)=>asRecord(acc)[key],value);
}
function safeText(v:unknown,max=250_000){return typeof v==='string'?v.trim().slice(0,max):typeof v==='number'?String(v):'';}
function localDate(v:unknown):string|null {const raw=safeText(v,50);return /^\d{4}-\d{2}-\d{2}$/.test(raw)?raw:/^\d{4}-\d{2}-\d{2}T/.test(raw)?raw.slice(0,10):null;}
export function validCnjNumber(digits:string):boolean {
  if(!/^\d{20}$/.test(digits))return false;
  const value=BigInt(digits.slice(0,7)+digits.slice(9)+'00');
  return 98n-(value%97n)===BigInt(digits.slice(7,9));
}
function normalizeNpu(v:unknown):string {const digits=safeText(v,50).replace(/\D/g,'');return validCnjNumber(digits)?digits:'';}
export function normalizeDjenItem(raw:unknown,mapping:Record<string,string>={}):DjenItem {
  const item=asRecord(raw);
  function field(key:string,fallback:string){return readMappedPath(item,mapping[key]??fallback);}
  const externalId=safeText(field('externalId','hash'),128)||safeText(item.id,128);
  const processNumber=normalizeNpu(field('npu','numeroProcesso'));
  const body=safeText(field('content','texto'));
  if(!externalId||!body)throw new JudicialUpstreamError('DJEN_REQUIRED_FIELD_MISSING');
  return {externalId,processNumber,body,tribunal:safeText(field('tribunal','siglaTribunal'),30)||null,
    actType:safeText(field('actType','tipoComunicacao'),100)||'Publicação',title:safeText(field('title','nomeOrgao'),250)||null,
    availableOn:localDate(field('availableOn','dataDisponibilizacao')),publishedOn:localDate(field('publishedOn','dataPublicacao')),
    providerVersion:safeText(field('providerVersion','versao'),60)||null,
    sourceUrl:safeText(field('sourceUrl','link'),500)||null,original:item};
}
export function parseDjenPage(raw:unknown,page:number,pageSize:number,config:DjenMapping):DjenPage {
  const items=readMappedPath(raw,config.itemsPath);
  const total=readMappedPath(raw,config.totalPath);
  if(!Array.isArray(items)||!Number.isInteger(Number(total))||Number(total)<0)throw new JudicialUpstreamError('DJEN_SCHEMA_UNVERIFIED',undefined,undefined,raw);
  const totalPages=config.totalPath==='totalElements'?Math.ceil(Number(total)/pageSize):Number(total);
  if(totalPages>2000 || items.length>pageSize || (totalPages<page && items.length>0))throw new JudicialUpstreamError('DJEN_PAGE_LIMIT_MISMATCH',undefined,undefined,raw);
  if(totalPages>=page && items.length===0)throw new JudicialUpstreamError('DJEN_PREMATURE_EMPTY_PAGE',undefined,undefined,raw);
  try{return {items:items.map(item=>normalizeDjenItem(item,config.fieldMapping)),totalPages,page};}
  catch(error){if(error instanceof JudicialUpstreamError)throw new JudicialUpstreamError(error.code,error.httpStatus,undefined,raw);throw error;}
}
export async function fetchDjenPage(filters:DjenFilters,page:number,config:DjenMapping,fetchImpl:typeof fetch=fetch,environment:'PRODUCTION'|'HOMOLOGATION'='PRODUCTION'):Promise<DjenPage>{
  if(!Number.isInteger(page)||page<1||page>2000)throw new JudicialUpstreamError('DJEN_PAGE_LIMIT');
  const params=new URLSearchParams({dataDisponibilizacaoInicio:filters.from,dataDisponibilizacaoFim:filters.to,pagina:String(page),itensPorPagina:String(filters.pageSize)});
  if(filters.tribunal)params.set('siglaTribunal',filters.tribunal);
  if(filters.oabNumber)params.set('numeroOab',filters.oabNumber);
  if(filters.oabState)params.set('ufOab',filters.oabState);
  if(filters.npu)params.set('numeroProcesso',filters.npu);
  const response=await requestJudicialJson(environment==='HOMOLOGATION'?'DJEN_HOMOLOGATION':'DJEN',`/api/v1/comunicacao?${params}`,{},fetchImpl);
  return parseDjenPage(response,page,filters.pageSize,config);
}

export const tjdftSearchSchema=z.object({query:z.string().trim().min(2).max(200),pagina:z.number().int().min(0).max(2000).default(0),tamanho:z.number().int().min(1).max(50).default(10),termosAcessorios:z.array(z.object({campo:z.enum(['base','subbase','origem','uuid','identificador','identificadorOrdenacao','processo','nomeRelator','nomeRevisor','nomeRelatorDesignado','descricaoOrgaoJulgador','dataJulgamento','dataPublicacao','descricaoClasseCnj']),valor:z.string().max(250)}).strict()).max(12).optional()}).strict();
export type TjdftSearch=z.infer<typeof tjdftSearchSchema>;
export async function searchTjdft(input:TjdftSearch,fetchImpl:typeof fetch=fetch){
  const validated=tjdftSearchSchema.parse(input);
  const raw=asRecord(await requestJudicialJson('TJDFT_JURISDF','/api/v1/pesquisa',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(validated)},fetchImpl));
  if(!Array.isArray(raw.registros)||typeof raw.hits!=='number')throw new JudicialUpstreamError('TJDFT_SCHEMA_CHANGED');
  return {total:raw.hits,pagina:validated.pagina,tamanho:validated.tamanho,registros:raw.registros.map(asRecord),source:'TJDFT_JURISDF'};
}
export const stjSearchSchema=z.object({q:z.string().trim().min(2).max(120),rows:z.number().int().min(1).max(50).default(10)}).strict();
export async function searchStjCatalog(input:z.infer<typeof stjSearchSchema>,fetchImpl:typeof fetch=fetch){
  const validated=stjSearchSchema.parse(input);
  const raw=asRecord(await requestJudicialJson('STJ_CKAN',`/api/3/action/package_search?${new URLSearchParams({q:validated.q,rows:String(validated.rows)})}`,{},fetchImpl));
  const result=asRecord(raw.result);
  if(raw.success!==true||!Array.isArray(result.results)||typeof result.count!=='number')throw new JudicialUpstreamError('STJ_CKAN_UNSUCCESSFUL');
  return {count:result.count,results:result.results.map(asRecord),source:'STJ_CKAN',note:'Apenas metadados. Arquivos/ZIP nao baixados automaticamente.'};
}
export function sha256(value:unknown):string {return createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');}

const confirmedAliases=new Set(['api_publica_stj','api_publica_trf1','api_publica_trt3','api_publica_tst','api_publica_tse']);
// 27 aliases estaduais documentados em F05; nenhum endpoint e inferido de sigla livre.
export async function searchAuthorizedDataJud(npu:string,apiKey:string,fetchImpl:typeof fetch=fetch){
  const digits=npu.replace(/\D/g,'');if(!validCnjNumber(digits))throw new JudicialUpstreamError('INVALID_NPU');
  const routing=resolveJudicialSegment(digits);const alias=`api_publica_${routing.datajudAlias}`;
  if(routing.segmentCode==='8'){ /* fonte estadual coberta pelo catalogo documental */ }
  else if(!confirmedAliases.has(alias))throw new JudicialUpstreamError('DATAJUD_ALIAS_NOT_VERIFIED');
  const body={size:100,query:{match:{numeroProcesso:digits}}};
  const raw=asRecord(await requestJudicialJson('DATAJUD',`/${alias}/_search`,{method:'POST',headers:{authorization:`APIKey ${apiKey}`,'content-type':'application/json'},body:JSON.stringify(body)},fetchImpl));
  const hits=asRecord(raw.hits);
  if(!Array.isArray(hits.hits))throw new JudicialUpstreamError('DATAJUD_SCHEMA_CHANGED');
  const matching=(hits.hits as unknown[]).map(asRecord).filter(row=>String(asRecord(row._source).numeroProcesso??'').replace(/\D/g,'')===digits);
  return {source:'CNJ/DataJud',provider:'DATAJUD',alias,found:matching.length>0,records:matching,complete:matching.length<100,notice:'Dados podem estar incompletos. Uso somente nao comercial autorizado.'};
}
