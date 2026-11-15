'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  ClipboardList,
  FilePenLine,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  Send,
  X,
} from 'lucide-react';
import type { Locale } from '@/lib/api';
import { adminError, adminRequest } from './admin-api';
import AdminRecordEditor from './admin-record-editor';
import { AdminMediaLibrary, RecordDialog } from './admin-media-library';
import {
  enumLabel,
  isRecordSection,
  labelFor,
  recordConfigs,
  recordObject,
  recordText,
  type RecordSection,
  type RecordValue,
} from './admin-records-schema';
import './admin-records.css';

interface RecordPage {
  data: RecordValue[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
type PublicationAction = 'submit' | 'publish' | 'reject' | 'archive';

export default function AdminRecords({ section, locale }: { section: string; locale: Locale }) {
  if (section === 'media')
    return (
      <section className="admin-records">
        <div className="admin-section-title">
          <div>
            <p className="admin-records-eyebrow">
              {locale === 'ar' ? 'مكتبة الموقع' : 'THE SITE LIBRARY'}
            </p>
            <h1>{locale === 'ar' ? 'الصور والوسائط' : 'Media & imagery'}</h1>
            <p className="admin-muted">
              {locale === 'ar'
                ? 'أصول الصور لجميع العقارات والمشاريع والمحتوى.'
                : 'The visual assets behind every property, project and story.'}
            </p>
          </div>
        </div>
        <div className="admin-card">
          <AdminMediaLibrary locale={locale} />
        </div>
      </section>
    );
  if (!isRecordSection(section)) return null;
  return <AdminRecordManager key={section} section={section} locale={locale} />;
}

function AdminRecordManager({ section, locale }: { section: RecordSection; locale: Locale }) {
  const ar = locale === 'ar';
  const config = recordConfigs[section];
  const [page, setPage] = useState(1);
  const [data, setData] = useState<RecordPage | null>(null);
  const [options, setOptions] = useState<RecordValue>({});
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState('');
  const [editor, setEditor] = useState<RecordValue | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<RecordValue | null>(null);
  const [filter, setFilter] = useState('');
  const [status, setStatus] = useState('');
  const heading = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void Promise.all([
      adminRequest<RecordPage>(`${config.list}?page=${page}&limit=12`, {
        signal: controller.signal,
      }),
      adminRequest<RecordValue>('/admin/options', { signal: controller.signal }),
    ])
      .then(([rows, relationships]) => {
        if (controller.signal.aborted) return;
        setData(rows);
        setOptions(relationships);
        setError(null);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [config.list, page, refresh]);
  const filtered = useMemo(() => {
    const query = filter.trim().toLocaleLowerCase();
    return (data?.data ?? []).filter(
      (row) =>
        (!query ||
          [
            row.nameEn,
            row.nameAr,
            row.titleEn,
            row.titleAr,
            row.displayName,
            row.slug,
            row.reference,
          ].some((value) => recordText(value).toLocaleLowerCase().includes(query))) &&
        (!status || row.status === status),
    );
  }, [data, filter, status]);
  const title = (row: RecordValue) =>
    recordText(
      (ar ? row.titleAr || row.nameAr : row.titleEn || row.nameEn) ||
        row.titleEn ||
        row.nameEn ||
        row.displayName ||
        row.slug,
    );
  async function edit(row: RecordValue) {
    setError(null);
    setNotice('');
    setBusy(recordText(row.id));
    try {
      const detail = config.detail
        ? await adminRequest<RecordValue>(`${config.detail}/${row.id}`)
        : row;
      setEditor(detail);
      requestAnimationFrame(() =>
        heading.current?.scrollIntoView({ behavior: 'instant', block: 'start' }),
      );
    } catch (error) {
      setError(error);
    } finally {
      setBusy(null);
    }
  }
  async function transition(row: RecordValue, action: PublicationAction) {
    setBusy(recordText(row.id));
    setError(null);
    setNotice('');
    try {
      await adminRequest(`${config.write}/${row.id}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ version: Number(row.version) }),
      });
      setArchiveTarget(null);
      setRefresh((value) => value + 1);
      setNotice(
        action === 'publish'
          ? ar
            ? 'تم النشر. يظهر المحتوى الآن في الموقع.'
            : 'Published. The content is now available on the website.'
          : action === 'archive'
            ? ar
              ? 'تمت الأرشفة وإزالة المحتوى من الموقع العام.'
              : 'Archived and removed from the public website.'
            : action === 'submit'
              ? ar
                ? 'تم الإرسال للمراجعة. يمكنك الآن نشر السجل.'
                : 'Submitted for review. You can now publish this record.'
              : ar
                ? 'أعيد السجل إلى المسودات.'
                : 'The record has returned to drafts.',
      );
    } catch (error) {
      setError(error);
    } finally {
      setBusy(null);
    }
  }
  function saved() {
    setEditor(null);
    setPage(1);
    setRefresh((value) => value + 1);
    setNotice(
      config.publication
        ? ar
          ? 'تم حفظ المسودة. انشرها لإظهارها للعامة.'
          : 'Draft saved. Publish it to make it public.'
        : ar
          ? 'تم حفظ التغييرات.'
          : 'Changes saved successfully.',
    );
  }
  const count = data?.meta.total ?? 0;
  return (
    <section className="admin-records" ref={heading}>
      {editor ? (
        <div className="admin-card">
          <AdminRecordEditor
            key={recordText(editor.id) || 'new'}
            section={section}
            locale={locale}
            row={editor.id ? editor : undefined}
            options={options}
            onSaved={saved}
            onCancel={() => setEditor(null)}
          />
        </div>
      ) : (
        <>
          <div className="admin-section-title">
            <div>
              <p className="admin-records-eyebrow">{ar ? 'مساحة الإدارة' : 'CONTENT WORKSPACE'}</p>
              <h1>
                {labelFor(config.title, locale)}
                <span className="admin-records-count">
                  {new Intl.NumberFormat(ar ? 'ar-AE' : 'en-AE').format(count)}
                </span>
              </h1>
              <p className="admin-muted">{labelFor(config.description, locale)}</p>
            </div>
            <button
              type="button"
              className="admin-button admin-button-primary"
              disabled={loading || Boolean(busy)}
              onClick={() => {
                setError(null);
                setNotice('');
                setEditor({});
              }}
            >
              <Plus size={17} />
              {ar ? 'إضافة' : 'Add'} {labelFor(config.singular, locale)}
            </button>
          </div>
          {notice ? (
            <div className="admin-alert admin-alert-success" role="status">
              <CircleCheck size={17} />
              {notice}
            </div>
          ) : null}
          {error ? (
            <div className="admin-alert admin-alert-error" role="alert">
              {adminError(error, locale)}
              <button
                className="admin-button admin-button-ghost"
                type="button"
                onClick={() => setRefresh((value) => value + 1)}
              >
                {ar ? 'إعادة التحميل' : 'Reload records'}
              </button>
            </div>
          ) : null}
          <div className="admin-card admin-records-list-card">
            <div className="admin-toolbar admin-records-toolbar">
              <label className="admin-records-search">
                <Search size={17} />
                <span className="admin-records-sr-only">
                  {ar ? 'تصفية هذه الصفحة' : 'Filter this page'}
                </span>
                <input
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  placeholder={ar ? 'تصفية هذه الصفحة…' : 'Filter this page…'}
                  type="search"
                />
              </label>
              <div className="admin-inline-actions">
                {config.publication ? (
                  <label className="admin-records-status-filter">
                    <span className="admin-records-sr-only">
                      {ar ? 'تصفية الحالة في الصفحة' : 'Filter this page by status'}
                    </span>
                    <select value={status} onChange={(event) => setStatus(event.target.value)}>
                      <option value="">
                        {ar ? 'كل الحالات في الصفحة' : 'All statuses on this page'}
                      </option>
                      {['DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED']
                        .filter((value) => config.publication === 'review' || value !== 'IN_REVIEW')
                        .map((value) => (
                          <option value={value} key={value}>
                            {enumLabel(value, locale)}
                          </option>
                        ))}
                    </select>
                  </label>
                ) : null}
                <button
                  className="admin-button admin-button-ghost"
                  type="button"
                  onClick={() => setRefresh((value) => value + 1)}
                  disabled={loading || Boolean(busy)}
                >
                  <RefreshCw size={16} />
                  {ar ? 'تحديث' : 'Refresh'}
                </button>
              </div>
            </div>
            {loading ? (
              <div className="admin-records-loading" aria-busy="true">
                {Array.from({ length: 5 }, (_, index) => (
                  <div className="admin-records-skeleton-row" key={index}>
                    <i className="admin-skeleton" />
                    <span className="admin-skeleton" />
                    <b className="admin-skeleton" />
                  </div>
                ))}
              </div>
            ) : filtered.length ? (
              <div className="admin-table-wrap">
                <table className="admin-table admin-records-table">
                  <thead>
                    <tr>
                      <th>{ar ? 'السجل' : 'Record'}</th>
                      <th>
                        {config.publication
                          ? ar
                            ? 'الحالة'
                            : 'Status'
                          : ar
                            ? 'التفاصيل'
                            : 'Details'}
                      </th>
                      <th>{ar ? 'آخر تحديث' : 'Last updated'}</th>
                      <th>
                        <span className="admin-records-sr-only">
                          {ar ? 'الإجراءات' : 'Actions'}
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row) => {
                      const rowStatus = recordText(row.status);
                      const id = recordText(row.id);
                      const active = Boolean(row.isActive ?? row.isPublic ?? true);
                      const rowBusy = busy === id;
                      return (
                        <tr key={id}>
                          <td>
                            <div className="admin-records-title-cell">
                              <span
                                className={`admin-records-record-icon admin-records-icon-${section}`}
                              >
                                <ClipboardList size={19} />
                              </span>
                              <div>
                                <strong>{title(row)}</strong>
                                <small>
                                  {recordText(
                                    row.reference || row.slug || recordObject(row.user).email,
                                  )}
                                </small>
                                {section === 'listings' || section === 'projects' ? (
                                  <small>
                                    {row.priceOnRequest
                                      ? ar
                                        ? 'السعر عند الطلب'
                                        : 'Price on request'
                                      : `${ar ? 'درهم' : 'AED'} ${new Intl.NumberFormat(ar ? 'ar-AE' : 'en-AE', { maximumFractionDigits: 0 }).format(Number(row.priceAed || row.startingPriceAed || 0))}`}
                                  </small>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td>
                            {config.publication ? (
                              <span
                                className={`admin-badge ${rowStatus === 'PUBLISHED' ? 'admin-badge-green' : rowStatus === 'IN_REVIEW' ? 'admin-badge-amber' : rowStatus === 'DRAFT' ? 'admin-badge-lavender' : ''}`}
                              >
                                {enumLabel(rowStatus, locale)}
                              </span>
                            ) : section === 'amenities' ? (
                              <span className="admin-badge admin-badge-green">
                                {ar ? 'متاح للاستخدام' : 'Ready to use'}
                              </span>
                            ) : (
                              <span className={`admin-badge ${active ? 'admin-badge-green' : ''}`}>
                                {section === 'agents'
                                  ? active
                                    ? ar
                                      ? 'ظاهر للعامة'
                                      : 'Public profile'
                                    : ar
                                      ? 'ملف خاص'
                                      : 'Private profile'
                                  : active
                                    ? ar
                                      ? 'مفعّل'
                                      : 'Active'
                                    : ar
                                      ? 'غير مفعّل'
                                      : 'Inactive'}
                              </span>
                            )}
                            {section === 'articles' ? (
                              <small className="admin-records-cell-note">
                                {enumLabel(recordText(row.type), locale)}
                              </small>
                            ) : null}
                          </td>
                          <td className="admin-records-date-cell">
                            {row.updatedAt || row.createdAt
                              ? new Intl.DateTimeFormat(ar ? 'ar-AE' : 'en-AE', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                }).format(new Date(recordText(row.updatedAt || row.createdAt)))
                              : '—'}
                            {row.version ? (
                              <small>
                                {ar ? 'إصدار' : 'Version'} {recordText(row.version)}
                              </small>
                            ) : null}
                          </td>
                          <td>
                            <div className="admin-records-row-actions">
                              <button
                                type="button"
                                className="admin-button admin-button-ghost"
                                disabled={
                                  Boolean(busy) ||
                                  (rowStatus === 'ARCHIVED' && section !== 'articles')
                                }
                                onClick={() => void edit(row)}
                              >
                                {rowBusy ? (
                                  <LoaderCircle size={16} className="admin-records-spin" />
                                ) : (
                                  <FilePenLine size={16} />
                                )}
                                {ar ? 'تعديل' : 'Edit'}
                              </button>
                              {config.publication === 'review' && rowStatus === 'DRAFT' ? (
                                <button
                                  type="button"
                                  className="admin-button admin-button-ghost"
                                  disabled={Boolean(busy)}
                                  onClick={() => void transition(row, 'submit')}
                                >
                                  <Send size={15} />
                                  {ar ? 'للمراجعة' : 'Submit'}
                                </button>
                              ) : null}
                              {config.publication &&
                              (rowStatus === 'IN_REVIEW' ||
                                (config.publication === 'direct' && rowStatus === 'DRAFT')) ? (
                                <button
                                  type="button"
                                  className="admin-button admin-button-primary"
                                  disabled={Boolean(busy)}
                                  onClick={() => void transition(row, 'publish')}
                                >
                                  <Check size={15} />
                                  {ar ? 'نشر' : 'Publish'}
                                </button>
                              ) : null}
                              {rowStatus === 'IN_REVIEW' && config.publication === 'review' ? (
                                <button
                                  type="button"
                                  className="admin-button admin-button-ghost"
                                  disabled={Boolean(busy)}
                                  onClick={() => void transition(row, 'reject')}
                                >
                                  <X size={15} />
                                  {ar ? 'إرجاع' : 'Return'}
                                </button>
                              ) : null}
                              {rowStatus === 'PUBLISHED' && config.preview ? (
                                <Link
                                  className="admin-button admin-button-ghost"
                                  href={`/${locale}/${config.preview}/${recordText(row.slug)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <ArrowUpRight size={15} />
                                  {ar ? 'عرض' : 'View'}
                                </Link>
                              ) : null}
                              {config.publication && rowStatus !== 'ARCHIVED' ? (
                                <button
                                  type="button"
                                  className="admin-button admin-button-ghost"
                                  disabled={Boolean(busy)}
                                  onClick={() => setArchiveTarget(row)}
                                  aria-label={`${ar ? 'أرشفة' : 'Archive'} ${title(row)}`}
                                >
                                  <Archive size={15} />
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="admin-empty">
                <ClipboardList size={32} />
                <h3>
                  {filter || status
                    ? ar
                      ? 'لا توجد نتائج في هذه الصفحة.'
                      : 'No matches on this page.'
                    : ar
                      ? 'ابدأ بسجل جديد.'
                      : 'Your next record starts here.'}
                </h3>
                <p>
                  {filter || status
                    ? ar
                      ? 'غيّر التصفية أو انتقل إلى صفحة أخرى.'
                      : 'Change the filters or move to another page.'
                    : ar
                      ? 'أضف محتوى جديداً لبناء مجموعتك.'
                      : 'Add a new record to build your collection.'}
                </p>
                {filter || status ? (
                  <button
                    type="button"
                    className="admin-button"
                    onClick={() => {
                      setFilter('');
                      setStatus('');
                    }}
                  >
                    {ar ? 'مسح التصفية' : 'Clear filters'}
                  </button>
                ) : (
                  <button type="button" className="admin-button" onClick={() => setEditor({})}>
                    <Plus size={16} />
                    {ar ? 'إضافة سجل' : 'Add record'}
                  </button>
                )}
              </div>
            )}
            {data ? (
              <div className="admin-records-pagination">
                <span className="admin-muted">
                  {ar ? 'عرض' : 'Showing'} {filtered.length} {ar ? 'من أصل' : 'of'}{' '}
                  {data.meta.total} · {ar ? 'الصفحة' : 'Page'} {page} /{' '}
                  {Math.max(1, data.meta.totalPages)}
                </span>
                <div className="admin-inline-actions">
                  <button
                    type="button"
                    className="admin-button"
                    disabled={loading || page <= 1}
                    onClick={() => {
                      setPage((current) => current - 1);
                      setFilter('');
                      setStatus('');
                    }}
                  >
                    <ChevronLeft size={16} />
                    {ar ? 'السابق' : 'Previous'}
                  </button>
                  <button
                    type="button"
                    className="admin-button"
                    disabled={loading || page >= data.meta.totalPages}
                    onClick={() => {
                      setPage((current) => current + 1);
                      setFilter('');
                      setStatus('');
                    }}
                  >
                    {ar ? 'التالي' : 'Next'}
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          {config.publication ? (
            <p className="admin-records-publishing-note">
              <Check size={16} />
              {ar
                ? 'التعديلات تُحفظ كمسودات قبل النشر. الأرشفة تزيل السجل من الموقع مع الاحتفاظ بسجل التغييرات.'
                : 'Edits are saved as drafts before publication. Archiving removes a record publicly while retaining its history.'}
            </p>
          ) : null}
        </>
      )}
      {archiveTarget ? (
        <RecordDialog
          title={ar ? 'أرشفة هذا السجل؟' : 'Archive this record?'}
          onClose={() => !busy && setArchiveTarget(null)}
        >
          <p>
            <strong>{title(archiveTarget)}</strong>
          </p>
          <p className="admin-muted">
            {ar
              ? 'سيختفي من الموقع العام. تحتفظ الأرشفة بالسجل والتاريخ؛ العقارات والمشاريع المؤرشفة لا يمكن تعديلها.'
              : 'It will be removed from the public website. Its record and history remain; archived properties and projects cannot be edited.'}
          </p>
          {error ? (
            <p className="admin-alert admin-alert-error" role="alert">
              {adminError(error, locale)}
            </p>
          ) : null}
          <div className="admin-inline-actions">
            <button
              type="button"
              className="admin-button"
              onClick={() => setArchiveTarget(null)}
              disabled={Boolean(busy)}
            >
              {ar ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              className="admin-button admin-button-danger"
              onClick={() => void transition(archiveTarget, 'archive')}
              disabled={Boolean(busy)}
            >
              {busy ? (
                <LoaderCircle size={16} className="admin-records-spin" />
              ) : (
                <Archive size={16} />
              )}
              {ar ? 'أرشفة السجل' : 'Archive record'}
            </button>
          </div>
        </RecordDialog>
      ) : null}
    </section>
  );
}
