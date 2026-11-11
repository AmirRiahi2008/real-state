import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { Prisma, Role } from '@prisma/client';
import sharp, { type OutputInfo } from 'sharp';
import { PrismaService } from '../database/prisma.service';
import { AuthUser } from '../auth/auth-user';
import { ImageStorage } from './image-storage';
import { PaginationDto, paginated } from '../common/pagination.dto';
import { publicListingWhere } from '../listings/listings.repository';
import { publicProjectWhere } from '../projects/projects.repository';
import { publicAgentWhere } from '../catalog/catalog.repository';
import { publicContentScope } from '../content/content.repository';
const metadataSelect = {
  id: true,
  mimeType: true,
  size: true,
  width: true,
  height: true,
  createdAt: true,
} satisfies Prisma.MediaSelect;
export const publicMediaWhere: Prisma.MediaWhereInput = {
  OR: [
    { listings: { some: { listing: publicListingWhere } } },
    { projects: { some: { project: publicProjectWhere } } },
    { agentPhotos: { some: publicAgentWhere } },
    { articles: { some: publicContentScope } },
  ],
};
@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ImageStorage,
    private readonly config: ConfigService,
  ) {}
  async upload(user: AuthUser, file?: Express.Multer.File) {
    if (!file?.buffer || file.size > this.config.getOrThrow<number>('MAX_UPLOAD_BYTES'))
      throw new BadRequestException('A JPEG, PNG or WebP file within the upload limit is required');
    const allowed: Record<string, string> = {
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
    };
    let output: { data: Buffer; info: OutputInfo };
    try {
      const decoder = sharp(file.buffer, {
        limitInputPixels: 24000000,
        failOn: 'error',
        animated: false,
      });
      const info = await decoder.metadata();
      if (
        !info.format ||
        allowed[info.format] !== file.mimetype ||
        !info.width ||
        !info.height ||
        (info.pages ?? 1) > 1
      )
        throw new Error('Unsupported image');
      output = await decoder
        .rotate()
        .resize({ width: 3000, height: 3000, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer({ resolveWithObject: true });
    } catch {
      throw new BadRequestException('Invalid image; only static JPEG, PNG and WebP are accepted');
    }
    const key = `${randomUUID()}.webp`;
    await this.storage.save(key, output.data);
    try {
      const row = await this.prisma.media.create({
        data: {
          ownerId: user.id,
          storageKey: key,
          mimeType: 'image/webp',
          size: output.info.size,
          width: output.info.width,
          height: output.info.height,
        },
        select: metadataSelect,
      });
      return { ...row, url: `/api/v1/media/${row.id}/file` };
    } catch (error) {
      await this.storage.remove(key);
      throw error;
    }
  }
  async mine(user: AuthUser, q: PaginationDto) {
    const where = { ownerId: user.id };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.media.findMany({
        where,
        select: metadataSelect,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.media.count({ where }),
    ]);
    return paginated(
      rows.map((row) => ({ ...row, url: `/api/v1/media/${row.id}/file` })),
      total,
      q.page,
      q.limit,
    );
  }
  async publicFile(id: string) {
    const row = await this.prisma.media.findFirst({
      where: { id, ...publicMediaWhere },
      select: { storageKey: true, size: true },
    });
    if (!row) throw new NotFoundException('Image not found');
    return { stream: this.storage.read(row.storageKey), size: row.size };
  }
  async managedFile(user: AuthUser, id: string) {
    const scope: Prisma.MediaWhereInput =
      user.role === Role.ADMIN
        ? {}
        : {
            OR: [
              { ownerId: user.id },
              { listings: { some: { listing: { agentId: user.id } } } },
              { agentPhotos: { some: { userId: user.id } } },
            ],
          };
    const row = await this.prisma.media.findFirst({
      where: { id, ...scope },
      select: { storageKey: true, size: true },
    });
    if (!row) throw new NotFoundException('Image not found');
    return { stream: this.storage.read(row.storageKey), size: row.size };
  }
  async remove(user: AuthUser, id: string): Promise<void> {
    const row = await this.prisma.$transaction(async (tx) => {
      // FK attachments take a key-share lock; this lock serializes attachment and deletion.
      await tx.$queryRaw`SELECT id FROM "Media" WHERE id = ${id}::uuid FOR UPDATE`;
      const current = await tx.media.findFirst({
        where: { id, ...(user.role === Role.ADMIN ? {} : { ownerId: user.id }) },
        include: {
          _count: { select: { listings: true, projects: true, agentPhotos: true, articles: true } },
        },
      });
      if (!current) throw new NotFoundException('Image not found');
      if (Object.values(current._count).some((count) => count > 0))
        throw new ConflictException('Detach the image from its records before deleting it');
      try {
        await tx.media.delete({ where: { id } });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003')
          throw new ConflictException('Image is in use');
        throw error;
      }
      return current;
    });
    await this.storage
      .remove(row.storageKey)
      .catch(() =>
        this.logger.error('Detached image cleanup failed; storage reconciliation required'),
      );
  }
}
