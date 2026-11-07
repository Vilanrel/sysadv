import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { OfficeHeading } from './OfficeShared';
export function AdministrationPage(){
 const {has}=useAuth();const links=[{path:'/users',label:'Usuários e perfis',hint:'Contas, permissões e situação do acesso',permission:'user.manage'},{path:'/settings',label:'Configurações',hint:'Dados do escritório e parâmetros',permission:'settings.read'},{path:'/integrations',label:'Integrações judiciais',hint:'Conectores, credenciamento e filas',permission:'publication.read'},{path:'/audit',label:'Auditoria',hint:'Trilha de alterações e histórico',permission:'audit.read'},{path:'/sources',label:'Fontes de dados',hint:'Provedores e disponibilidade',permission:'source.manage'}];
 return <><OfficeHeading eyebrow="Gestão e governança" title="Administração" description="Acessos rápidos às funções de configuração, segurança e operação do escritório."/><div className="office-admin-grid">{links.filter(item=>has(item.permission)).map(item=><Link to={item.path} key={item.path} className="office-admin-card"><span aria-hidden="true">◇</span><strong>{item.label}</strong><small>{item.hint}</small><span className="office-admin-arrow" aria-hidden="true">Abrir ›</span></Link>)}</div></>;
}
