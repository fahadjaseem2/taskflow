export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface User {
  id: number;
  email: string;
  name: string;
  email_verified?: boolean;
  created_at?: string;
}

export type SharePermission = 'view' | 'edit';

export interface TaskShare {
  id: number;
  user_id: number;
  name: string;
  email: string;
  permission: SharePermission;
  created_at: string;
}

export interface SharedTask extends Task {
  project_name: string;
  project_color: string;
  owner_name: string;
  permission: SharePermission;
}

export interface Project {
  id: number;
  name: string;
  description: string;
  color: string;
  owner_id: number;
  created_at: string;
  task_count?: number;
}

export interface Task {
  id: number;
  project_id: number;
  ticket_number: number;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  assignee_id: number | null;
  assignee_name?: string | null;
  tags: string[];
  position: number;
  created_at: string;
  updated_at: string;
  access_role?: 'owner' | 'edit' | 'view';
}

export interface TaskComment {
  id: number;
  task_id: number;
  user_id: number;
  user_name: string;
  body: string;
  created_at: string;
}

export interface DashboardStats {
  byStatus: Partial<Record<TaskStatus, number>>;
  byPriority: Partial<Record<TaskPriority, number>>;
  overdueCount: number;
  totalTasks: number;
  upcoming: Array<{
    id: number;
    title: string;
    due_date: string;
    priority: TaskPriority;
    project_name: string;
  }>;
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};
