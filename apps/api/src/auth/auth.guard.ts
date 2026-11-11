import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { PrismaService } from '../database/prisma.service';
import { AuthUser } from './auth-user';
import { IS_PUBLIC_KEY } from './decorators';

interface AccessClaims {
  sub?: unknown;
  sid?: unknown;
  kind?: unknown;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(
      request.headers.authorization ?? '',
    );
    if (!match?.[1]) throw new UnauthorizedException('Authentication required');
    let claims: AccessClaims;
    try {
      claims = await this.jwt.verifyAsync<AccessClaims>(match[1], {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
        algorithms: ['HS256'],
        issuer: this.config.getOrThrow<string>('JWT_ISSUER'),
        audience: this.config.getOrThrow<string>('JWT_AUDIENCE'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired session');
    }
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (
      claims.kind !== 'access' ||
      typeof claims.sub !== 'string' ||
      typeof claims.sid !== 'string' ||
      !uuid.test(claims.sub) ||
      !uuid.test(claims.sid)
    ) {
      throw new UnauthorizedException('Invalid or expired session');
    }
    const session = await this.prisma.authSession.findUnique({
      where: { id: claims.sid },
      select: {
        id: true,
        userId: true,
        revokedAt: true,
        expiresAt: true,
        user: { select: { id: true, email: true, role: true, isActive: true } },
      },
    });
    if (
      !session ||
      session.userId !== claims.sub ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      !session.user.isActive
    )
      throw new UnauthorizedException('Invalid or expired session');
    request.user = {
      id: session.user.id,
      email: session.user.email,
      role: session.user.role,
      sessionId: session.id,
    };
    return true;
  }
}
