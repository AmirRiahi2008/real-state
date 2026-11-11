import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser } from '../auth/auth-user';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { paginated } from '../common/pagination.dto';
import { UpdateOwnProfileDto, UpdateUserAccessDto, UsersQueryDto } from './users.dto';
import { safeUserSelect, UsersRepository } from './users.repository';

export function assertAdminPreserved(
  current: { role: Role; isActive: boolean; emailVerifiedAt: Date | null },
  patch: UpdateUserAccessDto,
  activeVerifiedAdmins: number,
): void {
  const currentlyAdmin =
    current.role === Role.ADMIN && current.isActive && current.emailVerifiedAt !== null;
  const remainsAdmin =
    (patch.role ?? current.role) === Role.ADMIN && (patch.isActive ?? current.isActive);
  if (currentlyAdmin && !remainsAdmin && activeVerifiedAdmins <= 1)
    throw new ConflictException(
      'The last active verified administrator cannot be disabled or demoted',
    );
}

@Injectable()
export class UsersService {
  constructor(
    private readonly repository: UsersRepository,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}
  async list(query: UsersQueryDto) {
    const [data, total] = await this.repository.list(query);
    return paginated(data, total, query.page, query.limit);
  }
  async updateAccess(id: string, dto: UpdateUserAccessDto, actor: AuthUser) {
    if (dto.role === undefined && dto.isActive === undefined)
      throw new BadRequestException('Provide role or isActive');
    return this.prisma.$transaction(async (db) => {
      // Every access transition takes this transaction-scoped lock. Two administrators
      // cannot concurrently demote one another and leave no administrative account.
      await db.$executeRaw`SELECT pg_advisory_xact_lock(86602)`;
      const current = await db.user.findUnique({ where: { id }, select: safeUserSelect });
      if (!current) throw new NotFoundException('User not found');
      const adminCount = await db.user.count({
        where: { role: Role.ADMIN, isActive: true, emailVerifiedAt: { not: null } },
      });
      assertAdminPreserved(current, dto, adminCount);
      const changed =
        (dto.role !== undefined && dto.role !== current.role) ||
        (dto.isActive !== undefined && dto.isActive !== current.isActive);
      const user = await db.user.update({ where: { id }, data: dto, select: safeUserSelect });
      if (changed) {
        await db.authSession.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await this.audit.record(
          actor.id,
          'user.access-update',
          'User',
          id,
          { previousRole: current.role, role: user.role, isActive: user.isActive },
          db,
        );
      }
      return user;
    });
  }
  async updateProfile(dto: UpdateOwnProfileDto, actor: AuthUser) {
    if (dto.firstName === undefined && dto.lastName === undefined)
      throw new BadRequestException('Provide firstName or lastName');
    return this.prisma.$transaction(async (db) => {
      const user = await db.user.update({
        where: { id: actor.id },
        data: dto,
        select: safeUserSelect,
      });
      await this.audit.record(actor.id, 'user.profile-update', 'User', actor.id, {}, db);
      return user;
    });
  }
}
