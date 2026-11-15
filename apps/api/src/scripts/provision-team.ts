import { config as loadEnvironment } from 'dotenv';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { PrismaClient, Role } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import { z } from 'zod';
import { PasswordService } from '../auth/password.service';
import { ImageStorage, LocalImageStorage } from '../media/image-storage';
import { createScriptDatabase, reportScriptFailure, ScriptInputError } from './script-database';

const plain = /^[^<>\u0000-\u001f\u007f]+$/u;
const text = z
  .string()
  .trim()
  .max(2000)
  .regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/u)
  .default('');
const schema = z
  .object({
    members: z
      .array(
        z
          .object({
            email: z
              .email()
              .max(254)
              .transform((value) => value.toLowerCase().trim()),
            password: z
              .string()
              .min(12)
              .max(128)
              .regex(/^[^\u0000-\u001f\u007f]+$/u),
            firstName: z.string().trim().min(1).max(80).regex(plain),
            lastName: z
              .string()
              .trim()
              .max(80)
              .regex(/^[^<>\u0000-\u001f\u007f]*$/u),
            slug: z
              .string()
              .min(1)
              .max(120)
              .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
            displayName: z.string().trim().min(1).max(160).regex(plain),
            titleEn: z.string().trim().min(1).max(80).regex(plain),
            titleAr: z.string().trim().min(1).max(80).regex(plain),
            bioEn: text,
            bioAr: text,
            photoPath: z.string().min(1).max(4096).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict();
export type LocalTeamInput = z.infer<typeof schema>;

export function parseLocalTeamInput(value: unknown): LocalTeamInput {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new ScriptInputError(
      'Invalid team input. Supply the documented local team fields; passwords require 12–128 characters.',
    );
  if (
    new Set(result.data.members.map((member) => member.email)).size !==
      result.data.members.length ||
    new Set(result.data.members.map((member) => member.slug)).size !== result.data.members.length
  )
    throw new ScriptInputError('Each local team email and profile slug must be unique.');
  return result.data;
}

async function preparePhoto(path: string) {
  let input: Buffer;
  try {
    input = await readFile(resolve(path));
  } catch {
    throw new ScriptInputError('A local team photo could not be read.');
  }
  if (input.length > 8 * 1024 * 1024)
    throw new ScriptInputError('Local team photos must be within 8 MB before conversion.');
  try {
    const decoder = sharp(input, { limitInputPixels: 24000000, failOn: 'error', animated: false });
    const metadata = await decoder.metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format ?? '') || (metadata.pages ?? 1) > 1)
      throw new Error();
    return await decoder
      .rotate()
      .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new ScriptInputError('Local team photos must be valid static JPEG, PNG or WebP images.');
  }
}

export async function provisionLocalTeam(
  prisma: PrismaClient,
  input: LocalTeamInput,
  storage: ImageStorage,
  passwords: Pick<PasswordService, 'hash'> = new PasswordService(),
) {
  const prepared: Array<{
    member: LocalTeamInput['members'][number];
    passwordHash: string;
    photo: Awaited<ReturnType<typeof preparePhoto>> | null;
  }> = [];
  for (const member of input.members) {
    prepared.push({
      member,
      passwordHash: await passwords.hash(member.password),
      photo: member.photoPath ? await preparePhoto(member.photoPath) : null,
    });
  }
  const saved: string[] = [];
  try {
    return await prisma.$transaction(
      async (db) => {
        await db.$executeRaw`SELECT pg_advisory_xact_lock(86602)`;
        let created = 0,
          unchanged = 0;
        for (const { member, passwordHash, photo } of prepared) {
          const current = await db.user.findUnique({
            where: { email: member.email },
            select: { role: true, teamProfile: { select: { slug: true } } },
          });
          if (current) {
            if (current.role !== Role.TEAM_MEMBER || current.teamProfile?.slug !== member.slug)
              throw new ScriptInputError(
                'An input email already belongs to another account. No existing account, password or role was changed.',
              );
            unchanged++;
            continue;
          }
          const user = await db.user.create({
            data: {
              email: member.email,
              passwordHash,
              firstName: member.firstName,
              lastName: member.lastName,
              role: Role.TEAM_MEMBER,
              isActive: true,
              emailVerifiedAt: new Date(),
            },
            select: { id: true },
          });
          let avatarMediaId: string | undefined;
          if (photo) {
            const key = `${randomUUID()}.webp`;
            await storage.save(key, photo.data);
            saved.push(key);
            const media = await db.media.create({
              data: {
                ownerId: user.id,
                storageKey: key,
                mimeType: 'image/webp',
                size: photo.info.size,
                width: photo.info.width,
                height: photo.info.height,
              },
              select: { id: true },
            });
            avatarMediaId = media.id;
          }
          const profile = await db.teamProfile.create({
            data: {
              userId: user.id,
              slug: member.slug,
              displayName: member.displayName,
              titleEn: member.titleEn,
              titleAr: member.titleAr,
              bioEn: member.bioEn,
              bioAr: member.bioAr,
              avatarMediaId,
              isPublic: true,
            },
            select: { id: true },
          });
          await db.auditLog.create({
            data: {
              actorId: user.id,
              action: 'team.local_provisioned',
              entityType: 'TeamProfile',
              entityId: profile.id,
              metadata: { source: 'team:provision', localOnly: true },
            },
          });
          created++;
        }
        return { created, unchanged };
      },
      { timeout: 15000 },
    );
  } catch (error) {
    await Promise.allSettled(saved.map((key) => storage.remove(key)));
    throw error;
  }
}

async function main() {
  loadEnvironment({ quiet: true });
  if (process.env.NODE_ENV === 'production' || process.env.ALLOW_LOCAL_TEAM_PROVISION !== 'true')
    throw new ScriptInputError(
      'Local team provisioning requires a non-production environment and ALLOW_LOCAL_TEAM_PROVISION=true.',
    );
  const file = process.env.TEAM_PROVISION_FILE;
  if (!file)
    throw new ScriptInputError('TEAM_PROVISION_FILE must point to a private, ignored JSON file.');
  let value: unknown;
  try {
    value = JSON.parse(await readFile(resolve(file), 'utf8')) as unknown;
  } catch {
    throw new ScriptInputError('The private team input file could not be read or parsed.');
  }
  const input = parseLocalTeamInput(value);
  const prisma = createScriptDatabase(process.env.DATABASE_URL);
  const storage = new LocalImageStorage(
    new ConfigService({ UPLOAD_DIR: process.env.UPLOAD_DIR || './uploads' }),
  );
  try {
    const result = await provisionLocalTeam(prisma, input, storage);
    console.log(
      `Local team provisioning complete: ${result.created} created, ${result.unchanged} existing accounts preserved. No credentials are included in this output.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (typeof require !== 'undefined' && require.main === module)
  void main().catch(reportScriptFailure);
