import { expect, test } from '@playwright/test';

test('the 3D story assembles with scroll and the reading bar reaches the end', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveURL(/\/en\/?$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const scene = page.locator('[data-scene-stage]');
  await expect(scene.locator('canvas')).toBeVisible({ timeout: 20000 });
  await expect(scene).not.toHaveAttribute('data-webgl-fallback', 'true');
  await expect(scene).toHaveAttribute('data-scene-stage', 'vision');
  await expect(page.locator('.story-chapter')).toHaveCount(5);
  await page.evaluate(() => {
    const story = document.querySelector('#story')!;
    const top = story.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({
      top: top + (story.scrollHeight - window.innerHeight) * 0.51,
      behavior: 'instant',
    });
  });
  await expect(scene).toHaveAttribute('data-scene-stage', 'structure');
  await page.evaluate(() => {
    const story = document.querySelector('#story')!;
    const top = story.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({
      top: top + (story.scrollHeight - window.innerHeight) * 0.93,
      behavior: 'instant',
    });
  });
  await expect(scene).toHaveAttribute('data-scene-stage', 'investment');
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
  try {
    await page.goto('/ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('[data-scene-stage]')).toHaveAttribute(
      'data-scene-stage',
      'complete',
    );
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth))
      .toBeLessThanOrEqual(1);
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
