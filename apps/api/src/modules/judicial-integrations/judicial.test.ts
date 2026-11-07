import { describe, expect, it, afterEach } from 'vitest';
import { STATE_COURTS } from './tribunals.js';
import { JUDICIAL_SOURCES } from './catalog.js';
import { assertDataJudLegalGate, canActivateJudicialSource, requireReadyConnection } from './policy.js';
import { djenFilterSchema, parseDjenPage, normalizeDjenItem, fetchDjenPage, searchTjdft, searchStjCatalog, searchAuthorizedDataJud, validCnjNumber } from './adapters.js';
import { requestJudicialJson } from './http.js';

const json = (body:unknown, status=200, extra:Record<string,string>={}) => new Response(JSON.stringify(body), {status,headers:{'content-type':'application/json',...extra}});
afterEach(()=>{delete process.env.JUDICIAL_DATAJUD_NONCOMMERCIAL_ENABLED;delete process.env.JUDICIAL_DJEN_CONTRACT_VALIDATED;});
describe('INT JUD: catalogo e politica',()=>{
  it('inclui os 26 TJs estaduais e o TJDFT sem criar alias STF',()=>{
    expect(STATE_COURTS).toHaveLength(27);
    expect(new Set(STATE_COURTS.map(c=>c.uf)).size).toBe(27);
    expect(STATE_COURTS.find(c=>c.uf==='DF')?.alias).toBe('api_publica_tjdft');
    expect(JUDICIAL_SOURCES.some(x=>x.code==='DATAJUD')).toBe(true);
  });
  it('bloqueia o DataJud por padrao e qualquer finalidade comercial',()=>{
    expect(()=>assertDataJudLegalGate()).toThrow('DATAJUD_POLICY_BLOCKED');
    process.env.JUDICIAL_DATAJUD_NONCOMMERCIAL_ENABLED='true';
    expect(()=>canActivateJudicialSource('DATAJUD','COMMERCIAL','ref-ok-legal','base-legal-suficiente',{})).toThrow('DATAJUD_PURPOSE_NOT_AUTHORIZED');
  });
  it('nao faz ciencia ou peticao a partir de integracoes de leitura',()=>{
    const c={sourceCode:'DJEN',status:'READY',termsAccepted:true,contractHash:'x',contractVerifiedAt:new Date(),purpose:'monitoring',config:{itemsPath:'items',totalPath:'totalPages'}};
    process.env.JUDICIAL_DJEN_CONTRACT_VALIDATED='true';
    expect(()=>requireReadyConnection(c,'acknowledge')).toThrow('JUDICIAL_ACT_NOT_IMPLEMENTED');
    expect(()=>requireReadyConnection(c,'petition')).toThrow('JUDICIAL_ACT_NOT_IMPLEMENTED');
  });
  it('nao habilita Domicilio/MNI somente por existir contrato documental',()=>expect(()=>canActivateJudicialSource('MNI','consulta','ref-123456','base-legal-suficiente',{})).toThrow('CONNECTOR_NOT_IMPLEMENTED'));
});
describe('INT JUD: DJEN',()=>{
  const mapping={itemsPath:'items' as const,totalPath:'totalPages' as const};
  const item={hash:'hash-0001',numeroProcesso:'1051528-57.2024.8.26.0053',texto:'Publicação para teste',siglaTribunal:'TJSP',dataDisponibilizacao:'2026-11-06'};
  it('valida digito verificador CNJ sem coagir o identificador numerico',()=>{expect(validCnjNumber('10515285720248260053')).toBe(true);expect(validCnjNumber('10515285620248260053')).toBe(false);});
  it('preserva OAB alfanumerica e UF para evitar colisao',()=>{const parsed=djenFilterSchema.parse({from:'2026-11-05',to:'2026-11-06',oabNumber:'12345-A',oabState:'SP'});expect(parsed.oabNumber).toBe('12345-A');expect(()=>djenFilterSchema.parse({from:'2026-11-05',to:'2026-11-06',oabNumber:'12345-A'})).toThrow();});
  it('nao aceita uma data civil inexistente',()=>expect(()=>djenFilterSchema.parse({from:'2026-02-30',to:'2026-03-01'})).toThrow());
  it('normaliza uma publicacao com NPU e preserva data civil literal',()=>{const out=normalizeDjenItem(item);expect(out.processNumber).toBe('10515285720248260053');expect(out.availableOn).toBe('2026-11-06');expect(out.externalId).toBe('hash-0001');});
  it('completa uma unica pagina somente com total conhecido',()=>{const page=parseDjenPage({items:[item],totalPages:1},1,20,mapping);expect(page.totalPages).toBe(1);expect(page.items).toHaveLength(1);});
  it('identifica pagina vazia prematura como incompleta',()=>expect(()=>parseDjenPage({items:[],totalPages:4},2,20,mapping)).toThrow('DJEN_PREMATURE_EMPTY_PAGE'));
  it('rejeita HTML 200 e schema incerto',async()=>{await expect(requestJudicialJson('DJEN','/api/v1/comunicacao',{},async()=>new Response('<html>Login</html>',{headers:{'content-type':'text/html'}}))).rejects.toThrow('JUDICIAL_NON_JSON_RESPONSE');expect(()=>parseDjenPage({total:2,conteudo:[item]},1,20,mapping)).toThrow('DJEN_SCHEMA_UNVERIFIED');});
  it('paginacao transmite filtros no querystring mas nao gera ciencia',async()=>{let captured='';const page=await fetchDjenPage({from:'2026-11-05',to:'2026-11-06',oabNumber:'123A',oabState:'SP',pageSize:20},1,mapping,async(url,options)=>{captured=String(url);expect(options?.method).toBeUndefined();return json({items:[item],totalPages:1});});expect(captured).toContain('numeroOab=123A');expect(captured).toContain('ufOab=SP');expect(page.items).toHaveLength(1);});
  it('respeita Retry-After apos 429',async()=>await expect(requestJudicialJson('DJEN','/api/v1/comunicacao',{},async()=>json({erro:1},429,{'retry-after':'5'}))).rejects.toMatchObject({code:'JUDICIAL_HTTP_429',retryAfterSeconds:5}));
});
describe('INT JUD: jurisprudencia e DataJud',()=>{
  it('TJDFT faz POST documentado e valida envelope',async()=>{let body:any;const r=await searchTjdft({query:'dano moral',pagina:0,tamanho:10},async(url,init)=>{expect(String(url)).toBe('https://jurisdf.tjdft.jus.br/api/v1/pesquisa');body=JSON.parse(String(init?.body));return json({hits:1,registros:[{uuid:'u-1',processo:'0001',ementa:'Teste'}]});});expect(body).toEqual({query:'dano moral',pagina:0,tamanho:10});expect(r.registros).toHaveLength(1);});
  it('STJ rejeita CKAN success false mesmo quando HTTP 200',async()=>await expect(searchStjCatalog({q:'acordaos',rows:5},async()=>json({success:false,error:{}}))).rejects.toThrow('STJ_CKAN_UNSUCCESSFUL'));
  it('DataJud exige alias oficialmente documentado e confere NPU retornado',async()=>{const r=await searchAuthorizedDataJud('1051528-57.2024.8.26.0053','key-test',async(_u,init)=>{expect(new Headers(init?.headers).get('authorization')).toBe('APIKey key-test');return json({hits:{hits:[{_source:{numeroProcesso:'10515285720248260053'}},{_source:{numeroProcesso:'99999999999999999999'}}]}});});expect(r.records).toHaveLength(1);expect(r.alias).toBe('api_publica_tjsp');});
});
