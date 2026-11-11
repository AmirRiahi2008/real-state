import 'server-only';
import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';

export function gatewayHeaders(incoming: {
  get(name: string): string | null;
}): Record<string, string> {
  const secret = process.env.WEB_GATEWAY_SECRET;
  if (!secret) return {};
  // Vercel overwrites this platform header; arbitrary client forwarding headers are never trusted locally.
  const ip =
    process.env.VERCEL === '1'
      ? incoming.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()
      : '127.0.0.1';
  if (!ip || !isIP(ip)) return {};
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac('sha256', secret)
    .update(`oriva.v1\n${timestamp}\n${ip}`)
    .digest('hex');
  return {
    'x-oriva-client-ip': ip,
    'x-oriva-timestamp': timestamp,
    'x-oriva-signature': signature,
  };
}
