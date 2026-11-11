import { describe, expect, it } from '@jest/globals';
import { constantTimeTokenEqual, hashToken, isOpaqueToken, randomToken } from './token.utils';

describe('opaque token utilities', () => {
  it('generates distinct bounded URL-safe tokens and stores only a digest', () => {
    const first = randomToken();
    const second = randomToken();
    expect(isOpaqueToken(first)).toBe(true);
    expect(first).not.toBe(second);
    expect(hashToken(first)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashToken(first)).not.toContain(first);
  });
  it('rejects malformed cookie/header values before constant-time comparison', () => {
    const token = randomToken();
    expect(constantTimeTokenEqual(token, token)).toBe(true);
    expect(constantTimeTokenEqual(token, randomToken())).toBe(false);
    for (const malformed of [undefined, null, [], {}, 42, '', `${token}=`, `${token}\n`]) {
      expect(isOpaqueToken(malformed)).toBe(false);
      expect(constantTimeTokenEqual(token, malformed)).toBe(false);
    }
  });
});
