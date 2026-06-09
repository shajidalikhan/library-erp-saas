import nodemailer from 'nodemailer';

import { ENV } from '@config/env.config';
import { logger } from '@utils/logger';
import { emailTemplateService } from '@modules/settings/email-template.service';
import type { EmailTemplateKey } from '@modules/settings/email-template.constants';

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

const getTransport = () => {
  if (!ENV.SMTP_CONFIGURED) return null;
  return nodemailer.createTransport({
    host: ENV.SMTP_HOST,
    port: ENV.SMTP_PORT,
    secure: ENV.SMTP_SECURE_EFFECTIVE,
    auth: {
      user: ENV.SMTP_USER,
      pass: ENV.SMTP_PASS,
    },
    /** Avoid hanging indefinitely when SMTP is misconfigured (e.g. tests / bad networks). */
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 12_000,
  });
};

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const transport = getTransport();
  if (!transport) {
    if (!ENV.IS_PROD) {
      logger.info(`[email:dev] To: ${input.to} | Subject: ${input.subject}`);
    }
    return;
  }

  await transport.sendMail({
    from: ENV.SMTP_FROM || ENV.SMTP_USER,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
}

async function sendTemplatedEmail(
  to: string,
  templateKey: EmailTemplateKey,
  vars: Record<string, string>,
): Promise<void> {
  const rendered = await emailTemplateService.render(templateKey, vars);

  if (!ENV.SMTP_CONFIGURED && !ENV.IS_PROD) {
    logger.info(`[email:dev] To: ${to} | Subject: ${rendered.subject}\n${rendered.text}`);
  }

  await sendEmail({
    to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  });
}

export async function sendDemoRequestNotificationEmail(
  to: string,
  input: {
    fullName: string;
    email: string;
    phone: string;
    libraryName: string;
    city: string;
    branchCount: number;
    studentCount: number;
    currentSystem: string;
    interestedFeatures: string[];
    notes: string;
    submittedAt: Date;
  },
): Promise<void> {
  const features = input.interestedFeatures.length ? input.interestedFeatures.join(', ') : '—';
  await sendTemplatedEmail(to, 'demo_request_received', {
    fullName: input.fullName,
    email: input.email,
    phone: input.phone,
    libraryName: input.libraryName,
    city: input.city,
    branchCount: String(input.branchCount),
    studentCount: String(input.studentCount),
    currentSystem: input.currentSystem || '—',
    interestedFeatures: features,
    notes: input.notes || '—',
    submittedAt: input.submittedAt.toISOString(),
  });
}

export async function sendPasswordResetEmail(
  to: string,
  fullName: string,
  resetUrl: string,
): Promise<void> {
  await sendTemplatedEmail(to, 'forgot_password', {
    fullName: fullName || 'there',
    resetUrl,
    expiresIn: '30 minutes',
  });
}

export async function sendWelcomeUserEmail(
  to: string,
  input: { fullName: string; loginUrl: string; roleName: string; libraryName?: string },
): Promise<void> {
  const librarySuffix = input.libraryName ? ` at ${input.libraryName}` : '';
  await sendTemplatedEmail(to, 'welcome_user', {
    fullName: input.fullName,
    loginUrl: input.loginUrl,
    roleName: input.roleName,
    libraryName: librarySuffix,
  });
}

export async function sendTenantSuspendedEmail(
  to: string,
  input: { fullName: string; libraryName: string; reason: string; supportEmail: string },
): Promise<void> {
  await sendTemplatedEmail(to, 'tenant_suspended', {
    fullName: input.fullName,
    libraryName: input.libraryName,
    reason: input.reason,
    supportEmail: input.supportEmail,
  });
}
