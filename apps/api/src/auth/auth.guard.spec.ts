import { describe, expect, it, jest } from '@jest/globals';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuthGuard } from './auth.guard';
import { AuthUser } from './auth-user';

describe('live session authorization', () => {
  const userId = '8d39e3ef-bdab-486e-b65d-6716b6967956';
  const sessionId = 'e9cc6a3b-17b5-4652-be34-fcda115d97a9';
  function fixture(revokedAt: Date | null = null) {
    const request: { headers: { authorization: string }; user?: AuthUser } = {
      headers: { authorization: 'Bearer a.b.c' },
    };
    const context = {
      getClass: () => class TestController {},
      getHandler: () => () => undefined,
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    const reflector = { getAllAndOverride: () => false } as unknown as Reflector;
    const jwt = {
      verifyAsync: jest.fn(async () => ({
        sub: userId,
        sid: sessionId,
        kind: 'access',
        role: 'ADMIN',
      })),
    } as unknown as JwtService;
    const prisma = {
      authSession: {
        findUnique: jest.fn(async () => ({
          id: sessionId,
          userId,
          revokedAt,
          expiresAt: new Date(Date.now() + 60000),
          user: {
            id: userId,
            email: 'synthetic@example.test',
            role: Role.CUSTOMER,
            isActive: true,
          },
        })),
      },
    } as unknown as PrismaService;
    const config = new ConfigService({
      JWT_SECRET: 'test-secret',
      JWT_ISSUER: 'issuer',
      JWT_AUDIENCE: 'audience',
    });
    return { guard: new AuthGuard(reflector, jwt, config, prisma), context, request, jwt };
  }
  it('uses the current database role rather than a role in an old token', async () => {
    const f = fixture();
    await expect(f.guard.canActivate(f.context)).resolves.toBe(true);
    expect(f.request.user?.role).toBe(Role.CUSTOMER);
    expect(f.jwt.verifyAsync).toHaveBeenCalledWith(
      'a.b.c',
      expect.objectContaining({ algorithms: ['HS256'], issuer: 'issuer', audience: 'audience' }),
    );
  });
  it('immediately rejects an access token whose session has been revoked', async () => {
    const f = fixture(new Date());
    await expect(f.guard.canActivate(f.context)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
