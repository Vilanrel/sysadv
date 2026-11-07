import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { ProcessInput } from '@sysadv/contracts';
import { apiFetch } from '../auth/api';
import { ProcessForm } from './ProcessForm';
import { PageSkeleton } from '../../components/ui';
const d=(v?:string)=>v?String(v).slice(0,10):undefined;
export function EditProcessPage(){ const {id}=useParams(); const nav=useNavigate(); const [initial,setInitial]=useState<Partial<ProcessInput>>();
  useEffect(()=>{apiFetch(`/processes/${id}`).then(async r=>{if(r.ok){const p=await r.json(); setInitial({...p, filingDate:d(p.filingDate), admissionDate:d(p.admissionDate), terminationDate:d(p.terminationDate), referenceDate:d(p.referenceDate), calculationDueDate:d(p.calculationDueDate)});}})},[id]);
  if(!initial)return <PageSkeleton/>;
  return <><div className="page-heading"><div><span className="eyebrow">Manutenção</span><h1>Alterar processo</h1><p>Alterações manuais ficam registradas na trilha de auditoria.</p></div></div><ProcessForm initialValues={initial} enableNpuLookup={false} submitLabel="Salvar alterações" onSubmit={async data=>{const r=await apiFetch(`/processes/${id}`,{method:'PATCH',body:JSON.stringify(data)}); if(!r.ok)throw new Error('Falha ao alterar'); nav(`/processes/${id}`)}}/></>;
}
