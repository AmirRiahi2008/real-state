import { Injectable } from '@nestjs/common';
import { Prisma, PublicationStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { publicAreaSelect } from '../catalog/catalog.repository';
import { ContentQueryDto } from './content.dto';

export const publicContentScope = {
  status: PublicationStatus.PUBLISHED,
  OR: [{ areaId: null }, { area: { isActive: true } }],
} satisfies Prisma.ArticleWhereInput;
export const publicContentSummary = {
  id: true,
  slug: true,
  type: true,
  titleEn: true,
  titleAr: true,
  excerptEn: true,
  excerptAr: true,
  publishedAt: true,
  updatedAt: true,
  area: { select: publicAreaSelect },
  cover: { select: { id: true, width: true, height: true, mimeType: true } },
} satisfies Prisma.ArticleSelect;

@Injectable()
export class ContentRepository {
  constructor(private readonly prisma: PrismaService) {}
  private where(query: ContentQueryDto, publicOnly: boolean): Prisma.ArticleWhereInput {
    return {
      AND: [
        publicOnly ? publicContentScope : {},
        { type: query.type, areaId: query.areaId },
        ...(query.q
          ? [
              {
                OR: [
                  { titleEn: { contains: query.q, mode: Prisma.QueryMode.insensitive } },
                  { titleAr: { contains: query.q, mode: Prisma.QueryMode.insensitive } },
                ],
              },
            ]
          : []),
      ],
    };
  }
  list(query: ContentQueryDto, publicOnly = true) {
    const where = this.where(query, publicOnly);
    return this.prisma.$transaction([
      this.prisma.article.findMany({
        where,
        select: publicOnly
          ? publicContentSummary
          : { ...publicContentSummary, status: true, version: true, createdAt: true },
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.article.count({ where }),
    ]);
  }
  bySlug(slug: string) {
    return this.prisma.article.findFirst({
      where: { AND: [publicContentScope, { slug }] },
      select: {
        ...publicContentSummary,
        bodyEn: true,
        bodyAr: true,
        bodyRichEn: true,
        bodyRichAr: true,
      },
    });
  }
  managed(id: string) {
    return this.prisma.article.findUnique({ where: { id } });
  }
}
