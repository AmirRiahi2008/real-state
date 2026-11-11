import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

export class ScriptInputError extends Error {}

/** CLI tools only require database access, not the HTTP server's other secrets. */
export function createScriptDatabase(databaseUrl: string | undefined): PrismaClient {
  try {
    if (!databaseUrl) throw new Error();
    const parsed = new URL(databaseUrl);
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) throw new Error();
  } catch {
    throw new ScriptInputError('A valid PostgreSQL DATABASE_URL is required.');
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl, max: 2, connectionTimeoutMillis: 5000 }),
    log: [],
  });
}

export function reportScriptFailure(error: unknown): void {
  // Unexpected driver errors can contain connection or query details. Keep CLI output safe.
  console.error(
    error instanceof ScriptInputError
      ? error.message
      : 'Database operation failed. Check database connectivity and apply the migrations.',
  );
  process.exitCode = 1;
}
