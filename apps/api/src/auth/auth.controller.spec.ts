import { describe, expect, it, jest } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { Request, Response } from 'express';
import { AuthCookiesService } from './auth-cookies.service';
import { AuthController } from './auth.controller';
import { AuthResult, AuthService } from './auth.service';
import { randomToken } from './token.utils';

const request = (headers: Record<string, string> = {}, cookies: Record<string, string> = {}) =>
  ({ get: (name: string) => headers[name], cookies }) as unknown as Request;

describe('authentication HTTP boundaries', () => {
  const cookies = new AuthCookiesService(
    new ConfigService({
      CORS_ORIGINS: 'http://localhost:3000',
      NODE_ENV: 'test',
      COOKIE_SECURE: false,
    }),
  );
  const dto = { email: 'synthetic@example.test', password: 'synthetic-password' };
  const result: AuthResult = {
    accessToken: 'access-token',
    tokenType: 'Bearer',
    expiresIn: 900,
    user: {
      id: 'user-id',
      email: dto.email,
      firstName: 'Synthetic',
      lastName: 'User',
      role: Role.CUSTOMER,
      emailVerified: true,
    },
    refreshToken: randomToken(),
    expiresAt: new Date(Date.now() + 60000),
  };

  it('rejects a login request before checking credentials when Origin is missing', async () => {
    const login = jest.fn(async () => result);
    const controller = new AuthController({ login } as unknown as AuthService, cookies);
    await expect(controller.login(dto, request(), {} as Response)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(login).not.toHaveBeenCalled();
  });

  it('sets the refresh cookie while returning only the access and CSRF tokens in JSON', async () => {
    const login = jest.fn(async () => result);
    const controller = new AuthController({ login } as unknown as AuthService, cookies);
    const response = { cookie: jest.fn() } as unknown as Response;
    const body = await controller.login(
      dto,
      request({ origin: 'http://localhost:3000' }),
      response,
    );
    expect(body.accessToken).toBe(result.accessToken);
    expect(body.csrfToken).toHaveLength(43);
    expect(body).not.toHaveProperty('refreshToken');
    expect(body).not.toHaveProperty('expiresAt');
    expect(response.cookie).toHaveBeenCalledWith(
      'refreshToken',
      result.refreshToken,
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it('rejects missing CSRF before consuming or rotating the refresh session', async () => {
    const refresh = jest.fn(async () => result);
    const controller = new AuthController({ refresh } as unknown as AuthService, cookies);
    await expect(
      controller.refresh(
        request({ origin: 'http://localhost:3000' }, { refreshToken: result.refreshToken }),
        {} as Response,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(refresh).not.toHaveBeenCalled();
  });
});
