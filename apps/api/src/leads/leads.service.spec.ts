import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LeadStatus, LeadType, Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/auth-user';
import { PrismaService } from '../database/prisma.service';
import { publicListingWhere } from '../listings/listings.repository';
import { publicProjectWhere } from '../projects/projects.repository';
import { CreateLeadDto } from './leads.dto';
import { LeadsRepository } from './leads.repository';
import { LeadsService } from './leads.service';

const actor: AuthUser = {
  id: 'agent-a',
  email: 'agent@example.test',
  role: Role.AGENT,
  sessionId: 'session-a',
};
const request = (extra: Partial<CreateLeadDto> = {}): CreateLeadDto => ({
  type: LeadType.ENQUIRY,
  name: 'Example buyer',
  email: 'buyer@example.test',
  phone: '+971501234567',
  message: 'Please share the property details.',
  consent: true,
  listingId: 'listing-a',
  ...extra,
});

describe('lead contact privacy and target access', () => {
  function setup() {
    const db = {
      listing: { findFirst: jest.fn().mockResolvedValue({ agentId: 'agent-a' }) },
      project: { findFirst: jest.fn().mockResolvedValue({ id: 'project-a' }) },
      lead: { create: jest.fn().mockResolvedValue({ id: 'lead-a' }), update: jest.fn() },
      user: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const repository = {
      transaction: (work: (tx: unknown) => Promise<unknown>) => work(db),
      locked: jest.fn(),
    };
    const audit = { record: jest.fn() };
    return {
      db,
      repository,
      audit,
      service: new LeadsService(
        repository as unknown as LeadsRepository,
        audit as unknown as AuditService,
      ),
    };
  }

  it('assigns a listing enquiry server-side and returns no identifier or contact data', async () => {
    const { db, audit, service } = setup();
    const result = await service.create(request());
    expect(db.listing.findFirst).toHaveBeenCalledWith({
      where: { AND: [publicListingWhere, { id: 'listing-a' }] },
      select: { agentId: true },
    });
    expect(db.lead.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ assignedToId: 'agent-a', listingId: 'listing-a' }),
      }),
    );
    expect(Object.keys(result)).toEqual(['message']);
    const auditMetadata = audit.record.mock.calls[0]?.[4];
    expect(auditMetadata).toEqual({ type: LeadType.ENQUIRY });
    expect(JSON.stringify(auditMetadata)).not.toContain('buyer@example.test');
  });

  it('rejects an unavailable listing before persisting contact details', async () => {
    const { db, audit, service } = setup();
    db.listing.findFirst.mockResolvedValue(null);
    await expect(service.create(request())).rejects.toThrow(NotFoundException);
    expect(db.lead.create).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('requires the project to pass the public project scope', async () => {
    const { db, service } = setup();
    db.project.findFirst.mockResolvedValue(null);
    await expect(
      service.create(
        request({ type: LeadType.PROJECT, listingId: undefined, projectId: 'project-a' }),
      ),
    ).rejects.toThrow(NotFoundException);
    expect(db.project.findFirst).toHaveBeenCalledWith({
      where: { AND: [publicProjectWhere, { id: 'project-a' }] },
      select: { id: true },
    });
    expect(db.lead.create).not.toHaveBeenCalled();
  });

  it('cannot mass-assign internal fields even when called outside the HTTP validation boundary', async () => {
    const { db, service } = setup();
    await service.create(
      Object.assign(request(), {
        status: LeadStatus.CLOSED,
        assignedToId: 'intruder',
        internalNotes: 'private',
      }),
    );
    const data = db.lead.create.mock.calls[0]?.[0]?.data;
    expect(data.assignedToId).toBe('agent-a');
    expect(data).not.toHaveProperty('status');
    expect(data).not.toHaveProperty('internalNotes');
  });

  it('refuses administrative assignment to an unverified or inactive user', async () => {
    const { db, repository, service } = setup();
    repository.locked.mockImplementation(
      (_id: string, _actor: AuthUser, work: (lead: unknown, tx: unknown) => Promise<unknown>) =>
        work({ status: LeadStatus.NEW, assignedToId: null }, db),
    );
    await expect(
      service.update('lead-a', { assignedToId: 'unverified' }, { ...actor, role: Role.ADMIN }),
    ).rejects.toThrow(BadRequestException);
    expect(db.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          emailVerifiedAt: { not: null },
          role: { in: [Role.AGENT, Role.ADMIN] },
        }),
      }),
    );
    expect(db.lead.update).not.toHaveBeenCalled();
  });
});

describe('lead owner enforcement', () => {
  it("returns not found when an agent requests another agent's lead", async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const repository = new LeadsRepository({ lead: { findFirst } } as unknown as PrismaService);
    await expect(repository.one('other-lead', actor)).rejects.toThrow(NotFoundException);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'other-lead', assignedToId: actor.id } }),
    );
  });

  it('rechecks assignment under the row lock before an agent can mutate the lead', async () => {
    const db = { $queryRaw: jest.fn(), lead: { findFirst: jest.fn().mockResolvedValue(null) } };
    const prisma = { $transaction: (work: (tx: unknown) => Promise<unknown>) => work(db) };
    const work = jest.fn();
    const repository = new LeadsRepository(prisma as unknown as PrismaService);
    await expect(repository.locked('other-lead', actor, work)).rejects.toThrow(NotFoundException);
    expect(db.$queryRaw).toHaveBeenCalled();
    expect(db.lead.findFirst).toHaveBeenCalledWith({
      where: { id: 'other-lead', assignedToId: actor.id },
    });
    expect(work).not.toHaveBeenCalled();
  });
});
