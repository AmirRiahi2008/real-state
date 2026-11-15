import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { usePublicTeamFixture } from './fixtures/public-team';

const artifacts = resolve(__dirname, '../../..', '.artifacts');

test.beforeEach(async ({ page }) => {
  await usePublicTeamFixture(page);
});

async function loaded(page: Page) {
  await expect(page.getByTestId('page-loader')).toHaveCount(0, { timeout: 20000 });
}

async function captureHero(page: Page, name: string) {
  for (const selector of ['.qa-hero-art', '.qa-hero-copy']) {
    const element = page.locator(selector);
    await element.scrollIntoViewIfNeeded();
    await expect(element).toHaveCSS('opacity', '1');
  }
  await expect(page.locator('.qa-hero-copy h1')).toHaveCSS('opacity', '1');
  await expect(page.locator('.qa-concierge-panel')).toHaveCSS('opacity', '1');
  await page.locator('.qa-hero').screenshot({
    path: resolve(artifacts, `dubai-qa-hero-${name}.png`),
    animations: 'disabled',
  });
}

async function checkDarkHeaderContrast(page: Page, viewport: string) {
  await expect(page.locator('.header-cta')).toHaveCSS('background-color', 'rgb(222, 196, 159)');
  const colors = await page.evaluate(() => {
    const styles = (selector: string) => getComputedStyle(document.querySelector(selector)!);
    return {
      ctaColor: styles('.header-cta').color,
      ctaBackground: styles('.header-cta').backgroundColor,
      navColor: styles('.desktop-nav a').color,
      pageBackground: styles('.public-site').backgroundColor,
    };
  });
  const luminance = (color: string) => {
    const rgb = color
      .match(/[\d.]+/g)!
      .slice(0, 3)
      .map(Number);
    const channels = rgb.map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const contrast = (foreground: string, background: string) => {
    const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    return (values[0] + 0.05) / (values[1] + 0.05);
  };
  expect(contrast(colors.ctaColor, colors.ctaBackground)).toBeGreaterThan(4.5);
  expect(contrast(colors.navColor, colors.pageBackground)).toBeGreaterThan(4.5);
  console.log(`${viewport} steady dark header: ${JSON.stringify(colors)}`);
  await page.locator('.site-header').screenshot({
    path: resolve(artifacts, `dubai-nav-dark-${viewport}.png`),
    animations: 'disabled',
  });
}

async function checkHeader(page: Page) {
  const brand = await page.locator('.site-header .brand').boundingBox();
  const flag = await page.locator('.nav-uae-flag-cloth').boundingBox();
  expect(brand).not.toBeNull();
  expect(flag).not.toBeNull();
  expect(flag!.width).toBeGreaterThan(28);
  expect(flag!.width).toBeLessThan(39);
  expect(flag!.height).toBeGreaterThan(15);
  expect(flag!.height).toBeLessThan(21);
  const gap = Math.max(flag!.x - brand!.x - brand!.width, brand!.x - flag!.x - flag!.width);
  expect(gap).toBeGreaterThan(3);
  expect(gap).toBeLessThan(40);
  expect(Math.abs(flag!.y + flag!.height / 2 - brand!.y - brand!.height / 2)).toBeLessThan(10);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
  ).toBeLessThanOrEqual(1);
  for (const action of await page.locator('.header-actions > a, .header-actions > button').all()) {
    if (!(await action.isVisible())) continue;
    const box = await action.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  }
}

async function navigation(page: Page, mobile: boolean, ar = false) {
  if (mobile) {
    const toggle = page.getByRole('button', {
      name: ar ? 'فتح القائمة' : 'Toggle menu',
      exact: true,
    });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  }
  return page.getByRole('navigation', {
    name: mobile
      ? ar
        ? 'التنقل على الهاتف'
        : 'Mobile navigation'
      : ar
        ? 'التنقل الرئيسي'
        : 'Main navigation',
    exact: true,
  });
}

for (const viewport of [
  { width: 1440, height: 1000, name: 'desktop' },
  { width: 1024, height: 900, name: 'tablet' },
  { width: 390, height: 844, name: 'mobile' },
]) {
  test(`${viewport.name}: navigation, flag, private concierge and locale/theme persistence`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    await mkdir(artifacts, { recursive: true });
    await page.setViewportSize(viewport);
    const mobile = viewport.width <= 1080;
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto('/en/projects');
    await loaded(page);
    await checkHeader(page);
    if (mobile) {
      const toggle = page.getByRole('button', { name: 'Toggle menu', exact: true });
      await toggle.focus();
      await page.keyboard.press('Enter');
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await page.keyboard.press('Tab');
      await expect(
        page.getByRole('navigation', { name: 'Mobile navigation', exact: true }).getByRole('link', {
          name: 'Our story',
          exact: true,
        }),
      ).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await expect(toggle).toBeFocused();
    }
    const nav = await navigation(page, mobile);
    await expect(nav.getByRole('link', { name: 'New developments', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await nav.getByRole('link', { name: 'QA', exact: true }).click();
    await expect(page).toHaveURL(/\/en\/qa$/);
    await expect(page.locator('.qa-concierge-panel')).toBeVisible();
    await expect(page.locator('.qa-concierge-people img')).toHaveCount(3);
    await expect(page.locator('.qa-concierge-privacy')).toHaveText('Private conversations');
    await expect(page.locator('.qa-art-letter')).toHaveCount(0);
    await checkHeader(page);
    await captureHero(page, viewport.name);

    await page.getByRole('button', { name: 'Switch to dark mode', exact: true }).click();
    await checkDarkHeaderContrast(page, viewport.name);
    await page.getByRole('link', { name: 'التبديل إلى العربية', exact: true }).click();
    await expect(page).toHaveURL(/\/ar\/qa$/);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('.qa-concierge-privacy')).toHaveText('محادثات خاصة');
    await checkHeader(page);
    await captureHero(page, `${viewport.name}-ar-dark`);
    const arabicNav = await navigation(page, mobile, true);
    await arabicNav.getByRole('link', { name: 'مشاريع جديدة', exact: true }).click();
    await expect(page).toHaveURL(/\/ar\/projects$/);
    await page.reload();
    await loaded(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('button', { name: 'تفعيل الوضع الفاتح', exact: true }).click();
    await page.getByRole('link', { name: 'Switch to English', exact: true }).click();
    await expect(page).toHaveURL(/\/en\/projects$/);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await checkHeader(page);
    expect(errors).toEqual([]);
  });
}
