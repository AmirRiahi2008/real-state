'use client';

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  LoaderCircle,
  RefreshCw,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import type { Locale } from '@/lib/api';
import { AdminApiError, adminError, adminRequest } from './admin-api';
import { type RecordValue } from './admin-records-schema';

interface MediaRecord extends RecordValue {
  id: string;
  width: number;
  height: number;
  size: number;
}
interface MediaPage {
  data: MediaRecord[];
  meta: { page: number; totalPages: number; total: number };
}
export const adminMediaSource = (id: string) =>
  `/api/admin/media/manage/${encodeURIComponent(id)}/file`;

export function AdminMediaLibrary({
  locale,
  selected = [],
  onSelect,
  multiple = true,
}: {
  locale: Locale;
  selected?: string[];
  onSelect?: (media: MediaRecord) => void;
  multiple?: boolean;
}) {
  const ar = locale === 'ar';
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<MediaPage | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [removing, setRemoving] = useState<MediaRecord | null>(null);
  const [uploadMessage, setUploadMessage] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void adminRequest<MediaPage>(`/media/manage/mine?page=${page}&limit=12`, {
      signal: controller.signal,
    })
      .then((value) => {
        if (controller.signal.aborted) return;
        setResult(value);
        setError(null);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [page, refresh]);
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = new FormData(form);
    const file = body.get('file');
    setError(null);
    setUploadMessage('');
    if (!(file instanceof File) || !file.size) return;
    if (file.size > 5 * 1024 * 1024) {
      setError(new AdminApiError(413, 'Choose an image under 5 MB.'));
      return;
    }
    setBusy(true);
    setError(null);
    setUploadMessage('');
    try {
      const media = await adminRequest<MediaRecord>('/media', { method: 'POST', body });
      form.reset();
      setPage(1);
      setRefresh((value) => value + 1);
      setUploadMessage(ar ? 'تم رفع الصورة بأمان.' : 'Image uploaded successfully.');
      if (onSelect) onSelect(media);
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!removing) return;
    setBusy(true);
    setError(null);
    try {
      await adminRequest(`/media/${removing.id}`, { method: 'DELETE' });
      setRemoving(null);
      setRefresh((value) => value + 1);
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="admin-media-library">
      <form className="admin-media-upload" onSubmit={upload}>
        <UploadCloud size={27} aria-hidden="true" />
        <div>
          <h3>{ar ? 'مكتبة الصور' : 'Your image library'}</h3>
          <p className="admin-muted">
            {ar
              ? 'JPEG أو PNG أو WebP ثابتة. حتى ٥ ميغابايت. تُزال بيانات الصورة الخاصة تلقائياً.'
              : 'Static JPEG, PNG or WebP. Up to 5 MB. Private image metadata is removed automatically.'}
          </p>
        </div>
        <label className="admin-field admin-media-file">
          <span>{ar ? 'اختيار صورة' : 'Choose an image'}</span>
          <input
            type="file"
            name="file"
            accept="image/jpeg,image/png,image/webp"
            required
            disabled={busy}
          />
        </label>
        <button className="admin-button admin-button-primary" disabled={busy} type="submit">
          {busy ? (
            <LoaderCircle size={16} className="admin-records-spin" />
          ) : (
            <ImagePlus size={16} />
          )}
          {ar ? 'رفع صورة' : 'Upload image'}
        </button>
      </form>
      {uploadMessage ? (
        <p role="status" className="admin-alert admin-alert-success">
          {uploadMessage}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="admin-alert admin-alert-error">
          {adminError(error, locale)}
        </p>
      ) : null}
      <div className="admin-toolbar">
        <span className="admin-muted">
          {result
            ? `${result.meta.total} ${ar ? 'صورة' : 'images'}`
            : ar
              ? 'جارٍ التحميل…'
              : 'Loading…'}
          {onSelect
            ? ` · ${ar ? (multiple ? 'اختر الصور لإضافتها' : 'اختر صورة واحدة') : multiple ? 'Select images to attach' : 'Choose one image'}`
            : ''}
        </span>
        <button
          type="button"
          className="admin-button admin-button-ghost"
          onClick={() => setRefresh((value) => value + 1)}
          disabled={loading}
        >
          <RefreshCw size={15} />
          {ar ? 'تحديث' : 'Refresh'}
        </button>
      </div>
      {loading ? (
        <div className="admin-media-grid" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="admin-media-skeleton admin-skeleton" />
          ))}
        </div>
      ) : result?.data.length ? (
        <div className="admin-media-grid">
          {result.data.map((media) => {
            const chosen = selected.includes(media.id);
            return (
              <article className={`admin-media-tile${chosen ? ' is-selected' : ''}`} key={media.id}>
                {onSelect ? (
                  <button
                    type="button"
                    className="admin-media-select"
                    aria-pressed={chosen}
                    aria-label={`${ar ? 'اختيار الصورة' : 'Select image'} ${media.id.slice(0, 8)}`}
                    onClick={() => onSelect(media)}
                  >
                    <img
                      src={adminMediaSource(media.id)}
                      alt={`${ar ? 'صورة من المكتبة' : 'Library image'} ${media.id.slice(0, 8)}`}
                      loading="lazy"
                    />
                    <span>{chosen ? <Check size={18} /> : <ImagePlus size={18} />}</span>
                  </button>
                ) : (
                  <img
                    src={adminMediaSource(media.id)}
                    alt={`${ar ? 'صورة من المكتبة' : 'Library image'} ${media.id.slice(0, 8)}`}
                    loading="lazy"
                  />
                )}
                <div className="admin-media-tile-copy">
                  <span>
                    {media.width} × {media.height}
                    <small>
                      {new Intl.NumberFormat(ar ? 'ar-AE' : 'en-AE', {
                        maximumFractionDigits: 0,
                      }).format(media.size / 1024)}{' '}
                      KB
                    </small>
                  </span>
                  {!onSelect ? (
                    <button
                      className="admin-button admin-button-ghost admin-media-delete"
                      type="button"
                      aria-label={`${ar ? 'حذف الصورة' : 'Delete image'} ${media.id.slice(0, 8)}`}
                      onClick={() => setRemoving(media)}
                    >
                      <Trash2 size={15} />
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="admin-empty">
          <ImagePlus size={30} />
          <h3>{ar ? 'ابدأ بأول صورة.' : 'Make room for your first image.'}</h3>
          <p>
            {ar
              ? 'ارفع صورة لاستخدامها في العقارات والمشاريع والمحتوى.'
              : 'Upload an image to use across properties, projects and content.'}
          </p>
        </div>
      )}
      {result && result.meta.totalPages > 1 ? (
        <div className="admin-records-pagination">
          <button
            type="button"
            className="admin-button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((value) => value - 1)}
          >
            <ChevronLeft size={16} />
            {ar ? 'السابق' : 'Previous'}
          </button>
          <span>
            {page} / {result.meta.totalPages}
          </span>
          <button
            type="button"
            className="admin-button"
            disabled={page >= result.meta.totalPages || loading}
            onClick={() => setPage((value) => value + 1)}
          >
            {ar ? 'التالي' : 'Next'}
            <ChevronRight size={16} />
          </button>
        </div>
      ) : null}
      {removing ? (
        <RecordDialog
          title={ar ? 'حذف الصورة؟' : 'Delete this image?'}
          onClose={() => !busy && setRemoving(null)}
        >
          <p className="admin-muted">
            {ar
              ? 'تُحذف الصورة نهائياً. يجب فصل الصور المستخدمة في السجلات قبل حذفها.'
              : 'This permanently removes the image. Images attached to records must be detached first.'}
          </p>
          <img className="admin-media-delete-preview" src={adminMediaSource(removing.id)} alt="" />
          {error ? (
            <p className="admin-alert admin-alert-error" role="alert">
              {adminError(error, locale)}
            </p>
          ) : null}
          <div className="admin-inline-actions">
            <button
              className="admin-button"
              type="button"
              onClick={() => setRemoving(null)}
              disabled={busy}
            >
              {ar ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              className="admin-button admin-button-danger"
              type="button"
              onClick={() => void remove()}
              disabled={busy}
            >
              {busy ? (
                <LoaderCircle size={16} className="admin-records-spin" />
              ) : (
                <Trash2 size={16} />
              )}
              {ar ? 'حذف نهائي' : 'Delete permanently'}
            </button>
          </div>
        </RecordDialog>
      ) : null}
    </div>
  );
}

export function RecordDialog({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    element.showModal();
    return () => {
      if (element.open) element.close();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`admin-records-dialog${wide ? ' admin-records-dialog-wide' : ''}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="admin-records-dialog-header">
        <h2 id={titleId}>{title}</h2>
        <button
          className="admin-button admin-button-ghost"
          aria-label={/[\u0600-\u06ff]/u.test(title) ? 'إغلاق' : 'Close'}
          type="button"
          onClick={onClose}
        >
          <X size={19} />
        </button>
      </div>
      <div className="admin-records-dialog-body">{children}</div>
    </dialog>
  );
}

export function AdminMediaPicker({
  locale,
  selected,
  multiple = true,
  onChange,
  onClose,
}: {
  locale: Locale;
  selected: string[];
  multiple?: boolean;
  onChange: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [ids, setIds] = useState(selected);
  const ar = locale === 'ar';
  return (
    <RecordDialog title={ar ? 'اختيار الصور' : 'Choose imagery'} onClose={onClose} wide>
      <AdminMediaLibrary
        locale={locale}
        selected={ids}
        multiple={multiple}
        onSelect={(media) =>
          setIds((current) =>
            multiple
              ? current.includes(media.id)
                ? current.filter((id) => id !== media.id)
                : current.length < 30
                  ? [...current, media.id]
                  : current
              : [media.id],
          )
        }
      />
      <div className="admin-media-picker-footer">
        <span className="admin-muted">
          {ids.length} {ar ? 'محددة' : 'selected'}
        </span>
        <button
          className="admin-button admin-button-primary"
          type="button"
          onClick={() => {
            onChange(ids);
            onClose();
          }}
        >
          <Check size={16} />
          {ar ? 'استخدام الصور' : 'Use selected images'}
        </button>
      </div>
    </RecordDialog>
  );
}
