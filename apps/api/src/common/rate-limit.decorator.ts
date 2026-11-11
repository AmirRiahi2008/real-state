import { SetMetadata } from '@nestjs/common';
export const RATE_LIMIT_KEY = 'rate-limit';
export const RateLimit = (limit: number, windowSeconds = 60) =>
  SetMetadata(RATE_LIMIT_KEY, { limit, windowSeconds });
