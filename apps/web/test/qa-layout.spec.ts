import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { TeamMember, TeamPage } from '../lib/team-types';
import { usePublicTeamFixture } from './fixtures/public-team';

const artifacts = resolve(__dirname, '../../..', '.artifacts');

async function openDirectory(page: Page, locale: 'en' | 'ar' = 'en') {
  const response = page.waitForResponse(
    (result) => new URL(result.url()).pathname === '/api/team/members',
  );
  await page.goto(`/${locale}/qa`);
  await expect(page.getByTestId('page-loader')).toHaveCount(0, { timeout: 20000 });
  const membersResponse = await response;
  expect(membersResponse.status()).toBe(200);
  const { data: members } = (await membersResponse.json()) as TeamPage<TeamMember>;
  expect(members).toHaveLength(3);
  await expect(page.locator('.qa-member-card')).toHaveCount(3);
  for (const member of members) {
    const card = memberCard(page, member);
    await expect(
      card.getByRole('heading', { name: member.displayName, exact: true }),
    ).toBeVisible();
    await expect(card.locator('img')).toHaveCount(1);
    await expect
      .poll(() =>
        card
          .locator('img')
          .evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
      )
      .toBe(true);
    await expect(card.locator('.qa-member-role')).toHaveText(
      locale === 'ar' ? member.titleAr || member.titleEn : member.titleEn,
    );
  }
  return members;
}

function memberCard(page: Page, member: TeamMember) {
  return page
    .locator('.qa-member-card')
    .filter({ has: page.getByRole('heading', { name: member.displayName, exact: true }) });
}

async function revealCards(page: Page) {
  for (const node of await page
    .locator('.qa-featured-node, .qa-supporting-node, .qa-conversation-note-inner')
    .all()) {
    await node.scrollIntoViewIfNeeded();
    await expect
      .poll(() => node.evaluate((element) => getComputedStyle(element).opacity))
      .toBe('1');
  }
  await page.mouse.move(0, 0);
}

async function bounds(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

async function noHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
  ).toBeLessThanOrEqual(1);
  for (const card of await page.locator('.qa-member-card').all()) {
    const box = await bounds(card);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  }
}

test.describe('QA hierarchy and private conversation entry', () => {
  test.setTimeout(90000);

  test.beforeAll(async () => {
    await mkdir(artifacts, { recursive: true });
  });

  test.beforeEach(async ({ page }) => {
    await usePublicTeamFixture(page);
  });

  test('public profiles form a centered, staggered desktop hierarchy and open the chosen private dialog by keyboard', async ({
    page,
  }) => {
    const errors: string[] = [];
    const writes: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/team/') && request.method() !== 'GET') {
        writes.push(`${request.method()} ${new URL(request.url()).pathname}`);
      }
    });
    const members = await openDirectory(page);
    const melika = members.find((member) => /^melika(?:-|$)/i.test(member.slug));
    const amir = members.find((member) => member.slug === 'amir-riahi');
    const mehdi = members.find((member) => member.slug === 'mehdi-ahmadi');
    expect(melika).toBeDefined();
    expect(amir).toBeDefined();
    expect(mehdi).toBeDefined();
    await expect(page.locator('.qa-member-card').first()).toHaveClass(/qa-member-featured/);
    await expect(page.locator('.qa-featured-node h3')).toHaveText(melika!.displayName);
    await revealCards(page);
    const featured = await bounds(memberCard(page, melika!));
    const [left, right] = (
      await Promise.all([bounds(memberCard(page, amir!)), bounds(memberCard(page, mehdi!))])
    ).sort((first, second) => first.x - second.x);
    expect(Math.abs(featured.x + featured.width / 2 - page.viewportSize()!.width / 2)).toBeLessThan(
      3,
    );
    expect(Math.min(left.y, right.y)).toBeGreaterThan(featured.y + featured.height + 70);
    expect(Math.abs(left.y - right.y)).toBeGreaterThan(90);
    expect(left.x + left.width / 2).toBeLessThan(featured.x + featured.width / 2);
    expect(right.x + right.width / 2).toBeGreaterThan(featured.x + featured.width / 2);
    await expect(page.locator('.qa-connection-draw')).toHaveCount(2);
    await noHorizontalOverflow(page);

    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({ path: resolve(artifacts, 'qa-hierarchy-desktop.png'), fullPage: true });
    await page
      .locator('.qa-featured-node')
      .screenshot({ path: resolve(artifacts, 'qa-hierarchy-melika.png') });

    const firstMessage = page.getByRole('button', {
      name: `Message ${melika!.displayName}`,
      exact: true,
    });
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });
    for (
      let step = 0;
      step < 40 && !(await firstMessage.evaluate((button) => button === document.activeElement));
      step++
    ) {
      await page.keyboard.press('Tab');
    }
    await expect(firstMessage).toBeFocused();
    for (const member of [melika!, amir!, mehdi!]) {
      const message = page.getByRole('button', {
        name: `Message ${member.displayName}`,
        exact: true,
      });
      await message.focus();
      await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog', {
        name: `Conversation with ${member.displayName}`,
        exact: true,
      });
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByRole('heading', { name: member.displayName, exact: true }),
      ).toBeVisible();
      await expect(dialog.getByLabel('Your message', { exact: true })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
    }
    expect(writes).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('390px mobile stacks every portrait without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openDirectory(page);
    await revealCards(page);
    const cards = await page.locator('.qa-member-card').all();
    const boxes = await Promise.all(cards.map(bounds));
    for (let index = 1; index < boxes.length; index++) {
      expect(boxes[index].y).toBeGreaterThan(boxes[index - 1].y + boxes[index - 1].height + 25);
      expect(Math.abs(boxes[index].x + boxes[index].width / 2 - 195)).toBeLessThan(2);
    }
    await noHorizontalOverflow(page);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({ path: resolve(artifacts, 'qa-hierarchy-mobile.png'), fullPage: true });
  });

  test('Arabic dark mode mirrors the hierarchy and honors reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
    await page.addInitScript(() => localStorage.setItem('oriva-theme', 'dark'));
    await openDirectory(page, 'ar');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await revealCards(page);
    const featured = await bounds(page.locator('.qa-member-featured'));
    const supporting = await page.locator('.qa-supporting-node').all();
    const first = await bounds(supporting[0]);
    const second = await bounds(supporting[1]);
    expect(Math.abs(featured.x + featured.width / 2 - page.viewportSize()!.width / 2)).toBeLessThan(
      3,
    );
    expect(first.x).toBeGreaterThan(second.x);
    expect(second.y - first.y).toBeGreaterThan(90);
    await expect(page.locator('.qa-concierge-panel')).toHaveCSS('animation-name', 'none');
    for (const card of await page.locator('.qa-member-card').all()) {
      await card.hover();
      await expect(card).toHaveCSS('transform', 'none');
    }
    await noHorizontalOverflow(page);
    await page.mouse.move(0, 0);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.screenshot({
      path: resolve(artifacts, 'qa-hierarchy-ar-dark-reduced.png'),
      fullPage: true,
    });
  });
});
