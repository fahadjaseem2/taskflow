import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../Modal';
import { useProjects } from '../../context/ProjectsContext';

const COLOR_OPTIONS = ['#4F46E5', '#2563EB', '#0891B2', '#16A34A', '#D97706', '#DC2626', '#DB2777'];

export function NewProjectModal({ onClose }: { onClose: () => void }) {
  const { createProject } = useProjects();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(COLOR_OPTIONS[0]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      setSubmitting(true);
      const project = await createProject({ name: name.trim(), description: description.trim(), color });
      onClose();
      navigate(`/projects/${project.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="New project" onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="field">
          <label htmlFor="project-name">Name</label>
          <input
            id="project-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Website Redesign"
          />
        </div>
        <div className="field">
          <label htmlFor="project-desc">Description</label>
          <textarea
            id="project-desc"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this project for?"
          />
        </div>
        <div className="field">
          <label>Color</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Color ${c}`}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  background: c,
                  border: c === color ? '2px solid var(--color-text)' : '2px solid transparent',
                  padding: 0,
                }}
              />
            ))}
          </div>
        </div>
        {error && <p className="error-banner">{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting || !name.trim()}>
            {submitting ? 'Creating…' : 'Create project'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
