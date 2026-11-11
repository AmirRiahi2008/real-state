import { z } from 'zod';
const flag = z.preprocess((v) => (v === 'true' ? true : v === 'false' ? false : v), z.boolean());
const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1024).max(65535).default(4000),
    HOST: z.string().default('127.0.0.1'),
    DATABASE_URL: z.url().refine((v) => /^postgres(ql)?:\/\//.test(v)),
    REDIS_URL: z.url().refine((v) => /^rediss?:\/\//.test(v)),
    RATE_LIMIT_NAMESPACE: z
      .string()
      .regex(/^[A-Za-z0-9:_-]{1,100}$/)
      .default('estate:rate'),
    JWT_SECRET: z
      .string()
      .min(64)
      .refine((v) => !/replace|example|changeme/i.test(v)),
    JWT_ISSUER: z.string().min(3).default('uae-real-estate-api'),
    JWT_AUDIENCE: z.string().min(3).default('uae-real-estate-web'),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(900).default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(30),
    CORS_ORIGINS: z
      .string()
      .min(1)
      .refine((v) =>
        v.split(',').every((o) => {
          try {
            const u = new URL(o.trim());
            return (
              ['http:', 'https:'].includes(u.protocol) &&
              u.origin === o.trim() &&
              !u.username &&
              !u.password
            );
          } catch {
            return false;
          }
        }),
      ),
    FRONTEND_URL: z.url(),
    COOKIE_SECURE: flag.default(false),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(2).default(0),
    SWAGGER_ENABLED: flag.default(false),
    UPLOAD_DIR: z.string().min(1).default('uploads'),
    MAX_UPLOAD_BYTES: z.coerce.number().int().min(1024).max(10485760).default(5242880),
    SMTP_HOST: z.string().min(1),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(1025),
    SMTP_SECURE: flag.default(false),
    SMTP_FROM: z.string().min(3),
    SMTP_USER: z.string().default(''),
    SMTP_PASS: z.string().default(''),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    if (!env.COOKIE_SECURE)
      ctx.addIssue({
        code: 'custom',
        path: ['COOKIE_SECURE'],
        message: 'Production requires secure cookies',
      });
    if (env.SWAGGER_ENABLED)
      ctx.addIssue({
        code: 'custom',
        path: ['SWAGGER_ENABLED'],
        message: 'Disable public Swagger in production',
      });
    if (!env.SMTP_SECURE && env.SMTP_PORT !== 587)
      ctx.addIssue({
        code: 'custom',
        path: ['SMTP_SECURE'],
        message: 'Use TLS SMTP or STARTTLS port 587',
      });
    for (const key of ['CORS_ORIGINS', 'FRONTEND_URL'] as const)
      if (env[key].split(',').some((v) => !v.trim().startsWith('https://')))
        ctx.addIssue({ code: 'custom', path: [key], message: 'Production requires HTTPS origins' });
  });
export type Environment = z.infer<typeof schema>;
export function validateEnvironment(values: Record<string, unknown>): Environment {
  const result = schema.safeParse(values);
  if (!result.success)
    throw new Error(
      `Invalid environment: ${result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')}`,
    );
  return result.data;
}
