import {
  expect,
  test,
  type BrowserContext,
  type Locator,
  type Page,
  type Response,
} from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  initialRecord,
  recordConfigs,
  recordPayload,
} from '../components/admin/admin-records-schema';

interface ManagedRecord {
  id: string;
  slug: string;
  version: number;
  status: string;
  [key: string]: unknown;
}
const provisionFile = process.env.ADMIN_E2E_PROVISION_FILE;
const administrator =
  provisionFile && existsSync(provisionFile)
    ? (JSON.parse(readFileSync(provisionFile, 'utf8')) as { email: string; password: string })
    : null;
const demoImage = [
  resolve(process.cwd(), '../api/demo-assets/property-01.webp'),
  resolve(process.cwd(), 'apps/api/demo-assets/property-01.webp'),
].find(existsSync);
const mutationHeaders = { Origin: 'http://localhost:3000' };

function field(page: Page, label: string) {
  return page.getByLabel(
    new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s*\\*)?$`),
  );
}
function row(page: Page, name: string) {
  return page
    .locator('.admin-records-table tbody tr')
    .filter({ has: page.getByText(name, { exact: true }) });
}
function editor(page: Page, language: 'en' | 'ar') {
  return page.locator(`.rich-editor[data-editor-language="${language}"]`);
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
  await expect(page.locator('.admin-workspace')).toBeVisible();
}
async function navigate(page: Page, name: string, path: string) {
  const [response] = await Promise.all([
    page.waitForResponse(
      (r) => new URL(r.url()).pathname === `/api/admin${path}` && r.request().method() === 'GET',
    ),
    page
      .locator('.admin-sidebar .admin-navigation')
      .getByRole('button', { name, exact: true })
      .click(),
  ]);
  expect(response.ok()).toBe(true);
}
async function mutation(page: Page, path: string, action: () => Promise<unknown>, method = 'POST') {
  const [response] = await Promise.all([
    page.waitForResponse(
      (r) => new URL(r.url()).pathname === `/api/admin${path}` && r.request().method() === method,
    ),
    action(),
  ]);
  expect(response.ok(), `${method} ${path}: ${response.status()}`).toBe(true);
  return (await response.json()) as ManagedRecord;
}
// Select visible text through the browser's native DOM selection, without calling editor commands.
async function selectText(box: Locator, text: string) {
  await box.focus();
  await box.evaluate((element, value) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const offset = (node.textContent || '').indexOf(value);
      if (offset < 0) continue;
      const range = document.createRange();
      range.setStart(node, offset);
      range.setEnd(node, offset + value.length);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
      return;
    }
    throw new Error(`Text to select was not found: ${value}`);
  }, text);
}
async function caretAtStart(box: Locator) {
  // Native keyboard input synchronizes the editor selection before the paste event.
  await box.click();
  await expect(box).toBeFocused();
  await box.press(process.platform === 'darwin' ? 'Meta+ArrowUp' : 'Control+Home');
  await expect
    .poll(() =>
      box.evaluate((element) => {
        const firstText = document.createTreeWalker(element, NodeFilter.SHOW_TEXT).nextNode();
        const selection = window.getSelection();
        return (
          selection?.isCollapsed &&
          selection.anchorNode === firstText &&
          selection.anchorOffset === 0
        );
      }),
    )
    .toBe(true);
}
async function imageDetails(page: Page, alt: string, caption: string) {
  const dialog = page.getByRole('dialog', { name: 'Image & details', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Image description · alt text', { exact: true }).fill(alt);
  await dialog.getByLabel('Caption under the image', { exact: true }).fill(caption);
  await dialog
    .locator('label')
    .filter({ hasText: /^Image size/ })
    .locator('select')
    .selectOption('half');
  await dialog
    .locator('label')
    .filter({ hasText: /^Image alignment/ })
    .locator('select')
    .selectOption('right');
  await expect
    .poll(() =>
      dialog
        .locator('img')
        .evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
    )
    .toBe(true);
  await dialog.getByRole('button', { name: 'Insert image', exact: true }).click();
  await expect(dialog).toHaveCount(0);
}
async function cleanUp(
  context: BrowserContext,
  section: 'content' | 'projects',
  id?: string,
  mediaIds: string[] = [],
) {
  if (id) {
    const result = await context.request.get(`/api/admin/${section}/manage/${id}`);
    if (result.ok()) {
      let current = (await result.json()) as ManagedRecord;
      if (current.status !== 'ARCHIVED') {
        const prefix = section === 'content' ? 'body' : 'description';
        const unlinked = await context.request.patch(`/api/admin/${section}/manage/${id}`, {
          headers: mutationHeaders,
          data: {
            version: current.version,
            [`${prefix}En`]: 'Archived synthetic test content with no linked images.',
            [`${prefix}Ar`]: 'محتوى تجريبي مؤرشف بدون صور مرتبطة لاختبار المحرر.',
            [`${prefix}RichEn`]: null,
            [`${prefix}RichAr`]: null,
          },
        });
        expect(unlinked.ok(), 'Unlink only the synthetic rich images before archiving').toBe(true);
        current = (await unlinked.json()) as ManagedRecord;
        const archived = await context.request.post(`/api/admin/${section}/manage/${id}/archive`, {
          headers: mutationHeaders,
          data: { version: current.version },
        });
        expect(archived.ok(), 'Archive only the synthetic record').toBe(true);
        current = (await archived.json()) as ManagedRecord;
      }
    }
  }
  for (const mediaId of mediaIds) {
    const removed = await context.request.delete(`/api/admin/media/${mediaId}`, {
      headers: mutationHeaders,
    });
    expect(removed.status(), 'Remove the image uploaded by this test').toBe(204);
  }
}

test.describe('rich CMS editor with a private local administrator', () => {
  test.skip(
    !administrator,
    'Set ADMIN_E2E_PROVISION_FILE to a private local administrator fixture.',
  );

  test('NEWS toolbar, table, private image, bilingual JSON and published semantic content work together', async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(240000);
    expect(demoImage).toBeTruthy();
    const context = await browser.newContext({ baseURL });
    const publicContext = await browser.newContext({ baseURL });
    const page = await context.newPage();
    const stamp = Date.now();
    const name = `Synthetic rich news ${stamp}`;
    const slug = `synthetic-rich-news-${stamp}`;
    const mediaIds: string[] = [];
    let articleId: string | undefined;
    try {
      await signIn(page);
      await navigate(page, 'Articles & guides', '/content/manage');
      await page.getByRole('button', { name: 'Add article', exact: true }).click();
      await field(page, 'URL slug').fill(slug);
      await field(page, 'Content type').selectOption('NEWS');
      await field(page, 'English title').fill(name);
      await field(page, 'Arabic title').fill(`خبر تجريبي منسق ${stamp}`);
      await field(page, 'English excerpt').fill(
        'Synthetic local news validating rich bilingual publishing.',
      );
      await field(page, 'Arabic excerpt').fill(
        'خبر محلي تجريبي للتحقق من نشر المحتوى المنسق باللغتين.',
      );
      const en = editor(page, 'en');
      const box = en.getByRole('textbox', { name: 'English article', exact: true });
      await box.fill('Bold sentence, italic phrase, underlined words, and a linked reference.');
      for (const [text, tool] of [
        ['Bold sentence', /^Bold ·/],
        ['italic phrase', /^Italic ·/],
        ['underlined words', /^Underline ·/],
      ] as const) {
        await selectText(box, text);
        await en.getByRole('button', { name: tool }).click();
      }
      await expect(box.locator('strong')).toHaveText('Bold sentence');
      await expect(box.locator('em')).toHaveText('italic phrase');
      await expect(box.locator('u')).toHaveText('underlined words');
      await selectText(box, 'linked reference');
      await en.getByRole('button', { name: 'Add or edit link', exact: true }).click();
      const link = page.getByRole('dialog', { name: 'Add a link', exact: true });
      await link.getByLabel('Link URL', { exact: true }).fill('/en/insights?type=NEWS');
      await link.getByRole('button', { name: 'Apply link', exact: true }).click();
      await expect(link).toHaveCount(0);
      await expect(box.locator('a')).toHaveAttribute('href', '/en/insights?type=NEWS');
      await box.click();
      await expect(box).toBeFocused();
      await box.press(process.platform === 'darwin' ? 'Meta+ArrowDown' : 'Control+End');
      await box.press('ArrowRight');
      await expect(
        en.getByRole('button', { name: 'Add or edit link', exact: true }),
      ).toHaveAttribute('aria-pressed', 'false');
      await box.press('Shift+Enter');
      await page.keyboard.insertText('A second line for the local news story.');
      await expect(box.locator('br')).toHaveCount(1);
      await expect(box.locator('a')).toHaveText('linked reference');
      await box.press('Enter');
      await en.getByRole('button', { name: 'Insert table', exact: true }).click();
      const tableDialog = page.getByRole('dialog', { name: 'Insert a table', exact: true });
      await tableDialog.getByLabel('Rows', { exact: true }).fill('2');
      await tableDialog.getByLabel('Columns', { exact: true }).fill('2');
      await tableDialog.getByRole('button', { name: 'Insert table', exact: true }).click();
      const table = box.locator('table');
      await expect(table.locator('tr')).toHaveCount(2);
      const cells = table.locator('th, td');
      await cells.nth(0).click();
      await page.keyboard.insertText('Metric');
      await box.press('Tab');
      await page.keyboard.insertText('Value');
      await box.press('Tab');
      await page.keyboard.insertText('Homes');
      await box.press('Tab');
      await page.keyboard.insertText('42');
      const first = await cells.nth(2).boundingBox();
      const second = await cells.nth(3).boundingBox();
      expect(first && second).toBeTruthy();
      await page.mouse.move(first!.x + 10, first!.y + first!.height / 2);
      await page.mouse.down();
      await page.mouse.move(second!.x + second!.width - 10, second!.y + second!.height / 2, {
        steps: 12,
      });
      await page.mouse.up();
      const merge = en.getByRole('button', { name: 'Merge selected cells', exact: true });
      await expect(merge).toBeEnabled();
      await merge.click();
      await expect(table.locator('[colspan="2"]')).toHaveCount(1);
      await en.getByRole('button', { name: 'Split merged cell', exact: true }).click();
      await expect(table.locator('th, td')).toHaveCount(4);
      await box.locator(':scope > p').last().click();
      await expect(box).toBeFocused();
      await box.press(process.platform === 'darwin' ? 'Meta+ArrowDown' : 'Control+End');
      await box.press('ArrowDown');
      await expect(
        en.getByRole('button', { name: 'Merge selected cells', exact: true }),
      ).toHaveCount(0);
      const [chooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        en.getByRole('button', { name: 'Upload image', exact: true }).click(),
      ]);
      const [uploaded] = await Promise.all([
        page.waitForResponse(
          (r) =>
            new URL(r.url()).pathname === '/api/admin/media' && r.request().method() === 'POST',
        ),
        chooser.setFiles(demoImage!),
      ]);
      expect(uploaded.status()).toBe(201);
      const mediaId = (await uploaded.json()).id as string;
      mediaIds.push(mediaId);
      expect(
        (await publicContext.request.get(`/api/backend/v1/media/${mediaId}/file`)).status(),
      ).toBe(404);
      await imageDetails(page, 'Synthetic rich news interior', 'A synthetic image caption.');
      await en.getByRole('button', { name: 'Preview', exact: true }).click();
      const preview = en.locator('.rich-editor-preview');
      await expect(preview.locator('figure')).toHaveAttribute('data-width', 'half');
      await expect(preview.locator('figure')).toHaveAttribute('data-align', 'right');
      await expect(preview.locator('figcaption')).toHaveText('A synthetic image caption.');
      await expect
        .poll(() =>
          preview
            .locator('img')
            .evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
        )
        .toBe(true);
      await en.screenshot({ path: '../../.artifacts/rich-news-admin-preview.png' });
      await en.getByRole('button', { name: 'Continue editing', exact: true }).click();
      const arabic = editor(page, 'ar');
      const arBox = arabic.getByRole('textbox', { name: 'Arabic article', exact: true });
      await arBox.fill('خبر عربي تجريبي عن العقارات مع نص عريض ومحتوى واضح للنشر.');
      await selectText(arBox, 'نص عريض');
      await arabic.getByRole('button', { name: /^Bold ·/ }).click();
      await expect(arBox).toHaveAttribute('dir', 'rtl');
      const saved = await mutation(page, '/content/manage', () =>
        page.getByRole('button', { name: 'Save draft', exact: true }).click(),
      );
      articleId = saved.id;
      expect(saved.type).toBe('NEWS');
      expect(saved.coverMediaId).toBeNull();
      expect(saved.bodyRichEn).toMatchObject({ type: 'doc' });
      expect(saved.bodyRichAr).toMatchObject({ type: 'doc' });
      const persisted = JSON.stringify(saved.bodyRichEn);
      await test.info().attach('synthetic-news-document', {
        body: Buffer.from(JSON.stringify(saved.bodyRichEn, null, 2)),
        contentType: 'application/json',
      });
      for (const token of [
        '"bold"',
        '"italic"',
        '"underline"',
        '"link"',
        'linked reference',
        '"hardBreak"',
        '"table"',
        mediaId,
      ])
        expect(persisted).toContain(token);
      expect(persisted).not.toContain('"src"');
      expect(
        (await publicContext.request.get(`/api/backend/v1/media/${mediaId}/file`)).status(),
      ).toBe(404);
      expect(
        (
          await context.request.delete(`/api/admin/media/${mediaId}`, { headers: mutationHeaders })
        ).status(),
      ).toBe(409);
      await mutation(page, `/content/manage/${articleId}/publish`, () =>
        row(page, name).getByRole('button', { name: 'Publish', exact: true }).click(),
      );
      expect(
        (await publicContext.request.get(`/api/backend/v1/media/${mediaId}/file`)).status(),
      ).toBe(200);
      const publicPage = await publicContext.newPage();
      await publicPage.goto(`/en/insights/${slug}`);
      await expect(publicPage.getByTestId('page-loader')).toHaveCount(0, { timeout: 15000 });
      const content = publicPage
        .locator('.rich-content')
        .filter({ has: publicPage.locator('strong', { hasText: 'Bold sentence' }) });
      await expect(content.locator('strong')).toHaveText('Bold sentence');
      await expect(content.locator('em')).toHaveText('italic phrase');
      await expect(content.locator('u')).toHaveText('underlined words');
      const publicLink = content.getByRole('link', { name: 'linked reference', exact: true });
      await expect(publicLink).toBeVisible();
      await expect(publicLink).toHaveAttribute('href', '/en/insights?type=NEWS');
      await expect(content.locator('table')).toHaveCount(1);
      await expect(content.locator('thead th')).toHaveCount(2);
      await expect(content.locator('figure img')).toHaveAttribute(
        'alt',
        'Synthetic rich news interior',
      );
      await expect(content.locator('figcaption')).toHaveText('A synthetic image caption.');
      await expect
        .poll(() =>
          content
            .locator('figure img')
            .evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
        )
        .toBe(true);
      await content.scrollIntoViewIfNeeded();
      await content.screenshot({ path: '../../.artifacts/rich-news-public-en-content.png' });
      await publicPage.screenshot({
        path: '../../.artifacts/rich-news-public-en.png',
        fullPage: true,
      });
      await publicPage.goto(`/ar/insights/${slug}`);
      await expect(publicPage.getByTestId('page-loader')).toHaveCount(0, { timeout: 15000 });
      await expect(publicPage.locator('.rich-content[dir="rtl"] strong')).toHaveText('نص عريض');
      await publicPage.locator('.rich-content[dir="rtl"]').scrollIntoViewIfNeeded();
      await publicPage.screenshot({
        path: '../../.artifacts/rich-news-public-ar.png',
        fullPage: true,
      });
      await publicPage.goto('/en/insights?type=NEWS');
      await expect(publicPage.getByRole('link', { name, exact: false })).toBeVisible();
      const news = await publicContext.request.get('/api/backend/v1/content?type=NEWS&limit=50');
      expect(news.ok()).toBe(true);
      const newsData = await news.json();
      expect(newsData.data.some((item: ManagedRecord) => item.id === articleId)).toBe(true);
      expect(newsData.data.every((item: ManagedRecord) => item.type === 'NEWS')).toBe(true);
    } finally {
      await cleanUp(context, 'content', articleId, mediaIds);
      await context.close();
      await publicContext.close();
    }
  });

  test('legacy project text survives formatting and a pasted image follows the current mapped caret', async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(180000);
    expect(demoImage).toBeTruthy();
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    const stamp = Date.now();
    const name = `Synthetic legacy rich project ${stamp}`;
    const original =
      'Legacy project description remains readable. Preserve this linked phrase and the final sentence.';
    let projectId: string | undefined;
    const mediaIds: string[] = [];
    let releaseUpload: (() => void) | undefined;
    let pendingUpload: Promise<Response> | undefined;
    try {
      await signIn(page);
      const projects = await context.request.get('/api/admin/projects/manage?limit=50');
      expect(projects.ok()).toBe(true);
      const seedId = (await projects.json()).data.find(
        (item: ManagedRecord) => item.status === 'PUBLISHED',
      )?.id as string;
      expect(seedId).toBeTruthy();
      const seedResponse = await context.request.get(`/api/admin/projects/manage/${seedId}`);
      const seed = await seedResponse.json();
      const payload = recordPayload('projects', initialRecord(recordConfigs.projects, seed), false);
      Object.assign(payload, {
        slug: `synthetic-legacy-rich-${stamp}`,
        nameEn: name,
        nameAr: `مشروع تجريبي قديم ${stamp}`,
        descriptionEn: original,
        descriptionAr: 'وصف عربي قديم محفوظ بالكامل في المحرر ولا يفقد النص عند التنسيق.',
        descriptionRichEn: null,
        descriptionRichAr: null,
        media: [],
      });
      const created = await context.request.post('/api/admin/projects/manage', {
        headers: mutationHeaders,
        data: payload,
      });
      expect(created.status()).toBe(201);
      projectId = (await created.json()).id as string;
      await navigate(page, 'Developments', '/projects/manage');
      await row(page, name).getByRole('button', { name: 'Edit', exact: true }).click();
      const en = editor(page, 'en');
      const box = en.getByRole('textbox', { name: 'English description', exact: true });
      await expect(box).toHaveText(original);
      await selectText(box, 'Legacy project');
      await en.getByRole('button', { name: /^Bold ·/ }).click();
      await selectText(box, 'linked phrase');
      await en.getByRole('button', { name: 'Add or edit link', exact: true }).click();
      const link = page.getByRole('dialog', { name: 'Add a link', exact: true });
      await link.getByLabel('Link URL', { exact: true }).fill('/en/projects');
      await link.getByRole('button', { name: 'Apply link', exact: true }).click();
      await expect(link).toHaveCount(0);
      await caretAtStart(box);
      await expect(
        en.getByRole('button', { name: 'Add or edit link', exact: true }),
      ).toHaveAttribute('aria-pressed', 'false');
      const gate = new Promise<void>((resolveGate) => {
        releaseUpload = resolveGate;
      });
      await page.route(
        '**/api/admin/media',
        async (route) => {
          await gate;
          await route.continue();
        },
        { times: 1 },
      );
      pendingUpload = page.waitForResponse(
        (r) => new URL(r.url()).pathname === '/api/admin/media' && r.request().method() === 'POST',
      );
      const imageBase64 = readFileSync(demoImage!).toString('base64');
      await box.evaluate((element, base64) => {
        const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
        const transfer = new DataTransfer();
        transfer.items.add(new File([bytes], 'synthetic-pasted.webp', { type: 'image/webp' }));
        element.dispatchEvent(
          new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true }),
        );
      }, imageBase64);
      await expect(en.getByText('Uploading image…', { exact: true })).toBeVisible();
      // A real edit during the request must map the saved insertion bookmark forward.
      await box.pressSequentially('New introduction. ');
      await page.getByRole('button', { name: 'Save draft', exact: true }).click();
      await expect(en.getByRole('alert')).toHaveText('Wait for the image upload to finish.');
      await expect(box).toContainText('New introduction. Legacy project');
      releaseUpload?.();
      const uploaded = await pendingUpload;
      expect(uploaded.status()).toBe(201);
      const mediaId = (await uploaded.json()).id as string;
      mediaIds.push(mediaId);
      await imageDetails(page, 'Synthetic pasted project image', 'Pasted at the current caret.');
      await expect(box).toContainText(original);
      await expect(box.locator('a')).toHaveText('linked phrase');
      await expect(box.locator('strong').filter({ hasText: /^Legacy project$/ })).toHaveCount(1);
      const saved = await mutation(
        page,
        `/projects/manage/${projectId}`,
        () => page.getByRole('button', { name: 'Save draft', exact: true }).click(),
        'PATCH',
      );
      expect(saved.descriptionEn).toContain(original);
      expect(saved.descriptionEn).toContain('New introduction.');
      const document = saved.descriptionRichEn as {
        content: { type: string; content?: { text?: string }[]; attrs?: { mediaId?: string } }[];
      };
      const imageIndex = document.content.findIndex(
        (node) => node.type === 'image' && node.attrs?.mediaId === mediaId,
      );
      expect(imageIndex).toBeGreaterThanOrEqual(0);
      expect(
        document.content
          .slice(0, imageIndex)
          .map((node) => node.content?.map((child) => child.text || '').join('') || '')
          .join(''),
      ).toBe('New introduction. ');
      await row(page, name).getByRole('button', { name: 'Edit', exact: true }).click();
      await expect(
        editor(page, 'en').getByRole('textbox', { name: 'English description', exact: true }),
      ).toContainText(original);
      await editor(page, 'en').screenshot({ path: '../../.artifacts/rich-legacy-project.png' });
    } finally {
      releaseUpload?.();
      if (pendingUpload) {
        const uploaded = await pendingUpload.catch(() => null);
        if (uploaded?.ok()) {
          const mediaId = (await uploaded.json()).id as string;
          if (!mediaIds.includes(mediaId)) mediaIds.push(mediaId);
        }
      }
      await cleanUp(context, 'projects', projectId, mediaIds);
      await context.close();
    }
  });
});
