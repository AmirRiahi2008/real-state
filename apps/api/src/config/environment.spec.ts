import { validateEnvironment } from './environment';

const production = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://test:test@localhost/test',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'a'.repeat(64),
  CORS_ORIGINS: 'https://estate.example',
  FRONTEND_URL: 'https://estate.example',
  COOKIE_SECURE: 'true',
  SWAGGER_ENABLED: 'false',
  SMTP_HOST: 'smtp.example',
  SMTP_PORT: '587',
  SMTP_SECURE: 'false',
  SMTP_FROM: 'mail@estate.example',
};
describe('Production configuration boundaries', () => {
  it('coerces validated values and defaults to trusting zero proxies', () => {
    const env = validateEnvironment(production);
    expect(env.COOKIE_SECURE).toBe(true);
    expect(env.SMTP_PORT).toBe(587);
    expect(env.TRUST_PROXY_HOPS).toBe(0);
  });
  it.each([
    { COOKIE_SECURE: 'false' },
    { SWAGGER_ENABLED: 'true' },
    { FRONTEND_URL: 'http://estate.example' },
    { CORS_ORIGINS: '*' },
    { CORS_ORIGINS: 'https://estate.example/extra' },
    { CORS_ORIGINS: 'https://estate.example,http://unsafe.example' },
    { SMTP_PORT: '1025', SMTP_SECURE: 'false' },
    { JWT_SECRET: 'short' },
    { JWT_SECRET: `replace-${'x'.repeat(64)}` },
    { TRUST_PROXY_HOPS: '100' },
    { ACCESS_TOKEN_TTL_SECONDS: '86400' },
  ])('rejects an insecure deployment override %o', (patch) => {
    expect(() => validateEnvironment({ ...production, ...patch })).toThrow('Invalid environment');
  });
  it('does not include provided secret values in configuration errors', () => {
    const secret = 'sensitive-invalid-secret';
    try {
      validateEnvironment({ ...production, JWT_SECRET: secret });
    } catch (error) {
      expect(String(error)).not.toContain(secret);
      return;
    }
    throw new Error('Expected invalid configuration to fail');
  });
});
