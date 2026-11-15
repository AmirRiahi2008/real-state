import { randomUUID } from 'node:crypto';
import {
  INestApplication,
  Logger,
  ValidationPipe,
  VersioningType,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { json, urlencoded, Request, Response, NextFunction } from 'express';
import { HttpExceptionFilter } from './http-exception.filter';
import { validateDocument } from '@oriva/rich-content';
import { assertJsonStructure } from './json-structure.policy';
export function setupApp(app: INestApplication, docs = true): void {
  const config = app.get(ConfigService);
  const production = config.get('NODE_ENV') === 'production';
  const origins = config
    .getOrThrow<string>('CORS_ORIGINS')
    .split(',')
    .map((v: string) => v.trim());
  const server = app.getHttpAdapter().getInstance() as {
    set(name: string, value: unknown): void;
    disable(name: string): void;
  };
  server.disable('x-powered-by');
  server.set('trust proxy', config.getOrThrow<number>('TRUST_PROXY_HOPS') || false);
  server.set('query parser', 'simple');
  app.use((req: Request, res: Response, next: NextFunction) => {
    const started = performance.now();
    const id = randomUUID();
    res.setHeader('X-Request-Id', id);
    res.setHeader('Cache-Control', 'no-store');
    res.on('finish', () =>
      Logger.log(
        JSON.stringify({
          event: 'http_request',
          requestId: id,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          durationMs: Math.round(performance.now() - started),
        }),
        'HTTP',
      ),
    );
    next();
  });
  app.use(
    helmet({
      strictTransportSecurity: production ? { maxAge: 31536000, includeSubDomains: true } : false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) =>
      !origin || origins.includes(origin)
        ? callback(null, true)
        : callback(new ForbiddenException('Origin is not allowed'), false),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Conversation-Token'],
    exposedHeaders: ['X-Request-Id', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'Retry-After'],
    maxAge: 600,
  });
  app.use(cookieParser());
  app.use(json({ limit: '2mb', strict: true }));
  app.use(urlencoded({ extended: false, limit: '32kb' }));
  // Bound rich trees before class-transformer recursively walks request values.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    try {
      assertJsonStructure(req.body);
      if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
        for (const key of ['bodyRichEn', 'bodyRichAr', 'descriptionRichEn', 'descriptionRichAr']) {
          const document: unknown = req.body[key];
          if (document !== undefined && document !== null)
            req.body[key] = validateDocument(document, { maxTextLength: 100000 });
        }
      }
      next();
    } catch (error) {
      next(
        new BadRequestException(error instanceof Error ? error.message : 'Invalid rich content'),
      );
    }
  });

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      validationError: { target: false, value: false },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();
  if (docs && config.get<boolean>('SWAGGER_ENABLED')) {
    const options = new DocumentBuilder()
      .setTitle('UAE Real Estate API')
      .setDescription(
        'Public discovery, staff inventory and customer workspace. Prices: AED strings. Canonical areas: square metres. Text: explicit EN/AR fields.',
      )
      .setVersion('1.0.0')
      .addBearerAuth()
      .addCookieAuth('refreshToken')
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, options), {
      jsonDocumentUrl: 'api/openapi.json',
      swaggerOptions: { persistAuthorization: false },
    });
  }
}
