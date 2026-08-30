import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Task, TaskStatus } from '../types';
import { useProjects } from '../context/ProjectsContext';
import { KanbanColumn } from '../components/board/KanbanColumn';
import { TaskModal } from '../components/board/TaskModal';
import { NewTaskModal } from '../components/board/NewTaskModal';

const COLUMNS: TaskStatus[] = ['todo', 'in_progress', 'done'];

export function BoardPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const navigate = useNavigate();
  const { projects, deleteProject } = useProjects();
  const project = projects.find((p) => p.id === projectId);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [newTaskStatus, setNewTaskStatus] = useState<TaskStatus | null>(null);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

  const loadTasks = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const data = await api.listTasks(projectId, {
        search: search || undefined,
        priority: priorityFilter || undefined,
      });
      setTasks(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [projectId, search, priorityFilter]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = { todo: [], in_progress: [], done: [] };
    for (const task of tasks) {
      grouped[task.status].push(task);
    }
    return grouped;
  }, [tasks]);

  async function handleDrop(status: TaskStatus) {
    if (!draggedTask || draggedTask.status === status) {
      setDraggedTask(null);
      return;
    }
    const updated = await api.updateTask(draggedTask.id, { status });
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setDraggedTask(null);
  }

  async function handleDeleteProject() {
    if (!project) return;
    if (!window.confirm(`Delete "${project.name}" and all its tasks? This can't be undone.`)) return;
    await deleteProject(project.id);
    navigate('/dashboard');
  }

  if (!project) {
    return (
      <div className="canvas">
        <p className="canvas-subtitle">Loading project…</p>
      </div>
    );
  }

  return (
    <div className="canvas">
      <div className="canvas-header">
        <div>
          <h1 className="canvas-title">{project.name}</h1>
          {project.description && <p className="canvas-subtitle">{project.description}</p>}
        </div>
        <button className="btn btn-ghost" onClick={handleDeleteProject}>
          Delete project
        </button>
      </div>

      <div className="board-filters">
        <input
          className="board-search"
          placeholder="Search tasks…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
          <option value="">All priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>

      {error && (
        <p className="error-banner" role="alert" style={{ marginBottom: 16 }}>
          {error}
        </p>
      )}

      {loading ? (
        <div className="empty-state">
          <div className="spinner" />
          <p>Loading board…</p>
        </div>
      ) : (
        <div className="kanban-board">
          {COLUMNS.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={tasksByStatus[status]}
              projectName={project.name}
              onOpen={setActiveTask}
              onDragStart={setDraggedTask}
              onDrop={handleDrop}
              onQuickAdd={setNewTaskStatus}
            />
          ))}
        </div>
      )}

      {activeTask && (
        <TaskModal
          task={activeTask}
          projectName={project.name}
          onClose={() => setActiveTask(null)}
          onUpdated={(updated) => setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))}
          onDeleted={(taskId) => setTasks((prev) => prev.filter((t) => t.id !== taskId))}
        />
      )}

      {newTaskStatus && (
        <NewTaskModal
          projectId={projectId}
          initialStatus={newTaskStatus}
          onClose={() => setNewTaskStatus(null)}
          onCreated={(task) => setTasks((prev) => [...prev, task])}
        />
      )}
    </div>
  );
}
