import { ConflictException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { UpdateOwnProfileDto, UpdateUserAccessDto } from './users.dto';
import { UsersRepository } from './users.repository';
import { assertAdminPreserved, UsersService } from './users.service';

describe('User access policy', () => {
  const currentAdmin = { role: Role.ADMIN, isActive: true, emailVerifiedAt: new Date() };
  it.each([{ role: Role.AGENT }, { isActive: false }])(
    'preserves the last active verified administrator',
    (change) => {
      expect(() => assertAdminPreserved(currentAdmin, change, 1)).toThrow(ConflictException);
      expect(() => assertAdminPreserved(currentAdmin, change, 2)).not.toThrow();
    },
  );
  it('rejects role escalation through the self-profile DTO and invalid roles in admin DTO', async () => {
    const profile = await validate(plainToInstance(UpdateOwnProfileDto, { role: Role.ADMIN }), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(profile.some((error) => error.property === 'role')).toBe(true);
    const access = await validate(plainToInstance(UpdateUserAccessDto, { role: 'SUPER_ADMIN' }));
    expect(access.some((error) => error.property === 'role')).toBe(true);
  });
  it('serializes access changes and revokes all sessions after a role change', async () => {
    const db = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      user: {
        findUnique: jest.fn().mockResolvedValue({ ...currentAdmin, id: 'target' }),
        count: jest.fn().mockResolvedValue(2),
        update: jest.fn().mockResolvedValue({ ...currentAdmin, id: 'target', role: Role.AGENT }),
      },
      authSession: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };
    const prisma = {
      $transaction: jest.fn(async (work: (transaction: typeof db) => Promise<unknown>) => work(db)),
    } as unknown as PrismaService;
    const audit = { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService;
    const service = new UsersService({} as UsersRepository, prisma, audit);
    await service.updateAccess(
      'target',
      { role: Role.AGENT },
      { id: 'admin', email: 'admin@example.test', role: Role.ADMIN, sessionId: 'session' },
    );
    expect(db.$executeRaw).toHaveBeenCalledTimes(1);
    expect(db.authSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'target', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(audit.record).toHaveBeenCalledWith(
      'admin',
      'user.access-update',
      'User',
      'target',
      expect.objectContaining({ role: Role.AGENT }),
      db,
    );
  });
});
