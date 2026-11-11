import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { publicListingSelect, publicListingWhere } from '../listings/listings.repository';
import { WorkspaceRepository } from './workspace.repository';

describe('workspace account isolation and quotas', () => {
  function setup() {
    const db = {
      $queryRaw: jest.fn(),
      listing: { findFirst: jest.fn().mockResolvedValue({ id: 'listing-a' }) },
      favorite: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
      savedSearch: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const prisma = {
      ...db,
      $transaction: (work: unknown) =>
        typeof work === 'function' ? work(db) : Promise.all(work as Promise<unknown>[]),
    };
    return { db, repository: new WorkspaceRepository(prisma as unknown as PrismaService) };
  }

  it('filters favorites through current public visibility and uses the safe nested listing projection', async () => {
    const { db, repository } = setup();
    await repository.favorites('customer-a', { page: 1, limit: 20 });
    expect(db.favorite.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'customer-a', listing: publicListingWhere },
        select: { createdAt: true, listing: { select: publicListingSelect } },
      }),
    );
  });

  it('never adds an unpublished listing', async () => {
    const { db, repository } = setup();
    db.listing.findFirst.mockResolvedValue(null);
    await expect(repository.addFavorite('customer-a', 'listing-a')).rejects.toThrow(
      NotFoundException,
    );
    expect(db.favorite.create).not.toHaveBeenCalled();
  });

  it('serializes quota decisions under the user row lock and makes repeated adds idempotent', async () => {
    const { db, repository } = setup();
    db.favorite.findUnique.mockResolvedValue({ userId: 'customer-a' });
    await repository.addFavorite('customer-a', 'listing-a');
    expect(db.$queryRaw).toHaveBeenCalled();
    expect(db.favorite.create).not.toHaveBeenCalled();
    expect(db.favorite.count).not.toHaveBeenCalled();
    db.favorite.findUnique.mockResolvedValue(null);
    db.favorite.count.mockResolvedValue(100);
    await expect(repository.addFavorite('customer-a', 'listing-b')).rejects.toThrow(
      ConflictException,
    );
    expect(db.favorite.create).not.toHaveBeenCalled();
  });

  it("limits saved searches without counting another customer's records", async () => {
    const { db, repository } = setup();
    db.savedSearch.count.mockResolvedValue(20);
    await expect(repository.createSearch('customer-a', 'Dubai villas', {})).rejects.toThrow(
      ConflictException,
    );
    expect(db.$queryRaw).toHaveBeenCalled();
    expect(db.savedSearch.count).toHaveBeenCalledWith({ where: { userId: 'customer-a' } });
    expect(db.savedSearch.create).not.toHaveBeenCalled();
  });

  it("treats someone else's search as absent for reads and updates", async () => {
    const { db, repository } = setup();
    await expect(repository.savedSearch('customer-a', 'someone-elses-id')).rejects.toThrow(
      NotFoundException,
    );
    await expect(
      repository.updateSearch('customer-a', 'someone-elses-id', { name: 'Changed' }),
    ).rejects.toThrow(NotFoundException);
    expect(db.savedSearch.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'customer-a', id: 'someone-elses-id' } }),
    );
    expect(db.savedSearch.updateMany).toHaveBeenCalledWith({
      where: { userId: 'customer-a', id: 'someone-elses-id' },
      data: { name: 'Changed' },
    });
    expect(db.savedSearch.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it('always includes the current user in deletion predicates', async () => {
    const { db, repository } = setup();
    await repository.removeFavorite('customer-a', 'listing-a');
    await expect(repository.removeSearch('customer-a', 'someone-elses-id')).rejects.toThrow(
      NotFoundException,
    );
    expect(db.favorite.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'customer-a', listingId: 'listing-a' },
    });
    expect(db.savedSearch.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'customer-a', id: 'someone-elses-id' },
    });
  });
});
