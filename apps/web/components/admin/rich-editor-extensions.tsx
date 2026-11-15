'use client';

import { Node } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import { GripVertical, Settings2, Trash2 } from 'lucide-react';
import type { Locale } from '@/lib/api';
import { adminMediaSource } from './admin-media-library';

export interface RichImageAttributes {
  mediaId: string;
  alt: string;
  caption: string;
  width: 'full' | 'wide' | 'half';
  align: 'left' | 'center' | 'right';
}
interface MediaImageOptions {
  uiLocale: Locale;
  onEditImage: (attributes: RichImageAttributes, position: number) => void;
}
const mediaIdPattern =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu;
export function imageAttributes(attributes: Record<string, unknown>): RichImageAttributes {
  return {
    mediaId: typeof attributes.mediaId === 'string' ? attributes.mediaId : '',
    alt: typeof attributes.alt === 'string' ? attributes.alt : '',
    caption: typeof attributes.caption === 'string' ? attributes.caption : '',
    width: attributes.width === 'full' || attributes.width === 'half' ? attributes.width : 'wide',
    align:
      attributes.align === 'left' || attributes.align === 'right' ? attributes.align : 'center',
  };
}
function MediaImageView({ node, extension, selected, editor, getPos, deleteNode }: NodeViewProps) {
  const attributes = imageAttributes(node.attrs);
  const options = extension.options as MediaImageOptions;
  const ar = options.uiLocale === 'ar';
  return (
    <NodeViewWrapper
      className={`rich-image-view${selected ? ' is-selected' : ''}`}
      data-width={attributes.width}
      data-align={attributes.align}
    >
      <figure contentEditable={false}>
        {mediaIdPattern.test(attributes.mediaId) ? (
          <img src={adminMediaSource(attributes.mediaId)} alt={attributes.alt} draggable={false} />
        ) : (
          <div className="rich-image-unavailable">
            {ar ? 'الصورة غير متاحة' : 'Image unavailable'}
          </div>
        )}
        {attributes.caption ? <figcaption>{attributes.caption}</figcaption> : null}
      </figure>
      {editor.isEditable ? (
        <div className="rich-image-controls" contentEditable={false}>
          <span data-drag-handle title={ar ? 'اسحب لتغيير موضع الصورة' : 'Drag to move the image'}>
            <GripVertical size={16} />
          </span>
          <button
            type="button"
            aria-label={ar ? 'تعديل الصورة ووصفها' : 'Edit image and description'}
            onClick={() => {
              const position = getPos();
              if (typeof position === 'number') options.onEditImage(attributes, position);
            }}
          >
            <Settings2 size={15} /> {ar ? 'تعديل' : 'Edit'}
          </button>
          <button
            type="button"
            aria-label={ar ? 'حذف الصورة من النص' : 'Remove image from content'}
            onClick={deleteNode}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ) : null}
    </NodeViewWrapper>
  );
}

/** Images persist a library identifier, never a user-controlled URL or an HTML fragment. */
export const MediaImage = Node.create<MediaImageOptions>({
  name: 'image',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addOptions() {
    return { uiLocale: 'en', onEditImage: () => undefined };
  },
  addAttributes() {
    return {
      mediaId: { default: null, parseHTML: (element) => element.getAttribute('data-media-id') },
      alt: { default: '' },
      caption: { default: '', parseHTML: (element) => element.getAttribute('data-caption') || '' },
      width: {
        default: 'wide',
        parseHTML: (element) => element.getAttribute('data-width') || 'wide',
      },
      align: {
        default: 'center',
        parseHTML: (element) => element.getAttribute('data-align') || 'center',
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'img[data-media-id]',
        getAttrs: (element) =>
          mediaIdPattern.test(element.getAttribute('data-media-id') || '') ? null : false,
      },
    ];
  },
  renderHTML({ node }) {
    const attributes = imageAttributes(node.attrs);
    return [
      'img',
      {
        src: mediaIdPattern.test(attributes.mediaId)
          ? adminMediaSource(attributes.mediaId)
          : undefined,
        'data-media-id': attributes.mediaId,
        'data-caption': attributes.caption,
        'data-width': attributes.width,
        'data-align': attributes.align,
        alt: attributes.alt,
      },
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(MediaImageView);
  },
});
