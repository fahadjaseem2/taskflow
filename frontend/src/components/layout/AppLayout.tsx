import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ProjectsProvider } from '../../context/ProjectsContext';
import { Rail } from './Rail';

export function AppLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="empty-state" style={{ height: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <ProjectsProvider>
      <div className="app-shell">
        <Rail />
        <Outlet />
      </div>
    </ProjectsProvider>
  );
}
