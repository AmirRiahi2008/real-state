import { describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, Role } from '@prisma/client';
import sharp from 'sharp';
import { AuthUser } from '../auth/auth-user';
import { PrismaService } from '../database/prisma.service';
import { ImageStorage } from './image-storage';
import { MediaService } from './media.service';

const user: AuthUser = {
  id: '8d39e3ef-bdab-486e-b65d-6716b6967956',
  email: 'synthetic@example.test',
  role: Role.AGENT,
  sessionId: 'e9cc6a3b-17b5-4652-be34-fcda115d97a9',
};

function fixture() {
  const save = jest.fn(async (_key: string, _data: Buffer) => undefined);
  const remove = jest.fn(async (_key: string) => undefined);
  const read = jest.fn();
  const create = jest.fn(async (input: Prisma.MediaCreateArgs) => ({
    id: 'e00d81b0-80a5-4fcb-bda0-3ee913f0ef3d',
    mimeType: input.data.mimeType,
    size: input.data.size,
    width: input.data.width,
    height: input.data.height,
    createdAt: new Date(),
  }));
  const findFirst = jest.fn(async () => null);
  const prisma = { media: { create, findFirst } } as unknown as PrismaService;
  const service = new MediaService(
    prisma,
    { save, remove, read } as unknown as ImageStorage,
    new ConfigService({ MAX_UPLOAD_BYTES: 1048576 }),
  );
  return { service, save, remove, read, create };
}

const file = (buffer: Buffer, mimetype = 'image/png') =>
  ({
    buffer,
    size: buffer.length,
    mimetype,
    originalname: '../../untrusted.png',
  }) as Express.Multer.File;

describe('image upload boundary', () => {
  it('decodes and re-encodes an image as WebP using a random internal key', async () => {
    const f = fixture();
    const input = await sharp({
      create: { width: 8, height: 6, channels: 3, background: '#ffffff' },
    })
      .png()
      .withMetadata({ exif: { IFD0: { Copyright: 'synthetic-private-data' } } })
      .toBuffer();
    const result = await f.service.upload(user, file(input));
    const [key, encoded] = f.save.mock.calls[0]!;
    expect(key).toMatch(/^[a-f0-9-]{36}\.webp$/);
    const decoded = await sharp(encoded).metadata();
    expect(decoded.format).toBe('webp');
    expect(decoded.width).toBe(8);
    expect(decoded.height).toBe(6);
    expect(decoded.exif).toBeUndefined();
    expect(result).toHaveProperty('url', expect.stringContaining('/api/v1/media/'));
    expect(result).not.toHaveProperty('storageKey');
  });

  it('rejects a spoofed image MIME or invalid image bytes before writing to storage', async () => {
    const input = await sharp({
      create: { width: 1, height: 1, channels: 3, background: '#ffffff' },
    })
      .png()
      .toBuffer();
    for (const upload of [
      file(input, 'image/jpeg'),
      file(Buffer.from('<svg onload="alert(1)"></svg>'), 'image/svg+xml'),
      file(Buffer.from('invalid image')),
    ]) {
      const f = fixture();
      await expect(f.service.upload(user, upload)).rejects.toBeInstanceOf(BadRequestException);
      expect(f.save).not.toHaveBeenCalled();
      expect(f.create).not.toHaveBeenCalled();
    }
  });

  it('does not open storage when the image has no publicly visible relationship', async () => {
    const f = fixture();
    await expect(
      f.service.publicFile('e00d81b0-80a5-4fcb-bda0-3ee913f0ef3d'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(f.read).not.toHaveBeenCalled();
  });

  it('holds the image lock while checking attachments and deleting, then removes bytes after commit', async () => {
    const events: string[] = [];
    const id = 'e00d81b0-80a5-4fcb-bda0-3ee913f0ef3d';
    const tx = {
      $queryRaw: async () => {
        events.push('lock');
        return [];
      },
      media: {
        findFirst: async () => {
          expect(events).toEqual(['lock']);
          events.push('checked');
          return {
            id,
            storageKey: `${id}.webp`,
            _count: { listings: 0, projects: 0, agentPhotos: 0, articles: 0 },
          };
        },
        delete: async () => {
          events.push('deleted');
          return {};
        },
      },
    };
    const prisma = {
      $transaction: async <T>(work: (db: Prisma.TransactionClient) => Promise<T>) => {
        const result = await work(tx as unknown as Prisma.TransactionClient);
        events.push('committed');
        return result;
      },
    } as unknown as PrismaService;
    const remove = jest.fn(async (_key: string) => {
      expect(events).toEqual(['lock', 'checked', 'deleted', 'committed']);
    });
    const service = new MediaService(
      prisma,
      { remove } as unknown as ImageStorage,
      new ConfigService(),
    );
    await service.remove(user, id);
    expect(remove).toHaveBeenCalledWith(`${id}.webp`);
  });

  it('preserves an image attached to a public profile or article after locking', async () => {
    for (const relation of ['agentPhotos', 'articles']) {
      const remove = jest.fn();
      const deleteRow = jest.fn();
      const tx = {
        $queryRaw: jest.fn(async () => []),
        media: {
          findFirst: async () => ({ storageKey: 'private.webp', _count: { [relation]: 1 } }),
          delete: deleteRow,
        },
      };
      const prisma = {
        $transaction: async <T>(work: (db: Prisma.TransactionClient) => Promise<T>) =>
          work(tx as unknown as Prisma.TransactionClient),
      } as unknown as PrismaService;
      const service = new MediaService(
        prisma,
        { remove } as unknown as ImageStorage,
        new ConfigService(),
      );
      await expect(
        service.remove(user, 'e00d81b0-80a5-4fcb-bda0-3ee913f0ef3d'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(deleteRow).not.toHaveBeenCalled();
      expect(remove).not.toHaveBeenCalled();
    }
  });
});
