'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { Extension, type Editor, type JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TableKit, TableCell, TableHeader } from '@tiptap/extension-table';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import { Plugin, TextSelection, type SelectionBookmark } from '@tiptap/pm/state';
import { TableMap } from '@tiptap/pm/tables';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Check,
  ChevronDown,
  Code2,
  Columns3,
  Eraser,
  Eye,
  FileText,
  Highlighter,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Maximize2,
  Merge,
  Minimize2,
  Minus,
  PanelTop,
  Pilcrow,
  Quote,
  Redo2,
  Rows3,
  Scissors,
  Settings2,
  Strikethrough,
  Table2,
  Trash2,
  Underline,
  Undo2,
  Unlink,
  UploadCloud,
} from 'lucide-react';
import {
  fromPlainText,
  toPlainText,
  validateDocument,
  safeLink,
  HIGHLIGHT_COLORS,
  RICH_CONTENT_LIMITS,
  type RichDocument,
} from '@oriva/rich-content';
import type { Locale } from '@/lib/api';
import RichContentRenderer from '@/components/rich-content';
import { adminError, adminRequest } from './admin-api';
import { AdminMediaPicker, RecordDialog, adminMediaSource } from './admin-media-library';
import { MediaImage, imageAttributes, type RichImageAttributes } from './rich-editor-extensions';
import './rich-text-editor.css';

export interface RichTextEditorProps {
  id: string;
  label: string;
  locale: Locale;
  uiLocale?: Locale;
  value?: RichDocument | null;
  plainText: string;
  onChange: (document: RichDocument, plainText: string) => void;
  disabled?: boolean;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
}
interface SavedSelection {
  from: number;
  to: number;
}
interface ImageDraft extends RichImageAttributes {
  position: number | null;
  decorative: boolean;
}
function Tool({
  label,
  children,
  onClick,
  active,
  disabled = false,
  className = '',
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`rich-tool ${active ? 'is-active ' : ''}${className}`}
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
function activeTable(editor: Editor) {
  const selection = editor.state.selection;
  for (let depth = selection.$from.depth; depth > 0; depth--) {
    const node = selection.$from.node(depth);
    if (node.type.name === 'table') {
      try {
        const map = TableMap.get(node);
        return { rows: map.height, columns: map.width };
      } catch {
        return null;
      }
    }
  }
  return null;
}
function EditorDialogs({ children, locale }: { children: ReactNode; locale: Locale }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <div
      className="admin-root rich-editor-modal-root"
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      lang={locale}
      onSubmit={(event) => event.stopPropagation()}
    >
      {children}
    </div>,
    window.document.body,
  );
}
function cleanPastedHTML(html: string) {
  // Template contents have an inert owner document: resource URLs are stripped
  // before any node can be adopted into the editable document.
  const template = window.document.createElement('template');
  template.innerHTML = html;
  const content = template.content;
  const document = content.ownerDocument;
  content
    .querySelectorAll(
      'script,style,iframe,object,embed,svg,math,form,input,button,textarea,select,meta,link,base,video,audio,source,track,picture,template',
    )
    .forEach((node) => node.remove());
  for (const image of content.querySelectorAll('img')) {
    const id = image.getAttribute('data-media-id');
    if (
      !id ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu.test(id)
    )
      image.remove();
    else for (const attribute of ['src', 'srcset', 'sizes']) image.removeAttribute(attribute);
  }
  for (const element of content.querySelectorAll('h1,h5,h6')) {
    const replacement = document.createElement(element.tagName === 'H1' ? 'h2' : 'h4');
    replacement.append(...Array.from(element.childNodes));
    element.replaceWith(replacement);
  }
  for (const mark of content.querySelectorAll('mark')) {
    const color = (
      mark.getAttribute('data-color') ||
      mark.style.backgroundColor ||
      ''
    ).toLowerCase();
    const selected = HIGHLIGHT_COLORS.includes(color) ? color : HIGHLIGHT_COLORS[0];
    mark.setAttribute('data-color', selected);
    mark.style.backgroundColor = selected;
  }
  for (const element of content.querySelectorAll('*')) {
    for (const attribute of Array.from(element.attributes)) {
      if (/^on/iu.test(attribute.name) || ['srcdoc', 'formaction'].includes(attribute.name))
        element.removeAttribute(attribute.name);
    }
    if (element.tagName === 'A') {
      const href = safeLink(element.getAttribute('href'));
      if (href) element.setAttribute('href', href);
      else element.removeAttribute('href');
      element.removeAttribute('class');
      element.setAttribute('target', '_blank');
      element.setAttribute('rel', 'noopener noreferrer nofollow');
      if (element.hasAttribute('title'))
        element.setAttribute('title', (element.getAttribute('title') || '').slice(0, 200));
    }
  }
  return template.innerHTML;
}

export default function RichTextEditor({
  id,
  label,
  locale,
  uiLocale = locale,
  value,
  plainText,
  onChange,
  disabled = false,
  required = false,
  minLength = 0,
  maxLength = 100000,
}: RichTextEditorProps) {
  const ar = uiLocale === 'ar';
  const initial = useRef<RichDocument>(value ?? fromPlainText(plainText));
  const [document, setDocument] = useState<RichDocument>(initial.current);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [fullscreen, setFullscreen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [showValidation, setShowValidation] = useState(false);
  const [linkDialog, setLinkDialog] = useState(false),
    [linkUrl, setLinkUrl] = useState(''),
    [linkText, setLinkText] = useState('');
  const [tableDialog, setTableDialog] = useState(false);
  const [picker, setPicker] = useState(false),
    [imageDraft, setImageDraft] = useState<ImageDraft | null>(null),
    [imageReplace, setImageReplace] = useState(false);
  const [uploading, setUploading] = useState(false);
  const selected = useRef<SavedSelection | null>(null);
  const bookmark = useRef<SelectionBookmark | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const callback = useRef(onChange);
  const rejected = useRef<(message: string) => void>(() => undefined);
  const fileUpload = useRef<(file: File) => Promise<void>>(async () => undefined);
  const uploadInput = useRef<HTMLInputElement>(null);
  const validationInput = useRef<HTMLTextAreaElement>(null);
  const lastSent = useRef(JSON.stringify(initial.current));
  const wrapper = useRef<HTMLDivElement>(null);
  useEffect(() => {
    callback.current = onChange;
  }, [onChange]);
  rejected.current = (message) =>
    setFeedback(ar ? 'تعذّر تطبيق هذا التغيير. تحقّق من حجم النص وبنية الجدول والروابط.' : message);
  const editImage = useCallback((attributes: RichImageAttributes, position: number) => {
    const editor = editorRef.current;
    if (editor) {
      editor.commands.setNodeSelection(position);
      selected.current = { from: position, to: position + 1 };
      bookmark.current = editor.state.selection.getBookmark();
    }
    setFeedback('');
    setImageDraft({ ...attributes, position, decorative: !attributes.alt });
  }, []);
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: 'https',
          isAllowedUri: (url) => Boolean(safeLink(url)),
        },
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'], defaultAlignment: null }),
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({
        placeholder: locale === 'ar' ? 'ابدأ كتابة قصتك…' : 'Start your story…',
      }),
      CharacterCount.configure({ limit: maxLength }),
      TableKit.configure({
        table: {
          resizable: true,
          cellMinWidth: 60,
          lastColumnResizable: false,
          allowTableNodeSelection: true,
        },
        tableCell: false,
        tableHeader: false,
      }),
      TableCell.extend({
        content:
          '(paragraph | heading | bulletList | orderedList | blockquote | codeBlock | horizontalRule | image)+',
      }),
      TableHeader.extend({
        content:
          '(paragraph | heading | bulletList | orderedList | blockquote | codeBlock | horizontalRule | image)+',
      }),
      MediaImage.configure({ uiLocale, onEditImage: editImage }),
      Extension.create({
        name: 'orivaDocumentBounds',
        addProseMirrorPlugins() {
          return [
            new Plugin({
              filterTransaction(transaction) {
                if (!transaction.docChanged) return true;
                try {
                  validateDocument(transaction.doc.toJSON(), { maxTextLength: maxLength });
                  return true;
                } catch (error) {
                  queueMicrotask(() =>
                    rejected.current(
                      error instanceof Error
                        ? error.message
                        : 'This change exceeds the document limits.',
                    ),
                  );
                  return false;
                }
              },
            }),
          ];
        },
      }),
    ],
    [locale, uiLocale, maxLength, editImage],
  );
  const editor = useEditor(
    {
      extensions,
      content: initial.current as JSONContent,
      immediatelyRender: false,
      shouldRerenderOnTransaction: false,
      editable: !disabled,
      editorProps: {
        attributes: {
          id,
          role: 'textbox',
          'aria-label': label,
          'aria-multiline': 'true',
          'aria-describedby': `${id}-status`,
          dir: locale === 'ar' ? 'rtl' : 'ltr',
          lang: locale,
          class: 'rich-editor-document rich-content',
        },
        transformPastedHTML: cleanPastedHTML,
        handlePaste(view, event) {
          const files = Array.from(event.clipboardData?.files ?? []);
          if (!files.length) return false;
          event.preventDefault();
          if (files.length !== 1) {
            setFeedback(ar ? 'أضف صورة واحدة في كل مرة.' : 'Add one image at a time.');
            return true;
          }
          selected.current = { from: view.state.selection.from, to: view.state.selection.to };
          bookmark.current = view.state.selection.getBookmark();
          void fileUpload.current(files[0]);
          return true;
        },
        handleDrop(view, event) {
          const files = Array.from(event.dataTransfer?.files ?? []);
          if (!files.length) return false;
          event.preventDefault();
          if (files.length !== 1) {
            setFeedback(ar ? 'أضف صورة واحدة في كل مرة.' : 'Add one image at a time.');
            return true;
          }
          const position = view.posAtCoords({ left: event.clientX, top: event.clientY });
          if (position) {
            const caret = TextSelection.near(view.state.doc.resolve(position.pos));
            selected.current = { from: caret.from, to: caret.to };
            bookmark.current = caret.getBookmark();
          }
          void fileUpload.current(files[0]);
          return true;
        },
      },
      onTransaction({ editor, transaction, appendedTransactions }) {
        if (!bookmark.current) return;
        try {
          for (const change of [transaction, ...appendedTransactions])
            if (change.docChanged) bookmark.current = bookmark.current.map(change.mapping);
          const resolved = bookmark.current.resolve(editor.state.doc);
          selected.current = { from: resolved.from, to: resolved.to };
        } catch {
          bookmark.current = null;
          selected.current = null;
        }
      },
      onUpdate({ editor }) {
        const next = editor.getJSON() as RichDocument;
        lastSent.current = JSON.stringify(next);
        setDocument(next);
        setFeedback('');
        callback.current(next, toPlainText(next));
      },
    },
    [extensions],
  );
  useEffect(() => {
    editorRef.current = editor;
    return () => {
      editorRef.current = null;
    };
  }, [editor]);
  useEffect(() => {
    if (editor) editor.setEditable(!disabled && mode === 'edit', false);
  }, [editor, disabled, mode]);
  useEffect(() => {
    if (!editor) return;
    const next = value ?? fromPlainText(plainText),
      serialized = JSON.stringify(next);
    if (serialized === lastSent.current) return;
    lastSent.current = serialized;
    if (JSON.stringify(editor.getJSON()) !== serialized)
      editor.commands.setContent(next as JSONContent, { emitUpdate: false });
    setDocument(editor.getJSON() as RichDocument);
  }, [editor, value, plainText]);
  const state = useEditorState({
    editor,
    selector: ({ editor }) => {
      if (!editor) return null;
      return {
        bold: editor.isActive('bold'),
        italic: editor.isActive('italic'),
        underline: editor.isActive('underline'),
        strike: editor.isActive('strike'),
        bullet: editor.isActive('bulletList'),
        ordered: editor.isActive('orderedList'),
        quote: editor.isActive('blockquote'),
        code: editor.isActive('codeBlock'),
        link: editor.isActive('link'),
        highlight: editor.isActive('highlight'),
        align: String(
          editor.getAttributes('paragraph').textAlign ??
            editor.getAttributes('heading').textAlign ??
            (locale === 'ar' ? 'right' : 'left'),
        ),
        heading: [2, 3, 4].find((level) => editor.isActive('heading', { level })) ?? 0,
        table: activeTable(editor),
        image: editor.isActive('image'),
        undo: editor.can().undo(),
        redo: editor.can().redo(),
        merge: editor.can().mergeCells(),
        split: editor.can().splitCell(),
      };
    },
  });
  const text = toPlainText(document),
    characters = text.length,
    words = text.trim() ? text.trim().split(/\s+/u).length : 0;
  const validation = uploading
    ? ar
      ? 'انتظر اكتمال رفع الصورة.'
      : 'Wait for the image upload to finish.'
    : characters > maxLength
      ? ar
        ? `النص يتجاوز الحد المسموح (${maxLength}).`
        : `Content exceeds the ${maxLength.toLocaleString()} character limit.`
      : required && text.trim().length < minLength
        ? ar
          ? `أضف ${minLength} أحرف على الأقل من النص.`
          : `Add at least ${minLength} characters of text.`
        : '';
  useEffect(() => {
    validationInput.current?.setCustomValidity(validation);
  }, [validation]);
  useEffect(() => {
    if (!fullscreen) return;
    const previous = window.document.body.style.overflow;
    window.document.body.style.overflow = 'hidden';
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !window.document.querySelector('dialog[open]')) {
        event.preventDefault();
        setFullscreen(false);
      }
      if (
        event.key === 'Tab' &&
        !event.defaultPrevented &&
        !window.document.querySelector('dialog[open]')
      ) {
        const root = wrapper.current;
        if (!root) return;
        const controls = Array.from(
          root.querySelectorAll<HTMLElement>(
            'button:not(:disabled), select:not(:disabled), input:not(:disabled):not([type="file"]), textarea:not(:disabled), [contenteditable="true"], a[href], [tabindex]',
          ),
        ).filter((element) => element.tabIndex >= 0 && element.getClientRects().length > 0);
        const first = controls[0],
          last = controls[controls.length - 1];
        const active = window.document.activeElement;
        if (
          first &&
          last &&
          (!root.contains(active) || (event.shiftKey ? active === first : active === last))
        ) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
      }
    };
    window.addEventListener('keydown', escape);
    return () => {
      window.document.body.style.overflow = previous;
      window.removeEventListener('keydown', escape);
    };
  }, [fullscreen]);
  function rememberSelection() {
    if (editor) {
      selected.current = { from: editor.state.selection.from, to: editor.state.selection.to };
      bookmark.current = editor.state.selection.getBookmark();
    }
  }
  function selection() {
    if (editor && bookmark.current) {
      const resolved = bookmark.current.resolve(editor.state.doc);
      return { from: resolved.from, to: resolved.to };
    }
    const size = editor?.state.doc.content.size ?? 0;
    return selected.current
      ? { from: Math.min(selected.current.from, size), to: Math.min(selected.current.to, size) }
      : undefined;
  }
  function openLink() {
    if (!editor) return;
    rememberSelection();
    setLinkUrl(String(editor.getAttributes('link').href || ''));
    setLinkText(
      editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, ' '),
    );
    setFeedback('');
    setLinkDialog(true);
  }
  function applyLink(event: FormEvent) {
    event.preventDefault();
    if (!editor) return;
    const href = safeLink(linkUrl.trim());
    if (!href) {
      setFeedback(
        ar
          ? 'أدخل رابطاً صالحاً: https أو http أو بريد أو هاتف أو رابط داخل الموقع.'
          : 'Enter a valid https, http, email, phone or internal website link.',
      );
      return;
    }
    const range = selection();
    let chain = editor.chain().focus();
    if (range) chain = chain.setTextSelection(range);
    if (range && range.from === range.to && !editor.isActive('link'))
      chain
        .insertContent({
          type: 'text',
          text: linkText.trim() || href,
          marks: [{ type: 'link', attrs: { href } }],
        })
        .run();
    else
      chain
        .extendMarkRange('link')
        .setLink({ href, target: '_blank', rel: 'noopener noreferrer nofollow' })
        .run();
    setLinkDialog(false);
    setFeedback('');
  }
  function removeLink() {
    if (!editor) return;
    const range = selection();
    let chain = editor.chain().focus();
    if (range) chain = chain.setTextSelection(range);
    chain.extendMarkRange('link').unsetLink().run();
    setLinkDialog(false);
  }
  function insertTable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    const form = new FormData(event.currentTarget),
      rows = Number(form.get('rows')),
      cols = Number(form.get('columns'));
    if (
      !Number.isInteger(rows) ||
      !Number.isInteger(cols) ||
      rows < 1 ||
      cols < 1 ||
      rows > 20 ||
      cols > 20
    ) {
      setFeedback(
        ar ? 'اختر من صف واحد إلى ٢٠ صفاً وعموداً.' : 'Choose between 1 and 20 rows and columns.',
      );
      return;
    }
    const range = selection();
    let chain = editor.chain().focus();
    if (range) chain = chain.setTextSelection(range);
    chain.insertTable({ rows, cols, withHeaderRow: form.get('header') === 'on' }).run();
    setTableDialog(false);
  }
  function addImage(ids: string[]) {
    if (!ids[0]) return;
    if (imageReplace && imageDraft) setImageDraft({ ...imageDraft, mediaId: ids[0] });
    else
      setImageDraft({
        mediaId: ids[0],
        alt: '',
        caption: '',
        width: 'wide',
        align: 'center',
        position: null,
        decorative: false,
      });
    setImageReplace(false);
  }
  async function upload(file: File) {
    if (disabled || uploading) return;
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setFeedback(
        ar
          ? 'اختر صورة JPEG أو PNG أو WebP أصغر من ٥ ميغابايت.'
          : 'Choose a JPEG, PNG or WebP image under 5 MB.',
      );
      return;
    }
    if (!selected.current) rememberSelection();
    setUploading(true);
    setFeedback('');
    try {
      const data = new FormData();
      data.set('file', file);
      const media = await adminRequest<{ id: string }>('/media', { method: 'POST', body: data });
      addImage([media.id]);
    } catch (error) {
      setFeedback(adminError(error, uiLocale));
    } finally {
      setUploading(false);
    }
  }
  fileUpload.current = upload;
  function applyImage(event: FormEvent) {
    event.preventDefault();
    if (!editor || !imageDraft) return;
    if (!imageDraft.decorative && !imageDraft.alt.trim()) {
      setFeedback(
        ar
          ? 'أضف وصفاً قصيراً للصورة أو حدّد أنها زخرفية.'
          : 'Add a short image description or mark it as decorative.',
      );
      return;
    }
    const { position, decorative, ...attributes } = imageDraft;
    attributes.alt = decorative ? '' : attributes.alt.trim();
    attributes.caption = attributes.caption.trim();
    if (position !== null && editor.state.doc.nodeAt(position)?.type.name === 'image')
      editor.chain().focus().setNodeSelection(position).updateAttributes('image', attributes).run();
    else {
      const range = selection();
      let chain = editor.chain().focus();
      if (range) chain = chain.setTextSelection(range);
      chain.insertContent({ type: 'image', attrs: attributes }).run();
    }
    setImageDraft(null);
    setFeedback('');
  }
  const unavailable = disabled || !editor || mode === 'preview';
  return (
    <div
      ref={wrapper}
      className={`rich-editor${fullscreen ? ' rich-editor-fullscreen' : ''}${disabled ? ' rich-editor-disabled' : ''}`}
      data-editor-language={locale}
      role="group"
      aria-labelledby={`${id}-label`}
    >
      <div className="rich-editor-topline">
        <div>
          <span className="rich-editor-kicker">
            <FileText size={13} />
            {ar ? 'مساحة للكتابة' : 'WRITING STUDIO'}
          </span>
          <label id={`${id}-label`} onClick={() => editor?.commands.focus()}>
            {label}
            {required ? <span aria-hidden="true"> *</span> : null}
          </label>
        </div>
        <div className="rich-editor-view-buttons">
          <button
            type="button"
            className={mode === 'preview' ? 'is-active' : ''}
            onClick={() => setMode(mode === 'edit' ? 'preview' : 'edit')}
            aria-pressed={mode === 'preview'}
          >
            <Eye size={15} />
            {mode === 'preview'
              ? ar
                ? 'متابعة التحرير'
                : 'Continue editing'
              : ar
                ? 'معاينة'
                : 'Preview'}
          </button>
          <button
            type="button"
            onClick={() => setFullscreen((previous) => !previous)}
            aria-label={
              fullscreen
                ? ar
                  ? 'إنهاء وضع التركيز'
                  : 'Exit focus mode'
                : ar
                  ? 'الكتابة في وضع التركيز'
                  : 'Focus writing mode'
            }
            aria-pressed={fullscreen}
          >
            {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>
      {mode === 'edit' ? (
        <>
          <div
            className="rich-editor-toolbar"
            role="toolbar"
            aria-label={ar ? 'أدوات تنسيق النص' : 'Text formatting tools'}
            dir={ar ? 'rtl' : 'ltr'}
          >
            <div className="rich-tool-group">
              <select
                aria-label={ar ? 'نمط الفقرة' : 'Paragraph style'}
                value={state?.code ? 'code' : String(state?.heading || 0)}
                disabled={unavailable}
                onChange={(event) => {
                  if (!editor) return;
                  const level = Number(event.target.value);
                  if (level)
                    editor
                      .chain()
                      .focus()
                      .setHeading({ level: level as 2 | 3 | 4 })
                      .run();
                  else editor.chain().focus().setParagraph().run();
                }}
              >
                <option value="0">{ar ? 'نص عادي' : 'Normal text'}</option>
                <option value="2">{ar ? 'عنوان رئيسي' : 'Heading 2'}</option>
                <option value="3">{ar ? 'عنوان فرعي' : 'Heading 3'}</option>
                <option value="4">{ar ? 'عنوان صغير' : 'Heading 4'}</option>
                {state?.code ? (
                  <option value="code">{ar ? 'مقطع برمجي' : 'Code block'}</option>
                ) : null}
              </select>
              <ChevronDown size={12} />
            </div>
            <div className="rich-tool-group">
              <Tool
                label={ar ? 'عريض · Ctrl/⌘ B' : 'Bold · Ctrl/⌘ B'}
                active={state?.bold}
                disabled={unavailable}
                onClick={() => editor?.chain().focus().toggleBold().run()}
              >
                <Bold size={16} />
              </Tool>
              <Tool
                label={ar ? 'مائل · Ctrl/⌘ I' : 'Italic · Ctrl/⌘ I'}
                active={state?.italic}
                disabled={unavailable}
                onClick={() => editor?.chain().focus().toggleItalic().run()}
              >
                <Italic size={16} />
              </Tool>
              <Tool
                label={ar ? 'تحته خط · Ctrl/⌘ U' : 'Underline · Ctrl/⌘ U'}
                active={state?.underline}
                disabled={unavailable}
                onClick={() => editor?.chain().focus().toggleUnderline().run()}
              >
                <Underline size={16} />
              </Tool>
              <Tool
                label={ar ? 'يتوسطه خط' : 'Strikethrough'}
                active={state?.strike}
                disabled={unavailable}
                onClick={() => editor?.chain().focus().toggleStrike().run()}
              >
                <Strikethrough size={16} />
              </Tool>
            </div>
            <div className="rich-tool-group">
              <Tool
                label={ar ? 'قائمة نقطية' : 'Bullet list'}
                active={state?.bullet}
                disabled={unavailable}
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
              >
                <List size={17} />
              </Tool>
              <Tool
                label={ar ? 'قائمة مرقمة' : 'Numbered list'}
                active={state?.ordered}
                disabled={unavailable}
                onClick={() => editor?.chain().focus().toggleOrderedList().run()}
              >
                <ListOrdered size={17} />
              </Tool>
              <Tool
                label={ar ? 'اقتباس' : 'Block quote'}
                active={state?.quote}
                disabled={unavailable}
                onClick={() => editor?.chain().focus().toggleBlockquote().run()}
              >
                <Quote size={16} />
              </Tool>
            </div>
            <div className="rich-tool-group">
              {[
                ['left', AlignLeft, ar ? 'محاذاة لليسار' : 'Align left'],
                ['center', AlignCenter, ar ? 'توسيط' : 'Align center'],
                ['right', AlignRight, ar ? 'محاذاة لليمين' : 'Align right'],
                ['justify', AlignJustify, ar ? 'ضبط النص' : 'Justify text'],
              ].map(([align, Icon, description]) => (
                <Tool
                  key={String(align)}
                  label={String(description)}
                  active={state?.align === align}
                  disabled={unavailable}
                  onClick={() => editor?.chain().focus().setTextAlign(String(align)).run()}
                >
                  {typeof Icon !== 'string' ? <Icon size={16} /> : null}
                </Tool>
              ))}
            </div>
            <div className="rich-tool-group">
              <Tool
                label={ar ? 'إضافة رابط' : 'Add or edit link'}
                active={state?.link}
                disabled={unavailable}
                onClick={openLink}
              >
                <Link2 size={16} />
              </Tool>
              <Tool
                label={ar ? 'إضافة جدول' : 'Insert table'}
                disabled={unavailable || Boolean(state?.table)}
                onClick={() => {
                  rememberSelection();
                  setFeedback('');
                  setTableDialog(true);
                }}
              >
                <Table2 size={17} />
              </Tool>
              <Tool
                label={ar ? 'صورة من المكتبة' : 'Insert image from library'}
                disabled={unavailable || uploading}
                onClick={() => {
                  rememberSelection();
                  setImageReplace(false);
                  setPicker(true);
                }}
              >
                <ImagePlus size={17} />
              </Tool>
              <Tool
                label={ar ? 'رفع صورة' : 'Upload image'}
                disabled={unavailable || uploading}
                onClick={() => {
                  rememberSelection();
                  uploadInput.current?.click();
                }}
              >
                <UploadCloud size={17} />
              </Tool>
            </div>
            <div className="rich-tool-group rich-highlight-group">
              <Highlighter size={15} aria-hidden="true" />
              {HIGHLIGHT_COLORS.map((color, index) => (
                <button
                  key={color}
                  type="button"
                  className="rich-highlight-swatch"
                  style={{ backgroundColor: color }}
                  title={(ar ? 'لون التمييز ' : 'Highlight colour ') + (index + 1)}
                  aria-label={(ar ? 'لون التمييز ' : 'Highlight colour ') + (index + 1)}
                  disabled={unavailable}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => editor?.chain().focus().toggleHighlight({ color }).run()}
                />
              ))}
              <Tool
                label={ar ? 'إزالة التمييز' : 'Remove highlight'}
                disabled={unavailable || !state?.highlight}
                onClick={() => editor?.chain().focus().unsetHighlight().run()}
              >
                <Eraser size={14} />
              </Tool>
            </div>
            <div className="rich-tool-group">
              <Tool
                label={ar ? 'مقطع برمجي' : 'Code block'}
                active={state?.code}
                disabled={unavailable}
                onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
              >
                <Code2 size={16} />
              </Tool>
              <Tool
                label={ar ? 'خط فاصل' : 'Horizontal divider'}
                disabled={unavailable}
                onClick={() => editor?.chain().focus().setHorizontalRule().run()}
              >
                <Minus size={16} />
              </Tool>
              <Tool
                label={ar ? 'إزالة التنسيق' : 'Clear formatting'}
                disabled={unavailable}
                onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()}
              >
                <Pilcrow size={16} />
              </Tool>
            </div>
            <div className="rich-tool-group">
              <Tool
                label={ar ? 'تراجع · Ctrl/⌘ Z' : 'Undo · Ctrl/⌘ Z'}
                disabled={unavailable || !state?.undo}
                onClick={() => editor?.chain().focus().undo().run()}
              >
                <Undo2 size={16} />
              </Tool>
              <Tool
                label={ar ? 'إعادة · Ctrl/⌘ Shift Z' : 'Redo · Ctrl/⌘ Shift Z'}
                disabled={unavailable || !state?.redo}
                onClick={() => editor?.chain().focus().redo().run()}
              >
                <Redo2 size={16} />
              </Tool>
            </div>
          </div>
          {state?.table ? (
            <div
              className="rich-editor-contextbar"
              role="toolbar"
              aria-label={ar ? 'تحرير الجدول' : 'Table editing tools'}
            >
              <span>
                <Table2 size={14} />
                {state.table.rows} × {state.table.columns}
              </span>
              <Tool
                label={ar ? 'إضافة صف قبل' : 'Add row before'}
                disabled={unavailable || state.table.rows >= 20}
                onClick={() => editor?.chain().focus().addRowBefore().run()}
              >
                <Rows3 size={14} />
                <span>+</span>↑
              </Tool>
              <Tool
                label={ar ? 'إضافة صف بعد' : 'Add row after'}
                disabled={unavailable || state.table.rows >= 20}
                onClick={() => editor?.chain().focus().addRowAfter().run()}
              >
                <Rows3 size={14} />
                <span>+</span>↓
              </Tool>
              <Tool
                label={ar ? 'حذف الصف' : 'Delete row'}
                disabled={unavailable}
                onClick={() => editor?.chain().focus().deleteRow().run()}
              >
                <Rows3 size={14} />
                <Minus size={11} />
              </Tool>
              <Tool
                label={ar ? 'إضافة عمود قبل' : 'Add column before'}
                disabled={unavailable || state.table.columns >= 20}
                onClick={() => editor?.chain().focus().addColumnBefore().run()}
              >
                <Columns3 size={14} />
                ←+
              </Tool>
              <Tool
                label={ar ? 'إضافة عمود بعد' : 'Add column after'}
                disabled={unavailable || state.table.columns >= 20}
                onClick={() => editor?.chain().focus().addColumnAfter().run()}
              >
                <Columns3 size={14} />
                +→
              </Tool>
              <Tool
                label={ar ? 'حذف العمود' : 'Delete column'}
                disabled={unavailable}
                onClick={() => editor?.chain().focus().deleteColumn().run()}
              >
                <Columns3 size={14} />
                <Minus size={11} />
              </Tool>
              <Tool
                label={ar ? 'دمج الخلايا المحددة' : 'Merge selected cells'}
                disabled={unavailable || !state.merge}
                onClick={() => editor?.chain().focus().mergeCells().run()}
              >
                <Merge size={15} />
              </Tool>
              <Tool
                label={ar ? 'تقسيم الخلية' : 'Split merged cell'}
                disabled={unavailable || !state.split}
                onClick={() => editor?.chain().focus().splitCell().run()}
              >
                <Scissors size={15} />
              </Tool>
              <Tool
                label={ar ? 'تبديل صف العناوين' : 'Toggle header row'}
                disabled={unavailable}
                onClick={() => editor?.chain().focus().toggleHeaderRow().run()}
              >
                <PanelTop size={15} />
              </Tool>
              <Tool
                label={ar ? 'حذف الجدول' : 'Delete table'}
                disabled={unavailable}
                onClick={() => editor?.chain().focus().deleteTable().run()}
              >
                <Trash2 size={15} />
              </Tool>
            </div>
          ) : null}
          {state?.image ? (
            <div className="rich-editor-contextbar">
              <span>
                <ImagePlus size={14} />
                {ar ? 'الصورة المحددة' : 'Selected image'}
              </span>
              <button
                type="button"
                disabled={unavailable}
                onClick={() => {
                  if (editor)
                    editImage(
                      imageAttributes(editor.getAttributes('image')),
                      editor.state.selection.from,
                    );
                }}
              >
                <Settings2 size={14} />
                {ar ? 'الصورة والوصف' : 'Image & description'}
              </button>
              <button
                type="button"
                disabled={unavailable}
                onClick={() => editor?.chain().focus().deleteSelection().run()}
              >
                <Trash2 size={14} />
                {ar ? 'حذف الصورة' : 'Remove image'}
              </button>
            </div>
          ) : null}
        </>
      ) : null}
      <input
        ref={uploadInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void upload(file);
        }}
      />
      <div className="rich-editor-canvas" hidden={mode !== 'edit'}>
        {editor ? (
          <EditorContent editor={editor} />
        ) : (
          <div className="rich-editor-loading" aria-busy="true">
            {ar ? 'جارٍ تجهيز المحرر…' : 'Preparing your editor…'}
          </div>
        )}
      </div>
      {mode === 'preview' ? (
        <div className="rich-editor-preview" aria-label={ar ? 'معاينة المحتوى' : 'Content preview'}>
          <RichContentRenderer
            document={document}
            plainText={text}
            locale={locale}
            mediaScope="admin"
          />
        </div>
      ) : null}
      {feedback ? (
        <p role="alert" className="rich-editor-feedback">
          {feedback}
        </p>
      ) : null}
      {showValidation && validation ? (
        <p role="alert" className="rich-editor-feedback">
          {validation}
        </p>
      ) : null}
      <div className="rich-editor-status" id={`${id}-status`}>
        <span>
          {uploading ? (
            ar ? (
              'جارٍ رفع الصورة…'
            ) : (
              'Uploading image…'
            )
          ) : (
            <>
              {words.toLocaleString(ar ? 'ar-AE' : 'en-AE')} {ar ? 'كلمة' : 'words'}
              <i /> {characters.toLocaleString(ar ? 'ar-AE' : 'en-AE')} /{' '}
              {maxLength.toLocaleString(ar ? 'ar-AE' : 'en-AE')} {ar ? 'حرف' : 'characters'}
            </>
          )}
        </span>
        <span>
          {locale === 'ar' ? 'العربية · RTL' : 'English · LTR'}
          <i />
          {ar ? 'محفوظ عند حفظ السجل' : 'Saved with your record'}
        </span>
      </div>
      <textarea
        className="rich-editor-validation"
        ref={validationInput}
        aria-hidden="true"
        tabIndex={-1}
        value={text}
        required={required}
        disabled={disabled}
        onChange={() => undefined}
        onInvalid={(event) => {
          event.preventDefault();
          setShowValidation(true);
          setMode('edit');
          editor?.commands.focus();
        }}
      />
      <EditorDialogs locale={uiLocale}>
        {linkDialog ? (
          <RecordDialog
            title={ar ? 'إضافة رابط' : 'Add a link'}
            onClose={() => setLinkDialog(false)}
          >
            <form className="rich-editor-dialog-form" onSubmit={applyLink}>
              <label className="admin-field">
                <span>{ar ? 'عنوان الرابط' : 'Link URL'}</span>
                <input
                  autoFocus
                  value={linkUrl}
                  onChange={(event) => setLinkUrl(event.target.value)}
                  maxLength={2048}
                  inputMode="url"
                  placeholder="https://example.com"
                  required
                />
              </label>
              {selected.current?.from === selected.current?.to && !state?.link ? (
                <label className="admin-field">
                  <span>{ar ? 'النص الظاهر' : 'Display text'}</span>
                  <input
                    value={linkText}
                    onChange={(event) => setLinkText(event.target.value)}
                    maxLength={500}
                    placeholder={ar ? 'عنوان الرابط' : 'Link title'}
                  />
                </label>
              ) : null}
              {feedback ? (
                <p role="alert" className="rich-editor-feedback">
                  {feedback}
                </p>
              ) : null}
              <p className="admin-muted">
                {ar
                  ? 'روابط الموقع أو HTTPS أو HTTP أو البريد أو الهاتف.'
                  : 'Website paths, HTTPS, HTTP, email and telephone links.'}
              </p>
              <footer>
                {state?.link ? (
                  <button type="button" className="admin-button" onClick={removeLink}>
                    <Unlink size={15} />
                    {ar ? 'إزالة الرابط' : 'Remove link'}
                  </button>
                ) : null}
                <button type="button" className="admin-button" onClick={() => setLinkDialog(false)}>
                  {ar ? 'إلغاء' : 'Cancel'}
                </button>
                <button type="submit" className="admin-button admin-button-primary">
                  <Check size={15} />
                  {ar ? 'تطبيق الرابط' : 'Apply link'}
                </button>
              </footer>
            </form>
          </RecordDialog>
        ) : null}
        {tableDialog ? (
          <RecordDialog
            title={ar ? 'إدراج جدول' : 'Insert a table'}
            onClose={() => setTableDialog(false)}
          >
            <form className="rich-editor-dialog-form" onSubmit={insertTable}>
              <div className="admin-grid">
                <label className="admin-field">
                  <span>{ar ? 'الصفوف' : 'Rows'}</span>
                  <input
                    name="rows"
                    type="number"
                    min={1}
                    max={20}
                    defaultValue={3}
                    required
                    autoFocus
                  />
                </label>
                <label className="admin-field">
                  <span>{ar ? 'الأعمدة' : 'Columns'}</span>
                  <input name="columns" type="number" min={1} max={20} defaultValue={3} required />
                </label>
              </div>
              <label className="rich-editor-check">
                <input name="header" type="checkbox" defaultChecked />
                {ar ? 'صف عناوين في الأعلى' : 'Header row at the top'}
              </label>
              <p className="admin-muted">
                {ar
                  ? 'يمكنك إضافة الصفوف والأعمدة ودمج الخلايا بعد الإدراج. استخدم Tab للتنقل بين الخلايا.'
                  : 'Add rows and columns or merge cells after insertion. Use Tab to move between cells.'}
              </p>
              <footer>
                <button
                  type="button"
                  className="admin-button"
                  onClick={() => setTableDialog(false)}
                >
                  {ar ? 'إلغاء' : 'Cancel'}
                </button>
                <button type="submit" className="admin-button admin-button-primary">
                  <Table2 size={15} />
                  {ar ? 'إدراج الجدول' : 'Insert table'}
                </button>
              </footer>
            </form>
          </RecordDialog>
        ) : null}
        {picker ? (
          <AdminMediaPicker
            locale={uiLocale}
            selected={imageReplace && imageDraft ? [imageDraft.mediaId] : []}
            multiple={false}
            onChange={addImage}
            onClose={() => setPicker(false)}
          />
        ) : null}
        {imageDraft && !picker ? (
          <RecordDialog
            title={ar ? 'الصورة والتفاصيل' : 'Image & details'}
            onClose={() => {
              setImageDraft(null);
              setFeedback('');
            }}
          >
            <form className="rich-editor-dialog-form" onSubmit={applyImage}>
              <img
                className="rich-editor-image-preview"
                src={adminMediaSource(imageDraft.mediaId)}
                alt={imageDraft.alt}
              />
              <button
                type="button"
                className="admin-button"
                onClick={() => {
                  setImageReplace(true);
                  setPicker(true);
                }}
              >
                <ImagePlus size={15} />
                {ar ? 'اختيار صورة أخرى' : 'Choose another image'}
              </button>
              <label className="admin-field">
                <span>{ar ? 'وصف الصورة للنص البديل' : 'Image description · alt text'}</span>
                <input
                  value={imageDraft.alt}
                  onChange={(event) => setImageDraft({ ...imageDraft, alt: event.target.value })}
                  maxLength={200}
                  disabled={imageDraft.decorative}
                  required={!imageDraft.decorative}
                />
              </label>
              <label className="rich-editor-check">
                <input
                  type="checkbox"
                  checked={imageDraft.decorative}
                  onChange={(event) =>
                    setImageDraft({ ...imageDraft, decorative: event.target.checked })
                  }
                />
                {ar ? 'صورة زخرفية لا تحتاج وصفاً' : 'Decorative image; no alternative text needed'}
              </label>
              <label className="admin-field">
                <span>{ar ? 'تعليق أسفل الصورة' : 'Caption under the image'}</span>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={imageDraft.caption}
                  onChange={(event) =>
                    setImageDraft({ ...imageDraft, caption: event.target.value })
                  }
                />
              </label>
              <div className="admin-grid">
                <label className="admin-field">
                  <span>{ar ? 'الحجم' : 'Image size'}</span>
                  <select
                    value={imageDraft.width}
                    onChange={(event) =>
                      setImageDraft({
                        ...imageDraft,
                        width: event.target.value as RichImageAttributes['width'],
                      })
                    }
                  >
                    <option value="wide">{ar ? 'عريض' : 'Wide'}</option>
                    <option value="full">{ar ? 'كامل العرض' : 'Full width'}</option>
                    <option value="half">{ar ? 'نصف العرض' : 'Half width'}</option>
                  </select>
                </label>
                <label className="admin-field">
                  <span>{ar ? 'المحاذاة' : 'Image alignment'}</span>
                  <select
                    value={imageDraft.align}
                    onChange={(event) =>
                      setImageDraft({
                        ...imageDraft,
                        align: event.target.value as RichImageAttributes['align'],
                      })
                    }
                  >
                    <option value="left">{ar ? 'اليسار' : 'Left'}</option>
                    <option value="center">{ar ? 'الوسط' : 'Centre'}</option>
                    <option value="right">{ar ? 'اليمين' : 'Right'}</option>
                  </select>
                </label>
              </div>
              {feedback ? (
                <p role="alert" className="rich-editor-feedback">
                  {feedback}
                </p>
              ) : null}
              <footer>
                <button type="button" className="admin-button" onClick={() => setImageDraft(null)}>
                  {ar ? 'إلغاء' : 'Cancel'}
                </button>
                <button type="submit" className="admin-button admin-button-primary">
                  <Check size={15} />
                  {imageDraft.position === null
                    ? ar
                      ? 'إضافة الصورة'
                      : 'Insert image'
                    : ar
                      ? 'حفظ تفاصيل الصورة'
                      : 'Save image details'}
                </button>
              </footer>
            </form>
          </RecordDialog>
        ) : null}
      </EditorDialogs>
    </div>
  );
}
