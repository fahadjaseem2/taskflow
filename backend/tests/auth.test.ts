import request from 'supertest';

jest.mock('../src/db', () => ({
  pool: { query: jest.fn(), on: jest.fn() },
  checkDbConnection: jest.fn().mockResolvedValue(true),
  runMigrations: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/redis', () => ({
  redis: { get: jest.fn(), set: jest.fn(), del: jest.fn(), call: jest.fn(), ping: jest.fn().mockResolvedValue('PONG'), on: jest.fn() },
  checkRedisConnection: jest.fn().mockResolvedValue(true),
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn(),
}));

jest.mock('../src/services/email.service', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
  sendEmailChangedNotice: jest.fn().mockResolvedValue(undefined),
}));

// eslint-disable-next-line import/first
import bcrypt from 'bcryptjs';
// eslint-disable-next-line import/first
import { createApp } from '../src/app';
// eslint-disable-next-line import/first
import { pool } from '../src/db';

const app = createApp();

describe('Auth API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers a new user and returns a token', async () => {
    (pool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [] }) // no existing user
      .mockResolvedValueOnce({
        rows: [{ id: 1, email: 'ada@example.com', name: 'Ada', created_at: new Date().toISOString() }],
      });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'ada@example.com', password: 'supersecret', name: 'Ada' });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('ada@example.com');
  });

  it('rejects registration with a weak password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'ada@example.com', password: '123', name: 'Ada' });
    expect(res.status).toBe(400);
  });

  it('rejects registration when the email is already taken', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: 1 }] });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'ada@example.com', password: 'supersecret', name: 'Ada' });
    expect(res.status).toBe(409);
  });

  it('completes registration even if sending the verification email fails (e.g. bad SMTP credentials)', async () => {
    const emailService = require('../src/services/email.service');
    (emailService.sendVerificationEmail as jest.Mock).mockRejectedValueOnce(
      new Error('Invalid login: 535-5.7.8 Username and Password not accepted')
    );
    (pool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [] }) // no existing user
      .mockResolvedValueOnce({
        rows: [{ id: 2, email: 'bob@example.com', name: 'Bob', created_at: new Date().toISOString() }],
      });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'bob@example.com', password: 'supersecret', name: 'Bob' });

    // The account is created and a token is issued regardless of whether
    // the verification email actually went out.
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.devEmailPreviewUrl).toBeUndefined();
  });

  it('logs in with correct credentials', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ id: 1, email: 'ada@example.com', name: 'Ada', password_hash: 'hashed-password' }],
    });
    (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ada@example.com', password: 'supersecret' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('rejects login with wrong password', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ id: 1, email: 'ada@example.com', name: 'Ada', password_hash: 'hashed-password' }],
    });
    (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ada@example.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('rejects login for a nonexistent user', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'whatever' });
    expect(res.status).toBe(401);
  });

  it('rejects /me without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('Email verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects verification without a token', async () => {
    const res = await request(app).get('/api/auth/verify-email');
    expect(res.status).toBe(400);
  });

  it('rejects an unknown verification token', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/auth/verify-email?token=bogus');
    expect(res.status).toBe(400);
  });

  it('rejects an expired verification token', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ id: 1, verification_token_expires: new Date(Date.now() - 1000).toISOString() }],
    });
    const res = await request(app).get('/api/auth/verify-email?token=expired');
    expect(res.status).toBe(400);
  });

  it('verifies with a valid token', async () => {
    (pool.query as jest.Mock)
      .mockResolvedValueOnce({
        rows: [{ id: 1, verification_token_expires: new Date(Date.now() + 100000).toISOString() }],
      })
      .mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/auth/verify-email?token=valid');
    expect(res.status).toBe(200);
    expect(res.body.verified).toBe(true);
  });
});

describe('Profile updates', () => {
  const jwt = require('jsonwebtoken');
  const { config } = require('../src/config');
  const token = jwt.sign({ userId: 1, email: 'ada@example.com' }, config.jwt.secret);
  const authHeader = { Authorization: `Bearer ${token}` };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates the name without requiring a password', async () => {
    (pool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ id: 1, email: 'ada@example.com', name: 'Ada', password_hash: 'x' }] })
      .mockResolvedValueOnce({ rows: [{ id: 1, email: 'ada@example.com', name: 'Ada Lovelace' }] });

    const res = await request(app).put('/api/auth/profile').set(authHeader).send({ name: 'Ada Lovelace' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Ada Lovelace');
  });

  it('requires the current password to change email', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ id: 1, email: 'ada@example.com', name: 'Ada', password_hash: 'x' }],
    });
    const res = await request(app)
      .put('/api/auth/profile')
      .set(authHeader)
      .send({ email: 'new@example.com' });
    expect(res.status).toBe(400);
  });

  it('rejects an email change with the wrong current password', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ id: 1, email: 'ada@example.com', name: 'Ada', password_hash: 'x' }],
    });
    (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);
    const res = await request(app)
      .put('/api/auth/profile')
      .set(authHeader)
      .send({ email: 'new@example.com', currentPassword: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('changes the password with a correct current password', async () => {
    (pool.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ password_hash: 'hashed-password' }] })
      .mockResolvedValueOnce({ rows: [] });
    (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);

    const res = await request(app)
      .put('/api/auth/password')
      .set(authHeader)
      .send({ currentPassword: 'supersecret', newPassword: 'newpassword123' });
    expect(res.status).toBe(200);
    expect(res.body.changed).toBe(true);
  });

  it('rejects a password change with the wrong current password', async () => {
    (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ password_hash: 'hashed-password' }] });
    (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

    const res = await request(app)
      .put('/api/auth/password')
      .set(authHeader)
      .send({ currentPassword: 'wrong', newPassword: 'newpassword123' });
    expect(res.status).toBe(401);
  });
});
