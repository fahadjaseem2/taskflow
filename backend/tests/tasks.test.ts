import request from 'supertest';
import jwt from 'jsonwebtoken';

jest.mock('../src/db', () => ({
  pool: { query: jest.fn(), on: jest.fn() },
  checkDbConnection: jest.fn().mockResolvedValue(true),
  runMigrations: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/redis', () => ({
  redis: { get: jest.fn(), set: jest.fn(), del: jest.fn(), call: jest.fn(), ping: jest.fn().mockResolvedValue('PONG'), on: jest.fn() },
  checkRedisConnection: jest.fn().mockResolvedValue(true),
}));

// eslint-disable-next-line import/first
import { createApp } from '../src/app';
// eslint-disable-next-line import/first
import { pool } from '../src/db';
// eslint-disable-next-line import/first
import { redis } from '../src/redis';
// eslint-disable-next-line import/first
import { config } from '../src/config';

const app = createApp();

const authToken = jwt.sign({ userId: 1, email: 'ada@example.com' }, config.jwt.secret);
const authHeader = { Authorization: `Bearer ${authToken}` };

// A row shaped like getTaskAccess()'s joined query result, for a task
// owned by userId 1 (the caller above).
function ownedTaskRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    project_id: 1,
    owner_id: 1,
    access_role: 'owner',
    title: 'Existing task',
    description: '',
    status: 'todo',
    priority: 'medium',
    due_date: null,
    assignee_id: null,
    tags: [],
    position: 0,
    ...overrides,
  };
}

describe('Health endpoints', () => {
  it('GET /healthz returns 200', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
  });

  it('GET /metrics returns Prometheus-formatted text', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toContain('taskflow_');
  });
});

describe('Auth middleware', () => {
  it('rejects task requests without a token', async () => {
    const res = await request(app).get('/api/tasks?project_id=1');
    expect(res.status).toBe(401);
  });

  it('rejects task requests with a malformed token', async () => {
    const res = await request(app)
      .get('/api/tasks?project_id=1')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });
});

describe('Tasks API (project board)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requires a project_id query parameter', async () => {
    const res = await request(app).get('/api/tasks').set(authHeader);
    expect(res.status).toBe(400);
  });

  it('returns 404 when the project is not owned by the caller', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/tasks?project_id=99').set(authHeader);
    expect(res.status).toBe(404);
  });

  it('GET /api/tasks returns cached data on a cache hit', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: 1 }] });
    (redis.get as jest.Mock).mockResolvedValueOnce(JSON.stringify([{ id: 1, title: 'Cached task' }]));

    const res = await request(app).get('/api/tasks?project_id=1').set(authHeader);
    expect(res.status).toBe(200);
    expect(res.headers['x-cache']).toBe('HIT');
  });

  it('POST /api/tasks rejects an empty title with 400', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set(authHeader)
      .send({ project_id: 1, title: '' });
    expect(res.status).toBe(400);
  });

  it('POST /api/tasks creates a task and invalidates the cache', async () => {
    (pool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // ownership check
      .mockResolvedValueOnce({ rows: [{ id: 5, title: 'New task', project_id: 1 }] });

    const res = await request(app)
      .post('/api/tasks')
      .set(authHeader)
      .send({ project_id: 1, title: 'New task' });

    expect(res.status).toBe(201);
    expect(redis.del).toHaveBeenCalledWith('tasks:project:1');
  });
});

describe('Single task access control', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /api/tasks/:id returns 404 for a missing/inaccessible task', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/tasks/999').set(authHeader);
    expect(res.status).toBe(404);
  });

  it('GET /api/tasks/:id succeeds for the owner', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [ownedTaskRow()] });
    const res = await request(app).get('/api/tasks/1').set(authHeader);
    expect(res.status).toBe(200);
    expect(res.body.access_role).toBe('owner');
  });

  it('GET /api/tasks/:id succeeds for a user with a view share', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({
      rows: [ownedTaskRow({ owner_id: 2, access_role: 'view' })],
    });
    const res = await request(app).get('/api/tasks/1').set(authHeader);
    expect(res.status).toBe(200);
    expect(res.body.access_role).toBe('view');
  });

  it('PUT /api/tasks/:id rejects a view-only share with 403', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({
      rows: [ownedTaskRow({ owner_id: 2, access_role: 'view' })],
    });
    const res = await request(app).put('/api/tasks/1').set(authHeader).send({ title: 'Hacked' });
    expect(res.status).toBe(403);
  });

  it('PUT /api/tasks/:id succeeds for an edit share', async () => {
    (pool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [ownedTaskRow({ owner_id: 2, access_role: 'edit' })] })
      .mockResolvedValueOnce({ rows: [{ id: 1, project_id: 1, title: 'Updated' }] });

    const res = await request(app).put('/api/tasks/1').set(authHeader).send({ title: 'Updated' });
    expect(res.status).toBe(200);
  });

  it('DELETE /api/tasks/:id rejects a shared (non-owner) user with 403', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({
      rows: [ownedTaskRow({ owner_id: 2, access_role: 'edit' })],
    });
    const res = await request(app).delete('/api/tasks/1').set(authHeader);
    expect(res.status).toBe(403);
  });

  it('DELETE /api/tasks/:id succeeds for the owner', async () => {
    (pool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [ownedTaskRow()] })
      .mockResolvedValueOnce({ rows: [] });
    const res = await request(app).delete('/api/tasks/1').set(authHeader);
    expect(res.status).toBe(204);
  });
});

describe('Comments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lets a view-only shared user read comments', async () => {
    (pool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [ownedTaskRow({ owner_id: 2, access_role: 'view' })] })
      .mockResolvedValueOnce({ rows: [{ id: 10, body: 'hi', user_name: 'Bob' }] });

    const res = await request(app).get('/api/tasks/1/comments').set(authHeader);
    expect(res.status).toBe(200);
  });

  it('blocks a view-only shared user from posting comments', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({
      rows: [ownedTaskRow({ owner_id: 2, access_role: 'view' })],
    });
    const res = await request(app).post('/api/tasks/1/comments').set(authHeader).send({ body: 'hi' });
    expect(res.status).toBe(403);
  });

  it('allows the owner to post a comment', async () => {
    (pool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [ownedTaskRow()] })
      .mockResolvedValueOnce({ rows: [{ id: 10 }] })
      .mockResolvedValueOnce({ rows: [{ id: 10, body: 'Looks good', user_name: 'Ada' }] });

    const res = await request(app).post('/api/tasks/1/comments').set(authHeader).send({ body: 'Looks good' });
    expect(res.status).toBe(201);
  });
});

describe('Task sharing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects sharing by a non-owner with 403', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({
      rows: [ownedTaskRow({ owner_id: 2, access_role: 'edit' })],
    });
    const res = await request(app)
      .post('/api/tasks/1/shares')
      .set(authHeader)
      .send({ email: 'bob@example.com' });
    expect(res.status).toBe(403);
  });

  it('rejects sharing with an email that has no account', async () => {
    (pool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [ownedTaskRow()] })
      .mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .post('/api/tasks/1/shares')
      .set(authHeader)
      .send({ email: 'nobody@example.com' });
    expect(res.status).toBe(404);
  });

  it('shares a task with an existing user', async () => {
    (pool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [ownedTaskRow()] })
      .mockResolvedValueOnce({ rows: [{ id: 2, name: 'Bob', email: 'bob@example.com' }] })
      .mockResolvedValueOnce({ rows: [{ id: 1, permission: 'view', created_at: new Date().toISOString() }] });

    const res = await request(app)
      .post('/api/tasks/1/shares')
      .set(authHeader)
      .send({ email: 'bob@example.com' });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('bob@example.com');
  });

  it("rejects sharing a task with yourself", async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [ownedTaskRow()] });
    const res = await request(app)
      .post('/api/tasks/1/shares')
      .set(authHeader)
      .send({ email: 'ada@example.com' });
    expect(res.status).toBe(400);
  });

  it('lists shares for the owner', async () => {
    (pool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [ownedTaskRow()] })
      .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Bob', email: 'bob@example.com', permission: 'view' }] });
    const res = await request(app).get('/api/tasks/1/shares').set(authHeader);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('revokes a share', async () => {
    (pool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [ownedTaskRow()] })
      .mockResolvedValueOnce({ rows: [] });
    const res = await request(app).delete('/api/tasks/1/shares/2').set(authHeader);
    expect(res.status).toBe(204);
  });

  it('GET /api/tasks/shared returns tasks shared with the caller', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ id: 5, title: 'Shared task', project_name: 'Marketing', permission: 'view' }],
    });
    const res = await request(app).get('/api/tasks/shared').set(authHeader);
    expect(res.status).toBe(200);
    expect(res.body[0].title).toBe('Shared task');
  });
});
