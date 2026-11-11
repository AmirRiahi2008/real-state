import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  readonly client: Redis;
  constructor(config: ConfigService) {
    this.client = new Redis(config.getOrThrow<string>('REDIS_URL'), {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      retryStrategy: (attempt) => Math.min(1000 * attempt, 10000),
    });
    this.client.on('error', () => undefined);
  }
  async onModuleInit(): Promise<void> {
    await this.client.connect();
    await this.client.ping();
  }
  async onModuleDestroy(): Promise<void> {
    this.client.disconnect();
  }
}
