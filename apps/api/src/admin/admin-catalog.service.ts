import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { paginated } from '../common/pagination.dto';
import { safeUserSelect } from '../users/users.repository';
import { AdminQueryDto } from './admin.dto';
@Injectable()
export class AdminCatalogService {
  constructor(private readonly prisma: PrismaService) {}
  async options() {
    const [areas, developers, amenities, agents, staff, users, projects, teamMembers] =
      await Promise.all([
        this.prisma.area.findMany({ orderBy: { nameEn: 'asc' }, take: 1000 }),
        this.prisma.developer.findMany({ orderBy: { nameEn: 'asc' }, take: 1000 }),
        this.prisma.amenity.findMany({ orderBy: { nameEn: 'asc' }, take: 1000 }),
        this.prisma.user.findMany({
          where: { role: { in: [Role.AGENT, Role.ADMIN] } },
          select: {
            ...safeUserSelect,
            agentProfile: {
              select: { id: true, displayName: true, slug: true, photoMediaId: true },
            },
          },
          orderBy: { firstName: 'asc' },
          take: 1000,
        }),
        this.prisma.user.findMany({
          where: { role: { in: [Role.AGENT, Role.ADMIN, Role.TEAM_MEMBER] } },
          select: safeUserSelect,
          orderBy: { firstName: 'asc' },
          take: 1000,
        }),
        this.prisma.user.findMany({
          select: safeUserSelect,
          orderBy: { firstName: 'asc' },
          take: 1000,
        }),
        this.prisma.project.findMany({
          select: { id: true, slug: true, nameEn: true, nameAr: true, status: true, areaId: true },
          orderBy: { nameEn: 'asc' },
          take: 1000,
        }),
        this.prisma.teamProfile.findMany({
          select: { id: true, userId: true, displayName: true, isPublic: true },
          orderBy: { displayName: 'asc' },
          take: 1000,
        }),
      ]);
    return {
      areas,
      developers,
      amenities,
      agents,
      staff,
      users,
      projects,
      teamMembers,
      optionLimit: 1000,
    };
  }
  async catalog(kind: string, q: AdminQueryDto) {
    const paging = { skip: (q.page - 1) * q.limit, take: q.limit };
    if (kind === 'areas') {
      const where: Prisma.AreaWhereInput = q.q
        ? {
            OR: [
              { nameEn: { contains: q.q, mode: 'insensitive' } },
              { nameAr: { contains: q.q, mode: 'insensitive' } },
            ],
          }
        : {};
      const [rows, total] = await this.prisma.$transaction([
        this.prisma.area.findMany({ where, ...paging, orderBy: { nameEn: 'asc' } }),
        this.prisma.area.count({ where }),
      ]);
      return paginated(rows, total, q.page, q.limit);
    }
    if (kind === 'developers') {
      const where: Prisma.DeveloperWhereInput = q.q
        ? {
            OR: [
              { nameEn: { contains: q.q, mode: 'insensitive' } },
              { nameAr: { contains: q.q, mode: 'insensitive' } },
            ],
          }
        : {};
      const [rows, total] = await this.prisma.$transaction([
        this.prisma.developer.findMany({ where, ...paging, orderBy: { nameEn: 'asc' } }),
        this.prisma.developer.count({ where }),
      ]);
      return paginated(rows, total, q.page, q.limit);
    }
    if (kind === 'amenities') {
      const where: Prisma.AmenityWhereInput = q.q
        ? {
            OR: [
              { nameEn: { contains: q.q, mode: 'insensitive' } },
              { nameAr: { contains: q.q, mode: 'insensitive' } },
            ],
          }
        : {};
      const [rows, total] = await this.prisma.$transaction([
        this.prisma.amenity.findMany({ where, ...paging, orderBy: { nameEn: 'asc' } }),
        this.prisma.amenity.count({ where }),
      ]);
      return paginated(rows, total, q.page, q.limit);
    }
    if (kind === 'agents') {
      const where: Prisma.AgentProfileWhereInput = q.q
        ? { displayName: { contains: q.q, mode: 'insensitive' } }
        : {};
      const [rows, total] = await this.prisma.$transaction([
        this.prisma.agentProfile.findMany({
          where,
          ...paging,
          orderBy: { displayName: 'asc' },
          include: { user: { select: safeUserSelect } },
        }),
        this.prisma.agentProfile.count({ where }),
      ]);
      return paginated(rows, total, q.page, q.limit);
    }
    throw new NotFoundException('Catalog collection not found');
  }
  async one(kind: string, id: string) {
    const row =
      kind === 'areas'
        ? await this.prisma.area.findUnique({ where: { id } })
        : kind === 'developers'
          ? await this.prisma.developer.findUnique({ where: { id } })
          : kind === 'amenities'
            ? await this.prisma.amenity.findUnique({ where: { id } })
            : kind === 'agents'
              ? await this.prisma.agentProfile.findUnique({
                  where: { id },
                  include: { user: { select: safeUserSelect } },
                })
              : null;
    if (!row) throw new NotFoundException('Catalog record not found');
    return row;
  }
}
