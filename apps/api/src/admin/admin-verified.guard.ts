import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser } from '../auth/auth-user';
import { PrismaService } from '../database/prisma.service';
@Injectable()
export class AdminVerifiedGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}
  async canActivate(context: ExecutionContext) {
    const actor = context.switchToHttp().getRequest<{ user?: AuthUser }>().user;
    if (!actor || actor.role !== Role.ADMIN)
      throw new ForbiddenException('Administrator access required');
    const valid = await this.prisma.user.findFirst({
      where: { id: actor.id, role: Role.ADMIN, isActive: true, emailVerifiedAt: { not: null } },
      select: { id: true },
    });
    if (!valid) throw new ForbiddenException('Verified administrator access required');
    return true;
  }
}
