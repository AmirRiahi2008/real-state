import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { Prisma, PublicationStatus, Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/auth-user';
import { paginated, PaginationDto } from '../common/pagination.dto';
import { MediaAttachmentDto } from '../listings/dto/listing.dto';
import { validateMediaAttachments } from '../listings/listing.policy';
import {
  CreateProjectDto,
  FloorPlanDto,
  PaymentMilestoneDto,
  ProjectTransitionDto,
  SearchProjectsDto,
  UpdateProjectDto,
} from './dto/project.dto';
import {
  validateFloorPlans,
  validatePaymentPlan,
  validateProjectFacts,
  validateProjectNulls,
  validateProjectSearch,
} from './project.policy';
import { ManagedProject, presentProject, ProjectsRepository } from './projects.repository';
import {
  prepareRichContent,
  assertRichMedia,
  replaceRichMedia,
} from '../rich-content/rich-content.policy';

const defined = <T extends object>(value: T): Partial<T> =>
  Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>;
const dateValue = (value: string | null | undefined): Date | null | undefined =>
  value === undefined ? undefined : value === null ? null : new Date(value);
function storedArray<T extends object>(
  value: Prisma.JsonValue,
  type: new () => T,
  maximum: number,
): T[] {
  if (!Array.isArray(value) || value.length > maximum)
    throw new BadRequestException('Stored project metadata is invalid');
  const result = plainToInstance(type, value);
  if (
    result.some(
      (item) => validateSync(item, { whitelist: true, forbidNonWhitelisted: true }).length,
    )
  )
    throw new BadRequestException('Stored project metadata needs correction before publishing');
  return result;
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly repository: ProjectsRepository,
    private readonly audit: AuditService,
  ) {}
  async findAll(query: SearchProjectsDto) {
    validateProjectSearch(query);
    const { rows, total } = await this.repository.publicPage(query);
    return paginated(rows.map(presentProject), total, query.page, query.limit);
  }
  async findOne(slug: string) {
    const row = await this.repository.publicOne(slug);
    if (!row) throw new NotFoundException('Project not found');
    return presentProject(row);
  }
  async managedPage(query: PaginationDto, actor: AuthUser) {
    this.requireAdmin(actor);
    const { rows, total } = await this.repository.managedPage(query.page, query.limit);
    return paginated(rows, total, query.page, query.limit);
  }
  async managedOne(id: string, actor: AuthUser) {
    this.requireAdmin(actor);
    const row = await this.repository.managedOne(id);
    if (!row) throw new NotFoundException('Project not found');
    return row;
  }
  async create(dto: CreateProjectDto, actor: AuthUser) {
    this.requireAdmin(actor);
    validateProjectNulls(dto);
    const rich = prepareRichContent(dto, undefined, 'description', {
      minTextLength: 20,
      maxTextLength: 20000,
    });
    validateProjectFacts({ ...dto, priceOnRequest: dto.priceOnRequest ?? false });
    validatePaymentPlan(dto.paymentPlan ?? []);
    validateFloorPlans(dto.floorPlans ?? [], dto.minBedrooms, dto.maxBedrooms);
    validateMediaAttachments(dto.media ?? []);
    return this.repository.transaction(async (tx) => {
      await this.validateRelations(tx, {
        developerId: dto.developerId,
        areaId: dto.areaId,
        media: dto.media ?? [],
        amenityIds: dto.amenityIds ?? [],
      });
      await assertRichMedia(tx, rich.mediaIds, actor);
      const row = await tx.project.create({
        data: {
          ...this.scalars(dto),
          ...rich.data,
          slug: dto.slug,
          nameEn: dto.nameEn,
          nameAr: dto.nameAr,
          descriptionEn: rich.textEn,
          descriptionAr: rich.textAr,
          minBedrooms: dto.minBedrooms,
          maxBedrooms: dto.maxBedrooms,
          propertyTypes: dto.propertyTypes,
          developerId: dto.developerId,
          areaId: dto.areaId,
          paymentPlan: this.paymentJson(dto.paymentPlan ?? []),
          floorPlans: this.floorJson(dto.floorPlans ?? []),
          status: PublicationStatus.DRAFT,
          media: { create: dto.media ?? [] },
          amenities: { create: (dto.amenityIds ?? []).map((amenityId) => ({ amenityId })) },
        },
      });
      if (rich.mediaIds.length || rich.existingMediaIds.length)
        await replaceRichMedia(tx, 'project', row.id, rich.mediaIds);
      await this.audit.record(actor.id, 'project.created', 'Project', row.id, {}, tx);
      return row;
    });
  }
  async update(id: string, dto: UpdateProjectDto, actor: AuthUser) {
    this.requireAdmin(actor);
    validateProjectNulls(dto);
    return this.repository.locked(id, async (row, tx) => {
      this.assertVersion(row, dto.version);
      if (row.status === PublicationStatus.ARCHIVED)
        throw new BadRequestException('Archived projects cannot be edited');
      const merged = { ...row, ...defined(dto) };
      validateProjectFacts(merged);
      const paymentPlan = dto.paymentPlan ?? storedArray(row.paymentPlan, PaymentMilestoneDto, 20);
      const floorPlans = dto.floorPlans ?? storedArray(row.floorPlans, FloorPlanDto, 50);
      validatePaymentPlan(paymentPlan);
      validateFloorPlans(floorPlans, merged.minBedrooms, merged.maxBedrooms);
      const rich = prepareRichContent(dto, row, 'description', {
        minTextLength: 20,
        maxTextLength: 20000,
      });
      await assertRichMedia(tx, rich.mediaIds, actor, rich.existingMediaIds);
      const media = dto.media ?? row.media;
      validateMediaAttachments(media);
      await this.validateRelations(tx, {
        developerId: merged.developerId,
        areaId: merged.areaId,
        media,
        amenityIds: dto.amenityIds ?? row.amenities.map((item) => item.amenityId),
      });
      if (dto.media !== undefined) {
        await tx.projectMedia.deleteMany({ where: { projectId: id } });
        await tx.projectMedia.createMany({
          data: dto.media.map((item) => ({ ...item, projectId: id })),
        });
      }
      if (dto.amenityIds !== undefined) {
        await tx.projectAmenity.deleteMany({ where: { projectId: id } });
        await tx.projectAmenity.createMany({
          data: dto.amenityIds.map((amenityId) => ({ amenityId, projectId: id })),
        });
      }
      const updated = await tx.project.update({
        where: { id },
        data: {
          ...this.scalars(dto),
          ...rich.data,
          paymentPlan: dto.paymentPlan ? this.paymentJson(dto.paymentPlan) : undefined,
          floorPlans: dto.floorPlans ? this.floorJson(dto.floorPlans) : undefined,
          status:
            row.status === PublicationStatus.PUBLISHED
              ? PublicationStatus.IN_REVIEW
              : PublicationStatus.DRAFT,
          publishedAt: null,
          version: { increment: 1 },
        },
      });
      if (rich.mediaIds.length || rich.existingMediaIds.length)
        await replaceRichMedia(tx, 'project', id, rich.mediaIds);
      await this.audit.record(
        actor.id,
        'project.updated',
        'Project',
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
    dto: ProjectTransitionDto,
    actor: AuthUser,
  ) {
    this.requireAdmin(actor);
    return this.repository.locked(id, async (row, tx) => {
      this.assertVersion(row, dto.version);
      let status: PublicationStatus;
      if (action === 'publish' || action === 'reject') {
        if (row.status !== PublicationStatus.IN_REVIEW)
          throw new BadRequestException('Only projects in review can be moderated');
        status = action === 'publish' ? PublicationStatus.PUBLISHED : PublicationStatus.DRAFT;
      } else if (action === 'submit') {
        if (row.status !== PublicationStatus.DRAFT)
          throw new BadRequestException('Only drafts can be submitted');
        status = PublicationStatus.IN_REVIEW;
      } else {
        if (row.status === PublicationStatus.ARCHIVED)
          throw new BadRequestException('Project is already archived');
        status = PublicationStatus.ARCHIVED;
      }
      if (status === PublicationStatus.PUBLISHED || status === PublicationStatus.IN_REVIEW) {
        validateProjectFacts(row);
        const rich = prepareRichContent({}, row, 'description', {
          minTextLength: 20,
          maxTextLength: 20000,
        });
        await assertRichMedia(tx, rich.mediaIds, actor, rich.existingMediaIds);
        if (rich.mediaIds.length || rich.existingMediaIds.length)
          await replaceRichMedia(tx, 'project', id, rich.mediaIds);
        validatePaymentPlan(storedArray(row.paymentPlan, PaymentMilestoneDto, 20));
        validateFloorPlans(
          storedArray(row.floorPlans, FloorPlanDto, 50),
          row.minBedrooms,
          row.maxBedrooms,
        );
        if (!row.handoverDate || !row.media.length)
          throw new BadRequestException(
            'A handover estimate and at least one image are required before review',
          );
        await this.validateRelations(tx, {
          developerId: row.developerId,
          areaId: row.areaId,
          media: row.media,
          amenityIds: row.amenities.map((item) => item.amenityId),
        });
      }
      const updated = await tx.project.update({
        where: { id },
        data: {
          status,
          publishedAt: status === PublicationStatus.PUBLISHED ? new Date() : null,
          version: { increment: 1 },
        },
      });
      await this.audit.record(
        actor.id,
        `project.${action}`,
        'Project',
        id,
        { fromStatus: row.status, toStatus: status },
        tx,
      );
      return updated;
    });
  }
  private requireAdmin(actor: AuthUser): void {
    if (actor.role !== Role.ADMIN) throw new ForbiddenException('Administrator access required');
  }
  private assertVersion(row: ManagedProject, version: number): void {
    if (row.version !== version)
      throw new ConflictException('Project changed; reload it before retrying');
  }
  private paymentJson(items: PaymentMilestoneDto[]): Prisma.InputJsonArray {
    return items.map((item) => ({
      labelEn: item.labelEn,
      labelAr: item.labelAr,
      percentage: item.percentage,
    }));
  }
  private floorJson(items: FloorPlanDto[]): Prisma.InputJsonArray {
    return items.map((item) => ({
      nameEn: item.nameEn,
      nameAr: item.nameAr,
      bedrooms: item.bedrooms,
      areaSqm: item.areaSqm,
    }));
  }
  private scalars(dto: CreateProjectDto | UpdateProjectDto) {
    return defined({
      slug: dto.slug,
      nameEn: dto.nameEn,
      nameAr: dto.nameAr,
      descriptionEn: dto.descriptionEn,
      descriptionAr: dto.descriptionAr,
      startingPriceAed: dto.startingPriceAed,
      priceOnRequest: dto.priceOnRequest,
      handoverDate: dateValue(dto.handoverDate),
      minBedrooms: dto.minBedrooms,
      maxBedrooms: dto.maxBedrooms,
      propertyTypes: dto.propertyTypes,
      latitude: dto.latitude,
      longitude: dto.longitude,
      developerId: dto.developerId,
      areaId: dto.areaId,
    });
  }
  private async validateRelations(
    tx: Prisma.TransactionClient,
    input: {
      areaId: string;
      developerId: string;
      media: Pick<MediaAttachmentDto, 'mediaId'>[];
      amenityIds: string[];
    },
  ): Promise<void> {
    if (
      !(await tx.area.findFirst({
        where: { id: input.areaId, isActive: true },
        select: { id: true },
      }))
    )
      throw new BadRequestException('An active area is required');
    if (
      !(await tx.developer.findFirst({
        where: { id: input.developerId, isActive: true },
        select: { id: true },
      }))
    )
      throw new BadRequestException('An active developer is required');
    if (
      input.amenityIds.length &&
      (await tx.amenity.count({ where: { id: { in: input.amenityIds } } })) !==
        input.amenityIds.length
    )
      throw new BadRequestException('An amenity does not exist');
    if (
      input.media.length &&
      (await tx.media.count({ where: { id: { in: input.media.map((item) => item.mediaId) } } })) !==
        input.media.length
    )
      throw new BadRequestException('Media does not exist');
  }
}
