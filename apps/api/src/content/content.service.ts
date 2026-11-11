import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PublicationStatus } from '@prisma/client';
import { AuthUser } from '../auth/auth-user';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { paginated } from '../common/pagination.dto';
import { ContentRepository } from './content.repository';
import {
  ContentQueryDto,
  ContentTransitionDto,
  CreateContentDto,
  UpdateContentDto,
} from './content.dto';

@Injectable()
export class ContentService {
  constructor(
    private readonly repository: ContentRepository,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}
  async list(query: ContentQueryDto, publicOnly = true) {
    const [data, total] = await this.repository.list(query, publicOnly);
    return paginated(data, total, query.page, query.limit);
  }
  async detail(slug: string) {
    const article = await this.repository.bySlug(slug);
    if (!article) throw new NotFoundException('Content not found');
    return article;
  }
  async managed(id: string) {
    const article = await this.repository.managed(id);
    if (!article) throw new NotFoundException('Content not found');
    return article;
  }
  async create(dto: CreateContentDto, actor: AuthUser) {
    return this.prisma.$transaction(async (db) => {
      await this.validateReferences(db, dto, actor);
      const article = await db.article.create({ data: dto });
      await this.audit.record(actor.id, 'content.create', 'Article', article.id, {}, db);
      return article;
    });
  }
  async update(id: string, dto: UpdateContentDto, actor: AuthUser) {
    return this.prisma.$transaction(async (db) => {
      const current = await db.article.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Content not found');
      await this.validateReferences(db, dto, actor);
      const { version, ...data } = dto;
      const changed = await db.article.updateMany({
        where: { id, version },
        data: {
          ...data,
          status: PublicationStatus.DRAFT,
          publishedAt: null,
          version: { increment: 1 },
        },
      });
      if (!changed.count)
        throw new ConflictException('Content changed; reload the current version before editing');
      await this.audit.record(actor.id, 'content.update', 'Article', id, {}, db);
      return db.article.findUniqueOrThrow({ where: { id } });
    });
  }
  async transition(
    id: string,
    dto: ContentTransitionDto,
    status: PublicationStatus,
    actor: AuthUser,
  ) {
    return this.prisma.$transaction(async (db) => {
      const current = await db.article.findUnique({ where: { id } });
      if (!current) throw new NotFoundException('Content not found');
      if (current.version !== dto.version)
        throw new ConflictException('Content changed; reload its current version');
      if (status === PublicationStatus.PUBLISHED) {
        if (current.status === PublicationStatus.ARCHIVED)
          throw new BadRequestException('Edit archived content into a draft before publishing');
        await this.validateReferences(db, current, actor, true);
      }
      const result = await db.article.updateMany({
        where: { id, version: dto.version },
        data: {
          status,
          publishedAt: status === PublicationStatus.PUBLISHED ? new Date() : null,
          version: { increment: 1 },
        },
      });
      if (!result.count) throw new ConflictException('Content changed; reload its current version');
      await this.audit.record(
        actor.id,
        status === PublicationStatus.PUBLISHED ? 'content.publish' : 'content.archive',
        'Article',
        id,
        {},
        db,
      );
      return db.article.findUniqueOrThrow({ where: { id } });
    });
  }
  private async validateReferences(
    db: Prisma.TransactionClient,
    dto: Pick<CreateContentDto, 'areaId' | 'coverMediaId'>,
    actor: AuthUser,
    existingPublication = false,
  ) {
    if (
      dto.areaId &&
      !(await db.area.findFirst({
        where: { id: dto.areaId, isActive: true },
        select: { id: true },
      }))
    )
      throw new BadRequestException('Area not found or inactive');
    if (dto.coverMediaId) {
      const media = await db.media.findUnique({
        where: { id: dto.coverMediaId },
        select: { ownerId: true },
      });
      if (!media || (!existingPublication && media.ownerId !== actor.id))
        throw new BadRequestException('Cover must be an image uploaded by this administrator');
    }
  }
}
