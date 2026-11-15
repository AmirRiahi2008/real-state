import { test, expect, type Browser, type BrowserContext } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import type { SiteContent } from '../lib/admin-types';
const origin = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const fixturePath = process.env.ADMIN_E2E_PROVISION_FILE;
const credentials = fixturePath
  ? (JSON.parse(readFileSync(fixturePath, 'utf8')) as { email: string; password: string })
  : null;
const headers = { Origin: origin };
async function authenticated(browser: Browser) {
  if (!credentials) throw new Error('A private admin fixture is required');
  const context = await browser.newContext({ baseURL: origin });
  const response = await context.request.post('/api/admin/auth/login', {
    headers,
    data: credentials,
  });
  expect(response.status(), 'Authorized local administrator can sign in').toBe(200);
  return context;
}
async function json(context: BrowserContext, path: string) {
  const response = await context.request.get(`/api/admin${path}`);
  expect(response.ok(), `${path} returns HTTP ${response.status()}`).toBe(true);
  return response.json();
}
async function close(context: BrowserContext) {
  await context.request.post('/api/admin/auth/logout', { headers }).catch(() => undefined);
  await context.close();
}

test.describe('private local admin operations', () => {
  test.skip(
    !credentials,
    'Requires a private ADMIN_E2E_PROVISION_FILE; no personal credentials in source',
  );
  test.setTimeout(120000);
  test('CMS edits update English and Arabic public content, including an already open server-rendered page', async ({
    browser,
  }) => {
    const context = await authenticated(browser);
    const publicPage = await context.newPage();
    const admin = await context.newPage();
    admin.setDefaultTimeout(20000);
    publicPage.setDefaultTimeout(20000);
    const original = (await json(context, '/admin/site-content')) as SiteContent;
    const keys = ['home.featuredTitle1', 'story.0.title1'];
    const nonce = Date.now();
    const en = `Your next space ${nonce}.`,
      ar = `مساحتك القادمة ${nonce}.`,
      story = `A new beginning ${nonce}.`;
    let changed = false;
    try {
      await publicPage.goto('/en#discover');
      await expect(
        publicPage.getByRole('heading', {
          name: new RegExp(original.values[keys[0]].en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
        }),
      ).toBeVisible();
      await admin.goto('/en/admin#site-content');
      await expect(
        admin.getByRole('heading', { name: 'Website content', exact: true }),
      ).toBeVisible();
      await admin.locator('[id="cms-home.featuredTitle1-en"]').fill(en);
      await admin.locator('[id="cms-home.featuredTitle1-ar"]').fill(ar);
      await admin.locator('[id="cms-story.0.title1-en"]').fill(story);
      const [saved] = await Promise.all([
        admin.waitForResponse(
          (r) =>
            new URL(r.url()).pathname === '/api/admin/admin/site-content' &&
            r.request().method() === 'PATCH',
        ),
        admin.getByRole('button', { name: 'Save 2 changes', exact: true }).click(),
      ]);
      expect(saved.status()).toBe(200);
      changed = true;
      // This tab was opened before the save. BroadcastChannel + the public gateway
      // must refresh both client copy and server-rendered HomeSections.
      await expect(
        publicPage.getByRole('heading', {
          name: new RegExp(en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
        }),
      ).toBeVisible({ timeout: 20000 });
      const publicContent = await context.request.get('/api/backend/v1/site-content');
      expect(publicContent.status()).toBe(200);
      expect((await publicContent.json()).values[keys[0]]).toEqual({ en, ar });
      const html = await context.request.get('/en');
      expect(await html.text()).toContain(story);
      await publicPage.goto('/ar#discover');
      await expect(
        publicPage.getByRole('heading', {
          name: new RegExp(ar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
        }),
      ).toBeVisible();
      expect(
        (
          await context.request.post('/api/backend/v1/site-content', { headers, data: {} })
        ).status(),
      ).toBe(404);
    } finally {
      if (changed) {
        const current = (await json(context, '/admin/site-content')) as SiteContent;
        const restored = await context.request.patch('/api/admin/admin/site-content', {
          headers,
          data: {
            expectedVersion: current.version,
            values: Object.fromEntries(keys.map((key) => [key, original.values[key]])),
          },
        });
        expect(restored.status(), 'Restore only the CMS fields changed by this verification').toBe(
          200,
        );
      }
      await close(context);
    }
  });

  test('admin manages a new team profile, sees every QA conversation, replies and controls account access', async ({
    browser,
  }) => {
    const context = await authenticated(browser);
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const visitor = await browser.newContext({ baseURL: origin });
    const visitorPage = await visitor.newPage();
    visitorPage.setDefaultTimeout(20000);
    const staff = await browser.newContext({ baseURL: origin });
    const nonce = Date.now(),
      name = `Operations QA ${nonce}`,
      email = `operations-${nonce}@example.test`,
      password = randomBytes(18).toString('base64url'),
      replacement = randomBytes(18).toString('base64url');
    let userId: string | null = null,
      memberId: string | null = null,
      mediaId: string | null = null;
    try {
      await page.goto('/en/admin#team');
      await page.getByRole('button', { name: 'Add team member', exact: true }).click();
      const dialog = page.locator('.admin-op-dialog');
      for (const [key, value] of Object.entries({
        firstName: 'Operations',
        lastName: `QA ${nonce}`,
        email,
        password,
        displayName: name,
        slug: `operations-qa-${nonce}`,
        titleEn: 'Community manager',
        titleAr: 'مدير المجتمع',
        bioEn: 'A synthetic profile used to verify the full administration workflow.',
        bioAr: 'ملف تجريبي للتحقق من إدارة الموقع.',
      }))
        await dialog.locator(`[name="${key}"]`).fill(value);
      const [upload] = await Promise.all([
        page.waitForResponse(
          (r) =>
            new URL(r.url()).pathname === '/api/admin/media' && r.request().method() === 'POST',
        ),
        dialog
          .locator('input[type="file"]')
          .setInputFiles(resolve(__dirname, '../../api/demo-assets/property-01.webp')),
      ]);
      expect(upload.status()).toBe(201);
      mediaId = (await upload.json()).id;
      const [created] = await Promise.all([
        page.waitForResponse(
          (r) =>
            new URL(r.url()).pathname === '/api/admin/admin/team' &&
            r.request().method() === 'POST',
        ),
        dialog.getByRole('button', { name: 'Save member', exact: true }).click(),
      ]);
      expect(created.status()).toBe(201);
      const member = await created.json();
      memberId = member.id;
      userId = member.userId;
      await expect(dialog).toHaveCount(0);
      const directory = await context.request.get('/api/team/members');
      const publicMember = (await directory.json()).data.find(
        (m: { id: string }) => m.id === memberId,
      );
      expect(publicMember.displayName).toBe(name);
      expect(publicMember.photoUrl).toBeTruthy();
      expect(
        (
          await context.request.get(publicMember.photoUrl.replace('/api/v1/', '/api/backend/v1/'))
        ).status(),
      ).toBe(200);
      // Limited members cannot enter admin; the dedicated team login remains usable.
      expect(
        (
          await staff.request.post('/api/admin/auth/login', { headers, data: { email, password } })
        ).status(),
      ).toBe(403);
      expect(
        (
          await staff.request.post('/api/team/auth/login', { headers, data: { email, password } })
        ).status(),
      ).toBe(200);
      expect((await staff.request.get('/api/team/session')).status()).toBe(200);
      await visitorPage.goto('/en/qa');
      await expect(visitorPage.getByTestId('page-loader')).toHaveCount(0);
      await visitorPage.getByRole('button', { name: `Message ${name}`, exact: true }).click();
      await visitorPage.getByLabel('Your name', { exact: true }).fill(`QA visitor ${nonce}`);
      await visitorPage
        .getByLabel('Email address', { exact: true })
        .fill(`visitor-${nonce}@example.test`);
      await visitorPage
        .getByLabel('Your message', { exact: true })
        .fill(
          `Please verify the administrator can reply to this team member's conversation ${nonce}.`,
        );
      await visitorPage.getByRole('checkbox').check();
      const [conversation] = await Promise.all([
        visitorPage.waitForResponse(
          (r) =>
            new URL(r.url()).pathname === '/api/team/conversations' &&
            r.request().method() === 'POST',
        ),
        visitorPage.getByRole('button', { name: 'Send your message', exact: true }).click(),
      ]);
      expect(conversation.status()).toBe(201);
      const thread = await conversation.json();
      await page.goto('/en/admin#conversations');
      await page.getByLabel('Search', { exact: true }).fill(`QA visitor ${nonce}`);
      const row = page
        .locator('.admin-conversation-row')
        .filter({ hasText: `QA visitor ${nonce}` });
      await expect(row).toHaveCount(1);
      await row.click();
      const reply = `The administrator has received your message ${nonce}.`;
      await page.locator('#admin-reply').fill(reply);
      const [sent] = await Promise.all([
        page.waitForResponse(
          (r) =>
            new URL(r.url()).pathname.endsWith(`/admin/conversations/${thread.id}/replies`) &&
            r.request().method() === 'POST',
        ),
        page.getByRole('button', { name: 'Send reply', exact: true }).click(),
      ]);
      expect(sent.status()).toBe(201);
      await expect(visitorPage.getByText(reply, { exact: true })).toBeVisible({ timeout: 15000 });
      await page
        .locator('.admin-op-dialog')
        .getByRole('button', { name: 'Close dialog / إغلاق', exact: true })
        .click();
      await page.goto('/en/admin#users');
      await page.getByLabel('Search', { exact: true }).fill(email);
      const userRow = page.locator('.admin-table tbody tr').filter({ hasText: email });
      await expect(userRow).toHaveCount(1);
      await userRow.getByRole('button', { name: 'Set password', exact: true }).click();
      const passwordDialog = page.locator('.admin-op-dialog');
      await passwordDialog.getByLabel('New password', { exact: true }).fill(replacement);
      await passwordDialog.getByLabel('Confirm password', { exact: true }).fill(replacement);
      const [reset] = await Promise.all([
        page.waitForResponse(
          (r) =>
            new URL(r.url()).pathname === `/api/admin/admin/users/${userId}/password` &&
            r.request().method() === 'POST',
        ),
        passwordDialog.getByRole('button', { name: 'Set password', exact: true }).click(),
      ]);
      expect(reset.status()).toBe(201);
      await passwordDialog.getByRole('button', { name: 'Done', exact: true }).click();
      expect((await staff.request.get('/api/team/session')).status()).toBe(401);
      expect(
        (
          await staff.request.post('/api/team/auth/login', {
            headers,
            data: { email, password: replacement },
          })
        ).status(),
      ).toBe(200);
      await userRow.getByRole('button', { name: 'Edit access', exact: true }).click();
      const access = page.locator('.admin-op-dialog');
      await access.getByLabel('Account is active', { exact: true }).uncheck();
      const [disabled] = await Promise.all([
        page.waitForResponse(
          (r) =>
            new URL(r.url()).pathname === `/api/admin/users/${userId}` &&
            r.request().method() === 'PATCH',
        ),
        access.getByRole('button', { name: 'Save user', exact: true }).click(),
      ]);
      expect(disabled.status()).toBe(200);
      expect((await staff.request.get('/api/team/session')).status()).toBe(401);
      const hidden = await context.request.get('/api/team/members');
      expect((await hidden.json()).data.some((m: { id: string }) => m.id === memberId)).toBe(false);
    } finally {
      if (memberId)
        await context.request.patch(`/api/admin/admin/team/${memberId}`, {
          headers,
          data: { isPublic: false, avatarMediaId: null },
        });
      if (userId)
        await context.request.patch(`/api/admin/users/${userId}`, {
          headers,
          data: { isActive: false },
        });
      if (mediaId) await context.request.delete(`/api/admin/media/${mediaId}`, { headers });
      await staff.request.post('/api/team/auth/logout', { headers }).catch(() => undefined);
      await staff.close();
      await visitor.close();
      await close(context);
    }
  });

  test('admin creates and tracks a customer enquiry with assignment and internal notes', async ({
    browser,
  }) => {
    const context = await authenticated(browser),
      page = await context.newPage();
    page.setDefaultTimeout(20000);
    const nonce = Date.now(),
      name = `Enquiry workflow ${nonce}`;
    let leadId: string | null = null;
    try {
      const session = await json(context, '/session');
      const publishedResponse = await context.request.get('/api/backend/v1/listings?limit=50');
      const publishedProperties = (await publishedResponse.json()).data;
      const property =
        publishedProperties.find((item: { reference?: string }) =>
          item.reference?.startsWith('ORIVA-DEMO-'),
        ) ?? publishedProperties[0];
      expect(property).toBeTruthy();
      const viewingTime = new Date(Date.now() + 86400000 + 4 * 3600000).toISOString().slice(0, 16);
      await page.goto('/en/admin#leads');
      await page.getByRole('button', { name: 'Add enquiry', exact: true }).click();
      const dialog = page.locator('.admin-op-dialog');
      await dialog.getByLabel('Customer name', { exact: true }).fill(name);
      await dialog.getByLabel('Email', { exact: true }).fill(`enquiry-${nonce}@example.test`);
      await dialog.getByLabel('Phone with country code', { exact: true }).fill('+971501234567');
      await dialog
        .getByRole('combobox', { name: 'Enquiry type', exact: true })
        .selectOption('VIEWING');
      await dialog
        .getByRole('combobox', { name: 'Requested property', exact: true })
        .selectOption(property.id);
      await dialog.locator('[name="preferredAt"]').fill(viewingTime);
      await dialog
        .getByLabel('Message', { exact: true })
        .fill(`I would like a conversation about homes in the Emirates ${nonce}.`);
      await dialog.getByRole('checkbox').check();
      const [created] = await Promise.all([
        page.waitForResponse(
          (r) =>
            new URL(r.url()).pathname === '/api/admin/leads' && r.request().method() === 'POST',
        ),
        dialog.getByRole('button', { name: 'Save enquiry', exact: true }).click(),
      ]);
      expect(created.status()).toBe(202);
      await expect(dialog).toHaveCount(0);
      const lead = (await json(context, '/leads?limit=50')).data.find(
        (r: { name: string }) => r.name === name,
      );
      expect(lead).toBeTruthy();
      leadId = lead.id;
      const row = page.locator('.admin-table tbody tr').filter({ hasText: name });
      await row.getByRole('button', { name: 'Open enquiry', exact: true }).click();
      await expect(dialog.getByRole('link', { name: property.titleEn, exact: true })).toBeVisible();
      await expect(dialog.getByText('Requested viewing time', { exact: true })).toBeVisible();
      await dialog.getByRole('combobox', { name: 'Status', exact: true }).selectOption('CONTACTED');
      await dialog
        .getByRole('combobox', { name: 'Assigned to', exact: true })
        .selectOption(session.user.id);
      await dialog
        .getByLabel('Internal notes', { exact: true })
        .fill(`Follow up on the customer's preferences ${nonce}.`);
      const [updated] = await Promise.all([
        page.waitForResponse(
          (r) =>
            new URL(r.url()).pathname === `/api/admin/leads/${leadId}` &&
            r.request().method() === 'PATCH',
        ),
        dialog.getByRole('button', { name: 'Save enquiry', exact: true }).click(),
      ]);
      expect(updated.status()).toBe(200);
      const stored = await json(context, `/leads/${leadId}`);
      expect(stored.status).toBe('CONTACTED');
      expect(stored.listingId).toBe(property.id);
      expect(stored.preferredAt).toBe(new Date(`${viewingTime}+04:00`).toISOString());
      expect(stored.assignedToId).toBe(session.user.id);
      expect(stored.internalNotes).toContain(String(nonce));
      const audit = await json(context, '/admin/audit?limit=50');
      expect(
        audit.data.some(
          (entry: { entityId: string; action: string }) =>
            entry.entityId === leadId && entry.action === 'lead.updated',
        ),
      ).toBe(true);
    } finally {
      if (leadId)
        await context.request.patch(`/api/admin/leads/${leadId}`, {
          headers,
          data: { status: 'CLOSED' },
        });
      await close(context);
    }
  });
});
