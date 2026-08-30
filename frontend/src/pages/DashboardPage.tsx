import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { DashboardStats } from '../types';
import { StatCard } from '../components/dashboard/StatCard';
import { PriorityChart } from '../components/dashboard/PriorityChart';
import { useAuth } from '../context/AuthContext';
import { useProjects } from '../context/ProjectsContext';
import { formatDueDate, ticketPrefix } from '../utils';

export function DashboardPage() {
  const { user } = useAuth();
  const { projects } = useProjects();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getStats()
      .then(setStats)
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const doneCount = stats?.byStatus.done ?? 0;
  const inProgressCount = stats?.byStatus.in_progress ?? 0;
  const todoCount = stats?.byStatus.todo ?? 0;

  return (
    <div className="canvas">
      <div className="canvas-header">
        <div>
          <h1 className="canvas-title">Welcome back, {user?.name?.split(' ')[0]}</h1>
          <p className="canvas-subtitle">Here's what's happening across your projects.</p>
        </div>
      </div>

      {error && <p className="error-banner">{error}</p>}

      {loading ? (
        <div className="empty-state">
          <div className="spinner" />
          <p>Loading dashboard…</p>
        </div>
      ) : stats && stats.totalTasks === 0 ? (
        <div className="empty-state">
          <p style={{ fontSize: 15, color: 'var(--color-text)' }}>No tasks yet</p>
          <p>Create a project from the sidebar, then add your first task.</p>
        </div>
      ) : (
        stats && (
          <>
            <div className="stat-grid">
              <StatCard label="Total tasks" value={stats.totalTasks} />
              <StatCard label="To do" value={todoCount} />
              <StatCard label="In progress" value={inProgressCount} />
              <StatCard label="Done" value={doneCount} />
              <StatCard label="Overdue" value={stats.overdueCount} tone={stats.overdueCount > 0 ? 'danger' : 'default'} />
            </div>

            <div className="dashboard-grid">
              <PriorityChart stats={stats} />

              <div className="card upcoming-card">
                <h4 className="chart-card-title">Upcoming deadlines</h4>
                {stats.upcoming.length === 0 ? (
                  <p className="canvas-subtitle" style={{ padding: '8px 0' }}>
                    Nothing due soon.
                  </p>
                ) : (
                  <ul className="upcoming-list">
                    {stats.upcoming.map((item) => (
                      <li key={item.id} className="upcoming-item">
                        <span className={`chip chip-priority-${item.priority}`}>{item.priority}</span>
                        <span className="upcoming-item-title">{item.title}</span>
                        <span className="upcoming-item-meta">
                          {item.project_name} · {formatDueDate(item.due_date)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )
      )}

      <h3 className="projects-heading">Your projects</h3>
      <div className="project-grid">
        {projects.map((project) => (
          <Link key={project.id} to={`/projects/${project.id}`} className="project-tile card">
            <span className="project-tile-dot" style={{ background: project.color }} />
            <div>
              <p className="project-tile-name">{project.name}</p>
              <p className="project-tile-meta">
                {ticketPrefix(project.name)} · {project.task_count ?? 0} tasks
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
