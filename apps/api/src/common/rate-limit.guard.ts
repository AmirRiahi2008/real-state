import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { Request, Response } from 'express';
import { RedisService } from '../infra/redis.service';
import { RATE_LIMIT_KEY } from './rate-limit.decorator';
import { rateLimitIdentity } from './client-identity';
const INCREMENT = `local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return {n,redis.call('TTL',KEYS[1])}`;
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly redis: RedisService,
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    if (req.path.endsWith('/health/live')) return true;
    const policy = this.reflector.getAllAndOverride<{ limit: number; windowSeconds: number }>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    ) ?? { limit: req.method === 'GET' ? 120 : 30, windowSeconds: 60 };
    const identity = createHash('sha256')
      .update(rateLimitIdentity(req, this.config.get<string>('WEB_GATEWAY_SECRET')))
      .digest('hex');
    let count: number;
    let ttl: number;
    try {
      [count, ttl] = (await this.redis.client.eval(
        INCREMENT,
        1,
        `${this.config.getOrThrow<string>('RATE_LIMIT_NAMESPACE')}:${context.getClass().name}:${context.getHandler().name}:${identity}`,
        policy.windowSeconds,
      )) as [number, number];
    } catch {
      throw new ServiceUnavailableException('Request protection is temporarily unavailable');
    }
    res.setHeader('X-RateLimit-Limit', policy.limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, policy.limit - count));
    if (count > policy.limit) {
      res.setHeader('Retry-After', Math.max(1, ttl));
      throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}
