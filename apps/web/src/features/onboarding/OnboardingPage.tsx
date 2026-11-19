import {useState} from 'react';
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
 const [completed,setCompleted]=useState<string[]>(()=>{
   try{const saved=JSON.parse(window.localStorage.getItem(key)??'[]');return Array.isArray(saved)?saved.filter((x):x is string=>typeof x==='string'):[];}catch{return [];}
 });
 function toggle(value:string){setCompleted(prev=>{const next=prev.includes(value)?prev.filter(x=>x!==value):[...prev,value];try{window.localStorage.setItem(key,JSON.stringify(next));}catch{}return next;});}
 return <main className="panel" style={{maxWidth:920,margin:'0 auto'}}>
  <h1>Primeiros passos no SysADV</h1>
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
