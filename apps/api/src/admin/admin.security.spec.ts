import { BadRequestException, ConflictException, ExecutionContext } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Prisma, Role } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/auth-user';
import { PrismaService } from '../database/prisma.service';
import { AdminVerifiedGuard } from './admin-verified.guard';
import { AdminResetPasswordDto, UpdateAdminTeamDto, UpdateSiteContentDto } from './admin.dto';
import { SiteContentService, validateSiteValues } from '../site-content/site-content.service';
import {
  assertLocalAdminPromotion,
  promoteLocalAdministrator,
} from '../scripts/promote-local-admin';
import { TeamConversationsService } from '../team/team-conversations.service';
const actor: AuthUser = {
  id: randomUUID(),
  email: 'admin@example.test',
  role: Role.ADMIN,
  sessionId: randomUUID(),
};
const context = (user: AuthUser) =>
  ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) }) as unknown as ExecutionContext;
describe('administrator boundaries', () => {
  it('rejects non-administrators before querying any private data', async () => {
    const findFirst = jest.fn();
    const guard = new AdminVerifiedGuard({ user: { findFirst } } as unknown as PrismaService);
    await expect(
      guard.canActivate(context({ ...actor, role: Role.TEAM_MEMBER })),
    ).rejects.toMatchObject({ status: 403 });
    expect(findFirst).not.toHaveBeenCalled();
  });
  it('requires an active verified administrator for administrative reads', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const guard = new AdminVerifiedGuard({ user: { findFirst } } as unknown as PrismaService);
    await expect(guard.canActivate(context(actor))).rejects.toMatchObject({ status: 403 });
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: actor.id, role: Role.ADMIN, isActive: true, emailVerifiedAt: { not: null } },
      select: { id: true },
    });
  });
  it('does not let a team member request the administrator conversation scope', async () => {
    const transaction = jest.fn();
    const service = new TeamConversationsService(
      { $transaction: transaction } as unknown as PrismaService,
      {} as AuditService,
    );
    await expect(
      service.inbox({ ...actor, role: Role.TEAM_MEMBER }, { page: 1, limit: 20 }, true),
    ).rejects.toMatchObject({ status: 404 });
    expect(transaction).not.toHaveBeenCalled();
  });
  it('separates editable public team labels from account access and requires strong reset passwords', async () => {
    const errors = await validate(
      plainToInstance(UpdateAdminTeamDto, {
        titleEn: 'Administrator',
        role: Role.ADMIN,
        email: 'another@example.test',
      }),
      { whitelist: true, forbidNonWhitelisted: true },
    );
    expect(errors.map((e) => e.property)).toEqual(expect.arrayContaining(['role', 'email']));
    const reset = await validate(plainToInstance(AdminResetPasswordDto, { newPassword: 'short' }));
    expect(reset.some((e) => e.property === 'newPassword')).toBe(true);
  });
});
describe('site content integrity', () => {
  it('rejects unknown keys, HTML, oversized values and prototype-shaped input', () => {
    for (const values of [
      { unknown: { en: 'a', ar: 'b' } },
      { 'site.title': { en: '<script>x</script>', ar: 'b' } },
      { 'site.title': { en: 'x'.repeat(201), ar: 'b' } },
      JSON.parse('{"__proto__":{"en":"a","ar":"b"}}'),
      { 'site.name': { en: '', ar: 'اسم' } },
    ])
      expect(() => validateSiteValues(values)).toThrow(BadRequestException);
    expect(validateSiteValues({ 'contact.title3': { en: '', ar: '' } })).toEqual({
      'contact.title3': { en: '', ar: '' },
    });
  });
  it('validates the optimistic version at the DTO and before saving stale changes', async () => {
    const invalid = await validate(
      plainToInstance(UpdateSiteContentDto, { expectedVersion: 0, values: {} }),
    );
    expect(invalid.some((e) => e.property === 'expectedVersion')).toBe(true);
    const update = jest.fn();
    const record = jest.fn();
    const db = {
      $executeRaw: jest.fn(),
      siteContent: { findUnique: jest.fn().mockResolvedValue({ version: 2, values: {} }), update },
    };
    const prisma = {
      $transaction: async <T>(fn: (db: Prisma.TransactionClient) => Promise<T>) =>
        fn(db as unknown as Prisma.TransactionClient),
    } as unknown as PrismaService;
    const service = new SiteContentService(prisma, { record } as unknown as AuditService);
    await expect(
      service.update(
        { expectedVersion: 1, values: { 'site.title': { en: 'Updated', ar: 'عنوان' } } },
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(update).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });
});
describe('explicit local administrator promotion', () => {
  it('refuses production, remote databases and implicit opt-in', () => {
    const local = {
      DATABASE_URL: 'postgresql://local@localhost/local',
      ADMIN_PROMOTION_FILE: '/private/tmp/synthetic-admin.json',
      ALLOW_LOCAL_ADMIN_PROMOTION: 'true',
    };
    expect(() => assertLocalAdminPromotion({ ...local, NODE_ENV: 'production' })).toThrow();
    expect(() =>
      assertLocalAdminPromotion({
        ...local,
        DATABASE_URL: 'postgresql://local@remote.invalid/local',
      }),
    ).toThrow();
    expect(() =>
      assertLocalAdminPromotion({ ...local, ALLOW_LOCAL_ADMIN_PROMOTION: 'false' }),
    ).toThrow();
    expect(assertLocalAdminPromotion({ ...local, NODE_ENV: 'development' })).toBe(
      local.ADMIN_PROMOTION_FILE,
    );
  });
  it('preserves profiles, revokes sessions and one-time tokens, and never audits the initial password', async () => {
    const update = jest.fn();
    const revoke = jest.fn();
    const used = jest.fn();
    const audit = jest.fn();
    const db = {
      $executeRaw: jest.fn(),
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: actor.id, role: Role.TEAM_MEMBER }),
        update,
      },
      authSession: { updateMany: revoke },
      oneTimeToken: { updateMany: used },
      auditLog: { create: audit },
    };
    const prisma = {
      $transaction: async <T>(fn: (db: Prisma.TransactionClient) => Promise<T>) =>
        fn(db as unknown as Prisma.TransactionClient),
    } as unknown as PrismaService;
    const initial = 'Synthetic-local-initial';
    await promoteLocalAdministrator(
      prisma,
      { email: actor.email, password: initial },
      { hash: jest.fn().mockResolvedValue('argon2-fixture') },
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: Role.ADMIN, passwordHash: 'argon2-fixture' }),
      }),
    );
    expect(revoke).toHaveBeenCalled();
    expect(used).toHaveBeenCalled();
    expect(JSON.stringify(audit.mock.calls)).not.toContain(initial);
  });
});
