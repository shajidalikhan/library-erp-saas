import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { ROLES } from '@constants/roles.constants';
import { RoleModel, UserModel } from '@modules/auth/auth.models';
import { authService, __testables } from '@modules/auth/auth.service';
import { EmailTemplateModel } from './email-template.model';
import { emailTemplateService } from './email-template.service';
import { settingsService } from './settings.service';
import { renderEmailTemplate, sanitizeEmailHtml } from './template-render.util';
import type { AuthenticatedUser } from '@/types/express';

let mongo: MongoMemoryServer;

const superAdminUser = (): AuthenticatedUser => ({
  id: new mongoose.Types.ObjectId().toString(),
  fullName: 'Super',
  email: 'super@test.com',
  role: ROLES.SUPER_ADMIN,
  permissions: ['platform.manage'],
  libraryId: null,
  branchId: null,
  studentId: null,
  isActive: true,
});

const staffUser = (): AuthenticatedUser => ({
  id: new mongoose.Types.ObjectId().toString(),
  fullName: 'Staff',
  email: 'staff@test.com',
  role: ROLES.MANAGER,
  permissions: [],
  libraryId: new mongoose.Types.ObjectId().toString(),
  branchId: new mongoose.Types.ObjectId().toString(),
  studentId: null,
  isActive: true,
});

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

afterEach(async () => {
  vi.restoreAllMocks();
  const cols = mongoose.connection.collections;
  for (const k of Object.keys(cols)) {
    await cols[k].deleteMany({});
  }
});

describe('settings email templates', () => {
  it('renders variables safely in HTML', () => {
    const html = renderEmailTemplate('<p>{{fullName}}</p>', { fullName: '<script>x</script>' }, {
      escapeHtmlValues: true,
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('strips script tags from sanitized HTML', () => {
    const clean = sanitizeEmailHtml('<div>ok</div><script>alert(1)</script>');
    expect(clean).not.toContain('<script>');
  });

  it('blocks non-super-admin from email settings', async () => {
    await expect(settingsService.getEmailSettings(staffUser())).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('allows super admin to list and patch templates', async () => {
    const user = superAdminUser();
    await emailTemplateService.seedDefaults(user);
    const list = await emailTemplateService.list(user);
    expect(list.length).toBeGreaterThanOrEqual(6);

    const updated = await emailTemplateService.patch(user, 'forgot_password', {
      subject: 'Custom reset subject',
    });
    expect(updated.subject).toBe('Custom reset subject');

    const rendered = await emailTemplateService.render('forgot_password', {
      fullName: 'Alex',
      resetUrl: 'https://example.com/reset',
      expiresIn: '30 minutes',
    });
    expect(rendered.subject).toBe('Custom reset subject');
    expect(rendered.html).toContain('Alex');
  });
});

describe('auth change password', () => {
  const seedUser = async (email: string, password: string) => {
    const suffix = crypto.randomBytes(4).toString('hex');
    const role = await RoleModel.create({
      name: `ROLE_${suffix}`,
      permissions: [],
      isSystem: true,
      libraryId: null,
    });
    return UserModel.create({
      fullName: 'Change User',
      email,
      passwordHash: await UserModel.hashPassword(password),
      role: role._id,
      libraryId: null,
      branchId: null,
      isActive: true,
      isEmailVerified: true,
      refreshTokens: [
        {
          tokenHash: __testables.hashRefreshToken('keep-session'),
          expiresAt: new Date(Date.now() + 60_000),
          createdAt: new Date(),
        },
        {
          tokenHash: __testables.hashRefreshToken('drop-session'),
          expiresAt: new Date(Date.now() + 60_000),
          createdAt: new Date(),
        },
      ],
    } as never);
  };

  it('fails with wrong current password', async () => {
    const email = `chg-${crypto.randomBytes(4).toString('hex')}@example.com`;
    const user = await seedUser(email, 'Password123!');
    await expect(
      authService.changePassword(String(user._id), {
        currentPassword: 'WrongPass1!',
        newPassword: 'NewPassword1',
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('updates password and keeps only current refresh session when provided', async () => {
    const email = `chg-ok-${crypto.randomBytes(4).toString('hex')}@example.com`;
    const user = await seedUser(email, 'Password123!');
    await authService.changePassword(
      String(user._id),
      { currentPassword: 'Password123!', newPassword: 'NewPassword1' },
      'keep-session',
    );
    const refreshed = await UserModel.findById(user._id).select('+passwordHash +refreshTokens');
    expect(refreshed?.refreshTokens).toHaveLength(1);
    expect(refreshed?.refreshTokens[0]?.tokenHash).toBe(__testables.hashRefreshToken('keep-session'));
    const ok = await refreshed?.comparePassword('NewPassword1');
    expect(ok).toBe(true);
  });
});

describe('email template model seed', () => {
  it('seed defaults creates missing templates only', async () => {
    await EmailTemplateModel.create({
      key: 'forgot_password',
      name: 'Forgot',
      subject: 'S',
      htmlBody: '<p>x</p>',
      textBody: 'x',
      variables: [],
      active: true,
      updatedBy: null,
    });
    const result = await emailTemplateService.seedDefaults(superAdminUser());
    expect(result.created.length).toBeLessThan(6);
  });
});
