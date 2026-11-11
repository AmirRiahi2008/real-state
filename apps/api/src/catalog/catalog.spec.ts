import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Emirate, Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { CatalogRepository, publicAgentSelect, publicAgentWhere } from './catalog.repository';
import { CatalogService, requireCoordinatePair } from './catalog.service';
import {
  CreateAreaDto,
  UpdateAgentProfileDto,
  UpdateAreaDto,
  UpdateDeveloperDto,
} from './catalog.dto';

describe('Catalog public boundary', () => {
  it('exposes explicit public contact fields without account identity or credentials', () => {
    expect(publicAgentSelect).not.toHaveProperty('user');
    expect(publicAgentSelect).not.toHaveProperty('userId');
    expect(publicAgentSelect).not.toHaveProperty('email');
    expect(publicAgentSelect).toHaveProperty('publicEmail', true);
    expect(publicAgentWhere.user).toMatchObject({
      isActive: true,
      emailVerifiedAt: { not: null },
      role: { in: [Role.AGENT, Role.ADMIN] },
    });
  });
  it('requires both coordinates so an incomplete map location cannot be persisted', () => {
    expect(() => requireCoordinatePair('25.1', null)).toThrow(BadRequestException);
    expect(() => requireCoordinatePair(undefined, '55.1')).toThrow(BadRequestException);
    expect(() => requireCoordinatePair(null, null)).not.toThrow();
  });
  it('rejects unsafe coordinate values and profile reassignment through DTO validation', async () => {
    const area = plainToInstance(CreateAreaDto, {
      slug: 'dubai-marina',
      nameEn: 'Dubai Marina',
      nameAr: 'دبي مارينا',
      emirate: Emirate.DUBAI,
      latitude: '999',
      longitude: '55',
    });
    expect((await validate(area)).some((error) => error.property === 'latitude')).toBe(true);
    const agent = plainToInstance(UpdateAgentProfileDto, {
      userId: 'd20e34da-7550-4248-9e54-f83545312b2c',
    });
    expect(
      (await validate(agent, { whitelist: true, forbidNonWhitelisted: true })).some(
        (error) => error.property === 'userId',
      ),
    ).toBe(true);
  });
  it.each([
    [UpdateAreaDto, { descriptionEn: null, isActive: null }, ['descriptionEn', 'isActive']],
    [UpdateDeveloperDto, { descriptionAr: null, isActive: null }, ['descriptionAr', 'isActive']],
    [UpdateAgentProfileDto, { bioEn: null, isPublic: null }, ['bioEn', 'isPublic']],
  ] as const)('rejects explicit nulls in nonnullable %p fields', async (type, patch, fields) => {
    const dto = plainToInstance(type as new () => object, patch);
    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toEqual(expect.arrayContaining([...fields]));
  });
  it('rejects a hierarchy cycle under the transaction lock', async () => {
    const parentId = 'ff1fd70b-f386-42a4-adee-9f19f58e0a84';
    const childId = 'f41d2ba1-311e-4dd7-af80-3c93cbd49d8e';
    const db = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      area: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: parentId,
            parentId: null,
            emirate: Emirate.DUBAI,
            isActive: true,
            latitude: null,
            longitude: null,
          })
          .mockResolvedValueOnce({ parentId, emirate: Emirate.DUBAI, isActive: true }),
        update: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (work: (transaction: typeof db) => Promise<unknown>) => work(db)),
    } as unknown as PrismaService;
    const service = new CatalogService({} as CatalogRepository, prisma, {} as AuditService);
    await expect(
      service.updateArea(
        parentId,
        { parentId: childId },
        { id: parentId, email: 'admin@example.test', role: Role.ADMIN, sessionId: childId },
      ),
    ).rejects.toThrow('cycle');
    expect(db.$executeRaw).toHaveBeenCalledTimes(1);
    expect(db.area.update).not.toHaveBeenCalled();
  });
  it('preserves an existing profile photo when a different administrator edits contact information', async () => {
    const existing = { userId: 'agent-a', photoMediaId: 'old-photo', areaId: null, isPublic: true };
    const db = {
      agentProfile: {
        findUnique: jest.fn().mockResolvedValue(existing),
        update: jest.fn().mockResolvedValue(existing),
      },
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ role: Role.AGENT, isActive: true, emailVerifiedAt: new Date() }),
      },
      media: { findFirst: jest.fn().mockResolvedValue({ id: 'old-photo' }) },
    };
    const prisma = {
      $transaction: jest.fn(async (work: (transaction: typeof db) => Promise<unknown>) => work(db)),
    } as unknown as PrismaService;
    const audit = { record: jest.fn() } as unknown as AuditService;
    await new CatalogService({} as CatalogRepository, prisma, audit).updateAgent(
      'profile-a',
      { publicEmail: 'public@example.test' },
      { id: 'admin-b', email: 'admin@example.test', role: Role.ADMIN, sessionId: 'session' },
    );
    expect(db.media.findFirst).toHaveBeenCalledWith({
      where: { id: 'old-photo' },
      select: { id: true },
    });
    expect(db.agentProfile.update).toHaveBeenCalled();
  });
});
