import { Request, Response, NextFunction } from 'express';
import { pool } from '../db';
import { ApiError } from '../middleware/errorHandler';

export async function getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = req.query.project_id ? Number(req.query.project_id) : null;

    const ownedProjects = await pool.query('SELECT id FROM projects WHERE owner_id = $1', [
      req.user!.userId,
    ]);
    const ownedIds = ownedProjects.rows.map((r) => r.id);
    if (ownedIds.length === 0) {
      res.json({ byStatus: {}, byPriority: {}, overdueCount: 0, totalTasks: 0, upcoming: [] });
      return;
    }
    if (projectId && !ownedIds.includes(projectId)) {
      throw new ApiError(404, `Project ${projectId} not found`);
    }

    const scopeCondition = projectId ? 't.project_id = $1' : 't.project_id = ANY($1)';
    const scopeParam = projectId ? projectId : ownedIds;

    const [byStatus, byPriority, overdue, upcoming] = await Promise.all([
      pool.query(
        `SELECT status, COUNT(*)::int AS count FROM tasks t WHERE ${scopeCondition} GROUP BY status`,
        [scopeParam]
      ),
      pool.query(
        `SELECT priority, COUNT(*)::int AS count FROM tasks t WHERE ${scopeCondition} GROUP BY priority`,
        [scopeParam]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS count FROM tasks t
         WHERE ${scopeCondition} AND due_date < CURRENT_DATE AND status != 'done'`,
        [scopeParam]
      ),
      pool.query(
        `SELECT t.id, t.title, t.due_date, t.priority, p.name AS project_name
         FROM tasks t JOIN projects p ON p.id = t.project_id
         WHERE ${scopeCondition} AND due_date IS NOT NULL AND due_date >= CURRENT_DATE AND status != 'done'
         ORDER BY due_date ASC LIMIT 5`,
        [scopeParam]
      ),
    ]);

    const totalTasks = byStatus.rows.reduce((sum, row) => sum + row.count, 0);

    res.json({
      byStatus: Object.fromEntries(byStatus.rows.map((r) => [r.status, r.count])),
      byPriority: Object.fromEntries(byPriority.rows.map((r) => [r.priority, r.count])),
      overdueCount: overdue.rows[0]?.count ?? 0,
      totalTasks,
      upcoming: upcoming.rows,
    });
  } catch (err) {
    next(err);
  }
}
