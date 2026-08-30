import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { ApiError } from '../middleware/errorHandler';
import { redis } from '../redis';

const projectSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional().default(''),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'color must be a hex value like #4F46E5')
    .optional()
    .default('#4F46E5'),
});

// Projects are scoped to their owner - every query below filters by
// req.user.userId so one account can never see another account's projects.
export async function listProjects(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await pool.query(
      `SELECT p.*, COUNT(t.id)::int AS task_count
       FROM projects p
       LEFT JOIN tasks t ON t.project_id = p.id
       WHERE p.owner_id = $1
       GROUP BY p.id
       ORDER BY p.created_at DESC`,
      [req.user!.userId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

export async function createProject(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = projectSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.errors.map((e) => e.message).join(', '));
    }
    const { name, description, color } = parsed.data;

    const result = await pool.query(
      'INSERT INTO projects (name, description, color, owner_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, description, color, req.user!.userId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function updateProject(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const parsed = projectSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.errors.map((e) => e.message).join(', '));
    }

    const existing = await pool.query('SELECT * FROM projects WHERE id = $1 AND owner_id = $2', [
      id,
      req.user!.userId,
    ]);
    if (existing.rows.length === 0) {
      throw new ApiError(404, `Project ${id} not found`);
    }

    const merged = { ...existing.rows[0], ...parsed.data };
    const result = await pool.query(
      'UPDATE projects SET name = $1, description = $2, color = $3 WHERE id = $4 RETURNING *',
      [merged.name, merged.description, merged.color, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function deleteProject(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM projects WHERE id = $1 AND owner_id = $2 RETURNING id',
      [id, req.user!.userId]
    );
    if (result.rows.length === 0) {
      throw new ApiError(404, `Project ${id} not found`);
    }
    await redis.del(`tasks:project:${id}`);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
