import { Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AreaQueryDto, CatalogQueryDto } from './catalog.dto';

export const publicAreaSelect = {
  id: true,
  slug: true,
  nameEn: true,
  nameAr: true,
  descriptionEn: true,
  descriptionAr: true,
  emirate: true,
  latitude: true,
  longitude: true,
  parentId: true,
} satisfies Prisma.AreaSelect;
export const publicDeveloperSelect = {
  id: true,
  slug: true,
  nameEn: true,
  nameAr: true,
  descriptionEn: true,
  descriptionAr: true,
  website: true,
} satisfies Prisma.DeveloperSelect;
export const publicAgentSelect = {
  id: true,
  slug: true,
  displayName: true,
  bioEn: true,
  bioAr: true,
  publicEmail: true,
  phone: true,
  whatsapp: true,
  reraNumber: true,
  languages: true,
  area: { select: publicAreaSelect },
  photo: { select: { id: true, mimeType: true, width: true, height: true } },
} satisfies Prisma.AgentProfileSelect;
export const publicAgentWhere = {
  isPublic: true,
  user: { isActive: true, emailVerifiedAt: { not: null }, role: { in: [Role.AGENT, Role.ADMIN] } },
  OR: [{ areaId: null }, { area: { isActive: true } }],
} satisfies Prisma.AgentProfileWhereInput;

@Injectable()
export class CatalogRepository {
  constructor(private readonly prisma: PrismaService) {}
  areaWhere(query: AreaQueryDto): Prisma.AreaWhereInput {
    return {
      isActive: true,
      emirate: query.emirate,
      ...(query.q
        ? {
            OR: [
              { nameEn: { contains: query.q, mode: 'insensitive' } },
              { nameAr: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }
  developerWhere(query: CatalogQueryDto): Prisma.DeveloperWhereInput {
    return {
      isActive: true,
      ...(query.q
        ? {
            OR: [
              { nameEn: { contains: query.q, mode: 'insensitive' } },
              { nameAr: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }
  areas(query: AreaQueryDto) {
    const where = this.areaWhere(query);
    return this.prisma.$transaction([
      this.prisma.area.findMany({
        where,
        select: publicAreaSelect,
        orderBy: { nameEn: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.area.count({ where }),
    ]);
  }
  developers(query: CatalogQueryDto) {
    const where = this.developerWhere(query);
    return this.prisma.$transaction([
      this.prisma.developer.findMany({
        where,
        select: publicDeveloperSelect,
        orderBy: { nameEn: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.developer.count({ where }),
    ]);
  }
  agents(query: CatalogQueryDto) {
    const where: Prisma.AgentProfileWhereInput = {
      AND: [
        publicAgentWhere,
        ...(query.q
          ? [{ displayName: { contains: query.q, mode: Prisma.QueryMode.insensitive } }]
          : []),
      ],
    };
    return this.prisma.$transaction([
      this.prisma.agentProfile.findMany({
        where,
        select: publicAgentSelect,
        orderBy: { displayName: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.agentProfile.count({ where }),
    ]);
  }
  area(slug: string) {
    return this.prisma.area.findFirst({
      where: { slug, isActive: true },
      select: publicAreaSelect,
    });
  }
  developer(slug: string) {
    return this.prisma.developer.findFirst({
      where: { slug, isActive: true },
      select: publicDeveloperSelect,
    });
  }
  agent(slug: string) {
    return this.prisma.agentProfile.findFirst({
      where: { AND: [publicAgentWhere, { slug }] },
      select: publicAgentSelect,
    });
  }
  amenities(query: CatalogQueryDto) {
    const where: Prisma.AmenityWhereInput = query.q
      ? {
          OR: [
            { nameEn: { contains: query.q, mode: 'insensitive' } },
            { nameAr: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {};
    return this.prisma.$transaction([
      this.prisma.amenity.findMany({
        where,
        select: { id: true, slug: true, nameEn: true, nameAr: true },
        orderBy: { nameEn: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.amenity.count({ where }),
    ]);
  }
  autocomplete(q: string) {
    return this.prisma.area.findMany({
      where: {
        isActive: true,
        OR: [
          { nameEn: { contains: q, mode: 'insensitive' } },
          { nameAr: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, slug: true, nameEn: true, nameAr: true, emirate: true },
      orderBy: { nameEn: 'asc' },
      take: 10,
    });
  }
}
