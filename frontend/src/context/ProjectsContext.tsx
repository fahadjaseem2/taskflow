import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { api } from '../api';
import { Project } from '../types';
import { useAuth } from './AuthContext';

interface ProjectsContextValue {
  projects: Project[];
  loading: boolean;
  error: string | null;
  createProject: (data: { name: string; description?: string; color?: string }) => Promise<Project>;
  deleteProject: (id: number) => Promise<void>;
  refresh: () => Promise<void>;
}

const ProjectsContext = createContext<ProjectsContextValue | undefined>(undefined);

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.listProjects();
      setProjects(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      refresh();
    } else {
      setProjects([]);
      setLoading(false);
    }
  }, [user, refresh]);

  const createProject = useCallback(
    async (data: { name: string; description?: string; color?: string }) => {
      const project = await api.createProject(data);
      setProjects((prev) => [project, ...prev]);
      return project;
    },
    []
  );

  const deleteProject = useCallback(async (id: number) => {
    await api.deleteProject(id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return (
    <ProjectsContext.Provider value={{ projects, loading, error, createProject, deleteProject, refresh }}>
      {children}
    </ProjectsContext.Provider>
  );
}

export function useProjects(): ProjectsContextValue {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error('useProjects must be used within ProjectsProvider');
  return ctx;
}
