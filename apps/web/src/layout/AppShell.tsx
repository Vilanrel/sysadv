import { Suspense, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';
import { APP_VERSION } from '../app/version';
import { applyTheme, readTheme, type ThemeChoice } from '../app/theme';
import { PageSkeleton } from '../components/ui';

type IconName = 'sun' | 'moon' | 'overview' | 'processes' | 'people' | 'tasks' | 'kanban' | 'agenda' | 'deadlines' | 'publications' | 'documents' | 'templates' | 'calculations' | 'sources' | 'integrations' | 'audit' | 'users' | 'intakes' | 'finance' | 'agreements' | 'timesheets' | 'reports' | 'admin' | 'settings' | 'menu' | 'chevrons' | 'search' | 'logout' | 'close' | 'arrow';
type NavItem = { href: string; label: string; icon: IconName; allowed: boolean };
type NavGroup = { heading: string; items: NavItem[] };

function Glyph({ name, size = 19 }: { name: IconName; size?: number }) {
  const elements: Record<IconName, ReactNode> = {
    overview: <><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></>,
    processes: <><path d="M8 3h9l4 4v14H3V3h5Z"/><path d="M17 3v5h4M7 12h10M7 16h10"/></>,
    people: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 5"/></>,
    tasks: <><rect x="4" y="4" width="16" height="16" rx="2"/><path d="m8 12 3 3 5-6"/></>,
    kanban: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16M5 8h2M11 8h2M17 8h2"/></>,
    agenda: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 14h3M8 18h3"/></>,
    deadlines: <><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h5M8 17h8"/></>,
    publications: <><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5M3 6v12"/></>,
    documents: <><path d="M7 3h8l5 5v13H7zM15 3v5h5M10 13h7M10 17h7"/><path d="M4 7H3v14"/></>,
    templates: <><path d="M6 3h12a2 2 0 0 1 2 2v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a2 2 0 0 1 2-2Z"/><path d="M8 9h8M8 13h8M8 17h4"/></>,
    calculations: <><rect x="5" y="3" width="14" height="18" rx="2"/><rect x="8" y="6" width="8" height="4" rx="1"/><path d="M8 14h2M14 14h2M8 18h2M14 18h2"/></>,
    sources: <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7"/></>,
    integrations: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/><path d="M10 6h4a4 4 0 0 1 4 4v4M14 18h-4a4 4 0 0 1-4-4v-4"/></>,
    audit: <><path d="M12 3 4 7v6c0 5 3.4 7.6 8 9 4.6-1.4 8-4 8-9V7z"/><path d="m9 12 2 2 4-4"/></>,
    users: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M18 8v6M15 11h6"/></>,
    intakes: <><path d="M4 5h16M4 10h16M4 15h10M4 20h8"/><circle cx="18" cy="17" r="3"/></>,
    finance: <><circle cx="12" cy="12" r="9"/><path d="M15 9c-1-2-6-2-6 1 0 3 6 1 6 5 0 3-5 3-7 1M12 5v14"/></>,
    agreements: <><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
    timesheets: <><circle cx="12" cy="13" r="8"/><path d="M12 9v5l3 2M9 2h6"/></>,
    reports: <><path d="M5 20V10M10 20V5M15 20v-8M20 20V3"/></>,
    admin: <><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="16" cy="12" r="2"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3"/></>,
    menu: <path d="M4 6h16M4 12h16M4 18h16"/>,
    chevrons: <path d="m13 7-5 5 5 5m5-10-5 5 5 5"/>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></>,
    logout: <><path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5M14 8l4 4-4 4M18 12H9"/></>,
    close: <path d="M5 5l14 14M19 5 5 19"/>,
    arrow: <path d="m5 12 14 0m-6-6 6 6-6 6"/>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
    moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>,
  };
  return <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{elements[name]}</svg>;
}

/**
 * Adds visible field names to stacked tables (mobile). Rows already labelled with the
 * same header set are skipped, so a re-render of a 200-row table no longer rewrites
 * every cell; only new or changed rows are touched.
 */
function labelResponsiveTables(root: HTMLElement) {
  root.querySelectorAll<HTMLTableElement>('table').forEach(table => {
    if (!table.classList.contains('responsive-table')) table.classList.add('responsive-table');
    const headers = Array.from(table.querySelectorAll('thead tr:first-child th')).map(header => header.textContent?.trim() || 'Informação');
    const signature = headers.join('|');
    table.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach(row => {
      if (row.dataset.labelled === signature && row.cells.length === Number(row.dataset.cells)) return;
      let index = 0;
      Array.from(row.children).forEach(cell => {
        if (!(cell instanceof HTMLTableCellElement)) return;
        if (cell.colSpan > 1) { cell.classList.add('table-empty-cell'); index += cell.colSpan; return; }
        const label = headers[index] || 'Informação';
        if (cell.dataset.label !== label) cell.dataset.label = label;
        index += 1;
      });
      row.dataset.labelled = signature;
      row.dataset.cells = String(row.cells.length);
    });
  });
}

export function AppShell() {
  const { user, logout, has } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return window.localStorage.getItem('sysadv.ui.sidebarCollapsed') === 'true'; } catch { return false; }
  });
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuCloseRef = useRef<HTMLButtonElement>(null);
  const navigationRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');

  const [theme, setTheme] = useState<ThemeChoice>(readTheme);
  const groups = useMemo<NavGroup[]>(() => [
    { heading: 'Visão geral', items: [{ href: '/', label: 'Dashboard', icon: 'overview', allowed: true }] },
    { heading: 'Operação jurídica', items: [
      { href: '/intakes', label: 'Atendimentos', icon: 'intakes', allowed: has('intake.read') },
      { href: '/people', label: 'Clientes e pessoas', icon: 'people', allowed: has('person.read') },
      { href: '/processes', label: 'Processos', icon: 'processes', allowed: has('process.read') },
      { href: '/tasks', label: 'Tarefas', icon: 'tasks', allowed: has('task.read') },
      { href: '/kanban', label: 'Kanban', icon: 'kanban', allowed: has('task.read') },
      { href: '/agenda', label: 'Agenda', icon: 'agenda', allowed: has('calendar.read') },
      { href: '/deadlines', label: 'Gerenciador de prazos', icon: 'deadlines', allowed: has('calendar.read') },
      { href: '/publications', label: 'Publicações', icon: 'publications', allowed: has('publication.read') },
    ] },
    { heading: 'Gestão do escritório', items: [
      { href: '/finance', label: 'Financeiro', icon: 'finance', allowed: has('finance.read') },
      { href: '/agreements', label: 'Contratos de honorários', icon: 'agreements', allowed: has('contract.read') },
      { href: '/timesheets', label: 'Timesheet', icon: 'timesheets', allowed: has('timesheet.read') },
      { href: '/reports', label: 'Relatórios', icon: 'reports', allowed: has('report.read') },
    ] },
    { heading: 'Conteúdo e cálculos', items: [
      { href: '/documents', label: 'Documentos', icon: 'documents', allowed: true },
      { href: '/templates', label: 'Modelos jurídicos', icon: 'templates', allowed: has('document.template.read') },
      { href: '/calculations', label: 'Cálculos', icon: 'calculations', allowed: true },
    ] },
    { heading: 'Integrações e administração', items: [
      { href: '/sources', label: 'Fontes de dados', icon: 'sources', allowed: has('source.manage') },
      { href: '/integrations', label: 'Integrações judiciais', icon: 'integrations', allowed: has('publication.read') },
      { href: '/admin', label: 'Administração', icon: 'admin', allowed: has('user.manage') || has('settings.read') },
      { href: '/settings', label: 'Configurações', icon: 'settings', allowed: has('settings.read') },
      { href: '/audit', label: 'Auditoria', icon: 'audit', allowed: has('audit.read') },
      { href: '/users', label: 'Usuários', icon: 'users', allowed: has('user.manage') },
    ] },
  ], [has]);
  const visible = useMemo(() => groups.flatMap(group => group.items).filter(item => item.allowed), [groups]);
  const active = [...visible].reverse().find(item => item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)) || visible[0];
  const matches = useMemo(() => visible.filter(item => item.label.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR'))).slice(0, 6), [query, visible]);

  useEffect(() => { setMenuOpen(false); setQuery(''); }, [pathname]);
  useEffect(() => {
    try { window.localStorage.setItem('sysadv.ui.sidebarCollapsed', String(sidebarCollapsed)); } catch { /* Navegação continua funcional sem armazenamento local. */ }
  }, [sidebarCollapsed]);
  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      const target = event.target;
      if (event.key !== '/' || event.altKey || event.ctrlKey || event.metaKey ||
          (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)))) return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, []);
  useEffect(() => {
    if (!menuOpen || !window.matchMedia('(max-width: 980px)').matches) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    menuCloseRef.current?.focus();
    const onFocusLoop = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusable = [...(navigationRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ) ?? [])].filter(element => element.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onFocusLoop);
    return () => {
      document.removeEventListener('keydown', onFocusLoop);
      document.body.style.overflow = originalOverflow;
      menuButtonRef.current?.focus();
    };
  }, [menuOpen]);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [menuOpen]);
  useEffect(() => {
    const main = document.querySelector<HTMLElement>('.content');
    if (!main) return;
    const update = () => labelResponsiveTables(main);
    update();
    let frameId: number | null = null;
    const schedule = () => {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(() => { frameId = null; update(); });
    };
    const observer = new MutationObserver(schedule);
    observer.observe(main, { childList: true, subtree: true });
    return () => { observer.disconnect(); if (frameId !== null) window.cancelAnimationFrame(frameId); };
  }, [pathname]);

  const cycleTheme = () => {
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    const current = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;
    const next: ThemeChoice = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setTheme(next);
  };
  const isDark = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);

  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (matches[0]) navigate(matches[0].href);
  };
  const initials = user?.name?.trim().split(/\s+/).slice(0, 2).map(piece => piece[0]?.toUpperCase()).join('') || 'SA';

  return <div className={`app app-ds app-modern${sidebarCollapsed ? ' app-sidebar-collapsed' : ''}`}>
    <a className="skip-link" href="#main-content">Pular para o conteúdo principal</a>
    <button type="button" className="nav-overlay" aria-label="Fechar menu de navegação" onClick={() => setMenuOpen(false)} data-open={menuOpen} tabIndex={menuOpen ? 0 : -1}/>
    <aside id="sysadv-navigation" ref={navigationRef} role={menuOpen ? "dialog" : undefined} aria-modal={menuOpen ? true : undefined} className={`sidebar sidebar-ds ${menuOpen ? 'sidebar-open' : ''}`} aria-label="Menu principal">
      <div className="sidebar-brand sidebar-brand-ds">
        <img src="/brand/ds-logo.webp" alt="Logomarca DS Advocacia" width="40" height="40" decoding="async"/>
        <div className="sidebar-brand-copy"><strong>Sys<span>ADV</span></strong><small>Gestão jurídica inteligente</small></div>
        <button type="button" className="sidebar-mobile-close icon-button" ref={menuCloseRef} aria-label="Fechar menu" onClick={() => setMenuOpen(false)}><Glyph name="close"/></button>
      </div>
      <nav aria-label="Navegação principal">
        {groups.map(group => {
          const allowedItems = group.items.filter(item => item.allowed);
          if (!allowedItems.length) return null;
          return <div className="nav-group" key={group.heading}>
            <span className="nav-group-label">{group.heading}</span>
            {allowedItems.map(item => <NavLink to={item.href} end={item.href === '/'} key={item.href} title={sidebarCollapsed ? item.label : undefined} aria-label={item.label} onClick={() => setMenuOpen(false)} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <span className="nav-icon"><Glyph name={item.icon}/></span><span className="nav-text">{item.label}</span>
            </NavLink>)}
          </div>;
        })}
      </nav>
      <div className="sidebar-foot"><span>SysADV {APP_VERSION} · Gestão Jurídica</span><small>Ambiente seguro e rastreável</small></div>
    </aside>
    <div className="workspace workspace-ds">
      <header className="topbar" aria-label="Barra superior">
        <div className="topbar-leading">
          <button type="button" className="icon-button mobile-menu" ref={menuButtonRef} aria-label="Abrir menu" aria-controls="sysadv-navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)}><Glyph name="menu" size={21}/></button>
          <button type="button" className="icon-button sidebar-toggle" aria-label={sidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'} aria-expanded={!sidebarCollapsed} onClick={() => setSidebarCollapsed(value => !value)}><Glyph name="chevrons"/></button>
          <div className="topbar-location"><span className="topbar-kicker">Área de trabalho <span className="topbar-divider">/</span></span><strong>{active?.label || 'SysADV'}</strong></div>
        </div>
        <form className="topbar-search" role="search" onSubmit={search}>
          <Glyph name="search" size={17}/><label className="sr-only" htmlFor="sysadv-navigation-search">Buscar tela ou funcionalidade</label>
          <input id="sysadv-navigation-search" ref={searchRef} type="search" autoComplete="off" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Escape") setQuery(''); }} aria-controls="sysadv-search-results" aria-expanded={Boolean(query.trim())} placeholder="Buscar tela ou funcionalidade…"/>
          {query.trim() && <div id="sysadv-search-results" className="search-results" role="region" aria-label="Telas encontradas">{matches.length ? matches.map(item => <button type="button" key={item.href} onClick={() => navigate(item.href)}><Glyph name={item.icon} size={17}/><span>{item.label}</span><Glyph name="arrow" size={15}/></button>) : <p>Nenhuma tela encontrada.</p>}</div>}
        </form>
        <div className="user-box">
          <div className="user-ident"><strong>{user?.name}</strong><span>{user?.organization.name}</span></div>
          <button type="button" className="icon-button theme-toggle" onClick={cycleTheme} title={isDark ? 'Usar tema claro' : 'Usar tema escuro'} aria-label={isDark ? 'Usar tema claro' : 'Usar tema escuro'}><Glyph name={isDark ? 'sun' : 'moon'}/></button>
          <span className="user-avatar" aria-hidden="true">{initials}</span>
          <button type="button" className="icon-button logout-button" onClick={logout} title="Sair da conta" aria-label="Sair da conta"><Glyph name="logout"/></button>
        </div>
      </header>
      <main className="content" id="main-content" tabIndex={-1}><Suspense fallback={<PageSkeleton/>}><Outlet /></Suspense></main>
    </div>
  </div>;
}
