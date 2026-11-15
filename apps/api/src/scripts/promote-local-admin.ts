import { config as loadEnvironment } from 'dotenv';
import { readFile, stat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { isEmail } from 'class-validator';
import { PrismaClient, Role } from '@prisma/client';
import { PasswordService } from '../auth/password.service';
import { createScriptDatabase, reportScriptFailure, ScriptInputError } from './script-database';
export function assertLocalAdminPromotion(env: NodeJS.ProcessEnv): string {
  if (env.NODE_ENV === 'production' || env.ALLOW_LOCAL_ADMIN_PROMOTION !== 'true')
    throw new ScriptInputError('Explicit local-only administrator promotion must be enabled.');
  const path = env.ADMIN_PROMOTION_FILE;
  if (!path || !isAbsolute(path))
    throw new ScriptInputError('ADMIN_PROMOTION_FILE must name an absolute private JSON file.');
  let local = false;
  try {
    local = ['localhost', '127.0.0.1', '[::1]'].includes(new URL(env.DATABASE_URL ?? '').hostname);
  } catch {
    /* Report one safe message below. */
  }
  if (!local)
    throw new ScriptInputError(
      'Administrator promotion only supports a local PostgreSQL database.',
    );
  return path;
}
export async function promoteLocalAdministrator(
  prisma: PrismaClient,
  input: { email: string; password: string },
  passwords: Pick<PasswordService, 'hash'> = new PasswordService(),
) {
  const passwordHash = await passwords.hash(input.password);
  return prisma.$transaction(async (db) => {
    await db.$executeRaw`SELECT pg_advisory_xact_lock(86602)`;
    const current = await db.user.findUnique({
      where: { email: input.email },
      select: { id: true, role: true },
    });
    if (!current)
      throw new ScriptInputError('The local account does not exist; no account was changed.');
    await db.user.update({
      where: { id: current.id },
      data: { role: Role.ADMIN, isActive: true, emailVerifiedAt: new Date(), passwordHash },
    });
    await db.authSession.updateMany({
      where: { userId: current.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await db.oneTimeToken.updateMany({
      where: { userId: current.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    await db.auditLog.create({
      data: {
        actorId: current.id,
        action: 'admin.local-promotion',
        entityType: 'User',
        entityId: current.id,
        metadata: { source: 'admin:promote-local', previousRole: current.role },
      },
    });
    return { id: current.id };
  });
}
async function main() {
  loadEnvironment({ quiet: true });
  const path = assertLocalAdminPromotion(process.env);
  const metadata = await stat(path);
  if (!metadata.isFile() || (metadata.mode & 0o077) !== 0)
    throw new ScriptInputError(
      'The private administrator file must be a regular file with mode 0600.',
    );
  let input: Record<string, unknown>;
  try {
    input = JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
  } catch {
    throw new ScriptInputError('The private administrator file must contain valid JSON.');
  }
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const password = input.password;
  if (
    !isEmail(email) ||
    email.length > 254 ||
    typeof password !== 'string' ||
    password.length < 8 ||
    password.length > 128 ||
    /[\u0000-\u001f\u007f]/u.test(password)
  )
    throw new ScriptInputError(
      'The local input must contain an email and an 8–128 character initial password.',
    );
  const prisma = createScriptDatabase(process.env.DATABASE_URL);
  try {
    await promoteLocalAdministrator(prisma, { email, password });
    console.log(
      'Promoted the existing local account, preserved its profile and revoked previous sessions. Credentials were not printed.',
    );
  } finally {
    await prisma.$disconnect();
  }
}
if (typeof require !== 'undefined' && require.main === module)
  void main().catch(reportScriptFailure);
