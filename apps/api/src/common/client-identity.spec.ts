import { createHmac } from 'node:crypto';
import { rateLimitIdentity } from './client-identity';

const secret = 'a'.repeat(64),
  now = 1794390000000,
  timestamp = String(now / 1000);
const ip = '203.0.113.5';
const signature = createHmac('sha256', secret)
  .update(`oriva.v1\n${timestamp}\n${ip}`)
  .digest('hex');
const headers: Record<string, string> = {
  'x-oriva-client-ip': ip,
  'x-oriva-timestamp': timestamp,
  'x-oriva-signature': signature,
};
const request = (patch = {}) => ({
  ip: '127.0.0.1',
  get: (key: string) => ({ ...headers, ...patch })[key],
});
describe('Authenticated web gateway client identity', () => {
  it('uses the verified visitor instead of sharing one gateway-wide quota', () => {
    expect(rateLimitIdentity(request(), secret, now)).toBe(ip);
  });
  it('ignores assertions when the gateway is not configured', () => {
    expect(rateLimitIdentity(request(), undefined, now)).toBe('127.0.0.1');
  });
  it.each([
    { 'x-oriva-client-ip': '198.51.100.2' },
    { 'x-oriva-client-ip': 'not-an-ip' },
    { 'x-oriva-timestamp': String(now / 1000 - 31) },
    { 'x-oriva-timestamp': String(now / 1000 + 31) },
    { 'x-oriva-signature': '0'.repeat(64) },
    { 'x-oriva-signature': 'malformed' },
    { 'x-oriva-timestamp': '' },
    { 'x-oriva-client-ip': '' },
  ])('does not trust spoofed, tampered or stale assertions %o', (patch) => {
    expect(rateLimitIdentity(request(patch), secret, now)).toBe('127.0.0.1');
  });
});
