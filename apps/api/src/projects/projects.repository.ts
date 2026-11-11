import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PublicationStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { ProjectSort, SearchProjectsDto } from './dto/project.dto';

export const publicProjectWhere: Prisma.ProjectWhereInput = {
  status: PublicationStatus.PUBLISHED,
  area: { isActive: true },
  developer: { isActive: true },
};
const mediaSelect = {
  id: true,
  mimeType: true,
  width: true,
  height: true,
  size: true,
} satisfies Prisma.MediaSelect;
export const publicProjectSelect = {
  id: true,
  slug: true,
  nameEn: true,
  nameAr: true,
  descriptionEn: true,
  descriptionAr: true,
  startingPriceAed: true,
  priceOnRequest: true,
  handoverDate: true,
  minBedrooms: true,
  maxBedrooms: true,
  propertyTypes: true,
  paymentPlan: true,
  floorPlans: true,
  latitude: true,
  longitude: true,
  publishedAt: true,
  area: { select: { id: true, slug: true, nameEn: true, nameAr: true, emirate: true } },
  developer: { select: { id: true, slug: true, nameEn: true, nameAr: true, website: true } },
  media: {
    orderBy: { position: 'asc' },
    select: { position: true, altEn: true, altAr: true, media: { select: mediaSelect } },
  },
  amenities: {
    select: { amenity: { select: { id: true, slug: true, nameEn: true, nameAr: true } } },
  },
} satisfies Prisma.ProjectSelect;
type PublicProject = Prisma.ProjectGetPayload<{ select: typeof publicProjectSelect }>;
export type ManagedProject = Prisma.ProjectGetPayload<{
  include: { media: true; amenities: true };
}>;
export function presentProject(row: PublicProject) {
  const { media, amenities, ...project } = row;
  return {
    ...project,
    media: media.map((item) => ({
      ...item.media,
      position: item.position,
      altEn: item.altEn,
      altAr: item.altAr,
      url: `/api/v1/media/${item.media.id}/file`,
    })),
    amenities: amenities.map((item) => item.amenity),
  };
}
export function buildProjectWhere(query: SearchProjectsDto): Prisma.ProjectWhereInput {
  const filters: Prisma.ProjectWhereInput[] = [publicProjectWhere];
  if (query.q?.trim()) {
    const contains = query.q.trim().replace(/[\\%_]/g, '\\$&');
    filters.push({
      OR: [
        { nameEn: { contains, mode: 'insensitive' } },
        { nameAr: { contains, mode: 'insensitive' } },
      ],
    });
  }
  if (query.areaId) filters.push({ areaId: query.areaId });
  if (query.developerId) filters.push({ developerId: query.developerId });
  if (query.emirate) filters.push({ area: { emirate: query.emirate } });
  if (query.propertyType) filters.push({ propertyTypes: { has: query.propertyType } });
  if (query.bedrooms !== undefined)
    filters.push({ minBedrooms: { lte: query.bedrooms }, maxBedrooms: { gte: query.bedrooms } });
  if (query.minPrice !== undefined || query.maxPrice !== undefined)
    filters.push({ startingPriceAed: { gte: query.minPrice, lte: query.maxPrice } });
  if (query.priceOnRequest !== undefined) filters.push({ priceOnRequest: query.priceOnRequest });
  if (query.handoverFrom || query.handoverTo)
    filters.push({
      handoverDate: {
        gte: query.handoverFrom ? new Date(query.handoverFrom) : undefined,
        lte: query.handoverTo ? new Date(query.handoverTo) : undefined,
      },
    });
  return { AND: filters };
}
function order(sort: ProjectSort): Prisma.ProjectOrderByWithRelationInput[] {
  switch (sort) {
    case ProjectSort.PRICE_ASC:
      return [{ startingPriceAed: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }];
    case ProjectSort.PRICE_DESC:
      return [{ startingPriceAed: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }];
    case ProjectSort.HANDOVER:
      return [{ handoverDate: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }];
    default:
      return [{ createdAt: 'desc' }, { id: 'asc' }];
  }
}
@Injectable()
export class ProjectsRepository {
  constructor(private readonly prisma: PrismaService) {}
  async publicPage(query: SearchProjectsDto) {
    const where = buildProjectWhere(query);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        select: publicProjectSelect,
        orderBy: order(query.sort),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.project.count({ where }),
    ]);
    return { rows, total };
  }
  publicOne(slug: string) {
    return this.prisma.project.findFirst({
      where: { AND: [publicProjectWhere, { slug }] },
      select: publicProjectSelect,
    });
  }
  managedOne(id: string) {
    return this.prisma.project.findUnique({
      where: { id },
      include: { media: true, amenities: true },
    });
  }
  async managedPage(page: number, limit: number) {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.project.count(),
    ]);
    return { rows, total };
  }
  transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(work);
  }
  locked<T>(
    id: string,
    work: (row: ManagedProject, tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Project" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const row = await tx.project.findUnique({
        where: { id },
        include: { media: true, amenities: true },
      });
      if (!row) throw new NotFoundException('Project not found');
      return work(row, tx);
    });
  }
}
