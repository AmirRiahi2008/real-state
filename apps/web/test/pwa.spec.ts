import { expect, test, type Page } from '@playwright/test';

async function ready(page: Page, path = '/en/projects') {
  await page.goto(path);
  await expect(page.getByTestId('page-loader')).toHaveCount(0, { timeout: 20000 });
  await page.waitForFunction(() => navigator.serviceWorker?.controller, undefined, {
    timeout: 20000,
  });
}

async function manualInstallation(page: Page) {
  // Native browser chrome cannot be clicked by Playwright. Keep manual-guide tests deterministic.
  await page.addInitScript(() => {
    window.addEventListener(
      'beforeinstallprompt',
      (event) => {
        if ('orivaTestPrompt' in event) return;
        event.preventDefault();
        event.stopImmediatePropagation();
      },
      true,
    );
  });
}

test.use({ reducedMotion: 'reduce' });

test('browser recognizes an installable app, real icons and a root-scoped worker', async ({
  playwright,
  request,
}, testInfo) => {
  // Chrome intentionally blocks installation in Playwright's default incognito contexts.
  const context = await playwright.chromium.launchPersistentContext(
    testInfo.outputPath('install-profile'),
    {
      channel: testInfo.project.use.channel,
      baseURL: testInfo.project.use.baseURL,
      reducedMotion: 'reduce',
      ...testInfo.project.use.launchOptions,
    },
  );
  try {
    const page = context.pages()[0] || (await context.newPage());
    await ready(page);
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
      'href',
      '/manifest.webmanifest',
    );
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
      'href',
      '/icons/apple-touch-icon.png',
    );
    const response = await request.get('/manifest.webmanifest');
    expect(response.ok()).toBe(true);
    const manifest = await response.json();
    expect(manifest).toMatchObject({
      id: '/',
      short_name: 'ORIVA',
      start_url: '/en',
      scope: '/',
      display: 'standalone',
      prefer_related_applications: false,
    });
    for (const icon of manifest.icons) {
      const response = await request.get(icon.src);
      expect(response.ok()).toBe(true);
      expect(response.headers()['content-type']).toContain('image/png');
      const png = await response.body();
      expect(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`).toBe(icon.sizes);
    }
    const worker = await request.get('/sw.js');
    expect(worker.headers()['content-type']).toContain('application/javascript');
    expect(worker.headers()['cache-control']).toContain('no-store');
    expect(worker.headers()['service-worker-allowed']).toBe('/');
    expect(worker.headers()['content-security-policy']).toContain("connect-src 'self'");
    expect(await page.evaluate(async () => (await navigator.serviceWorker.ready).scope)).toBe(
      new URL('/', page.url()).href,
    );

    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Page.enable');
    const browserManifest = await cdp.send('Page.getAppManifest');
    expect(browserManifest.url).toBe(new URL('/manifest.webmanifest', page.url()).href);
    expect(browserManifest.errors).toEqual([]);
    const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
    expect(installabilityErrors).toEqual([]);
    await cdp.detach();
  } finally {
    await context.close();
  }
});

test('native install prompt is used once; manual guide supports keyboard dismissal', async ({
  page,
}) => {
  await manualInstallation(page);
  await ready(page);
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(event, {
      orivaTestPrompt: true,
      prompt: async () => {
        sessionStorage.setItem('oriva-test-prompt-count', '1');
      },
      userChoice: Promise.resolve({ outcome: 'dismissed' }),
    });
    window.dispatchEvent(event);
  });
  const install = page.getByRole('button', { name: 'Install ORIVA', exact: true });
  await install.click();
  expect(await page.evaluate(() => sessionStorage.getItem('oriva-test-prompt-count'))).toBe('1');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await install.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect
    .poll(() => dialog.locator('img').evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBe(192);
  await expect(dialog).toContainText('Open your browser’s menu.');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(install).toBeFocused();
  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
  await expect(install).toHaveCount(0);
});

test('Arabic iPhone installation guide fits the screen and follows the chosen theme', async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
  });
  try {
    const page = await context.newPage();
    await manualInstallation(page);
    await ready(page, '/ar/projects');
    await page.getByRole('button', { name: 'تفعيل الوضع الداكن', exact: true }).click();
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#101d25');
    await page.getByRole('button', { name: 'تثبيت أوريفا', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Safari');
    await expect(dialog).toContainText('إضافة إلى الشاشة الرئيسية');
    const bounds = await dialog.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(dialog).toHaveCSS('background-color', 'rgb(20, 36, 46)');
    await dialog.getByRole('button', { name: 'حسناً', exact: true }).click();
    await expect(dialog).not.toBeVisible();
  } finally {
    await context.close();
  }
});

for (const locale of ['en', 'ar']) {
  test(`${locale}: real offline navigation shows a localized shell, then recovers`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await ready(page);
    await context.setOffline(true);
    await page.goto(`/${locale}/properties`);
    await expect(page).toHaveTitle(
      locale === 'ar' ? 'أنت غير متصل | أوريفا' : "You're offline | ORIVA",
    );
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
    await expect(page.locator('h1')).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    ).toBeLessThanOrEqual(1);
    await expect(page.locator('button')).toHaveCSS('background-color', 'rgb(219, 195, 158)');
    await page.screenshot({ path: `../../.artifacts/pwa-offline-${locale}.png` });
    await context.setOffline(false);
    await page.getByRole('button', { name: locale === 'ar' ? 'حاول مجدداً' : 'Try again' }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/properties$`));
    await expect(page.locator('.property-card, .catalog-property-card').first()).toBeVisible();
    await expect(page.getByTestId('page-loader')).toHaveCount(0);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
  });
}

test('API and private routes are never cached; offline requests fail without fake success', async ({
  page,
  context,
}) => {
  await ready(page);
  expect(
    await page.evaluate(async () => (await fetch('/api/backend/v1/health/ready')).status),
  ).toBe(200);
  await page.goto('/en/admin/login');
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  const cachedPaths = await page.evaluate(async () => {
    const keys = (await caches.keys()).filter((key) => key.startsWith('oriva-pwa-'));
    return (
      await Promise.all(
        keys.map(async (key) =>
          (await (await caches.open(key)).keys()).map((request) => new URL(request.url).pathname),
        ),
      )
    ).flat();
  });
  expect(cachedPaths.length).toBeGreaterThan(0);
  expect(cachedPaths.every((path) => /^\/(offline|icons)\//.test(path))).toBe(true);
  expect(cachedPaths).not.toContain('/en/admin/login');
  await context.setOffline(true);
  for (const method of ['GET', 'POST']) {
    const result = await page.evaluate(async (method) => {
      try {
        const response = await fetch('/api/backend/v1/leads', {
          method,
          ...(method === 'POST'
            ? { headers: { 'Content-Type': 'application/json' }, body: '{}' }
            : {}),
        });
        return { networkFailure: false, status: response.status };
      } catch {
        return { networkFailure: true };
      }
    }, method);
    expect(result.networkFailure).toBe(true);
  }
  await page.reload();
  await expect(page).toHaveTitle("You're offline | ORIVA");
  await expect(page.locator('input')).toHaveCount(0);
  await context.setOffline(false);
});

test('a new worker waits for consent and only removes its own outdated caches', async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(async () => {
    await caches.open('oriva-pwa-obsolete-test');
    await caches.open('unrelated-app-test');
    // Changing the script URL creates a real worker update without editing the running app.
    await navigator.serviceWorker.register('/sw.js?revision=pwa-update-test', {
      scope: '/',
      updateViaCache: 'none',
    });
  });
  const update = page.getByRole('button', { name: 'Update now', exact: true });
  await expect(update).toBeVisible();
  expect(await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).not.toContain(
    'pwa-update-test',
  );
  expect(await page.evaluate(() => caches.has('oriva-pwa-obsolete-test'))).toBe(true);
  await Promise.all([page.waitForEvent('domcontentloaded'), update.click()]);
  await page.waitForFunction(() =>
    navigator.serviceWorker.controller?.scriptURL.includes('pwa-update-test'),
  );
  expect(await page.evaluate(() => caches.has('oriva-pwa-obsolete-test'))).toBe(false);
  expect(await page.evaluate(() => caches.has('unrelated-app-test'))).toBe(true);
  await expect(page.locator('.catalog-page-heading h1')).toBeVisible();
});
