import { PrismaClient, Role } from '@prisma/client';
import { createAdministrator, readAdminInput } from './create-admin';
import { createScriptDatabase, ScriptInputError } from './script-database';
import { assertDemoSeedAllowed } from '../../prisma/seed';

const env = {
  ADMIN_EMAIL: ' Administrator@Example.test ',
  ADMIN_PASSWORD: 'Safe autumn river 49! rocks',
};

describe('Privileged provisioning scripts', () => {
  it('requires explicit administrator credentials and normalizes the account email', () => {
    expect(readAdminInput(env)).toMatchObject({
      email: 'administrator@example.test',
      firstName: 'Platform',
      lastName: 'Administrator',
    });
    expect(() => readAdminInput({})).toThrow(ScriptInputError);
    expect(() => readAdminInput({ ...env, ADMIN_PASSWORD: undefined })).toThrow(ScriptInputError);
    expect(() => readAdminInput({ ...env, ADMIN_EMAIL: 'not-an-email' })).toThrow(ScriptInputError);
  });
  it.each([
    'short',
    'aaaaaaaaaaaaaaaaaaaaaaaa',
    'password123456789',
    'Safe autumn river\n49! rocks',
  ])(
    'rejects a weak or unsafe administrator password without including it in errors',
    (password) => {
      expect(() => readAdminInput({ ...env, ADMIN_PASSWORD: password })).toThrow(ScriptInputError);
      try {
        readAdminInput({ ...env, ADMIN_PASSWORD: password });
      } catch (error) {
        expect((error as Error).message).not.toContain(password);
      }
    },
  );
  it('creates only a verified active administrator and an audit entry in one locked transaction', async () => {
    const db = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'new-admin' }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: jest.fn(async (work: (transaction: typeof db) => Promise<unknown>) => work(db)),
    } as unknown as PrismaClient;
    const hash = jest.fn().mockResolvedValue('argon2id-test-hash');
    await expect(createAdministrator(prisma, readAdminInput(env), { hash })).resolves.toEqual({
      id: 'new-admin',
    });
    expect(db.$executeRaw).toHaveBeenCalledTimes(1);
    expect(db.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        role: Role.ADMIN,
        isActive: true,
        emailVerifiedAt: expect.any(Date),
        passwordHash: 'argon2id-test-hash',
      }),
      select: { id: true },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 'new-admin',
        action: 'admin.bootstrap',
        entityId: 'new-admin',
      }),
    });
    expect(JSON.stringify(db.user.create.mock.calls)).not.toContain(env.ADMIN_PASSWORD);
    expect(JSON.stringify(db.auditLog.create.mock.calls)).not.toContain(env.ADMIN_PASSWORD);
  });
  it('refuses an existing account without overwriting its password or elevating its role', async () => {
    const db = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'customer' }),
        create: jest.fn(),
        update: jest.fn(),
      },
      auditLog: { create: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn(async (work: (transaction: typeof db) => Promise<unknown>) => work(db)),
    } as unknown as PrismaClient;
    await expect(
      createAdministrator(prisma, readAdminInput(env), {
        hash: jest.fn().mockResolvedValue('test-hash'),
      }),
    ).rejects.toThrow('already exists');
    expect(db.user.create).not.toHaveBeenCalled();
    expect(db.user.update).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });
  it('only permits explicitly enabled demo data outside production', () => {
    expect(() =>
      assertDemoSeedAllowed({ NODE_ENV: 'development', SEED_DEMO: 'true' }),
    ).not.toThrow();
    expect(() => assertDemoSeedAllowed({ NODE_ENV: 'test', SEED_DEMO: 'true' })).not.toThrow();
    expect(() => assertDemoSeedAllowed({ NODE_ENV: 'production', SEED_DEMO: 'true' })).toThrow(
      'production',
    );
    expect(() => assertDemoSeedAllowed({ NODE_ENV: 'development' })).toThrow('opt-in');
    expect(() => assertDemoSeedAllowed({ NODE_ENV: 'development', SEED_DEMO: 'false' })).toThrow(
      'opt-in',
    );
  });
  it('rejects missing or non-PostgreSQL connection strings before constructing a client', () => {
    expect(() => createScriptDatabase(undefined)).toThrow(ScriptInputError);
    expect(() => createScriptDatabase('https://db.example.test')).toThrow(ScriptInputError);
  });
});
