import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import {
  Availability,
  CompletionStatus,
  ListingPurpose,
  PublicationStatus,
  PropertyType,
  Role,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/auth-user';
import { MediaAttachmentDto } from './dto/listing.dto';
import { ListingsRepository, ManagedListingRecord } from './listings.repository';
import { ListingsService } from './listings.service';

const owner: AuthUser = {
  id: 'agent-a',
  email: 'a@example.test',
  role: Role.AGENT,
  sessionId: 'session-a',
};
const admin: AuthUser = { ...owner, id: 'admin-a', role: Role.ADMIN };
const image: MediaAttachmentDto = { mediaId: 'image-a', position: 0, altEn: '', altAr: '' };

function setup(overrides: Partial<ManagedListingRecord> = {}) {
  const row = {
    id: 'listing-a',
    agentId: owner.id,
    areaId: 'area-a',
    projectId: null,
    version: 3,
    status: PublicationStatus.DRAFT,
    purpose: ListingPurpose.SALE,
    propertyType: PropertyType.APARTMENT,
    completion: CompletionStatus.READY,
    availability: Availability.AVAILABLE,
    priceOnRequest: false,
    priceAed: '1500000.00',
    previousPriceAed: null,
    areaSqm: '125.00',
    plotAreaSqm: null,
    bedrooms: 2,
    rentalPeriod: null,
    latitude: null,
    longitude: null,
    handoverDate: null,
    media: [image],
    amenities: [],
    ...overrides,
  } as unknown as ManagedListingRecord;
  const tx = {
    area: { findFirst: jest.fn().mockResolvedValue({ id: row.areaId }) },
    user: { findFirst: jest.fn().mockResolvedValue({ id: owner.id }) },
    media: { count: jest.fn().mockResolvedValue(1) },
    listing: {
      update: jest
        .fn()
        .mockImplementation(async ({ data }: { data: object }) => ({ ...row, ...data })),
    },
    listingMedia: { deleteMany: jest.fn(), createMany: jest.fn() },
    listingAmenity: { deleteMany: jest.fn(), createMany: jest.fn() },
  };
  const repository = {
    locked: jest.fn(
      async (
        _id: string,
        work: (record: ManagedListingRecord, client: unknown) => Promise<unknown>,
      ) => work(row, tx),
    ),
  };
  const audit = { record: jest.fn() };
  const service = new ListingsService(
    repository as unknown as ListingsRepository,
    audit as unknown as AuditService,
  );
  return { service, row, tx, audit };
}

describe('Listing mutation authorization and publication workflow', () => {
  it('conceals another agent’s listing before relation reads or writes', async () => {
    const { service, tx, audit } = setup({ agentId: 'agent-b' });
    await expect(
      service.update('listing-a', { version: 3, titleEn: 'Changed property' }, owner),
    ).rejects.toThrow(NotFoundException);
    expect(tx.area.findFirst).not.toHaveBeenCalled();
    expect(tx.listing.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('rejects stale versions before replacing media or writing the listing', async () => {
    const { service, tx, audit } = setup();
    await expect(service.update('listing-a', { version: 2, media: [] }, owner)).rejects.toThrow(
      ConflictException,
    );
    expect(tx.listingMedia.deleteMany).not.toHaveBeenCalled();
    expect(tx.listing.update).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('prevents an agent from reassigning an owned listing', async () => {
    const { service, tx } = setup();
    await expect(
      service.update('listing-a', { version: 3, agentId: 'agent-b' }, owner),
    ).rejects.toThrow(NotFoundException);
    expect(tx.listing.update).not.toHaveBeenCalled();
  });

  it('withdraws edited published content until an administrator reviews it again', async () => {
    const { service, tx, audit } = setup({ status: PublicationStatus.PUBLISHED });
    await service.update('listing-a', { version: 3, titleEn: 'Changed property' }, owner);
    expect(tx.listing.update).toHaveBeenCalledWith({
      where: { id: 'listing-a' },
      data: expect.objectContaining({
        titleEn: 'Changed property',
        status: PublicationStatus.IN_REVIEW,
        publishedAt: null,
        version: { increment: 1 },
      }),
    });
    expect(audit.record).toHaveBeenCalledWith(
      owner.id,
      'listing.updated',
      'Listing',
      'listing-a',
      expect.objectContaining({
        fromStatus: PublicationStatus.PUBLISHED,
        toStatus: PublicationStatus.IN_REVIEW,
      }),
      tx,
    );
  });

  it('checks ownership of newly supplied uploads before replacing any gallery', async () => {
    const { service, tx } = setup();
    tx.media.count.mockResolvedValue(0);
    await expect(
      service.update(
        'listing-a',
        { version: 3, media: [{ ...image, mediaId: 'another-agents-image' }] },
        owner,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(tx.media.count).toHaveBeenCalledWith({
      where: { id: { in: ['another-agents-image'] }, ownerId: owner.id },
    });
    expect(tx.listingMedia.deleteMany).not.toHaveBeenCalled();
    expect(tx.listing.update).not.toHaveBeenCalled();
  });

  it('prevents an agent from publishing even their own review-ready inventory', async () => {
    const { service, tx } = setup({ status: PublicationStatus.IN_REVIEW });
    await expect(service.transition('listing-a', 'publish', { version: 3 }, owner)).rejects.toThrow(
      NotFoundException,
    );
    expect(tx.listing.update).not.toHaveBeenCalled();
  });

  it('requires a current visible agent profile before administrator publication', async () => {
    const { service, tx } = setup({ status: PublicationStatus.IN_REVIEW });
    await service.transition('listing-a', 'publish', { version: 3 }, admin);
    expect(tx.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          emailVerifiedAt: { not: null },
          agentProfile: {
            is: { isPublic: true, OR: [{ areaId: null }, { area: { isActive: true } }] },
          },
        }),
      }),
    );
    expect(tx.listing.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: PublicationStatus.PUBLISHED,
          publishedAt: expect.any(Date),
        }),
      }),
    );
  });
});
