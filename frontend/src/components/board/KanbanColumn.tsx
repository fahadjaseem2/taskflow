import { useState } from 'react';
import { Task, TaskStatus, STATUS_LABELS } from '../../types';
import { TaskCard } from './TaskCard';

interface Props {
  status: TaskStatus;
  tasks: Task[];
  projectName: string;
  onOpen: (task: Task) => void;
  onDragStart: (task: Task) => void;
  onDrop: (status: TaskStatus) => void;
  onQuickAdd: (status: TaskStatus) => void;
}

const STATUS_DOT: Record<TaskStatus, string> = {
  todo: 'var(--color-status-todo)',
  in_progress: 'var(--color-status-progress)',
  done: 'var(--color-status-done)',
};

export function KanbanColumn({ status, tasks, projectName, onOpen, onDragStart, onDrop, onQuickAdd }: Props) {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div
      className={`kanban-column ${isDragOver ? 'is-drag-over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={() => {
        setIsDragOver(false);
        onDrop(status);
      }}
    >
      <div className="kanban-column-header">
        <span className="kanban-column-dot" style={{ background: STATUS_DOT[status] }} />
        <span className="kanban-column-title">{STATUS_LABELS[status]}</span>
        <span className="kanban-column-count">{tasks.length}</span>
      </div>

      <div className="kanban-column-body">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            projectName={projectName}
            onOpen={onOpen}
            onDragStart={onDragStart}
          />
        ))}

        <button className="kanban-add-btn" onClick={() => onQuickAdd(status)}>
          + Add task
        </button>
      </div>
    </div>
  );
}
