export type RichNodeType =
  | 'doc'
  | 'paragraph'
  | 'heading'
  | 'text'
  | 'hardBreak'
  | 'blockquote'
  | 'bulletList'
  | 'orderedList'
  | 'listItem'
  | 'codeBlock'
  | 'horizontalRule'
  | 'table'
  | 'tableRow'
  | 'tableCell'
  | 'tableHeader'
  | 'image';
export type RichMarkType =
  'bold' | 'italic' | 'underline' | 'strike' | 'code' | 'link' | 'highlight';
export type RichAttributes = Record<string, string | number | boolean | null | number[]>;
export interface RichMark {
  type: RichMarkType;
  attrs?: RichAttributes;
}
export interface RichNode {
  type: RichNodeType;
  attrs?: RichAttributes;
  content?: RichNode[];
  text?: string;
  marks?: RichMark[];
}
export interface RichDocument extends RichNode {
  type: 'doc';
  content: RichNode[];
}
export interface RichDocumentOptions {
  maxTextLength?: number;
  minTextLength?: number;
}
export declare class RichContentError extends Error {
  readonly code: 'INVALID_RICH_CONTENT';
}
export declare function validateDocument(
  input: unknown,
  options?: RichDocumentOptions,
): RichDocument;
export declare function toPlainText(document: RichDocument): string;
export declare function fromPlainText(text: string): RichDocument;
export declare function collectMediaIds(document: RichDocument): string[];
export declare function safeLink(href: unknown): string | null;
export declare const RICH_CONTENT_LIMITS: Readonly<{
  maxDepth: number;
  maxNodes: number;
  maxBytes: number;
  maxImages: number;
  maxTableRows: number;
  maxTableColumns: number;
}>;
export declare const HIGHLIGHT_COLORS: readonly string[];
