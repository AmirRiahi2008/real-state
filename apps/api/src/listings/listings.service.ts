import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Availability, Prisma, PublicationStatus, Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/auth-user';
import { paginated, PaginationDto } from '../common/pagination.dto';
import {
  CreateListingDto,
  ListingTransitionDto,
  MediaAttachmentDto,
  UpdateListingDto,
} from './dto/listing.dto';
import { SearchListingsDto } from './dto/search-listings.dto';
import {
  assertListingOwner,
  validateListingFacts,
  validateListingInputNulls,
  validateMediaAttachments,
  validateSearchRanges,
} from './listing.policy';
import { ListingsRepository, ManagedListingRecord, presentListing } from './listings.repository';
import {
  prepareRichContent,
  assertRichMedia,
  replaceRichMedia,
} from '../rich-content/rich-content.policy';

const defined = <T extends object>(value: T): Partial<T> =>
  Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>;
const dateValue = (value: string | null | undefined): Date | null | undefined =>
  value === undefined ? undefined : value === null ? null : new Date(value);

@Injectable()
export class ListingsService {
  constructor(
    private readonly repository: ListingsRepository,
    private readonly audit: AuditService,
  ) {}
  async findAll(query: SearchListingsDto) {
    validateSearchRanges(query);
    const { rows, total } = await this.repository.publicPage(query);
    return paginated(rows.map(presentListing), total, query.page, query.limit);
  }
  async findOne(slug: string) {
    const row = await this.repository.publicOne(slug);
    if (!row) throw new NotFoundException('Listing not found');
    return presentListing(row);
  }
  async related(slug: string) {
    const row = await this.repository.publicOne(slug);
    if (!row) throw new NotFoundException('Listing not found');
    const query = new SearchListingsDto();
    query.limit = 6;
    const { rows } = await this.repository.publicPage(query, {
      id: { not: row.id },
      purpose: row.purpose,
      OR: [{ areaId: row.area.id }, { propertyType: row.propertyType }],
    });
    return { data: rows.map(presentListing) };
  }
  async mine(actor: AuthUser, query: PaginationDto) {
    assertListingOwner(actor.id, actor);
    const { rows, total } = await this.repository.managedPage(
      actor.id,
      actor.role === Role.ADMIN,
      query.page,
      query.limit,
    );
    return paginated(rows, total, query.page, query.limit);
  }
  async managedOne(id: string, actor: AuthUser) {
    const row = await this.repository.managedOne(id);
    if (!row) throw new NotFoundException('Listing not found');
    assertListingOwner(row.agentId, actor);
    return row;
  }
  async create(dto: CreateListingDto, actor: AuthUser) {
    validateListingInputNulls(dto);
    const rich = prepareRichContent(dto, undefined, 'description', {
      minTextLength: 20,
      maxTextLength: 20000,
    });
    const agentId = dto.agentId ?? actor.id;
    assertListingOwner(agentId, actor);
    validateMediaAttachments(dto.media ?? []);
    const facts = {
      ...dto,
      availability: dto.availability ?? Availability.AVAILABLE,
      priceOnRequest: dto.priceOnRequest ?? false,
      priceAed: dto.priceAed ?? null,
    };
    validateListingFacts(facts);
    return this.repository.transaction(async (tx) => {
      await this.validateRelations(
        tx,
        {
          areaId: dto.areaId,
          agentId,
          projectId: dto.projectId ?? null,
          media: dto.media ?? [],
          amenityIds: dto.amenityIds ?? [],
        },
        actor,
        false,
      );
      await assertRichMedia(tx, rich.mediaIds, actor);
      const row = await tx.listing.create({
        data: {
          reference: `UAE-${randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`,
          ...this.scalars(dto),
          ...rich.data,
          slug: dto.slug,
          titleEn: dto.titleEn,
          titleAr: dto.titleAr,
          descriptionEn: rich.textEn,
          descriptionAr: rich.textAr,
          purpose: dto.purpose,
          propertyType: dto.propertyType,
          completion: dto.completion,
          areaSqm: dto.areaSqm,
          bedrooms: dto.bedrooms,
          bathrooms: dto.bathrooms,
          addressEn: dto.addressEn,
          addressAr: dto.addressAr,
          areaId: dto.areaId,
          agentId,
          status: PublicationStatus.DRAFT,
          media: { create: dto.media ?? [] },
          amenities: { create: (dto.amenityIds ?? []).map((amenityId) => ({ amenityId })) },
        },
      });
      if (rich.mediaIds.length || rich.existingMediaIds.length)
        await replaceRichMedia(tx, 'listing', row.id, rich.mediaIds);
      await this.audit.record(actor.id, 'listing.created', 'Listing', row.id, {}, tx);
      return row;
    });
  }
  async update(id: string, dto: UpdateListingDto, actor: AuthUser) {
    validateListingInputNulls(dto);
    return this.repository.locked(id, async (row, tx) => {
      assertListingOwner(row.agentId, actor);
      this.assertVersion(row, dto.version);
      if (row.status === PublicationStatus.ARCHIVED)
        throw new BadRequestException('Archived listings cannot be edited');
      if (dto.agentId !== undefined) assertListingOwner(dto.agentId, actor);
      validateListingFacts({ ...row, ...defined(dto) });
      const rich = prepareRichContent(dto, row, 'description', {
        minTextLength: 20,
        maxTextLength: 20000,
      });
      await assertRichMedia(tx, rich.mediaIds, actor, rich.existingMediaIds);
      const media = dto.media ?? row.media;
      validateMediaAttachments(media);
      await this.validateRelations(
        tx,
        {
          areaId: dto.areaId ?? row.areaId,
          agentId: dto.agentId ?? row.agentId,
          projectId: dto.projectId === undefined ? row.projectId : dto.projectId,
          media,
          amenityIds: dto.amenityIds ?? row.amenities.map((item) => item.amenityId),
        },
        actor,
        false,
        dto.media === undefined,
      );
      if (dto.media !== undefined) {
        await tx.listingMedia.deleteMany({ where: { listingId: id } });
        await tx.listingMedia.createMany({
          data: dto.media.map((item) => ({ ...item, listingId: id })),
        });
      }
      if (dto.amenityIds !== undefined) {
        await tx.listingAmenity.deleteMany({ where: { listingId: id } });
        await tx.listingAmenity.createMany({
          data: dto.amenityIds.map((amenityId) => ({ amenityId, listingId: id })),
        });
      }
      const updated = await tx.listing.update({
        where: { id },
        data: {
          ...this.scalars(dto),
          ...rich.data,
          agentId: dto.agentId,
          status:
            row.status === PublicationStatus.PUBLISHED
              ? PublicationStatus.IN_REVIEW
              : PublicationStatus.DRAFT,
          publishedAt: null,
          version: { increment: 1 },
        },
      });
      if (rich.mediaIds.length || rich.existingMediaIds.length)
        await replaceRichMedia(tx, 'listing', id, rich.mediaIds);
      await this.audit.record(
        actor.id,
        'listing.updated',
        'Listing',
        id,
        { fromStatus: row.status, toStatus: updated.status },
        tx,
      );
      return updated;
    });
  }
  async transition(
    id: string,
    action: 'submit' | 'publish' | 'reject' | 'archive',
    dto: ListingTransitionDto,
    actor: AuthUser,
  ) {
    return this.repository.locked(id, async (row, tx) => {
      assertListingOwner(row.agentId, actor);
      this.assertVersion(row, dto.version);
      let status: PublicationStatus;
      if (action === 'publish' || action === 'reject') {
        if (actor.role !== Role.ADMIN) throw new NotFoundException('Listing not found');
        if (row.status !== PublicationStatus.IN_REVIEW)
          throw new BadRequestException('Only listings in review can be moderated');
        status = action === 'publish' ? PublicationStatus.PUBLISHED : PublicationStatus.DRAFT;
      } else if (action === 'submit') {
        if (row.status !== PublicationStatus.DRAFT)
          throw new BadRequestException('Only drafts can be submitted');
        status = PublicationStatus.IN_REVIEW;
      } else {
        if (row.status === PublicationStatus.ARCHIVED)
          throw new BadRequestException('Listing is already archived');
        status = PublicationStatus.ARCHIVED;
      }
      if (status === PublicationStatus.PUBLISHED || status === PublicationStatus.IN_REVIEW) {
        validateListingFacts(row);
        const rich = prepareRichContent({}, row, 'description', {
          minTextLength: 20,
          maxTextLength: 20000,
        });
        await assertRichMedia(tx, rich.mediaIds, actor, rich.existingMediaIds);
        if (rich.mediaIds.length || rich.existingMediaIds.length)
          await replaceRichMedia(tx, 'listing', id, rich.mediaIds);
        if (row.media.length === 0)
          throw new BadRequestException('At least one property image is required before review');
        await this.validateRelations(
          tx,
          {
            areaId: row.areaId,
            agentId: row.agentId,
            projectId: row.projectId,
            media: row.media,
            amenityIds: row.amenities.map((item) => item.amenityId),
          },
          actor,
          status === PublicationStatus.PUBLISHED,
          true,
        );
      }
      const updated = await tx.listing.update({
        where: { id },
        data: {
          status,
          publishedAt: status === PublicationStatus.PUBLISHED ? new Date() : null,
          version: { increment: 1 },
        },
      });
      await this.audit.record(
        actor.id,
        `listing.${action}`,
        'Listing',
        id,
        { fromStatus: row.status, toStatus: status },
        tx,
      );
      return updated;
    });
  }
  private assertVersion(row: ManagedListingRecord, version: number) {
    if (row.version !== version)
      throw new ConflictException('Listing changed; reload it before retrying');
  }
  private scalars(dto: CreateListingDto | UpdateListingDto) {
    return defined({
      slug: dto.slug,
      titleEn: dto.titleEn,
      titleAr: dto.titleAr,
      descriptionEn: dto.descriptionEn,
      descriptionAr: dto.descriptionAr,
      purpose: dto.purpose,
      propertyType: dto.propertyType,
      completion: dto.completion,
      availability: dto.availability,
      furnishing: dto.furnishing,
      priceAed: dto.priceAed,
      priceOnRequest: dto.priceOnRequest,
      previousPriceAed: dto.previousPriceAed,
      rentalPeriod: dto.rentalPeriod,
      areaSqm: dto.areaSqm,
      plotAreaSqm: dto.plotAreaSqm,
      bedrooms: dto.bedrooms,
      bathrooms: dto.bathrooms,
      parking: dto.parking,
      addressEn: dto.addressEn,
      addressAr: dto.addressAr,
      latitude: dto.latitude,
      longitude: dto.longitude,
      vacantOn: dateValue(dto.vacantOn),
      handoverDate: dateValue(dto.handoverDate),
      isExclusive: dto.isExclusive,
      permitNumber: dto.permitNumber,
      permitUrl: dto.permitUrl,
      areaId: dto.areaId,
      projectId: dto.projectId,
    });
  }
  private async validateRelations(
    tx: Prisma.TransactionClient,
    input: {
      areaId: string;
      agentId: string;
      projectId?: string | null;
      media: Pick<MediaAttachmentDto, 'mediaId'>[];
      amenityIds: string[];
    },
    actor: AuthUser,
    requirePublicAgent: boolean,
    existingMedia = false,
  ): Promise<void> {
    const area = await tx.area.findFirst({
      where: { id: input.areaId, isActive: true },
      select: { id: true },
    });
    if (!area) throw new BadRequestException('An active area is required');
    const agent = await tx.user.findFirst({
      where: {
        id: input.agentId,
        isActive: true,
        role: { in: [Role.AGENT, Role.ADMIN] },
        emailVerifiedAt: { not: null },
        ...(requirePublicAgent
          ? {
              agentProfile: {
                is: { isPublic: true, OR: [{ areaId: null }, { area: { isActive: true } }] },
              },
            }
          : {}),
      },
      select: { id: true },
    });
    if (!agent)
      throw new BadRequestException(
        'An active verified agent with a public profile is required to publish',
      );
    if (input.projectId) {
      const project = await tx.project.findFirst({
        where: {
          id: input.projectId,
          areaId: input.areaId,
          status: PublicationStatus.PUBLISHED,
          area: { isActive: true },
          developer: { isActive: true },
        },
        select: { id: true },
      });
      if (!project)
        throw new BadRequestException(
          'The project must be published and belong to the selected area',
        );
    }
    if (
      input.amenityIds.length &&
      (await tx.amenity.count({ where: { id: { in: input.amenityIds } } })) !==
        input.amenityIds.length
    )
      throw new BadRequestException('An amenity does not exist');
    if (input.media.length) {
      const ids = input.media.map((item) => item.mediaId);
      const count = await tx.media.count({
        where: {
          id: { in: ids },
          ...(!existingMedia && actor.role !== Role.ADMIN ? { ownerId: actor.id } : {}),
        },
      });
      if (count !== ids.length)
        throw new BadRequestException('Media does not exist or belongs to another user');
    }
  }
}
