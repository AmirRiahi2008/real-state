import { expect, test } from '@playwright/test';

test('the Burj Khalifa story builds through a minute-long scroll and rewinds cleanly', async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const scrollToBuild = async (progress: number) => {
    await page.evaluate((value) => {
      const story = document.querySelector('#story')!;
      const start = story.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({
        top: start + (story.scrollHeight - window.innerHeight) * value,
        behavior: 'instant',
      });
    }, progress);
  };
  await page.goto('/');
  await expect(page).toHaveURL(/\/en\/?$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const scene = page.locator('[data-scene-stage]');
  await expect(scene.locator('canvas')).toBeVisible({ timeout: 20000 });
  await expect(scene).toHaveAttribute('data-scene-ready', 'true', { timeout: 40000 });
  await expect(page.getByTestId('page-loader')).toHaveCount(0, { timeout: 30000 });
  await expect(scene).not.toHaveAttribute('data-webgl-fallback', 'true');
  await expect(scene).toHaveAttribute('data-landmark', 'burj-khalifa');
  await expect(scene).toHaveAttribute('data-scene-stage', 'vision');
  await expect(scene).toHaveAttribute('data-built-floors', '0');
  await expect
    .poll(async () => Number(await scene.getAttribute('data-build-progress')))
    .toBeLessThan(1);
  const viewport = page.viewportSize()!;
  await expect
    .poll(async () => (await scene.locator('canvas').boundingBox())?.width ?? 0)
    .toBeGreaterThan(viewport.width * 0.94);
  await expect
    .poll(async () => (await scene.locator('canvas').boundingBox())?.height ?? 0)
    .toBeGreaterThan(viewport.height * 0.8);
  await expect(page.locator('#story')).toHaveClass(/cinematic-story/);
  await expect(page.locator('#story')).toHaveAttribute('data-target-scroll-seconds', '60');
  await expect(page.locator('.story-chapter')).toHaveCount(12);
  expect(
    await page.locator('#story').evaluate((element) => element.scrollHeight - innerHeight),
  ).toBeGreaterThanOrEqual(19000);
  await expect(page.getByTestId('construction-progress')).toHaveAttribute('aria-valuenow', '0');

  await scrollToBuild(0.51);
  await expect(scene).toHaveAttribute('data-scene-stage', 'vertical');
  await expect
    .poll(async () => Number(await scene.getAttribute('data-build-progress')))
    .toBeGreaterThan(45);
  await expect
    .poll(async () => Number(await scene.getAttribute('data-build-progress')))
    .toBeLessThan(60);
  await expect
    .poll(async () => Number(await scene.getAttribute('data-built-floors')))
    .toBeGreaterThan(0);

  await scrollToBuild(0.68);
  await expect(scene).toHaveAttribute('data-scene-stage', 'envelope');
  await expect(page.locator('.cinematic-caption h2')).toContainText('A changing horizon.');
  await expect
    .poll(() =>
      page.locator('.cinematic-caption h2').evaluate((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        const bounds = range.getBoundingClientRect();
        return bounds.left >= 0 && bounds.right <= window.innerWidth;
      }),
    )
    .toBe(true);

  await scrollToBuild(0.95);
  await expect(scene).toHaveAttribute('data-scene-stage', 'handover');
  await scrollToBuild(0.99);
  await expect(scene).toHaveAttribute('data-scene-stage', 'investment');
  await scrollToBuild(1);
  await expect
    .poll(async () => Number(await scene.getAttribute('data-build-progress')))
    .toBeGreaterThan(99);
  await expect(scene).toHaveAttribute('data-built-floors', '163');
  await expect(scene).toHaveAttribute('data-camera-settled', 'true', { timeout: 20000 });
  await expect
    .poll(async () => Number(await scene.getAttribute('data-depth-near')))
    .toBeGreaterThan(1);
  await expect(scene).toHaveAttribute('data-crane-visible', 'false');
  await expect(page.getByTestId('construction-progress')).toHaveAttribute('aria-valuenow', '100');
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
  ).toBeLessThanOrEqual(1);
  await page.evaluate(() =>
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }),
  );
  await expect
    .poll(() =>
      page
        .getByTestId('reading-progress')
        .evaluate((element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).a),
    )
    .toBeGreaterThan(0.99);

  await scrollToBuild(0);
  await expect(scene).toHaveAttribute('data-scene-stage', 'vision');
  await expect(scene).toHaveAttribute('data-built-floors', '0');
  await expect(page.getByTestId('construction-progress')).toHaveAttribute('aria-valuenow', '0');
  expect(errors).toEqual([]);
});

test('language and theme remain coherent across navigation', async ({ page }) => {
  await page.goto('/en');
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('link', { name: 'التبديل إلى العربية' }).click();
  await expect(page).toHaveURL(/\/ar\/?$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'تفعيل الوضع الفاتح' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('property filters query published data and open a real property detail', async ({ page }) => {
  await page.goto('/en/properties?purpose=RENT');
  await expect(page.getByLabel('Looking to', { exact: true })).toHaveValue('RENT');
  await expect(page.locator('.catalog-property-card').first()).toBeVisible();
  const tags = await page.locator('.catalog-card-tag').allTextContents();
  expect(tags.length).toBeGreaterThan(0);
  expect(tags.every((tag) => tag === 'For rent')).toBe(true);
  await page.getByLabel('Looking to', { exact: true }).selectOption('SALE');
  await page.getByRole('button', { name: 'Explore spaces' }).click();
  await expect(page).toHaveURL(/purpose=SALE/);
  await expect(page.locator('.catalog-property-card').first()).toBeVisible();
  const title = await page.locator('.catalog-card-title h3').first().innerText();
  await page.locator('.catalog-card-title').first().click();
  await expect(page.locator('h1')).toHaveText(title);
  await expect(page.locator('.catalog-gallery img').first()).toBeVisible();
  await expect(page.locator('.catalog-gallery img').first()).toHaveJSProperty('complete', true);
  await expect(page.locator('.catalog-lead-form')).toBeVisible();
});

test('a consented property enquiry reaches the actual lead endpoint', async ({ page }) => {
  await page.goto('/en/properties?purpose=SALE');
  await page.locator('.catalog-card-title').first().click();
  const form = page.locator('.catalog-lead-form');
  const email = `browser-test-${Date.now()}@example.test`;
  await form.getByLabel('Full name', { exact: true }).fill('ORIVA Browser Test');
  await form.getByLabel('Email address', { exact: true }).fill(email);
  await form.getByLabel('Phone number', { exact: true }).fill('+971 50 123 4567');
  await form
    .getByLabel('What are you looking for?', { exact: true })
    .fill('Synthetic browser test: please share details of this demonstration property.');
  await form.getByRole('button', { name: 'Start a conversation' }).click();
  await expect(form.locator('input[name="consent"]')).not.toBeChecked();
  await expect(page.locator('.catalog-form-success')).toHaveCount(0);
  await form.locator('input[name="consent"]').check();
  const [response] = await Promise.all([
    page.waitForResponse(
      (result) =>
        result.url().includes('/api/backend/v1/leads') && result.request().method() === 'POST',
    ),
    form.getByRole('button', { name: 'Start a conversation' }).click(),
  ]);
  expect(response.status()).toBe(202);
  const payload = response.request().postDataJSON();
  expect(payload.consent).toBe(true);
  expect(payload.phone).toBe('+971501234567');
  expect(payload.type).toBe('ENQUIRY');
  expect(payload.listingId).toMatch(/^[a-f0-9-]{36}$/);
  expect(Object.keys(await response.json())).toEqual(['message']);
  await expect(page.getByRole('status')).toContainText('You’re on our list.');
  test.info().annotations.push({ type: 'persisted-lead-email', description: email });
});

test('mortgage and rental-yield controls display real API calculations', async ({ page }) => {
  await page.goto('/en/invest');
  const [mortgageResponse] = await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/api/backend/v1/calculators/mortgage'),
    ),
    page.getByRole('button', { name: 'Calculate your estimate' }).click(),
  ]);
  expect(mortgageResponse.status()).toBe(200);
  const mortgage = await mortgageResponse.json();
  expect(mortgage.monthlyPaymentAed).toBe('7917.55');
  await expect(page.locator('.catalog-result-value')).toContainText('7,917.55');
  await page.getByRole('button', { name: 'Rental yield', exact: true }).click();
  const [yieldResponse] = await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/api/backend/v1/calculators/rental-yield'),
    ),
    page.getByRole('button', { name: 'Calculate your estimate' }).click(),
  ]);
  expect(yieldResponse.status()).toBe(200);
  const rentalYield = await yieldResponse.json();
  expect(rentalYield.netYieldPercent).toBe('6.50');
  await expect(page.locator('.catalog-result-value')).toHaveText('6.50%');
});

test('Arabic mobile pages and reduced-motion story remain usable', async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.goto('/ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('[data-scene-stage]')).toHaveAttribute(
      'data-scene-stage',
      'complete',
    );
    await expect(page.locator('#story')).toHaveClass(/cinematic-reduced/);
    await expect(page.locator('[data-landmark="burj-khalifa"]')).toHaveAttribute(
      'data-scene-ready',
      'true',
      { timeout: 30000 },
    );
    await expect(page.getByTestId('page-loader')).toHaveCount(0, { timeout: 20000 });
    await expect(page.getByTestId('construction-progress')).toHaveAttribute('aria-valuenow', '100');
    await expect(page.locator('.story-chapter').first()).toBeVisible();
    await expect
      .poll(() => page.locator('#story').evaluate((element) => element.scrollHeight))
      .toBeLessThan(5000);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth))
      .toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
    await page.goto('/ar/properties');
    await expect(page.locator('.catalog-property-card').first()).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth))
      .toBeLessThanOrEqual(1);
    await page.goto('/ar/contact');
    await expect(page.getByLabel('الاسم الكامل', { exact: true })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth))
      .toBeLessThanOrEqual(1);
  } finally {
    await context.close();
  }
});
