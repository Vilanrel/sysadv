export const CALCULATION_TABS=[
 {id:'summary',label:'Resumo'},{id:'contract',label:'Contrato'},{id:'salaryHistory',label:'Histórico Salarial'},{id:'earnings',label:'Verbas'},
 {id:'reflections',label:'Reflexos'},{id:'workSchedule',label:'Jornada'},{id:'absences',label:'Faltas'},{id:'vacations',label:'Férias'},
 {id:'fgts',label:'FGTS'},{id:'socialSecurity',label:'Previdência'},{id:'incomeTax',label:'IR'},{id:'fees',label:'Honorários'},
 {id:'costs',label:'Custas'},{id:'indices',label:'Índices / Correção'},{id:'result',label:'Resultado'},{id:'pjecalc',label:'PJe-Calc'}
] as const;
const labels:Record<string,string>={DRAFT:'Rascunho',DATA_PENDING:'Dados pendentes',READY_FOR_REVIEW:'Pronto para revisão',VALIDATED:'Validado',PJC_GENERATED:'Pacote preparado',QUEUED:'Na fila',PROCESSING:'Processando',COMPLETED:'Concluído',COMPLETED_WITH_WARNINGS:'Concluído com alertas',FAILED:'Falhou',CANCELLED:'Cancelado'};
export const statusLabel=(s:string)=>labels[s]??s;
