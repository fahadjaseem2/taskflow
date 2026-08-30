import nodemailer, { Transporter } from 'nodemailer';
import { config } from '../config';
import { logger } from '../logger';

let transporter: Transporter | null = null;
let usingEthereal = false;

// Real SMTP if configured. Otherwise, fall back to Ethereal
// (https://ethereal.email) - a free service made for exactly this: it gives
// you a throwaway inbox and a shareable preview URL for every "sent"
// message, so email flows are actually clickable/testable without a real
// mail server. This fallback is NOT gated on NODE_ENV - it's gated purely
// on "did you configure real SMTP or not". If you deploy for real, set
// SMTP_HOST and this path never runs. If you don't, you get a working
// (if fake) inbox instead of a silently-broken feature. If even Ethereal
// itself is unreachable (e.g. no internet), we fall back further to
// logging the message to the console.
async function getTransporter(): Promise<Transporter | null> {
  if (transporter) return transporter;

  if (config.smtp.host) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.password } : undefined,
    });
    return transporter;
  }

  try {
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
    usingEthereal = true;
    logger.info('No SMTP_HOST configured - using a temporary Ethereal inbox for email previews');
    return transporter;
  } catch (err) {
    logger.warn('Could not create an Ethereal test account (offline?) - falling back to console logging', {
      error: (err as Error).message,
    });
    return null;
  }
}

/**
 * Sends an email. Returns a preview URL when running against Ethereal in
 * dev, so callers (the auth controller) can hand that link straight back
 * to the frontend for convenience - no more hunting through server logs.
 *
 * Deliberately never throws. A misconfigured SMTP password, a rejected
 * Gmail login, a network block - none of these should be able to turn
 * "register an account" or "change your profile" into a 500. Email is a
 * side effect of those actions, not a precondition for them succeeding.
 * If sending fails, we log it and the caller just doesn't get a preview
 * URL / the email doesn't go out - the account/profile change still
 * completes normally, and the user can hit "resend verification" once
 * SMTP is fixed.
 */
async function send(to: string, subject: string, text: string, html: string): Promise<string | undefined> {
  let t: Transporter | null;
  try {
    t = await getTransporter();
  } catch (err) {
    logger.error('Could not obtain an email transporter - continuing without sending', {
      error: (err as Error).message,
    });
    return undefined;
  }

  if (!t) {
    logger.info('Email (no transport available, logging instead of sending)', { to, subject, text });
    return undefined;
  }

  try {
    const info = await t.sendMail({ from: config.smtp.from, to, subject, text, html });

    if (usingEthereal) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      logger.info('Dev email sent via Ethereal - preview it here', { to, subject, previewUrl });
      return previewUrl || undefined;
    }

    return undefined;
  } catch (err) {
    logger.error('Failed to send email via SMTP - continuing without blocking the caller', {
      to,
      subject,
      error: (err as Error).message,
    });
    return undefined;
  }
}

export async function sendVerificationEmail(to: string, token: string): Promise<string | undefined> {
  const link = `${config.appUrl}/verify-email?token=${token}`;
  return send(
    to,
    'Verify your TaskFlow email address',
    `Verify your email by visiting: ${link}\n\nThis link expires in 24 hours.`,
    `<p>Verify your email by clicking the link below.</p><p><a href="${link}">${link}</a></p><p>This link expires in 24 hours.</p>`
  );
}

export async function sendEmailChangedNotice(to: string): Promise<string | undefined> {
  return send(
    to,
    'Your TaskFlow account email was changed',
    'This is a confirmation that the email address on your TaskFlow account was just changed. If this wasn\'t you, please secure your account.',
    '<p>This is a confirmation that the email address on your TaskFlow account was just changed. If this wasn\'t you, please secure your account.</p>'
  );
}
