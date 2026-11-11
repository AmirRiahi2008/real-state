import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { Readable } from 'node:stream';
export abstract class ImageStorage {
  abstract save(key: string, data: Buffer): Promise<void>;
  abstract read(key: string): Readable;
  abstract remove(key: string): Promise<void>;
}
@Injectable()
export class LocalImageStorage extends ImageStorage {
  private readonly root: string;
  constructor(config: ConfigService) {
    super();
    this.root = resolve(config.getOrThrow<string>('UPLOAD_DIR'));
  }
  private path(key: string) {
    if (!/^[a-f0-9-]{36}\.webp$/.test(key)) throw new Error('Invalid internal storage key');
    return join(this.root, key);
  }
  async save(key: string, data: Buffer): Promise<void> {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    await writeFile(this.path(key), data, { flag: 'wx', mode: 0o600 });
  }
  read(key: string): Readable {
    return createReadStream(this.path(key));
  }
  async remove(key: string): Promise<void> {
    await unlink(this.path(key)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
}
