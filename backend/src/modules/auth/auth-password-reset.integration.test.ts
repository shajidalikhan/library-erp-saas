import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { RoleModel, UserModel } from '@modules/auth/auth.models';
import { AUTH_CONSTANTS } from '@modules/auth/auth.constants';
import { authService, __testables } from '@modules/auth/auth.service';

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

afterEach(async () => {
  const cols = mongoose.connection.collections;
  for (const k of Object.keys(cols)) {
    await cols[k].deleteMany({});
  }
});

describe('auth password reset', () => {
  const seedUser = async (email: string) => {
    const suffix = crypto.randomBytes(4).toString('hex');
    const role = await RoleModel.create({
      name: `ROLE_${suffix}`,
      permissions: [],
      isSystem: true,
      libraryId: null,
    });
    return UserModel.create({
      fullName: 'Reset User',
      email,
      passwordHash: await UserModel.hashPassword('Password123!'),
      role: role._id,
      libraryId: null,
      branchId: null,
      isActive: true,
      isEmailVerified: true,
      refreshTokens: [
        {
          tokenHash: __testables.hashRefreshToken('session-token'),
          expiresAt: new Date(Date.now() + 60_000),
          createdAt: new Date(),
        },
      ],
    } as never);
  };

  it('returns generic success for unknown and known emails', async () => {
    const email = `known-${crypto.randomBytes(4).toString('hex')}@example.com`;
    await seedUser(email);

    await expect(authService.forgotPassword({ email: 'missing@example.com' })).resolves.toBeUndefined();
    await expect(authService.forgotPassword({ email })).resolves.toBeUndefined();
  });

  it('resets password with a valid token and revokes refresh sessions', async () => {
    const email = `reset-${crypto.randomBytes(4).toString('hex')}@example.com`;
    await seedUser(email);
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = __testables.hashResetToken(rawToken);

    await UserModel.updateOne(
      { email },
      {
        $set: {
          resetPasswordTokenHash: tokenHash,
          resetPasswordExpiresAt: new Date(Date.now() + AUTH_CONSTANTS.RESET_PASSWORD_TTL_MS),
        },
      },
    );

    await authService.resetPassword({ token: rawToken, password: 'NewPassword1' });

    const user = await UserModel.findOne({ email }).select('+passwordHash +refreshTokens');
    expect(user?.refreshTokens).toEqual([]);
    expect(user?.resetPasswordTokenHash ?? null).toBeNull();
    expect(user?.resetPasswordExpiresAt ?? null).toBeNull();
    expect(await user?.comparePassword('NewPassword1')).toBe(true);

    await expect(
      authService.resetPassword({ token: rawToken, password: 'AnotherPass1' }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects expired reset tokens', async () => {
    const email = `expired-${crypto.randomBytes(4).toString('hex')}@example.com`;
    await seedUser(email);
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = __testables.hashResetToken(rawToken);

    await UserModel.updateOne(
      { email },
      {
        $set: {
          resetPasswordTokenHash: tokenHash,
          resetPasswordExpiresAt: new Date(Date.now() - 1_000),
        },
      },
    );

    await expect(
      authService.resetPassword({ token: rawToken, password: 'NewPassword1' }),
    ).rejects.toMatchObject({ statusCode: 400, message: AUTH_CONSTANTS.RESET_PASSWORD_INVALID_MSG });
  });
});
