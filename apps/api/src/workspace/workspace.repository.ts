import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { PaginationDto } from '../common/pagination.dto';
import { publicListingSelect, publicListingWhere } from '../listings/listings.repository';

const savedSelect = {
  id: true,
  name: true,
  filters: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SavedSearchSelect;
@Injectable()
export class WorkspaceRepository {
  constructor(private readonly prisma: PrismaService) {}
  async favorites(userId: string, query: PaginationDto) {
    const where: Prisma.FavoriteWhereInput = { userId, listing: publicListingWhere };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.favorite.findMany({
        where,
        select: { createdAt: true, listing: { select: publicListingSelect } },
        orderBy: [{ createdAt: 'desc' }, { listingId: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.favorite.count({ where }),
    ]);
    return { rows, total };
  }
  async addFavorite(userId: string, listingId: string): Promise<void> {
    await this.prisma.$transaction(async (db) => {
      await this.lockUser(db, userId);
      if (
        !(await db.listing.findFirst({
          where: { AND: [publicListingWhere, { id: listingId }] },
          select: { id: true },
        }))
      )
        throw new NotFoundException('Listing not found');
      if (
        await db.favorite.findUnique({
          where: { userId_listingId: { userId, listingId } },
          select: { userId: true },
        })
      )
        return;
      if ((await db.favorite.count({ where: { userId } })) >= 100)
        throw new ConflictException(
          'A maximum of 100 favorites is allowed. Remove a favorite or clear the list first.',
        );
      await db.favorite.create({ data: { userId, listingId } });
    });
  }
  async removeFavorite(userId: string, listingId: string): Promise<void> {
    await this.prisma.favorite.deleteMany({ where: { userId, listingId } });
  }
  async clearFavorites(userId: string): Promise<void> {
    await this.prisma.favorite.deleteMany({ where: { userId } });
  }
  async savedSearches(userId: string, query: PaginationDto) {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.savedSearch.findMany({
        where: { userId },
        select: savedSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.savedSearch.count({ where: { userId } }),
    ]);
    return { rows, total };
  }
  async savedSearch(userId: string, id: string) {
    const row = await this.prisma.savedSearch.findFirst({
      where: { userId, id },
      select: savedSelect,
    });
    if (!row) throw new NotFoundException('Saved search not found');
    return row;
  }
  async createSearch(userId: string, name: string, filters: Prisma.InputJsonObject) {
    return this.prisma.$transaction(async (db) => {
      await this.lockUser(db, userId);
      if ((await db.savedSearch.count({ where: { userId } })) >= 20)
        throw new ConflictException('A maximum of 20 saved searches is allowed');
      return db.savedSearch.create({ data: { userId, name, filters }, select: savedSelect });
    });
  }
  async updateSearch(
    userId: string,
    id: string,
    data: { name?: string; filters?: Prisma.InputJsonObject },
  ) {
    return this.prisma.$transaction(async (db) => {
      const result = await db.savedSearch.updateMany({ where: { userId, id }, data });
      if (!result.count) throw new NotFoundException('Saved search not found');
      return db.savedSearch.findUniqueOrThrow({ where: { id }, select: savedSelect });
    });
  }
  async removeSearch(userId: string, id: string): Promise<void> {
    const result = await this.prisma.savedSearch.deleteMany({ where: { userId, id } });
    if (!result.count) throw new NotFoundException('Saved search not found');
  }
  private async lockUser(db: Prisma.TransactionClient, userId: string): Promise<void> {
    await db.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId}::uuid FOR UPDATE`;
  }
}
