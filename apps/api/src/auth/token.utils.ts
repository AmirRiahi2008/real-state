import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const randomToken = () => randomBytes(32).toString('base64url');
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const isOpaqueToken = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
export function constantTimeTokenEqual(first: unknown, second: unknown): boolean {
  if (!isOpaqueToken(first) || !isOpaqueToken(second)) return false;
  return timingSafeEqual(Buffer.from(first), Buffer.from(second));
}
