import { BadRequestException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import {
  collectMediaIds,
  toPlainText,
  validateDocument,
  type RichDocument,
} from '@oriva/rich-content';
import { AuthUser } from '../auth/auth-user';

type RichValues = object;
type RichResource = 'article' | 'project' | 'listing';
export interface PreparedRichContent {
  data: Record<string, string | Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput>;
  textEn: string;
  textAr: string;
  mediaIds: string[];
  existingMediaIds: string[];
}

/** Legacy text and rich JSON form one value. The server is authoritative for its searchable text. */
export function prepareRichContent(
  input: RichValues,
  current: RichValues | undefined,
  field: 'body' | 'description',
  limits: { minTextLength: number; maxTextLength: number },
): PreparedRichContent {
  const dto = input as Record<string, unknown>,
    stored = (current ?? {}) as Record<string, unknown>;
  const data: PreparedRichContent['data'] = {},
    documents: RichDocument[] = [],
    previousDocuments: RichDocument[] = [];
  const texts: Record<string, string> = {};
  for (const suffix of ['En', 'Ar']) {
    const plainKey = `${field}${suffix}`,
      richKey = `${field}Rich${suffix}`;
    let nextRich: RichDocument | null = null;
    if (stored[richKey] !== undefined && stored[richKey] !== null) {
      try {
        nextRich = validateDocument(stored[richKey], limits);
        previousDocuments.push(nextRich);
      } catch {
        throw new BadRequestException(
          'Stored rich content needs correction before this record can be saved',
        );
      }
    }
    let nextText = stored[plainKey];
    if (dto[richKey] !== undefined) {
      if (dto[richKey] === null) {
        data[richKey] = Prisma.DbNull;
        nextRich = null;
        if (dto[plainKey] !== undefined) nextText = dto[plainKey];
      } else {
        try {
          nextRich = validateDocument(dto[richKey], limits);
        } catch (error) {
          throw new BadRequestException(
            error instanceof Error ? error.message : 'Invalid rich content',
          );
        }
        nextText = toPlainText(nextRich);
        data[richKey] = nextRich as unknown as Prisma.InputJsonValue;
      }
      if (nextText !== undefined && typeof nextText === 'string') data[plainKey] = nextText;
    } else if (dto[plainKey] !== undefined) {
      // An older plain-text client must never leave stale formatting attached.
      nextText = dto[plainKey];
      nextRich = null;
      data[richKey] = Prisma.DbNull;
      if (typeof nextText === 'string') data[plainKey] = nextText;
    }
    if (
      typeof nextText !== 'string' ||
      nextText.trim().length < limits.minTextLength ||
      nextText.length > limits.maxTextLength
    )
      throw new BadRequestException(
        `${plainKey} must contain ${limits.minTextLength}–${limits.maxTextLength} text characters`,
      );
    texts[suffix] = nextText;
    if (nextRich) documents.push(nextRich);
  }
  return {
    data,
    textEn: texts.En!,
    textAr: texts.Ar!,
    mediaIds: [...new Set(documents.flatMap(collectMediaIds))],
    existingMediaIds: [...new Set(previousDocuments.flatMap(collectMediaIds))],
  };
}

/** Key-share locks serialize document attachments with MediaService.remove's row lock. */
export async function assertRichMedia(
  tx: Prisma.TransactionClient,
  ids: string[],
  actor: AuthUser,
  allowedExistingIds: string[] = [],
): Promise<void> {
  if (!ids.length) return;
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "Media" WHERE "id" IN (${Prisma.join(ids)}) FOR KEY SHARE`,
  );
  const count = await tx.media.count({
    where: {
      id: { in: ids },
      ...(actor.role === Role.ADMIN
        ? {}
        : { OR: [{ ownerId: actor.id }, { id: { in: allowedExistingIds } }] }),
    },
  });
  if (count !== ids.length)
    throw new BadRequestException(
      'An embedded image does not exist or is not available to this account',
    );
}

export async function replaceRichMedia(
  tx: Prisma.TransactionClient,
  resource: RichResource,
  id: string,
  mediaIds: string[],
): Promise<void> {
  if (resource === 'article') {
    await tx.articleRichMedia.deleteMany({ where: { articleId: id } });
    if (mediaIds.length)
      await tx.articleRichMedia.createMany({
        data: mediaIds.map((mediaId) => ({ articleId: id, mediaId })),
      });
  } else if (resource === 'project') {
    await tx.projectRichMedia.deleteMany({ where: { projectId: id } });
    if (mediaIds.length)
      await tx.projectRichMedia.createMany({
        data: mediaIds.map((mediaId) => ({ projectId: id, mediaId })),
      });
  } else {
    await tx.listingRichMedia.deleteMany({ where: { listingId: id } });
    if (mediaIds.length)
      await tx.listingRichMedia.createMany({
        data: mediaIds.map((mediaId) => ({ listingId: id, mediaId })),
      });
  }
}

export function withoutRichDocuments<T extends object>(
  input: T,
): Omit<T, 'bodyRichEn' | 'bodyRichAr' | 'descriptionRichEn' | 'descriptionRichAr'> {
  return Object.fromEntries(
    Object.entries(input).filter(
      ([key]) =>
        !['bodyRichEn', 'bodyRichAr', 'descriptionRichEn', 'descriptionRichAr'].includes(key),
    ),
  ) as Omit<T, 'bodyRichEn' | 'bodyRichAr' | 'descriptionRichEn' | 'descriptionRichAr'>;
}
