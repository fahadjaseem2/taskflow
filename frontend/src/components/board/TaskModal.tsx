import { FormEvent, useEffect, useState } from 'react';
import { Modal } from '../Modal';
import { Task, TaskComment, TaskShare, TaskPriority, TaskStatus, SharePermission, PRIORITY_LABELS, STATUS_LABELS } from '../../types';
import { api } from '../../api';
import { initials, ticketPrefix } from '../../utils';

interface Props {
  task: Task;
  projectName: string;
  onClose: () => void;
  onUpdated: (task: Task) => void;
  onDeleted: (taskId: number) => void;
  readOnly?: boolean;
  canShare?: boolean;
}

export function TaskModal({
  task,
  projectName,
  onClose,
  onUpdated,
  onDeleted,
  readOnly = false,
  canShare = true,
}: Props) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [dueDate, setDueDate] = useState(task.due_date ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [comments, setComments] = useState<TaskComment[]>([]);
  const [commentBody, setCommentBody] = useState('');
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [postingComment, setPostingComment] = useState(false);

  const [shares, setShares] = useState<TaskShare[]>([]);
  const [shareEmail, setShareEmail] = useState('');
  const [sharePermission, setSharePermission] = useState<SharePermission>('view');
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listComments(task.id)
      .then(setComments)
      .catch(() => setComments([]))
      .finally(() => setCommentsLoading(false));

    if (canShare) {
      api
        .listShares(task.id)
        .then(setShares)
        .catch(() => setShares([]));
    }
  }, [task.id, canShare]);

  async function handleSave() {
    try {
      setSaving(true);
      setError(null);
      const updated = await api.updateTask(task.id, {
        title,
        description,
        status,
        priority,
        due_date: dueDate || null,
      });
      onUpdated(updated);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete ${ticketPrefix(projectName)}-${task.ticket_number}? This can't be undone.`)) {
      return;
    }
    await api.deleteTask(task.id);
    onDeleted(task.id);
    onClose();
  }

  async function handleAddComment(e: FormEvent) {
    e.preventDefault();
    if (!commentBody.trim()) return;
    try {
      setPostingComment(true);
      const comment = await api.addComment(task.id, commentBody.trim());
      setComments((prev) => [...prev, comment]);
      setCommentBody('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPostingComment(false);
    }
  }

  async function handleShare(e: FormEvent) {
    e.preventDefault();
    if (!shareEmail.trim()) return;
    try {
      setSharing(true);
      setShareError(null);
      await api.shareTask(task.id, shareEmail.trim(), sharePermission);
      const updatedShares = await api.listShares(task.id);
      setShares(updatedShares);
      setShareEmail('');
    } catch (err) {
      setShareError((err as Error).message);
    } finally {
      setSharing(false);
    }
  }

  async function handleRevoke(userId: number) {
    await api.revokeShare(task.id, userId);
    setShares((prev) => prev.filter((s) => s.user_id !== userId));
  }

  return (
    <Modal title={`${ticketPrefix(projectName)}-${task.ticket_number}`} onClose={onClose} width={640}>
      <div className="task-modal-body">
        {readOnly ? (
          <h3 className="task-modal-title-input" style={{ borderBottom: 'none', cursor: 'default' }}>
            {title}
          </h3>
        ) : (
          <input
            className="task-modal-title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Task title"
          />
        )}

        {readOnly && (
          <p className="canvas-subtitle" style={{ marginTop: -8 }}>
            You have view-only access to this task.
          </p>
        )}

        <div className="task-modal-fields">
          <div className="field">
            <label htmlFor="tm-status">Status</label>
            <select
              id="tm-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
              disabled={readOnly}
            >
              {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="tm-priority">Priority</label>
            <select
              id="tm-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              disabled={readOnly}
            >
              {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="tm-due">Due date</label>
            <input
              id="tm-due"
              type="date"
              value={dueDate ?? ''}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={readOnly}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="tm-desc">Description</label>
          <textarea
            id="tm-desc"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add more detail…"
            disabled={readOnly}
          />
        </div>

        {error && (
          <p className="error-banner" role="alert">
            {error}
          </p>
        )}

        <div className="task-modal-actions">
          {!readOnly ? (
            <button className="btn btn-danger" onClick={handleDelete}>
              Delete task
            </button>
          ) : (
            <span />
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose}>
              {readOnly ? 'Close' : 'Cancel'}
            </button>
            {!readOnly && (
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !title.trim()}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            )}
          </div>
        </div>

        {canShare && (
          <div className="task-modal-comments">
            <h4 className="task-modal-comments-title">Shared with</h4>
            {shares.length === 0 && <p className="canvas-subtitle">Not shared with anyone yet.</p>}
            <ul className="share-list">
              {shares.map((share) => (
                <li key={share.id} className="share-item">
                  <span className="avatar">{initials(share.name)}</span>
                  <div className="share-item-main">
                    <span className="share-item-name">{share.name}</span>
                    <span className="share-item-email">{share.email}</span>
                  </div>
                  <span className="chip" style={{ background: 'var(--color-surface-sunken)' }}>
                    {share.permission}
                  </span>
                  <button className="btn btn-ghost" onClick={() => handleRevoke(share.user_id)} aria-label={`Remove ${share.name}`}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>

            <form onSubmit={handleShare} className="share-form">
              <input
                type="email"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                placeholder="Invite by email…"
                aria-label="Share email"
              />
              <select value={sharePermission} onChange={(e) => setSharePermission(e.target.value as SharePermission)}>
                <option value="view">Can view</option>
                <option value="edit">Can edit</option>
              </select>
              <button type="submit" className="btn btn-secondary" disabled={sharing || !shareEmail.trim()}>
                Share
              </button>
            </form>
            {shareError && <p className="error-banner">{shareError}</p>}
          </div>
        )}

        <div className="task-modal-comments">
          <h4 className="task-modal-comments-title">Comments</h4>

          {commentsLoading && <p className="canvas-subtitle">Loading comments…</p>}
          {!commentsLoading && comments.length === 0 && (
            <p className="canvas-subtitle">No comments yet. Add the first one below.</p>
          )}

          <ul className="comment-list">
            {comments.map((comment) => (
              <li key={comment.id} className="comment-item">
                <span className="avatar">{initials(comment.user_name)}</span>
                <div>
                  <div className="comment-meta">
                    <strong>{comment.user_name}</strong>
                    <span>{new Date(comment.created_at).toLocaleString()}</span>
                  </div>
                  <p className="comment-body">{comment.body}</p>
                </div>
              </li>
            ))}
          </ul>

          {!readOnly && (
            <form onSubmit={handleAddComment} className="comment-form">
              <input
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder="Write a comment…"
                aria-label="Comment"
              />
              <button type="submit" className="btn btn-secondary" disabled={postingComment || !commentBody.trim()}>
                Post
              </button>
            </form>
          )}
        </div>
      </div>
    </Modal>
  );
}
