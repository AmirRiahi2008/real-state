import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PublicationStatus, Role } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { ListingSort, SearchListingsDto } from './dto/search-listings.dto';

export const publicListingWhere: Prisma.ListingWhereInput = {
  status: PublicationStatus.PUBLISHED,
  area: { isActive: true },
  agent: {
    isActive: true,
    role: { in: [Role.AGENT, Role.ADMIN] },
    emailVerifiedAt: { not: null },
    agentProfile: { is: { isPublic: true, OR: [{ areaId: null }, { area: { isActive: true } }] } },
  },
  OR: [
    { projectId: null },
    {
      project: {
        is: {
          status: PublicationStatus.PUBLISHED,
          area: { isActive: true },
          developer: { isActive: true },
        },
      },
    },
  ],
};

export const publicMediaSelect = {
  id: true,
  mimeType: true,
  width: true,
  height: true,
  size: true,
} satisfies Prisma.MediaSelect;
export const publicListingSelect = {
  id: true,
  reference: true,
  slug: true,
  titleEn: true,
  titleAr: true,
  descriptionEn: true,
  descriptionAr: true,
  purpose: true,
  propertyType: true,
  completion: true,
  availability: true,
  furnishing: true,
  priceAed: true,
  priceOnRequest: true,
  previousPriceAed: true,
  rentalPeriod: true,
  areaSqm: true,
  plotAreaSqm: true,
  bedrooms: true,
  bathrooms: true,
  parking: true,
  addressEn: true,
  addressAr: true,
  latitude: true,
  longitude: true,
  vacantOn: true,
  handoverDate: true,
  isExclusive: true,
  permitNumber: true,
  permitUrl: true,
  publishedAt: true,
  createdAt: true,
  area: { select: { id: true, slug: true, nameEn: true, nameAr: true, emirate: true } },
  project: { select: { id: true, slug: true, nameEn: true, nameAr: true, handoverDate: true } },
  agent: {
    select: {
      agentProfile: {
        select: {
          id: true,
          slug: true,
          displayName: true,
          publicEmail: true,
          phone: true,
          whatsapp: true,
          reraNumber: true,
          languages: true,
          photo: { select: publicMediaSelect },
        },
      },
    },
  },
  media: {
    orderBy: { position: 'asc' },
    select: {
      mediaId: true,
      position: true,
      altEn: true,
      altAr: true,
      media: { select: publicMediaSelect },
    },
  },
  amenities: {
    select: { amenity: { select: { id: true, slug: true, nameEn: true, nameAr: true } } },
  },
} satisfies Prisma.ListingSelect;

export type PublicListingRecord = Prisma.ListingGetPayload<{ select: typeof publicListingSelect }>;
export type ManagedListingRecord = Prisma.ListingGetPayload<{
  include: { media: true; amenities: true };
}>;

export function presentListing(row: PublicListingRecord) {
  const { agent, media, amenities, ...listing } = row;
  return {
    ...listing,
    areaSqft: row.areaSqm.mul('10.7639104167').toFixed(2),
    pricePerSqm: row.priceAed ? row.priceAed.div(row.areaSqm).toFixed(2) : null,
    agent: agent.agentProfile
      ? {
          ...agent.agentProfile,
          photo: agent.agentProfile.photo
            ? {
                ...agent.agentProfile.photo,
                url: `/api/v1/media/${agent.agentProfile.photo.id}/file`,
              }
            : null,
        }
      : null,
    media: media.map((item) => ({
      ...item.media,
      position: item.position,
      altEn: item.altEn,
      altAr: item.altAr,
      url: `/api/v1/media/${item.mediaId}/file`,
    })),
    amenities: amenities.map((item) => item.amenity),
  };
}

export function buildListingWhere(
  query: SearchListingsDto,
  extra: Prisma.ListingWhereInput = {},
): Prisma.ListingWhereInput {
  const filters: Prisma.ListingWhereInput[] = [publicListingWhere, extra];
  if (query.q?.trim()) {
    const contains = query.q.trim().replace(/[\\%_]/g, '\\$&');
    filters.push({
      OR: [
        { titleEn: { contains, mode: 'insensitive' } },
        { titleAr: { contains, mode: 'insensitive' } },
        { reference: { contains, mode: 'insensitive' } },
        { addressEn: { contains, mode: 'insensitive' } },
        { addressAr: { contains, mode: 'insensitive' } },
      ],
    });
  }
  if (query.purpose) filters.push({ purpose: query.purpose });
  if (query.propertyType) filters.push({ propertyType: query.propertyType });
  if (query.emirate) filters.push({ area: { emirate: query.emirate } });
  if (query.areaIds?.length) filters.push({ areaId: { in: query.areaIds } });
  if (query.projectId) filters.push({ projectId: query.projectId });
  if (query.agentId) filters.push({ agent: { agentProfile: { is: { id: query.agentId } } } });
  if (query.completion) filters.push({ completion: query.completion });
  if (query.availability) filters.push({ availability: query.availability });
  if (query.furnishing) filters.push({ furnishing: query.furnishing });
  if (query.minPrice !== undefined || query.maxPrice !== undefined)
    filters.push({ priceAed: { gte: query.minPrice, lte: query.maxPrice } });
  if (query.minAreaSqm !== undefined || query.maxAreaSqm !== undefined)
    filters.push({ areaSqm: { gte: query.minAreaSqm, lte: query.maxAreaSqm } });
  if (query.bedrooms !== undefined) filters.push({ bedrooms: query.bedrooms });
  if (query.minBathrooms !== undefined) filters.push({ bathrooms: { gte: query.minBathrooms } });
  if (query.isExclusive !== undefined) filters.push({ isExclusive: query.isExclusive });
  if (query.priceOnRequest !== undefined) filters.push({ priceOnRequest: query.priceOnRequest });
  if (query.reducedPrice === true) filters.push({ previousPriceAed: { not: null } });
  if (query.vacantBy) filters.push({ vacantOn: { lte: new Date(query.vacantBy) } });
  if (query.south !== undefined)
    filters.push({
      latitude: { gte: query.south, lte: query.north },
      longitude: { gte: query.west, lte: query.east },
    });
  for (const amenityId of query.amenityIds ?? [])
    filters.push({ amenities: { some: { amenityId } } });
  return { AND: filters };
}

function listingOrder(sort: ListingSort): Prisma.ListingOrderByWithRelationInput[] {
  const tie: Prisma.ListingOrderByWithRelationInput = { id: 'asc' };
  switch (sort) {
    case ListingSort.PRICE_ASC:
      return [{ priceAed: { sort: 'asc', nulls: 'last' } }, tie];
    case ListingSort.PRICE_DESC:
      return [{ priceAed: { sort: 'desc', nulls: 'last' } }, tie];
    case ListingSort.AREA_ASC:
      return [{ areaSqm: 'asc' }, tie];
    case ListingSort.AREA_DESC:
      return [{ areaSqm: 'desc' }, tie];
    default:
      return [{ createdAt: 'desc' }, tie];
  }
}

@Injectable()
export class ListingsRepository {
  constructor(private readonly prisma: PrismaService) {}
  async publicPage(query: SearchListingsDto, extra: Prisma.ListingWhereInput = {}) {
    const where = buildListingWhere(query, extra);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.listing.findMany({
        where,
        select: publicListingSelect,
        orderBy: listingOrder(query.sort),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.listing.count({ where }),
    ]);
    return { rows, total };
  }
  publicOne(slug: string) {
    return this.prisma.listing.findFirst({
      where: { AND: [publicListingWhere, { slug }] },
      select: publicListingSelect,
    });
  }
  async managedPage(actorId: string, isAdmin: boolean, page: number, limit: number) {
    const where: Prisma.ListingWhereInput = isAdmin ? {} : { agentId: actorId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.listing.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.listing.count({ where }),
    ]);
    return { rows, total };
  }
  managedOne(id: string) {
    return this.prisma.listing.findUnique({
      where: { id },
      include: { media: true, amenities: true },
    });
  }
  transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(work);
  }
  async locked<T>(
    id: string,
    work: (row: ManagedListingRecord, tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Listing" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const row = await tx.listing.findUnique({
        where: { id },
        include: { media: true, amenities: true },
      });
      if (!row) throw new NotFoundException('Listing not found');
      return work(row, tx);
    });
  }
}
