import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { redis } from '../redis';
import { config } from '../config';
import { ApiError } from '../middleware/errorHandler';
import { cacheHitsTotal, cacheMissesTotal } from '../metrics';
import { logger } from '../logger';

const taskInputSchema = z.object({
  project_id: z.number().int().positive(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().default(''),
  status: z.enum(['todo', 'in_progress', 'done']).optional().default('todo'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
  due_date: z.string().nullable().optional(),
  assignee_id: z.number().int().positive().nullable().optional(),
  tags: z.array(z.string().max(30)).max(10).optional().default([]),
});

const taskUpdateSchema = taskInputSchema.partial().extend({
  position: z.number().int().optional(),
});

type AccessRole = 'owner' | 'edit' | 'view' | null;

function cacheKeyForProject(projectId: number | string): string {
  return `tasks:project:${projectId}`;
}

async function invalidateProjectCache(projectId: number | string): Promise<void> {
  await redis.del(cacheKeyForProject(projectId));
}

async function assertProjectOwnership(projectId: number, userId: number): Promise<void> {
  const result = await pool.query('SELECT id FROM projects WHERE id = $1 AND owner_id = $2', [
    projectId,
    userId,
  ]);
  if (result.rows.length === 0) {
    throw new ApiError(404, `Project ${projectId} not found`);
  }
}

// A task is accessible to: (a) the owner of its project, or (b) a user it's
// been explicitly shared with (view or edit). Nothing else - a share grants
// access to that one task only, never to the rest of the project/board.
async function getTaskAccess(
  taskId: number,
  userId: number
): Promise<{ task: Record<string, unknown>; role: AccessRole }> {
  const result = await pool.query(
    `SELECT t.*, p.owner_id,
       CASE WHEN p.owner_id = $2 THEN 'owner' ELSE ts.permission END AS access_role
     FROM tasks t
     JOIN projects p ON p.id = t.project_id
     LEFT JOIN task_shares ts ON ts.task_id = t.id AND ts.shared_with_user_id = $2
     WHERE t.id = $1`,
    [taskId, userId]
  );
  if (result.rows.length === 0) {
    return { task: {}, role: null };
  }
  const row = result.rows[0];
  return { task: row, role: (row.access_role as AccessRole) ?? null };
}

export async function listTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = req.query.project_id ? Number(req.query.project_id) : null;
    if (!projectId) {
      throw new ApiError(400, 'project_id query parameter is required');
    }
    await assertProjectOwnership(projectId, req.user!.userId);

    const { status, priority, assignee_id, search } = req.query;
    const cacheKey = `${cacheKeyForProject(projectId)}:${JSON.stringify(req.query)}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
      cacheHitsTotal.inc();
      res.set('X-Cache', 'HIT');
      res.json(JSON.parse(cached));
      return;
    }
    cacheMissesTotal.inc();

    const conditions: string[] = ['t.project_id = $1'];
    const params: unknown[] = [projectId];

    if (status) {
      params.push(status);
      conditions.push(`t.status = $${params.length}`);
    }
    if (priority) {
      params.push(priority);
      conditions.push(`t.priority = $${params.length}`);
    }
    if (assignee_id) {
      params.push(Number(assignee_id));
      conditions.push(`t.assignee_id = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(t.title ILIKE $${params.length} OR t.description ILIKE $${params.length})`);
    }

    const result = await pool.query(
      `SELECT t.*, u.name AS assignee_name, p.name AS project_name, p.color AS project_color
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assignee_id
       LEFT JOIN projects p ON p.id = t.project_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY t.status, t.position ASC, t.created_at DESC`,
      params
    );

    await redis.set(cacheKey, JSON.stringify(result.rows), 'EX', config.cacheTtlSeconds);
    res.set('X-Cache', 'MISS');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

// Tasks shared with the current user by other project owners.
// Declared distinctly from /:id in the router (and mounted before it),
// since Express would otherwise treat "shared" as a task id.
export async function getSharedWithMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await pool.query(
      `SELECT t.*, p.name AS project_name, p.color AS project_color, u.name AS owner_name, ts.permission
       FROM task_shares ts
       JOIN tasks t ON t.id = ts.task_id
       JOIN projects p ON p.id = t.project_id
       JOIN users u ON u.id = p.owner_id
       WHERE ts.shared_with_user_id = $1
       ORDER BY ts.created_at DESC`,
      [req.user!.userId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

export async function getTask(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { task, role } = await getTaskAccess(Number(id), req.user!.userId);
    if (!role) {
      throw new ApiError(404, `Task ${id} not found`);
    }
    res.json({ ...task, access_role: role });
  } catch (err) {
    next(err);
  }
}

export async function createTask(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = taskInputSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.errors.map((e) => e.message).join(', '));
    }
    const { project_id, title, description, status, priority, due_date, assignee_id, tags } =
      parsed.data;

    await assertProjectOwnership(project_id, req.user!.userId);

    const result = await pool.query(
      `INSERT INTO tasks
         (project_id, title, description, status, priority, due_date, assignee_id, tags, created_by, ticket_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
         COALESCE((SELECT MAX(ticket_number) + 1 FROM tasks WHERE project_id = $1), 1))
       RETURNING *`,
      [project_id, title, description, status, priority, due_date ?? null, assignee_id ?? null, tags, req.user!.userId]
    );

    await invalidateProjectCache(project_id);
    logger.info('Task created', { taskId: result.rows[0].id, projectId: project_id });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function updateTask(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const parsed = taskUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.errors.map((e) => e.message).join(', '));
    }

    const { task: existing, role } = await getTaskAccess(Number(id), req.user!.userId);
    if (!role) {
      throw new ApiError(404, `Task ${id} not found`);
    }
    if (role === 'view') {
      throw new ApiError(403, 'You have view-only access to this task');
    }

    const merged = { ...existing, ...parsed.data };
    const result = await pool.query(
      `UPDATE tasks SET title = $1, description = $2, status = $3, priority = $4,
         due_date = $5, assignee_id = $6, tags = $7, position = $8, updated_at = NOW()
       WHERE id = $9 RETURNING *`,
      [
        merged.title,
        merged.description,
        merged.status,
        merged.priority,
        merged.due_date,
        merged.assignee_id,
        merged.tags,
        merged.position,
        id,
      ]
    );

    await invalidateProjectCache(merged.project_id as number);
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function deleteTask(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { role, task } = await getTaskAccess(Number(id), req.user!.userId);
    if (!role) {
      throw new ApiError(404, `Task ${id} not found`);
    }
    if (role !== 'owner') {
      throw new ApiError(403, 'Only the project owner can delete this task');
    }

    await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
    await invalidateProjectCache(task.project_id as number);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// --- Comments (owner and shared users can read; view-only shares can't post) ---

const commentSchema = z.object({
  body: z.string().min(1).max(2000),
});

export async function listComments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { role } = await getTaskAccess(Number(id), req.user!.userId);
    if (!role) {
      throw new ApiError(404, `Task ${id} not found`);
    }

    const result = await pool.query(
      `SELECT c.*, u.name AS user_name
       FROM task_comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.task_id = $1
       ORDER BY c.created_at ASC`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

export async function addComment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const parsed = commentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, 'Comment body is required');
    }

    const { role } = await getTaskAccess(Number(id), req.user!.userId);
    if (!role) {
      throw new ApiError(404, `Task ${id} not found`);
    }
    if (role === 'view') {
      throw new ApiError(403, 'You have view-only access to this task');
    }

    const result = await pool.query(
      'INSERT INTO task_comments (task_id, user_id, body) VALUES ($1, $2, $3) RETURNING *',
      [id, req.user!.userId, parsed.data.body]
    );
    const withName = await pool.query(
      'SELECT c.*, u.name AS user_name FROM task_comments c JOIN users u ON u.id = c.user_id WHERE c.id = $1',
      [result.rows[0].id]
    );
    res.status(201).json(withName.rows[0]);
  } catch (err) {
    next(err);
  }
}

// --- Sharing (owner only can manage who a task is shared with) ---

const shareSchema = z.object({
  email: z.string().email(),
  permission: z.enum(['view', 'edit']).optional().default('view'),
});

async function assertTaskOwnership(taskId: number, userId: number): Promise<Record<string, unknown>> {
  const { task, role } = await getTaskAccess(taskId, userId);
  if (!role) {
    throw new ApiError(404, `Task ${taskId} not found`);
  }
  if (role !== 'owner') {
    throw new ApiError(403, 'Only the project owner can manage sharing for this task');
  }
  return task;
}

export async function listShares(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    await assertTaskOwnership(Number(id), req.user!.userId);

    const result = await pool.query(
      `SELECT ts.id, ts.permission, ts.created_at, u.id AS user_id, u.name, u.email
       FROM task_shares ts JOIN users u ON u.id = ts.shared_with_user_id
       WHERE ts.task_id = $1 ORDER BY ts.created_at ASC`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

export async function shareTask(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    await assertTaskOwnership(Number(id), req.user!.userId);

    const parsed = shareSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.errors.map((e) => e.message).join(', '));
    }
    const { email, permission } = parsed.data;

    if (email === req.user!.email) {
      throw new ApiError(400, "You can't share a task with yourself");
    }

    const targetUser = await pool.query('SELECT id, name, email FROM users WHERE email = $1', [email]);
    if (targetUser.rows.length === 0) {
      throw new ApiError(404, 'No TaskFlow account found with that email');
    }

    const result = await pool.query(
      `INSERT INTO task_shares (task_id, shared_with_user_id, shared_by_user_id, permission)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (task_id, shared_with_user_id) DO UPDATE SET permission = EXCLUDED.permission
       RETURNING id, permission, created_at`,
      [id, targetUser.rows[0].id, req.user!.userId, permission]
    );

    res.status(201).json({ ...result.rows[0], user: targetUser.rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function revokeShare(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id, userId } = req.params;
    await assertTaskOwnership(Number(id), req.user!.userId);

    await pool.query('DELETE FROM task_shares WHERE task_id = $1 AND shared_with_user_id = $2', [
      id,
      userId,
    ]);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
