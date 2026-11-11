import { describe, expect, it, jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthCookiesService } from './auth-cookies.service';
import { randomToken } from './token.utils';

const request = (origin?: string, cookie?: unknown, header?: string) =>
  ({
    cookies: { csrfToken: cookie },
    get: (name: string) =>
      name === 'origin' ? origin : name === 'x-csrf-token' ? header : undefined,
  }) as unknown as Request;

describe('cookie session protections', () => {
  const config = new ConfigService({
    CORS_ORIGINS: 'http://localhost:3000,https://estate.example',
    NODE_ENV: 'test',
    COOKIE_SECURE: false,
  });
  const service = new AuthCookiesService(config);
  it('requires an exact allowlisted origin for cookie-based authentication', () => {
    expect(() => service.assertOrigin(request('http://localhost:3000'))).not.toThrow();
    for (const origin of [
      undefined,
      'null',
      'http://localhost:3000.attacker.example',
      'https://estate.example.attacker.example',
    ]) {
      expect(() => service.assertOrigin(request(origin))).toThrow(ForbiddenException);
    }
  });
  it('requires a valid matching double-submit cookie and header as well as origin', () => {
    const csrf = randomToken();
    expect(() => service.assertCsrf(request('http://localhost:3000', csrf, csrf))).not.toThrow();
    expect(() => service.assertCsrf(request('http://localhost:3000', csrf, randomToken()))).toThrow(
      ForbiddenException,
    );
    expect(() => service.assertCsrf(request('http://localhost:3000', csrf))).toThrow(
      ForbiddenException,
    );
    expect(() => service.assertCsrf(request('https://attacker.example', csrf, csrf))).toThrow(
      ForbiddenException,
    );
  });
  it('uses host-only secure cookies with the required __Host- attributes in production', () => {
    const secure = new AuthCookiesService(
      new ConfigService({ NODE_ENV: 'production', COOKIE_SECURE: true }),
    );
    const cookie = jest.fn();
    const clearCookie = jest.fn();
    const response = { cookie, clearCookie } as unknown as Response;
    const expires = new Date(Date.now() + 60000);
    const csrf = secure.set(response, randomToken(), expires);
    expect(isFinite(expires.getTime())).toBe(true);
    expect(csrf).toHaveLength(43);
    expect(cookie.mock.calls[0]?.[0]).toBe('__Host-refreshToken');
    expect(cookie.mock.calls[0]?.[2]).toEqual(
      expect.objectContaining({ httpOnly: true, secure: true, sameSite: 'lax', path: '/' }),
    );
    expect(cookie.mock.calls[0]?.[2]).not.toHaveProperty('domain');
    expect(cookie.mock.calls[1]?.[0]).toBe('__Host-csrfToken');
    expect(cookie.mock.calls[1]?.[2]).toEqual(
      expect.objectContaining({ httpOnly: false, secure: true, path: '/' }),
    );
    secure.clear(response);
    expect(clearCookie).toHaveBeenCalledWith(
      '__Host-refreshToken',
      expect.objectContaining({ path: '/', secure: true }),
    );
  });
});
