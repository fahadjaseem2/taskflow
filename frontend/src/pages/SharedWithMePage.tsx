import { useEffect, useState } from 'react';
import { api } from '../api';
import { SharedTask } from '../types';
import { formatDueDate, isOverdue, ticketPrefix } from '../utils';
import { TaskModal } from '../components/board/TaskModal';

export function SharedWithMePage() {
  const [tasks, setTasks] = useState<SharedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<SharedTask | null>(null);

  useEffect(() => {
    api
      .listSharedWithMe()
      .then(setTasks)
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="canvas">
      <div className="canvas-header">
        <div>
          <h1 className="canvas-title">Shared with me</h1>
          <p className="canvas-subtitle">Tasks other people have given you access to.</p>
        </div>
      </div>

      {error && <p className="error-banner">{error}</p>}

      {loading ? (
        <div className="empty-state">
          <div className="spinner" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="empty-state">
          <p style={{ fontSize: 15, color: 'var(--color-text)' }}>Nothing shared with you yet</p>
          <p>When someone shares a task with your account, it'll show up here.</p>
        </div>
      ) : (
        <ul className="shared-list">
          {tasks.map((task) => {
            const overdue = isOverdue(task.due_date, task.status);
            return (
              <li key={task.id} className="shared-item card" onClick={() => setActiveTask(task)}>
                <span className="rail-project-dot" style={{ background: task.project_color }} />
                <div className="shared-item-main">
                  <p className="shared-item-title">{task.title}</p>
                  <p className="shared-item-meta">
                    <span className="ticket-id">
                      {ticketPrefix(task.project_name)}-{task.ticket_number}
                    </span>{' '}
                    · {task.project_name} · shared by {task.owner_name}
                  </p>
                </div>
                <span className={`chip chip-priority-${task.priority}`}>{task.priority}</span>
                {task.due_date && (
                  <span className={overdue ? 'task-due-overdue' : 'task-due'}>
                    {formatDueDate(task.due_date)}
                  </span>
                )}
                <span
                  className="chip"
                  style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent)' }}
                >
                  {task.permission}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {activeTask && (
        <TaskModal
          task={activeTask}
          projectName={activeTask.project_name}
          readOnly={activeTask.permission === 'view'}
          canShare={false}
          onClose={() => setActiveTask(null)}
          onUpdated={(updated) =>
            setTasks((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)))
          }
          onDeleted={() => setActiveTask(null)}
        />
      )}
    </div>
  );
}
