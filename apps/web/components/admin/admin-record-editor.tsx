'use client';

import { useId, useState, type FormEvent } from 'react';
import dynamic from 'next/dynamic';
import {
  validateDocument,
  fromPlainText,
  toPlainText,
  type RichDocument,
} from '@oriva/rich-content';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ImagePlus,
  LoaderCircle,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import type { Locale } from '@/lib/api';
import { adminError, adminRequest } from './admin-api';
import { AdminMediaPicker, adminMediaSource } from './admin-media-library';
import {
  enumLabel,
  initialRecord,
  labelFor,
  recordArray,
  recordConfigs,
  recordObject,
  recordPayload,
  recordText,
  type RecordField,
  type RecordSection,
  type RecordValue,
} from './admin-records-schema';

const RichTextEditor = dynamic(() => import('./rich-text-editor'), {
  ssr: false,
  loading: () => (
    <div className="admin-rich-loading" role="status">
      Preparing editor / جارٍ تجهيز المحرّر…
    </div>
  ),
});

interface EditorProps {
  section: RecordSection;
  locale: Locale;
  row?: RecordValue;
  options: RecordValue;
  onSaved: (row: RecordValue) => void;
  onCancel: () => void;
}
function relationLabel(row: RecordValue, locale: Locale) {
  const profile = recordObject(row.agentProfile);
  return recordText(
    (locale === 'ar' ? row.nameAr : row.nameEn) ||
      row.nameEn ||
      row.displayName ||
      profile.displayName ||
      [row.firstName, row.lastName].filter(Boolean).join(' ') ||
      row.email ||
      row.slug ||
      row.id,
  );
}
function choices(field: RecordField, options: RecordValue, value: RecordValue, locale: Locale) {
  if (field.options)
    return field.options.map((item) => ({
      value: item,
      label: enumLabel(item, locale),
      disabled: false,
    }));
  if (!field.relation) return [];
  return recordArray(options[field.relation])
    .filter((item) => {
      if (field.key === 'parentId') return item.id !== value.id;
      if (field.key === 'projectId')
        return (
          item.status === 'PUBLISHED' &&
          (!item.areaId || !value.areaId || item.areaId === value.areaId)
        );
      if (field.key === 'userId') return ['AGENT', 'ADMIN'].includes(recordText(item.role));
      return true;
    })
    .map((item) => ({
      value: recordText(item.id),
      label: `${relationLabel(item, locale)}${item.isActive === false ? (locale === 'ar' ? ' · غير مفعّل' : ' · inactive') : ''}`,
      disabled: item.isActive === false,
    }));
}

export default function AdminRecordEditor({
  section,
  locale,
  row,
  options,
  onSaved,
  onCancel,
}: EditorProps) {
  const config = recordConfigs[section];
  const ar = locale === 'ar';
  const prefix = useId();
  const editing = Boolean(row?.id);
  const [value, setValue] = useState<RecordValue>(() => initialRecord(config, row));
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState<string | null>(null);
  const set = (key: string, next: unknown) =>
    setValue((current) => {
      const updated = { ...current, [key]: next };
      if (key === 'priceOnRequest' && next) {
        updated[section === 'projects' ? 'startingPriceAed' : 'priceAed'] = null;
        if (section === 'listings') updated.previousPriceAed = null;
      }
      if (key === 'purpose') {
        if (next === 'SALE') updated.rentalPeriod = null;
        if (
          (next === 'SALE' && current.availability === 'RENTED') ||
          (next === 'RENT' && current.availability === 'SOLD')
        )
          updated.availability = 'AVAILABLE';
      }
      if (key === 'propertyType' && next === 'STUDIO') updated.bedrooms = 0;
      if (key === 'areaId' && current.projectId) {
        const project = recordArray(options.projects).find((item) => item.id === current.projectId);
        if (project?.areaId && project.areaId !== next) updated.projectId = null;
      }
      return updated;
    });
  const grouped = Array.from(new Set(config.fields.map((field) => field.group[0]))).map((group) =>
    config.fields.filter((field) => field.group[0] === group),
  );
  const attachments = recordArray(value.media);
  const milestones = recordArray(value.paymentPlan);
  const floorPlans = recordArray(value.floorPlans);
  const paymentTotal = milestones.reduce((total, item) => total + Number(item.percentage || 0), 0);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice('');
    setError(null);
    const payload = recordPayload(section, value, editing);
    for (const field of config.fields) {
      if (!field.richKey) continue;
      try {
        const document = validateDocument(
          value[field.richKey] ?? fromPlainText(recordText(value[field.key])),
          { minTextLength: field.minLength ?? 0, maxTextLength: field.maxLength ?? 100000 },
        );
        payload[field.richKey] = document;
        payload[field.key] = toPlainText(document).trim();
      } catch (error) {
        setNotice(
          `${labelFor(field.label, locale)}: ${ar ? `راجع المحتوى؛ يجب أن يتراوح طوله بين ${field.minLength ?? 0} و${field.maxLength ?? 100000} حرفاً وأن تكون الجداول والروابط صالحة.` : error instanceof Error ? error.message : 'Review this content before saving.'}`,
        );
        return;
      }
    }
    const richPlainKeys = new Set(
      config.fields.filter((field) => field.richKey).map((field) => field.key),
    );
    if (
      Object.entries(payload).some(
        ([key, item]) => !richPlainKeys.has(key) && typeof item === 'string' && /[<>]/u.test(item),
      )
    ) {
      setNotice(ar ? 'استخدم نصاً دون وسوم HTML.' : 'Use plain text without HTML tags.');
      return;
    }
    if (section === 'projects' && milestones.length && Math.abs(paymentTotal - 100) > 0.001) {
      setNotice(
        ar ? 'يجب أن يكون مجموع خطة الدفع ١٠٠٪.' : 'Payment milestones must total exactly 100%.',
      );
      return;
    }
    if (section === 'projects' && Number(value.minBedrooms) > Number(value.maxBedrooms)) {
      setNotice(
        ar
          ? 'الحد الأدنى للغرف يجب ألا يتجاوز الحد الأعلى.'
          : 'Minimum bedrooms cannot exceed maximum bedrooms.',
      );
      return;
    }
    if (
      section === 'projects' &&
      (!Array.isArray(value.propertyTypes) || !value.propertyTypes.length)
    ) {
      setNotice(ar ? 'اختر نوع عقار واحداً على الأقل.' : 'Choose at least one property type.');
      return;
    }
    if (
      section === 'projects' &&
      recordArray(payload.floorPlans).some(
        (item) =>
          Number(item.bedrooms) < Number(value.minBedrooms) ||
          Number(item.bedrooms) > Number(value.maxBedrooms),
      )
    ) {
      setNotice(
        ar
          ? 'عدد غرف كل مخطط يجب أن يطابق نطاق المشروع.'
          : 'Each floor plan must fit the project bedroom range.',
      );
      return;
    }
    if (
      (section === 'listings' || section === 'projects') &&
      !value.priceOnRequest &&
      !recordText(value[section === 'listings' ? 'priceAed' : 'startingPriceAed']).trim()
    ) {
      setNotice(
        ar ? 'أدخل السعر أو اختر «السعر عند الطلب».' : 'Enter a price or enable price on request.',
      );
      return;
    }
    if (section === 'listings' && value.purpose === 'RENT' && !value.rentalPeriod) {
      setNotice(ar ? 'اختر فترة الإيجار.' : 'Choose a rental period.');
      return;
    }
    setBusy(true);
    try {
      const saved = await adminRequest<RecordValue>(
        editing ? `${config.write}/${row!.id}` : config.write,
        { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(payload) },
      );
      onSaved(saved);
    } catch (error) {
      setError(error);
    } finally {
      setBusy(false);
    }
  }
  function fieldInput(field: RecordField) {
    const id = `${prefix}-${field.key}`;
    const fieldValue = value[field.key];
    const required =
      (field.required ||
        (field.key === 'rentalPeriod' && value.purpose === 'RENT') ||
        (field.key === 'handoverDate' &&
          section === 'listings' &&
          value.completion === 'OFF_PLAN') ||
        (['priceAed', 'startingPriceAed'].includes(field.key) && !value.priceOnRequest)) &&
      !(editing && field.createOnly);
    const readonly = editing && field.createOnly;
    const disabled =
      busy ||
      readonly ||
      (['priceAed', 'previousPriceAed', 'startingPriceAed'].includes(field.key) &&
        Boolean(value.priceOnRequest)) ||
      (field.key === 'rentalPeriod' && value.purpose === 'SALE');
    const inputType =
      field.type === 'decimal' ? 'number' : field.type === 'image' ? 'text' : field.type || 'text';
    if (field.type === 'richtext' && field.richKey)
      return (
        <div className="admin-records-rich-field admin-records-wide" key={field.key}>
          <RichTextEditor
            id={id}
            label={labelFor(field.label, locale)}
            locale={field.key.endsWith('Ar') ? 'ar' : 'en'}
            uiLocale={locale}
            value={value[field.richKey] as RichDocument | null}
            plainText={recordText(fieldValue)}
            disabled={busy}
            required={Boolean(required)}
            minLength={field.minLength}
            maxLength={field.maxLength}
            onChange={(document, plainText) =>
              setValue((current) => ({
                ...current,
                [field.key]: plainText,
                [field.richKey!]: document,
              }))
            }
          />
          {field.help ? <small>{labelFor(field.help, locale)}</small> : null}
        </div>
      );
    if (field.type === 'boolean')
      return (
        <label className="admin-records-toggle" key={field.key}>
          <input
            type="checkbox"
            checked={Boolean(fieldValue)}
            onChange={(event) => set(field.key, event.target.checked)}
            disabled={busy}
          />
          <span>
            <strong>{labelFor(field.label, locale)}</strong>
            {field.help ? <small>{labelFor(field.help, locale)}</small> : null}
          </span>
        </label>
      );
    if (field.type === 'multi') {
      const selected = Array.isArray(fieldValue) ? fieldValue.map(recordText) : [];
      const available = choices(field, options, value, locale);
      return (
        <fieldset className="admin-records-multiselect" key={field.key}>
          <legend>
            {labelFor(field.label, locale)}
            {required ? ' *' : ''}
          </legend>
          <div>
            {available.length ? (
              available.map((option) => (
                <label key={option.value}>
                  <input
                    type="checkbox"
                    checked={selected.includes(option.value)}
                    disabled={busy || option.disabled}
                    onChange={(event) =>
                      set(
                        field.key,
                        event.target.checked
                          ? [...selected, option.value]
                          : selected.filter((item) => item !== option.value),
                      )
                    }
                  />
                  <span>{option.label}</span>
                </label>
              ))
            ) : (
              <p className="admin-muted">
                {ar
                  ? 'أضف خيارات من القسم المرتبط أولاً.'
                  : 'Add options in the related section first.'}
              </p>
            )}
          </div>
        </fieldset>
      );
    }
    if (field.type === 'image') {
      const idValue = recordText(fieldValue);
      return (
        <div className="admin-field admin-records-wide" key={field.key}>
          <span>{labelFor(field.label, locale)}</span>
          <div className="admin-records-single-image">
            {idValue ? (
              <img src={adminMediaSource(idValue)} alt={ar ? 'الصورة المحددة' : 'Selected image'} />
            ) : (
              <ImagePlus size={25} />
            )}
            <button
              className="admin-button"
              type="button"
              onClick={() => setPicker(field.key)}
              disabled={busy}
            >
              <ImagePlus size={16} />
              {ar ? 'اختيار صورة' : 'Choose image'}
            </button>
            {idValue ? (
              <button
                className="admin-button admin-button-ghost"
                type="button"
                onClick={() => set(field.key, null)}
                disabled={busy}
              >
                <X size={16} />
                {ar ? 'إزالة' : 'Remove'}
              </button>
            ) : null}
          </div>
        </div>
      );
    }
    return (
      <div
        className={`admin-field${field.type === 'textarea' ? ' admin-records-wide' : ''}`}
        key={field.key}
      >
        <label htmlFor={id}>
          {labelFor(field.label, locale)}
          {required ? <span aria-hidden="true"> *</span> : null}
        </label>
        {field.type === 'select' ? (
          <select
            id={id}
            value={recordText(fieldValue)}
            onChange={(event) => set(field.key, event.target.value)}
            required={required}
            disabled={disabled}
          >
            <option value="">{ar ? 'اختر…' : 'Choose…'}</option>
            {choices(field, options, value, locale).map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>
        ) : field.type === 'textarea' ? (
          <textarea
            id={id}
            value={recordText(fieldValue)}
            onChange={(event) => set(field.key, event.target.value)}
            rows={field.key.startsWith('body') ? 12 : 5}
            required={required}
            minLength={field.minLength}
            maxLength={field.maxLength}
            disabled={busy}
            dir={field.key.endsWith('Ar') ? 'rtl' : field.key.endsWith('En') ? 'ltr' : undefined}
          />
        ) : (
          <input
            id={id}
            type={field.type === 'languages' ? 'text' : inputType}
            value={
              field.type === 'languages' && Array.isArray(fieldValue)
                ? fieldValue.map(recordText).join(', ')
                : recordText(fieldValue)
            }
            onChange={(event) => set(field.key, event.target.value)}
            required={required}
            disabled={disabled}
            min={field.min}
            max={field.max}
            step={
              field.type === 'number'
                ? '1'
                : field.type === 'decimal'
                  ? field.key === 'latitude' || field.key === 'longitude'
                    ? '0.000001'
                    : '0.01'
                  : undefined
            }
            minLength={field.minLength}
            maxLength={field.maxLength}
            pattern={field.key === 'slug' ? '[a-z0-9]+(-[a-z0-9]+)*' : undefined}
            dir={
              field.key.endsWith('Ar')
                ? 'rtl'
                : field.key.endsWith('En') ||
                    [
                      'slug',
                      'email',
                      'publicEmail',
                      'website',
                      'phone',
                      'whatsapp',
                      'permitUrl',
                    ].includes(field.key)
                  ? 'ltr'
                  : undefined
            }
          />
        )}
        {field.help ? <small>{labelFor(field.help, locale)}</small> : null}
      </div>
    );
  }
  function updateArray(key: string, index: number, field: string, next: unknown) {
    set(
      key,
      recordArray(value[key]).map((item, i) => (i === index ? { ...item, [field]: next } : item)),
    );
  }
  function removeArray(key: string, index: number) {
    set(
      key,
      recordArray(value[key]).filter((_, i) => i !== index),
    );
  }
  function moveImage(index: number, direction: number) {
    const next = [...attachments];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    set('media', next);
  }
  return (
    <div className="admin-records-editor">
      <div className="admin-records-editor-heading">
        <div>
          <p className="admin-records-eyebrow">
            {editing ? (ar ? 'تعديل السجل' : 'EDIT RECORD') : ar ? 'إضافة سجل' : 'CREATE RECORD'}
          </p>
          <h2>
            {editing
              ? recordText(row?.titleEn || row?.nameEn || row?.displayName || row?.slug)
              : `${ar ? 'إضافة' : 'New'} ${labelFor(config.singular, locale)}`}
          </h2>
          <p className="admin-muted">
            {config.publication
              ? ar
                ? 'الحفظ يُنشئ مسودة. راجع النسخة ثم انشرها لإظهار التغييرات للعامة.'
                : 'Saving creates a draft. Review and publish to make changes public.'
              : ar
                ? 'تُحفظ التغييرات مباشرةً. الحقول المعلّمة بنجمة مطلوبة.'
                : 'Changes are saved directly. Fields marked with an asterisk are required.'}
          </p>
        </div>
        <button
          className="admin-button admin-button-ghost"
          type="button"
          onClick={onCancel}
          disabled={busy}
        >
          <X size={17} />
          {ar ? 'إغلاق المحرر' : 'Close editor'}
        </button>
      </div>
      <form onSubmit={save}>
        {grouped.map((fields) => (
          <fieldset className="admin-records-fieldset" key={fields[0].group[0]}>
            <legend>{labelFor(fields[0].group, locale)}</legend>
            <div className="admin-grid">{fields.map(fieldInput)}</div>
          </fieldset>
        ))}
        {section === 'listings' || section === 'projects' ? (
          <fieldset className="admin-records-fieldset">
            <legend>{ar ? 'الصور وترتيب العرض' : 'Imagery & display order'}</legend>
            <div className="admin-toolbar">
              <p className="admin-muted">
                {ar
                  ? 'الصورة الأولى هي الغلاف. حتى ٣٠ صورة، مع وصف بديل باللغتين.'
                  : 'The first image is the cover. Add up to 30 images with bilingual alt text.'}
              </p>
              <button
                className="admin-button"
                type="button"
                disabled={busy}
                onClick={() => setPicker('media')}
              >
                <ImagePlus size={16} />
                {ar ? 'إدارة الصور' : 'Manage images'}
              </button>
            </div>
            {attachments.length ? (
              <div className="admin-records-attachments">
                {attachments.map((item, index) => (
                  <div className="admin-records-attachment" key={recordText(item.mediaId)}>
                    <img
                      src={adminMediaSource(recordText(item.mediaId))}
                      alt={recordText(item.altEn) || `${ar ? 'الصورة' : 'Image'} ${index + 1}`}
                    />
                    <div>
                      <span className="admin-badge">
                        {index === 0 ? (ar ? 'الغلاف' : 'Cover image') : `${index + 1}`}
                      </span>
                      <label className="admin-field">
                        <span>{ar ? 'وصف بديل بالإنجليزية' : 'English alt text'}</span>
                        <input
                          value={recordText(item.altEn)}
                          onChange={(event) =>
                            updateArray('media', index, 'altEn', event.target.value)
                          }
                          maxLength={200}
                          disabled={busy}
                          dir="ltr"
                        />
                      </label>
                      <label className="admin-field">
                        <span>{ar ? 'وصف بديل بالعربية' : 'Arabic alt text'}</span>
                        <input
                          value={recordText(item.altAr)}
                          onChange={(event) =>
                            updateArray('media', index, 'altAr', event.target.value)
                          }
                          maxLength={200}
                          disabled={busy}
                          dir="rtl"
                        />
                      </label>
                    </div>
                    <div className="admin-records-image-actions">
                      <button
                        className="admin-button admin-button-ghost"
                        type="button"
                        aria-label={ar ? 'تحريك الصورة للأعلى' : 'Move image up'}
                        disabled={busy || index === 0}
                        onClick={() => moveImage(index, -1)}
                      >
                        <ArrowUp size={16} />
                      </button>
                      <button
                        className="admin-button admin-button-ghost"
                        type="button"
                        aria-label={ar ? 'تحريك الصورة للأسفل' : 'Move image down'}
                        disabled={busy || index === attachments.length - 1}
                        onClick={() => moveImage(index, 1)}
                      >
                        <ArrowDown size={16} />
                      </button>
                      <button
                        className="admin-button admin-button-ghost"
                        type="button"
                        aria-label={ar ? 'إزالة الصورة' : 'Detach image'}
                        disabled={busy}
                        onClick={() => removeArray('media', index)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="admin-records-inline-empty">
                <ImagePlus size={22} />
                <span>
                  {ar
                    ? 'اختر صورة قبل إرسال العقار للمراجعة.'
                    : 'Choose an image before submitting for review.'}
                </span>
              </div>
            )}
          </fieldset>
        ) : null}
        {section === 'projects' ? (
          <>
            <fieldset className="admin-records-fieldset">
              <legend>{ar ? 'خطة الدفع' : 'Payment milestones'}</legend>
              <div className="admin-toolbar">
                <p className="admin-muted">
                  {ar
                    ? 'يمكن ترك الخطة فارغة، أو توزيع ١٠٠٪ على المراحل.'
                    : 'Leave the plan empty, or distribute exactly 100% across milestones.'}
                </p>
                <span
                  className={`admin-badge ${!milestones.length || Math.abs(paymentTotal - 100) < 0.001 ? 'admin-badge-green' : 'admin-badge-amber'}`}
                >
                  {Number.isFinite(paymentTotal) ? paymentTotal.toFixed(2) : '0'}%
                </span>
              </div>
              {milestones.map((item, index) => (
                <div className="admin-records-repeater" key={index}>
                  <label className="admin-field">
                    <span>{ar ? 'المرحلة بالإنجليزية' : 'English milestone'}</span>
                    <input
                      value={recordText(item.labelEn)}
                      onChange={(event) =>
                        updateArray('paymentPlan', index, 'labelEn', event.target.value)
                      }
                      minLength={2}
                      maxLength={120}
                      required
                      dir="ltr"
                      disabled={busy}
                    />
                  </label>
                  <label className="admin-field">
                    <span>{ar ? 'المرحلة بالعربية' : 'Arabic milestone'}</span>
                    <input
                      value={recordText(item.labelAr)}
                      onChange={(event) =>
                        updateArray('paymentPlan', index, 'labelAr', event.target.value)
                      }
                      minLength={2}
                      maxLength={120}
                      required
                      dir="rtl"
                      disabled={busy}
                    />
                  </label>
                  <label className="admin-field">
                    <span>{ar ? 'النسبة ٪' : 'Percentage %'}</span>
                    <input
                      type="number"
                      value={recordText(item.percentage)}
                      onChange={(event) =>
                        updateArray('paymentPlan', index, 'percentage', event.target.value)
                      }
                      min={0.01}
                      max={100}
                      step={0.01}
                      required
                      disabled={busy}
                    />
                  </label>
                  <button
                    className="admin-button admin-button-ghost"
                    type="button"
                    aria-label={ar ? 'حذف المرحلة' : 'Remove milestone'}
                    onClick={() => removeArray('paymentPlan', index)}
                    disabled={busy}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              ))}
              <button
                className="admin-button"
                type="button"
                disabled={busy || milestones.length >= 20}
                onClick={() =>
                  set('paymentPlan', [...milestones, { labelEn: '', labelAr: '', percentage: '' }])
                }
              >
                <Plus size={16} />
                {ar ? 'إضافة مرحلة' : 'Add milestone'}
              </button>
            </fieldset>
            <fieldset className="admin-records-fieldset">
              <legend>{ar ? 'مخططات الوحدات' : 'Floor plans'}</legend>
              {floorPlans.map((item, index) => (
                <div className="admin-records-repeater admin-records-floor-row" key={index}>
                  <label className="admin-field">
                    <span>{ar ? 'الاسم بالإنجليزية' : 'English plan name'}</span>
                    <input
                      value={recordText(item.nameEn)}
                      onChange={(event) =>
                        updateArray('floorPlans', index, 'nameEn', event.target.value)
                      }
                      minLength={2}
                      maxLength={120}
                      required
                      dir="ltr"
                      disabled={busy}
                    />
                  </label>
                  <label className="admin-field">
                    <span>{ar ? 'الاسم بالعربية' : 'Arabic plan name'}</span>
                    <input
                      value={recordText(item.nameAr)}
                      onChange={(event) =>
                        updateArray('floorPlans', index, 'nameAr', event.target.value)
                      }
                      minLength={2}
                      maxLength={120}
                      required
                      dir="rtl"
                      disabled={busy}
                    />
                  </label>
                  <label className="admin-field">
                    <span>{ar ? 'غرف النوم' : 'Bedrooms'}</span>
                    <input
                      type="number"
                      value={recordText(item.bedrooms)}
                      onChange={(event) =>
                        updateArray('floorPlans', index, 'bedrooms', event.target.value)
                      }
                      min={0}
                      max={50}
                      step={1}
                      required
                      disabled={busy}
                    />
                  </label>
                  <label className="admin-field">
                    <span>{ar ? 'المساحة م²' : 'Area m²'}</span>
                    <input
                      type="number"
                      value={recordText(item.areaSqm)}
                      onChange={(event) =>
                        updateArray('floorPlans', index, 'areaSqm', event.target.value)
                      }
                      min={0.01}
                      step={0.01}
                      required
                      disabled={busy}
                    />
                  </label>
                  <button
                    className="admin-button admin-button-ghost"
                    type="button"
                    aria-label={ar ? 'حذف المخطط' : 'Remove floor plan'}
                    onClick={() => removeArray('floorPlans', index)}
                    disabled={busy}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              ))}
              <button
                className="admin-button"
                type="button"
                disabled={busy || floorPlans.length >= 50}
                onClick={() =>
                  set('floorPlans', [
                    ...floorPlans,
                    { nameEn: '', nameAr: '', bedrooms: value.minBedrooms || 0, areaSqm: '' },
                  ])
                }
              >
                <Plus size={16} />
                {ar ? 'إضافة مخطط' : 'Add floor plan'}
              </button>
            </fieldset>
          </>
        ) : null}
        {notice ? (
          <p className="admin-alert admin-alert-error" role="alert">
            {notice}
          </p>
        ) : null}
        {error ? (
          <p className="admin-alert admin-alert-error" role="alert">
            {adminError(error, locale)}
          </p>
        ) : null}
        <div className="admin-records-editor-footer">
          <span className="admin-muted">
            {editing && value.version
              ? `${ar ? 'الإصدار' : 'Version'} ${value.version}`
              : ar
                ? 'سجل جديد'
                : 'New record'}
          </span>
          <div className="admin-inline-actions">
            <button type="button" className="admin-button" disabled={busy} onClick={onCancel}>
              {ar ? 'إلغاء' : 'Cancel'}
            </button>
            <button type="submit" className="admin-button admin-button-primary" disabled={busy}>
              {busy ? (
                <LoaderCircle size={16} className="admin-records-spin" />
              ) : editing ? (
                <Save size={16} />
              ) : (
                <Check size={16} />
              )}
              {busy
                ? ar
                  ? 'جارٍ الحفظ…'
                  : 'Saving…'
                : config.publication
                  ? ar
                    ? 'حفظ المسودة'
                    : 'Save draft'
                  : ar
                    ? 'حفظ التغييرات'
                    : 'Save changes'}
            </button>
          </div>
        </div>
      </form>
      {picker ? (
        <AdminMediaPicker
          locale={locale}
          multiple={picker === 'media'}
          selected={
            picker === 'media'
              ? attachments.map((item) => recordText(item.mediaId))
              : recordText(value[picker])
                ? [recordText(value[picker])]
                : []
          }
          onClose={() => setPicker(null)}
          onChange={(ids) =>
            picker === 'media'
              ? set(
                  'media',
                  ids.map((id, position) => ({
                    ...(attachments.find((item) => item.mediaId === id) ?? {
                      altEn: '',
                      altAr: '',
                    }),
                    mediaId: id,
                    position,
                  })),
                )
              : set(picker, ids[0] || null)
          }
        />
      ) : null}
    </div>
  );
}
