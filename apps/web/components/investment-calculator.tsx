'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { ArrowUpRight, Calculator, LoaderCircle } from 'lucide-react';
import { apiBrowser, type Locale } from '@/lib/api';

function formatAmount(value: string, locale: Locale): string {
  return `${locale === 'ar' ? 'د.إ' : 'AED'} ${new Intl.NumberFormat(locale === 'ar' ? 'ar-AE' : 'en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value))}`;
}

interface MortgageResult {
  monthlyPaymentAed: string;
  downPaymentAed: string;
  principalAed: string;
  totalInterestAed: string;
  totalRepaymentAed: string;
}
interface YieldResult {
  grossYieldPercent: string;
  netYieldPercent: string;
  annualNetIncomeAed: string;
}
export default function InvestmentCalculator({ locale }: { locale: Locale }) {
  const ar = locale === 'ar';
  const id = useId();
  const [mode, setMode] = useState<'mortgage' | 'yield'>('mortgage');
  const [result, setResult] = useState<MortgageResult | YieldResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  function switchMode(value: 'mortgage' | 'yield') {
    request.current?.abort();
    setMode(value);
    setResult(null);
    setError('');
    setBusy(false);
  }
  async function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const values = new FormData(form);
    const query = new URLSearchParams();
    for (const [key, value] of values.entries()) query.set(key, String(value));
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const value = await apiBrowser<MortgageResult | YieldResult>(
        `/calculators/${mode === 'mortgage' ? 'mortgage' : 'rental-yield'}?${query}`,
        { signal: controller.signal },
      );
      if (!controller.signal.aborted) setResult(value);
    } catch {
      if (!controller.signal.aborted)
        setError(
          ar
            ? 'تعذر حساب التقدير حالياً. تحقق من الأرقام وحاول مرة أخرى.'
            : 'We couldn’t calculate this estimate. Check the numbers and try again.',
        );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <div className="catalog-calculator">
      <div className="catalog-calculator-form">
        <div
          className="catalog-calculator-tabs"
          role="group"
          aria-label={ar ? 'نوع الحساب' : 'Calculator type'}
        >
          <button
            type="button"
            aria-pressed={mode === 'mortgage'}
            onClick={() => switchMode('mortgage')}
          >
            {ar ? 'التمويل العقاري' : 'Mortgage planner'}
          </button>
          <button type="button" aria-pressed={mode === 'yield'} onClick={() => switchMode('yield')}>
            {ar ? 'العائد الإيجاري' : 'Rental yield'}
          </button>
        </div>
        <form
          onSubmit={calculate}
          key={mode}
          onChange={() => {
            request.current?.abort();
            setResult(null);
            setError('');
            setBusy(false);
          }}
        >
          <div className="field">
            <label htmlFor={`${id}-price`}>
              {ar ? 'سعر العقار (درهم)' : 'Property price (AED)'}
            </label>
            <input
              className="input"
              id={`${id}-price`}
              name="priceAed"
              type="number"
              min="1"
              max="1000000000"
              step="0.01"
              required
              defaultValue="2000000"
              dir="ltr"
            />
          </div>
          {mode === 'mortgage' ? (
            <>
              <div className="catalog-form-row">
                <div className="field">
                  <label htmlFor={`${id}-down`}>
                    {ar ? 'الدفعة الأولى (%)' : 'Down payment (%)'}
                  </label>
                  <input
                    className="input"
                    id={`${id}-down`}
                    name="downPaymentPercent"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    required
                    defaultValue="25"
                    dir="ltr"
                  />
                </div>
                <div className="field">
                  <label htmlFor={`${id}-rate`}>
                    {ar ? 'الفائدة السنوية (%)' : 'Annual interest (%)'}
                  </label>
                  <input
                    className="input"
                    id={`${id}-rate`}
                    name="annualInterestRate"
                    type="number"
                    min="0"
                    max="30"
                    step="0.001"
                    required
                    defaultValue="4"
                    dir="ltr"
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor={`${id}-years`}>
                  {ar ? 'مدة القرض (سنوات)' : 'Loan term (years)'}
                </label>
                <input
                  className="input"
                  id={`${id}-years`}
                  name="years"
                  type="number"
                  min="1"
                  max="30"
                  step="1"
                  required
                  defaultValue="25"
                  dir="ltr"
                />
              </div>
            </>
          ) : (
            <>
              <div className="field">
                <label htmlFor={`${id}-rent`}>
                  {ar ? 'الإيجار السنوي المتوقع (درهم)' : 'Expected annual rent (AED)'}
                </label>
                <input
                  className="input"
                  id={`${id}-rent`}
                  name="annualRentAed"
                  type="number"
                  min="0"
                  max="1000000000"
                  step="0.01"
                  required
                  defaultValue="150000"
                  dir="ltr"
                />
              </div>
              <div className="field">
                <label htmlFor={`${id}-cost`}>
                  {ar ? 'التكاليف السنوية (درهم)' : 'Annual running costs (AED)'}
                </label>
                <input
                  className="input"
                  id={`${id}-cost`}
                  name="annualCostsAed"
                  type="number"
                  min="0"
                  max="1000000000"
                  step="0.01"
                  required
                  defaultValue="20000"
                  dir="ltr"
                />
              </div>
            </>
          )}
          {error ? (
            <p className="catalog-form-error" role="alert">
              {error}
            </p>
          ) : null}
          <button className="button button-primary" disabled={!ready || busy} type="submit">
            {busy ? (
              <LoaderCircle className="catalog-spinner" size={18} aria-hidden="true" />
            ) : (
              <Calculator size={18} aria-hidden="true" />
            )}
            {ar ? 'احسب تقديرك' : 'Calculate your estimate'}
            <ArrowUpRight size={18} aria-hidden="true" />
          </button>
        </form>
      </div>
      <div className="catalog-calculator-result" aria-live="polite" aria-busy={busy}>
        <span className="catalog-calculator-symbol">↗</span>
        <p className="eyebrow">{ar ? 'ابدأ برؤية أوضح' : 'A LITTLE MORE CLARITY'}</p>
        {result && 'monthlyPaymentAed' in result ? (
          <>
            <span className="catalog-result-label">
              {ar ? 'القسط الشهري التقديري' : 'Estimated monthly payment'}
            </span>
            <strong className="catalog-result-value">
              {formatAmount(result.monthlyPaymentAed, locale)}
            </strong>
            <dl>
              <div>
                <dt>{ar ? 'الدفعة الأولى' : 'Down payment'}</dt>
                <dd>{formatAmount(result.downPaymentAed, locale)}</dd>
              </div>
              <div>
                <dt>{ar ? 'مبلغ التمويل' : 'Loan amount'}</dt>
                <dd>{formatAmount(result.principalAed, locale)}</dd>
              </div>
              <div>
                <dt>{ar ? 'إجمالي الفوائد' : 'Total interest'}</dt>
                <dd>{formatAmount(result.totalInterestAed, locale)}</dd>
              </div>
            </dl>
          </>
        ) : result && 'grossYieldPercent' in result ? (
          <>
            <span className="catalog-result-label">
              {ar ? 'صافي العائد الإيجاري التقديري' : 'Estimated net rental yield'}
            </span>
            <strong className="catalog-result-value">{result.netYieldPercent}%</strong>
            <dl>
              <div>
                <dt>{ar ? 'العائد الإجمالي' : 'Gross yield'}</dt>
                <dd>{result.grossYieldPercent}%</dd>
              </div>
              <div>
                <dt>{ar ? 'صافي الدخل السنوي' : 'Annual net income'}</dt>
                <dd>{formatAmount(result.annualNetIncomeAed, locale)}</dd>
              </div>
            </dl>
          </>
        ) : (
          <>
            <h3>
              {ar
                ? 'الأرقام تساعدك على رؤية الصورة كاملة.'
                : 'Put a little perspective into your plans.'}
            </h3>
            <p>
              {ar
                ? 'أدخل افتراضاتك للحصول على تقدير مفصل من الحاسبة.'
                : 'Enter your assumptions to turn your plans into a more informed picture.'}
            </p>
          </>
        )}
        <p className="catalog-calculator-disclaimer">
          {mode === 'mortgage'
            ? ar
              ? 'تقدير توضيحي لقرض ثابت الفائدة، لا يمثل عرض تمويل. لا يشمل رسوم البنك والتأمين ونقل الملكية ورسوم الخدمات.'
              : 'An illustrative fixed-rate estimate, not a finance offer. Excludes bank fees, insurance, transfer fees and service charges.'
            : ar
              ? 'تقدير حسب مدخلاتك. لا يشمل الشغور وتكاليف التمويل والمعاملات أو تغير القيمة. العوائد غير مضمونة.'
              : 'An input-based estimate. Excludes vacancy, finance and transaction costs, and changes in property value. Returns are not guaranteed.'}
        </p>
      </div>
    </div>
  );
}
