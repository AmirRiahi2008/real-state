import { Controller, Get, Module, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../infra/redis.service';
@ApiTags('Health')
@Controller('health')
class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}
  @Public() @Get('live') live() {
    return { status: 'ok' };
  }
  @Public() @Get('ready') async ready() {
    try {
      await Promise.all([this.prisma.$queryRaw`SELECT 1`, this.redis.client.ping()]);
      return { status: 'ok', services: { database: 'up', redis: 'up' } };
    } catch {
      throw new ServiceUnavailableException('Required infrastructure is not ready');
    }
  }
}
@Module({ controllers: [HealthController] })
export class HealthModule {}
