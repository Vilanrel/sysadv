import type {FastifyInstance} from 'fastify';
import {authenticate} from '../../security/authenticate.js';
import {requirePermission} from '../../security/authorize.js';

// Catalogo de capacidades comerciais, sem tabela de assinatura e sem habilitacao de acesso.
// Planos sao rascunhos tecnicos, NAO ofertas precificadas nem contratos vigentes.
export const moduleCatalog=[
 {code:'CORE',label:'Gestao juridica',features:['clientes','processos','agenda','documentos','prazos']},
 {code:'CRM',label:'Relacionamento',features:['atendimentos','oportunidades','follow-up']},
 {code:'AUTOMATION',label:'Produtividade',features:['tarefas','workflows','avisos internos']},
 {code:'FINANCE',label:'Financeiro',features:['honorarios','parcelas','timesheet']},
 {code:'LEGAL_AI',label:'Inteligencia artificial',features:['rascunhos para revisao humana']},
 {code:'ADVANCED',label:'Servicos especializados',features:['diligencias','pesquisa patrimonial autorizada']},
] as const;
export const planCatalog=[
 {code:'ESSENTIAL',label:'Essencial',modules:['CORE','CRM']},
 {code:'PROFESSIONAL',label:'Profissional',modules:['CORE','CRM','AUTOMATION','FINANCE']},
 {code:'ADVANCED',label:'Avancado',modules:['CORE','CRM','AUTOMATION','FINANCE','LEGAL_AI','ADVANCED']},
] as const;

export async function commercialRoutes(app:FastifyInstance){
 app.get('/commercial/catalog',{preHandler:[authenticate,requirePermission('settings.read')]},async()=>({
  modules:moduleCatalog,plans:planCatalog,pricingConfigured:false,
  subscriptionsEnabled:false,accessControlEnforced:false,
  notice:'Catalogo preliminar para definicao de planos. Nao representa assinatura ativa.',
 }));
}
