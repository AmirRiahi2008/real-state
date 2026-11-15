import { NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Prisma, Role } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AuthUser } from '../auth/auth-user';
import { hashToken, randomToken } from '../auth/token.utils';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { MediaService } from '../media/media.service';
import { RolesGuard } from '../auth/roles.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { TeamConversationsService } from './team-conversations.service';
import { TeamProfilesService } from './team-profiles.service';
import { CreateTeamConversationDto, UpdateTeamProfileDto } from './team.dto';
import { presentTeamMember, publicTeamWhere } from './team.policy';

const actor: AuthUser = {
  id: randomUUID(),
  email: 'team@example.test',
  role: Role.TEAM_MEMBER,
  sessionId: randomUUID(),
};
const member = {
  id: randomUUID(),
  slug: 'synthetic-team',
  displayName: 'Synthetic Person',
  titleEn: 'Manager',
  titleAr: 'مدير',
  bioEn: '',
  bioAr: '',
  avatarMediaId: randomUUID(),
  updatedAt: new Date(),
};
const audit = { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService;

describe('limited team profile policy', () => {
  it('does not expose account identity or internal image keys in public projection', () => {
    const result = presentTeamMember({
      ...member,
      userId: actor.id,
      passwordHash: 'private',
      email: actor.email,
    } as typeof member);
    // The database selector supplies only declared public columns; never include account fields.
    expect(publicTeamWhere.user).toEqual({
      isActive: true,
      role: { in: [Role.TEAM_MEMBER, Role.ADMIN] },
    });
    expect(presentTeamMember(member)).not.toHaveProperty('avatarMediaId');
    expect(presentTeamMember(member).photoUrl).toBe(`/api/v1/media/${member.avatarMediaId}/file`);
    expect(result).toHaveProperty('displayName');
    for (const key of ['email', 'userId', 'passwordHash', 'avatarMediaId'])
      expect(result).not.toHaveProperty(key);
  });

  it('rejects role, account and publication changes in self-service input', async () => {
    const errors = await validate(
      plainToInstance(UpdateTeamProfileDto, {
        role: Role.ADMIN,
        userId: randomUUID(),
        email: 'other@example.test',
        isPublic: false,
      }),
      { whitelist: true, forbidNonWhitelisted: true },
    );
    expect(errors.map((error) => error.property).sort()).toEqual([
      'email',
      'isPublic',
      'role',
      'userId',
    ]);
    for (const field of ['displayName', 'titleEn', 'titleAr', 'bioEn', 'bioAr']) {
      const invalid = await validate(plainToInstance(UpdateTeamProfileDto, { [field]: null }));
      expect(invalid.some((error) => error.property === field)).toBe(true);
    }
  });

  it('never grants inventory access to a TEAM_MEMBER even if its display title says administrator', async () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValueOnce(false)
        .mockReturnValueOnce([Role.AGENT, Role.ADMIN]),
    } as unknown as Reflector;
    const context = {
      getHandler: () => null,
      getClass: () => null,
      switchToHttp: () => ({ getRequest: () => ({ method: 'POST', user: actor }) }),
    } as unknown as ExecutionContext;
    const guard = new RolesGuard(reflector, {} as PrismaService);
    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 403 });
  });

  it('requires ownership before attaching a photo and never updates the profile on another owner image', async () => {
    const update = jest.fn();
    const db = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      teamProfile: {
        findFirst: jest.fn().mockResolvedValue({ ...member, user: { email: actor.email } }),
        update,
      },
      media: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const prisma = {
      $transaction: async <T>(work: (tx: Prisma.TransactionClient) => Promise<T>) =>
        work(db as unknown as Prisma.TransactionClient),
    } as unknown as PrismaService;
    const service = new TeamProfilesService(prisma, audit, {} as MediaService);
    const imageId = randomUUID();
    await expect(service.updateOwn(actor, { avatarMediaId: imageId })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(db.media.findFirst).toHaveBeenCalledWith({
      where: { id: imageId, ownerId: actor.id },
      select: { id: true },
    });
    expect(update).not.toHaveBeenCalled();
  });
});

describe('private conversation boundaries', () => {
  it('requires explicit consent, a bounded message and rejects sender spoofing', async () => {
    const invalid = await validate(
      plainToInstance(CreateTeamConversationDto, {
        memberId: randomUUID(),
        name: 'Synthetic',
        email: 'synthetic@example.test',
        body: 'hello',
        consent: false,
        sender: 'STAFF',
      }),
      { whitelist: true, forbidNonWhitelisted: true },
    );
    expect(invalid.map((error) => error.property)).toEqual(
      expect.arrayContaining(['consent', 'sender']),
    );
  });

  it('hashes the 256-bit receipt and never places plaintext tokens or message bodies in the audit', async () => {
    const create = jest.fn(async (_input: Prisma.TeamConversationCreateArgs) => ({
      id: randomUUID(),
      memberId: member.id,
      visitorName: 'Synthetic',
      visitorEmail: 'visitor@example.test',
      createdAt: new Date(),
      updatedAt: new Date(),
      member,
      messages: [{ id: randomUUID(), body: 'Question', sender: 'VISITOR', createdAt: new Date() }],
    }));
    const db = {
      teamProfile: { findFirst: jest.fn().mockResolvedValue({ id: member.id }) },
      teamConversation: { create },
    };
    const prisma = {
      $transaction: async <T>(work: (tx: Prisma.TransactionClient) => Promise<T>) =>
        work(db as unknown as Prisma.TransactionClient),
    } as unknown as PrismaService;
    const record = jest.fn().mockResolvedValue(undefined);
    const service = new TeamConversationsService(prisma, { record } as unknown as AuditService);
    const result = await service.create({
      memberId: member.id,
      name: 'Synthetic',
      email: 'visitor@example.test',
      body: 'Question',
      consent: true,
    });
    const data = create.mock.calls[0][0].data;
    expect(result.accessToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(data.visitorTokenHash).toBe(hashToken(result.accessToken));
    expect(JSON.stringify(data)).not.toContain(result.accessToken);
    expect(JSON.stringify(record.mock.calls)).not.toContain('Question');
    expect(JSON.stringify(result)).not.toContain('visitorTokenHash');
  });

  it('scopes every staff reply to its authenticated profile and rejects cross-member IDs before inserting', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const create = jest.fn();
    const db = { teamConversation: { updateMany }, teamMessage: { create } };
    const prisma = {
      $transaction: async <T>(work: (tx: Prisma.TransactionClient) => Promise<T>) =>
        work(db as unknown as Prisma.TransactionClient),
    } as unknown as PrismaService;
    const service = new TeamConversationsService(prisma, audit);
    await expect(service.reply(actor, randomUUID(), { body: 'Not mine' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          member: {
            userId: actor.id,
            user: { isActive: true, role: { in: [Role.TEAM_MEMBER, Role.ADMIN] } },
          },
        }),
      }),
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('binds a visitor receipt to the requested conversation and enforces expiry in the write itself', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const create = jest.fn();
    const db = {
      teamConversation: { updateMany, findFirst: jest.fn().mockResolvedValue(null) },
      teamMessage: { create },
    };
    const prisma = {
      teamConversation: db.teamConversation,
      $transaction: async <T>(work: (tx: Prisma.TransactionClient) => Promise<T>) =>
        work(db as unknown as Prisma.TransactionClient),
    } as unknown as PrismaService;
    const service = new TeamConversationsService(prisma, audit);
    const id = randomUUID(),
      token = randomToken();
    await expect(service.visitorMessage(id, token, { body: 'private' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id,
          visitorTokenHash: hashToken(token),
          visitorTokenExpiresAt: { gt: expect.any(Date) },
        }),
      }),
    );
    expect(create).not.toHaveBeenCalled();
    await expect(service.visitorThread(id, 'invalid', {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('validates a pagination cursor inside the authorized conversation rather than using a foreign message cursor', async () => {
    const findMany = jest.fn();
    const prisma = {
      teamConversation: {
        findFirst: jest.fn().mockResolvedValue({
          id: randomUUID(),
          memberId: member.id,
          visitorName: 'Synthetic',
          visitorEmail: 'visitor@example.test',
          createdAt: new Date(),
          updatedAt: new Date(),
          member,
        }),
      },
      teamMessage: { findFirst: jest.fn().mockResolvedValue(null), findMany },
    } as unknown as PrismaService;
    const service = new TeamConversationsService(prisma, audit);
    await expect(
      service.staffThread(actor, randomUUID(), { before: randomUUID() }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(findMany).not.toHaveBeenCalled();
  });
});
