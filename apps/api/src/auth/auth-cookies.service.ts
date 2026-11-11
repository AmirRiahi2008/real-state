import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CookieOptions, Request, Response } from 'express';
import { constantTimeTokenEqual, isOpaqueToken, randomToken } from './token.utils';

@Injectable()
export class AuthCookiesService {
  constructor(private readonly config: ConfigService) {}
  private get secure(): boolean {
    return (
      this.config.get<boolean>('COOKIE_SECURE') === true ||
      this.config.get<string>('NODE_ENV') === 'production'
    );
  }
  get refreshName(): string {
    return this.secure ? '__Host-refreshToken' : 'refreshToken';
  }
  get csrfName(): string {
    return this.secure ? '__Host-csrfToken' : 'csrfToken';
  }
  private options(httpOnly: boolean): CookieOptions {
    return { httpOnly, secure: this.secure, sameSite: 'lax', path: '/' };
  }

  assertOrigin(request: Request): void {
    const allowed = this.config
      .getOrThrow<string>('CORS_ORIGINS')
      .split(',')
      .map((origin) => origin.trim());
    const origin = request.get('origin');
    if (!origin || !allowed.includes(origin))
      throw new ForbiddenException('Request origin is not allowed');
  }
  assertCsrf(request: Request): void {
    this.assertOrigin(request);
    const cookies = request.cookies as Record<string, unknown> | undefined;
    if (!constantTimeTokenEqual(cookies?.[this.csrfName], request.get('x-csrf-token')))
      throw new ForbiddenException('CSRF validation failed');
  }
  refreshToken(request: Request): string | undefined {
    const cookies = request.cookies as Record<string, unknown> | undefined;
    const token = cookies?.[this.refreshName];
    return isOpaqueToken(token) ? token : undefined;
  }
  set(response: Response, refreshToken: string, expiresAt: Date): string {
    const csrfToken = randomToken();
    const maxAge = Math.max(0, expiresAt.getTime() - Date.now());
    response.cookie(this.refreshName, refreshToken, {
      ...this.options(true),
      expires: expiresAt,
      maxAge,
    });
    response.cookie(this.csrfName, csrfToken, {
      ...this.options(false),
      expires: expiresAt,
      maxAge,
    });
    return csrfToken;
  }
  clear(response: Response): void {
    response.clearCookie(this.refreshName, this.options(true));
    response.clearCookie(this.csrfName, this.options(false));
  }
}
