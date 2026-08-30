import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useProjects } from '../../context/ProjectsContext';
import { initials } from '../../utils';
import { NewProjectModal } from '../projects/NewProjectModal';

export function Rail() {
  const { user, logout } = useAuth();
  const { projects, loading } = useProjects();
  const navigate = useNavigate();
  const [showNewProject, setShowNewProject] = useState(false);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <aside className="rail">
      <div className="rail-brand">
        <span className="rail-brand-mark">TF</span>
        <span className="rail-brand-name">TaskFlow</span>
      </div>

      <nav className="rail-section">
        <NavLink to="/dashboard" className={({ isActive }) => `rail-link ${isActive ? 'is-active' : ''}`}>
          Dashboard
        </NavLink>
        <NavLink to="/shared" className={({ isActive }) => `rail-link ${isActive ? 'is-active' : ''}`}>
          Shared with me
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => `rail-link ${isActive ? 'is-active' : ''}`}>
          Profile
        </NavLink>
      </nav>

      <div className="rail-section rail-projects">
        <div className="rail-section-header">
          <span>Projects</span>
          <button className="rail-add-btn" onClick={() => setShowNewProject(true)} aria-label="New project">
            +
          </button>
        </div>

        {loading && <p className="rail-empty">Loading...</p>}
        {!loading && projects.length === 0 && (
          <p className="rail-empty">No projects yet. Create one to get started.</p>
        )}

        <ul className="rail-project-list">
          {projects.map((project) => (
            <li key={project.id}>
              <NavLink
                to={`/projects/${project.id}`}
                className={({ isActive }) => `rail-link rail-project-link ${isActive ? 'is-active' : ''}`}
              >
                <span className="rail-project-dot" style={{ background: project.color }} />
                <span className="rail-project-name">{project.name}</span>
                {typeof project.task_count === 'number' && (
                  <span className="rail-project-count">{project.task_count}</span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>

      <div className="rail-user">
        <span className="avatar" style={{ background: '#2a2e37', color: '#e8e9ed' }}>
          {user ? initials(user.name) : ''}
        </span>
        <div className="rail-user-info">
          <span className="rail-user-name">{user?.name}</span>
          <span className="rail-user-email">{user?.email}</span>
        </div>
        <button className="rail-logout" onClick={handleLogout} aria-label="Log out">
          ⏻
        </button>
      </div>

      {showNewProject && <NewProjectModal onClose={() => setShowNewProject(false)} />}
    </aside>
  );
}
