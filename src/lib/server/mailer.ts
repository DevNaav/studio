/**
 * Sends email through any SMTP account (free options: a Gmail account with an
 * "App password", or Brevo's free plan). Set these in Vercel → Settings →
 * Environment Variables:
 *
 *   SMTP_HOST   e.g. smtp.gmail.com  or  smtp-relay.brevo.com
 *   SMTP_PORT   465 (SSL) or 587
 *   SMTP_USER   the login (your Gmail address, or Brevo's SMTP login)
 *   SMTP_PASS   the app password / SMTP key (never your normal password)
 *   MAIL_FROM   optional, e.g. "Inventra <you@gmail.com>" (defaults to SMTP_USER)
 *
 * If they are missing, sending is skipped and the caller is told email isn't set up.
 */
import 'server-only';
import nodemailer, { type Transporter } from 'nodemailer';

export function isMailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

let transporter: Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 465);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

export async function sendMail(message: {
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
}): Promise<void> {
  if (!isMailConfigured()) throw new Error('Email is not set up (SMTP settings are missing).');
  await getTransporter().sendMail({
    from: process.env.MAIL_FROM || `Inventra <${process.env.SMTP_USER}>`,
    ...message,
  });
}
