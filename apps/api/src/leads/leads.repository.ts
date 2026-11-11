import { Injectable, NotFoundException } from '@nestjs/common';
import { Lead, Prisma, Role } from '@prisma/client';
import { AuthUser } from '../auth/auth-user';
import { PrismaService } from '../database/prisma.service';
import { LeadQueryDto } from './leads.dto';

export const managedLeadSelect = {
  id: true,
  type: true,
  status: true,
  name: true,
  email: true,
  phone: true,
  message: true,
  preferredAt: true,
  consent: true,
  listingId: true,
  projectId: true,
  assignedToId: true,
  internalNotes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.LeadSelect;

export const leadOwnerScope = (actor: AuthUser): Prisma.LeadWhereInput =>
  actor.role === Role.ADMIN ? {} : { assignedToId: actor.id };

@Injectable()
export class LeadsRepository {
  constructor(private readonly prisma: PrismaService) {}
  async list(actor: AuthUser, query: LeadQueryDto) {
    const where: Prisma.LeadWhereInput = {
      ...leadOwnerScope(actor),
      status: query.status,
      type: query.type,
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.lead.findMany({
        where,
        select: managedLeadSelect,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      }),
      this.prisma.lead.count({ where }),
    ]);
    return { rows, total };
  }
  async one(id: string, actor: AuthUser) {
    const row = await this.prisma.lead.findFirst({
      where: { id, ...leadOwnerScope(actor) },
      select: managedLeadSelect,
    });
    if (!row) throw new NotFoundException('Lead not found');
    return row;
  }
  transaction<T>(work: (db: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(work);
  }
  locked<T>(
    id: string,
    actor: AuthUser,
    work: (lead: Lead, db: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (db) => {
      await db.$queryRaw`SELECT "id" FROM "Lead" WHERE "id" = ${id}::uuid FOR UPDATE`;
      const lead = await db.lead.findFirst({ where: { id, ...leadOwnerScope(actor) } });
      if (!lead) throw new NotFoundException('Lead not found');
      return work(lead, db);
    });
  }
}
