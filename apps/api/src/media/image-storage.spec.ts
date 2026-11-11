import { describe, expect, it } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalImageStorage } from './image-storage';

describe('private local image storage', () => {
  it('rejects path traversal and only reads server-generated image keys', async () => {
    const root = await mkdtemp(join(tmpdir(), 'estate-storage-test-'));
    try {
      const storage = new LocalImageStorage(new ConfigService({ UPLOAD_DIR: root }));
      for (const key of ['../secret.webp', '/etc/passwd', 'image.svg', 'valid.webp/../secret']) {
        await expect(storage.save(key, Buffer.from('test'))).rejects.toThrow(
          'Invalid internal storage key',
        );
        expect(() => storage.read(key)).toThrow('Invalid internal storage key');
      }
      const key = 'e9cc6a3b-17b5-4652-be34-fcda115d97a9.webp';
      await storage.save(key, Buffer.from('image bytes'));
      const chunks: Buffer[] = [];
      for await (const chunk of storage.read(key)) chunks.push(Buffer.from(chunk));
      expect(Buffer.concat(chunks).toString()).toBe('image bytes');
      await expect(storage.save(key, Buffer.from('replace'))).rejects.toMatchObject({
        code: 'EEXIST',
      });
      await storage.remove(key);
      await expect(storage.remove(key)).resolves.toBeUndefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
