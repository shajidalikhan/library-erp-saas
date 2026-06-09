import type { EmailTemplateKey } from './email-template.constants';

export type DefaultEmailTemplate = {
  key: EmailTemplateKey;
  name: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  variables: string[];
};

export const DEFAULT_EMAIL_TEMPLATES: DefaultEmailTemplate[] = [
  {
    key: 'forgot_password',
    name: 'Forgot password',
    subject: 'Reset your Library ERP password',
    variables: ['fullName', 'resetUrl', 'expiresIn'],
    textBody:
      'Hi {{fullName}},\n\nReset your password: {{resetUrl}}\n\nThis link expires in {{expiresIn}}.\n\nIf you did not request this, ignore this email.',
    htmlBody: [
      '<div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827;max-width:560px;margin:0 auto;padding:24px;">',
      '<h1 style="font-size:20px;margin:0 0 12px;">Reset your password</h1>',
      '<p style="margin:0 0 16px;">Hi {{fullName}}, we received a request to reset your Library ERP password.</p>',
      '<p style="margin:0 0 20px;">',
      '<a href="{{resetUrl}}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600;">Reset password</a>',
      '</p>',
      '<p style="margin:0;color:#6b7280;font-size:13px;">This link expires in {{expiresIn}}. If you did not request a reset, you can ignore this email.</p>',
      '</div>',
    ].join(''),
  },
  {
    key: 'demo_request_received',
    name: 'Demo request received',
    subject: 'New demo request - {{libraryName}}',
    variables: [
      'fullName',
      'phone',
      'email',
      'libraryName',
      'city',
      'branchCount',
      'studentCount',
      'currentSystem',
      'interestedFeatures',
      'notes',
      'submittedAt',
    ],
    textBody:
      'New demo request\n\nName: {{fullName}}\nEmail: {{email}}\nPhone: {{phone}}\nLibrary: {{libraryName}}\nCity: {{city}}\nBranches: {{branchCount}}\nStudents: {{studentCount}}\nSystem: {{currentSystem}}\nFeatures: {{interestedFeatures}}\nNotes: {{notes}}\nSubmitted: {{submittedAt}}',
    htmlBody: [
      '<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:640px;margin:0 auto;padding:24px;">',
      '<h1 style="font-size:20px;margin:0 0 16px;">New demo request — {{libraryName}}</h1>',
      '<p><strong>Name:</strong> {{fullName}}</p>',
      '<p><strong>Email:</strong> {{email}}</p>',
      '<p><strong>Phone:</strong> {{phone}}</p>',
      '<p><strong>City:</strong> {{city}}</p>',
      '<p><strong>Branches:</strong> {{branchCount}} · <strong>Students:</strong> {{studentCount}}</p>',
      '<p><strong>Current system:</strong> {{currentSystem}}</p>',
      '<p><strong>Interested features:</strong> {{interestedFeatures}}</p>',
      '<p><strong>Notes:</strong> {{notes}}</p>',
      '<p style="color:#6b7280;font-size:13px;">Submitted at {{submittedAt}}</p>',
      '</div>',
    ].join(''),
  },
  {
    key: 'payment_reminder',
    name: 'Payment reminder',
    subject: 'Payment reminder for {{libraryName}}',
    variables: ['fullName', 'amount', 'dueDate', 'invoiceNumber', 'libraryName'],
    textBody:
      'Hi {{fullName}},\n\nReminder: payment of {{amount}} for invoice {{invoiceNumber}} is due on {{dueDate}}.\n\n— {{libraryName}}',
    htmlBody:
      '<div style="font-family:Arial,sans-serif;max-width:560px;padding:24px;"><h1>Payment reminder</h1><p>Hi {{fullName}},</p><p>Payment of <strong>{{amount}}</strong> for invoice <strong>{{invoiceNumber}}</strong> is due on {{dueDate}}.</p><p>— {{libraryName}}</p></div>',
  },
  {
    key: 'invoice_due',
    name: 'Invoice due',
    subject: 'Invoice {{invoiceNumber}} is due',
    variables: ['fullName', 'invoiceNumber', 'dueAmount', 'dueDate', 'libraryName'],
    textBody:
      'Hi {{fullName}},\n\nInvoice {{invoiceNumber}} with balance {{dueAmount}} is due on {{dueDate}}.\n\n— {{libraryName}}',
    htmlBody:
      '<div style="font-family:Arial,sans-serif;max-width:560px;padding:24px;"><h1>Invoice due</h1><p>Hi {{fullName}}, invoice <strong>{{invoiceNumber}}</strong> ({{dueAmount}}) is due on {{dueDate}}.</p><p>— {{libraryName}}</p></div>',
  },
  {
    key: 'tenant_suspended',
    name: 'Tenant suspended',
    subject: 'Library access suspended',
    variables: ['fullName', 'libraryName', 'reason', 'supportEmail'],
    textBody:
      'Hi {{fullName}},\n\nAccess for {{libraryName}} has been suspended.\nReason: {{reason}}\n\nContact {{supportEmail}} for help.',
    htmlBody:
      '<div style="font-family:Arial,sans-serif;max-width:560px;padding:24px;"><h1>Access suspended</h1><p>Hi {{fullName}}, access for <strong>{{libraryName}}</strong> has been suspended.</p><p>{{reason}}</p><p>Contact <a href="mailto:{{supportEmail}}">{{supportEmail}}</a>.</p></div>',
  },
  {
    key: 'welcome_user',
    name: 'Welcome user',
    subject: 'Welcome to Library ERP',
    variables: ['fullName', 'loginUrl', 'roleName', 'libraryName'],
    textBody:
      'Hi {{fullName}},\n\nWelcome to Library ERP{{libraryName}}.\n\nSign in: {{loginUrl}}\nRole: {{roleName}}',
    htmlBody:
      '<div style="font-family:Arial,sans-serif;max-width:560px;padding:24px;"><h1>Welcome to Library ERP</h1><p>Hi {{fullName}},</p><p>Your {{roleName}} account is ready{{libraryName}}.</p><p><a href="{{loginUrl}}">Sign in</a></p></div>',
  },
];
