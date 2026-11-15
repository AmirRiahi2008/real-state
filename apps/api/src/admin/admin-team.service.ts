import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { AuthUser } from '../auth/auth-user';
import { PasswordService } from '../auth/password.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { paginated } from '../common/pagination.dto';
import { safeUserSelect } from '../users/users.repository';
import { presentTeamMember, teamMemberSelect } from '../team/team.policy';
import { AdminQueryDto, CreateAdminTeamDto, UpdateAdminTeamDto } from './admin.dto';
const select = {
  ...teamMemberSelect,
  userId: true,
  isPublic: true,
  createdAt: true,
  user: { select: safeUserSelect },
} satisfies Prisma.TeamProfileSelect;
type Profile = Prisma.TeamProfileGetPayload<{ select: typeof select }>;
const present = (row: Profile) => ({ ...row, ...presentTeamMember(row) });
@Injectable()
export class AdminTeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly passwords: PasswordService,
  ) {}
  async list(q: AdminQueryDto) {
    const where: Prisma.TeamProfileWhereInput = q.q
      ? {
          OR: [
            { displayName: { contains: q.q, mode: 'insensitive' } },
            { user: { email: { contains: q.q, mode: 'insensitive' } } },
          ],
        }
      : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.teamProfile.findMany({
        where,
        select,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.teamProfile.count({ where }),
    ]);
    return paginated(rows.map(present), total, q.page, q.limit);
  }
  async one(id: string) {
    const row = await this.prisma.teamProfile.findUnique({ where: { id }, select });
    if (!row) throw new NotFoundException('Team profile not found');
    return present(row);
  }
  async create(dto: CreateAdminTeamDto, actor: AuthUser) {
    if (dto.role !== Role.TEAM_MEMBER && dto.role !== Role.ADMIN)
      throw new BadRequestException(
        'A team profile requires a team member or administrator account',
      );
    const passwordHash = await this.passwords.hash(dto.password);
    const id = await this.prisma.$transaction(async (db) => {
      await db.$executeRaw`SELECT pg_advisory_xact_lock(86602)`;
      if (await db.user.findUnique({ where: { email: dto.email }, select: { id: true } }))
        throw new ConflictException('An account with this email already exists');
      if (dto.avatarMediaId) await this.assertImage(db, dto.avatarMediaId);
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
        select: { id: true },
      });
      const profile = await db.teamProfile.create({
        data: {
          userId: user.id,
          slug: dto.slug,
          displayName: dto.displayName,
          titleEn: dto.titleEn,
          titleAr: dto.titleAr,
          bioEn: dto.bioEn ?? '',
          bioAr: dto.bioAr ?? '',
          avatarMediaId: dto.avatarMediaId,
          isPublic: dto.isPublic ?? true,
        },
        select: { id: true },
      });
      await this.audit.record(actor.id, 'admin.team-create', 'TeamProfile', profile.id, {}, db);
      return profile.id;
    });
    return this.one(id);
  }
  async update(id: string, dto: UpdateAdminTeamDto, actor: AuthUser) {
    if (!Object.keys(dto).length) throw new BadRequestException('Choose a profile field to update');
    await this.prisma.$transaction(async (db) => {
      const current = await db.teamProfile.findUnique({ where: { id }, select: { id: true } });
      if (!current) throw new NotFoundException('Team profile not found');
      if (dto.avatarMediaId) await this.assertImage(db, dto.avatarMediaId);
      await db.teamProfile.update({ where: { id }, data: dto });
      await this.audit.record(actor.id, 'admin.team-update', 'TeamProfile', id, {}, db);
    });
    return this.one(id);
  }
  private async assertImage(db: Prisma.TransactionClient, id: string) {
    await db.$queryRaw`SELECT id FROM "Media" WHERE id = ${id}::uuid FOR KEY SHARE`;
    if (!(await db.media.findUnique({ where: { id }, select: { id: true } })))
      throw new NotFoundException('Image not found');
  }
}
