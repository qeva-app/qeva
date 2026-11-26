import nodemailer from 'nodemailer';
import logger from './logger';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_SERVER_HOST || 'smtp.sendgrid.net',
      port: parseInt(process.env.EMAIL_SERVER_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.EMAIL_SERVER_USER || 'apikey',
        pass: process.env.EMAIL_SERVER_PASSWORD,
      },
    });
  }
  return transporter;
}

export async function sendOTPEmail(
  email: string,
  otp: string,
  type: 'verification' | 'reset' = 'verification'
): Promise<void> {
  const subject =
    type === 'verification'
      ? 'Qeva — Email Verification Code'
      : 'Qeva — Password Reset Code';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0; padding:0; background-color:#f1f5f9; font-family:'Inter',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9; padding:40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 6px rgba(0,0,0,0.1);">
              <tr>
                <td style="background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); padding:32px; text-align:center;">
                  <h1 style="color:#ffffff; margin:0; font-size:28px; font-weight:700;">🔐 Qeva</h1>
                  <p style="color:#93c5fd; margin:8px 0 0; font-size:14px;">Enterprise Password Manager</p>
                </td>
              </tr>
              <tr>
                <td style="padding:40px 32px;">
                  <h2 style="color:#1e293b; margin:0 0 16px; font-size:22px;">
                    ${type === 'verification' ? 'Verify Your Email' : 'Reset Your Password'}
                  </h2>
                  <p style="color:#64748b; margin:0 0 24px; font-size:15px; line-height:1.6;">
                    ${type === 'verification'
                      ? 'Use the code below to verify your email address and complete your registration.'
                      : 'Use the code below to reset your password.'}
                  </p>
                  <div style="background-color:#f8fafc; border:2px dashed #e2e8f0; border-radius:12px; padding:24px; text-align:center; margin:0 0 24px;">
                    <span style="font-family:'JetBrains Mono',monospace; font-size:36px; font-weight:700; letter-spacing:8px; color:#1e3a5f;">
                      ${otp}
                    </span>
                  </div>
                  <p style="color:#94a3b8; margin:0; font-size:13px;">
                    ⏱ This code expires in <strong>5 minutes</strong>. Do not share this code with anyone.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="background-color:#f8fafc; padding:20px 32px; text-align:center;">
                  <p style="color:#94a3b8; margin:0; font-size:12px;">
                    &copy; ${new Date().getFullYear()} Qeva. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  try {
    await getTransporter().sendMail({
      from: process.env.EMAIL_FROM || 'noreply@qeva.local',
      to: email,
      subject,
      html,
    });
    logger.info('OTP email sent', { email, type });
  } catch (error) {
    logger.error('Failed to send OTP email', { email, type, error });
    throw new Error('Failed to send verification email');
  }
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  try {
    await getTransporter().sendMail({
      from: process.env.EMAIL_FROM || 'noreply@qeva.local',
      to,
      subject,
      html,
    });
  } catch (error) {
    logger.error('Failed to send email', { to, subject, error });
    throw new Error('Failed to send email');
  }
}

/** Org invite — activation link only; never include a password. */
export async function sendInviteEmail(params: {
  to: string;
  name: string;
  orgName: string;
  roleName: string;
  activateUrl: string;
}): Promise<void> {
  const { to, name, orgName, roleName, activateUrl } = params;
  const html = `
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
        <tr><td align="center">
          <table width="560" style="background:#fff;border-radius:12px;overflow:hidden;">
            <tr><td style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:28px;text-align:center;">
              <h1 style="color:#fff;margin:0;font-size:24px;">Qeva</h1>
            </td></tr>
            <tr><td style="padding:32px;">
              <p style="color:#1e293b;font-size:16px;margin:0 0 12px;">Hi ${name},</p>
              <p style="color:#64748b;font-size:15px;line-height:1.6;margin:0 0 20px;">
                You've been invited to <strong>${orgName}</strong> on Qeva as <strong>${roleName}</strong>.
                Activate your account to choose a password and sign in.
              </p>
              <p style="text-align:center;margin:28px 0;">
                <a href="${activateUrl}"
                   style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;
                          padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px;">
                  Activate account
                </a>
              </p>
              <p style="color:#94a3b8;font-size:12px;line-height:1.5;margin:0;">
                This link expires in 7 days. If the button doesn't work, paste this URL into your browser:<br/>
                <span style="word-break:break-all;color:#64748b;">${activateUrl}</span>
              </p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;
  await sendEmail(to, `You're invited to ${orgName} on Qeva`, html);
}

export async function sendRawEmail(
  to: string,
  subject: string,
  text: string
): Promise<void> {
  try {
    await getTransporter().sendMail({
      from: process.env.EMAIL_FROM || 'noreply@qeva.local',
      to,
      subject,
      text,
    });
  } catch (error) {
    logger.error('Failed to send raw email', { to, subject, error });
    throw new Error('Failed to send email');
  }
}
