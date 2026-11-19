import {useEffect,useState} from 'react';
import {officeRequest,readableError} from '../office/OfficeShared';
import {Link} from 'react-router-dom';
import {useAuth} from '../auth/AuthProvider';
const steps=[
 {key:'profile',title:'Configure seu escritorio',description:'Revise identificacao, horarios e parametros basicos.',href:'/settings'},
 {key:'client',title:'Cadastre o primeiro cliente',description:'Crie a ficha de pessoa ou empresa, sem duplicar o contato.',href:'/people'},
 {key:'intake',title:'Registre um atendimento',description:'Anote a demanda, o proximo contato e quem acompanha.',href:'/intakes'},
 {key:'process',title:'Vincule um processo',description:'Registre o processo, documentos e movimentacoes relevantes.',href:'/processes'},
 {key:'deadline',title:'Configure seus prazos',description:'Revise tribunais, calendarios e a contagem antes de confirmar.',href:'/deadlines'},
 {key:'finance',title:'Conheca a gestao financeira',description:'Cadastre contratos e lancamentos financeiros.',href:'/finance'},
];
export function OnboardingPage(){
 const {user}=useAuth();
 const key='sysadv.onboarding.'+(user?.id??'local');
 const [error,setError]=useState('');
 const [completed,setCompleted]=useState<string[]>(()=>{
   try{const saved=JSON.parse(window.localStorage.getItem(key)??'[]');return Array.isArray(saved)?saved.filter((x):x is string=>typeof x==='string'):[];}catch{return [];}
 });
 useEffect(()=>{
  let alive=true;
  void officeRequest<{completedSteps:string[]}>('/onboarding/progress').then(data=>{
    if(!alive)return;
    setCompleted(data.completedSteps);
    try{window.localStorage.setItem(key,JSON.stringify(data.completedSteps));}catch{}
  }).catch(()=>{});
  return()=>{alive=false;};
 },[key]);
 async function toggle(value:string){
  const next=completed.includes(value)?completed.filter(x=>x!==value):[...completed,value];
  setCompleted(next);setError('');
  try{
    const saved=await officeRequest<{completedSteps:string[]}>('/onboarding/progress',{
      method:'PATCH',body:JSON.stringify({completedSteps:next}),
    });
    setCompleted(saved.completedSteps);
    try{window.localStorage.setItem(key,JSON.stringify(saved.completedSteps));}catch{}
  }catch(e){setCompleted(completed);setError(readableError(e));}
 }
 return <main className="panel" style={{maxWidth:920,margin:'0 auto'}}>
  <h1>Primeiros passos no SysADV</h1>
  {error&&<p role="alert">{error}</p>}
  <p className="muted">Roteiro de aprendizagem. Marcar uma atividade nao executa uma operacao nem confirma homologacao.</p>
  <p><strong>{completed.length} de {steps.length}</strong> atividades marcadas neste navegador.</p>
  <div style={{display:'grid',gap:16}}>
  {steps.map(step=><section key={step.key} className="panel">
   <label style={{display:'flex',alignItems:'center',gap:12}}>
    <input type="checkbox" checked={completed.includes(step.key)} onChange={()=>toggle(step.key)}/>
    <strong>{step.title}</strong>
   </label>
   <p className="muted">{step.description}</p>
   <Link to={step.href}>Abrir módulo</Link>
  </section>)}
  </div>
 </main>;
}
