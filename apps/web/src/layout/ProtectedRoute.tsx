import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="app-splash center" role="status"><img src="/brand/ds-logo.webp" alt="" width="56" height="56"/><span className="app-splash-bar" aria-hidden="true"/><span className="sr-only">Carregando...</span></div>;
  return user ? <Outlet/> : <Navigate to="/login" replace/>;
}
