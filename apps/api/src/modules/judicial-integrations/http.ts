/** HTTP egress com host fixo, timeout, tamanho e conteudo JSON verificados. */
export class JudicialUpstreamError extends Error {
  constructor(public readonly code:string, public readonly httpStatus?:number, public readonly retryAfterSeconds?:number, public readonly payload?:unknown) { super(code); this.name='JudicialUpstreamError'; }
}
const ALLOWED: Record<string,string> = {
  DJEN: 'https://comunicaapi.pje.jus.br',
  DJEN_HOMOLOGATION: 'https://hcomunicaapi.cnj.jus.br',
  TJDFT_JURISDF:'https://jurisdf.tjdft.jus.br',
  STJ_CKAN:'https://dadosabertos.web.stj.jus.br',
  DATAJUD:'https://api-publica.datajud.cnj.jus.br'
};
export function safeJudicialUrl(code:string, path:string): URL {
  const origin=ALLOWED[code];
  if (!origin || !path.startsWith('/') || path.startsWith('//') || path.includes('\\')) throw new JudicialUpstreamError('JUDICIAL_HOST_NOT_APPROVED');
  const url=new URL(path,origin);
  if (url.origin!==origin || url.username || url.password || url.protocol!=='https:') throw new JudicialUpstreamError('JUDICIAL_HOST_NOT_APPROVED');
  return url;
}
export function parseRetryAfter(value:string|null):number|undefined {
  if(!value)return undefined;
  const secs=Number(value);
  if(Number.isFinite(secs)&&secs>=0)return Math.min(3600,Math.ceil(secs));
  const date=Date.parse(value);
  return Number.isFinite(date)?Math.min(3600,Math.max(0,Math.ceil((date-Date.now())/1000))):undefined;
}
export async function requestJudicialJson(code:string,path:string,init:RequestInit={},fetchImpl:typeof fetch=fetch):Promise<unknown>{
  const url=safeJudicialUrl(code,path);
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),30000);
  try{
    const response=await fetchImpl(url.toString(),{...init,redirect:'manual',signal:controller.signal,headers:{accept:'application/json',...init.headers}});
    if(response.status>=300&&response.status<400)throw new JudicialUpstreamError('JUDICIAL_REDIRECT_BLOCKED',response.status);
    if(!response.ok)throw new JudicialUpstreamError(`JUDICIAL_HTTP_${response.status}`,response.status,parseRetryAfter(response.headers.get('retry-after')));
    if(!/\bapplication\/(?:[a-z0-9.+-]*\+)?json\b/i.test(response.headers.get('content-type')??''))throw new JudicialUpstreamError('JUDICIAL_NON_JSON_RESPONSE',response.status);
    const contentLength=Number(response.headers.get('content-length')??0);
    if(contentLength>2_000_000)throw new JudicialUpstreamError('JUDICIAL_PAYLOAD_TOO_LARGE');
    // Leitura limitada mesmo quando o upstream omite Content-Length.
    if(!response.body)throw new JudicialUpstreamError('JUDICIAL_EMPTY_BODY');
    const reader=response.body.getReader();const chunks:Uint8Array[]=[];let length=0;
    while(true){const {done,value}=await reader.read();if(done)break;if(value){length+=value.byteLength;if(length>2_000_000){await reader.cancel();throw new JudicialUpstreamError('JUDICIAL_PAYLOAD_TOO_LARGE');}chunks.push(value);}}
    const raw=Buffer.concat(chunks.map(chunk=>Buffer.from(chunk))).toString('utf8');
    try{return JSON.parse(raw);}catch{throw new JudicialUpstreamError('JUDICIAL_INVALID_JSON',response.status);}
  }catch(error){if(error instanceof JudicialUpstreamError)throw error;if((error as Error)?.name==='AbortError')throw new JudicialUpstreamError('JUDICIAL_TIMEOUT');throw new JudicialUpstreamError('JUDICIAL_NETWORK_FAILURE');}
  finally{clearTimeout(timeout);}
}
