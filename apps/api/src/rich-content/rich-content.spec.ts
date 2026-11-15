import { BadRequestException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  collectMediaIds,
  fromPlainText,
  safeLink,
  toPlainText,
  validateDocument,
  type RichDocument,
  type RichNode,
} from '@oriva/rich-content';
import { CreateContentDto } from '../content/content.dto';
import { assertJsonStructure } from '../common/json-structure.policy';
import { prepareRichContent, assertRichMedia } from './rich-content.policy';
const id = '0f000000-0000-4000-8000-000000000001',
  other = '0f000000-0000-4000-8000-000000000002';
const paragraph = (text: string): RichNode => ({
  type: 'paragraph',
  content: [{ type: 'text', text }],
});
const image = (mediaId = id): RichNode => ({
  type: 'image',
  attrs: {
    mediaId,
    alt: 'A considered space',
    caption: 'A useful image caption',
    width: 'wide',
    align: 'center',
  },
});
const doc = (...content: RichNode[]): RichDocument => ({ type: 'doc', content });
const actor = { id: 'agent', email: 'agent@example.test', role: Role.AGENT, sessionId: 'session' };

describe('Whole JSON request bounds', () => {
  it('rejects unknown deeply nested values before DTO transformation', () => {
    let nested: unknown = {};
    for (let depth = 0; depth < 1000; depth++) nested = { unknown: nested };
    expect(() => assertJsonStructure({ extra: nested })).toThrow(BadRequestException);
    expect(() => assertJsonStructure({ extra: Array.from({ length: 100001 }, () => 0) })).toThrow(
      BadRequestException,
    );
  });
  it('leaves enough structural depth for the supported rich nesting', () => {
    let node: RichNode = paragraph('A valid deeply nested block.');
    for (let i = 0; i < 10; i++) node = { type: 'blockquote', content: [node] };
    const document = validateDocument(doc(node));
    expect(() => assertJsonStructure({ bodyRichEn: document })).not.toThrow();
  });
});

describe('Shared rich document contract', () => {
  it('preserves bilingual text, native formatting, lists, tables and library images', () => {
    const source = doc(
      {
        type: 'heading',
        attrs: { level: 2, textAlign: 'right' },
        content: [
          { type: 'text', text: 'فصل جديد', marks: [{ type: 'bold' }, { type: 'italic' }] },
        ],
      },
      paragraph('A new chapter.'),
      {
        type: 'orderedList',
        attrs: { start: 3, type: null },
        content: [{ type: 'listItem', content: [paragraph('First item')] }],
      },
      {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableHeader',
                attrs: { colspan: 2, rowspan: 1, colwidth: [100, 100] },
                content: [paragraph('Facts')],
              },
            ],
          },
          {
            type: 'tableRow',
            content: [
              { type: 'tableCell', content: [paragraph('Area')] },
              { type: 'tableCell', content: [paragraph('120 m²')] },
            ],
          },
        ],
      },
      image(),
    );
    const canonical = validateDocument(source, { minTextLength: 20, maxTextLength: 1000 });
    expect(toPlainText(canonical)).toContain('فصل جديد');
    expect(toPlainText(canonical)).toContain('Area\t120 m²');
    expect(collectMediaIds(canonical)).toEqual([id]);
    expect(validateDocument(canonical)).toEqual(canonical);
  });
  it('represents legacy paragraphs and hard line breaks without interpreting markup', () => {
    const source = 'A literal <tag> stays text.\nSecond line.\n\nAnother paragraph.';
    expect(toPlainText(validateDocument(fromPlainText(source)))).toBe(source);
    expect(validateDocument(fromPlainText(''), { minTextLength: 0 })).toEqual({
      type: 'doc',
      content: [{ type: 'paragraph', attrs: { textAlign: null } }],
    });
  });
  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>bad</script>',
    '//external.example',
    'https:\\evil.example',
    'https://user:password@example.test',
    'https://example.test/%0aevil',
    ' https://example.test',
  ])('rejects dangerous or ambiguous link %s', (href) => expect(safeLink(href)).toBeNull());
  it.each([
    'https://example.test/guide',
    'http://example.test',
    '/en/projects/new-place',
    '#details',
    'mailto:hello@example.test',
    'tel:+971501234567',
  ])('accepts explicit safe link %s', (href) => expect(safeLink(href)).not.toBeNull());
  it('canonicalizes safe links and restricts the highlight palette', () => {
    const canonical = validateDocument(
      doc({
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'Read this guide.',
            marks: [
              {
                type: 'link',
                attrs: { href: '/en/insights', target: '_self', rel: null, class: null },
              },
              { type: 'highlight', attrs: { color: '#d3f9d8' } },
            ],
          },
        ],
      }),
    );
    expect(canonical.content[0]?.content?.[0]?.marks?.[0]?.attrs).toEqual({
      href: '/en/insights',
      target: '_blank',
      rel: 'noopener noreferrer nofollow',
      class: null,
      title: null,
    });
    expect(() =>
      validateDocument(
        doc({
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Unsafe styles',
              marks: [{ type: 'highlight', attrs: { color: 'url(javascript:bad)' } }],
            },
          ],
        }),
      ),
    ).toThrow();
  });
  it('round-trips the current Tiptap link title and marked hard-break shape', () => {
    const document = doc({
      type: 'paragraph',
      attrs: { textAlign: null },
      content: [
        {
          type: 'text',
          text: 'Read the guide',
          marks: [
            {
              type: 'link',
              attrs: {
                href: 'https://example.test',
                target: '_blank',
                rel: 'noopener noreferrer nofollow',
                class: null,
                title: null,
              },
            },
          ],
        },
        { type: 'hardBreak', marks: [{ type: 'bold' }] },
        { type: 'text', text: 'A bold new line', marks: [{ type: 'bold' }] },
      ],
    });
    const canonical = validateDocument(document);
    expect(canonical.content[0]?.content?.[0]?.marks?.[0]?.attrs?.title).toBeNull();
    expect(canonical.content[0]?.content?.[1]?.marks).toEqual([{ type: 'bold' }]);
    const titled = JSON.parse(JSON.stringify(document)) as RichDocument;
    titled.content[0]!.content![0]!.marks![0]!.attrs!.title = 'A useful link title';
    expect(validateDocument(titled).content[0]?.content?.[0]?.marks?.[0]?.attrs?.title).toBe(
      'A useful link title',
    );
  });
  it('rejects executable nodes, remote images, event attributes and invalid nesting', () => {
    for (const source of [
      doc({ type: 'iframe' as never, attrs: { src: 'https://example.test' } }),
      doc({ type: 'image', attrs: { mediaId: id, src: 'https://example.test/photo.jpg' } }),
      doc({
        type: 'paragraph',
        attrs: { onclick: 'bad' },
        content: [{ type: 'text', text: 'Text' }],
      }),
      doc({ type: 'paragraph', content: [image()] }),
      doc({ type: 'text', text: 'Not a block' }),
    ])
      expect(() => validateDocument(source)).toThrow();
  });
  it('rejects incomplete, overlapping, oversized and nested table grids', () => {
    const cell = (colspan = 1, rowspan = 1): RichNode => ({
      type: 'tableCell',
      attrs: { colspan, rowspan, colwidth: null },
      content: [paragraph('Cell')],
    });
    const tables = [
      {
        type: 'table',
        content: [
          { type: 'tableRow', content: [cell(), cell()] },
          { type: 'tableRow', content: [cell()] },
        ],
      },
      {
        type: 'table',
        content: [
          { type: 'tableRow', content: [cell(1, 2), cell()] },
          { type: 'tableRow', content: [cell(2)] },
        ],
      },
      { type: 'table', content: [{ type: 'tableRow', content: [cell(21)] }] },
      {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableCell',
                content: [{ type: 'table', content: [{ type: 'tableRow', content: [cell()] }] }],
              },
            ],
          },
        ],
      },
    ];
    for (const table of tables) expect(() => validateDocument(doc(table as RichNode))).toThrow();
  });
  it('supports valid merged cells and rejects spans past the final row', () => {
    const source = doc({
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            { type: 'tableCell', attrs: { rowspan: 2 }, content: [paragraph('Merged')] },
            { type: 'tableCell', content: [paragraph('First')] },
          ],
        },
        { type: 'tableRow', content: [{ type: 'tableCell', content: [paragraph('Second')] }] },
      ],
    });
    expect(() => validateDocument(source)).not.toThrow();
    const invalid = structuredClone(source);
    invalid.content[0]!.content![0]!.content![0]!.attrs!.rowspan = 3;
    expect(() => validateDocument(invalid)).toThrow();
  });
  it('accepts an empty physical row fully covered by a merged cell, but rejects uncovered empty rows', () => {
    const merged = doc({
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              attrs: { colspan: 2, rowspan: 2, colwidth: null },
              content: [paragraph('A merged two-by-two cell')],
            },
          ],
        },
        { type: 'tableRow', content: [] },
      ],
    });
    expect(validateDocument(merged).content[0]?.content?.[1]?.content).toEqual([]);
    const invalid = structuredClone(merged);
    invalid.content[0]!.content![0]!.content![0]!.attrs!.rowspan = 1;
    expect(() => validateDocument(invalid)).toThrow();
  });
  it('bounds nesting, number of nodes, image count, text and encoded document size', () => {
    let nested: RichNode = paragraph('Nested');
    for (let i = 0; i < 20; i++) nested = { type: 'blockquote', content: [nested] };
    expect(() => validateDocument(doc(nested))).toThrow();
    const manyNodes = doc(...Array.from({ length: 5001 }, () => paragraph('x')));
    expect(() => validateDocument(manyNodes)).toThrow();
    const manyImages = doc(...Array.from({ length: 31 }, () => image()));
    expect(() => validateDocument(manyImages)).toThrow();
    expect(() => validateDocument(doc(paragraph('too short')), { minTextLength: 20 })).toThrow();
    expect(() => validateDocument(doc(paragraph('x'.repeat(100001))))).toThrow();
    const huge = doc(
      ...Array.from({ length: 300 }, () => ({
        type: 'paragraph' as const,
        content: [
          {
            type: 'text' as const,
            text: 'x',
            marks: [
              {
                type: 'link' as const,
                attrs: { href: `https://example.test/${'a'.repeat(1900)}` },
              },
            ],
          },
        ],
      })),
    );
    expect(() => validateDocument(huge)).toThrow();
  });
  it('rejects prototype keys without copying them into canonical records', () => {
    const source = JSON.parse(
      '{"type":"doc","content":[{"type":"paragraph","attrs":{"__proto__":{"polluted":true}}}]}',
    );
    expect(() => validateDocument(source)).toThrow();
    expect({}).not.toHaveProperty('polluted');
  });
});

describe('Rich content persistence boundary', () => {
  const current = {
    bodyEn: 'Existing English article body.',
    bodyAr: 'محتوى المقال العربي الحالي.',
    bodyRichEn: doc(paragraph('Existing English article body.'), image()),
    bodyRichAr: doc(paragraph('محتوى المقال العربي الحالي.'), image(other)),
  };
  it('derives plain text from canonical JSON and ignores forged companion text', () => {
    const source = doc(paragraph('Literal <script> is escaped text, never HTML.'));
    const prepared = prepareRichContent(
      { bodyEn: 'Forged search text', bodyRichEn: source },
      current,
      'body',
      { minTextLength: 10, maxTextLength: 100000 },
    );
    expect(prepared.textEn).toBe('Literal <script> is escaped text, never HTML.');
    expect(prepared.mediaIds).toEqual([other]);
    expect(prepared.existingMediaIds).toEqual([id, other]);
  });
  it('preserves the other locale and clears stale formatting when a legacy client edits text', () => {
    const prepared = prepareRichContent(
      { bodyEn: 'The new plain-text article body.' },
      current,
      'body',
      { minTextLength: 10, maxTextLength: 100000 },
    );
    expect(prepared.data.bodyRichEn).toBe(Prisma.DbNull);
    expect(prepared.data).not.toHaveProperty('bodyRichAr');
    expect(prepared.mediaIds).toEqual([other]);
    const cleared = prepareRichContent({ bodyRichEn: null }, current, 'body', {
      minTextLength: 10,
      maxTextLength: 100000,
    });
    expect(cleared.textEn).toBe(current.bodyEn);
    expect(cleared.mediaIds).toEqual([other]);
  });
  it('does not grant an agent access to newly introduced foreign images', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      media: { count: jest.fn().mockResolvedValue(0) },
    };
    await expect(
      assertRichMedia(tx as unknown as Prisma.TransactionClient, [other], actor, [id]),
    ).rejects.toThrow(BadRequestException);
    expect(tx.media.count).toHaveBeenCalledWith({
      where: { id: { in: [other] }, OR: [{ ownerId: actor.id }, { id: { in: [id] } }] },
    });
    expect(tx.$queryRaw).toHaveBeenCalled();
  });
  it('retains plain-client HTML rejection but allows structured literal markup', async () => {
    const base = {
      slug: 'literal-code',
      type: 'ARTICLE',
      titleEn: 'Literal code',
      titleAr: 'نص برمجي',
      excerptEn: 'Literal code example.',
      excerptAr: 'مثال نص برمجي.',
      bodyEn: '<script>alert(1)</script>',
      bodyAr: 'نص المقال العربي المستخدم في الاختبار.',
    };
    const legacy = await validate(plainToInstance(CreateContentDto, base));
    expect(legacy.some((e) => e.property === 'bodyEn')).toBe(true);
    const rich = await validate(
      plainToInstance(CreateContentDto, { ...base, bodyRichEn: doc(paragraph(base.bodyEn)) }),
    );
    expect(rich.some((e) => e.property === 'bodyEn')).toBe(false);
  });
});
