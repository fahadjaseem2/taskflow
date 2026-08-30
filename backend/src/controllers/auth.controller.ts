import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { pool } from '../db';
import { config } from '../config';
import { ApiError } from '../middleware/errorHandler';
import { logger } from '../logger';
import { sendVerificationEmail, sendEmailChangedNotice } from '../services/email.service';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  // Required only when changing the email, checked in the handler below.
  currentPassword: z.string().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
});

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function signToken(userId: number, email: string): string {
  return jwt.sign({ userId, email }, config.jwt.secret, { expiresIn: config.jwt.expiresIn } as jwt.SignOptions);
}

// Belt-and-suspenders: sendVerificationEmail is already designed to never
// throw (see email.service.ts), but account creation and profile updates
// must NEVER fail because of an email problem regardless of what happens
// inside that service, now or after a future change to it. This wrapper
// guarantees that at the call site too.
async function safeSendVerificationEmail(email: string, token: string): Promise<string | undefined> {
  try {
    return await sendVerificationEmail(email, token);
  } catch (err) {
    logger.warn('sendVerificationEmail rejected unexpectedly - continuing anyway', {
      email,
      error: (err as Error).message,
    });
    return undefined;
  }
}

function generateVerificationToken(): { token: string; expires: Date } {
  return {
    token: crypto.randomBytes(32).toString('hex'),
    expires: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
  };
}

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.errors.map((e) => e.message).join(', '));
    }
    const { email, password, name } = parsed.data;

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      throw new ApiError(409, 'An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const { token, expires } = generateVerificationToken();

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name, verification_token, verification_token_expires)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, name, email_verified, created_at`,
      [email, passwordHash, name, token, expires]
    );

    const user = result.rows[0];
    const previewUrl = await safeSendVerificationEmail(user.email, token);

    const authToken = signToken(user.id, user.email);
    logger.info('User registered', { userId: user.id });
    res.status(201).json({
      user,
      token: authToken,
      ...(previewUrl ? { devEmailPreviewUrl: previewUrl } : {}),
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, 'Email and password are required');
    }
    const { email, password } = parsed.data;

    const result = await pool.query(
      'SELECT id, email, name, password_hash, email_verified FROM users WHERE email = $1',
      [email]
    );
    if (result.rows.length === 0) {
      throw new ApiError(401, 'Invalid email or password');
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      throw new ApiError(401, 'Invalid email or password');
    }

    const token = signToken(user.id, user.email);
    res.json({
      user: { id: user.id, email: user.email, name: user.name, email_verified: user.email_verified },
      token,
    });
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await pool.query(
      'SELECT id, email, name, email_verified, created_at FROM users WHERE id = $1',
      [req.user!.userId]
    );
    if (result.rows.length === 0) {
      throw new ApiError(404, 'User not found');
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token } = req.query;
    if (!token || typeof token !== 'string') {
      throw new ApiError(400, 'Verification token is required');
    }

    const result = await pool.query(
      `SELECT id, verification_token_expires FROM users
       WHERE verification_token = $1`,
      [token]
    );
    if (result.rows.length === 0) {
      throw new ApiError(400, 'Invalid or already-used verification link');
    }
    const user = result.rows[0];
    if (new Date(user.verification_token_expires) < new Date()) {
      throw new ApiError(400, 'This verification link has expired. Request a new one.');
    }

    await pool.query(
      `UPDATE users SET email_verified = TRUE, verification_token = NULL, verification_token_expires = NULL
       WHERE id = $1`,
      [user.id]
    );

    res.json({ verified: true });
  } catch (err) {
    next(err);
  }
}

export async function resendVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await pool.query('SELECT id, email, email_verified FROM users WHERE id = $1', [
      req.user!.userId,
    ]);
    const user = result.rows[0];
    if (user.email_verified) {
      throw new ApiError(400, 'Email is already verified');
    }

    const { token, expires } = generateVerificationToken();
    await pool.query(
      'UPDATE users SET verification_token = $1, verification_token_expires = $2 WHERE id = $3',
      [token, expires, user.id]
    );
    const previewUrl = await safeSendVerificationEmail(user.email, token);

    res.json({
      sent: true,
      ...(previewUrl ? { devEmailPreviewUrl: previewUrl } : {}),
    });
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.errors.map((e) => e.message).join(', '));
    }
    const { name, email, currentPassword } = parsed.data;
    if (!name && !email) {
      throw new ApiError(400, 'Provide a name or email to update');
    }

    const existing = await pool.query('SELECT * FROM users WHERE id = $1', [req.user!.userId]);
    const user = existing.rows[0];

    // Changing the email is treated as sensitive - require the current
    // password so a hijacked session token alone can't redirect the account
    // to an attacker-controlled inbox.
    if (email && email !== user.email) {
      if (!currentPassword) {
        throw new ApiError(400, 'Current password is required to change your email');
      }
      const valid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!valid) {
        throw new ApiError(401, 'Current password is incorrect');
      }
      const emailTaken = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [
        email,
        user.id,
      ]);
      if (emailTaken.rows.length > 0) {
        throw new ApiError(409, 'That email is already in use');
      }
    }

    const newName = name ?? user.name;
    const newEmail = email ?? user.email;
    const emailChanged = newEmail !== user.email;

    let result;
    let previewUrl: string | undefined;
    if (emailChanged) {
      const { token, expires } = generateVerificationToken();
      result = await pool.query(
        `UPDATE users SET name = $1, email = $2, email_verified = FALSE,
           verification_token = $3, verification_token_expires = $4
         WHERE id = $5
         RETURNING id, email, name, email_verified, created_at`,
        [newName, newEmail, token, expires, user.id]
      );
      previewUrl = await safeSendVerificationEmail(newEmail, token);
      try {
        await sendEmailChangedNotice(user.email); // notify the OLD address too
      } catch (err) {
        logger.warn('sendEmailChangedNotice rejected unexpectedly - continuing anyway', {
          email: user.email,
          error: (err as Error).message,
        });
      }
    } else {
      result = await pool.query(
        `UPDATE users SET name = $1 WHERE id = $2
         RETURNING id, email, name, email_verified, created_at`,
        [newName, user.id]
      );
    }

    res.json({
      ...result.rows[0],
      ...(previewUrl ? { devEmailPreviewUrl: previewUrl } : {}),
    });
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.errors.map((e) => e.message).join(', '));
    }
    const { currentPassword, newPassword } = parsed.data;

    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user!.userId]);
    const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!valid) {
      throw new ApiError(401, 'Current password is incorrect');
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user!.userId]);

    logger.info('Password changed', { userId: req.user!.userId });
    res.json({ changed: true });
  } catch (err) {
    next(err);
  }
}
