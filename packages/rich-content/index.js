'use strict';

const RICH_CONTENT_LIMITS = Object.freeze({
  maxDepth: 12,
  maxNodes: 5000,
  maxBytes: 524288,
  maxImages: 30,
  maxTableRows: 20,
  maxTableColumns: 20,
});
const HIGHLIGHT_COLORS = Object.freeze(['#fff3bf', '#d3f9d8', '#dbe4ff', '#ffe3e3']);
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;
const BLOCKS = new Set([
  'paragraph',
  'heading',
  'blockquote',
  'bulletList',
  'orderedList',
  'codeBlock',
  'horizontalRule',
  'table',
  'image',
]);
const INLINE = new Set(['text', 'hardBreak']);
const ALIGN = ['left', 'right', 'center', 'justify'];
class RichContentError extends Error {
  constructor(message = 'Rich content is invalid') {
    super(message);
    this.name = 'RichContentError';
    this.code = 'INVALID_RICH_CONTENT';
  }
}
function fail(message) {
  throw new RichContentError(message);
}
function record(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  );
}
function keys(value, allowed, label) {
  if (!record(value) || Object.keys(value).some((key) => !allowed.includes(key)))
    fail(`Unsupported ${label}`);
}
function safeLink(input) {
  if (
    typeof input !== 'string' ||
    !input.length ||
    input.length > 2000 ||
    /[\u0000-\u0020\u007f\\]/u.test(input) ||
    /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i.test(input)
  )
    return null;
  if (input.startsWith('/') && !input.startsWith('//')) return input;
  if (/^#[\p{L}\p{N}_-]+$/u.test(input)) return input;
  try {
    const url = new URL(input);
    if (
      ['https:', 'http:'].includes(url.protocol) &&
      url.hostname &&
      !url.username &&
      !url.password
    )
      return url.href;
    if (
      url.protocol === 'mailto:' &&
      /^[^@\s?]+@[^@\s?]+\.[^@\s?]+(?:\?[^\s]*)?$/u.test(input.slice(7))
    )
      return input;
    if (/^tel:\+?[0-9().-]{3,30}$/u.test(input)) return input;
  } catch {
    /* Invalid URLs are represented as plain text by the editor. */
  }
  return null;
}
function validateDocument(input, options = {}) {
  const maxTextLength = options.maxTextLength ?? 100000,
    minTextLength = options.minTextLength ?? 0;
  if (
    !Number.isInteger(maxTextLength) ||
    maxTextLength < 0 ||
    maxTextLength > 100000 ||
    !Number.isInteger(minTextLength) ||
    minTextLength < 0 ||
    minTextLength > maxTextLength
  )
    fail('Invalid rich content length limits');
  const budget = { nodes: 0, bytes: 0, images: 0 };
  function charge(value) {
    budget.bytes += new TextEncoder().encode(value).byteLength;
    if (budget.bytes > RICH_CONTENT_LIMITS.maxBytes) fail('Rich content is too large');
    return value;
  }
  function text(value, max, label) {
    if (typeof value !== 'string' || value.length > max || CONTROL.test(value))
      fail(`Invalid ${label}`);
    return charge(value);
  }
  function attrs(node, allowed) {
    if (node.attrs === undefined) return {};
    keys(node.attrs, allowed, 'rich content attributes');
    return node.attrs;
  }
  function integer(value, min, max, label) {
    if (!Number.isInteger(value) || value < min || value > max) fail(`Invalid ${label}`);
    return value;
  }
  function align(value, allowed = ALIGN) {
    if (value === undefined || value === null) return null;
    if (!allowed.includes(value)) fail('Invalid text alignment');
    return value;
  }
  function mark(source) {
    if (++budget.nodes > RICH_CONTENT_LIMITS.maxNodes) fail('Rich content contains too many nodes');
    keys(source, ['type', 'attrs'], 'formatting mark');
    if (['bold', 'italic', 'underline', 'strike', 'code'].includes(source.type)) {
      attrs(source, []);
      return { type: source.type };
    }
    if (source.type === 'link') {
      const a = attrs(source, ['href', 'target', 'rel', 'class', 'title']);
      const href = safeLink(a.href);
      if (!href) fail('A link uses an unsupported URL');
      charge(href);
      if (a.class !== undefined && a.class !== null) fail('Link classes are not supported');
      if (a.target !== undefined && a.target !== null && !['_blank', '_self'].includes(a.target))
        fail('Invalid link target');
      if (
        a.rel !== undefined &&
        a.rel !== null &&
        (typeof a.rel !== 'string' ||
          a.rel.length > 100 ||
          a.rel
            .split(/\s+/u)
            .some((token) => !['noopener', 'noreferrer', 'nofollow', ''].includes(token)))
      )
        fail('Invalid link relationship');
      return {
        type: 'link',
        attrs: {
          href,
          target: '_blank',
          rel: 'noopener noreferrer nofollow',
          class: null,
          title:
            a.title === undefined || a.title === null ? null : text(a.title, 200, 'link title'),
        },
      };
    }
    if (source.type === 'highlight') {
      const a = attrs(source, ['color']);
      if (a.color !== undefined && a.color !== null && !HIGHLIGHT_COLORS.includes(a.color))
        fail('Unsupported highlight colour');
      return { type: 'highlight', attrs: { color: a.color ?? null } };
    }
    fail('Unsupported formatting mark');
  }
  function walk(source, depth, allowed, inTable = false) {
    if (depth > RICH_CONTENT_LIMITS.maxDepth || ++budget.nodes > RICH_CONTENT_LIMITS.maxNodes)
      fail('Rich content is too complex');
    keys(source, ['type', 'attrs', 'content', 'text', 'marks'], 'rich content node');
    if (typeof source.type !== 'string' || !allowed.has(source.type))
      fail('Unsupported rich content structure');
    const type = source.type;
    if (type === 'text') {
      attrs(source, []);
      if (source.content !== undefined) fail('Text cannot contain child nodes');
      const value = text(source.text, maxTextLength, 'text');
      if (!value.length) fail('Empty text nodes are not supported');
      const result = { type, text: value };
      if (source.marks !== undefined) {
        if (!Array.isArray(source.marks) || source.marks.length > 7)
          fail('Invalid formatting marks');
        const marks = source.marks.map(mark);
        if (new Set(marks.map((item) => item.type)).size !== marks.length)
          fail('Duplicate formatting marks');
        if (marks.length) result.marks = marks;
      }
      return result;
    }
    if (source.text !== undefined || (source.marks !== undefined && type !== 'hardBreak'))
      fail('Only inline text supports text and formatting marks');
    const result = { type };
    if (type === 'hardBreak' && source.marks !== undefined) {
      if (!Array.isArray(source.marks) || source.marks.length > 7) fail('Invalid formatting marks');
      const marks = source.marks.map(mark);
      if (new Set(marks.map((item) => item.type)).size !== marks.length)
        fail('Duplicate formatting marks');
      if (marks.length) result.marks = marks;
    }
    let children = BLOCKS;
    if (type === 'paragraph' || type === 'heading') {
      const a = attrs(source, type === 'heading' ? ['level', 'textAlign'] : ['textAlign']);
      result.attrs = {
        ...(type === 'heading' ? { level: integer(a.level ?? 2, 2, 4, 'heading level') } : {}),
        textAlign: align(a.textAlign),
      };
      children = INLINE;
    } else if (type === 'orderedList') {
      const a = attrs(source, ['start', 'type']);
      if (a.type !== undefined && a.type !== null && !['1', 'a', 'A', 'i', 'I'].includes(a.type))
        fail('Invalid ordered list style');
      result.attrs = {
        start: integer(a.start ?? 1, 1, 100000, 'ordered list start'),
        type: a.type ?? null,
      };
      children = new Set(['listItem']);
    } else if (type === 'bulletList') {
      attrs(source, []);
      children = new Set(['listItem']);
    } else if (type === 'table') {
      attrs(source, []);
      if (inTable) fail('Nested tables are not supported');
      children = new Set(['tableRow']);
      inTable = true;
    } else if (type === 'tableRow') {
      attrs(source, []);
      children = new Set(['tableCell', 'tableHeader']);
    } else if (type === 'tableCell' || type === 'tableHeader') {
      const a = attrs(source, ['colspan', 'rowspan', 'colwidth', 'textAlign', 'align']);
      const colspan = integer(a.colspan ?? 1, 1, 20, 'column span'),
        rowspan = integer(a.rowspan ?? 1, 1, 20, 'row span');
      if (
        a.colwidth !== undefined &&
        a.colwidth !== null &&
        (!Array.isArray(a.colwidth) ||
          a.colwidth.length !== colspan ||
          a.colwidth.some((width) => !Number.isInteger(width) || width < 0 || width > 2000))
      )
        fail('Invalid table column widths');
      result.attrs = {
        colspan,
        rowspan,
        colwidth: a.colwidth ?? null,
        ...(a.textAlign !== undefined ? { textAlign: align(a.textAlign) } : {}),
        ...(a.align !== undefined ? { align: align(a.align) } : {}),
      };
    } else if (type === 'image') {
      const a = attrs(source, ['mediaId', 'alt', 'caption', 'width', 'align']);
      if (typeof a.mediaId !== 'string' || !UUID.test(a.mediaId))
        fail('Images must reference a library image');
      if (++budget.images > RICH_CONTENT_LIMITS.maxImages) fail('Too many embedded images');
      if (a.width !== undefined && !['full', 'wide', 'half'].includes(a.width))
        fail('Invalid image width');
      result.attrs = {
        mediaId: a.mediaId.toLowerCase(),
        alt: text(a.alt ?? '', 200, 'image alternative text'),
        caption: text(a.caption ?? '', 500, 'image caption'),
        width: a.width ?? 'wide',
        align: align(a.align, ['left', 'center', 'right']) ?? 'center',
      };
    } else if (type === 'codeBlock') {
      const a = attrs(source, ['language']);
      if (
        a.language !== undefined &&
        a.language !== null &&
        (typeof a.language !== 'string' || !/^[a-z0-9+-]{1,40}$/i.test(a.language))
      )
        fail('Invalid code language');
      result.attrs = { language: a.language ?? null };
      children = new Set(['text']);
    } else attrs(source, []);
    const leaf = ['image', 'hardBreak', 'horizontalRule'].includes(type);
    if (leaf) {
      if (source.content !== undefined) fail('This node cannot have child nodes');
      return result;
    }
    if (source.content !== undefined && !Array.isArray(source.content))
      fail('Invalid rich content children');
    const content = (source.content ?? []).map((child) =>
      walk(child, depth + 1, children, inTable),
    );
    if (
      [
        'doc',
        'blockquote',
        'bulletList',
        'orderedList',
        'listItem',
        'table',
        'tableCell',
        'tableHeader',
      ].includes(type) &&
      !content.length
    )
      fail('This rich content block must have content');
    if (type === 'listItem' && content[0]?.type !== 'paragraph')
      fail('A list item must start with a paragraph');
    if (type === 'codeBlock' && content.some((child) => child.marks?.length))
      fail('Code block text cannot have marks');
    if (content.length || type === 'tableRow') result.content = content;
    if (type === 'table') checkTable(content);
    return result;
  }
  function checkTable(rows) {
    if (rows.length > 20) fail('A table has too many rows');
    const occupied = Array.from({ length: rows.length }, () => []);
    let width = 0;
    rows.forEach((row, r) => {
      let c = 0;
      if (row.content.length > 20) fail('A table has too many cells');
      for (const cell of row.content) {
        while (occupied[r][c]) c++;
        const span = cell.attrs.colspan,
          down = cell.attrs.rowspan;
        if (c + span > 20 || r + down > rows.length) fail('A table span extends outside its grid');
        for (let y = r; y < r + down; y++)
          for (let x = c; x < c + span; x++) {
            if (occupied[y][x]) fail('Table cells overlap');
            occupied[y][x] = true;
          }
        c += span;
      }
      width = Math.max(width, occupied[r].length);
    });
    if (
      !width ||
      occupied.some(
        (row) =>
          row.length !== width ||
          Array.from({ length: width }, (_, i) => row[i]).some((value) => !value),
      )
    )
      fail('Table rows must form a complete rectangular grid');
  }
  const document = walk(input, 0, new Set(['doc']));
  const plain = toPlainText(document);
  if (plain.trim().length < minTextLength || plain.length > maxTextLength)
    fail(`Rich content must contain ${minTextLength}–${maxTextLength} text characters`);
  if (new TextEncoder().encode(JSON.stringify(document)).byteLength > RICH_CONTENT_LIMITS.maxBytes)
    fail('Rich content is too large');
  return document;
}
function toPlainText(document) {
  function read(node) {
    if (node.type === 'text') return node.text ?? '';
    if (node.type === 'hardBreak') return '\n';
    if (node.type === 'image') return String(node.attrs?.caption || node.attrs?.alt || '');
    const content = (node.content ?? []).map(read);
    if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'codeBlock')
      return content.join('');
    if (node.type === 'tableRow') return content.join('\t');
    if (['doc', 'blockquote', 'listItem', 'tableCell', 'tableHeader'].includes(node.type))
      return content.join('\n\n');
    return content.join('\n');
  }
  return read(document).trim();
}
function fromPlainText(value) {
  if (typeof value !== 'string') value = '';
  return {
    type: 'doc',
    content: value.split(/\n\s*\n/u).map((paragraph) => ({
      type: 'paragraph',
      ...(paragraph
        ? {
            content: paragraph
              .split('\n')
              .flatMap((line, index) => [
                ...(index ? [{ type: 'hardBreak' }] : []),
                ...(line ? [{ type: 'text', text: line }] : []),
              ]),
          }
        : {}),
    })),
  };
}
function collectMediaIds(document) {
  const ids = new Set();
  function visit(node) {
    if (node.type === 'image' && typeof node.attrs?.mediaId === 'string')
      ids.add(node.attrs.mediaId);
    for (const child of node.content ?? []) visit(child);
  }
  visit(document);
  return [...ids];
}
exports.RichContentError = RichContentError;
exports.validateDocument = validateDocument;
exports.toPlainText = toPlainText;
exports.fromPlainText = fromPlainText;
exports.collectMediaIds = collectMediaIds;
exports.safeLink = safeLink;
exports.RICH_CONTENT_LIMITS = RICH_CONTENT_LIMITS;
exports.HIGHLIGHT_COLORS = HIGHLIGHT_COLORS;
