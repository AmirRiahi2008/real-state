import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../auth/auth-user';
import { UpdateSiteContentDto } from '../admin/admin.dto';
import { siteContentDefaults, siteContentFields } from './site-content.registry';
const fieldsByKey = new Map(siteContentFields.map((field) => [field.key, field]));
export function validateSiteValues(input: unknown): Record<string, { en: string; ar: string }> {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new BadRequestException('Content must contain bilingual fields');
  const entries = Object.entries(input);
  if (!entries.length || entries.length > siteContentFields.length)
    throw new BadRequestException('Choose known site content fields');
  const safe: Record<string, { en: string; ar: string }> = {};
  for (const [key, pair] of entries) {
    const field = fieldsByKey.get(key);
    if (
      !field ||
      !pair ||
      typeof pair !== 'object' ||
      Array.isArray(pair) ||
      Object.keys(pair).some((k) => !['en', 'ar'].includes(k))
    )
      throw new BadRequestException('Unknown site content field');
    const value = pair as Record<string, unknown>;
    for (const locale of ['en', 'ar']) {
      const text = value[locale];
      if (
        typeof text !== 'string' ||
        text.length > field.maxLength ||
        /[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text)
      )
        throw new BadRequestException(`Invalid plain text for ${key}`);
      if (
        (key === 'site.name' ||
          key === 'site.title' ||
          key.startsWith('site.nav') ||
          key === 'site.contactCta') &&
        !text.trim()
      )
        throw new BadRequestException('Brand and navigation labels cannot be empty');
    }
    safe[key] = { en: value.en as string, ar: value.ar as string };
  }
  return safe;
}
@Injectable()
export class SiteContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}
  async publicContent() {
    const row = await this.prisma.siteContent.findUnique({ where: { key: 'main' } });
    return {
      version: row?.version ?? 1,
      values: { ...siteContentDefaults, ...((row?.values as Prisma.JsonObject) ?? {}) },
    };
  }
  async managed() {
    return {
      ...(await this.publicContent()),
      fields: siteContentFields.map(({ key, section, label, maxLength }) => ({
        key,
        section,
        label,
        maxLength,
      })),
    };
  }
  async update(dto: UpdateSiteContentDto, actor: AuthUser) {
    const patch = validateSiteValues(dto.values);
    await this.prisma.$transaction(async (db) => {
      await db.$executeRaw`SELECT pg_advisory_xact_lock(86603)`;
      const current = await db.siteContent.findUnique({ where: { key: 'main' } });
      if ((current?.version ?? 1) !== dto.expectedVersion)
        throw new ConflictException('Site content changed. Reload before saving your changes.');
      const values = {
        ...siteContentDefaults,
        ...((current?.values as Prisma.JsonObject) ?? {}),
        ...patch,
      } as Prisma.InputJsonObject;
      if (current)
        await db.siteContent.update({
          where: { key: 'main', version: dto.expectedVersion },
          data: { values, version: { increment: 1 } },
        });
      else await db.siteContent.create({ data: { key: 'main', values, version: 2 } });
      await this.audit.record(
        actor.id,
        'site.content-update',
        'SiteContent',
        'main',
        { keys: Object.keys(patch) },
        db,
      );
    });
    return this.managed();
  }
}
