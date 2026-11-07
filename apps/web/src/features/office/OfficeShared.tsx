import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiJson } from '../auth/api';
import { useDebouncedValue, usePeopleOptions, useProcessOptions } from '../../app/hooks';

export type OfficeList<T>={items:T[];total:number;page:number;pageSize:number;totalMinutes?:number};
export function officeRequest<T=unknown>(path:string,options:RequestInit={}):Promise<T>{
  return apiJson<T>(path,options);
}
const messages:Record<string,string>={VALIDATION_ERROR:'Revise os campos obrigatórios e formatos.',INVALID_REFERENCE:'Selecione um registro válido deste escritório.',INVALID_STATE:'Esta operação não é permitida na situação atual.',NOT_FOUND:'Registro não encontrado ou sem acesso.',FORBIDDEN:'Seu perfil não tem permissão para executar esta ação.',INVALID_AMOUNT:'Valor inválido.',PAYMENT_EXCEEDS_BALANCE:'O pagamento excede o saldo ou o lançamento foi cancelado.',IDEMPOTENCY_CONFLICT:'Já existe uma operação diferente com essa referência.',ALREADY_EXISTS:'Já existe um registro com este código.',CONCURRENT_UPDATE_RETRY:'Outro usuário atualizou o saldo; confira e tente novamente.',IDEMPOTENCY_KEY_REQUIRED:'Identificador da operação obrigatório.'};
export function readableError(e:unknown){if(typeof e==='string')return messages[e]??e;const msg=e instanceof Error?e.message:'UNKNOWN';return messages[msg]??('Não foi possível concluir a operação ('+msg+').');}
const EMPTY_LIST={items:[],total:0,page:1,pageSize:50};
/**
 * Listagens das telas de gestão via React Query: cache por chave (rota + filtros),
 * sem piscar a tabela ao trocar de página (mantém os dados anteriores) e
 * sem refazer a consulta ao voltar para a tela dentro de 30 s.
 */
export function useOfficeList<T>(path:string){
  const client=useQueryClient();
  const key=useDebouncedValue(path,250); // busca digitada: 1 requisição após a pausa, não 1 por tecla
  const query=useQuery({queryKey:['office',key],queryFn:()=>officeRequest<OfficeList<T>>(key),placeholderData:previous=>previous});
  const refresh=async()=>{await client.invalidateQueries({queryKey:['office']});};
  return {data:(query.data??EMPTY_LIST) as OfficeList<T>,loading:query.isPending||query.isFetching,error:query.error?readableError(query.error):'',refresh};
}
export function OfficeHeading({eyebrow,title,description,action}:{eyebrow?:string;title:string;description:string;action?:ReactNode}){
  return <div className="page-heading office-heading"><div>{eyebrow&&<span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1><p>{description}</p></div><div className="office-heading-actions">{action}</div></div>;
}
export function OfficeNotice({error,success}:{error?:string;success?:string}){return <>{error&&<div className="alert" role="alert">{error}</div>}{success&&<div className="notice-success" role="status">{success}</div>}</>;}
export function OfficeBlank({children}:{children:ReactNode}){return <div className="office-empty" role="status"><span aria-hidden="true">⌁</span><p>{children}</p></div>;}
export function OfficeStatus({value}:{value:string}){
 const titles:Record<string,string>={NEW:'Novo',IN_PROGRESS:'Em andamento',WAITING_CLIENT:'Aguardando cliente',CONVERTED:'Convertido',CLOSED:'Encerrado',DRAFT:'Rascunho',ACTIVE:'Vigente',COMPLETED:'Concluído',CANCELLED:'Cancelado',RECEIVABLE:'Receita',PAYABLE:'Despesa',OPEN:'Em aberto',PARTIAL:'Baixa parcial',PAID:'Liquidado',SUBMITTED:'Aguardando aprovação',APPROVED:'Aprovado',REJECTED:'Devolvido'};
 return <span className={'office-status office-status-'+value.toLowerCase()}>{titles[value]??value}</span>;
}
export function money(cents:number|null|undefined){return ((cents??0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
export function moneyInput(cents:number|null|undefined){return ((cents??0)/100).toFixed(2).replace('.',',');}
export function centsFromInput(value:string){const cleaned=value.replace(/\s|R\$/g,'').trim();
 if(!/^(?:\d{1,3}(?:\.\d{3})*|\d+)(?:,\d{1,2})?$/.test(cleaned))throw new Error('INVALID_AMOUNT');
 const parsed=cleaned.replace(/\./g,'').split(',');const cents=Number(parsed[0])*100+Number((parsed[1]??'').padEnd(2,'0'));
 if(!Number.isSafeInteger(cents)||cents<0||cents>1_000_000_000)throw new Error('INVALID_AMOUNT');return cents;
}
export function day(value:string|null|undefined){if(!value)return '—';const d=value.slice(0,10).split('-');return d.length===3?`${d[2]}/${d[1]}/${d[0]}`:'—';}
export function hourLabel(minutes:number){return `${Math.floor(minutes/60)}h${String(minutes%60).padStart(2,'0')}`;}
export function today(){const date=new Date();return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,10);}
export function localDateTime(iso:string|null|undefined){if(!iso)return '';const dt=new Date(iso);return new Date(dt.getTime()-dt.getTimezoneOffset()*60000).toISOString().slice(0,16);}
export type Person={id:string;name:string};export type Process={id:string;npu:string};
export function useOfficeReferences(){
 // Processos e pessoas vêm do cache compartilhado (app/hooks); atendimentos e contratos com cache de 2 min.
 const people=usePeopleOptions().data??[];
 const processes=useProcessOptions().data??[];
 const intakes=useQuery({queryKey:['ref','intakes'],queryFn:()=>officeRequest<{items:{id:string;subject:string}[]}>('/intakes?page=1').then(r=>r.items),staleTime:120_000}).data??[];
 const agreements=useQuery({queryKey:['ref','agreements'],queryFn:()=>officeRequest<{items:{id:string;code:string;title:string;clientId:string}[]}>('/agreements?page=1').then(r=>r.items),staleTime:120_000}).data??[];
 return {people,processes,intakes,agreements};
}
export function Selection({label,value,onChange,options,optional=true,required=false}:{label:string;value:string;onChange:(value:string)=>void;options:{id:string;name:string}[];optional?:boolean;required?:boolean}){
 return <label>{label}<select required={required} value={value} onChange={e=>onChange(e.target.value)}>{optional&&<option value="">Não vinculado</option>}{!optional&&<option value="">Selecione</option>}{options.map(x=><option value={x.id} key={x.id}>{x.name}</option>)}</select></label>;
}
export function SearchFilter({value,onChange,placeholder='Buscar'}:{value:string;onChange:(value:string)=>void;placeholder?:string}){return <label className="office-search"><span className="sr-only">Pesquisar</span><input aria-label="Pesquisar registros" type="search" placeholder={placeholder} value={value} onChange={e=>onChange(e.target.value)}/></label>}
export type OfficeFormEvent=FormEvent<HTMLFormElement>;

/** Busca paginada evita limitar o vinculo aos primeiros 50 clientes. */
export function PersonLookup({label,value,onChange,required=false}:{label:string;value:string;onChange:(v:string)=>void;required?:boolean}){
 const [search,setSearch]=useState('');const term=useDebouncedValue(search,250);
 const items=usePeopleOptions(term).data??[];
 const [selected,setSelected]=useState<Person|null>(null);
 useEffect(()=>{if(!value){setSelected(null);return;}const known=items.find(p=>p.id===value);if(known){setSelected(known);return;}let live=true;void officeRequest<Person>(`/people/${value}`).then(p=>{if(live)setSelected({id:p.id,name:p.name})}).catch(()=>{});return()=>{live=false;};},[value]); // eslint-disable-line react-hooks/exhaustive-deps
 const options=selected&&!items.some(p=>p.id===selected.id)?[selected,...items]:items;
 const id=`person-${label.replace(/\W/g,'-')}`;
 return <div className="office-person-lookup"><label>{label} — pesquisar<input type="search" value={search} placeholder="Nome ou documento" onChange={e=>setSearch(e.target.value)} aria-label={`Pesquisar ${label.toLowerCase()}`}/></label><label className="sr-only" htmlFor={id}>{label}</label><select id={id} required={required} aria-label={label} value={value} onChange={e=>onChange(e.target.value)}><option value="">{required?'Selecione um cliente':'Não vinculado'}</option>{options.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></div>;
}
