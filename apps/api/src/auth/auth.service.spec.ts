import { describe, expect, it, jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Prisma, Role, TokenPurpose } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { MailService } from '../mail/mail.service';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { hashToken, randomToken } from './token.utils';

function fixture(
  options: { revoked?: boolean; credentialCount?: number; consumeCount?: number } = {},
) {
  const familyId = 'b76019c9-416e-4ea6-8db3-691dc92d6b0f';
  const user = {
    id: '8d39e3ef-bdab-486e-b65d-6716b6967956',
    email: 'synthetic@example.test',
    firstName: 'Synthetic',
    lastName: 'User',
    role: Role.CUSTOMER,
    isActive: true,
    emailVerifiedAt: new Date(),
    passwordHash: 'a-password-hash',
  };
  const current = {
    id: 'e9cc6a3b-17b5-4652-be34-fcda115d97a9',
    userId: user.id,
    familyId,
    tokenHash: '',
    revokedAt: options.revoked ? new Date() : null,
    expiresAt: new Date(Date.now() + 60000),
    user,
  };
  const updateSessions = jest.fn(async (input: Prisma.AuthSessionUpdateManyArgs) => ({
    count: input.where?.id ? (options.consumeCount ?? 1) : 1,
  }));
  const createSession = jest.fn(async (_input: Prisma.AuthSessionCreateArgs) => ({
    id: 'e00d81b0-80a5-4fcb-bda0-3ee913f0ef3d',
    expiresAt: current.expiresAt,
  }));
  const tx = {
    authSession: {
      findUnique: jest.fn(async (_input: Prisma.AuthSessionFindUniqueArgs) => current),
      updateMany: updateSessions,
      create: createSession,
    },
    user: { updateMany: jest.fn(async () => ({ count: options.credentialCount ?? 1 })) },
  };
  let committed = false;
  const prisma = {
    $transaction: async <T>(action: (db: Prisma.TransactionClient) => Promise<T>) => {
      const result = await action(tx as unknown as Prisma.TransactionClient);
      committed = true;
      return result;
    },
  } as unknown as PrismaService;
  const jwt = { signAsync: jest.fn(async () => 'signed-access-token') } as unknown as JwtService;
  const audit = { record: jest.fn(async () => undefined) } as unknown as AuditService;
  const config = new ConfigService({
    ACCESS_TOKEN_TTL_SECONDS: 900,
    JWT_SECRET: 'test-only-secret',
    JWT_ISSUER: 'issuer',
    JWT_AUDIENCE: 'audience',
  });
  const service = new AuthService(
    prisma,
    config,
    jwt,
    {} as PasswordService,
    {} as MailService,
    audit,
  );
  return { service, tx, createSession, updateSessions, jwt, familyId, committed: () => committed };
}

describe('refresh token transaction policy', () => {
  it('stores and queries a digest, consumes once and returns a fresh token', async () => {
    const f = fixture();
    const token = randomToken();
    const result = await f.service.refresh(token);
    expect(f.tx.authSession.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });
    expect(result.refreshToken).not.toBe(token);
    expect(f.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          familyId: f.familyId,
          tokenHash: hashToken(result.refreshToken),
        }),
      }),
    );
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(f.jwt.signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'access' }),
      expect.objectContaining({
        algorithm: 'HS256',
        issuer: 'issuer',
        audience: 'audience',
        expiresIn: 900,
      }),
    );
  });
  it('commits family revocation before rejecting a replayed refresh token', async () => {
    const f = fixture({ revoked: true });
    await expect(f.service.refresh(randomToken())).rejects.toBeInstanceOf(UnauthorizedException);
    expect(f.committed()).toBe(true);
    expect(f.updateSessions).toHaveBeenCalledWith({
      where: { familyId: f.familyId, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(f.createSession).not.toHaveBeenCalled();
  });
  it('treats a lost atomic-consumption race as replay and never creates another session', async () => {
    const f = fixture({ consumeCount: 0 });
    await expect(f.service.refresh(randomToken())).rejects.toBeInstanceOf(UnauthorizedException);
    expect(f.committed()).toBe(true);
    expect(f.updateSessions).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { familyId: f.familyId, revokedAt: null } }),
    );
    expect(f.createSession).not.toHaveBeenCalled();
  });
  it('fails closed when credentials change during refresh', async () => {
    const f = fixture({ credentialCount: 0 });
    await expect(f.service.refresh(randomToken())).rejects.toBeInstanceOf(UnauthorizedException);
    expect(f.createSession).not.toHaveBeenCalled();
  });
  it('rejects malformed refresh values without running a transaction', async () => {
    const f = fixture();
    await expect(f.service.refresh(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(f.committed()).toBe(false);
  });
});

describe('single-use email tokens', () => {
  function tokenFixture(
    options: {
      consumeCount?: number;
      used?: boolean;
      expired?: boolean;
      purpose?: TokenPurpose;
    } = {},
  ) {
    const token = {
      id: 'e9cc6a3b-17b5-4652-be34-fcda115d97a9',
      userId: '8d39e3ef-bdab-486e-b65d-6716b6967956',
      purpose: options.purpose ?? TokenPurpose.VERIFY_EMAIL,
      usedAt: options.used ? new Date() : null,
      expiresAt: new Date(Date.now() + (options.expired ? -60000 : 60000)),
    };
    const consume = jest.fn(async (_input: Prisma.OneTimeTokenUpdateManyArgs) => ({
      count: options.consumeCount ?? 1,
    }));
    const tx = {
      $queryRaw: jest.fn(async () => []),
      oneTimeToken: {
        findUnique: jest.fn(async (_input: Prisma.OneTimeTokenFindUniqueArgs) => token),
        updateMany: consume,
      },
      user: { updateMany: jest.fn(async () => ({ count: 1 })) },
    };
    let committed = false;
    const prisma = {
      $transaction: async <T>(action: (db: Prisma.TransactionClient) => Promise<T>) => {
        const value = await action(tx as unknown as Prisma.TransactionClient);
        committed = true;
        return value;
      },
    } as unknown as PrismaService;
    const audit = { record: jest.fn(async () => undefined) } as unknown as AuditService;
    const service = new AuthService(
      prisma,
      new ConfigService(),
      {} as JwtService,
      {} as PasswordService,
      {} as MailService,
      audit,
    );
    return { service, tx, consume, committed: () => committed };
  }

  it('looks up a digest and verifies email only after one atomic consumption', async () => {
    const f = tokenFixture();
    const rawToken = randomToken();
    await expect(f.service.verifyEmail(rawToken)).resolves.toEqual({ message: 'Email verified.' });
    expect(f.tx.oneTimeToken.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashToken(rawToken) },
    });
    expect(f.consume).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          usedAt: null,
          purpose: TokenPurpose.VERIFY_EMAIL,
          expiresAt: { gt: expect.any(Date) },
        }),
      }),
    );
    expect(f.committed()).toBe(true);
  });

  it('rejects an already-used, expired, or wrong-purpose token without changing the user', async () => {
    for (const options of [
      { used: true },
      { expired: true },
      { purpose: TokenPurpose.RESET_PASSWORD },
    ]) {
      const f = tokenFixture(options);
      await expect(f.service.verifyEmail(randomToken())).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(f.tx.user.updateMany).not.toHaveBeenCalled();
      expect(f.committed()).toBe(false);
    }
  });

  it('rejects a token consumed concurrently without changing the user', async () => {
    const f = tokenFixture({ consumeCount: 0 });
    await expect(f.service.verifyEmail(randomToken())).rejects.toBeInstanceOf(BadRequestException);
    expect(f.tx.user.updateMany).not.toHaveBeenCalled();
    expect(f.committed()).toBe(false);
  });
});
