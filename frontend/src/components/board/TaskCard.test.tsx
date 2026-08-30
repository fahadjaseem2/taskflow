import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskCard } from './TaskCard';
import { Task } from '../../types';

const baseTask: Task = {
  id: 1,
  project_id: 1,
  ticket_number: 14,
  title: 'Fix the login redirect bug',
  description: '',
  status: 'todo',
  priority: 'high',
  due_date: null,
  assignee_id: 2,
  assignee_name: 'Ada Lovelace',
  tags: ['bug'],
  position: 0,
  created_at: '',
  updated_at: '',
};

describe('TaskCard', () => {
  it('renders the ticket ID derived from the project name', () => {
    render(
      <TaskCard task={baseTask} projectName="Website Redesign" onOpen={vi.fn()} onDragStart={vi.fn()} />
    );
    expect(screen.getByText('WR-14')).toBeInTheDocument();
  });

  it('renders the priority chip', () => {
    render(<TaskCard task={baseTask} projectName="Website Redesign" onOpen={vi.fn()} onDragStart={vi.fn()} />);
    expect(screen.getByText('high')).toBeInTheDocument();
  });

  it('renders the assignee initials', () => {
    render(<TaskCard task={baseTask} projectName="Website Redesign" onOpen={vi.fn()} onDragStart={vi.fn()} />);
    expect(screen.getByTitle('Ada Lovelace')).toHaveTextContent('AL');
  });

  it('calls onOpen when clicked', () => {
    const onOpen = vi.fn();
    render(<TaskCard task={baseTask} projectName="Website Redesign" onOpen={onOpen} onDragStart={vi.fn()} />);
    fireEvent.click(screen.getByText('Fix the login redirect bug'));
    expect(onOpen).toHaveBeenCalledWith(baseTask);
  });

  it('flags an overdue task', () => {
    const overdueTask = { ...baseTask, due_date: '2020-01-01' };
    render(<TaskCard task={overdueTask} projectName="Website Redesign" onOpen={vi.fn()} onDragStart={vi.fn()} />);
    expect(screen.getByText(/⚠/)).toBeInTheDocument();
  });
});
