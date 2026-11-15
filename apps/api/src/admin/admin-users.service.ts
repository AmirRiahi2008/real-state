import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser } from '../auth/auth-user';
import { PasswordService } from '../auth/password.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { safeUserSelect } from '../users/users.repository';
import { AdminResetPasswordDto, CreateAdminUserDto } from './admin.dto';
@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
  ) {}
  async session(actor: AuthUser) {
    const user = await this.prisma.user.findFirst({
      where: { id: actor.id, role: Role.ADMIN, isActive: true, emailVerifiedAt: { not: null } },
      select: safeUserSelect,
    });
    if (!user) throw new NotFoundException('Administrator not found');
    return { user };
  }
  async create(dto: CreateAdminUserDto, actor: AuthUser) {
    const passwordHash = await this.passwords.hash(dto.password);
    return this.prisma.$transaction(async (db) => {
      await db.$executeRaw`SELECT pg_advisory_xact_lock(86602)`;
      if (await db.user.findUnique({ where: { email: dto.email }, select: { id: true } }))
        throw new BadRequestException('An account with this email already exists');
      const user = await db.user.create({
        data: {
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: dto.role,
          isActive: dto.isActive ?? true,
          emailVerifiedAt: new Date(),
        },
        select: safeUserSelect,
      });
      await this.audit.record(
        actor.id,
        'admin.user-create',
        'User',
        user.id,
        { role: user.role },
        db,
      );
      return user;
    });
  }
  async resetPassword(id: string, dto: AdminResetPasswordDto, actor: AuthUser) {
    const passwordHash = await this.passwords.hash(dto.newPassword);
    await this.prisma.$transaction(async (db) => {
      await db.$executeRaw`SELECT pg_advisory_xact_lock(86602)`;
      if (!(await db.user.findUnique({ where: { id }, select: { id: true } })))
        throw new NotFoundException('User not found');
      await db.user.update({ where: { id }, data: { passwordHash } });
      await db.authSession.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await db.oneTimeToken.updateMany({
        where: { userId: id, usedAt: null },
        data: { usedAt: new Date() },
      });
      await this.audit.record(actor.id, 'admin.password-reset', 'User', id, {}, db);
    });
    return { message: 'Password updated. All existing sessions were revoked.' };
  }
}
