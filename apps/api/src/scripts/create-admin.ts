import { config as loadEnvironment } from 'dotenv';
import { isEmail } from 'class-validator';
import { PrismaClient, Role } from '@prisma/client';
import { PasswordService } from '../auth/password.service';
import { createScriptDatabase, reportScriptFailure, ScriptInputError } from './script-database';

interface AdminInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export function readAdminInput(env: NodeJS.ProcessEnv): AdminInput {
  const email = env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = env.ADMIN_PASSWORD;
  const firstName = (env.ADMIN_FIRST_NAME ?? 'Platform').trim();
  const lastName = (env.ADMIN_LAST_NAME ?? 'Administrator').trim();
  if (!email || email.length > 254 || !isEmail(email))
    throw new ScriptInputError('ADMIN_EMAIL must be a valid email address.');
  if (
    !password ||
    password.length < 16 ||
    password.length > 128 ||
    /[\u0000-\u001f\u007f]/u.test(password) ||
    new Set(password).size < 8 ||
    /^(?:password|changeme|replace|example|admin)[\W\d_]*$/iu.test(password)
  ) {
    throw new ScriptInputError(
      'ADMIN_PASSWORD must contain 16–128 characters, at least 8 distinct characters, and no control characters or placeholder password. Use a long random password or passphrase.',
    );
  }
  for (const name of [firstName, lastName])
    if (name.length < 1 || name.length > 80 || /[<>\u0000-\u001f\u007f]/u.test(name))
      throw new ScriptInputError('Administrator names must contain 1–80 plain-text characters.');
  return { email, password, firstName, lastName };
}

export async function createAdministrator(
  prisma: PrismaClient,
  input: AdminInput,
  passwords: Pick<PasswordService, 'hash'> = new PasswordService(),
): Promise<{ id: string }> {
  const passwordHash = await passwords.hash(input.password);
  return prisma.$transaction(async (db) => {
    // Share the access-management lock so CLI provisioning and role transitions serialize.
    await db.$executeRaw`SELECT pg_advisory_xact_lock(86602)`;
    if (await db.user.findUnique({ where: { email: input.email }, select: { id: true } })) {
      throw new ScriptInputError(
        'An account with ADMIN_EMAIL already exists. No account, password, or role was changed. Use authenticated account-management flows.',
      );
    }
    const user = await db.user.create({
      data: {
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        role: Role.ADMIN,
        isActive: true,
        emailVerifiedAt: new Date(),
      },
      select: { id: true },
    });
    await db.auditLog.create({
      data: {
        actorId: user.id,
        action: 'admin.bootstrap',
        entityType: 'User',
        entityId: user.id,
        metadata: { source: 'admin:create' },
      },
    });
    return user;
  });
}

async function main(): Promise<void> {
  loadEnvironment({ quiet: true });
  const input = readAdminInput(process.env);
  const prisma = createScriptDatabase(process.env.DATABASE_URL);
  try {
    await createAdministrator(prisma, input);
    console.log(
      'Created an active, verified administrator. No credentials are included in this output.',
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (typeof require !== 'undefined' && require.main === module)
  void main().catch(reportScriptFailure);
