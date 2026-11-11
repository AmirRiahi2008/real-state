'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Check, LoaderCircle } from 'lucide-react';
import { apiBrowser, type Locale } from '@/lib/api';

type LeadType = 'ENQUIRY' | 'VIEWING' | 'PROJECT' | 'VALUATION' | 'MORTGAGE';
export default function LeadForm({
  locale,
  listingId,
  projectId,
  type = 'VALUATION',
  title,
}: {
  locale: Locale;
  listingId?: string;
  projectId?: string;
  type?: LeadType;
  title?: string;
}) {
  const ar = locale === 'ar';
  const id = useId();
  const submitted = useRef(false);
  const [requestType, setRequestType] = useState<LeadType>(type);
  const [state, setState] = useState<'idle' | 'sending' | 'success'>('idle');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitted.current) return;
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const values = new FormData(form);
    const payload: Record<string, unknown> = {
      type: requestType,
      name: String(values.get('name') ?? '').trim(),
      email: String(values.get('email') ?? '').trim(),
      phone: String(values.get('phone') ?? '').replace(/[\s()-]/g, ''),
      message: String(values.get('message') ?? '').trim(),
      consent: values.get('consent') === 'on',
    };
    if (!/^\+[1-9]\d{6,14}$/.test(String(payload.phone))) {
      setError(
        ar
          ? 'أدخل رقم الهاتف بالصيغة الدولية، مثل ‎+971501234567.'
          : 'Enter your phone in international format, for example +971501234567.',
      );
      return;
    }
    if (listingId) payload.listingId = listingId;
    if (projectId) payload.projectId = projectId;
    if (requestType === 'VIEWING') {
      const value = String(values.get('preferredAt') ?? '');
      const date = new Date(value);
      if (
        !value ||
        !Number.isFinite(date.getTime()) ||
        date.getTime() <= Date.now() ||
        date.getTime() > Date.now() + 365 * 86400000
      ) {
        setError(
          ar
            ? 'اختر موعداً خلال السنة القادمة. الوقت حسب منطقتك الزمنية.'
            : 'Choose a time within the next year. Times use your local timezone.',
        );
        return;
      }
      payload.preferredAt = date.toISOString();
    }
    setError('');
    setState('sending');
    submitted.current = true;
    try {
      await apiBrowser('/leads', { method: 'POST', body: JSON.stringify(payload) });
      setState('success');
      form.reset();
    } catch (cause) {
      const status =
        cause && typeof cause === 'object' && 'status' in cause ? Number(cause.status) : 0;
      setError(
        status === 429
          ? ar
            ? 'تم إرسال عدة طلبات. انتظر دقيقة ثم حاول مجدداً.'
            : 'A few too many requests. Please wait a minute and try again.'
          : status === 404 || status === 400
            ? ar
              ? 'تعذر إرسال الطلب. تحقق من البيانات وتوفر العقار ثم حاول مجدداً.'
              : 'We could not send this request. Check your details and property availability, then try again.'
            : ar
              ? 'تعذر الاتصال حالياً. لم نؤكد إرسال طلبك. يرجى المحاولة مرة أخرى.'
              : 'We could not reach our team. Your request has not been confirmed; please try again.',
      );
      setState('idle');
      submitted.current = false;
    }
  }
  if (state === 'success')
    return (
      <div className="catalog-form-success" role="status">
        <span className="catalog-success-icon">
          <Check size={30} aria-hidden="true" />
        </span>
        <p className="eyebrow">{ar ? 'بداية جديدة' : 'YOUR NEXT CHAPTER'}</p>
        <h3>{ar ? 'وصل طلبك.' : 'You’re on our list.'}</h3>
        <p>
          {ar
            ? 'تم استلام طلبك وسيراجعه فريقنا. نتطلع لمساعدتك في خطوتك القادمة.'
            : 'Your request has been received for our team to review. We look forward to helping with your next move.'}
        </p>
        <button
          type="button"
          className="button button-outline"
          onClick={() => {
            submitted.current = false;
            setState('idle');
          }}
        >
          {ar ? 'إرسال طلب آخر' : 'Send another request'}
        </button>
      </div>
    );
  return (
    <form
      className="catalog-lead-form"
      onSubmit={submit}
      method="post"
      action="/api/backend/v1/leads"
    >
      <div>
        <p className="eyebrow">{ar ? 'لنتحدث عن المستقبل' : 'LET’S MAKE IT YOURS'}</p>
        <h3>{title ?? (ar ? 'خطوتك القادمة تبدأ هنا.' : 'Your next chapter starts here.')}</h3>
        <p className="muted">
          {ar
            ? 'أخبرنا بما تبحث عنه. سنساعدك في استكشاف الخيارات المناسبة.'
            : 'Tell us what you have in mind. We’ll help you explore the possibilities.'}
        </p>
      </div>
      {listingId ? (
        <fieldset className="catalog-request-tabs">
          <legend className="catalog-sr-only">{ar ? 'نوع الطلب' : 'Request type'}</legend>
          {(['ENQUIRY', 'VIEWING'] as const).map((value) => (
            <label key={value} className={requestType === value ? 'is-active' : ''}>
              <input
                type="radio"
                name={`${id}-type`}
                value={value}
                checked={requestType === value}
                onChange={() => setRequestType(value)}
              />
              {value === 'VIEWING'
                ? ar
                  ? 'طلب معاينة'
                  : 'Book a viewing'
                : ar
                  ? 'طلب تفاصيل'
                  : 'Ask a question'}
            </label>
          ))}
        </fieldset>
      ) : !projectId ? (
        <div className="field">
          <label htmlFor={`${id}-intent`}>{ar ? 'كيف يمكننا مساعدتك؟' : 'How can we help?'}</label>
          <select
            id={`${id}-intent`}
            className="input"
            value={requestType}
            onChange={(event) => setRequestType(event.target.value as LeadType)}
          >
            <option value="VALUATION">
              {ar ? 'استشارة عقارية أو تقييم' : 'Property advice or a valuation'}
            </option>
            <option value="MORTGAGE">
              {ar ? 'مناقشة خيارات التمويل' : 'Discuss mortgage options'}
            </option>
          </select>
        </div>
      ) : null}
      <div className="field">
        <label htmlFor={`${id}-name`}>{ar ? 'الاسم الكامل' : 'Full name'}</label>
        <input
          className="input"
          id={`${id}-name`}
          name="name"
          autoComplete="name"
          required
          minLength={2}
          maxLength={160}
          placeholder={ar ? 'اسمك الكامل' : 'Your full name'}
        />
      </div>
      <div className="catalog-form-row">
        <div className="field">
          <label htmlFor={`${id}-email`}>{ar ? 'البريد الإلكتروني' : 'Email address'}</label>
          <input
            className="input"
            id={`${id}-email`}
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            placeholder="you@example.com"
            dir="ltr"
          />
        </div>
        <div className="field">
          <label htmlFor={`${id}-phone`}>{ar ? 'رقم الهاتف' : 'Phone number'}</label>
          <input
            className="input"
            id={`${id}-phone`}
            name="phone"
            type="tel"
            autoComplete="tel"
            required
            maxLength={24}
            placeholder="+971 50 123 4567"
            dir="ltr"
          />
        </div>
      </div>
      {requestType === 'VIEWING' ? (
        <div className="field">
          <label htmlFor={`${id}-time`}>
            {ar ? 'موعد المعاينة المفضل' : 'Preferred viewing time'}
          </label>
          <input
            className="input"
            id={`${id}-time`}
            name="preferredAt"
            type="datetime-local"
            required
            aria-describedby={`${id}-timezone`}
          />
          <small className="muted" id={`${id}-timezone`}>
            {ar
              ? 'حسب المنطقة الزمنية لجهازك؛ الموعد رهن التأكيد.'
              : 'In your device’s timezone. Subject to confirmation.'}
          </small>
        </div>
      ) : null}
      <div className="field">
        <label htmlFor={`${id}-message`}>{ar ? 'بماذا تفكر؟' : 'What are you looking for?'}</label>
        <textarea
          className="input"
          id={`${id}-message`}
          name="message"
          rows={4}
          required
          minLength={10}
          maxLength={3000}
          placeholder={
            ar
              ? 'أخبرنا عن احتياجاتك أو أسئلتك…'
              : 'A little about your plans, questions or ideal home…'
          }
        />
      </div>
      <label className="catalog-consent">
        <input name="consent" type="checkbox" required />
        <span>
          {ar
            ? 'أوافق على استخدام بياناتي للتواصل معي بشأن هذا الطلب.'
            : 'I agree to my details being used to contact me about this request.'}
        </span>
      </label>
      {error ? (
        <p className="catalog-form-error" role="alert">
          {error}
        </p>
      ) : null}
      <button
        className="button button-primary catalog-submit"
        type="submit"
        disabled={!ready || state === 'sending'}
      >
        {state === 'sending' ? (
          <>
            <LoaderCircle className="catalog-spinner" size={18} aria-hidden="true" />
            {ar ? 'جارٍ الإرسال…' : 'Sending…'}
          </>
        ) : (
          <>
            {ar ? 'لنبدأ الحديث' : 'Start a conversation'}
            <ArrowUpRight size={18} aria-hidden="true" />
          </>
        )}
      </button>
      <p className="catalog-form-note">
        {ar
          ? 'بياناتك مخصصة لهذا الطلب. لا تُنشر معلومات التواصل على الموقع.'
          : 'Your contact details stay private and are used for your request.'}{' '}
        <Link
          href={`/${locale}/privacy`}
          style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}
        >
          {ar ? 'الخصوصية' : 'Privacy'}
        </Link>
      </p>
    </form>
  );
}
