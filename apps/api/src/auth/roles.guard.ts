import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { PrismaService } from '../database/prisma.service';
import { AuthUser } from './auth-user';
import { IS_PUBLIC_KEY, ROLES_KEY } from './decorators';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
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
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    if (!request.user) throw new UnauthorizedException('Authentication required');
    if (roles?.length && !roles.includes(request.user.role))
      throw new ForbiddenException('Insufficient permissions');
    if (
      roles?.some((role) => role === Role.AGENT || role === Role.ADMIN) &&
      request.user.role !== Role.CUSTOMER &&
      !['GET', 'HEAD', 'OPTIONS'].includes(request.method)
    ) {
      const user = await this.prisma.user.findUnique({
        where: { id: request.user.id },
        select: { emailVerifiedAt: true },
      });
      if (!user?.emailVerifiedAt)
        throw new ForbiddenException('Verify your email before staff mutations');
    }
    return true;
  }
}
