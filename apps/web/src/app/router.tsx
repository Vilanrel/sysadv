import { lazy, type ComponentType } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { LoginPage } from '../features/auth/LoginPage';
import { ProtectedRoute } from '../layout/ProtectedRoute';
import { AppShell } from '../layout/AppShell';

/**
 * Cada tela vira um arquivo JS separado, baixado só quando o usuário a abre.
 * O pacote inicial passa a conter apenas login, menu e a infraestrutura,
 * em vez das 26 telas de uma vez. O <Suspense> fica no AppShell.
 */
function page<M, K extends keyof M>(loader: () => Promise<M>, name: K) {
  return lazy(() => loader().then(module => ({ default: module[name] as ComponentType })));
}

const DashboardPage = page(() => import('../features/dashboard/DashboardPage'), 'DashboardPage');
const ProcessesPage = page(() => import('../features/processes/ProcessesPage'), 'ProcessesPage');
const NewProcessPage = page(() => import('../features/processes/NewProcessPage'), 'NewProcessPage');
const ProcessDetailsPage = page(() => import('../features/processes/ProcessDetailsPage'), 'ProcessDetailsPage');
const EditProcessPage = page(() => import('../features/processes/EditProcessPage'), 'EditProcessPage');
const PublicationsPage = page(() => import('../features/publications/PublicationsPage'), 'PublicationsPage');
const PeoplePage = page(() => import('../features/people/PeoplePage'), 'PeoplePage');
const IntakesPage = page(() => import('../features/office/IntakesPage'), 'IntakesPage');
const TasksPage = page(() => import('../features/tasks/TasksPage'), 'TasksPage');
const KanbanPage = page(() => import('../features/tasks/KanbanPage'), 'KanbanPage');
const AgendaPage = page(() => import('../features/agenda/AgendaPage'), 'AgendaPage');
const DeadlinesPage = page(() => import('../features/deadlines/DeadlinesPage'), 'DeadlinesPage');
const FinancePage = page(() => import('../features/office/FinancePage'), 'FinancePage');
const AgreementsPage = page(() => import('../features/office/AgreementsPage'), 'AgreementsPage');
const TimesheetsPage = page(() => import('../features/office/TimesheetsPage'), 'TimesheetsPage');
const ReportsPage = page(() => import('../features/office/ReportsPage'), 'ReportsPage');
const SettingsPage = page(() => import('../features/office/SettingsPage'), 'SettingsPage');
const DocumentsPage = page(() => import('../features/documents/DocumentsPage'), 'DocumentsPage');
const DocumentTemplatesPage = page(() => import('../features/templates/DocumentTemplatesPage'), 'DocumentTemplatesPage');
const CalculationsPage = page(() => import('../features/calculations/CalculationsPage'), 'CalculationsPage');
const CalculationWorkspace = page(() => import('../features/calculations/CalculationWorkspace'), 'CalculationWorkspace');
const DataSourcesPage = page(() => import('../features/integrations/DataSourcesPage'), 'DataSourcesPage');
const JudicialIntegrationsPage = page(() => import('../features/integrations/JudicialIntegrationsPage'), 'JudicialIntegrationsPage');
const AuditPage = page(() => import('../features/audit/AuditPage'), 'AuditPage');
const UsersPage = page(() => import('../features/admin/UsersPage'), 'UsersPage');
const AdministrationPage = page(() => import('../features/office/AdministrationPage'), 'AdministrationPage');

export const router = createBrowserRouter([
  { path:'/login', element:<LoginPage/> },
  { element:<ProtectedRoute/>, children:[{ element:<AppShell/>, children:[
    {index:true,element:<DashboardPage/>},
    {path:'processes',element:<ProcessesPage/>},
    {path:'processes/new',element:<NewProcessPage/>},
    {path:'processes/:id',element:<ProcessDetailsPage/>},
    {path:'processes/:id/edit',element:<EditProcessPage/>},
    {path:'publications',element:<PublicationsPage/>},
    {path:'people',element:<PeoplePage/>},
    {path:'intakes',element:<IntakesPage/>},
    {path:'tasks',element:<TasksPage/>},
    {path:'kanban',element:<KanbanPage/>},
    {path:'agenda',element:<AgendaPage/>},
    {path:'deadlines',element:<DeadlinesPage/>},
    {path:'finance',element:<FinancePage/>},
    {path:'agreements',element:<AgreementsPage/>},
    {path:'timesheets',element:<TimesheetsPage/>},
    {path:'reports',element:<ReportsPage/>},
    {path:'settings',element:<SettingsPage/>},
    {path:'documents',element:<DocumentsPage/>},
    {path:'templates',element:<DocumentTemplatesPage/>},
    {path:'calculations',element:<CalculationsPage/>},
    {path:'calculations/:id',element:<CalculationWorkspace/>},
    {path:'sources',element:<DataSourcesPage/>},
    {path:'integrations',element:<JudicialIntegrationsPage/>},
    {path:'audit',element:<AuditPage/>},
    {path:'users',element:<UsersPage/>},
    {path:'admin',element:<AdministrationPage/>},
  ] }] },
]);
