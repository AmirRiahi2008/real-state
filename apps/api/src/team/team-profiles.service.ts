import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../auth/auth-user';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { MediaService } from '../media/media.service';
import { UpdateTeamProfileDto } from './team.dto';
import {
  presentTeamMember,
  publicTeamWhere,
  teamMemberSelect,
  teamProfileRoles,
} from './team.policy';

@Injectable()
export class TeamProfilesService {
  private readonly logger = new Logger(TeamProfilesService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly media: MediaService,
  ) {}

  async list() {
    const rows = await this.prisma.teamProfile.findMany({
      where: publicTeamWhere,
      select: teamMemberSelect,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 50,
    });
    return { data: rows.map(presentTeamMember) };
  }

  async publicMember(slug: string) {
    if (slug.length > 120 || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))
      throw new NotFoundException('Team member not found');
    const row = await this.prisma.teamProfile.findFirst({
      where: { slug, ...publicTeamWhere },
      select: teamMemberSelect,
    });
    if (!row) throw new NotFoundException('Team member not found');
    return presentTeamMember(row);
  }

  async own(actor: AuthUser) {
    const row = await this.ownRecord(actor);
    const { user, ...profile } = row;
    return {
      ...presentTeamMember(profile),
      avatarMediaId: profile.avatarMediaId,
      email: user.email,
    };
  }

  async updateOwn(actor: AuthUser, dto: UpdateTeamProfileDto) {
    if (Object.keys(dto).length === 0)
      throw new BadRequestException('Choose a profile field to update');
    await this.prisma.$transaction(async (db) => {
      const current = await this.ownRecord(actor, db);
      if (dto.avatarMediaId) {
        // Attachment shares the media lock used by deletion, and never accepts another owner's file.
        await db.$queryRaw`SELECT id FROM "Media" WHERE id = ${dto.avatarMediaId}::uuid FOR KEY SHARE`;
        const photo = await db.media.findFirst({
          where: { id: dto.avatarMediaId, ownerId: actor.id },
          select: { id: true },
        });
        if (!photo) throw new NotFoundException('Image not found');
      }
      const data = {
        ...(dto.displayName !== undefined ? { displayName: dto.displayName } : {}),
        ...(dto.titleEn !== undefined ? { titleEn: dto.titleEn } : {}),
        ...(dto.titleAr !== undefined ? { titleAr: dto.titleAr } : {}),
        ...(dto.bioEn !== undefined ? { bioEn: dto.bioEn } : {}),
        ...(dto.bioAr !== undefined ? { bioAr: dto.bioAr } : {}),
        ...(dto.avatarMediaId !== undefined ? { avatarMediaId: dto.avatarMediaId } : {}),
      };
      await db.teamProfile.update({ where: { id: current.id, userId: actor.id }, data });
      await this.audit.record(actor.id, 'team.profile_updated', 'TeamProfile', current.id, {}, db);
    });
    return this.own(actor);
  }

  async uploadPhoto(actor: AuthUser, file?: Express.Multer.File) {
    await this.ownRecord(actor);
    if (!file?.buffer || file.size > 4 * 1024 * 1024)
      throw new BadRequestException('Choose a static JPEG, PNG or WebP image up to 4 MB');
    const uploaded = await this.media.upload(actor, file);
    try {
      return await this.updateOwn(actor, { avatarMediaId: uploaded.id });
    } catch (error) {
      await this.media.remove(actor, uploaded.id).catch(() => {
        this.logger.error('Detached team image cleanup requires reconciliation');
      });
      throw error;
    }
  }

  private async ownRecord(
    actor: AuthUser,
    db: Pick<Prisma.TransactionClient, 'teamProfile'> = this.prisma,
  ) {
    if (!teamProfileRoles.includes(actor.role))
      throw new NotFoundException('Team profile not found');
    const row = await db.teamProfile.findFirst({
      where: { userId: actor.id, user: { isActive: true, role: { in: teamProfileRoles } } },
      select: { ...teamMemberSelect, user: { select: { email: true } } },
    });
    if (!row) throw new NotFoundException('Team profile not found');
    return row;
  }
}
