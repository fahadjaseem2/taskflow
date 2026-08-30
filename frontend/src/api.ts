import { Task, TaskComment, Project, User, DashboardStats, TaskShare, SharedTask, SharePermission } from './types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
const TOKEN_KEY = 'taskflow_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (res.status === 401) {
    clearToken();
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed with status ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  // Auth
  register: (data: { email: string; password: string; name: string }) =>
    request<{ user: User; token: string; devEmailPreviewUrl?: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  login: (data: { email: string; password: string }) =>
    request<{ user: User; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  me: () => request<User>('/api/auth/me'),
  updateProfile: (data: { name?: string; email?: string; currentPassword?: string }) =>
    request<User & { devEmailPreviewUrl?: string }>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    request<{ changed: boolean }>('/api/auth/password', { method: 'PUT', body: JSON.stringify(data) }),
  resendVerification: () =>
    request<{ sent: boolean; devEmailPreviewUrl?: string }>('/api/auth/resend-verification', {
      method: 'POST',
    }),
  verifyEmail: (token: string) =>
    request<{ verified: boolean }>(`/api/auth/verify-email?token=${encodeURIComponent(token)}`),

  // Projects
  listProjects: () => request<Project[]>('/api/projects'),
  createProject: (data: { name: string; description?: string; color?: string }) =>
    request<Project>('/api/projects', { method: 'POST', body: JSON.stringify(data) }),
  updateProject: (id: number, data: Partial<Project>) =>
    request<Project>(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProject: (id: number) => request<void>(`/api/projects/${id}`, { method: 'DELETE' }),

  // Tasks
  listTasks: (
    projectId: number,
    filters?: { status?: string; priority?: string; search?: string; assignee_id?: number }
  ) => {
    const params = new URLSearchParams({ project_id: String(projectId) });
    if (filters?.status) params.set('status', filters.status);
    if (filters?.priority) params.set('priority', filters.priority);
    if (filters?.search) params.set('search', filters.search);
    if (filters?.assignee_id) params.set('assignee_id', String(filters.assignee_id));
    return request<Task[]>(`/api/tasks?${params.toString()}`);
  },
  createTask: (data: Partial<Task> & { project_id: number; title: string }) =>
    request<Task>('/api/tasks', { method: 'POST', body: JSON.stringify(data) }),
  updateTask: (id: number, data: Partial<Task>) =>
    request<Task>(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTask: (id: number) => request<void>(`/api/tasks/${id}`, { method: 'DELETE' }),

  // Comments
  listComments: (taskId: number) => request<TaskComment[]>(`/api/tasks/${taskId}/comments`),
  addComment: (taskId: number, body: string) =>
    request<TaskComment>(`/api/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),

  // Sharing
  listShares: (taskId: number) => request<TaskShare[]>(`/api/tasks/${taskId}/shares`),
  shareTask: (taskId: number, email: string, permission: SharePermission) =>
    request(`/api/tasks/${taskId}/shares`, {
      method: 'POST',
      body: JSON.stringify({ email, permission }),
    }),
  revokeShare: (taskId: number, userId: number) =>
    request<void>(`/api/tasks/${taskId}/shares/${userId}`, { method: 'DELETE' }),
  listSharedWithMe: () => request<SharedTask[]>('/api/tasks/shared'),

  // Dashboard
  getStats: (projectId?: number) =>
    request<DashboardStats>(`/api/dashboard/stats${projectId ? `?project_id=${projectId}` : ''}`),
};
