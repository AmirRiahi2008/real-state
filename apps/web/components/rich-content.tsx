import type { CSSProperties, ReactNode } from 'react';
import {
  HIGHLIGHT_COLORS,
  safeLink,
  validateDocument,
  type RichDocument,
  type RichMark,
  type RichNode,
} from '@oriva/rich-content';
import type { Locale } from '@/lib/api';
import './rich-content.css';

export interface RichContentProps {
  document?: RichDocument | null | unknown;
  plainText?: string;
  locale?: Locale;
  className?: string;
  mediaScope?: 'public' | 'admin';
}
const mediaId = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const highlights = new Set(HIGHLIGHT_COLORS);

/** Render the shared, bounded document schema as React elements; HTML is never evaluated. */
export default function RichContentRenderer({
  document,
  plainText = '',
  locale = 'en',
  className = '',
  mediaScope = 'public',
}: RichContentProps) {
  let validated: RichDocument | null = null;
  if (document) {
    try {
      validated = validateDocument(document, { maxTextLength: 100000, minTextLength: 0 });
    } catch {
      // Older/plain content remains readable if a response contains unsupported data.
    }
  }
  const ar = locale === 'ar';
  const alignment = (node: RichNode): CSSProperties | undefined => {
    const value = node.attrs?.textAlign ?? node.attrs?.align;
    return ['left', 'center', 'right', 'justify'].includes(String(value))
      ? { textAlign: value as CSSProperties['textAlign'] }
      : undefined;
  };
  function markedText(value: string, marks: RichMark[] | undefined, key: string): ReactNode {
    let result: ReactNode = value;
    const seen = new Set<string>();
    for (const mark of marks ?? []) {
      if (seen.has(mark.type)) continue;
      seen.add(mark.type);
      switch (mark.type) {
        case 'bold':
          result = <strong key={`${key}-bold`}>{result}</strong>;
          break;
        case 'italic':
          result = <em key={`${key}-italic`}>{result}</em>;
          break;
        case 'underline':
          result = <u key={`${key}-underline`}>{result}</u>;
          break;
        case 'strike':
          result = <s key={`${key}-strike`}>{result}</s>;
          break;
        case 'code':
          result = <code key={`${key}-code`}>{result}</code>;
          break;
        case 'highlight': {
          const color = String(mark.attrs?.color ?? '').toLowerCase();
          result = (
            <mark
              key={`${key}-highlight`}
              style={highlights.has(color) ? { backgroundColor: color } : undefined}
            >
              {result}
            </mark>
          );
          break;
        }
        case 'link': {
          const href = safeLink(mark.attrs?.href);
          if (href)
            result = (
              <a
                key={`${key}-link`}
                href={href}
                title={typeof mark.attrs?.title === 'string' ? mark.attrs.title : undefined}
                target={/^https?:/i.test(href) ? '_blank' : undefined}
                rel="noopener noreferrer nofollow"
                referrerPolicy="no-referrer"
              >
                {result}
              </a>
            );
          break;
        }
      }
    }
    return result;
  }
  function children(node: RichNode, key: string): ReactNode[] {
    return (node.content ?? []).map((child, index) => render(child, `${key}-${index}`));
  }
  function tableRow(node: RichNode, key: string, headerRow: boolean): ReactNode {
    return (
      <tr key={key}>
        {(node.content ?? []).map((cell, index) => {
          const widths = Array.isArray(cell.attrs?.colwidth)
            ? cell.attrs.colwidth.filter((width): width is number => typeof width === 'number')
            : [];
          const style: CSSProperties = {
            ...alignment(cell),
            ...(widths.length ? { minWidth: widths.reduce((sum, width) => sum + width, 0) } : {}),
          };
          const colspan = Number(cell.attrs?.colspan ?? 1);
          const rowspan = Number(cell.attrs?.rowspan ?? 1);
          const content = children(cell, `${key}-${index}`);
          return cell.type === 'tableHeader' ? (
            <th
              key={`${key}-${index}`}
              scope={headerRow ? 'col' : 'row'}
              colSpan={colspan}
              rowSpan={rowspan}
              style={style}
            >
              {content}
            </th>
          ) : (
            <td key={`${key}-${index}`} colSpan={colspan} rowSpan={rowspan} style={style}>
              {content}
            </td>
          );
        })}
      </tr>
    );
  }
  function render(node: RichNode, key: string): ReactNode {
    const content = children(node, key);
    switch (node.type) {
      case 'text':
        return <span key={key}>{markedText(node.text ?? '', node.marks, key)}</span>;
      case 'paragraph':
        return (
          <p key={key} style={alignment(node)}>
            {content.length ? content : <br />}
          </p>
        );
      case 'heading':
        switch (node.attrs?.level) {
          case 2:
            return (
              <h2 key={key} style={alignment(node)}>
                {content}
              </h2>
            );
          case 3:
            return (
              <h3 key={key} style={alignment(node)}>
                {content}
              </h3>
            );
          default:
            return (
              <h4 key={key} style={alignment(node)}>
                {content}
              </h4>
            );
        }
      case 'hardBreak':
        return <br key={key} />;
      case 'horizontalRule':
        return <hr key={key} />;
      case 'blockquote':
        return <blockquote key={key}>{content}</blockquote>;
      case 'bulletList':
        return <ul key={key}>{content}</ul>;
      case 'orderedList': {
        const style = node.attrs?.type;
        return (
          <ol
            key={key}
            start={Number(node.attrs?.start ?? 1)}
            type={
              ['1', 'a', 'A', 'i', 'I'].includes(String(style))
                ? (style as '1' | 'a' | 'A' | 'i' | 'I')
                : undefined
            }
          >
            {content}
          </ol>
        );
      }
      case 'listItem':
        return <li key={key}>{content}</li>;
      case 'codeBlock':
        return (
          <pre key={key} dir="ltr">
            <code>{content}</code>
          </pre>
        );
      case 'table': {
        const rows = node.content ?? [];
        const firstIsHeader = Boolean(
          rows[0]?.content?.length && rows[0].content.every((cell) => cell.type === 'tableHeader'),
        );
        // A row span cannot cross HTML row groups (thead/tbody). Keep such headers
        // in the same group as their covered rows while retaining column scopes.
        const separateHeader =
          firstIsHeader && rows[0].content!.every((cell) => Number(cell.attrs?.rowspan ?? 1) === 1);
        return (
          <div
            key={key}
            className="rich-content-table"
            role="region"
            aria-label={
              ar
                ? 'جدول ضمن المحتوى، قابل للتمرير أفقياً'
                : 'Content table, scroll horizontally for more columns'
            }
            tabIndex={0}
          >
            <table>
              {separateHeader ? <thead>{tableRow(rows[0], `${key}-0`, true)}</thead> : null}
              <tbody>
                {rows
                  .slice(separateHeader ? 1 : 0)
                  .map((row, index) =>
                    tableRow(
                      row,
                      `${key}-${index + (separateHeader ? 1 : 0)}`,
                      !separateHeader && firstIsHeader && index === 0,
                    ),
                  )}
              </tbody>
            </table>
          </div>
        );
      }
      case 'image': {
        const id = node.attrs?.mediaId;
        if (typeof id !== 'string' || !mediaId.test(id)) return null;
        const source =
          mediaScope === 'admin'
            ? `/api/admin/media/manage/${id}/file`
            : `/api/backend/v1/media/${id}/file`;
        return (
          <figure
            key={key}
            className="rich-content-figure"
            data-width={node.attrs?.width ?? 'full'}
            data-align={node.attrs?.align ?? 'center'}
          >
            <img src={source} alt={String(node.attrs?.alt ?? '')} loading="lazy" decoding="async" />
            {node.attrs?.caption ? <figcaption>{String(node.attrs.caption)}</figcaption> : null}
          </figure>
        );
      }
      default:
        return null;
    }
  }
  return (
    <div
      className={`rich-content ${className}`.trim()}
      lang={locale}
      dir={ar ? 'rtl' : 'ltr'}
      data-rich-content={validated ? 'rich' : 'plain'}
    >
      {validated
        ? children(validated, 'document')
        : (typeof plainText === 'string' ? plainText : '')
            .split(/\n\s*\n/)
            .filter(Boolean)
            .map((paragraph, index) => (
              <p className="rich-content-plain" key={index}>
                {paragraph}
              </p>
            ))}
    </div>
  );
}
