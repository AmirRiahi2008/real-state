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
      SMTP_HOST: process.env.SMTP_HOST || '127.0.0.1',
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
    .send(JSON.stringify({ padding: 'x'.repeat(1048577) }))
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
