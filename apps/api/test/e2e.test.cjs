/* Real HTTP, PostgreSQL, Redis, image decoder and SMTP integration tests. */
const { before, after, beforeEach, test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const { Client } = require('pg');
const request = require('supertest');
const sharp = require('sharp');
require('dotenv').config({ quiet: true });
require('reflect-metadata');

const runId = randomBytes(8).toString('hex');
const databaseName = `estate_e2e_${runId}`;
const namespace = `e2e:${runId}`;
const password = `Integration-only-${randomBytes(16).toString('hex')}`;
const origin = 'http://localhost:3000';
let app,
  prisma,
  redis,
  control,
  uploadDir,
  http,
  area,
  agent,
  otherAgent,
  admin,
  customer,
  otherCustomer;
const api = '/api/v1';
const credentials = new Map();

async function clearRateKeys() {
  if (!redis) return;
  let cursor = '0';
  do {
    const result = await redis.client.scan(cursor, 'MATCH', `${namespace}:*`, 'COUNT', 100);
    cursor = result[0];
    if (result[1].length) await redis.client.del(...result[1]);
  } while (cursor !== '0');
}
async function createUser(role, label) {
  const { PasswordService } = require('../dist/auth/password.service');
  const email = `${label}-${runId}@example.test`;
  const user = await prisma.user.create({
    data: {
      email,
      firstName: label,
      lastName: 'Integration',
      role,
      emailVerifiedAt: new Date(),
      passwordHash: await app.get(PasswordService).hash(password),
    },
  });
  credentials.set(user.id, { email, password });
  if (role === 'AGENT')
    await prisma.agentProfile.create({
      data: {
        userId: user.id,
        slug: `${label}-${runId}`,
        displayName: label,
        isPublic: true,
        languages: ['en', 'ar'],
        areaId: area.id,
      },
    });
  return user;
}
async function login(user) {
  const response = await request(http)
    .post(`${api}/auth/login`)
    .set('Origin', origin)
    .send(credentials.get(user.id))
    .expect(200);
  return {
    token: response.body.accessToken,
    csrf: response.body.csrfToken,
    cookies: response.headers['set-cookie'].map((cookie) => cookie.split(';')[0]),
    body: response.body,
    headers: response.headers,
  };
}
function auth(req, session) {
  return req.set('Authorization', `Bearer ${session.token}`);
}
function listingInput(slug) {
  return {
    slug,
    titleEn: 'Integration apartment',
    titleAr: 'شقة للاختبار فقط',
    descriptionEn: 'Fictional property used only by isolated integration tests.',
    descriptionAr: 'عقار تجريبي للاختبارات فقط ولا يمثل إعلاناً حقيقياً.',
    purpose: 'SALE',
    propertyType: 'APARTMENT',
    completion: 'READY',
    priceAed: '1250000.00',
    areaSqm: '110.00',
    bedrooms: 2,
    bathrooms: 2,
    addressEn: 'Fictional Dubai address',
    addressAr: 'عنوان تجريبي في دبي',
    areaId: area.id,
  };
}
async function upload(session) {
  const bytes = await sharp({
    create: { width: 24, height: 18, channels: 3, background: '#223344' },
  })
    .png()
    .toBuffer();
  return (
    await auth(request(http).post(`${api}/media`), session)
      .attach('file', bytes, { filename: 'fixture.png', contentType: 'image/png' })
      .expect(201)
  ).body;
}
async function createListing(session, slug, withImage = false) {
  const input = listingInput(slug);
  if (withImage) input.media = [{ mediaId: (await upload(session)).id, position: 0 }];
  return (
    await auth(request(http).post(`${api}/listings/manage`), session)
      .send(input)
      .expect(201)
  ).body;
}
async function publish(listing, ownerSession, adminSession) {
  const submitted = await auth(
    request(http).post(`${api}/listings/manage/${listing.id}/submit`),
    ownerSession,
  )
    .send({ version: listing.version })
    .expect(201);
  return (
    await auth(request(http).post(`${api}/listings/manage/${listing.id}/publish`), adminSession)
      .send({ version: submitted.body.version })
      .expect(201)
  ).body;
}

before(
  async () => {
    assert.ok(
      process.env.DATABASE_URL,
      'Set DATABASE_URL to a local/CI PostgreSQL account with CREATEDB',
    );
    assert.ok(process.env.REDIS_URL, 'Set REDIS_URL for integration tests');
    assert.notEqual(
      process.env.NODE_ENV,
      'production',
      'Never run integration tests with production configuration',
    );
    const base = new URL(process.env.DATABASE_URL);
    control = new Client({ connectionString: base.toString() });
    await control.connect();
    assert.match(databaseName, /^estate_e2e_[a-f0-9]{16}$/);
    await control.query(`CREATE DATABASE "${databaseName}"`);
    base.pathname = `/${databaseName}`;
    uploadDir = await mkdtemp(join(tmpdir(), 'estate-e2e-'));
    Object.assign(process.env, {
      NODE_ENV: 'test',
      DATABASE_URL: base.toString(),
      JWT_SECRET: randomBytes(64).toString('hex'),
      RATE_LIMIT_NAMESPACE: namespace,
      UPLOAD_DIR: uploadDir,
      MAX_UPLOAD_BYTES: '1048576',
      FRONTEND_URL: origin,
      CORS_ORIGINS: origin,
      COOKIE_SECURE: 'false',
      SWAGGER_ENABLED: 'false',
      TRUST_PROXY_HOPS: '0',
      SMTP_HOST:
        process.env.SMTP_HOST === 'localhost' ? '127.0.0.1' : process.env.SMTP_HOST || '127.0.0.1',
      SMTP_PORT: process.env.SMTP_PORT || '1025',
      SMTP_FROM: 'integration@example.test',
      SMTP_SECURE: process.env.SMTP_SECURE || 'false',
    });
    const migration = spawnSync(
      process.execPath,
      [resolve('../../node_modules/prisma/build/index.js'), 'migrate', 'deploy'],
      { env: process.env, encoding: 'utf8' },
    );
    assert.equal(migration.status, 0, `Isolated database migration failed: ${migration.stderr}`);
    const { NestFactory } = require('@nestjs/core');
    const { AppModule } = require('../dist/app.module');
    const { setupApp } = require('../dist/common/setup-app');
    const { PrismaService } = require('../dist/database/prisma.service');
    const { RedisService } = require('../dist/infra/redis.service');
    const { SchedulerRegistry } = require('@nestjs/schedule');
    app = await NestFactory.create(AppModule, { logger: false, bodyParser: false });
    setupApp(app, false);
    await app.init();
    // Explicitly exercise mail delivery; avoid scheduler timing affecting token assertions.
    const scheduler = app.get(SchedulerRegistry);
    for (const id of scheduler.getIntervals()) scheduler.deleteInterval(id);
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
    http = app.getHttpServer();
    area = await prisma.area.create({
      data: {
        slug: `test-area-${runId}`,
        nameEn: 'Test Area',
        nameAr: 'منطقة تجريبية',
        emirate: 'DUBAI',
      },
    });
    agent = await createUser('AGENT', 'agent');
    otherAgent = await createUser('AGENT', 'other-agent');
    admin = await createUser('ADMIN', 'admin');
    customer = await createUser('CUSTOMER', 'customer');
    otherCustomer = await createUser('CUSTOMER', 'other-customer');
  },
  { timeout: 60000 },
);
beforeEach(clearRateKeys);
after(async () => {
  await clearRateKeys();
  if (app) await app.close();
  if (control) {
    await control.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    await control.end();
  }
  if (uploadDir) await rm(uploadDir, { recursive: true, force: true });
});

test('health verifies dependencies, security headers and safe errors', async () => {
  const live = await request(http).get(`${api}/health/live`).expect(200);
  assert.equal(live.headers['x-content-type-options'], 'nosniff');
  assert.equal(live.headers['x-powered-by'], undefined);
  assert.match(live.headers['x-request-id'], /^[a-f0-9-]{36}$/);
  await request(http).get(`${api}/health/ready`).expect(200);
  const bad = await request(http).get(`${api}/listings?limit=5000&passwordHash=x`).expect(400);
  assert.equal(bad.body.statusCode, 400);
  assert.equal(bad.body.stack, undefined);
  await request(http).get(`${api}/listings`).set('Origin', 'https://untrusted.example').expect(403);
});

test('registration rejects privilege injection and sends a one-time verification email', async () => {
  const input = {
    email: `register-${runId}@example.test`,
    password,
    firstName: 'New',
    lastName: 'Customer',
  };
  await request(http)
    .post(`${api}/auth/register`)
    .send({ ...input, role: 'ADMIN' })
    .expect(400);
  const response = await request(http).post(`${api}/auth/register`).send(input).expect(202);
  assert.deepEqual(Object.keys(response.body), ['message']);
  const user = await prisma.user.findUniqueOrThrow({ where: { email: input.email } });
  assert.equal(user.role, 'CUSTOMER');
  assert.equal(user.emailVerifiedAt, null);
  const job = await prisma.emailOutbox.findFirstOrThrow({ where: { to: input.email } });
  const token = /token=([A-Za-z0-9_-]{43})/.exec(job.text)[1];
  assert.ok(
    !(
      await prisma.oneTimeToken.findFirstOrThrow({ where: { userId: user.id } })
    ).tokenHash.includes(token),
  );
  const { MailService } = require('../dist/mail/mail.service');
  await app.get(MailService).processOutbox();
  const delivered = await prisma.emailOutbox.findUniqueOrThrow({ where: { id: job.id } });
  assert.ok(delivered.sentAt, 'SMTP delivery must succeed against Mailpit');
  assert.equal(delivered.text, '');
  assert.equal(delivered.to, '');
  const mailbox = await fetch(
    `${process.env.MAILPIT_URL || 'http://127.0.0.1:8025'}/api/v1/search?query=${encodeURIComponent(`to:${input.email}`)}`,
  ).then((r) => r.json());
  assert.ok(mailbox.messages.length > 0, 'Verification email reaches Mailpit');
  await request(http).post(`${api}/auth/email/verify`).send({ token }).expect(200);
  await request(http).post(`${api}/auth/email/verify`).send({ token }).expect(400);
});

test('login Origin, HttpOnly cookie, CSRF, rotation and replay revocation work over HTTP', async () => {
  await request(http).post(`${api}/auth/login`).send(credentials.get(customer.id)).expect(403);
  const session = await login(customer);
  assert.equal(session.body.refreshToken, undefined);
  assert.ok(
    session.headers['set-cookie'].some(
      (c) => c.startsWith('refreshToken=') && c.includes('HttpOnly') && c.includes('SameSite=Lax'),
    ),
  );
  await request(http)
    .post(`${api}/auth/refresh`)
    .set('Origin', origin)
    .set('Cookie', session.cookies)
    .expect(403);
  const rotated = await request(http)
    .post(`${api}/auth/refresh`)
    .set('Origin', origin)
    .set('Cookie', session.cookies)
    .set('X-CSRF-Token', session.csrf)
    .expect(200);
  await auth(request(http).get(`${api}/auth/me`), session).expect(401);
  await request(http)
    .post(`${api}/auth/refresh`)
    .set('Origin', origin)
    .set('Cookie', session.cookies)
    .set('X-CSRF-Token', session.csrf)
    .expect(401);
  await request(http)
    .get(`${api}/auth/me`)
    .set('Authorization', `Bearer ${rotated.body.accessToken}`)
    .expect(401);
});

test('live account status and role changes invalidate access', async () => {
  const session = await login(otherCustomer);
  await prisma.user.update({ where: { id: otherCustomer.id }, data: { isActive: false } });
  await auth(request(http).get(`${api}/auth/me`), session).expect(401);
  await prisma.user.update({ where: { id: otherCustomer.id }, data: { isActive: true } });
  const staff = await login(otherAgent);
  await prisma.user.update({ where: { id: otherAgent.id }, data: { role: 'CUSTOMER' } });
  await auth(request(http).get(`${api}/listings/manage/mine`), staff).expect(403);
  await prisma.user.update({ where: { id: otherAgent.id }, data: { role: 'AGENT' } });
});

test('agents cannot read/edit other drafts; only admins moderate; stale writes conflict', async () => {
  const owner = await login(agent),
    other = await login(otherAgent),
    moderator = await login(admin);
  const listing = await createListing(owner, `ownership-${runId}`, true);
  await request(http).get(`${api}/listings/${listing.slug}`).expect(404);
  await auth(request(http).get(`${api}/listings/manage/${listing.id}`), other).expect(404);
  await auth(request(http).patch(`${api}/listings/manage/${listing.id}`), other)
    .send({ version: 1, titleEn: 'Unauthorized change' })
    .expect(404);
  await auth(request(http).post(`${api}/listings/manage/${listing.id}/publish`), owner)
    .send({ version: 1 })
    .expect(403);
  const published = await publish(listing, owner, moderator);
  const publicRecord = (await request(http).get(`${api}/listings/${listing.slug}`).expect(200))
    .body;
  const serialized = JSON.stringify(publicRecord);
  for (const forbidden of [
    'passwordHash',
    'tokenHash',
    'storageKey',
    'ownerId',
    'userId',
    agent.email,
  ])
    assert.ok(!serialized.includes(forbidden), forbidden);
  assert.equal(publicRecord.priceAed, '1250000');
  assert.ok(publicRecord.media[0].url);
  const changes = await Promise.all(
    [1, 2].map((n) =>
      auth(request(http).patch(`${api}/listings/manage/${listing.id}`), owner).send({
        version: published.version,
        titleEn: `Concurrent edit ${n}`,
      }),
    ),
  );
  assert.deepEqual(changes.map((r) => r.status).sort(), [200, 409]);
  await request(http).get(`${api}/listings/${listing.slug}`).expect(404);
});

test('media rejects active content, malformed bytes and oversize input; private images stay private', async () => {
  const owner = await login(agent),
    other = await login(otherAgent);
  await auth(request(http).post(`${api}/media`), owner)
    .attach('file', Buffer.from('<svg onload="alert(1)"/>'), {
      filename: 'x.svg',
      contentType: 'image/svg+xml',
    })
    .expect(400);
  await auth(request(http).post(`${api}/media`), owner)
    .attach('file', Buffer.from('invalid'), { filename: 'x.png', contentType: 'image/png' })
    .expect(400);
  await auth(request(http).post(`${api}/media`), owner)
    .attach('file', Buffer.alloc(1048577), { filename: 'x.png', contentType: 'image/png' })
    .expect(413);
  const media = await upload(owner);
  assert.equal(media.mimeType, 'image/webp');
  assert.equal(media.storageKey, undefined);
  await request(http).get(media.url).expect(404);
  await auth(request(http).get(`${api}/media/manage/${media.id}/file`), owner).expect(200);
  await auth(request(http).get(`${api}/media/manage/${media.id}/file`), other).expect(404);
  await auth(request(http).delete(`${api}/media/${media.id}`), other).expect(404);
  const listing = await createListing(owner, `media-${runId}`);
  await auth(request(http).patch(`${api}/listings/manage/${listing.id}`), other)
    .send({ version: listing.version, media: [{ mediaId: media.id, position: 0 }] })
    .expect(404);
  await auth(request(http).patch(`${api}/listings/manage/${listing.id}`), owner)
    .send({ version: listing.version, media: [{ mediaId: media.id, position: 0 }] })
    .expect(200);
  await auth(request(http).delete(`${api}/media/${media.id}`), owner).expect(409);
});

test('public image visibility follows publication and archive immediately', async () => {
  const owner = await login(agent),
    moderator = await login(admin);
  const listing = await createListing(owner, `image-publication-${runId}`, true);
  const published = await publish(listing, owner, moderator);
  const row = (await request(http).get(`${api}/listings/${listing.slug}`)).body;
  const image = await request(http).get(row.media[0].url).expect(200);
  assert.match(image.headers['content-type'], /image\/webp/);
  await auth(request(http).post(`${api}/listings/manage/${listing.id}/archive`), owner)
    .send({ version: published.version })
    .expect(201);
  await request(http).get(row.media[0].url).expect(404);
});

test('leads return a generic acknowledgement and assigned agents alone see private contact details', async () => {
  const owner = await login(agent),
    other = await login(otherAgent),
    moderator = await login(admin);
  const listing = await createListing(owner, `lead-${runId}`, true);
  await publish(listing, owner, moderator);
  const input = {
    type: 'ENQUIRY',
    listingId: listing.id,
    name: 'Contact fixture',
    email: `lead-${runId}@example.test`,
    phone: '+971501234567',
    message: 'Please send details about this fictional listing.',
    consent: true,
  };
  await request(http)
    .post(`${api}/leads`)
    .send({ ...input, consent: false })
    .expect(400);
  const result = await request(http).post(`${api}/leads`).send(input).expect(202);
  assert.deepEqual(Object.keys(result.body), ['message']);
  const lead = await prisma.lead.findFirstOrThrow({ where: { email: input.email } });
  assert.equal(lead.assignedToId, agent.id);
  await request(http).get(`${api}/leads/${lead.id}`).expect(401);
  await auth(request(http).get(`${api}/leads/${lead.id}`), other).expect(404);
  await auth(request(http).get(`${api}/leads/${lead.id}`), owner).expect(200);
  await auth(request(http).patch(`${api}/leads/${lead.id}`), owner)
    .send({ assignedToId: otherAgent.id })
    .expect(403);
  const audits = JSON.stringify(await prisma.auditLog.findMany({ where: { entityId: lead.id } }));
  assert.ok(!audits.includes(input.email));
  assert.ok(!audits.includes(input.phone));
});

test('favorites are account scoped and disappear from public results after withdrawal', async () => {
  const owner = await login(agent),
    moderator = await login(admin),
    member = await login(customer),
    other = await login(otherCustomer);
  const listing = await createListing(owner, `favorite-${runId}`, true);
  const published = await publish(listing, owner, moderator);
  await auth(request(http).put(`${api}/me/favorites/${listing.id}`), member).expect(204);
  await auth(request(http).put(`${api}/me/favorites/${listing.id}`), member).expect(204);
  assert.equal((await auth(request(http).get(`${api}/me/favorites`), member)).body.meta.total, 1);
  assert.equal((await auth(request(http).get(`${api}/me/favorites`), other)).body.meta.total, 0);
  await auth(request(http).post(`${api}/listings/manage/${listing.id}/archive`), owner)
    .send({ version: published.version })
    .expect(201);
  assert.equal((await auth(request(http).get(`${api}/me/favorites`), member)).body.meta.total, 0);
});

test('saved searches reject arbitrary database filters and enforce owner access', async () => {
  const member = await login(customer),
    other = await login(otherCustomer);
  await auth(request(http).post(`${api}/me/saved-searches`), member)
    .send({ name: 'Unsafe', filters: { OR: [{ status: 'DRAFT' }] } })
    .expect(400);
  const saved = await auth(request(http).post(`${api}/me/saved-searches`), member)
    .send({
      name: 'Dubai apartments',
      filters: { emirate: 'DUBAI', propertyType: 'APARTMENT', minPrice: '100000' },
    })
    .expect(201);
  await auth(request(http).get(`${api}/me/saved-searches/${saved.body.id}`), other).expect(404);
  await auth(
    request(http).get(`${api}/me/saved-searches/${saved.body.id}/listings`),
    member,
  ).expect(200);
  await auth(request(http).delete(`${api}/me/saved-searches/${saved.body.id}`), other).expect(404);
});

test('search rejects inconsistent bounds and public permission bypasses', async () => {
  for (const query of [
    'minPrice=200&maxPrice=100',
    'south=25',
    'south=26&north=25&west=54&east=56',
    'status=DRAFT',
    'limit=51',
    'priceOnRequest=true&minPrice=100',
  ])
    await request(http).get(`${api}/listings?${query}`).expect(400);
  await request(http)
    .get(`${api}/listings?emirate=DUBAI&propertyType=APARTMENT&limit=5`)
    .expect(200);
  await request(http).get(`${api}/listings/manage/mine`).expect(401);
});

test('Redis rate limits return 429 and cannot be bypassed with a spoofed forwarded IP', async () => {
  const input = { email: 'missing@example.test', password: 'incorrect-password' };
  for (let i = 0; i < 10; i++)
    await request(http)
      .post(`${api}/auth/login`)
      .set('Origin', origin)
      .set('X-Forwarded-For', `203.0.113.${i}`)
      .send(input)
      .expect(401);
  const response = await request(http)
    .post(`${api}/auth/login`)
    .set('Origin', origin)
    .set('X-Forwarded-For', '198.51.100.99')
    .send(input)
    .expect(429);
  assert.ok(Number(response.headers['retry-after']) > 0);
});

test('password reset consumes token once and revokes existing sessions', async () => {
  const member = await login(customer);
  const response = await request(http)
    .post(`${api}/auth/password-reset/request`)
    .send({ email: customer.email })
    .expect(202);
  assert.deepEqual(Object.keys(response.body), ['message']);
  const job = await prisma.emailOutbox.findFirstOrThrow({
    where: { to: customer.email },
    orderBy: { createdAt: 'desc' },
  });
  const token = /token=([A-Za-z0-9_-]{43})/.exec(job.text)[1];
  const newPassword = `${password}-changed`;
  await request(http)
    .post(`${api}/auth/password-reset/confirm`)
    .send({ token, newPassword })
    .expect(200);
  await auth(request(http).get(`${api}/auth/me`), member).expect(401);
  await request(http)
    .post(`${api}/auth/password-reset/confirm`)
    .send({ token, newPassword })
    .expect(400);
  await request(http)
    .post(`${api}/auth/login`)
    .set('Origin', origin)
    .send(credentials.get(customer.id))
    .expect(401);
  credentials.set(customer.id, { email: customer.email, password: newPassword });
});

test('project workflow validates payment plans and hides inventory when its developer is disabled', async () => {
  const moderator = await login(admin),
    staff = await login(agent);
  const developer = (
    await auth(request(http).post(`${api}/developers/manage`), moderator)
      .send({ slug: `developer-${runId}`, nameEn: 'Fictional developer', nameAr: 'مطور تجريبي' })
      .expect(201)
  ).body;
  const media = await upload(moderator);
  const input = {
    slug: `project-${runId}`,
    nameEn: 'Fictional off-plan project',
    nameAr: 'مشروع تجريبي قيد الإنشاء',
    descriptionEn: 'Fictional development used only for isolated automated testing.',
    descriptionAr: 'مشروع تجريبي للاختبارات الآلية فقط وليس عرضاً عقارياً حقيقياً.',
    startingPriceAed: '1700000.00',
    handoverDate: '2029-12-31',
    minBedrooms: 1,
    maxBedrooms: 3,
    propertyTypes: ['APARTMENT'],
    developerId: developer.id,
    areaId: area.id,
    media: [{ mediaId: media.id, position: 0 }],
    paymentPlan: [
      { labelEn: 'Booking', labelAr: 'الحجز', percentage: 20 },
      { labelEn: 'Handover', labelAr: 'التسليم', percentage: 80 },
    ],
  };
  await auth(request(http).post(`${api}/projects/manage`), staff)
    .send(input)
    .expect(403);
  await auth(request(http).post(`${api}/projects/manage`), moderator)
    .send({ ...input, paymentPlan: [{ labelEn: 'Wrong', labelAr: 'خاطئ', percentage: 70 }] })
    .expect(400);
  const project = (
    await auth(request(http).post(`${api}/projects/manage`), moderator)
      .send(input)
      .expect(201)
  ).body;
  await request(http).get(`${api}/projects/${project.slug}`).expect(404);
  const submitted = (
    await auth(request(http).post(`${api}/projects/manage/${project.id}/submit`), moderator)
      .send({ version: project.version })
      .expect(201)
  ).body;
  await auth(request(http).post(`${api}/projects/manage/${project.id}/publish`), moderator)
    .send({ version: submitted.version })
    .expect(201);
  const publicProject = (await request(http).get(`${api}/projects/${project.slug}`).expect(200))
    .body;
  assert.equal(publicProject.paymentPlan.length, 2);
  await request(http).get(media.url).expect(200);
  await auth(request(http).patch(`${api}/developers/manage/${developer.id}`), moderator)
    .send({ isActive: false })
    .expect(200);
  await request(http).get(`${api}/projects/${project.slug}`).expect(404);
  await request(http).get(media.url).expect(404);
});

test('bilingual content can use its documented length and follows publication visibility', async () => {
  const moderator = await login(admin),
    member = await login(customer);
  const input = {
    slug: `guide-${runId}`,
    type: 'AREA_GUIDE',
    titleEn: 'Fictional area guide',
    titleAr: 'دليل منطقة تجريبية',
    excerptEn: 'A guide fixture.',
    excerptAr: 'دليل تجريبي.',
    bodyEn: 'Guide paragraph. '.repeat(5000),
    bodyAr: 'فقرة دليل تجريبي. '.repeat(4500),
    areaId: area.id,
  };
  await auth(request(http).post(`${api}/content/manage`), member)
    .send(input)
    .expect(403);
  await auth(request(http).post(`${api}/content/manage`), moderator)
    .send({ ...input, bodyEn: '<script>alert(1)</script>' })
    .expect(400);
  const content = (
    await auth(request(http).post(`${api}/content/manage`), moderator)
      .send(input)
      .expect(201)
  ).body;
  await request(http).get(`${api}/content/${content.slug}`).expect(404);
  const published = (
    await auth(request(http).post(`${api}/content/manage/${content.id}/publish`), moderator)
      .send({ version: content.version })
      .expect(201)
  ).body;
  const result = (await request(http).get(`${api}/content/${content.slug}`).expect(200)).body;
  assert.equal(result.bodyAr, input.bodyAr.trim());
  await auth(request(http).post(`${api}/content/manage/${content.id}/archive`), moderator)
    .send({ version: published.version })
    .expect(201);
  await request(http).get(`${api}/content/${content.slug}`).expect(404);
  await request(http)
    .post(`${api}/auth/register`)
    .set('Content-Type', 'application/json')
    .send(JSON.stringify({ padding: 'x'.repeat(2097153) }))
    .expect(413);
});

test('administrative access changes revoke sessions and preserve the last verified admin', async () => {
  const moderator = await login(admin),
    staff = await login(otherAgent),
    member = await login(customer);
  await auth(request(http).patch(`${api}/users/${otherAgent.id}`), member)
    .send({ role: 'ADMIN' })
    .expect(403);
  await auth(request(http).patch(`${api}/users/${admin.id}`), moderator)
    .send({ role: 'CUSTOMER' })
    .expect(409);
  await auth(request(http).patch(`${api}/users/${otherAgent.id}`), moderator)
    .send({ role: 'CUSTOMER' })
    .expect(200);
  await auth(request(http).get(`${api}/auth/me`), staff).expect(401);
  await auth(request(http).patch(`${api}/users/${otherAgent.id}`), moderator)
    .send({ role: 'AGENT' })
    .expect(200);
  await auth(request(http).patch(`${api}/users/me/profile`), member)
    .send({ firstName: 'Updated', role: 'ADMIN' })
    .expect(400);
});

test('account quotas remain bounded under concurrent saved-search insertion', async () => {
  const member = await login(otherCustomer);
  await prisma.savedSearch.deleteMany({ where: { userId: otherCustomer.id } });
  await prisma.savedSearch.createMany({
    data: Array.from({ length: 19 }, (_, n) => ({
      userId: otherCustomer.id,
      name: `Fixture ${n}`,
      filters: {},
    })),
  });
  const results = await Promise.all(
    [1, 2].map((n) =>
      auth(request(http).post(`${api}/me/saved-searches`), member).send({
        name: `Concurrent ${n}`,
        filters: { emirate: 'DUBAI' },
      }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  assert.equal(await prisma.savedSearch.count({ where: { userId: otherCustomer.id } }), 20);
});

test('Redis interruption fails protected requests closed while liveness remains available', async () => {
  redis.client.disconnect(false);
  try {
    await request(http).get(`${api}/listings`).expect(503);
    await request(http).get(`${api}/health/live`).expect(200);
    await request(http).get(`${api}/health/ready`).expect(503);
  } finally {
    await redis.client.connect();
  }
  await request(http).get(`${api}/health/ready`).expect(200);
});

test('database checks reject invalid direct writes outside the HTTP validation layer', async () => {
  const owner = await login(agent);
  const listing = await createListing(owner, `database-checks-${runId}`);
  const direct = new Client({ connectionString: process.env.DATABASE_URL });
  await direct.connect();
  try {
    for (const [sql, constraint] of [
      ['UPDATE "Listing" SET "priceAed" = 0 WHERE id = $1', 'Listing_price_or_on_request_check'],
      ['UPDATE "Listing" SET "areaSqm" = -1 WHERE id = $1', 'Listing_positive_areas_check'],
      ['UPDATE "Listing" SET bedrooms = -1 WHERE id = $1', 'Listing_room_counts_check'],
      [
        'UPDATE "Listing" SET latitude = 25, longitude = NULL WHERE id = $1',
        'Listing_coordinate_pair_check',
      ],
      ['UPDATE "Listing" SET version = 0 WHERE id = $1', 'Listing_positive_version_check'],
    ])
      await assert.rejects(() => direct.query(sql, [listing.id]), { code: '23514', constraint });
  } finally {
    await direct.end();
  }
  assert.equal((await prisma.listing.findUniqueOrThrow({ where: { id: listing.id } })).version, 1);
});

async function createTeamMember(label) {
  const user = await createUser('TEAM_MEMBER', label);
  const profile = await prisma.teamProfile.create({
    data: {
      userId: user.id,
      slug: `${label}-${runId}`,
      displayName: `${label} Synthetic`,
      titleEn: 'Manager',
      titleAr: 'مدير',
      bioEn: 'Synthetic team profile used only in an isolated integration database.',
      bioAr: 'ملف فريق تجريبي للاختبارات المعزولة فقط.',
    },
  });
  return { user, profile };
}

function assertPublicTeamProjection(profile) {
  for (const privateField of [
    'userId',
    'email',
    'passwordHash',
    'avatarMediaId',
    'visitorTokenHash',
    'storageKey',
  ])
    assert.equal(profile[privateField], undefined);
}

test('team profiles keep display titles separate from permissions and scope photo ownership', async () => {
  const owner = await createTeamMember('team-profile-owner');
  const stranger = await createTeamMember('team-profile-other');
  const session = await login(owner.user);
  const otherSession = await login(stranger.user);
  const memberSession = await login(otherCustomer);

  const publicProfile = (
    await request(http).get(`${api}/team/members/${owner.profile.slug}`).expect(200)
  ).body;
  assertPublicTeamProjection(publicProfile);
  assert.equal(publicProfile.displayName, owner.profile.displayName);
  await request(http).get(`${api}/team/me`).expect(401);
  await auth(request(http).get(`${api}/team/me`), memberSession).expect(403);

  await auth(request(http).patch(`${api}/team/me`), session)
    .send({ role: 'ADMIN', userId: stranger.user.id, isPublic: false })
    .expect(400);
  await auth(request(http).patch(`${api}/team/me`), session)
    .send({ displayName: null })
    .expect(400);
  const updated = (
    await auth(request(http).patch(`${api}/team/me`), session)
      .send({ titleEn: 'Administrator', bioEn: 'A display title is not an authorization role.' })
      .expect(200)
  ).body;
  assert.equal(updated.titleEn, 'Administrator');
  assert.equal(updated.email, owner.user.email);
  assert.equal(
    (await prisma.user.findUniqueOrThrow({ where: { id: owner.user.id } })).role,
    'TEAM_MEMBER',
  );
  await auth(request(http).post(`${api}/listings/manage`), session)
    .send(listingInput(`team-forbidden-listing-${runId}`))
    .expect(403);
  await auth(request(http).patch(`${api}/areas/manage/${area.id}`), session)
    .send({ nameEn: 'Not authorized' })
    .expect(403);
  await auth(request(http).get(`${api}/content/manage`), session).expect(403);
  await auth(request(http).patch(`${api}/users/${stranger.user.id}`), session)
    .send({ role: 'ADMIN' })
    .expect(403);

  const photoBytes = await sharp({
    create: { width: 32, height: 40, channels: 3, background: '#645b8b' },
  })
    .png()
    .toBuffer();
  const otherPhoto = (
    await auth(request(http).post(`${api}/team/me/photo`), otherSession)
      .attach('file', photoBytes, { filename: 'synthetic.png', contentType: 'image/png' })
      .expect(201)
  ).body;
  const beforePhoto = (await auth(request(http).get(`${api}/team/me`), session).expect(200)).body;
  await auth(request(http).patch(`${api}/team/me`), session)
    .send({ avatarMediaId: otherPhoto.avatarMediaId })
    .expect(404);
  assert.equal(
    (await auth(request(http).get(`${api}/team/me`), session).expect(200)).body.avatarMediaId,
    beforePhoto.avatarMediaId,
  );
  await auth(request(http).post(`${api}/team/me/photo`), session)
    .attach('file', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), {
      filename: 'forged.png',
      contentType: 'image/png',
    })
    .expect(400);
  const ownPhoto = (
    await auth(request(http).post(`${api}/team/me/photo`), session)
      .attach('file', photoBytes, { filename: 'own.png', contentType: 'image/png' })
      .expect(201)
  ).body;
  assert.ok(ownPhoto.avatarMediaId);
  assert.equal(ownPhoto.photoUrl, `${api}/media/${ownPhoto.avatarMediaId}/file`);
  const media = await prisma.media.findUniqueOrThrow({ where: { id: ownPhoto.avatarMediaId } });
  assert.equal(media.ownerId, owner.user.id);
  assert.equal(media.mimeType, 'image/webp');
  const visiblePhoto = await request(http).get(ownPhoto.photoUrl).expect(200);
  assert.equal(visiblePhoto.headers['content-type'], 'image/webp');
  const reflected = (
    await request(http).get(`${api}/team/members/${owner.profile.slug}`).expect(200)
  ).body;
  assert.equal(reflected.photoUrl, ownPhoto.photoUrl);
  assert.equal(reflected.titleEn, 'Administrator');
  assertPublicTeamProjection(reflected);

  await prisma.user.update({ where: { id: owner.user.id }, data: { emailVerifiedAt: null } });
  await auth(request(http).patch(`${api}/team/me`), session)
    .send({ bioEn: 'Unverified mutation' })
    .expect(403);
  await prisma.user.update({ where: { id: owner.user.id }, data: { isActive: false } });
  await auth(request(http).get(`${api}/team/me`), session).expect(401);
  await request(http).get(`${api}/team/members/${owner.profile.slug}`).expect(404);
  await request(http).get(ownPhoto.photoUrl).expect(404);
});

test('private team conversations enforce visitor receipts, member ownership, expiry and bounded cursors', async () => {
  const owner = await createTeamMember('team-thread-owner');
  const stranger = await createTeamMember('team-thread-other');
  const session = await login(owner.user);
  const otherSession = await login(stranger.user);
  const input = {
    memberId: owner.profile.id,
    name: 'Synthetic Visitor',
    email: `team-visitor-${runId}@example.test`,
    body: 'Question with literal markup: <img src=x onerror=alert(1)>',
    consent: true,
  };
  await request(http)
    .post(`${api}/team/conversations`)
    .send({ ...input, consent: false })
    .expect(400);
  await request(http)
    .post(`${api}/team/conversations`)
    .send({ ...input, sender: 'STAFF' })
    .expect(400);
  const created = (await request(http).post(`${api}/team/conversations`).send(input).expect(201))
    .body;
  assert.match(created.accessToken, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(created.visitorTokenHash, undefined);
  assert.equal(created.messages[0].sender, 'VISITOR');
  assert.equal(created.messages[0].body, input.body);
  assertPublicTeamProjection(created.member);
  const stored = await prisma.teamConversation.findUniqueOrThrow({ where: { id: created.id } });
  const { hashToken } = require('../dist/auth/token.utils');
  assert.equal(stored.visitorTokenHash, hashToken(created.accessToken));
  assert.ok(!JSON.stringify(stored).includes(created.accessToken));
  const audit = await prisma.auditLog.findMany({ where: { entityId: created.id } });
  assert.ok(!JSON.stringify(audit).includes(created.accessToken));
  assert.ok(!JSON.stringify(audit).includes(input.body));
  assert.ok(!JSON.stringify(audit).includes(input.email));

  await request(http).get(`${api}/team/conversations/${created.id}`).expect(404);
  await request(http)
    .get(`${api}/team/conversations/${created.id}`)
    .set('X-Conversation-Token', 'x'.repeat(43))
    .expect(404);
  const guest = (req) => req.set('X-Conversation-Token', created.accessToken);
  const visible = (
    await guest(request(http).get(`${api}/team/conversations/${created.id}`)).expect(200)
  ).body;
  assert.equal(visible.accessToken, undefined);
  assert.equal(visible.visitorTokenHash, undefined);
  assert.equal(visible.messages[0].body, input.body);
  await guest(request(http).post(`${api}/team/conversations/${created.id}/messages`))
    .send({ body: 'Pretend staff', sender: 'STAFF' })
    .expect(400);
  const followUp = (
    await guest(request(http).post(`${api}/team/conversations/${created.id}/messages`))
      .send({ body: 'A visitor follow-up.' })
      .expect(201)
  ).body;
  assert.equal(followUp.message.sender, 'VISITOR');

  const ownInbox = (await auth(request(http).get(`${api}/team/inbox`), session).expect(200)).body;
  assert.ok(ownInbox.data.some((thread) => thread.id === created.id));
  const otherInbox = (await auth(request(http).get(`${api}/team/inbox`), otherSession).expect(200))
    .body;
  assert.ok(!otherInbox.data.some((thread) => thread.id === created.id));
  await auth(request(http).get(`${api}/team/inbox/${created.id}`), otherSession).expect(404);
  const messageCount = await prisma.teamMessage.count({ where: { conversationId: created.id } });
  await auth(request(http).post(`${api}/team/inbox/${created.id}/replies`), otherSession)
    .send({ body: 'A reply to somebody else.' })
    .expect(404);
  assert.equal(
    await prisma.teamMessage.count({ where: { conversationId: created.id } }),
    messageCount,
  );
  const reply = (
    await auth(request(http).post(`${api}/team/inbox/${created.id}/replies`), session)
      .send({ body: 'A private staff answer.' })
      .expect(201)
  ).body;
  assert.equal(reply.message.sender, 'STAFF');
  const answer = (
    await guest(request(http).get(`${api}/team/conversations/${created.id}`)).expect(200)
  ).body;
  assert.ok(
    answer.messages.some(
      (message) => message.id === reply.message.id && message.body === reply.message.body,
    ),
  );

  // A second thread supplies a real foreign cursor; that UUID cannot reveal its messages.
  const otherThread = await prisma.teamConversation.create({
    data: {
      memberId: stranger.profile.id,
      visitorName: 'Other Synthetic Visitor',
      visitorEmail: `other-team-visitor-${runId}@example.test`,
      visitorTokenHash: hashToken(randomBytes(32).toString('base64url')),
      visitorTokenExpiresAt: new Date(Date.now() + 86400000),
      messages: { create: { sender: 'VISITOR', body: 'Foreign private message' } },
    },
    include: { messages: true },
  });
  await guest(request(http).get(`${api}/team/conversations/${otherThread.id}`)).expect(404);
  await guest(
    request(http).get(
      `${api}/team/conversations/${created.id}?before=${otherThread.messages[0].id}`,
    ),
  ).expect(404);
  await auth(
    request(http).get(`${api}/team/inbox/${created.id}?before=${otherThread.messages[0].id}`),
    session,
  ).expect(404);
  await prisma.teamMessage.createMany({
    data: Array.from({ length: 105 }, (_, index) => ({
      conversationId: created.id,
      sender: 'VISITOR',
      body: `Synthetic history ${index}`,
      createdAt: new Date(Date.now() + index + 1),
    })),
  });
  const page = (
    await guest(request(http).get(`${api}/team/conversations/${created.id}`)).expect(200)
  ).body;
  assert.equal(page.messages.length, 100);
  assert.equal(page.hasMore, true);
  assert.ok(page.nextBefore);
  const earlier = (
    await guest(
      request(http).get(`${api}/team/conversations/${created.id}?before=${page.nextBefore}`),
    ).expect(200)
  ).body;
  assert.equal(earlier.hasMore, false);
  assert.ok(earlier.messages.length > 0 && earlier.messages.length < 100);
  const currentIds = new Set(page.messages.map((message) => message.id));
  assert.ok(earlier.messages.every((message) => !currentIds.has(message.id)));

  await prisma.teamConversation.update({
    where: { id: created.id },
    data: { visitorTokenExpiresAt: new Date(Date.now() - 1) },
  });
  await guest(request(http).get(`${api}/team/conversations/${created.id}`)).expect(404);
  await guest(request(http).post(`${api}/team/conversations/${created.id}/messages`))
    .send({ body: 'Expired receipt.' })
    .expect(404);
  await auth(request(http).get(`${api}/team/inbox/${created.id}`), session).expect(200);
});

test('team password changes revoke every existing session without changing the limited role', async () => {
  const owner = await createTeamMember('team-password-owner');
  const first = await login(owner.user);
  const second = await login(owner.user);
  await auth(request(http).post(`${api}/auth/change-password`), first)
    .send({ currentPassword: 'An incorrect password', newPassword: `${password}-changed` })
    .expect(401);
  const nextPassword = `${password}-changed`;
  await auth(request(http).post(`${api}/auth/change-password`), first)
    .send({ currentPassword: password, newPassword: nextPassword })
    .expect(204);
  await auth(request(http).get(`${api}/team/me`), first).expect(401);
  await auth(request(http).get(`${api}/team/me`), second).expect(401);
  await request(http)
    .post(`${api}/auth/refresh`)
    .set('Origin', origin)
    .set('Cookie', second.cookies)
    .set('X-CSRF-Token', second.csrf)
    .expect(401);
  await request(http)
    .post(`${api}/auth/login`)
    .set('Origin', origin)
    .send(credentials.get(owner.user.id))
    .expect(401);
  credentials.set(owner.user.id, { email: owner.user.email, password: nextPassword });
  const renewed = await login(owner.user);
  const profile = (await auth(request(http).get(`${api}/team/me`), renewed).expect(200)).body;
  assert.equal(profile.id, owner.profile.id);
  assert.equal(renewed.body.user.role, 'TEAM_MEMBER');
});

test('administrator dashboard reports database counts and bounded UTC charts without exposing private data to other roles', async () => {
  const moderator = await login(admin);
  const member = await createTeamMember('admin-read-denied');
  const limited = await login(member.user);
  await request(http).get(`${api}/admin/overview`).expect(401);
  for (const path of [
    '/admin/session',
    '/admin/overview',
    '/admin/options',
    '/admin/catalog/areas',
    '/admin/team',
    '/admin/conversations',
    '/admin/audit',
    '/admin/site-content',
  ])
    await auth(request(http).get(`${api}${path}`), limited).expect(403);
  const overview = (
    await auth(request(http).get(`${api}/admin/overview?days=7`), moderator).expect(200)
  ).body;
  assert.equal(overview.summary.listings, await prisma.listing.count());
  assert.equal(overview.summary.leads, await prisma.lead.count());
  assert.equal(overview.daily.length, 7);
  assert.equal(overview.window.timeZone, 'UTC');
  assert.ok(
    overview.daily.every(
      (day) =>
        /^\d{4}-\d{2}-\d{2}$/.test(day.date) &&
        Object.values(day)
          .slice(1)
          .every((value) => Number.isInteger(value) && value >= 0),
    ),
  );
  const expectedLeads = await prisma.lead.count({
    where: {
      createdAt: { gte: new Date(overview.window.from), lte: new Date(overview.window.to) },
    },
  });
  assert.equal(
    overview.daily.reduce((sum, day) => sum + day.leads, 0),
    expectedLeads,
  );
  assert.equal(
    overview.listingStatuses.reduce((sum, row) => sum + row.count, 0),
    overview.summary.listings,
  );
  assert.equal('revenue' in overview.summary, false);
  assert.equal('visitors' in overview.summary, false);
  await auth(request(http).get(`${api}/admin/overview?days=15`), moderator).expect(400);
  const inactive = await prisma.area.create({
    data: {
      slug: `admin-inactive-${runId}`,
      nameEn: 'Inactive editable area',
      nameAr: 'منطقة غير نشطة',
      emirate: 'DUBAI',
      isActive: false,
    },
  });
  await request(http).get(`${api}/areas/${inactive.slug}`).expect(404);
  const catalog = (
    await auth(request(http).get(`${api}/admin/catalog/areas?q=Inactive`), moderator).expect(200)
  ).body;
  assert.ok(catalog.data.some((row) => row.id === inactive.id && row.isActive === false));
  const options = (await auth(request(http).get(`${api}/admin/options`), moderator).expect(200))
    .body;
  assert.ok(options.areas.some((row) => row.id === inactive.id));
  assert.ok(options.agents.every((row) => !('passwordHash' in row) && !('sessions' in row)));
  const unverified = await createUser('ADMIN', 'unverified-admin-dashboard');
  await prisma.user.update({ where: { id: unverified.id }, data: { emailVerifiedAt: null } });
  const session = await login(unverified);
  await auth(request(http).get(`${api}/admin/overview`), session).expect(403);
});

test('site content updates reach the public endpoint, reject HTML and preserve concurrent edits with optimistic versions', async () => {
  const moderator = await login(admin);
  const limited = await login(customer);
  const initial = (await request(http).get(`${api}/site-content`).expect(200)).body;
  assert.equal(typeof initial.values['story.0.title1'].en, 'string');
  assert.equal('fields' in initial, false);
  await auth(request(http).patch(`${api}/admin/site-content`), limited)
    .send({
      expectedVersion: initial.version,
      values: { 'site.title': { en: 'Denied', ar: 'مرفوض' } },
    })
    .expect(403);
  const update = (
    await auth(request(http).patch(`${api}/admin/site-content`), moderator)
      .send({
        expectedVersion: initial.version,
        values: {
          'site.title': { en: 'A managed site title', ar: 'عنوان مُدار للموقع' },
          'story.0.title1': { en: 'A managed story.', ar: 'حكاية مُدارة.' },
        },
      })
      .expect(200)
  ).body;
  assert.equal(update.version, initial.version + 1);
  assert.ok(update.fields.some((field) => field.key === 'site.title' && field.maxLength === 200));
  const live = (await request(http).get(`${api}/site-content`).expect(200)).body;
  assert.equal(live.values['site.title'].en, 'A managed site title');
  assert.equal(live.values['story.0.title1'].ar, 'حكاية مُدارة.');
  for (const values of [
    { unknown: { en: 'x', ar: 'س' } },
    { 'site.title': { en: '<script>unsafe</script>', ar: 'نص' } },
    { 'site.name': { en: '', ar: 'اسم' } },
  ])
    await auth(request(http).patch(`${api}/admin/site-content`), moderator)
      .send({ expectedVersion: update.version, values })
      .expect(400);
  const attempts = await Promise.all(
    ['First writer', 'Second writer'].map((en) =>
      auth(request(http).patch(`${api}/admin/site-content`), moderator).send({
        expectedVersion: update.version,
        values: { 'site.title': { en, ar: 'كاتب' } },
      }),
    ),
  );
  assert.deepEqual(attempts.map((result) => result.status).sort(), [200, 409]);
  const after = (await request(http).get(`${api}/site-content`).expect(200)).body;
  assert.equal(after.version, update.version + 1);
  assert.ok(['First writer', 'Second writer'].includes(after.values['site.title'].en));
});

test('administrators manage team profiles and conversations while promoted staff retain their public identity and own workspace', async () => {
  const moderator = await login(admin);
  const image = await upload(moderator);
  const email = `managed-team-${runId}@example.test`;
  const created = (
    await auth(request(http).post(`${api}/admin/team`), moderator)
      .send({
        email,
        password,
        firstName: 'Managed',
        lastName: 'Team',
        role: 'TEAM_MEMBER',
        slug: `managed-team-${runId}`,
        displayName: 'Managed Team',
        titleEn: 'Manager',
        titleAr: 'مدير',
        avatarMediaId: image.id,
        isPublic: true,
      })
      .expect(201)
  ).body;
  assert.equal(created.user.role, 'TEAM_MEMBER');
  assert.equal('passwordHash' in created.user, false);
  credentials.set(created.user.id, { email, password });
  const own = await login(created.user);
  const guest = (
    await request(http)
      .post(`${api}/team/conversations`)
      .send({
        memberId: created.id,
        name: 'Administrative test visitor',
        email: 'private-visitor@example.test',
        body: 'A private request to the managed profile.',
        consent: true,
      })
      .expect(201)
  ).body;
  const inbox = (
    await auth(
      request(http).get(`${api}/admin/conversations?memberId=${created.id}`),
      moderator,
    ).expect(200)
  ).body;
  assert.ok(inbox.data.some((row) => row.id === guest.id && row.messageCount === 1));
  assert.equal(JSON.stringify(inbox).includes(guest.accessToken), false);
  assert.equal(JSON.stringify(inbox).includes('visitorTokenHash'), false);
  const thread = (
    await auth(request(http).get(`${api}/admin/conversations/${guest.id}`), moderator).expect(200)
  ).body;
  assert.equal(thread.messages[0].body, 'A private request to the managed profile.');
  await auth(request(http).post(`${api}/admin/conversations/${guest.id}/replies`), moderator)
    .send({ body: 'An administrator reply.' })
    .expect(201);
  const live = (
    await request(http)
      .get(`${api}/team/conversations/${guest.id}`)
      .set('X-Conversation-Token', guest.accessToken)
      .expect(200)
  ).body;
  assert.ok(
    live.messages.some(
      (message) => message.body === 'An administrator reply.' && message.sender === 'STAFF',
    ),
  );
  await auth(request(http).patch(`${api}/admin/team/${created.id}`), moderator)
    .send({ role: 'ADMIN' })
    .expect(400);
  await auth(request(http).patch(`${api}/admin/team/${created.id}`), moderator)
    .send({ titleEn: 'Updated public title', isPublic: true })
    .expect(200);
  await auth(request(http).patch(`${api}/users/${created.user.id}`), moderator)
    .send({ role: 'ADMIN' })
    .expect(200);
  await auth(request(http).get(`${api}/team/me`), own).expect(401);
  const promoted = await login(created.user);
  const identity = (await auth(request(http).get(`${api}/team/me`), promoted).expect(200)).body;
  assert.equal(identity.id, created.id);
  assert.equal(identity.titleEn, 'Updated public title');
  const publicDirectory = (await request(http).get(`${api}/team/members`).expect(200)).body;
  assert.ok(publicDirectory.data.some((row) => row.id === created.id));
  await request(http).get(`${api}/media/${image.id}/file`).expect(200);
  await auth(request(http).get(`${api}/team/inbox/${guest.id}`), promoted).expect(200);
  const foreign = await createTeamMember('foreign-admin-profile');
  const foreignThread = (
    await request(http)
      .post(`${api}/team/conversations`)
      .send({
        memberId: foreign.profile.id,
        name: 'Another visitor',
        email: 'another-visitor@example.test',
        body: 'A different member private request.',
        consent: true,
      })
      .expect(201)
  ).body;
  await auth(request(http).get(`${api}/team/inbox/${foreignThread.id}`), promoted).expect(404);
  await auth(request(http).get(`${api}/admin/conversations/${foreignThread.id}`), promoted).expect(
    200,
  );
});

test('administrator password resets revoke sessions and reset links without exposing secrets', async () => {
  const moderator = await login(admin);
  const target = await createUser('CUSTOMER', 'admin-reset-target');
  const old = await login(target);
  await request(http)
    .post(`${api}/auth/password-reset/request`)
    .set('Origin', origin)
    .send({ email: target.email })
    .expect(202);
  const newPassword = `${password}-administrative-reset`;
  await auth(request(http).post(`${api}/admin/users/${target.id}/password`), moderator)
    .send({ newPassword: 'short' })
    .expect(400);
  const reset = (
    await auth(request(http).post(`${api}/admin/users/${target.id}/password`), moderator)
      .send({ newPassword })
      .expect(201)
  ).body;
  assert.equal(JSON.stringify(reset).includes(newPassword), false);
  await auth(request(http).get(`${api}/auth/me`), old).expect(401);
  await request(http)
    .post(`${api}/auth/refresh`)
    .set('Origin', origin)
    .set('Cookie', old.cookies)
    .set('X-CSRF-Token', old.csrf)
    .expect(401);
  assert.equal(await prisma.oneTimeToken.count({ where: { userId: target.id, usedAt: null } }), 0);
  credentials.set(target.id, { email: target.email, password: newPassword });
  await login(target);
  const audit = await prisma.auditLog.findMany({
    where: { entityId: target.id },
    select: { metadata: true },
  });
  assert.equal(JSON.stringify(audit).includes(newPassword), false);
});

function richParagraph(text, marks) {
  return { type: 'paragraph', content: [{ type: 'text', text, ...(marks ? { marks } : {}) }] };
}
function richImage(mediaId) {
  return {
    type: 'image',
    attrs: {
      mediaId,
      alt: 'A verified library image',
      caption: 'A considered place to live.',
      width: 'wide',
      align: 'center',
    },
  };
}
function richDocument(...content) {
  return { type: 'doc', content };
}
function richTable() {
  return {
    type: 'table',
    content: [
      {
        type: 'tableRow',
        content: [
          { type: 'tableHeader', content: [richParagraph('Feature')] },
          { type: 'tableHeader', content: [richParagraph('Detail')] },
        ],
      },
      {
        type: 'tableRow',
        content: [
          { type: 'tableCell', content: [richParagraph('Location')] },
          { type: 'tableCell', content: [richParagraph('Dubai')] },
        ],
      },
    ],
  };
}
function articleInput(slug) {
  return {
    slug,
    type: 'NEWS',
    titleEn: 'A new perspective on living',
    titleAr: 'منظور جديد للحياة',
    excerptEn: 'A concise guide to a considered home.',
    excerptAr: 'دليل موجز لاختيار منزل مناسب.',
    bodyEn: 'A complete English article body for integration verification.',
    bodyAr: 'محتوى عربي كامل للمقال التجريبي المستخدم في الاختبارات.',
  };
}

test('rich news content derives searchable text, keeps drafts private and tracks inline image lifetime', async () => {
  const administrator = await login(admin),
    owner = await login(otherAgent);
  const inline = await upload(owner);
  const document = richDocument(
    {
      type: 'heading',
      attrs: { level: 2, textAlign: null },
      content: [
        { type: 'text', text: 'A new chapter', marks: [{ type: 'bold' }, { type: 'italic' }] },
      ],
    },
    richParagraph('A literal <script> stays escaped content, not executable HTML.'),
    richParagraph('Read the guide.', [
      {
        type: 'link',
        attrs: {
          href: '/en/insights',
          target: '_blank',
          rel: 'noopener noreferrer nofollow',
          class: null,
        },
      },
    ]),
    richTable(),
    richImage(inline.id),
  );
  const input = {
    ...articleInput(`rich-news-${runId}`),
    bodyEn: 'Untrusted companion text must be replaced.',
    bodyRichEn: document,
  };
  const created = await auth(request(http).post(`${api}/content/manage`), administrator)
    .send(input)
    .expect(201);
  assert.match(created.body.bodyEn, /A literal <script>/);
  assert.doesNotMatch(created.body.bodyEn, /Untrusted companion/);
  assert.equal(created.body.bodyRichEn.type, 'doc');
  assert.equal(
    await prisma.articleRichMedia.count({
      where: { articleId: created.body.id, mediaId: inline.id },
    }),
    1,
  );
  await request(http).get(`${api}/content/${input.slug}`).expect(404);
  await request(http).get(`${api}/media/${inline.id}/file`).expect(404);
  await auth(request(http).delete(`${api}/media/${inline.id}`), administrator).expect(409);
  const published = await auth(
    request(http).post(`${api}/content/manage/${created.body.id}/publish`),
    administrator,
  )
    .send({ version: created.body.version })
    .expect(201);
  const publicArticle = await request(http).get(`${api}/content/${input.slug}`).expect(200);
  assert.equal(
    publicArticle.body.bodyRichEn.content.find((node) => node.type === 'image').attrs.mediaId,
    inline.id,
  );
  await request(http)
    .get(`${api}/media/${inline.id}/file`)
    .expect(200)
    .expect('Content-Type', /image\/webp/);
  const summaries = await request(http).get(`${api}/content`).query({ type: 'NEWS' }).expect(200);
  const summary = summaries.body.data.find((row) => row.id === created.body.id);
  assert.ok(summary);
  assert.equal('bodyRichEn' in summary, false);
  assert.equal('bodyEn' in summary, false);
  const edited = await auth(
    request(http).patch(`${api}/content/manage/${created.body.id}`),
    administrator,
  )
    .send({
      version: published.body.version,
      bodyEn: 'A new plain-text revision intentionally removes the old formatting.',
    })
    .expect(200);
  assert.equal(edited.body.bodyRichEn, null);
  assert.equal(edited.body.status, 'DRAFT');
  assert.equal(await prisma.articleRichMedia.count({ where: { articleId: created.body.id } }), 0);
  await request(http).get(`${api}/media/${inline.id}/file`).expect(404);
  await auth(request(http).delete(`${api}/media/${inline.id}`), administrator).expect(204);
  await auth(request(http).patch(`${api}/content/manage/${created.body.id}`), administrator)
    .send({ version: published.body.version, bodyRichEn: document })
    .expect(409);
});

test('rich listing descriptions enforce agent ownership, preserve the other locale and withdraw edited publication', async () => {
  const owner = await login(agent),
    foreign = await login(otherAgent),
    administrator = await login(admin),
    customerSession = await login(customer);
  const foreignImage = await upload(foreign),
    inline = await upload(owner),
    gallery = await upload(owner);
  const base = {
    ...listingInput(`rich-listing-${runId}`),
    media: [{ mediaId: gallery.id, position: 0 }],
    descriptionRichEn: richDocument(
      richParagraph('A detailed English description for a considered new property.'),
      richImage(inline.id),
    ),
    descriptionRichAr: richDocument(
      richParagraph('وصف عربي مفصل للعقار التجريبي يوضح خصائص المكان.'),
    ),
  };
  await auth(request(http).post(`${api}/listings/manage`), owner)
    .send({
      ...base,
      slug: `foreign-rich-${runId}`,
      descriptionRichEn: richDocument(
        richParagraph('A sufficiently detailed description of a fictional property.'),
        richImage(foreignImage.id),
      ),
    })
    .expect(400);
  await auth(request(http).post(`${api}/listings/manage`), customerSession)
    .send(base)
    .expect(403);
  const created = await auth(request(http).post(`${api}/listings/manage`), owner)
    .send(base)
    .expect(201);
  const savedArabic = created.body.descriptionRichAr;
  assert.equal(await prisma.listingRichMedia.count({ where: { listingId: created.body.id } }), 1);
  await request(http).get(`${api}/media/${inline.id}/file`).expect(404);
  await auth(request(http).delete(`${api}/media/${inline.id}`), owner).expect(409);
  const published = await publish(created.body, owner, administrator);
  const publicListing = await request(http).get(`${api}/listings/${base.slug}`).expect(200);
  assert.deepEqual(publicListing.body.descriptionRichAr, savedArabic);
  assert.equal(publicListing.body.descriptionRichEn.type, 'doc');
  await request(http).get(`${api}/media/${inline.id}/file`).expect(200);
  await auth(request(http).get(`${api}/listings/manage/${created.body.id}`), foreign).expect(404);
  const edited = await auth(request(http).patch(`${api}/listings/manage/${created.body.id}`), owner)
    .send({
      version: published.version,
      descriptionRichEn: richDocument(
        richParagraph('A revised description that no longer includes an inline image.'),
      ),
    })
    .expect(200);
  assert.deepEqual(edited.body.descriptionRichAr, savedArabic);
  assert.equal(edited.body.status, 'IN_REVIEW');
  await request(http).get(`${api}/listings/${base.slug}`).expect(404);
  await request(http).get(`${api}/media/${inline.id}/file`).expect(404);
  await auth(request(http).delete(`${api}/media/${inline.id}`), owner).expect(204);
});

test('published project rich images follow area and developer eligibility and explicit formatting removal', async () => {
  const administrator = await login(admin),
    inline = await upload(administrator),
    gallery = await upload(administrator);
  const developer = await prisma.developer.create({
    data: { slug: `rich-developer-${runId}`, nameEn: 'Rich developer', nameAr: 'مطور تجريبي' },
  });
  const input = {
    slug: `rich-project-${runId}`,
    nameEn: 'A considered new development',
    nameAr: 'مشروع سكني تجريبي',
    descriptionEn: 'A sufficiently detailed project description for isolated tests.',
    descriptionAr: 'وصف عربي مفصل للمشروع التجريبي المستخدم في الاختبارات.',
    descriptionRichEn: richDocument(
      richParagraph('A considered development with a real payment plan and useful details.'),
      richImage(inline.id),
    ),
    minBedrooms: 1,
    maxBedrooms: 3,
    propertyTypes: ['APARTMENT'],
    priceOnRequest: true,
    handoverDate: '2028-01-01',
    areaId: area.id,
    developerId: developer.id,
    media: [{ mediaId: gallery.id, position: 0 }],
  };
  const created = await auth(request(http).post(`${api}/projects/manage`), administrator)
    .send(input)
    .expect((response) => assert.equal(response.status, 201, JSON.stringify(response.body)));
  const submitted = await auth(
    request(http).post(`${api}/projects/manage/${created.body.id}/submit`),
    administrator,
  )
    .send({ version: created.body.version })
    .expect(201);
  const published = await auth(
    request(http).post(`${api}/projects/manage/${created.body.id}/publish`),
    administrator,
  )
    .send({ version: submitted.body.version })
    .expect(201);
  const detail = await request(http).get(`${api}/projects/${input.slug}`).expect(200);
  assert.equal(detail.body.descriptionRichEn.type, 'doc');
  await request(http).get(`${api}/media/${inline.id}/file`).expect(200);
  await prisma.developer.update({ where: { id: developer.id }, data: { isActive: false } });
  await request(http).get(`${api}/media/${inline.id}/file`).expect(404);
  await prisma.developer.update({ where: { id: developer.id }, data: { isActive: true } });
  try {
    await prisma.area.update({ where: { id: area.id }, data: { isActive: false } });
    await request(http).get(`${api}/media/${inline.id}/file`).expect(404);
  } finally {
    await prisma.area.update({ where: { id: area.id }, data: { isActive: true } });
  }
  const cleared = await auth(
    request(http).patch(`${api}/projects/manage/${created.body.id}`),
    administrator,
  )
    .send({ version: published.body.version, descriptionRichEn: null })
    .expect(200);
  assert.equal(cleared.body.descriptionRichEn, null);
  assert.match(cleared.body.descriptionEn, /A considered development/);
  await auth(request(http).delete(`${api}/media/${inline.id}`), administrator).expect(204);
});

test('rich API rejects unsafe structures and deeply nested content before persistence', async () => {
  const administrator = await login(admin);
  const bodies = [
    richDocument({ type: 'iframe', attrs: { src: 'https://example.test' } }),
    richDocument(
      richParagraph('Unsafe links are never stored.', [
        { type: 'link', attrs: { href: 'javascript:alert(1)' } },
      ]),
    ),
    richDocument({
      type: 'image',
      attrs: {
        src: 'https://example.test/image.jpg',
        mediaId: '0f000000-0000-4000-8000-000000000001',
      },
    }),
    richDocument({
      type: 'paragraph',
      attrs: { style: 'background:url(javascript:bad)' },
      content: [{ type: 'text', text: 'Unsafe attribute' }],
    }),
    richDocument({
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            { type: 'tableCell', attrs: { colspan: 30 }, content: [richParagraph('Too wide')] },
          ],
        },
      ],
    }),
  ];
  let nested = richParagraph('Too deep');
  for (let index = 0; index < 1000; index++) nested = { type: 'blockquote', content: [nested] };
  bodies.push(richDocument(nested));
  for (let index = 0; index < bodies.length; index++)
    await auth(request(http).post(`${api}/content/manage`), administrator)
      .send({ ...articleInput(`rejected-rich-${index}-${runId}`), bodyRichEn: bodies[index] })
      .expect(400);
  let unknown = {};
  for (let index = 0; index < 1000; index++) unknown = { nested: unknown };
  await auth(request(http).post(`${api}/content/manage`), administrator)
    .send({ ...articleInput(`rejected-rich-extra-${runId}`), unknown })
    .expect(400);
  assert.equal(
    await prisma.article.count({ where: { slug: { startsWith: `rejected-rich-` } } }),
    0,
  );
});
