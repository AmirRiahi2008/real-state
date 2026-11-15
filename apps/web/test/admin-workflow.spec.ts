import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface PrivateAdmin {
  email: string;
  password: string;
}
interface ManagedRecord {
  id: string;
  slug: string;
  version: number;
  status: string;
  [key: string]: unknown;
}
const privateFile = process.env.ADMIN_E2E_PROVISION_FILE;
const administrator: PrivateAdmin | null =
  privateFile && existsSync(privateFile)
    ? (JSON.parse(readFileSync(privateFile, 'utf8')) as PrivateAdmin)
    : null;
const demoImage = [
  resolve(process.cwd(), '../api/demo-assets/property-01.webp'),
  resolve(process.cwd(), 'apps/api/demo-assets/property-01.webp'),
].find(existsSync);
const mutationHeaders = { Origin: 'http://localhost:3000' };

function field(page: Page, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return page
    .getByLabel(new RegExp(`^${escaped}(?:\\s*\\*)?$`))
    .and(page.locator('input, textarea, select, [contenteditable="true"]'));
}
async function signIn(page: Page) {
  page.setDefaultTimeout(20000);
  page.setDefaultNavigationTimeout(30000);
  await page.goto('/en/admin/login');
  await field(page, 'Email address').fill(administrator!.email);
  await field(page, 'Password').fill(administrator!.password);
  const [response] = await Promise.all([
    page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === '/api/admin/auth/login' && r.request().method() === 'POST',
    ),
    page.getByRole('button', { name: 'Sign in', exact: true }).click(),
  ]);
  expect(response.status()).toBe(200);
  const session = await response.json();
  expect(session.user.role).toBe('ADMIN');
  expect(session).not.toHaveProperty('accessToken');
  expect(session).not.toHaveProperty('csrfToken');
  await expect(page.locator('.admin-workspace')).toBeVisible();
  return session;
}
async function nav(page: Page, name: string) {
  const paths: Record<string, string> = {
    Overview: '/admin/overview',
    Properties: '/listings/manage/mine',
    Developments: '/projects/manage',
    Areas: '/admin/catalog/areas',
    Developers: '/admin/catalog/developers',
    Amenities: '/admin/catalog/amenities',
    'Property advisors': '/admin/catalog/agents',
    'Website content': '/admin/site-content',
    'Articles & guides': '/content/manage',
    'Media library': '/media/manage/mine',
    Enquiries: '/leads',
    'QA conversations': '/admin/conversations',
    'The team': '/admin/team',
    'Users & access': '/users',
    'Activity log': '/admin/audit',
  };
  const pendingResponse = paths[name]
    ? page.waitForResponse(
        (result) =>
          new URL(result.url()).pathname === `/api/admin${paths[name]}` &&
          result.request().method() === 'GET',
      )
    : null;
  const [response] = await Promise.all([
    pendingResponse,
    page
      .locator('.admin-sidebar .admin-navigation')
      .getByRole('button', { name, exact: true })
      .click(),
  ]);
  await expect(page.locator('.admin-page-heading h1')).toContainText(name);
  if (response) expect(response.ok(), `${name} section data loads`).toBe(true);
  else await expect(page.locator('.admin-account-layout')).toBeVisible();
}
async function mutate(page: Page, path: string, click: () => Promise<unknown>, method = 'POST') {
  const [response] = await Promise.all([
    page.waitForResponse(
      (r) => new URL(r.url()).pathname === `/api/admin${path}` && r.request().method() === method,
    ),
    click(),
  ]);
  expect(response.ok(), `${method} ${path} returned ${response.status()}`).toBe(true);
  return response.status() === 204 ? null : ((await response.json()) as ManagedRecord);
}
function recordRow(page: Page, name: string) {
  return page
    .locator('.admin-records-table tbody tr')
    .filter({ has: page.getByText(name, { exact: true }) });
}
async function fill(page: Page, label: string, value: string) {
  await field(page, label).fill(value);
}
async function copyFields(page: Page, name: string, arabic: string, title = false) {
  await fill(page, title ? 'English title' : 'English name', name);
  await fill(page, title ? 'Arabic title' : 'Arabic name', arabic);
}
async function chooseImages(page: Page, imageId: string, single = false) {
  await page
    .getByRole('button', { name: single ? 'Choose image' : 'Manage images', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Choose imagery', exact: true });
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole('button', { name: `Select image ${imageId.slice(0, 8)}`, exact: true })
    .click();
  await dialog.getByRole('button', { name: 'Use selected images', exact: true }).click();
  await expect(dialog).toHaveCount(0);
}
async function publish(page: Page, section: string, name: string, id: string, review: boolean) {
  let row = recordRow(page, name);
  await expect(row).toHaveCount(1);
  if (review) {
    await mutate(page, `/${section}/manage/${id}/submit`, () =>
      row.getByRole('button', { name: 'Submit', exact: true }).click(),
    );
    row = recordRow(page, name);
    await expect(row.getByRole('button', { name: 'Publish', exact: true })).toBeVisible();
  }
  await mutate(page, `/${section}/manage/${id}/publish`, () =>
    row.getByRole('button', { name: 'Publish', exact: true }).click(),
  );
  await expect(recordRow(page, name).getByText('Published', { exact: true })).toBeVisible();
}
async function publicRecord(context: BrowserContext, path: string) {
  const response = await context.request.get(`/api/backend/v1${path}`);
  expect(response.status(), `Public resource ${path}`).toBe(200);
  return response.json();
}
async function archiveCreated(context: BrowserContext, section: string, id: string) {
  const current = await context.request.get(`/api/admin/${section}/manage/${id}`);
  if (!current.ok()) return;
  const record = (await current.json()) as ManagedRecord;
  if (record.status !== 'ARCHIVED') {
    const archived = await context.request.post(`/api/admin/${section}/manage/${id}/archive`, {
      headers: mutationHeaders,
      data: { version: record.version },
    });
    expect(archived.ok(), `Clean up synthetic ${section}`).toBe(true);
  }
}

test.describe('locally provisioned administration', () => {
  test.skip(
    !administrator,
    'Set ADMIN_E2E_PROVISION_FILE to a private local administrator fixture.',
  );

  test('admin creates, edits and publishes real property, project and article records', async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(240000);
    expect(demoImage, 'Packaged property image is available').toBeTruthy();
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    const stamp = Date.now();
    const areaName = `Synthetic Marina ${stamp}`,
      developerName = `Synthetic Homes ${stamp}`;
    const projectName = `Synthetic Horizon ${stamp}`,
      listingName = `Synthetic Residence ${stamp}`,
      articleName = `Synthetic Market Guide ${stamp}`;
    const projectSlug = `synthetic-horizon-${stamp}`,
      listingSlug = `synthetic-residence-${stamp}`,
      articleSlug = `synthetic-guide-${stamp}`;
    let areaId: string | undefined,
      developerId: string | undefined,
      projectId: string | undefined,
      listingId: string | undefined,
      articleId: string | undefined;
    try {
      await signIn(page);
      await nav(page, 'Areas');
      await page.getByRole('button', { name: 'Add area', exact: true }).click();
      await fill(page, 'URL slug', `synthetic-marina-${stamp}`);
      await copyFields(page, areaName, `منطقة تجريبية ${stamp}`);
      areaId = (await mutate(page, '/areas/manage', () =>
        page.getByRole('button', { name: 'Save changes', exact: true }).click(),
      ))!.id;
      await expect(recordRow(page, areaName)).toBeVisible();

      await nav(page, 'Developers');
      await page.getByRole('button', { name: 'Add developer', exact: true }).click();
      await fill(page, 'URL slug', `synthetic-homes-${stamp}`);
      await copyFields(page, developerName, `مطور تجريبي ${stamp}`);
      developerId = (await mutate(page, '/developers/manage', () =>
        page.getByRole('button', { name: 'Save changes', exact: true }).click(),
      ))!.id;
      await expect(recordRow(page, developerName)).toBeVisible();

      await nav(page, 'Amenities');
      await page.getByRole('button', { name: 'Add amenity', exact: true }).click();
      await fill(page, 'URL slug', `synthetic-garden-${stamp}`);
      await copyFields(page, `Synthetic Garden ${stamp}`, `حديقة تجريبية ${stamp}`);
      const amenityId = (await mutate(page, '/amenities/manage', () =>
        page.getByRole('button', { name: 'Save changes', exact: true }).click(),
      ))!.id;
      // Amenities are alphabetical; a new record may be beyond the first page.
      await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled();
      for (
        let pages = 0;
        pages < 20 && !(await recordRow(page, `Synthetic Garden ${stamp}`).count());
        pages++
      ) {
        const next = page.getByRole('button', { name: 'Next', exact: true });
        if (!(await next.isEnabled())) break;
        await Promise.all([
          page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname === '/api/admin/admin/catalog/amenities' &&
              response.request().method() === 'GET',
          ),
          next.click(),
        ]);
        await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled();
      }
      await expect(recordRow(page, `Synthetic Garden ${stamp}`)).toBeVisible();

      await nav(page, 'Media library');
      await page.locator('.admin-media-upload input[type="file"]').setInputFiles(demoImage!);
      const mediaId = (await mutate(page, '/media', () =>
        page.getByRole('button', { name: 'Upload image', exact: true }).click(),
      ))!.id;
      await expect(
        page.getByAltText(`Library image ${mediaId.slice(0, 8)}`, { exact: true }),
      ).toBeVisible();

      await nav(page, 'Developments');
      await page.getByRole('button', { name: 'Add project', exact: true }).click();
      await fill(page, 'URL slug', projectSlug);
      await copyFields(page, projectName, `مشروع تجريبي ${stamp}`);
      await fill(
        page,
        'English description',
        'A synthetic local project used to verify real administration and publication workflows.',
      );
      await fill(
        page,
        'Arabic description',
        'مشروع تجريبي محلي للتحقق من إدارة العقارات والنشر والمحتوى بطريقة صحيحة.',
      );
      await fill(page, 'Starting price · AED', '2500000');
      await fill(page, 'Estimated handover', `${new Date().getUTCFullYear() + 2}-12-01`);
      await fill(page, 'Minimum bedrooms', '1');
      await fill(page, 'Maximum bedrooms', '3');
      await field(page, 'Area').selectOption(areaId!);
      await field(page, 'Developer').selectOption(developerId!);
      await page.getByRole('checkbox', { name: `Synthetic Garden ${stamp}`, exact: true }).check();
      await chooseImages(page, mediaId);
      await page.getByRole('button', { name: 'Add milestone', exact: true }).click();
      await page.getByRole('button', { name: 'Add milestone', exact: true }).click();
      await field(page, 'English milestone').nth(0).fill('On booking');
      await field(page, 'Arabic milestone').nth(0).fill('عند الحجز');
      await field(page, 'Percentage %').nth(0).fill('20');
      await field(page, 'English milestone').nth(1).fill('On handover');
      await field(page, 'Arabic milestone').nth(1).fill('عند التسليم');
      await field(page, 'Percentage %').nth(1).fill('80');
      await page.getByRole('button', { name: 'Add floor plan', exact: true }).click();
      await fill(page, 'English plan name', 'Two bedroom residence');
      await fill(page, 'Arabic plan name', 'شقة بغرفتي نوم');
      await fill(page, 'Bedrooms', '2');
      await fill(page, 'Area m²', '128.50');
      projectId = (await mutate(page, '/projects/manage', () =>
        page.getByRole('button', { name: 'Save draft', exact: true }).click(),
      ))!.id;
      await publish(page, 'projects', projectName, projectId, true);
      const project = await publicRecord(context, `/projects/${projectSlug}`);
      expect(project.paymentPlan).toHaveLength(2);
      expect(project.floorPlans).toHaveLength(1);
      expect(project.media[0].id).toBe(mediaId);
      expect(project.amenities.some((item: { id: string }) => item.id === amenityId)).toBe(true);
      await recordRow(page, projectName).getByRole('button', { name: 'Edit', exact: true }).click();
      await fill(page, 'English name', `${projectName} Revised`);
      await mutate(
        page,
        `/projects/manage/${projectId}`,
        () => page.getByRole('button', { name: 'Save draft', exact: true }).click(),
        'PATCH',
      );
      await publish(page, 'projects', `${projectName} Revised`, projectId, false);
      expect((await publicRecord(context, `/projects/${projectSlug}`)).nameEn).toBe(
        `${projectName} Revised`,
      );

      const agentsResponse = await context.request.get('/api/admin/admin/catalog/agents?limit=50');
      expect(agentsResponse.ok()).toBe(true);
      const agentProfiles = (await agentsResponse.json()).data as {
        userId: string;
        isPublic: boolean;
        user?: { isActive: boolean };
      }[];
      const agent = agentProfiles.find((item) => item.isPublic && item.user?.isActive !== false);
      expect(agent, 'An existing public advisor is available for the listing').toBeTruthy();
      await nav(page, 'Properties');
      await page.getByRole('button', { name: 'Add property', exact: true }).click();
      await fill(page, 'URL slug', listingSlug);
      await copyFields(page, listingName, `عقار تجريبي ${stamp}`, true);
      await fill(
        page,
        'English description',
        'A synthetic local apartment for end-to-end administration checks, with no actual offer for sale.',
      );
      await fill(
        page,
        'Arabic description',
        'شقة تجريبية محلية للتحقق من لوحة الإدارة والنشر، ولا تمثل عرضاً حقيقياً للبيع.',
      );
      await fill(page, 'Asking price · AED', '2800000');
      await fill(page, 'Internal area · m²', '128.50');
      await fill(page, 'Bedrooms', '2');
      await fill(page, 'Bathrooms', '2');
      await fill(page, 'English address', 'Synthetic Marina, Dubai');
      await fill(page, 'Arabic address', 'المرسى التجريبي، دبي');
      await field(page, 'Area').selectOption(areaId!);
      await field(page, 'Listing agent').selectOption(agent!.userId);
      await field(page, 'Related project').selectOption(projectId);
      await chooseImages(page, mediaId);
      await fill(page, 'English alt text', 'Synthetic apartment interior');
      await fill(page, 'Arabic alt text', 'داخل شقة تجريبية');
      listingId = (await mutate(page, '/listings/manage', () =>
        page.getByRole('button', { name: 'Save draft', exact: true }).click(),
      ))!.id;
      await publish(page, 'listings', listingName, listingId, true);
      const listing = await publicRecord(context, `/listings/${listingSlug}`);
      expect(listing.project.id).toBe(projectId);
      expect(listing.media[0].id).toBe(mediaId);
      await recordRow(page, listingName).getByRole('button', { name: 'Edit', exact: true }).click();
      await fill(page, 'English title', `${listingName} Updated`);
      await mutate(
        page,
        `/listings/manage/${listingId}`,
        () => page.getByRole('button', { name: 'Save draft', exact: true }).click(),
        'PATCH',
      );
      await publish(page, 'listings', `${listingName} Updated`, listingId, false);
      expect((await publicRecord(context, `/listings/${listingSlug}`)).titleEn).toBe(
        `${listingName} Updated`,
      );

      await nav(page, 'Articles & guides');
      await page.getByRole('button', { name: 'Add article', exact: true }).click();
      await fill(page, 'URL slug', articleSlug);
      await copyFields(page, articleName, `دليل السوق التجريبي ${stamp}`, true);
      await fill(page, 'English excerpt', 'A local synthetic guide for real publishing checks.');
      await fill(page, 'Arabic excerpt', 'دليل تجريبي محلي للتحقق من النشر الحقيقي.');
      await fill(
        page,
        'English article',
        'This is a synthetic local market article. It verifies safe plain-text rendering and real publication from the administrator workspace.',
      );
      await fill(
        page,
        'Arabic article',
        'هذا مقال سوق تجريبي محلي للتحقق من عرض النصوص بأمان والنشر الحقيقي من لوحة الإدارة.',
      );
      await field(page, 'Area').selectOption(areaId!);
      await chooseImages(page, mediaId, true);
      articleId = (await mutate(page, '/content/manage', () =>
        page.getByRole('button', { name: 'Save draft', exact: true }).click(),
      ))!.id;
      await publish(page, 'content', articleName, articleId, false);
      expect((await publicRecord(context, `/content/${articleSlug}`)).titleEn).toBe(articleName);
      await recordRow(page, articleName).getByRole('button', { name: 'Edit', exact: true }).click();
      await fill(page, 'English title', `${articleName} Updated`);
      await mutate(
        page,
        `/content/manage/${articleId}`,
        () => page.getByRole('button', { name: 'Save draft', exact: true }).click(),
        'PATCH',
      );
      await publish(page, 'content', `${articleName} Updated`, articleId, false);
      expect((await publicRecord(context, `/content/${articleSlug}`)).titleEn).toBe(
        `${articleName} Updated`,
      );

      const publicPage = await context.newPage();
      await publicPage.goto(`/en/insights/${articleSlug}`);
      await expect(
        publicPage.getByRole('heading', { name: `${articleName} Updated`, exact: true }),
      ).toBeVisible();
      await publicPage.goto(`/en/properties/${listingSlug}`);
      await expect(
        publicPage.getByRole('heading', { name: `${listingName} Updated`, exact: true }),
      ).toBeVisible();
      await publicPage.goto(`/en/projects/${projectSlug}`);
      await expect(
        publicPage.getByRole('heading', { name: `${projectName} Revised`, exact: true }),
      ).toBeVisible();
      await publicPage.close();

      await recordRow(page, `${articleName} Updated`)
        .getByRole('button', { name: `Archive ${articleName} Updated`, exact: true })
        .click();
      const archiveDialog = page.getByRole('dialog', { name: 'Archive this record?', exact: true });
      await mutate(page, `/content/manage/${articleId}/archive`, () =>
        archiveDialog.getByRole('button', { name: 'Archive record', exact: true }).click(),
      );
      expect((await context.request.get(`/api/backend/v1/content/${articleSlug}`)).status()).toBe(
        404,
      );
      expect(pageErrors).toEqual([]);
    } finally {
      if (listingId) await archiveCreated(context, 'listings', listingId);
      if (projectId) await archiveCreated(context, 'projects', projectId);
      if (articleId) await archiveCreated(context, 'content', articleId);
      if (areaId)
        await context.request.patch(`/api/admin/areas/manage/${areaId}`, {
          headers: mutationHeaders,
          data: { isActive: false },
        });
      if (developerId)
        await context.request.patch(`/api/admin/developers/manage/${developerId}`, {
          headers: mutationHeaders,
          data: { isActive: false },
        });
      await context.request
        .post('/api/admin/auth/logout', { headers: mutationHeaders })
        .catch(() => undefined);
      await context.close();
    }
  });

  test('real dashboard data, every section and responsive bilingual themes are usable', async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(180000);
    const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await signIn(page);
      await expect(page.locator('.admin-line-chart')).toBeVisible();
      await expect(page.getByRole('combobox', { name: 'Period', exact: true })).toHaveValue('30');
      const [seven] = await Promise.all([
        page.waitForResponse(
          (r) =>
            new URL(r.url()).pathname === '/api/admin/admin/overview' &&
            new URL(r.url()).searchParams.get('days') === '7',
        ),
        page.getByRole('combobox', { name: 'Period', exact: true }).selectOption('7'),
      ]);
      expect(seven.ok()).toBe(true);
      const metrics = await seven.json();
      expect(metrics.window.days).toBe(7);
      expect(metrics.daily).toHaveLength(7);
      expect(metrics.summary.listings).toBeGreaterThanOrEqual(13);
      await expect(page.locator('.admin-line-chart')).toBeVisible();
      await field(page, 'Inspect a day').focus();
      await field(page, 'Inspect a day').press('Home');
      await expect(field(page, 'Inspect a day')).toHaveValue('0');
      await page.screenshot({
        path: '../../.artifacts/admin-desktop-overview.png',
        fullPage: true,
      });
      const names = [
        'Properties',
        'Developments',
        'Areas',
        'Developers',
        'Amenities',
        'Property advisors',
        'Website content',
        'Articles & guides',
        'Media library',
        'Enquiries',
        'QA conversations',
        'The team',
        'Users & access',
        'Activity log',
        'My account',
      ];
      for (const name of names) {
        await nav(page, name);
        await expect(page.locator('.admin-main [aria-busy="true"]')).toHaveCount(0);
        await expect(page.locator('.admin-main .admin-alert-error')).toHaveCount(0);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
          `${name} overflow`,
        ).toBeLessThanOrEqual(1);
      }
      await nav(page, 'Properties');
      await page.screenshot({
        path: '../../.artifacts/admin-desktop-properties.png',
        fullPage: true,
      });
      await nav(page, 'Overview');
      await expect(page.locator('.admin-line-chart')).toBeVisible();
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.getByRole('button', { name: 'Open menu', exact: true })).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
        'Mobile overview overflow',
      ).toBeLessThanOrEqual(1);
      await page.screenshot({ path: '../../.artifacts/admin-mobile-overview.png', fullPage: true });
      await page.getByRole('button', { name: 'Open menu', exact: true }).click();
      const drawer = page.getByRole('dialog', { name: 'Administration menu', exact: true });
      await expect(drawer).toBeVisible();
      await drawer.getByRole('button', { name: 'Properties', exact: true }).click();
      await expect(drawer).not.toBeVisible();
      await expect(page.locator('.admin-records-table')).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
        'Mobile table outer overflow',
      ).toBeLessThanOrEqual(1);
      await page.screenshot({
        path: '../../.artifacts/admin-mobile-properties.png',
        fullPage: true,
      });
      await page.goto('/ar/admin');
      await expect(page.locator('.admin-workspace')).toHaveAttribute('dir', 'rtl');
      await expect(page.locator('.admin-line-chart')).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
        'Arabic mobile overflow',
      ).toBeLessThanOrEqual(1);
      await page.screenshot({ path: '../../.artifacts/admin-arabic-mobile.png', fullPage: true });
      await page.getByRole('button', { name: 'تفعيل الوضع الداكن', exact: true }).click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      await page.screenshot({
        path: '../../.artifacts/admin-arabic-mobile-dark.png',
        fullPage: true,
      });
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.screenshot({
        path: '../../.artifacts/admin-arabic-desktop-dark.png',
        fullPage: true,
      });
      expect(errors).toEqual([]);
    } finally {
      await context.request
        .post('/api/admin/auth/logout', { headers: mutationHeaders })
        .catch(() => undefined);
      await context.close();
    }
  });
});
