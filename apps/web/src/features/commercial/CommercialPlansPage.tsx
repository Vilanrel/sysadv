import {useEffect,useState} from 'react';
import {OfficeHeading,OfficeNotice,officeRequest,readableError} from '../office/OfficeShared';
type Module={code:string;label:string;features:string[]};
type Plan={code:string;label:string;modules:string[]};
type Catalog={modules:Module[];plans:Plan[];pricingConfigured:boolean;subscriptionsEnabled:boolean;accessControlEnforced:boolean;notice:string};
export function CommercialPlansPage(){
 const [data,setData]=useState<Catalog|null>(null);const [error,setError]=useState('');
 useEffect(()=>{void officeRequest<Catalog>('/commercial/catalog').then(setData).catch(e=>setError(readableError(e)));},[]);
 return <><OfficeHeading eyebrow="Comercial · configuracao futura" title="Planos e módulos" description="Prévia técnica dos pacotes comerciais. Ainda não existe contratação, faturamento ou liberação por assinatura."/>
 <OfficeNotice error={error}/>
 {data&&<><p className="muted">{data.notice}</p><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:16}}>
 {data.plans.map(p=><section key={p.code} className="panel"><h2>{p.label}</h2><p>Disponibilidade de recursos proposta:</p><ul>{p.modules.map(code=><li key={code}>{data.modules.find(m=>m.code===code)?.label??code}</li>)}</ul><small>Preço e contratação: não configurados.</small></section>)}
 </div></>}
 </>;
}
