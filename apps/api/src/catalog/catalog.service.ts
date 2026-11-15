import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Area, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/auth-user';
import { paginated } from '../common/pagination.dto';
import { CatalogRepository } from './catalog.repository';
import {
  AreaQueryDto,
  CatalogQueryDto,
  CreateAgentProfileDto,
  CreateAmenityDto,
  CreateAreaDto,
  CreateDeveloperDto,
  UpdateAgentProfileDto,
  UpdateAmenityDto,
  UpdateAreaDto,
  UpdateDeveloperDto,
} from './catalog.dto';

export function requireCoordinatePair(latitude: unknown, longitude: unknown): void {
  if ((latitude == null) !== (longitude == null))
    throw new BadRequestException('Latitude and longitude must be supplied or cleared together');
}

@Injectable()
export class CatalogService {
  constructor(
    private readonly repository: CatalogRepository,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}
  async areas(query: AreaQueryDto) {
    const [data, total] = await this.repository.areas(query);
    return paginated(data, total, query.page, query.limit);
  }
  async developers(query: CatalogQueryDto) {
    const [data, total] = await this.repository.developers(query);
    return paginated(data, total, query.page, query.limit);
  }
  async agents(query: CatalogQueryDto) {
    const [data, total] = await this.repository.agents(query);
    return paginated(data, total, query.page, query.limit);
  }
  async amenities(query: CatalogQueryDto) {
    const [data, total] = await this.repository.amenities(query);
    return paginated(data, total, query.page, query.limit);
  }
  async area(slug: string) {
    const area = await this.repository.area(slug);
    if (!area) throw new NotFoundException('Area not found');
    return area;
  }
  async developer(slug: string) {
    const developer = await this.repository.developer(slug);
    if (!developer) throw new NotFoundException('Developer not found');
    return developer;
  }
  async agent(slug: string) {
    const agent = await this.repository.agent(slug);
    if (!agent) throw new NotFoundException('Agent not found');
    return agent;
  }
  autocomplete(query: CatalogQueryDto) {
    if (!query.q || query.q.length < 2) return [];
    return this.repository.autocomplete(query.q);
  }

  async createArea(dto: CreateAreaDto, actor: AuthUser) {
    return this.prisma.$transaction(async (db) => {
      await db.$executeRaw`SELECT pg_advisory_xact_lock(86601)`;
      await this.validateArea(db, dto);
      const area = await db.area.create({ data: dto });
      await this.audit.record(actor.id, 'area.create', 'Area', area.id, {}, db);
      return area;
    });
  }
  async updateArea(id: string, dto: UpdateAreaDto, actor: AuthUser) {
    return this.prisma.$transaction(async (db) => {
      await db.$executeRaw`SELECT pg_advisory_xact_lock(86601)`;
      const existing = await db.area.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Area not found');
      await this.validateArea(db, dto, existing);
      const area = await db.area.update({ where: { id }, data: dto });
      await this.audit.record(actor.id, 'area.update', 'Area', id, {}, db);
      return area;
    });
  }
  private async validateArea(db: Prisma.TransactionClient, dto: UpdateAreaDto, existing?: Area) {
    const parentId = dto.parentId !== undefined ? dto.parentId : existing?.parentId;
    const emirate = dto.emirate ?? existing?.emirate;
    const active = dto.isActive ?? existing?.isActive ?? true;
    requireCoordinatePair(
      dto.latitude !== undefined ? dto.latitude : existing?.latitude,
      dto.longitude !== undefined ? dto.longitude : existing?.longitude,
    );
    const seen = new Set<string>(existing ? [existing.id] : []);
    let cursor = parentId;
    while (cursor) {
      if (seen.has(cursor) || seen.size >= 100)
        throw new BadRequestException(
          'Area hierarchy would contain a cycle or exceed its depth limit',
        );
      seen.add(cursor);
      const parent = await db.area.findUnique({
        where: { id: cursor },
        select: { parentId: true, emirate: true, isActive: true },
      });
      if (!parent) throw new BadRequestException('Parent area does not exist');
      if (parent.emirate !== emirate)
        throw new BadRequestException('Parent and child areas must belong to the same emirate');
      if (active && !parent.isActive)
        throw new BadRequestException('An active area cannot have an inactive parent');
      cursor = parent.parentId;
    }
    if (existing && (emirate !== existing.emirate || !active)) {
      const children = await db.area.count({
        where: { parentId: existing.id, ...(active ? {} : { isActive: true }) },
      });
      if (children)
        throw new BadRequestException(
          'Update child areas before changing their parent emirate or deactivating their parent',
        );
    }
  }
  async createDeveloper(dto: CreateDeveloperDto, actor: AuthUser) {
    return this.prisma.$transaction(async (db) => {
      const entity = await db.developer.create({ data: dto });
      await this.audit.record(actor.id, 'developer.create', 'Developer', entity.id, {}, db);
      return entity;
    });
  }
  async updateDeveloper(id: string, dto: UpdateDeveloperDto, actor: AuthUser) {
    return this.prisma.$transaction(async (db) => {
      const entity = await db.developer.update({ where: { id }, data: dto });
      await this.audit.record(actor.id, 'developer.update', 'Developer', id, {}, db);
      return entity;
    });
  }
  async createAmenity(dto: CreateAmenityDto, actor: AuthUser) {
    return this.prisma.$transaction(async (db) => {
      const entity = await db.amenity.create({ data: dto });
      await this.audit.record(actor.id, 'amenity.create', 'Amenity', entity.id, {}, db);
      return entity;
    });
  }
  async updateAmenity(id: string, dto: UpdateAmenityDto, actor: AuthUser) {
    return this.prisma.$transaction(async (db) => {
      const entity = await db.amenity.update({ where: { id }, data: dto });
      await this.audit.record(actor.id, 'amenity.update', 'Amenity', id, {}, db);
      return entity;
    });
  }
  async createAgent(dto: CreateAgentProfileDto, actor: AuthUser) {
    return this.prisma.$transaction(async (db) => {
      await this.validateAgent(db, dto.userId, dto, actor);
      const entity = await db.agentProfile.create({ data: dto });
      await this.audit.record(actor.id, 'agent-profile.create', 'AgentProfile', entity.id, {}, db);
      return entity;
    });
  }
  async updateAgent(id: string, dto: UpdateAgentProfileDto, actor: AuthUser) {
    return this.prisma.$transaction(async (db) => {
      const existing = await db.agentProfile.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Agent not found');
      await this.validateAgent(
        db,
        existing.userId,
        { ...existing, ...dto },
        actor,
        dto.photoMediaId === undefined || dto.photoMediaId === existing.photoMediaId,
      );
      const entity = await db.agentProfile.update({ where: { id }, data: dto });
      await this.audit.record(actor.id, 'agent-profile.update', 'AgentProfile', id, {}, db);
      return entity;
    });
  }
  private async validateAgent(
    db: Prisma.TransactionClient,
    userId: string,
    dto: Pick<UpdateAgentProfileDto, 'areaId' | 'photoMediaId' | 'isPublic'>,
    actor: AuthUser,
    existingPhoto = false,
  ) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { role: true, isActive: true, emailVerifiedAt: true },
    });
    if (!user || ![Role.AGENT, Role.ADMIN].includes(user.role as 'AGENT' | 'ADMIN'))
      throw new BadRequestException('Agent profile requires an agent or administrator account');
    if (dto.isPublic && (!user.isActive || !user.emailVerifiedAt))
      throw new BadRequestException('Public agents must have an active verified account');
    if (
      dto.areaId &&
      !(await db.area.findFirst({
        where: { id: dto.areaId, isActive: true },
        select: { id: true },
      }))
    )
      throw new BadRequestException('Area not found or inactive');
    if (
      dto.photoMediaId &&
      !(await db.media.findFirst({
        where: {
          id: dto.photoMediaId,
          ...(!existingPhoto && actor.role !== Role.ADMIN
            ? { ownerId: { in: [actor.id, userId] } }
            : {}),
        },
        select: { id: true },
      }))
    )
      throw new BadRequestException(
        'Photo must be uploaded by this administrator or the profile owner',
      );
  }
}
