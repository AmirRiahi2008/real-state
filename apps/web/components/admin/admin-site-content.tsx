'use client';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Check, RefreshCw, Save, Search } from 'lucide-react';
import type { Locale } from '@/lib/api';
import type { SiteContent, SiteValues } from '@/lib/admin-types';
import { announceSiteContentUpdate } from '../site-content-provider';
import { adminError, adminRequest, AdminApiError } from './admin-api';

export default function AdminSiteContent({ locale }: { locale: Locale }) {
  const ar = locale === 'ar';
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<SiteContent | null>(null),
    [draft, setDraft] = useState<SiteValues>({}),
    [section, setSection] = useState(''),
    [search, setSearch] = useState(''),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false),
    [conflict, setConflict] = useState(false);
  async function load() {
    setLoading(true);
    setError('');
    try {
      const next = await adminRequest<SiteContent>('/admin/site-content');
      setSnapshot(next);
      setDraft(next.values);
      setConflict(false);
      setSaved(false);
    } catch (e) {
      setError(adminError(e, locale));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load(); /* locale changes re-localize the request feedback */
  }, [locale]);
  const sections = useMemo(
    () => [...new Set(snapshot?.fields.map((f) => f.section) ?? [])],
    [snapshot],
  );
  const fields =
    snapshot?.fields.filter(
      (f) =>
        (!section || f.section === section) &&
        (!search ||
          `${f.label} ${f.key} ${draft[f.key]?.en} ${draft[f.key]?.ar}`
            .toLowerCase()
            .includes(search.toLowerCase())),
    ) ?? [];
  const changes = Object.fromEntries(
    Object.entries(draft).filter(
      ([key, value]) => JSON.stringify(value) !== JSON.stringify(snapshot?.values[key]),
    ),
  );
  const count = Object.keys(changes).length;
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!snapshot || !count || saving) return;
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const next = await adminRequest<SiteContent>('/admin/site-content', {
        method: 'PATCH',
        body: JSON.stringify({ expectedVersion: snapshot.version, values: changes }),
      });
      setSnapshot({ ...next, fields: next.fields ?? snapshot.fields });
      setDraft(next.values);
      announceSiteContentUpdate(next.values, next.version);
      router.refresh();
      setSaved(true);
      setConflict(false);
    } catch (e) {
      setConflict(e instanceof AdminApiError && e.status === 409);
      setError(adminError(e, locale));
    } finally {
      setSaving(false);
    }
  }
  function change(key: string, language: Locale, value: string) {
    setDraft((previous) => ({ ...previous, [key]: { ...previous[key], [language]: value } }));
    setSaved(false);
  }
  return (
    <section className="admin-module">
      <div className="admin-toolbar">
        <div>
          <p className="admin-kicker">{ar ? 'الموقع، بكلماتك' : 'YOUR WEBSITE, YOUR WORDS'}</p>
          <h2>{ar ? 'محتوى الموقع' : 'Website content'}</h2>
          <p>
            {ar
              ? 'حرّر النصوص الإنجليزية والعربية، بما فيها فصول البناء. تظهر التغييرات بعد الحفظ.'
              : 'Edit English and Arabic copy, including every chapter of the building story. Saved changes appear on the public website.'}
          </p>
        </div>
        <a className="admin-button" href={`/${locale}`} target="_blank" rel="noreferrer">
          {ar ? 'معاينة الموقع' : 'Preview website'}
          <ArrowUpRight size={16} />
        </a>
      </div>
      {error && (
        <div role="alert" className="admin-alert">
          {error}
          {conflict && (
            <button type="button" className="admin-button" onClick={() => void load()}>
              {ar ? 'تحميل النسخة الأحدث واستبدال المسودة' : 'Load latest and replace this draft'}
            </button>
          )}
        </div>
      )}
      {loading ? (
        <div className="admin-card admin-empty" aria-busy="true">
          {ar ? 'جارٍ تحميل المحتوى…' : 'Loading website content…'}
        </div>
      ) : !snapshot ? (
        <button className="admin-button" onClick={() => void load()}>
          <RefreshCw size={16} />
          {ar ? 'إعادة المحاولة' : 'Try again'}
        </button>
      ) : (
        <form onSubmit={save}>
          <div className="admin-card admin-toolbar">
            <label className="admin-field">
              <span>{ar ? 'القسم' : 'Section'}</span>
              <select value={section} onChange={(e) => setSection(e.target.value)}>
                <option value="">{ar ? 'جميع الأقسام' : 'All sections'}</option>
                {sections.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label className="admin-field">
              <span>
                <Search size={14} />
                {ar ? 'ابحث في المحتوى' : 'Find content'}
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={ar ? 'عنوان، كلمة، أو فصل' : 'Title, word, or chapter'}
              />
            </label>
            <button
              type="submit"
              className="admin-button admin-button-primary"
              disabled={saving || !count}
            >
              <Save size={16} />
              {saving
                ? ar
                  ? 'جارٍ الحفظ…'
                  : 'Saving…'
                : ar
                  ? `حفظ ${count} تغيير`
                  : `Save ${count} change${count === 1 ? '' : 's'}`}
            </button>
            <span role="status" className="admin-muted">
              {saved ? (
                <>
                  <Check size={15} />
                  {ar ? 'تم حفظ المحتوى' : 'Changes saved'}
                </>
              ) : ar ? (
                `الإصدار ${snapshot.version}`
              ) : (
                `Version ${snapshot.version}`
              )}
            </span>
          </div>
          {!fields.length && (
            <div className="admin-card admin-empty">
              {ar ? 'لا توجد نتائج.' : 'No matching content.'}
            </div>
          )}
          {fields.map((field) => (
            <fieldset className="admin-card admin-cms-field" key={field.key}>
              <legend>{field.label}</legend>
              <p className="admin-muted">{field.section}</p>
              <div className="admin-grid">
                {(['en', 'ar'] as const).map((language) => (
                  <label
                    key={language}
                    className="admin-field"
                    htmlFor={`cms-${field.key}-${language}`}
                  >
                    <span>{language === 'en' ? 'English' : 'العربية'}</span>
                    {field.maxLength > 300 ? (
                      <textarea
                        id={`cms-${field.key}-${language}`}
                        lang={language}
                        dir={language === 'ar' ? 'rtl' : 'ltr'}
                        rows={4}
                        maxLength={field.maxLength}
                        value={draft[field.key]?.[language] ?? ''}
                        onChange={(e) => change(field.key, language, e.target.value)}
                      />
                    ) : (
                      <input
                        id={`cms-${field.key}-${language}`}
                        lang={language}
                        dir={language === 'ar' ? 'rtl' : 'ltr'}
                        maxLength={field.maxLength}
                        value={draft[field.key]?.[language] ?? ''}
                        onChange={(e) => change(field.key, language, e.target.value)}
                      />
                    )}
                    <small className="admin-muted">
                      {(draft[field.key]?.[language] ?? '').length} / {field.maxLength}
                    </small>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </form>
      )}
    </section>
  );
}
