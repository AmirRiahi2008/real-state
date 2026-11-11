import { createHmac, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';

interface IdentityRequest {
  ip?: string;
  get(header: string): string | undefined;
}

/** Only a fresh, authenticated gateway assertion may replace the direct peer identity. */
export function rateLimitIdentity(
  request: IdentityRequest,
  secret?: string,
  now = Date.now(),
): string {
  const fallback = request.ip ?? 'unknown';
  if (!secret) return fallback;
  const ip = request.get('x-oriva-client-ip');
  const timestamp = request.get('x-oriva-timestamp');
  const signature = request.get('x-oriva-signature');
  if (
    !ip ||
    !isIP(ip) ||
    !timestamp ||
    !/^\d{10,12}$/.test(timestamp) ||
    !signature ||
    !/^[a-f0-9]{64}$/.test(signature)
  )
    return fallback;
  if (Math.abs(Math.floor(now / 1000) - Number(timestamp)) > 30) return fallback;
  const expected = createHmac('sha256', secret).update(`oriva.v1\n${timestamp}\n${ip}`).digest();
  return timingSafeEqual(Buffer.from(signature, 'hex'), expected) ? ip : fallback;
}
