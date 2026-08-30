import { Task } from '../../types';
import { formatDueDate, isOverdue, initials, ticketPrefix } from '../../utils';

interface Props {
  task: Task;
  projectName: string;
  onOpen: (task: Task) => void;
  onDragStart: (task: Task) => void;
}

export function TaskCard({ task, projectName, onOpen, onDragStart }: Props) {
  const overdue = isOverdue(task.due_date, task.status);

  return (
    <div
      className="task-card"
      draggable
      onDragStart={() => onDragStart(task)}
      onClick={() => onOpen(task)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen(task);
      }}
    >
      <div className="task-card-top">
        <span className="ticket-id">
          {ticketPrefix(projectName)}-{task.ticket_number}
        </span>
        <span className={`chip chip-priority-${task.priority}`}>{task.priority}</span>
      </div>

      <p className="task-card-title">{task.title}</p>

      {task.tags.length > 0 && (
        <div className="task-card-tags">
          {task.tags.map((tag) => (
            <span key={tag} className="task-tag">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="task-card-footer">
        {task.due_date ? (
          <span className={`task-due ${overdue ? 'task-due-overdue' : ''}`}>
            {overdue ? '⚠ ' : ''}
            {formatDueDate(task.due_date)}
          </span>
        ) : (
          <span />
        )}
        {task.assignee_name && (
          <span className="avatar" title={task.assignee_name}>
            {initials(task.assignee_name)}
          </span>
        )}
      </div>
    </div>
  );
}
