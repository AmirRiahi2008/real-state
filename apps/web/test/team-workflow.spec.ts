import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import type { OwnTeamProfile, TeamConversation, TeamSession } from '../lib/team-types';

type LocalMember = {
  email: string;
  password: string;
  slug: string;
  displayName: string;
  photoPath: string;
};
const privateFile = process.env.TEAM_E2E_PROVISION_FILE;
const fixture: LocalMember[] =
  privateFile && existsSync(privateFile)
    ? JSON.parse(readFileSync(privateFile, 'utf8')).members
    : [];
const mutationHeaders = { Origin: 'http://localhost:3000' };

async function pageFor(context: BrowserContext) {
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.setDefaultNavigationTimeout(30000);
  return page;
}
async function loaded(page: Page) {
  await expect(page.getByTestId('page-loader')).toHaveCount(0, { timeout: 15000 });
}
async function signIn(page: Page, member: LocalMember, password = member.password) {
  await page.goto('/en/dashboard/login');
  await loaded(page);
  await page.getByLabel('Email address', { exact: true }).fill(member.email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  const [response] = await Promise.all([
    page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === '/api/team/auth/login' && r.request().method() === 'POST',
    ),
    page.getByRole('button', { name: 'Sign in', exact: true }).click(),
  ]);
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body).not.toHaveProperty('accessToken');
  expect(body).not.toHaveProperty('refreshToken');
  await expect(page).toHaveURL(/\/en\/dashboard\/?$/);
  await expect(page.locator('.team-workspace-identity h2')).toHaveText(member.displayName);
  return body as TeamSession;
}
async function logout(context: BrowserContext) {
  await context.request
    .post('/api/team/auth/logout', { headers: mutationHeaders })
    .catch(() => undefined);
}
function profileInput(profile: OwnTeamProfile) {
  return {
    displayName: profile.displayName,
    titleEn: profile.titleEn,
    titleAr: profile.titleAr,
    bioEn: profile.bioEn,
    bioAr: profile.bioAr,
    avatarMediaId: profile.avatarMediaId ?? null,
  };
}

// Personal local accounts are never bundled into source or provisioned on CI.
test.describe('locally provisioned private team workspace', () => {
  test.skip(
    fixture.length !== 3,
    'Set TEAM_E2E_PROVISION_FILE to the private local provisioning file.',
  );
  test('QA messages reach only the chosen member and profile edits update the public directory', async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(150000);
    const options = { baseURL };
    const visitor = await browser.newContext(options),
      staff = await browser.newContext(options),
      other = await browser.newContext(options),
      stranger = await browser.newContext(options),
      melikaContext = await browser.newContext(options);
    const contexts = [visitor, staff, other, stranger, melikaContext];
    const amir = fixture.find((m) => m.slug === 'amir-riahi')!,
      mehdi = fixture.find((m) => m.slug === 'mehdi-ahmadi')!,
      melika = fixture.find((m) => m.slug === 'melika')!;
    const visitorName = `Synthetic QA visitor ${Date.now()}`;
    const question = `Synthetic local browser check ${Date.now()}: <b>this is plain text</b>.`;
    const answer = `Synthetic personal reply ${Date.now()}`;
    const followup = `Synthetic visitor follow-up ${Date.now()}`;
    const errors: string[] = [];
    let original: OwnTeamProfile | null = null;
    try {
      const guest = await pageFor(visitor);
      guest.on('pageerror', (e) => errors.push(e.message));
      await guest.goto('/en/qa');
      await loaded(guest);
      await expect(guest.locator('.team-person-card')).toHaveCount(3);
      for (const member of fixture) {
        const card = guest
          .locator('.team-person-card')
          .filter({ has: guest.getByRole('heading', { name: member.displayName, exact: true }) });
        await expect(card.locator('img')).toBeVisible();
        await expect(card.locator('img')).toHaveJSProperty('complete', true);
        expect(
          await card.locator('img').evaluate((image: HTMLImageElement) => image.naturalWidth),
        ).toBeGreaterThan(0);
      }
      await guest.getByRole('button', { name: `Message ${amir.displayName}`, exact: true }).click();
      const dialog = guest.getByRole('dialog', { name: `Conversation with ${amir.displayName}` });
      await expect(dialog).toBeVisible();
      await dialog.getByLabel('Your name', { exact: true }).fill(visitorName);
      await dialog
        .getByLabel('Email address', { exact: true })
        .fill(`synthetic-${Date.now()}@example.test`);
      await dialog.getByLabel('Your message', { exact: true }).fill(question);
      await dialog.getByRole('checkbox').check();
      const [created] = await Promise.all([
        guest.waitForResponse(
          (r) =>
            new URL(r.url()).pathname === '/api/team/conversations' &&
            r.request().method() === 'POST',
        ),
        dialog.getByRole('button', { name: 'Send your message', exact: true }).click(),
      ]);
      expect(created.status()).toBe(201);
      const thread = (await created.json()) as TeamConversation;
      expect(thread).not.toHaveProperty('accessToken');
      expect(thread).not.toHaveProperty('visitorTokenHash');
      await expect(dialog.locator('.team-message-list')).toContainText(question);
      expect(await dialog.locator('.team-message-body b').count()).toBe(0);
      const guestCookie = (await visitor.cookies()).find((c) =>
        c.name.endsWith(`guest_${thread.id}`),
      );
      expect(guestCookie?.httpOnly).toBe(true);
      expect(guestCookie?.path).toBe(`/api/team/conversations/${thread.id}`);
      expect(guestCookie?.sameSite).toBe('Strict');
      const strangerRead = await stranger.request.get(`/api/team/conversations/${thread.id}`);
      expect(strangerRead.status()).toBe(404);
      const staffPage = await pageFor(staff);
      staffPage.on('pageerror', (e) => errors.push(e.message));
      const session = await signIn(staffPage, amir);
      original = session.profile;
      expect(session.user.role).toBe('TEAM_MEMBER');
      const authCookies = (await staff.cookies()).filter((c) =>
        ['oriva_access', 'oriva_refresh', 'oriva_csrf'].some((name) => c.name.endsWith(name)),
      );
      expect(authCookies.length).toBe(3);
      expect(authCookies.every((c) => c.httpOnly)).toBe(true);
      const inboxRow = staffPage.locator('.team-inbox-row').filter({ hasText: visitorName });
      await expect(inboxRow).toBeVisible();
      await inboxRow.click();
      await expect(staffPage.locator('.team-message-list')).toContainText(question);
      await staffPage.getByLabel('Your reply', { exact: true }).fill(answer);
      const [replied] = await Promise.all([
        staffPage.waitForResponse(
          (r) =>
            new URL(r.url()).pathname === `/api/team/inbox/${thread.id}/replies` &&
            r.request().method() === 'POST',
        ),
        staffPage.getByRole('button', { name: 'Send reply', exact: true }).click(),
      ]);
      expect(replied.status()).toBe(201);
      await guest.bringToFront();
      await expect(dialog.locator('.team-message-list')).toContainText(answer, { timeout: 20000 });
      await dialog.getByLabel('Write your reply', { exact: true }).fill(followup);
      await dialog.getByRole('button', { name: 'Send', exact: true }).click();
      await expect(dialog.locator('.team-message-list')).toContainText(followup);
      await staffPage.bringToFront();
      await expect(staffPage.locator('.team-message-list')).toContainText(followup, {
        timeout: 20000,
      });
      const otherPage = await pageFor(other);
      const otherSession = await signIn(otherPage, mehdi);
      expect((await other.request.get(`/api/team/inbox/${thread.id}`)).status()).toBe(404);
      expect(
        (
          await other.request.post(`/api/team/inbox/${thread.id}/replies`, {
            headers: mutationHeaders,
            data: { body: 'Must not reach this conversation' },
          })
        ).status(),
      ).toBe(404);
      const melikaPage = await pageFor(melikaContext);
      await signIn(melikaPage, melika);
      expect((await melikaContext.request.get(`/api/team/inbox/${thread.id}`)).status()).toBe(404);
      expect(
        (
          await staff.request.patch('/api/team/me', {
            headers: mutationHeaders,
            data: { role: 'ADMIN' },
          })
        ).status(),
      ).toBe(400);
      expect(
        (
          await staff.request.post('/api/team/listings/manage', {
            headers: mutationHeaders,
            data: {},
          })
        ).status(),
      ).toBe(404);
      expect(
        (
          await staff.request.patch('/api/team/me', {
            headers: mutationHeaders,
            data: { avatarMediaId: otherSession.profile.avatarMediaId },
          })
        ).status(),
      ).toBe(404);
      const invalidOrigin = await staff.request.patch('/api/team/me', {
        headers: { Origin: 'https://untrusted.example' },
        data: { titleEn: 'Must not be saved' },
      });
      expect(invalidOrigin.status()).toBe(403);
      await staffPage.bringToFront();
      await staffPage.getByRole('button', { name: 'My profile', exact: true }).click();
      const newTitle = `Developer · QA ${Date.now()}`,
        newBio = `${original.bioEn}\nSynthetic local profile update check.`;
      await staffPage.getByLabel('Title in English', { exact: true }).fill(newTitle);
      await staffPage.getByLabel('Introduction in English', { exact: true }).fill(newBio);
      await staffPage.getByRole('button', { name: 'Save changes', exact: true }).click();
      await expect(staffPage.locator('.team-save-status')).toContainText('Updated.');
      const directory = await pageFor(stranger);
      await directory.goto('/en/qa');
      await loaded(directory);
      let publicCard = directory
        .locator('.team-person-card')
        .filter({ has: directory.getByRole('heading', { name: amir.displayName, exact: true }) });
      await expect(publicCard).toContainText(newTitle);
      await expect(publicCard).toContainText('Synthetic local profile update check.');
      await staffPage.getByLabel('Profile photo', { exact: true }).setInputFiles(amir.photoPath);
      const [photoUpdated] = await Promise.all([
        staffPage.waitForResponse(
          (r) =>
            new URL(r.url()).pathname === '/api/team/me/photo' && r.request().method() === 'POST',
        ),
        staffPage.getByRole('button', { name: 'Update photo', exact: true }).click(),
      ]);
      expect(photoUpdated.status()).toBe(201);
      const updatedProfile = (await photoUpdated.json()) as OwnTeamProfile;
      expect(updatedProfile.avatarMediaId).not.toBe(original.avatarMediaId);
      await directory.reload();
      await loaded(directory);
      publicCard = directory
        .locator('.team-person-card')
        .filter({ has: directory.getByRole('heading', { name: amir.displayName, exact: true }) });
      await expect(publicCard.locator('img')).toHaveAttribute(
        'src',
        new RegExp(updatedProfile.avatarMediaId!),
      );
      await expect(publicCard.locator('img')).toHaveJSProperty('complete', true);
      const roleCheck = await staff.request.get('/api/team/session');
      expect((await roleCheck.json()).user.role).toBe('TEAM_MEMBER');
      expect(errors).toEqual([]);
    } finally {
      try {
        if (original) {
          let restored = await staff.request.patch('/api/team/me', {
            headers: mutationHeaders,
            data: profileInput(original),
          });
          if (restored.status() === 401) {
            await staff.request.post('/api/team/auth/login', {
              headers: mutationHeaders,
              data: { email: amir.email, password: amir.password },
            });
            restored = await staff.request.patch('/api/team/me', {
              headers: mutationHeaders,
              data: profileInput(original),
            });
          }
          expect(restored.status(), 'Restore the original local profile after verification').toBe(
            200,
          );
        }
      } finally {
        for (const context of contexts) {
          await logout(context);
          await context.close();
        }
      }
    }
  });

  test('a member can change their password, sign in again, and retain only their own workspace', async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(90000);
    const context = await browser.newContext({ baseURL });
    const member = fixture.find((m) => m.slug === 'melika')!;
    const temporary = `Temporary-${randomBytes(24).toString('base64url')}`;
    let changed = false;
    try {
      const page = await pageFor(context);
      await signIn(page, member);
      await page.getByRole('button', { name: 'Password', exact: true }).click();
      await page.getByLabel('Current password', { exact: true }).fill(member.password);
      await page.getByLabel('New password', { exact: true }).fill(temporary);
      await page.getByLabel('Confirm new password', { exact: true }).fill(temporary);
      const [change] = await Promise.all([
        page.waitForResponse(
          (r) =>
            new URL(r.url()).pathname === '/api/team/auth/change-password' &&
            r.request().method() === 'POST',
        ),
        page.getByRole('button', { name: 'Update password', exact: true }).click(),
      ]);
      expect(change.status()).toBe(204);
      changed = true;
      await expect(page).toHaveURL(/\/dashboard\/login\?password=changed/);
      expect((await context.request.get('/api/team/session')).status()).toBe(401);
      await signIn(page, member, temporary);
      const session = await context.request.get('/api/team/session');
      expect((await session.json()).profile.slug).toBe(member.slug);
      const restored = await context.request.post('/api/team/auth/change-password', {
        headers: mutationHeaders,
        data: { currentPassword: temporary, newPassword: member.password },
      });
      expect(restored.status()).toBe(204);
      changed = false;
      await signIn(page, member);
      expect((await context.request.get('/api/team/session')).status()).toBe(200);
    } finally {
      try {
        if (changed) {
          await context.request.post('/api/team/auth/login', {
            headers: mutationHeaders,
            data: { email: member.email, password: temporary },
          });
          const restore = await context.request.post('/api/team/auth/change-password', {
            headers: mutationHeaders,
            data: { currentPassword: temporary, newPassword: member.password },
          });
          expect(restore.status(), 'Restore the requested local password after verification').toBe(
            204,
          );
        }
      } finally {
        await logout(context);
        await context.close();
      }
    }
  });
});
