import 'dotenv/config'; 
import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });

  return transporter;
}

/**
 * Sends an email via SMTP. Falls back to console.log when SMTP is not configured — this lets dev and test exercise the full flow without a live mail server. In production, a missing SMTP config is a hard error.
 *
 *   await sendMail({
 *     to: 'user@example.com',
 *     subject: 'Verify your email',
 *     html: '<p>...</p>',
 *   });
 */
export default async function sendMail({ to, subject, html }) {
  const t = getTransporter();

  if (!t) {
    if (process.env.ENV === 'test') return;
    
    if (process.env.ENV === 'production') {
      throw new Error('SMTP is not configured in production');
    }
    console.log('\n--- [DEV] Outgoing mail ---');
    console.log('To: ', to);
    console.log('Subject: ', subject);
    console.log('Body: ', html.replace(/\s+/g, ' ').trim());
    console.log('--- end mail ---\n');
    return;
  }

  await t.sendMail({
    from: process.env.MAIL_FROM || process.env.NOTIFICATION_MAIL,
    to,
    subject,
    html,
  });
}