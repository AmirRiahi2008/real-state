import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { AuthUser } from '../auth/auth-user';
import { AuditService } from '../audit/audit.service';
import { paginated } from '../common/pagination.dto';
import { publicListingWhere } from '../listings/listings.repository';
import { publicProjectWhere } from '../projects/projects.repository';
import { validateLeadInput, validateLeadUpdate } from './lead.policy';
import { CreateLeadDto, LeadQueryDto, UpdateLeadDto } from './leads.dto';
import { LeadsRepository, managedLeadSelect } from './leads.repository';

@Injectable()
export class LeadsService {
  constructor(
    private readonly repository: LeadsRepository,
    private readonly audit: AuditService,
  ) {}
  async create(dto: CreateLeadDto) {
    validateLeadInput(dto);
    await this.repository.transaction(async (db) => {
      let assignedToId: string | null = null;
      if (dto.listingId) {
        const listing = await db.listing.findFirst({
          where: { AND: [publicListingWhere, { id: dto.listingId }] },
          select: { agentId: true },
        });
        if (!listing) throw new NotFoundException('Listing not found');
        assignedToId = listing.agentId;
      }
      if (
        dto.projectId &&
        !(await db.project.findFirst({
          where: { AND: [publicProjectWhere, { id: dto.projectId }] },
          select: { id: true },
        }))
      )
        throw new NotFoundException('Project not found');
      const lead = await db.lead.create({
        data: {
          type: dto.type,
          name: dto.name,
          email: dto.email,
          phone: dto.phone,
          message: dto.message,
          consent: dto.consent,
          listingId: dto.listingId,
          projectId: dto.projectId,
          preferredAt: dto.preferredAt ? new Date(dto.preferredAt) : undefined,
          assignedToId,
        },
        select: { id: true },
      });
      await this.audit.record(null, 'lead.created', 'Lead', lead.id, { type: dto.type }, db);
    });
    // The public response deliberately contains neither contact details nor a lookup identifier.
    return { message: 'Your request has been received. Our team will contact you.' };
  }
  async list(actor: AuthUser, query: LeadQueryDto) {
    const { rows, total } = await this.repository.list(actor, query);
    return paginated(rows, total, query.page, query.limit);
  }
  one(id: string, actor: AuthUser) {
    return this.repository.one(id, actor);
  }
  async update(id: string, dto: UpdateLeadDto, actor: AuthUser) {
    return this.repository.locked(id, actor, async (lead, db) => {
      validateLeadUpdate(lead.status, dto, actor.role);
      if (dto.assignedToId) await this.validateAssignee(db, dto.assignedToId);
      const updated = await db.lead.update({
        where: { id },
        data: {
          status: dto.status,
          internalNotes: dto.internalNotes,
          assignedToId: dto.assignedToId,
        },
        select: managedLeadSelect,
      });
      await this.audit.record(
        actor.id,
        'lead.updated',
        'Lead',
        id,
        {
          fromStatus: lead.status,
          toStatus: updated.status,
          assignmentChanged:
            dto.assignedToId !== undefined && dto.assignedToId !== lead.assignedToId,
        },
        db,
      );
      return updated;
    });
  }
  private async validateAssignee(db: Prisma.TransactionClient, id: string): Promise<void> {
    const user = await db.user.findFirst({
      where: {
        id,
        role: { in: [Role.AGENT, Role.ADMIN] },
        isActive: true,
        emailVerifiedAt: { not: null },
      },
      select: { id: true },
    });
    if (!user)
      throw new BadRequestException('Assignment requires an active verified staff account');
  }
}
