import { FormEvent, useState } from 'react';
import { Modal } from '../Modal';
import { Task, TaskPriority, TaskStatus, PRIORITY_LABELS } from '../../types';
import { api } from '../../api';

interface Props {
  projectId: number;
  initialStatus: TaskStatus;
  onClose: () => void;
  onCreated: (task: Task) => void;
}

export function NewTaskModal({ projectId, initialStatus, onClose, onCreated }: Props) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      setSubmitting(true);
      const task = await api.createTask({
        project_id: projectId,
        title: title.trim(),
        status: initialStatus,
        priority,
        due_date: dueDate || null,
      });
      onCreated(task);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="New task" onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="field">
          <label htmlFor="new-task-title">Title</label>
          <input
            id="new-task-title"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs doing?"
          />
        </div>
        <div className="task-modal-fields" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="field">
            <label htmlFor="new-task-priority">Priority</label>
            <select
              id="new-task-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
            >
              {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="new-task-due">Due date</label>
            <input id="new-task-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        {error && <p className="error-banner">{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting || !title.trim()}>
            {submitting ? 'Adding…' : 'Add task'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
